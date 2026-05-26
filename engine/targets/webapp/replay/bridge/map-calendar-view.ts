/**
 * Map a calendar view's tasks into the INTERNAL calendar genericView response shape.
 *
 * A calendar view (type 5) does NOT use the list-shaped `list.divisions[].groups[]`
 * payload. Its body is `{ calendar: { view_obj: true, groups: [{ task_ids, ... }] },
 * tasks: [...], ... }` — a single flat group carrying every task id in the view's
 * scope. Serving the list-shaped body to a calendar view makes the bundle throw
 * "We ran into some trouble when loading your view." This mapper clones the captured
 * calendar template and repopulates its one group's task_ids from the scope's tasks.
 *
 * Scope resolution: the calendar's `parent` is a list (type 6), folder (type 5), or
 * space (type 4). For a list parent we use that list's tasks; for a space/folder we
 * aggregate the tasks of every list under it. When no tasks resolve, the empty-but-
 * valid calendar shape still mounts the calendar grid cleanly (no error banner).
 */

import type { ExportTask } from './load-export';
import { deepClone } from './clone-util';

type CalendarBody = {
  calendar: {
    view_obj: boolean;
    groups: { task_ids: string[]; task_count: number; [k: string]: unknown }[];
  };
  tasks: unknown[];
  [key: string]: unknown;
};

/**
 * Build the calendar body from the captured template + the scope's tasks. Returns
 * null when no template is available (caller falls back to the list mapper).
 */
export function mapCalendarView(
  tasks: ExportTask[],
  template: CalendarBody | null,
): CalendarBody | null {
  if (!template?.calendar?.groups?.[0]) return null;

  const body = deepClone(template);
  const taskIds = tasks.map((t) => t.id);
  const group = body.calendar.groups[0];
  group.task_ids = taskIds;
  group.task_count = taskIds.length;
  body.calendar.groups = [group];
  body.tasks = [];
  body.last_page = true;
  return body;
}
