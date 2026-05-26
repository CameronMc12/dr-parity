# Owned Backend Command API

The owned backend (`scripts/backend-server.ts`, default `:8787`) accepts mutating
requests, maps them to domain commands, appends events to the CQRS event store,
advances the `tasks` projection, and returns an internal-shape acknowledgement.
A subsequent read (`/hierarchy/v1/subcategory/{id}`, `/view/v1/genericView`,
`/task-v3/.../tasks/bulk`) reflects the change because reads are served from the
same projection.

Two surfaces map to the SAME commands:
1. An owned `/cmd/v1/{CommandType}` namespace (clean target for the parity harness).
2. ClickUp's native task mutation routes (so the real bundle's writes land).

A mutating request that matches no mapping (telemetry, auth, beacons) is NOT a
command: it falls through to the read router / recording fallback. No regression.

## Response shape

```json
{ "ok": true, "command": "CreateTask", "id": "task_00000001",
  "list_id": "901523543274", "events": 1, "idempotent": false }
```

On validation failure the server returns `400` with `{ "ok": false, "error": "..." }`.

## Commands

| Command | `/cmd/v1` route | Native route | Body → payload |
|---|---|---|---|
| CreateTask | `POST /cmd/v1/CreateTask` | `POST /v1/list/{listId}/task` | `{ listId, name, status?, description? }` (native: `listId` from path; `content` accepted as description) |
| SetTaskStatus | `POST /cmd/v1/SetTaskStatus` | `PUT /v1/task/{taskId}` with `{ status }` | `{ taskId, status }` |
| UpdateTask | `POST /cmd/v1/UpdateTask` | `PUT /v1/task/{taskId}` with `{ name }` and/or `{ description }`/`{ content }` | `{ taskId, name?, description? }` (at least one) |
| AssignTask | `POST /cmd/v1/AssignTask` | `POST /v1/task/{taskId}/assignee` with `{ assignee }` | `{ taskId, assigneeId }` |
| MoveTask | `POST /cmd/v1/MoveTask` | `PUT /v1/task/{taskId}/list` with `{ list }` | `{ taskId, listId }` |
| ArchiveTask | `POST /cmd/v1/ArchiveTask` | `PUT /v1/task/{taskId}` with `{ archived }` | `{ taskId, archived? }` (default `true`) |
| DeleteTask | `POST /cmd/v1/DeleteTask` | `DELETE /v1/task/{taskId}` | `{ taskId }` |
| AddComment | `POST /cmd/v1/AddComment` | `POST /v1/task/{taskId}/comment` with `{ comment_text }` | `{ taskId, text }` |

`{taskId}` is matched as `[0-9a-z]+` (ClickUp ids) or a runtime `task_NNNNNNNN` id.

## Events appended

`CreateTask → TaskCreated`, `SetTaskStatus → TaskStatusChanged`,
`UpdateTask → TaskRenamed` and/or `TaskDescriptionSet`, `AssignTask → TaskAssigned`,
`MoveTask → TaskMoved`, `ArchiveTask → TaskArchived`, `DeleteTask → TaskDeleted`,
`AddComment → CommentAdded`. Each handler is a no-op when the command would not
change state (idempotent invariants), so re-issuing a SetTaskStatus to the same
value appends nothing.

## Through the replay bundle

The emitted Service Worker forwards these routes to the backend when built with
`--backend=http://localhost:8787`. The widened `BACKEND_DATA_PATTERNS` in
`engine/targets/webapp/replay/emit-sw.ts` include `/cmd/v1/`, `/v1/list/{id}/task`,
and `/v1/task/{taskId}[/assignee|list|comment]`. The non-degenerate-body gate
still applies to reads, so a bad payload always falls back to the recording.

## Determinism

Event ids, task ids, comment ids, and timestamps come from a `DeterministicIdGen`
/ `DeterministicClock`. The event-id generator is primed past the seeded event
count on attach so a fresh server process never reuses a seeded `event_id`.

## Verified

API-level (server on `:8787`, list `901523543274`):
- Before: `tasks/bulk` returns 21 tasks.
- `POST /cmd/v1/CreateTask` + `POST /v1/list/{id}/task` → `tasks/bulk` returns 23,
  both new task names present.
- `POST /cmd/v1/SetTaskStatus` on `86c9yhzen` → status `Open` → `complete`,
  reflected in `tasks/bulk` and a `complete` status group appears.
