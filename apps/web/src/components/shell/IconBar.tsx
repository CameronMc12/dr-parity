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

// Icon-rail geometry tokens (measured from Figma).
const RAIL_BG = '#111111';                       // one shade darker than sidebar
const RAIL_DIVIDER = 'rgba(255,255,255,0.06)';   // faint right divider
const LABEL_MUTED = '#7b7b7b';
const LABEL_ACTIVE = '#ffffff';
const HIGHLIGHT_HOVER = 'rgba(255,255,255,0.07)';
const HIGHLIGHT_ACTIVE = 'rgba(255,255,255,0.11)';
const UPGRADE_PURPLE = '#5842C8';

// Scoped overrides for the vendor cu-simple-bar layout. The shipped design-system
// CSS draws a 52×62 pill highlight; Figma wants a 40×40 rounded-square (radius 12)
// centred behind the 32px icon, muted #7b7b7b labels at weight 590, and the rail
// one shade darker than the sidebar with a faint right divider.
const RAIL_CSS = `
.cu-simple-bar { width: 64px; }
.cu-simple-bar__container { width: 64px; }
.cu-simple-bar__container-inner {
  width: 64px;
  height: 100%;
  margin-left: 0;
  margin-right: 0;
  background: var(--cu-bg-sidebar);
  border-radius: 6px;
  border: none;
  padding-left: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
}
/* Flex column for items */
.cu-simple-bar__body-items,
.cu-simple-bar__body-pinned-hubs {
  width: 100%;
  padding-top: 3px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}
.cu-simple-bar__expand-sidebar { width: 100%; display: flex; justify-content: center; }
.cu-simple-bar-home-switch__item { 
  width: 100%; 
  height: 48px; 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  justify-content: center; 
}

/* Icon button */
.cu-simple-bar-home-switch__item .cu-simple-bar-item__link,
.cu-simple-bar-home-switch__item.invite .cu-simple-bar-item__link,
.cu-simple-bar-home-switch__item.upgrade .cu-simple-bar-item__link {
  width: 100%;
  height: 32px;
  border-radius: 0;
  background: transparent !important;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
}
.cu-simple-bar-home-switch__item .cu-simple-bar-item__inner {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  transition: background 120ms ease;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cu-simple-bar-home-switch__item .cu-simple-bar-item__icon { 
  color: ${LABEL_MUTED}; 
  display: flex; 
  align-items: center; 
  justify-content: center; 
}
.cu-simple-bar-home-switch__item .cu-simple-bar-item__icon .svg { color: inherit; fill: currentColor; }

/* Hover (any item) */
.cu-simple-bar-home-switch__item:hover .cu-simple-bar-item__inner { background: ${HIGHLIGHT_HOVER}; }
.cu-simple-bar-home-switch__item:hover .cu-simple-bar-item__icon { color: ${LABEL_ACTIVE}; }
.cu-simple-bar-home-switch__item:hover .cu-rail-label { color: ${LABEL_ACTIVE}; }
/* Upgrade keeps its purple tint on hover */
.cu-simple-bar-home-switch__item.upgrade:hover .cu-simple-bar-item__icon { color: ${UPGRADE_PURPLE}; }
.cu-simple-bar-home-switch__item.upgrade:hover .cu-rail-label { color: ${UPGRADE_PURPLE}; }
.cu-simple-bar-home-switch__item.upgrade .cu-rail-label { color: ${UPGRADE_PURPLE}; }

/* Active */
.cu-simple-bar-home-switch__item.active .cu-simple-bar-item__inner { background: ${HIGHLIGHT_ACTIVE}; }
.cu-simple-bar-home-switch__item.active .cu-simple-bar-item__icon { color: ${LABEL_ACTIVE}; }

/* Label below icon, ~0px gap */
.cu-rail-label-container { width: 100%; display: flex; justify-content: center; margin-top: 0px; }
.cu-rail-label {
  font-size: 9.5px;
  font-weight: 590;
  line-height: 14px;
  letter-spacing: -0.1px;
  text-align: center;
  max-width: 52px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${LABEL_MUTED};
}

/* Bottom invite/upgrade slots */
.cu-simple-bar__bottom { 
  padding-bottom: 5px; 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  gap: 1px; 
  width: 100%;
}
.cu-simple-bar-home-switch__item.invite,
.cu-simple-bar-home-switch__item.upgrade { width: 100%; height: 48px; }
`;

// Centered label that fits inside the 64px rail with a right-side ellipsis.
function NavLabel({ label, active }: { label: string; active?: boolean }) {
  return (
    <span className="cu-rail-label-container">
      <span
        className="cu-rail-label"
        style={{ color: active ? LABEL_ACTIVE : LABEL_MUTED }}
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
      <style>{RAIL_CSS}</style>
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
                            <Glyph size={18} />
                          ) : (
                            <Cu3Icon id={isActive ? iconIdFilled! : iconId!} size={18} />
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
                          <Cu3Icon id="cu3-icon-nineDots" size={18} />
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
                      <Cu3Icon id="cu3-icon-addUser" size={18} />
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
                      style={{ color: UPGRADE_PURPLE }}
                    >
                      <UpgradeIcon size={18} />
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
