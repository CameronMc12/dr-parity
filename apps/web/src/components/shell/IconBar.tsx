import type { ComponentType } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useShellStore } from '@/store/shell-store';
import { useUiStore } from '@/store/ui-store';
import { Menu, MenuItem, MenuHeading } from '@/components/ui/Menu';
import { TeamsIcon, UpgradeIcon, GoalsIcon } from '@/components/ui/Icons';
import type { IconBarItemId } from '@/types/workspace';

// Oracle structure (measured localhost:7050):
// All primary nav items use cu-simple-bar-home-switch__item (x=16, w=32 in oracle).
// Top→bottom oracle order: Home, Spaces, Chat, Planner, AI, Teams, Docs,
// Dashboards, Whiteboards, Timesheets, More. Only Chat carries a badge
// (a single pink "1" dot). Teams has no glyph in the injected sprite, so it
// renders from a local component (see GlyphIcon below).

type IconComponent = ComponentType<{ size?: number }>;

// dot: oracle shows a single pink notification badge on Chat only.
const NAV_ITEMS: {
  id: IconBarItemId;
  label: string;
  iconId?: string;
  iconIdFilled?: string;
  Glyph?: IconComponent;
  dot?: number;
}[] = [
  { id: 'home',        label: 'Home',        iconId: 'cu3-icon-v4IaSidebarHome',        iconIdFilled: 'cu3-icon-v4IaSidebarHomeFilled' },
  { id: 'spaces',      label: 'Spaces',      iconId: 'cu3-icon-v4IaSidebarSpaces',      iconIdFilled: 'cu3-icon-v4IaSidebarSpacesFilled' },
  { id: 'chat',        label: 'Chat',        iconId: 'cu3-icon-v4IaSidebarChat',        iconIdFilled: 'cu3-icon-v4IaSidebarChatFilled', dot: 1 },
  { id: 'planner',     label: 'Planner',     iconId: 'cu3-icon-v4IaSidebarCalendar',    iconIdFilled: 'cu3-icon-v4IaSidebarCalendarFilled' },
  { id: 'ai',          label: 'AI',          iconId: 'cu3-icon-v4IaSidebarBrain',       iconIdFilled: 'cu3-icon-v4IaSidebarBrain' },
  { id: 'teams',       label: 'Teams',       Glyph: TeamsIcon },
  { id: 'docs',        label: 'Docs',        iconId: 'cu3-icon-v4IaSidebarDocs',        iconIdFilled: 'cu3-icon-v4IaSidebarDocsFilled' },
  { id: 'dashboards',  label: 'Dashboards',  iconId: 'cu3-icon-v4IaSidebarDashboards',  iconIdFilled: 'cu3-icon-v4IaSidebarDashboardsFilled' },
  { id: 'whiteboards', label: 'Whiteboards', iconId: 'cu3-icon-v4IaSidebarWhiteboards', iconIdFilled: 'cu3-icon-v4IaSidebarWhiteboardsFilled' },
  { id: 'timesheets',  label: 'Timesheets',  iconId: 'cu3-icon-v4IaSidebarTimesheets',  iconIdFilled: 'cu3-icon-v4IaSidebarTimesheetsFilled' },
  { id: 'goals',       label: 'Goals',       Glyph: GoalsIcon },
];

// Matches ClickUp's <cu3-icon> / <svg class="svg"> pattern
function Cu3Icon({ id, size = 20 }: { id: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      data-testid="icon"
      className="svg"
      style={{ width: size, height: size, display: 'block' }}
    >
      <use href={`#${id}`} xlinkHref={`#${id}`} />
    </svg>
  );
}

// Centered label that fits inside the 64px rail with a right-side ellipsis.
// Overrides the conflicting vendor label-container/divider layout inline.
function NavLabel({ label, active }: { label: string; active?: boolean }) {
  return (
    <span
      className="cu-simple-bar-item__label-container"
      style={{ width: 64, marginLeft: 0, display: 'flex', justifyContent: 'center' }}
    >
      <span
        className="cu-simple-bar-item__label"
        style={{
          maxWidth: 52,
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: 10,
          lineHeight: '16px',
          fontWeight: active ? 700 : 600,
          letterSpacing: '-0.2px',
        }}
      >
        {label}
      </span>
    </span>
  );
}

// Double-chevron-right "expand sidebar" glyph shown at the top of the rail when
// the sidebar panel is collapsed.
function ExpandSidebarGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M13 7l5 5-5 5M6 7l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const DEFAULT_WS = '90152566819';

// Sections reached via router.push from a nav icon. home/spaces drive the
// sidebar swap through the store only and intentionally stay out of this map.
const PUSH_SECTIONS: Partial<Record<IconBarItemId, string>> = {
  chat: 'chat',
  docs: 'docs',
  dashboards: 'dashboards',
  goals: 'goals',
  ai: 'ai',
  teams: 'teams',
  whiteboards: 'whiteboards',
  timesheets: 'timesheets',
  planner: 'planner',
};

// "More" overflow apps — each navigates to its section route.
const MORE_ITEMS: { id: IconBarItemId; label: string; Glyph?: IconComponent; iconId?: string }[] = [
  { id: 'whiteboards', label: 'Whiteboards', iconId: 'cu3-icon-v4IaSidebarWhiteboards' },
  { id: 'timesheets',  label: 'Timesheets',  iconId: 'cu3-icon-v4IaSidebarTimesheets' },
  { id: 'goals',       label: 'Goals',       Glyph: GoalsIcon },
  { id: 'ai',          label: 'AI',          iconId: 'cu3-icon-v4IaSidebarBrain' },
  { id: 'teams',       label: 'Teams',       Glyph: TeamsIcon },
];

export function IconBar() {
  const activeIcon = useShellStore((s) => s.activeIcon);
  const setActiveIcon = useShellStore((s) => s.setActiveIcon);
  const sidebarOpen = useShellStore((s) => s.sidebarOpen);
  const setSidebarOpen = useShellStore((s) => s.setSidebarOpen);
  const openInvite = useUiStore((s) => s.openInvite);
  const pathname = usePathname();
  const router = useRouter();
  const wsId = pathname.split('/').filter(Boolean)[0] ?? DEFAULT_WS;

  // Clicking a nav icon sets the active shell; sections in PUSH_SECTIONS also
  // navigate to their route. home/spaces only swap the sidebar via the store.
  const onNavClick = (id: IconBarItemId) => {
    setActiveIcon(id);
    const section = PUSH_SECTIONS[id];
    if (section) router.push(`/${wsId}/${section}`);
  };

  const goSection = (id: IconBarItemId) => {
    setActiveIcon(id);
    router.push(`/${wsId}/${id}`);
  };

  return (
    // <cu-simple-bar class="cu-simple-bar v3_9 v4 ...">
    <aside
      className="cu-simple-bar v3_9 v4"
      aria-label="App navigation"
      style={{ maxWidth: 256 }}
    >
      {/* <div role="navigation" class="cu-simple-bar__container sidebar-v3 ..."> */}
      <div
        className="cu-simple-bar__container sidebar-v3 cu-simple-bar__container_v4 cu-simple-bar__container_non-expandable cu-simple-bar__container_collapsed"
        role="navigation"
        aria-label="Sidebar"
        style={{ width: 64 }}
      >
        <div className="cu-simple-bar__container-inner">
          <div className="cu-simple-bar__body">
            {/* Expand-sidebar element — oracle renders this as h=0 in collapsed/non-expandable mode */}
            <div className="cu-simple-bar__expand-sidebar" />

            {/* All primary nav items — cu-simple-bar-home-switch__item (oracle: w=32, h=62, centered) */}
            {/* Link is icon-only (h=32); label is a separate sibling below it */}
            <div className="cu-simple-bar__body-items">
              {!sidebarOpen && (
                <div className="cu-simple-bar-home-switch__item expand-sidebar">
                  <a
                    className="cu-simple-bar-item__link"
                    href="#"
                    aria-label="Expand sidebar"
                    data-test="global-sidebar-expand"
                    onClick={(e) => { e.preventDefault(); setSidebarOpen(true); }}
                    title="Expand sidebar"
                  >
                    <span className="cu-simple-bar-item__inner">
                      <span className="cu-simple-bar-item__icon">
                        <ExpandSidebarGlyph size={18} />
                      </span>
                    </span>
                  </a>
                  <hr
                    aria-hidden="true"
                    style={{
                      border: 'none',
                      borderTop: '1px solid var(--cu-border-divider, rgba(255,255,255,0.12))',
                      margin: '6px 14px 8px',
                    }}
                  />
                </div>
              )}
              {NAV_ITEMS.map(({ id, label, iconId, iconIdFilled, Glyph, dot }) => {
                const isActive = activeIcon === id;
                return (
                  <div
                    key={id}
                    className={`cu-simple-bar-home-switch__item ${id}${isActive ? ' active' : ''}`}
                    data-sidebar-item-id={id}
                  >
                    <a
                      className={`cu-simple-bar-item__link${isActive ? ' active' : ''}`}
                      href="#"
                      aria-label={label}
                      data-test={`global-sidebar-item-${id}`}
                      onClick={(e) => { e.preventDefault(); onNavClick(id); }}
                      title={label}
                    >
                      <span className={`cu-simple-bar-item__inner${isActive ? ' active' : ''}`}>
                        <span className="cu-simple-bar-item__icon" style={{ position: 'relative' }}>
                          {Glyph ? (
                            <Glyph size={20} />
                          ) : (
                            <Cu3Icon id={isActive ? iconIdFilled! : iconId!} size={20} />
                          )}
                          {dot != null && (
                            <span
                              className="cu-simple-bar-item__badge"
                              aria-hidden="true"
                              style={{
                                position: 'absolute',
                                top: -4,
                                right: -5,
                                minWidth: 14,
                                height: 14,
                                borderRadius: 9999,
                                background: 'rgb(252, 65, 158)',
                                color: 'white',
                                fontSize: 9,
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '0 3px',
                                lineHeight: 1,
                                boxSizing: 'border-box',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {dot}
                            </span>
                          )}
                        </span>
                      </span>
                    </a>
                    <NavLabel label={label} active={isActive} />
                  </div>
                );
              })}

              {/* More item — opens an overflow-apps popover */}
              <div className="cu-simple-bar-home-switch__item more">
                <Menu
                  align="left"
                  width={220}
                  trigger={({ ref, onClick }) => (
                    <button
                      ref={ref}
                      type="button"
                      className="cu-simple-bar-item__link"
                      aria-label="More"
                      title="More"
                      onClick={onClick}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      <span className="cu-simple-bar-item__inner">
                        <span className="cu-simple-bar-item__icon cu-simple-bar__more-icon">
                          <Cu3Icon id="cu3-icon-nineDots" size={20} />
                        </span>
                      </span>
                    </button>
                  )}
                >
                  <MenuHeading>Apps</MenuHeading>
                  {MORE_ITEMS.map(({ id, label, Glyph, iconId }) => (
                    <MenuItem
                      key={id}
                      icon={Glyph ? <Glyph size={16} /> : iconId ? <Cu3Icon id={iconId} size={16} /> : undefined}
                      label={label}
                      onSelect={() => goSection(id)}
                    />
                  ))}
                </Menu>
                <NavLabel label="More" />
              </div>
            </div>
          </div>

          {/* Bottom: invite + upgrade */}
          <div className="cu-simple-bar__bottom cu-simple-bar__bottom-v3">
            <div className="cu-simple-bar__bottom-buttons cu-simple-bar__bottom-buttons-v3 cu-simple-bar__bottom-right-section cu-simple-bar__bottom-right-section-multi-invite">
              {/* Invite */}
              <div className="cu-simple-bar-home-switch__item invite">
                <a
                  className="cu-simple-bar-item__link cu-invite-button__button"
                  href="#"
                  aria-label="Invite members"
                  onClick={(e) => { e.preventDefault(); openInvite(); }}
                  title="Invite"
                >
                  <span className="cu-simple-bar-item__inner">
                    <span className="cu-simple-bar-item__icon">
                      <Cu3Icon id="cu3-icon-addUser" size={20} />
                    </span>
                  </span>
                </a>
                <NavLabel label="Invite" />
              </div>

              {/* Upgrade */}
              <div className="cu-simple-bar-home-switch__item upgrade">
                <a
                  className="cu-simple-bar-item__link"
                  href="#"
                  aria-label="Upgrade"
                  onClick={(e) => e.preventDefault()}
                  title="Upgrade"
                >
                  <span className="cu-simple-bar-item__inner">
                    <span
                      className="cu-simple-bar-item__icon"
                      style={{ color: 'rgb(176, 132, 246)' }}
                    >
                      <UpgradeIcon size={20} />
                    </span>
                  </span>
                </a>
                <NavLabel label="Upgrade" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
