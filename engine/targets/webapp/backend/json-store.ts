/**
 * JSON-backed BackendStore. Holds the seeded snapshot in memory and answers the
 * typed read surface the request handlers query. No native dependency.
 *
 * Why JSON and not SQLite: better-sqlite3 is not installed in this repo's
 * node_modules. Rather than add a native build step, Phase A ships a JSON store
 * that satisfies the same `BackendStore` interface. A SQLite implementation can
 * drop in later with zero handler changes — the seeder writes a `store.json`
 * snapshot that either backend can load.
 *
 * Persistence: the snapshot is loaded from disk on construction and written back
 * on `persist()`. Phase A only reads, so writes are a no-op surface for now; the
 * file shape is already write-ready for Phase B mutations.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import type {
  ExportFolder,
  ExportList,
  ExportSpace,
  ExportTask,
} from '../replay/bridge/load-export';
import type {
  BackendStore,
  StoreDoc,
  StoreDocPages,
  StoreMember,
  StoreSnapshot,
} from './store-types';

export class JsonStore implements BackendStore {
  private readonly snapshot: StoreSnapshot;
  private readonly tasksByListIndex = new Map<string, ExportTask[]>();
  private readonly listIndex = new Map<string, ExportList>();
  private readonly taskListIndex = new Map<string, string>();
  private readonly customFieldIndex = new Map<string, unknown[]>();
  private readonly docIndex = new Map<string, StoreDoc>();
  private readonly docPagesIndex = new Map<string, StoreDocPages>();
  private readonly snapshotPath: string | null;

  constructor(snapshot: StoreSnapshot, snapshotPath: string | null = null) {
    this.snapshot = snapshot;
    this.snapshotPath = snapshotPath;
    this.buildIndexes();
  }

  static fromFile(snapshotPath: string): JsonStore {
    if (!existsSync(snapshotPath)) {
      throw new Error(
        `Backend store snapshot not found: ${snapshotPath}. Run "npm run backend:seed" first.`,
      );
    }
    const raw = readFileSync(snapshotPath, 'utf8');
    const snapshot = JSON.parse(raw) as StoreSnapshot;
    return new JsonStore(snapshot, snapshotPath);
  }

  private buildIndexes(): void {
    for (const list of this.snapshot.lists) this.listIndex.set(list.id, list);
    for (const task of this.snapshot.tasks) {
      const listId = task.list?.id;
      if (!listId) continue;
      const arr = this.tasksByListIndex.get(listId) ?? [];
      arr.push(task);
      this.tasksByListIndex.set(listId, arr);
      this.taskListIndex.set(task.id, listId);
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

  tasksByList(listId: string): ExportTask[] {
    return this.tasksByListIndex.get(listId) ?? [];
  }

  allTasks(): ExportTask[] {
    return this.snapshot.tasks;
  }

  taskToListId(taskId: string): string | undefined {
    return this.taskListIndex.get(taskId);
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

  /** Persist the snapshot back to disk. No-op when constructed without a path. */
  persist(): void {
    if (!this.snapshotPath) return;
    mkdirSync(dirname(this.snapshotPath), { recursive: true });
    writeFileSync(this.snapshotPath, JSON.stringify(this.snapshot), 'utf8');
  }
}

export type { BackendStore, StoreMember, StoreSnapshot, ExportFolder, ExportList, ExportSpace, ExportTask };
