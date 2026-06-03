export interface Workspace {
  id: string;
  name: string;
  color: string;
  avatar?: string;
}

export type IconBarItemId =
  | 'home'
  | 'spaces'
  | 'chat'
  | 'planner'
  | 'ai'
  | 'teams'
  | 'docs'
  | 'dashboards'
  | 'whiteboards'
  | 'timesheets'
  | 'settings';

export interface IconBarItem {
  id: IconBarItemId;
  label: string;
  href?: string;
  icon: string; // SVG path or emoji placeholder
}
