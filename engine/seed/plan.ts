/**
 * Plan builder — walks the fixture into a flat, ordered list of planned actions
 * with counts. Used by both `--dry-run` (print only) and the live apply (drive
 * the API). Pure: no network, no token required.
 */

import {
  PRIORITY_VALUE,
  type DueAnchor,
  type SeedFixture,
  type SeedTask,
} from './types.js';

export interface PlanCounts {
  spaces: number;
  folders: number;
  lists: number;
  tasks: number;
  subtasks: number;
  tags: number;
  checklists: number;
  checklistItems: number;
  comments: number;
  customFieldValues: number;
  dependencies: number;
  docs: number;
  docPages: number;
  goals: number;
}

export interface PlanLine {
  depth: number;
  label: string;
}

export interface SeedPlan {
  counts: PlanCounts;
  lines: PlanLine[];
}

/** Resolve a relative anchor to epoch-ms against a fixed `now`. */
export function resolveAnchor(anchor: DueAnchor, now: number): number | undefined {
  if (anchor === null) return undefined;
  const DAY = 24 * 60 * 60 * 1000;
  return now + anchor.offsetDays * DAY;
}

function priorityLabel(task: SeedTask): string {
  if (task.priority === null || task.priority === undefined) return 'none';
  return `${task.priority}(${PRIORITY_VALUE[task.priority]})`;
}

export function buildPlan(fixture: SeedFixture, now: number): SeedPlan {
  const counts: PlanCounts = {
    spaces: 0,
    folders: 0,
    lists: 0,
    tasks: 0,
    subtasks: 0,
    tags: 0,
    checklists: 0,
    checklistItems: 0,
    comments: 0,
    customFieldValues: 0,
    dependencies: 0,
    docs: 0,
    docPages: 0,
    goals: 0,
  };
  const lines: PlanLine[] = [];
  const add = (depth: number, label: string) => lines.push({ depth, label });

  const { space } = fixture;
  counts.spaces += 1;
  add(0, `SPACE  ${space.name}  [key=${space.key}]`);

  for (const tag of space.tags) {
    counts.tags += 1;
    add(1, `tag    #${tag.name}`);
  }

  const emitTask = (depth: number, task: SeedTask) => {
    counts.tasks += 1;
    const due = resolveAnchor(task.dueAnchor ?? null, now);
    const start = resolveAnchor(task.startAnchor ?? null, now);
    add(
      depth,
      `task   ${truncate(task.name)}  [pri=${priorityLabel(task)} status=${task.status ?? 'default'}` +
        ` assign=${task.assignSelf ? 'self' : 'none'} start=${fmtDate(start)} due=${fmtDate(due)}]`,
    );
    for (const tag of task.tags ?? []) add(depth + 1, `+tag   #${tag}`);
    for (const sub of task.subtasks ?? []) {
      counts.subtasks += 1;
      add(depth + 1, `subtask ${truncate(sub.name)}  [pri=${sub.priority ?? 'none'} status=${sub.status ?? 'default'}]`);
    }
    for (const cl of task.checklists ?? []) {
      counts.checklists += 1;
      add(depth + 1, `checklist ${cl.name} (${cl.items.length} items)`);
      counts.checklistItems += cl.items.length;
    }
    for (const c of task.comments ?? []) {
      counts.comments += 1;
      add(depth + 1, `comment "${truncate(c.text, 50)}"`);
    }
    for (const f of task.customFields ?? []) {
      counts.customFieldValues += 1;
      const val = f.dropdownOptionName ?? (f.value !== undefined ? String(f.value) : fmtDate(resolveAnchor(f.dateAnchor ?? null, now)));
      add(depth + 1, `field  ${f.name} (${f.type}) = ${val}`);
    }
    if (task.dependsOnKey) {
      counts.dependencies += 1;
      add(depth + 1, `depends-on ${task.dependsOnKey}`);
    }
  };

  for (const folder of space.folders) {
    counts.folders += 1;
    add(1, `FOLDER ${folder.name}  [key=${folder.key}]`);
    for (const list of folder.lists) {
      counts.lists += 1;
      add(2, `LIST   ${list.name}  [key=${list.key}]`);
      for (const task of list.tasks) emitTask(3, task);
    }
  }

  for (const list of space.folderlessLists) {
    counts.lists += 1;
    add(1, `LIST*  ${list.name} (folderless)  [key=${list.key}]`);
    for (const task of list.tasks) emitTask(2, task);
  }

  for (const doc of space.docs) {
    counts.docs += 1;
    add(1, `DOC    ${doc.name}  [key=${doc.key}]`);
    for (const page of doc.pages) {
      counts.docPages += 1;
      add(2, `page   ${page.name}`);
    }
  }

  for (const goal of space.goals) {
    counts.goals += 1;
    add(1, `GOAL   ${goal.name}  [due=${fmtDate(resolveAnchor(goal.dueAnchor, now))}]`);
  }

  return { counts, lines };
}

function truncate(s: string, max = 60): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function fmtDate(ms: number | undefined): string {
  if (ms === undefined) return '—';
  return new Date(ms).toISOString().slice(0, 10);
}
