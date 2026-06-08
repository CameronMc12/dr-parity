/**
 * Real ClickUp global-sidebar section data, extracted 1:1 from the oracle DOM
 * captured 2026-06-01 (app.clickup.com workspace 90152566819, 1440x900).
 *
 * Source: docs/research/crawl/app.clickup.com/2026-06-01-sidebars/states/<section>/sidebar.html
 *
 * These are real workspace values (labels, counts, recents), used as fixtures.
 */

const WORKSPACE_ID = '90152566819';

export type SidebarIcon =
  // sprite-backed glyphs
  | 'v4IaSidebarDashboards'
  | 'v4IaSidebarWhiteboards'
  | 'history'
  | 'userGroup'
  | 'userId'
  | 'pulse'
  | 'userCollaboration'
  | 'lock'
  // image-as-icon (raster) glyphs from ClickUp media
  | 'aiDefault'
  | 'aiAgentDefault'
  | 'allAgents';

/** Avatar leading-glyph for a nav row (initials chip or remote image). */
export interface RowAvatar {
  /** Initials text shown when no image. */
  initials?: string;
  /** Avatar background colour keyword from the oracle DOM. */
  bg?: 'black' | 'purple' | 'brown';
  /** Remote profile image URL (recents). */
  image?: string;
}

export interface NavRow {
  label: string;
  href?: string;
  /** Sprite/raster icon id. Mutually exclusive with `avatar`. */
  icon?: SidebarIcon;
  avatar?: RowAvatar;
  /** Trailing result count badge (omitted when undefined). */
  count?: number;
  active?: boolean;
}

export type RecentIcon =
  | { kind: 'view'; viewType: 27 | 29 } // 27 = whiteboard, 29 = dashboard chart
  | { kind: 'avatar'; avatar: RowAvatar };

export interface RecentItem {
  label: string;
  href?: string;
  icon: RecentIcon;
}

export interface SidebarGroup {
  title: string;
  /** Nav-style rows (Super Agents, My Teams). */
  rows?: NavRow[];
  /** Recent-style rows (smaller avatar + title). */
  recents?: RecentItem[];
  /** Empty-state message (Favorites with nothing starred). */
  emptyState?: string;
  /** Trailing "More" affordance after recents. */
  hasMore?: boolean;
}

export interface SidebarHeaderAction {
  kind: 'pin' | 'create' | 'createMenu';
  /** createMenu leading glyph: pencil (AI) or plus (Teams). Defaults to plus. */
  menuGlyph?: 'edit' | 'plus';
}

export interface SidebarFooterWidget {
  value: string;
  description: string;
}

export interface SidebarSection {
  title: string;
  /** Header trailing controls, in DOM order. */
  headerActions: SidebarHeaderAction[];
  /** Top-level nav rows (above any grouped sections). */
  topRows: NavRow[];
  /** Whether a divider sits under the top rows (AI only). */
  topDivider?: boolean;
  /** Inline groups rendered inside the top-rows block (AI "Super Agents"). */
  inlineGroups?: SidebarGroup[];
  /** Grouped sections rendered in the scrolling items-container. */
  groups: SidebarGroup[];
  /** AI credits footer widgets. */
  footer?: SidebarFooterWidget[];
}

export const AI_SECTION: SidebarSection = {
  title: 'AI',
  headerActions: [{ kind: 'createMenu', menuGlyph: 'edit' }],
  topRows: [
    {
      label: 'Ask or Create',
      href: `https://app.clickup.com/${WORKSPACE_ID}/ai/brain`,
      icon: 'aiDefault',
      active: true,
    },
  ],
  topDivider: true,
  inlineGroups: [
    {
      title: 'Super Agents',
      rows: [
        {
          label: 'Create Agent',
          href: `https://app.clickup.com/${WORKSPACE_ID}/ai/agents`,
          icon: 'aiAgentDefault',
        },
        {
          label: 'All Agents',
          href: `https://app.clickup.com/${WORKSPACE_ID}/ai/agents/all`,
          icon: 'allAgents',
          count: 1,
        },
        {
          label: 'My Agents',
          href: `https://app.clickup.com/${WORKSPACE_ID}/ai/agents/my`,
          avatar: { initials: 'C', bg: 'black' },
          count: 1,
        },
        {
          label: 'Activity',
          href: `https://app.clickup.com/${WORKSPACE_ID}/ai/audit-log`,
          icon: 'history',
        },
      ],
    },
  ],
  groups: [
    {
      title: 'Recent Super Agents',
      recents: [
        {
          label: 'Onboarding Assistant',
          href: `https://app.clickup.com/${WORKSPACE_ID}/ai/agents/2kyr6013-455`,
          icon: {
            kind: 'avatar',
            avatar: {
              bg: 'purple',
              image: 'https://attachments.clickup.com/profilePictures/-40752438_T8B.jpg',
            },
          },
        },
      ],
    },
  ],
  footer: [
    { value: '24', description: 'Brain AI uses' },
    { value: '1.4k', description: 'Credits left' },
  ],
};

export const TEAMS_SECTION: SidebarSection = {
  title: 'Teams',
  headerActions: [{ kind: 'pin' }, { kind: 'createMenu', menuGlyph: 'plus' }],
  topRows: [
    {
      label: 'All Teams',
      href: `https://app.clickup.com/${WORKSPACE_ID}/teams-pulse/teams`,
      icon: 'userGroup',
      count: 1,
      active: true,
    },
    {
      label: 'All People',
      href: `https://app.clickup.com/${WORKSPACE_ID}/teams-pulse/people`,
      icon: 'userId',
      count: 1,
    },
    {
      label: 'Analytics',
      href: `https://app.clickup.com/${WORKSPACE_ID}/teams-pulse/analytics`,
      icon: 'pulse',
    },
  ],
  groups: [
    {
      title: 'My Teams',
      rows: [
        {
          label: 'Test Team',
          href: `https://app.clickup.com/${WORKSPACE_ID}/teams-pulse/teams/9fca0e74-e6c4-449a-a60c-1093f88261e6`,
          avatar: { initials: 'T', bg: 'brown' },
        },
      ],
    },
  ],
};

export const DASHBOARDS_SECTION: SidebarSection = {
  title: 'Dashboards',
  headerActions: [{ kind: 'pin' }, { kind: 'create' }],
  topRows: [
    { label: 'All Dashboards', icon: 'v4IaSidebarDashboards' },
    { label: 'My Dashboards', avatar: { initials: 'C', bg: 'black' }, count: 29 },
    { label: 'Shared with me', icon: 'userCollaboration' },
    { label: 'Private', icon: 'lock', count: 27 },
  ],
  groups: [
    { title: 'Favorites', emptyState: 'Star a Dashboard to see it here' },
    {
      title: 'Recents',
      hasMore: true,
      recents: [2975, 2955, 2935, 2915, 2895].map((n) => ({
        label: 'Dashboard',
        href: `https://app.clickup.com/${WORKSPACE_ID}/dashboards/2kyr6013-${String(n).slice(1)}`,
        icon: { kind: 'view', viewType: 29 } as const,
      })),
    },
  ],
};

export const WHITEBOARDS_SECTION: SidebarSection = {
  title: 'Whiteboards',
  headerActions: [{ kind: 'pin' }, { kind: 'create' }],
  topRows: [
    { label: 'All Whiteboards', icon: 'v4IaSidebarWhiteboards' },
    { label: 'My Whiteboards', avatar: { initials: 'C', bg: 'black' }, count: 3 },
  ],
  groups: [
    { title: 'Favorites', emptyState: 'Star a Whiteboard to see it here' },
    {
      title: 'Recents',
      recents: [
        { label: 'Impact Effort Matrix', icon: { kind: 'view', viewType: 27 } },
        { label: 'Customer Journey Map', icon: { kind: 'view', viewType: 27 } },
        { label: 'Customer Journey Map', icon: { kind: 'view', viewType: 27 } },
      ],
    },
  ],
};
