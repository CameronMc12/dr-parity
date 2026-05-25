# ClickUp Backend API Contract

Reverse-engineered map of every backend endpoint the ClickUp web frontend can call. Built by merging two sources:

- **SOURCE A (static):** the localized minified bundle at `docs/research/crawl/app.clickup.com/replay-site/_ext/app-cdn.clickup.com/*.js` (128 chunks). Yields path templates the app *knows how to call* even when the crawl never triggered them.
- **SOURCE B (runtime):** the crawl network log `docs/research/crawl/app.clickup.com/2026-05-25T14-56-26-606Z/network.jsonl` (9,510 request records, 3,598 xhr/fetch) plus `websocket.jsonl`. Yields real methods, statuses, and response shapes.

> The crawl ran against an **empty workspace** (no Spaces / Folders / Lists / Tasks). It repeated the inbox bootstrap sequence ~30 times, so the distinct observed set is small and bodies are minimal. No tokens or secrets appear in this document.

## Method/template extraction caveat

The Angular bundle builds most request URLs by concatenating a base host with path fragments at runtime, so only **template-literal** call sites (e.g. `` `hierarchy/v3/.../workspaces/${e}/views` ``) survive as greppable literals. The cleanest literal source in the bundle is `src21-*.js`, a generated SDK for the `v3-user` access/permissions service that uses OpenAPI-style `{param}` templates. Methods for static-only endpoints are inferred from path semantics (and from the SDK where available). No `PUT`/`DELETE`/`PATCH` were observed at runtime because the empty workspace produced read traffic only.

---

## Summary

| Metric | Value |
|--------|-------|
| Distinct endpoints | **118** |
| Observed only (runtime) | 79 |
| Static only (bundle) | 39 |
| Both (static + observed) | 14 |

### By classification

| Class | Count | Meaning |
|-------|-------|---------|
| READ | 71 | GET (or search-style POST) returning data. Clonable by serving export data. |
| SIMPLE_WRITE | 18 | Single-resource CRUD POST/PUT/DELETE. Clonable with modest logic. |
| COMPLEX_LOGIC | 24 | Automations, AI, permissions/ACL, search, sync, exports, realtime. Reimplement or stub. |
| AUTH | 5 | Token / session / shard handshake. |

Static-asset hosts (`app-cdn.clickup.com`, segment.io, split.io, chameleon.io, datadog, etc.) were filtered out of the contract.

---

## Priority READ endpoints for core views

These power the sidebar/hierarchy, lists, tasks, and inbox/tray. **Implement these first in the bridge backend.**

### Bootstrap + shell

- `GET /workspace-v3/experience/bootstrap/{workspaceId}` — feature-flag + experience bootstrap (returns `{ ff: {...} }`).
- `GET /workspace-v3/core/workspace/{workspaceId}` — core workspace record.
- `GET /team/v1/team/{workspaceId}` — team/billing summary.
- `GET /user/v1/user?include_teams=true&include_invited_by=true` — current user + memberships.
- `GET /user/v1/sessionSettings/user` — session/UI settings.

### Sidebar / hierarchy

- `GET /hierarchy/v3/experience/sidebar/workspaces/{workspaceId}/tree` — the sidebar tree (Spaces/Folders/Lists).
- `GET /hierarchy/v3/experience/sidebar/workspaces/{workspaceId}/views` — sidebar views.
- `GET /hierarchy/v3/experience/sidebar/workspaces/{workspaceId}/shared` — shared section.
- `GET /hierarchy/v3/experience/workspaces/{workspaceId}?fields[]=core` — hierarchy core fields.
- `GET /hierarchy/v3/experience/workspaces/{workspaceId}?fields[]=location_statuses` — location status sets.
- `GET /hierarchy/v1/project?team={workspaceId}&include_view_settings=true` — legacy project tree.
- `GET /hierarchy/v1/team/{workspaceId}/projectFeatures` — per-feature toggles.
- `GET /hierarchy/v1/team/{workspaceId}/personalListHierarchy` — personal lists.

### People / fields / statuses

- `GET /v3-user/experience/{workspaceId}/users?includeWorkspaceUserProfile=true` — workspace members.
- `GET /user/v1/team/{workspaceId}/member` — member list.
- `GET /user/v1/team/{workspaceId}/group` — user groups.
- `GET /customFields/v1/team/{workspaceId}/fields` — custom fields.
- `GET /customFields/v2/team/{workspaceId}/fields/taskStatuses` — task statuses.
- `GET /tasks/v1/{workspaceId}/customItems` — custom task types.

### Tasks / inbox / tray

- `POST /task-v3/experience/{workspaceId}/tasks/bulk` — bulk task fetch by ids (read despite POST).
- `POST /inbox/v3/workspaces/{workspaceId}/notifications/bundles/search` — inbox notifications (`{ last_page: true, ... }`).
- `POST /inbox/v3/workspaces/{workspaceId}/notifications/bundles/stats/fetch` — inbox counts.
- `GET /data/v3/workspaces/{workspaceId}/badging/badge_count?badge_type=home_aggregate` — badge counts (`{ count: 0 }`).
- `GET /home/user/{userId}/lineup?team_id={workspaceId}` — home lineup.

---

## Endpoint families (full contract)

The complete machine-readable list is in `BACKEND_CONTRACT.json`. Grouped overview by service:

| Family | Host | Classes present | Notes |
|--------|------|-----------------|-------|
| `hierarchy/v1`, `hierarchy/v3` | frontdoor | READ | sidebar tree/views/shared, projectFeatures, tray, personalLists |
| `workspace-v3` | frontdoor | READ | bootstrap + core workspace |
| `user/v1` | frontdoor | READ | user, members, groups, roles, weights, online |
| `v3-user` | frontdoor | READ, SIMPLE_WRITE, COMPLEX_LOGIC, AUTH | experience users CRUD, access/ACL permissions SDK, user-attributes, email auth |
| `customFields/v1`, `customFields/v2`, `field/v3` | frontdoor | READ | fields + taskStatuses + field jobs search |
| `tasks/v1`, `task-v3` | frontdoor | READ, SIMPLE_WRITE, COMPLEX_LOGIC | customItems CRUD, bulk task fetch, history, merge |
| `comment-service/v3` | frontdoor | READ | scheduled comments, last-read threads, deltas |
| `chat/v1` | frontdoor | READ | settings, room deltas, room email address |
| `inbox/v3` | frontdoor | READ | notification bundles search + stats |
| `data/v3` | frontdoor | READ, SIMPLE_WRITE, COMPLEX_LOGIC | badging, sections, emojis, clips, billing_usage, attachments, syncup, recordings, meetings, gantt, dashboards, baselines |
| `ui/v3`, `docs/v1` | frontdoor | READ, SIMPLE_WRITE | doc counts, doc pages CRUD, page history, subtasks tree |
| `view/v1` | frontdoor | READ | public view |
| `notification/v2` | frontdoor | READ | notification settings + global toggles |
| `team/v1`, `plan/v1`, `plan/v2`, `payment/v1`, `entitlements/v1` | frontdoor | READ | billing/plan/entitlement reads |
| `approvals-service`, `scheduling/v1`, `goals/v1`, `dashboard` | frontdoor | READ | counts + current state |
| `automation` | frontdoor | COMPLEX_LOGIC | triggers usage, AI agents |
| `growth-v1` | frontdoor | READ, COMPLEX_LOGIC | per-user/workspace config flags, onboarding, canny hash |
| `auth/v1`, `data/v3/.../authentication`, `shard/v1`, `v2/sd` | id.app / frontdoor | AUTH | refresh token, access tokens, shard handshake, sso |
| `graphql/gateway` | frontdoor-search | COMPLEX_LOGIC | search + AI (ProbeQuery, AiToolsQuery) |
| `set-cookie` | clickup-attachments | AUTH | attachment-domain cookie bridge |

---

## WebSocket

Two realtime sockets are opened on load.

### 1. Primary change feed — `wss://frontdoor-prod-eu-west-1-3.clickup.com/ws`

`?client_platform=web&client_version=<v>`

- **Client message types (`method`):** `auth`, `projectId`, `category`, `subcategory`, `subscribe`, `heartbeat`.
- **Server message types (`msg`):** `AuthReceived`, `heartbeatReply`.
- The client authenticates, then subscribes by `projectId` / `category` / `subcategory` tuples. In a populated workspace the server pushes entity-change events on those channels. The empty workspace produced no data-change frames, only auth + heartbeat.
- **Classification:** COMPLEX_LOGIC (realtime). For a clone, a stub that ACKs `auth` with `AuthReceived` and replies to `heartbeat` with `heartbeatReply` is enough to keep the UI from erroring.

### 2. Search / AI gateway — `wss://frontdoor-search.clickup-eu.com/graphql/gateway`

`?c=gws-web-1`

- graphql-ws protocol. Backs the command bar search and AI tools.
- **Classification:** COMPLEX_LOGIC.

---

## Clone strategy implication

1. **READ tier (71 endpoints)** is the bulk of the contract and is fully clonable by serving captured/export data keyed by `{workspaceId}`. The priority list above is the minimum set to render the shell + sidebar + inbox.
2. **SIMPLE_WRITE tier (18)** can be backed by an in-memory or file-backed store mirroring the resource shapes.
3. **COMPLEX_LOGIC tier (24)** and both WebSockets should be **stubbed** to return empty/neutral payloads first, then reimplemented only if a target view depends on them.
4. **AUTH tier (5)** should short-circuit to a fixed local session so the app boots without a real identity backend.
