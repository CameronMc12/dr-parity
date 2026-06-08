/**
 * Dashboards hub seed. The ClickUp export and API return zero dashboards for
 * this workspace, so the hub renders its empty state. Captured dashboards (if
 * any) would be appended here following this shape.
 */

export interface DashboardEntry {
  id: string;
  name: string;
  /** Pre-formatted relative timestamp shown in the row/card. */
  updatedLabel: string;
  owner: { initials: string; color: string };
}

export const DASHBOARDS: DashboardEntry[] = [];
