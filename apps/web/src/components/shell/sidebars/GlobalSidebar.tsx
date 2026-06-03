import type { ReactNode } from 'react';
import type {
  NavRow,
  RecentItem,
  RowAvatar,
  SidebarFooterWidget,
  SidebarGroup,
  SidebarHeaderAction,
  SidebarIcon,
  SidebarSection,
} from '@/data/sidebar-sections';

/**
 * Shared shell for the icon-bar "hub" sidebars (AI, Teams, Dashboards,
 * Whiteboards). Renders the cu-global-sidebar structure: header with controls,
 * a top nav-row block, optional inline groups, grouped item sections, and an
 * optional AI-credits footer. Driven entirely by SidebarSection config.
 */

const TEXT = 'var(--cu-text-primary)';
const MUTED = 'var(--cu-text-muted)';
const SOFT = 'var(--cu-text-muted)';
const SUBTITLE = 'var(--cu-text-muted)';
const HOVER = 'var(--cu-bg-hover)';
const ACTIVE = 'var(--cu-bg-active)';
const COUNT = 'var(--cu-text-disabled)';
const DIVIDER = 'var(--cu-border-divider)';

const AVATAR_BG: Record<NonNullable<RowAvatar['bg']>, string> = {
  black: 'rgb(34, 34, 34)',
  purple: 'rgb(123, 104, 238)',
  brown: 'rgb(161, 128, 114)',
};

function Cu3Icon({ id, size = 16 }: { id: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      data-testid="icon"
      className="svg"
      style={{ width: size, height: size, display: 'block', fill: 'currentColor' }}
    >
      <use href={`#${id}`} xlinkHref={`#${id}`} />
    </svg>
  );
}

/* ── Hand-authored glyphs for sprite ids not present in CuIconSprite ──────── */

function HistoryIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3.5 12a8.5 8.5 0 1 1 2.6 6.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M3.4 18.4 3 13.6l4.7.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 7.5V12l3 1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UserGroupIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3.1" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="16.5" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 18.5c0-2.6 2.5-4.4 5.5-4.4s5.5 1.8 5.5 4.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M16 14.4c2.3.1 4.5 1.6 4.5 4.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function UserIdIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="14" rx="2.4" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9" cy="11" r="2.1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.8 16.2c.4-1.6 1.7-2.4 3.2-2.4s2.8.8 3.2 2.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14.5 10h3.5M14.5 13.2h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PulseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 13h2l1.6-3.6L13 16l1.4-3H17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UserCollaborationIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8" cy="8.5" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 18.5c0-2.7 2.3-4.6 5-4.6s5 1.9 5 4.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M15.5 7.5l4 2-4 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** Dashboards "view 29" bar-chart glyph in a purple gradient tile. */
function DashboardViewIcon() {
  return (
    <span
      style={{
        width: 18,
        height: 18,
        borderRadius: 4,
        background: 'linear-gradient(135deg, rgb(135, 73, 232), rgb(112, 49, 214))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 19V11M12 19V5M19 19v-6" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** Whiteboards "view 27" glyph in a yellow rounded tile. */
function WhiteboardViewIcon() {
  return (
    <span
      style={{
        width: 18,
        height: 18,
        borderRadius: 4,
        background: 'rgb(255, 196, 61)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 5h16v9H4z" stroke="rgb(58,40,8)" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M9 17l3-3 3 3" stroke="rgb(58,40,8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function FavoritedStar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="rgb(255,196,61)" aria-hidden="true">
      <path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 17.9 6.7 19.6l1-5.8-4.2-4.1 5.9-.9L12 3.5Z" />
    </svg>
  );
}

function UnpinIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 4h6l-1 6 3 2.5V15H7v-2.5L10 10 9 4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M12 15v5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDown({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M12 16a1 1 0 0 1-.707-.293l-5-5a1 1 0 1 1 1.414-1.414L12 13.586l4.293-4.293a1 1 0 1 1 1.414 1.414l-5 5A1 1 0 0 1 12 16Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CreateEditIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 19h4l9.5-9.5a2 2 0 0 0-2.8-2.8L6 16.2V19Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M14 7.5l2.5 2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/* ── AI raster-icon stand-ins (oracle uses ./media/*.png rasters) ─────────── */

/** Multi-colour "AI brain / Ask or Create" sparkle (ai-default). */
function AiDefaultIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l1.6 3.6L17 8l-3.4 1.4L12 13l-1.6-3.6L7 8l3.4-1.4L12 3Z" fill="rgb(123,104,238)" />
      <path d="M18 13l.9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9.9-2Z" fill="rgb(255,138,76)" />
      <path d="M6 14l.7 1.6L8.5 16l-1.8.7L6 18l-.7-1.6L3.5 16l1.8-.4L6 14Z" fill="rgb(46,182,125)" />
    </svg>
  );
}

/** Robot/agent face (ai-agent-default). */
function AiAgentIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4.5" y="7.5" width="15" height="11" rx="3.4" fill="rgb(123,104,238)" />
      <circle cx="9.2" cy="13" r="1.5" fill="white" />
      <circle cx="14.8" cy="13" r="1.5" fill="white" />
      <path d="M12 4.5v3" stroke="rgb(123,104,238)" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="4" r="1.4" fill="rgb(255,138,76)" />
    </svg>
  );
}

/** Two overlapping agent avatars (all-agents). */
function AllAgentsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="15" cy="9" r="4.2" fill="rgb(255,178,89)" />
      <circle cx="15" cy="8.4" r="1.5" fill="white" />
      <path d="M11.6 13.4c.7-.9 1.9-1.5 3.4-1.5s2.7.6 3.4 1.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="8.6" cy="11" r="4.2" fill="rgb(123,104,238)" />
      <circle cx="8.6" cy="10.4" r="1.5" fill="white" />
      <path d="M5.2 15.4c.7-.9 1.9-1.5 3.4-1.5s2.7.6 3.4 1.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/* ── Avatar + icon resolution ─────────────────────────────────────────────── */

function Avatar({ avatar, size = 20 }: { avatar: RowAvatar; size?: number }) {
  const bg = AVATAR_BG[avatar.bg ?? 'black'];
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        backgroundImage: avatar.image ? `url(${avatar.image})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: 'white',
        fontSize: size <= 16 ? 9 : 10,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {!avatar.image && avatar.initials}
    </span>
  );
}

function RowIcon({ icon, size = 16 }: { icon: SidebarIcon; size?: number }) {
  switch (icon) {
    case 'v4IaSidebarDashboards':
      return <Cu3Icon id="cu3-icon-v4IaSidebarDashboards" size={size} />;
    case 'v4IaSidebarWhiteboards':
      return <Cu3Icon id="cu3-icon-v4IaSidebarWhiteboards" size={size} />;
    case 'history':
      return <HistoryIcon size={size} />;
    case 'userGroup':
      return <UserGroupIcon size={size} />;
    case 'userId':
      return <UserIdIcon size={size} />;
    case 'pulse':
      return <PulseIcon size={size} />;
    case 'userCollaboration':
      return <UserCollaborationIcon size={size} />;
    case 'lock':
      return <LockIcon size={size} />;
    case 'aiDefault':
      return <AiDefaultIcon size={size} />;
    case 'aiAgentDefault':
      return <AiAgentIcon size={size} />;
    case 'allAgents':
      return <AllAgentsIcon size={size} />;
  }
}

/* ── Row + group renderers ────────────────────────────────────────────────── */

function NavRowItem({ row }: { row: NavRow }) {
  const active = row.active ?? false;
  const content = (
    <>
      <span style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: SOFT }}>
        {row.avatar ? <Avatar avatar={row.avatar} /> : row.icon ? <RowIcon icon={row.icon} /> : null}
      </span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</span>
      {row.count != null && <span style={{ color: COUNT, fontSize: 12, flexShrink: 0 }}>{row.count}</span>}
    </>
  );
  const style: React.CSSProperties = {
    width: '100%',
    minHeight: 30,
    padding: '5px 8px',
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    color: active ? TEXT : MUTED,
    background: active ? ACTIVE : 'transparent',
    textDecoration: 'none',
    boxSizing: 'border-box',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
  };
  const hoverOn = (e: React.MouseEvent<HTMLElement>) => {
    if (!active) (e.currentTarget as HTMLElement).style.background = HOVER;
  };
  const hoverOff = (e: React.MouseEvent<HTMLElement>) => {
    if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
  };
  return row.href ? (
    <a href={row.href} style={style} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
      {content}
    </a>
  ) : (
    <button type="button" style={style} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
      {content}
    </button>
  );
}

function RecentRow({ item }: { item: RecentItem }) {
  const icon =
    item.icon.kind === 'view'
      ? item.icon.viewType === 29
        ? <DashboardViewIcon />
        : <WhiteboardViewIcon />
      : <Avatar avatar={item.icon.avatar} />;
  const style: React.CSSProperties = {
    width: '100%',
    minHeight: 30,
    padding: '5px 8px',
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: MUTED,
    textDecoration: 'none',
    boxSizing: 'border-box',
  };
  return (
    <a
      href={item.href ?? '#'}
      style={style}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = HOVER)}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
    >
      <span style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
    </a>
  );
}

function Subtitle({ children }: { children: ReactNode }) {
  return (
    <h3 style={{ margin: 0, padding: '0 8px 4px', color: SUBTITLE, fontSize: 12, fontWeight: 600, lineHeight: '20px' }}>{children}</h3>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        margin: '2px 4px 4px',
        padding: '20px 12px',
        border: `1px solid ${DIVIDER}`,
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        textAlign: 'center',
      }}
    >
      <FavoritedStar />
      <span style={{ color: SOFT, fontSize: 12 }}>{message}</span>
    </div>
  );
}

function MoreRow() {
  return (
    <button
      type="button"
      style={{
        width: '100%',
        minHeight: 30,
        padding: '5px 8px',
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        color: MUTED,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = HOVER)}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
    >
      <span style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: SOFT }}>
        <Cu3Icon id="cu3-icon-ellipsisRegular" size={16} />
      </span>
      <span>More</span>
    </button>
  );
}

function Group({ group, separator }: { group: SidebarGroup; separator: boolean }) {
  return (
    <div>
      {separator && <div style={{ borderTop: `1px solid ${DIVIDER}`, margin: '8px 8px 8px' }} />}
      <Subtitle>{group.title}</Subtitle>
      {group.rows?.map((row) => <NavRowItem key={row.label} row={row} />)}
      {group.emptyState && <EmptyState message={group.emptyState} />}
      {group.recents?.map((item, i) => <RecentRow key={`${item.label}-${i}`} item={item} />)}
      {group.hasMore && <MoreRow />}
    </div>
  );
}

/* ── Header controls ──────────────────────────────────────────────────────── */

function IconButton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      style={{
        width: 26,
        height: 26,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        color: SOFT,
        flexShrink: 0,
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = HOVER)}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
    >
      {children}
    </button>
  );
}

function HeaderAction({ action }: { action: SidebarHeaderAction }) {
  if (action.kind === 'pin') {
    return (
      <IconButton label="Unpin sidebar">
        <UnpinIcon />
      </IconButton>
    );
  }
  if (action.kind === 'create') {
    return (
      <button
        type="button"
        aria-label="Create new"
        style={{
          width: 26,
          height: 26,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: `1px solid ${DIVIDER}`,
          borderRadius: 6,
          cursor: 'pointer',
          color: 'rgb(60,60,60)',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = HOVER)}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
      >
        <PlusIcon size={15} />
      </button>
    );
  }
  // createMenu: edit-pencil (AI) or plus (Teams) + chevron in a bordered pill
  return (
    <button
      type="button"
      aria-label="Create"
      style={{
        height: 26,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        padding: '0 5px',
        background: 'transparent',
        border: `1px solid ${DIVIDER}`,
        borderRadius: 6,
        cursor: 'pointer',
        color: 'rgb(60,60,60)',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = HOVER)}
      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
    >
      {action.menuGlyph === 'plus' ? <PlusIcon size={15} /> : <CreateEditIcon size={15} />}
      <ChevronDown size={10} />
    </button>
  );
}

/* ── AI credits footer ────────────────────────────────────────────────────── */

function CreditWidget({ widget }: { widget: SidebarFooterWidget }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px' }}>
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="7" fill="none" stroke={DIVIDER} strokeWidth="3" />
        <path d="M10 3a7 7 0 1 0 1.74.22" fill="none" stroke="rgb(44,140,94)" strokeWidth="3" strokeLinecap="butt" />
      </svg>
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ color: TEXT, fontSize: 13, fontWeight: 600, lineHeight: '16px' }}>{widget.value}</span>
        <span style={{ color: SOFT, fontSize: 11, lineHeight: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {widget.description}
        </span>
      </span>
    </div>
  );
}

/* ── Shell ────────────────────────────────────────────────────────────────── */

export function GlobalSidebar({ section }: { section: SidebarSection }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'var(--cu-font)' }}>
      {/* Header */}
      <div
        style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '8px 8px 8px 12px',
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        <span style={{ color: TEXT, fontSize: 15, fontWeight: 700, flex: 1 }}>{section.title}</span>
        {section.headerActions.map((action, i) => (
          <HeaderAction key={`${action.kind}-${i}`} action={action} />
        ))}
      </div>

      {/* Top nav rows + inline groups */}
      <div style={{ padding: '0 4px', flexShrink: 0 }}>
        {section.topRows.map((row) => (
          <NavRowItem key={row.label} row={row} />
        ))}
        {section.topDivider && <div style={{ borderTop: `1px solid ${DIVIDER}`, margin: '8px 8px' }} />}
        {section.inlineGroups?.map((group) => (
          <div key={group.title}>
            <Subtitle>{group.title}</Subtitle>
            {group.rows?.map((row) => (
              <NavRowItem key={row.label} row={row} />
            ))}
          </div>
        ))}
      </div>

      {/* Scrolling grouped sections */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 4px 12px' }}>
        {section.groups.map((group) => (
          <Group key={group.title} group={group} separator />
        ))}
      </div>

      {/* AI credits footer */}
      {section.footer && (
        <div style={{ flexShrink: 0, borderTop: `1px solid ${DIVIDER}`, padding: '6px 4px', display: 'flex' }}>
          {section.footer.map((widget) => (
            <CreditWidget key={widget.description} widget={widget} />
          ))}
        </div>
      )}
    </div>
  );
}
