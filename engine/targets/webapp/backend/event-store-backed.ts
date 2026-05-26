/**
 * Store-backed BackendStore. Reads are served from the CQRS PROJECTION (the
 * `tasks` read table built from the event log), so a write command that appends
 * an event is reflected on the next read. Rich task fields the bridge mappers
 * need (dates, custom_fields, creator, status color/type) are recovered by
 * looking up the ORIGINAL export task by id and OVERLAYING the projection's
 * mutable fields (name, status label, list id) on top.
 *
 * Entity reference data that writes never change (workspace, members, spaces,
 * folders, lists, custom-field defs, tree) is delegated to the in-memory export
 * snapshot, exactly as the JsonStore did — no regression on those reads.
 *
 * `refresh()` runs the projector catch-up so the latest appended events are
 * reflected without a server restart. Each task read calls catch-up first, so a
 * write made through the same EventStore is visible immediately.
 */

import { existsSync, readFileSync } from "node:fs";

import type {
  ExportFolder,
  ExportList,
  ExportSpace,
  ExportStatus,
  ExportTask,
} from "../replay/bridge/load-export";
import { DeterministicClock, DeterministicIdGen } from "./cqrs/store/clock.js";
import { EventStore } from "./cqrs/store/event-store.js";
import { TasksProjector } from "./cqrs/projectors/tasks-projector.js";
import { TaskQueries, type TaskRow } from "./cqrs/queries/task-queries.js";
import { buildCommandBus } from "./cqrs/bus-factory.js";
import type { CommandBus } from "./cqrs/domain/command-bus.js";
import type {
  BackendStore,
  StoreDoc,
  StoreDocPages,
  StoreMember,
  StoreSnapshot,
} from "./store-types";

const SYNTH_STATUS_COLOR = "#87909e";

export interface EventBackedStoreOptions {
  snapshotPath: string;
  eventsDbPath: string;
}

export class EventBackedStore implements BackendStore {
  private readonly snapshot: StoreSnapshot;
  private readonly store: EventStore;
  private readonly projector: TasksProjector;
  private readonly queries: TaskQueries;
  private readonly bus: CommandBus;

  private readonly listIndex = new Map<string, ExportList>();
  private readonly exportTaskById = new Map<string, ExportTask>();
  private readonly customFieldIndex = new Map<string, unknown[]>();
  private readonly docIndex = new Map<string, StoreDoc>();
  private readonly docPagesIndex = new Map<string, StoreDocPages>();

  constructor(snapshot: StoreSnapshot, eventsDbPath: string) {
    this.snapshot = snapshot;
    // Prime the event-id generator past already-seeded events so a fresh process
    // attaching to the seeded db never reuses an event_id (UNIQUE).
    const idGen = new DeterministicIdGen();
    this.store = new EventStore(eventsDbPath, new DeterministicClock(), idGen);
    idGen.primeTo("evt", this.store.eventCount());
    this.projector = new TasksProjector(this.store);
    this.queries = new TaskQueries(this.store);
    this.bus = buildCommandBus(this.store, new DeterministicIdGen());
    this.buildIndexes();
    this.projector.catchUp();
  }

  static create(opts: EventBackedStoreOptions): EventBackedStore {
    if (!existsSync(opts.snapshotPath)) {
      throw new Error(
        `Backend store snapshot not found: ${opts.snapshotPath}. Run "npm run backend:seed" first.`,
      );
    }
    const snapshot = JSON.parse(readFileSync(opts.snapshotPath, "utf8")) as StoreSnapshot;
    return new EventBackedStore(snapshot, opts.eventsDbPath);
  }

  private buildIndexes(): void {
    for (const list of this.snapshot.lists) this.listIndex.set(list.id, list);
    for (const task of this.snapshot.tasks) {
      if (task.id) this.exportTaskById.set(task.id, task);
    }
    for (const cf of this.snapshot.customFields) {
      this.customFieldIndex.set(cf.listId, cf.fields);
    }
    for (const doc of this.snapshot.docs ?? []) {
      if (doc.id) this.docIndex.set(doc.id, doc);
    }
    for (const dp of this.snapshot.docPages ?? []) {
      if (dp.docId) this.docPagesIndex.set(dp.docId, dp);
    }
  }

  // --- Live handles for the server + write endpoints ------------------------

  eventStore(): EventStore {
    return this.store;
  }

  commandBus(): CommandBus {
    return this.bus;
  }

  /** Advance the projection to the latest appended events. */
  refresh(): void {
    this.projector.catchUp();
  }

  close(): void {
    this.store.close();
  }

  // --- Reference-data reads (delegated to the snapshot, unchanged) ----------

  workspaceId(): string {
    return this.snapshot.workspaceId;
  }

  workspace(): Record<string, unknown> | null {
    return this.snapshot.workspace;
  }

  owner(): StoreMember | null {
    return this.snapshot.owner;
  }

  members(): StoreMember[] {
    return this.snapshot.members;
  }

  spaces(): ExportSpace[] {
    return this.snapshot.spaces;
  }

  folders(): ExportFolder[] {
    return this.snapshot.folders;
  }

  lists(): ExportList[] {
    return this.snapshot.lists;
  }

  listById(listId: string): ExportList | undefined {
    return this.listIndex.get(listId);
  }

  customFieldsForList(listId: string): unknown[] {
    return this.customFieldIndex.get(listId) ?? [];
  }

  tree(): Record<string, unknown> | null {
    return this.snapshot.tree;
  }

  docs(): StoreDoc[] {
    return this.snapshot.docs ?? [];
  }

  docById(docId: string): StoreDoc | undefined {
    return this.docIndex.get(docId);
  }

  docPages(docId: string): StoreDocPages | undefined {
    return this.docPagesIndex.get(docId);
  }

  // --- Task reads (served from the PROJECTION, overlaid on export rows) ------

  tasksByList(listId: string): ExportTask[] {
    this.projector.catchUp();
    return this.queries.listTasks(listId).map((row) => this.toExportTask(row));
  }

  allTasks(): ExportTask[] {
    this.projector.catchUp();
    return this.queries.allTasks().map((row) => this.toExportTask(row));
  }

  taskToListId(taskId: string): string | undefined {
    this.projector.catchUp();
    return this.queries.getTask(taskId)?.listId;
  }

  /**
   * Merge a projection row onto its original export task: the MUTABLE fields
   * (name, status label, list id) come from the projection so writes show; every
   * rich field (dates, custom_fields, creator) comes from the original export
   * task. Tasks created at runtime have no export row, so a minimal task is
   * synthesized — enough for the mappers + synthStatusesForList to render it.
   */
  private toExportTask(row: TaskRow): ExportTask {
    const original = this.exportTaskById.get(row.taskId);
    const status = this.reconcileStatus(original?.status, row.status);

    if (original) {
      return {
        ...original,
        name: row.name,
        status,
        list: { id: row.listId, name: original.list?.name },
        archived: row.archived,
        ...(row.description !== null ? { description: row.description } : {}),
      };
    }

    return {
      id: row.taskId,
      name: row.name,
      status,
      list: { id: row.listId },
      date_created: this.epochMs(row.createdAt),
      date_updated: this.epochMs(row.updatedAt),
      archived: row.archived,
      custom_fields: [],
      ...(row.description !== null ? { description: row.description } : {}),
      ...(this.snapshot.owner
        ? {
            creator: {
              id: this.snapshot.owner.id,
              username: this.snapshot.owner.username,
              color: this.snapshot.owner.color,
              email: this.snapshot.owner.email,
            },
          }
        : {}),
    };
  }

  /** Keep the original chip color/type when the label is unchanged; otherwise
   *  synthesize a status carrying the projection's label. */
  private reconcileStatus(original: ExportStatus | undefined, label: string): ExportStatus {
    if (original && original.status === label) return original;
    if (original) return { ...original, status: label };
    return { id: "open", status: label, color: SYNTH_STATUS_COLOR, type: "custom", orderindex: 0 };
  }

  private epochMs(iso: string): string {
    const ms = Date.parse(iso);
    return Number.isNaN(ms) ? "" : String(ms);
  }
}
