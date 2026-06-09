'use client';

import { useEffect } from 'react';
import { useUiStore } from '@/store/ui-store';
import {
  SETTINGS_NAV,
  resolveSettingsSection,
  type SettingsNavItem,
} from './settings-nav';
import { SettingsNavIcon } from './SettingsNavIcon';
import { GeneralPane } from './panes/GeneralPane';
import { MySettingsPane } from './panes/MySettingsPane';
import { ProfilePane } from './panes/ProfilePane';
import { NotificationsPane } from './panes/NotificationsPane';
import { AppearancePane } from './panes/AppearancePane';
import { PreferencesPane } from './panes/PreferencesPane';
import { PeoplePane } from './panes/PeoplePane';
import { TeamsPane } from './panes/TeamsPane';
import { BillingPane } from './panes/BillingPane';
import { AiUsagePane } from './panes/AiUsagePane';
import { SecurityPane } from './panes/SecurityPane';
import { AuditLogsPane } from './panes/AuditLogsPane';
import { TrashPane } from './panes/TrashPane';
import { CustomFieldsPane } from './panes/CustomFieldsPane';
import { TemplateCenterPane } from './panes/TemplateCenterPane';
import { AutomationsPane } from './panes/AutomationsPane';
import { AiNotetakerPane } from './panes/AiNotetakerPane';
import { SpacesPane } from './panes/SpacesPane';
import { TaskTypesPane } from './panes/TaskTypesPane';
import { WorkSchedulePane } from './panes/WorkSchedulePane';
import { AppCenterPane } from './panes/AppCenterPane';
import { ImportsExportsPane } from './panes/ImportsExportsPane';
import { ClickUpApiPane } from './panes/ClickUpApiPane';
import { EmailIntegrationPane } from './panes/EmailIntegrationPane';
import { PlaceholderPane } from './panes/PlaceholderPane';

function renderPane(section: string) {
  switch (section) {
    case 'general':
      return <GeneralPane />;
    case 'my-settings':
      return <MySettingsPane />;
    case 'profile':
      return <ProfilePane />;
    case 'notifications':
      return <NotificationsPane />;
    case 'appearance':
      return <AppearancePane />;
    case 'preferences':
      return <PreferencesPane />;
    case 'people':
      return <PeoplePane />;
    case 'teams':
      return <TeamsPane />;
    case 'billing':
      return <BillingPane />;
    case 'ai-usage':
      return <AiUsagePane />;
    case 'security':
      return <SecurityPane />;
    case 'audit-logs':
      return <AuditLogsPane />;
    case 'trash':
      return <TrashPane />;
    case 'custom-fields':
      return <CustomFieldsPane />;
    case 'template-center':
      return <TemplateCenterPane />;
    case 'automations':
      return <AutomationsPane />;
    case 'ai-notetaker':
      return <AiNotetakerPane />;
    case 'spaces':
      return <SpacesPane />;
    case 'task-types':
      return <TaskTypesPane />;
    case 'work-schedule':
      return <WorkSchedulePane />;
    case 'app-center':
      return <AppCenterPane />;
    case 'imports-exports':
      return <ImportsExportsPane />;
    case 'clickup-api':
      return <ClickUpApiPane />;
    case 'email-integration':
      return <EmailIntegrationPane />;
    default:
      return <PlaceholderPane sectionKey={section} />;
  }
}

// Settings nav row tokens — mirrors the core SpacesTree SidebarItem interaction
// (rounded hover/active swap, 8px radius) with the exact Figma settings values.
const ROW_RADIUS = 8;
const HOVER_BG = 'rgba(255,255,255,0.05)';
const ACTIVE_BG = 'rgba(255,255,255,0.08)';
const LABEL_COLOR = '#b4b4b4';
const ACTIVE_LABEL_COLOR = '#ffffff';

// Shared spacing with the core sidebars (SidebarHeader / SpacesTree SidebarItem /
// CollapsibleHeader / pinned footer). Copied 1:1 so the settings nav lines up
// with the header text and reads at the same vertical rhythm as Home/Spaces.
const SIDEBAR_HEADER_PAD_X = 12; // SidebarHeader paddingLeft
const SIDEBAR_HEADER_HEIGHT = 40; // SidebarHeader height
const SCROLL_PAD_TOP = 8; // Home scroll wrapper paddingTop
const SCROLL_PAD_X = 4; // Home scroll wrapper paddingLeft/Right
const ROW_PAD_LEFT = 12; // SidebarItem paddingLeft
const ROW_PAD_RIGHT = 8; // SidebarItem paddingRight
const ROW_PAD_Y = 5; // SidebarItem paddingTop/Bottom
const ROW_MIN_HEIGHT = 30; // SidebarItem minHeight
const ROW_GAP = 6; // SidebarItem icon-to-label gap
const GROUP_LABEL_PAD_Y = 7; // CollapsibleHeader paddingTop/Bottom
const FOOTER_PAD = '6px 8px 8px'; // CustomizeSidebarFooter padding

const ROW_LABEL_STYLE: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 14,
  fontWeight: 400,
  letterSpacing: '-0.15px',
  lineHeight: '16px',
};

interface NavRowProps {
  item: SettingsNavItem;
  active: boolean;
  onSelect: (key: string) => void;
}

/**
 * Settings nav row. Same row primitive shape as the core SpacesTree SidebarItem:
 * JS-driven hover/active background + color swap, 8px radius, transition. Tuned
 * to the Figma settings tokens (label #b4b4b4, 14/16, gap 10).
 */
function NavRow({ item, active, onSelect }: NavRowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(item.key)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(item.key);
        }
      }}
      aria-current={active ? 'page' : undefined}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: ROW_GAP,
        paddingLeft: ROW_PAD_LEFT,
        paddingRight: ROW_PAD_RIGHT,
        paddingTop: ROW_PAD_Y,
        paddingBottom: ROW_PAD_Y,
        minHeight: ROW_MIN_HEIGHT,
        boxSizing: 'border-box',
        background: active ? ACTIVE_BG : 'transparent',
        borderRadius: ROW_RADIUS,
        cursor: 'pointer',
        color: active ? ACTIVE_LABEL_COLOR : LABEL_COLOR,
        textAlign: 'left',
        transition: 'background 100ms ease, color 100ms ease',
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLDivElement).style.background = HOVER_BG;
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: 'inherit',
        }}
      >
        <SettingsNavIcon glyph={item.icon} />
      </span>
      <span style={ROW_LABEL_STYLE}>{item.label}</span>
    </div>
  );
}

/**
 * In-content Settings page. Renders in the area right of the 64px icon rail and
 * below the global topbar (mounted by AppShell when settingsOpen). NOT a modal —
 * no scrim, no centered card. The normal Home/Spaces sidebar is replaced by the
 * Settings nav, so only one sidebar is ever visible.
 *
 * The left column reuses the EXACT shell sidebar slot treatment (256px,
 * --cu-bg-sidebar, rounded left corners) so it reads as the same sidebar as the
 * Home/Global sidebars, just with settings content. The right detail panel
 * mirrors the main content panel (rounded right corners).
 *
 *   LEFT  — 256px Settings nav: "All settings" heading, then grouped
 *           Admin / Features / Integrations & ClickApps, Log out pinned bottom.
 *   RIGHT — scrolling detail pane rendered via the pane switch.
 *
 * Controlled by ui-store (settingsOpen / settingsSection). Esc closes.
 */
export function SettingsPage() {
  const open = useUiStore((s) => s.settingsOpen);
  const rawSection = useUiStore((s) => s.settingsSection);
  const setSection = useUiStore((s) => s.setSettingsSection);
  const close = useUiStore((s) => s.closeSettings);

  const section = resolveSettingsSection(rawSection);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* LEFT — Settings nav: same slot treatment as the shell sidebars */}
      <aside
        style={{
          width: 256,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'var(--cu-bg-sidebar)',
          borderTopLeftRadius: 6,
          borderBottomLeftRadius: 6,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: SIDEBAR_HEADER_HEIGHT,
            paddingLeft: SIDEBAR_HEADER_PAD_X,
            paddingRight: ROW_PAD_RIGHT,
            boxSizing: 'border-box',
            flexShrink: 0,
          }}
        >
          <h2
            style={{
              color: '#eeeeee',
              fontSize: 16,
              fontWeight: 600,
              lineHeight: '22px',
              letterSpacing: '-0.32px',
              margin: 0,
            }}
          >
            All settings
          </h2>
        </div>

        <nav
          className="flex-1 overflow-y-auto"
          style={{
            paddingTop: SCROLL_PAD_TOP,
            paddingLeft: SCROLL_PAD_X,
            paddingRight: SCROLL_PAD_X,
            paddingBottom: 0,
          }}
        >
          {SETTINGS_NAV.map((group) => (
            <div key={group.title}>
              <p
                style={{
                  paddingLeft: ROW_PAD_LEFT,
                  paddingRight: ROW_PAD_RIGHT,
                  paddingTop: GROUP_LABEL_PAD_Y,
                  paddingBottom: GROUP_LABEL_PAD_Y,
                  margin: 0,
                  color: '#7b7b7b',
                  fontSize: 12,
                  fontWeight: 510,
                  lineHeight: '17.4px',
                }}
              >
                {group.title}
              </p>
              {group.items.map((item) => (
                <NavRow
                  key={item.key}
                  item={item}
                  active={item.key === section}
                  onSelect={setSection}
                />
              ))}
            </div>
          ))}
        </nav>

        {/* Log out pinned bottom — 1px hairline divider, footer pad matches the
            core CustomizeSidebarFooter (6px 8px 8px). */}
        <div style={{ borderTop: '1px solid #2a2a2a', padding: FOOTER_PAD }}>
          <NavRow
            item={{ key: 'logout', label: 'Log out', icon: 'logout' }}
            active={false}
            onSelect={() => close()}
          />
        </div>
      </aside>

      {/* RIGHT — detail pane: mirrors the main content panel */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--cu-bg-app)',
          borderTopRightRadius: 6,
          borderBottomRightRadius: 6,
          borderLeft: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '28px 32px 100px 32px',
          }}
        >
          {renderPane(section)}
        </div>

        {/* Floating bottom bar for Save changes */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 72,
            background: 'var(--cu-bg-app)',
            borderTop: '1px solid rgba(255,255,255,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 32px',
            borderBottomRightRadius: 6,
          }}
        >
          <button
            type="button"
            onClick={close}
            className="h-[34px] px-4 rounded-[6px] text-[13px] font-medium bg-white text-black hover:opacity-90 transition-opacity"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
