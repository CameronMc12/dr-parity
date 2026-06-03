import type { ComponentType } from 'react';
import { useShellStore } from '@/store/shell-store';
import { TeamsIcon, UpgradeIcon } from '@/components/ui/Icons';
import type { IconBarItemId } from '@/types/workspace';

// Oracle structure (measured localhost:7050):
// All primary nav items use cu-simple-bar-home-switch__item (x=16, w=32 in oracle).
// Top→bottom oracle order: Home, Spaces, Chat, Planner, AI, Teams, Docs,
// Dashboards, Whiteboards, Timesheets, More. Only Chat carries a badge
// (a single pink "1" dot). Teams has no glyph in the injected sprite, so it
// renders from a local component (see GlyphIcon below).

type IconComponent = ComponentType<{ size?: number }>;

// 'teams' is an oracle nav item not yet in the shared IconBarItemId union.
type NavItemId = IconBarItemId | 'teams';

// dot: oracle shows a single pink notification badge on Chat only.
const NAV_ITEMS: {
  id: NavItemId;
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

export function IconBar() {
  const { activeIcon, setActiveIcon } = useShellStore();

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
                      onClick={(e) => { e.preventDefault(); setActiveIcon(id as IconBarItemId); }}
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

              {/* More item */}
              <div className="cu-simple-bar-home-switch__item more">
                <a
                  className="cu-simple-bar-item__link"
                  href="#"
                  aria-label="More"
                  onClick={(e) => e.preventDefault()}
                  title="More"
                >
                  <span className="cu-simple-bar-item__inner">
                    <span className="cu-simple-bar-item__icon cu-simple-bar__more-icon">
                      <Cu3Icon id="cu3-icon-nineDots" size={20} />
                    </span>
                  </span>
                </a>
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
                  onClick={(e) => e.preventDefault()}
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
