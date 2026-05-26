# Parity Backend Reconstruction Blueprint

Reconstruct a deterministic, owned backend for a captured complex web app (ClickUp) using captured traffic + UI state as INPUTS to a real domain model. Runtime is deterministic and non-LLM. CQRS + event sourcing.

## Philosophy
Capture is scaffolding, not the backend. We auto-derive what is observable (schema, response shapes, command→event mappings, allow/deny matrix) and hand-author only what is not (invariants, rollups, policies). Minimise hand-written logic.

## Architecture

```
 CAPTURE (offline)                         RUNTIME (deterministic, no LLM)
 Playwright  → state graph, storage,       ┌ real bundle (replay) | owned React ┐
   before/after state hash                 └──────────────┬─────────────────────┘
 mitmproxy   → transport bodies + ws        API gateway / SW proxy → command|query
 Keploy      → API pairs + mocks + tests          │                         │
 rrweb       → DOM event timeline           ┌──────▼──────┐          ┌───────▼──────┐
        │ correlate(ctx+t+stateHash+fp)     │ Command Bus │          │ Query API    │
        ▼                                   │ validate +  │          │ (read models)│
 Unified Artifact Graph + Command           │ authz +     │          └───────▲──────┘
 Observations (write→cmd→Δstate)            │ invariants  │                  │
        │ generates handlers/schemas/tests  └──────┬──────┘   project        │
        ▼                                   append │  ┌────────────────┐     │
                                            EVENT STORE (append-only + snapshots)─┘
                                                   │ outbox
                                    ┌──────────────┼───────────────┐
                                Process Mgrs   Realtime Fanout   Search/Index
```

Two deployment shapes, same domain layer: (1) local **Node + SQLite** (MVP/offline, no infra) → scale to **Postgres + Redis**; (2) **SQLite-WASM + OPFS** in-browser (zero-install offline, Electron).

**MVP stack decision:** SQLite (better-sqlite3 or node:sqlite) event store + in-process bus/jobs + Zod, for offline/no-infra. Postgres + Redis + BullMQ is the scale path.

## Data model
Event/metadata: `events(event_id,stream_type,stream_id,seq,type,payload,actor_id,workspace_id,correlation_id,causation_id,occurred_at,capture_flow_id, UNIQUE(stream_id,seq))`, `snapshots`, `outbox`, `idempotency_keys`, `projector_checkpoints`, `command_log`, `capture_provenance`.
Projections (shaped to serve internal responses): `workspaces, spaces, folders, lists, tasks, subtasks, custom_field_defs, task_field_values, statuses, comments, users, memberships(role), shares(resource,principal,permission), views, docs, doc_pages, notifications, subscriptions, audit_log, feature_flags, search_index, presence`.
Events = source of truth; projections = rebuildable; metadata = ops/idempotency/provenance.

## Commands & events
Commands: AuthenticateSession, BootstrapWorkspace · Create/Rename/Move/Reorder/Archive Space|Folder|List · CreateTask, UpdateTask, SetTaskStatus, AssignTask, SetDueDate, SetPriority, MoveTask, ReorderTask, ArchiveTask, DeleteTask, AddSubtask, SetCustomFieldValue, LinkTask · Add/Edit/Resolve Comment · InviteMember, SetMemberRole, RemoveMember, ShareResource, SetSharePermission · StartTrial, Subscribe, Upgrade/DowngradePlan, CancelSubscription · CreateView, UpdateView, CreateDoc, UpdateDocPage.
Events (past tense): SessionEstablished · SpaceCreated, ListCreated, NodeMoved, NodeArchived · TaskCreated, TaskRenamed, TaskStatusChanged, TaskAssigned, TaskMoved, TaskReordered, TaskArchived, TaskDeleted, SubtaskAdded, FieldValueSet, TaskLinked · CommentAdded/Edited/Resolved · MemberInvited, MemberRoleChanged, MemberRemoved, ResourceShared · TrialStarted, SubscriptionActivated, PlanChanged, PaymentFailed, SubscriptionCanceled · ViewCreated, DocPageUpdated.

## Projectors
HierarchyTree (sidebar) · ListTasks (status-grouped, task-v3 bulk shape) · TaskDetail · CustomFields · Members · Comments · BadgeCount/Inbox · Subscription · FeatureFlag · AuditLog · SearchIndex · Presence. Each consumes events, writes its table, advances a checkpoint → replay-safe.

## Process managers / jobs
RollupManager (status/progress → list taskcount + parent rollups) · NotificationManager (→ inbox/badge) · SearchIndexer · RealtimeFanout (outbox → ws) · BillingDunning (PaymentFailed FSM) · CacheRefresh · ArchiveSweeper. Idempotent via (event_id, handler) dedup; at-least-once outbox.

## Auth & permissions
Auth: deterministic SessionService, seed from captured storage-state → local token `HMAC(seed,user|ws)`; validate via MembershipProjection. No OAuth, fully reproducible.
Permissions: hybrid RBAC+ABAC via policy engine (Cedar/OPA). Roles owner>admin>member>guest from memberships; overrides from shares. `policy.can(actor,action,resource)` called by BOTH command handlers and query projections. Seed allow/deny from capture (200=allow, 403=deny); deny-by-default for unknown, logged to gap ledger.

## Payments
PaymentProvider adapter backed by stripe-mock (deterministic, real shapes, offline). Subscription FSM trial→active→past_due→canceled driven by commands + BillingDunning PM. UI reads SubscriptionProjection.

## Realtime
Socket.IO channels (workspace/space/list/task): events → outbox → RealtimeFanout → broadcast in captured ws frame shapes (auth→AuthReceived, heartbeat→heartbeatReply, subscribe→ack, next frames). Yjs (CRDT) for collaborative docs/whiteboards (/coeditor). Deterministic replay from event stream + subscription set.

## Capture → domain bridge
1. Playwright before/after state hashes + storage; mitm authoritative bodies; Keploy API pairs. 2. Correlate (ctx+t-window+stateHash+fingerprint) → unified graph. 3. Write-extraction (offline, deterministic): each mutating flow → CommandObservation{endpoint,method,reqBody,preState,postState,respBody}; events = diff(postProjection,preProjection) or response. 4. Observations seed fixtures, auto-generate handler scaffolds + Zod schemas + event types, AND become parity test cases (apply command → assert projection == captured postState).

## Uncaptured/unknown (deterministic, no LLM)
Unknown read → projection if entity exists else captured empty-200. Unknown write → policy switch deny-by-default | echo-store. Unknown validation → deny-by-default + log. All unknowns → gap ledger (ranked TODOs). LLM only offline to propose handlers, human-reviewed, frozen to code.

## Tool stack (best tool per job; layered, not one-tool)
- UI driving/state: **Playwright** (keep, irreplaceable floor).
- Transport capture: **mitmproxy** (keep, floor).
- API capture→mock→test: **Keploy** (add; auto mocks+assertion tests from traffic; seeds command-observations).
- Frontend DOM replay/evidence: **rrweb** (add; DOM-mutation timeline; UI parity diff).
- Runtime/time-travel debug: **Replay.io** (add, targeted offline RE of hard logic; not a runtime dep).
- Cloud-scale capture: Browserless (optional).
- API mocking (frontend tests): MSW.
- Stateful backend sim: **our CQRS/ES** (SQLite/Emmett → Postgres). Nothing off-shelf does this.
- In-browser offline runtime: **SQLite-WASM + OPFS**.
- Permissions: **Cedar/OPA**.
- Jobs: **BullMQ** (Redis) | Temporal for complex sagas.
- Realtime: **Socket.IO** + **Yjs** (collab).
- Payments: **stripe-mock**.
- Validation: **Zod** (+ quicktype/mitmproxy2swagger to bootstrap from capture).
- Parity verification: **Keploy (API) + rrweb-diff + odiff/pixelmatch (visual) + projection asserts (state)**.
Most powerful per outcome: richer runtime recording → Replay.io; higher-fidelity replay → rrweb+Keploy; easiest API mock → Keploy; most complete session capture → mitm+Playwright+rrweb; time-travel → Replay.io; stateful sim → our CQRS/ES.
Replace vs augment: nothing replaces Playwright/mitm; all others augment in layers. Skip for now: Temporal, Browserless, Liveblocks.

## Parity harness (the loop — runs throughout)
Avenues scored independently, repeatable, tracked over time, with a gap ledger to drive refinement to ≥98%:
1. Visual (masked pixel diff per state).
2. DOM structural (normalized tree diff).
3. API/network (response match vs captured/reference — Keploy-style).
4. State/data (projection == captured postState after a command).
5. Interaction/transition (state graph edges reproduce).
Output: per-avenue % + weighted aggregate + ranked gap ledger → `parity-report.{json,md}`, history-tracked. CI-able. Loop until ≥98% on all avenues.

## MVP, risks, order
MVP backend: SQLite event store + ~12 commands (task CRUD/status/assign/move + space/list create) + ~8 projectors serving internal shapes (reuse bridge mappers) + seeded auth + Cedar RBAC + Socket.IO task fanout + rollup/notification jobs. Defer billing/admin/collab/search.
Highest risk: (1) realtime collab/coeditor (Yjs), (2) derived computations (taskcount/progress/formula/rollups — hand-authored, parity-checked), (3) permission-matrix completeness, (4) complex write side-effects (move/reorder cascades), (5) determinism of ids/clock across replay.
Order: 1 hybrid capture+correlate → 2 schema/contract inference → 3 event store+append+replay+snapshots → 4 command handlers (task CRUD first) → 5 projectors (serve internal shapes) → 6 realtime fanout → 7 jobs → 8 auth+permissions → 9 payments+admin → 10 parity harness gating throughout.
