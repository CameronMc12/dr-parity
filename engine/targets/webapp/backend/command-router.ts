/**
 * Map an incoming mutating HTTP request (POST/PUT/DELETE) to a domain Command,
 * dispatch it through the CommandBus, advance the projection, and return the
 * internal-shape response the bundle expects.
 *
 * Two surfaces map to the SAME commands:
 *   1. ClickUp's native task mutation routes (so the real bundle's writes land).
 *   2. A clean owned `/cmd/v1/...` namespace the parity harness can target.
 *
 * A request that matches no command mapping returns null so the read router /
 * recording fallback can still answer (no regression on non-command writes like
 * telemetry/auth beacons).
 */

import type { CommandBus } from './cqrs/domain/command-bus.js';
import type { Command, CommandType } from './cqrs/domain/commands.js';
import type { EventBackedStore } from './event-store-backed';
import type { RequestCtx } from './handlers';

export type CommandRouteResult = {
  handler: string;
  body: unknown;
};

type Mapping = { type: CommandType; payload: Record<string, unknown> };

function asObject(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

function num(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : v !== undefined && v !== null ? String(v) : undefined;
}

/**
 * Resolve a request to a command mapping, or null when it is not a command.
 * Path id segments are matched with regex captures.
 */
function resolveMapping(ctx: RequestCtx): Mapping | null {
  const { method, pathname } = ctx;
  const b = asObject(ctx.body);

  // --- Owned command namespace -------------------------------------------
  // POST /cmd/v1/{CommandType}  body = the command payload verbatim.
  const cmd = pathname.match(/\/cmd\/v1\/([A-Za-z]+)$/);
  if (method === 'POST' && cmd) {
    return { type: cmd[1] as CommandType, payload: b };
  }

  // --- Native ClickUp task routes ----------------------------------------
  // Create: POST /v1/list/{listId}/task  body {name, status, content/description}
  const create = pathname.match(/\/v1\/list\/(\d+)\/task$/);
  if (method === 'POST' && create) {
    return {
      type: 'CreateTask',
      payload: {
        listId: create[1],
        name: str(b.name) ?? 'Untitled',
        status: str(b.status) ?? 'open',
        ...(str(b.description ?? b.content) !== undefined
          ? { description: str(b.description ?? b.content) }
          : {}),
      },
    };
  }

  // Update / status / archive: PUT /v1/task/{taskId}  body may carry
  // name, content/description, status, archived.
  const update = pathname.match(/\/v1\/task\/([0-9a-z]+)$/i);
  if (method === 'PUT' && update) {
    const taskId = update[1]!;
    if (b.status !== undefined) {
      return { type: 'SetTaskStatus', payload: { taskId, status: str(b.status)! } };
    }
    if (b.archived !== undefined) {
      return { type: 'ArchiveTask', payload: { taskId, archived: Boolean(b.archived) } };
    }
    if (b.name !== undefined || b.description !== undefined || b.content !== undefined) {
      return {
        type: 'UpdateTask',
        payload: {
          taskId,
          ...(b.name !== undefined ? { name: str(b.name) } : {}),
          ...(b.description !== undefined || b.content !== undefined
            ? { description: str(b.description ?? b.content) }
            : {}),
        },
      };
    }
    return null;
  }

  // Delete: DELETE /v1/task/{taskId}
  const del = pathname.match(/\/v1\/task\/([0-9a-z]+)$/i);
  if (method === 'DELETE' && del) {
    return { type: 'DeleteTask', payload: { taskId: del[1]! } };
  }

  // Assign: POST /v1/task/{taskId}/assignee  body {assignee}
  const assign = pathname.match(/\/v1\/task\/([0-9a-z]+)\/assignee$/i);
  if (method === 'POST' && assign) {
    const assigneeId = num(b.assignee ?? b.assigneeId);
    if (assigneeId === undefined) return null;
    return { type: 'AssignTask', payload: { taskId: assign[1]!, assigneeId } };
  }

  // Move: PUT /v1/task/{taskId}/list  body {list}
  const move = pathname.match(/\/v1\/task\/([0-9a-z]+)\/list$/i);
  if (method === 'PUT' && move) {
    const listId = str(b.list ?? b.listId);
    if (!listId) return null;
    return { type: 'MoveTask', payload: { taskId: move[1]!, listId } };
  }

  // Comment: POST /v1/task/{taskId}/comment  body {comment_text}
  const comment = pathname.match(/\/v1\/task\/([0-9a-z]+)\/comment$/i);
  if (method === 'POST' && comment) {
    const text = str(b.comment_text ?? b.text);
    if (!text) return null;
    return { type: 'AddComment', payload: { taskId: comment[1]!, text } };
  }

  return null;
}

/**
 * Try to handle a request as a command. Returns null for non-command requests
 * (so the read chain / recordings answer). On a matched command it dispatches,
 * refreshes the projection, and returns a small internal-shape acknowledgement.
 */
export function routeCommand(
  ctx: RequestCtx,
  store: EventBackedStore,
  bus: CommandBus,
): CommandRouteResult | null {
  const mapping = resolveMapping(ctx);
  if (!mapping) return null;

  const command: Command = {
    type: mapping.type,
    payload: mapping.payload,
    actorId: store.owner() ? String(store.owner()!.id) : 'replay',
    workspaceId: store.workspaceId(),
  };

  const result = bus.dispatch(command);
  store.refresh();

  // Resolve the affected task id for a useful response body.
  const taskId =
    (mapping.payload.taskId as string | undefined) ??
    (result.events[0]?.payload as { taskId?: string } | undefined)?.taskId ??
    null;
  const task = taskId ? store.taskToListId(taskId) : null;

  return {
    handler: `cmd.${mapping.type}`,
    body: {
      ok: true,
      command: mapping.type,
      id: taskId,
      list_id: task,
      events: result.events.length,
      idempotent: result.idempotent,
    },
  };
}
