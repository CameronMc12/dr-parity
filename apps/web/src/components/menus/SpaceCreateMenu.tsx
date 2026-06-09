'use client';

import {
  useContext,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { MenuCloseContext } from '@/components/ui/Menu';

/**
 * Space "+" (Create) menu — Figma 1:1 (275px, #191919 surface, grouped items).
 *
 * Group 1: two-line create rows (List / Folder).
 * Group 2: single-line app rows with coloured icon tiles (Doc / Dashboard /
 *          Whiteboard / Form).
 * Group 3: single-line rows (Imports → submenu / Templates).
 *
 * Every leaf calls its `onSelect` and closes the menu; Imports opens a nested,
 * viewport-aware flyout to the right (anchored off its row). All behaviour is
 * passed in via props so this stays a pure presentation surface — the wiring to
 * the workspace / docs / views / dashboard stores lives in SpacesTree.
 */

const CM = {
  surface: '#191919',
  border: '#2a2a2a',
  divider: '#2a2a2a',
  heading: '#7b7b7b',
  label: '#eeeeee',
  desc: '#7b7b7b',
  icon: '#b4b4b4',
  hover: 'rgba(255,255,255,0.06)',
  chevron: '#7b7b7b',
} as const;

export const SPACE_CREATE_MENU_WIDTH = 275;

export const SPACE_CREATE_MENU_SURFACE: CSSProperties = {
  background: CM.surface,
  border: `1px solid ${CM.border}`,
  borderRadius: 8,
  padding: 8,
  boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
};

export interface SpaceCreateMenuProps {
  onCreateList: () => void;
  onCreateFolder: () => void;
  onCreateDoc: () => void;
  onCreateDashboard: () => void;
  onCreateWhiteboard: () => void;
  onCreateForm: () => void;
  onImport: (source: string) => void;
  onTemplates: () => void;
}

export function SpaceCreateMenu({
  onCreateList,
  onCreateFolder,
  onCreateDoc,
  onCreateDashboard,
  onCreateWhiteboard,
  onCreateForm,
  onImport,
  onTemplates,
}: SpaceCreateMenuProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <Heading>Create</Heading>

      <Group>
        <TwoLineRow
          icon={<ListIcon color="rgb(22,199,132)" />}
          title="List"
          description="Track tasks, projects, people & more"
          active
          onSelect={onCreateList}
        />
        <TwoLineRow
          icon={<FolderIcon color={CM.icon} />}
          title="Folder"
          description="Group Lists, Docs & more"
          onSelect={onCreateFolder}
        />
      </Group>

      <Divider />

      <Group>
        <TileRow
          tile={<Tile bg="rgb(56,132,255)"><DocGlyph /></Tile>}
          label="Doc"
          onSelect={onCreateDoc}
        />
        <TileRow
          tile={<Tile bg="rgb(193,77,204)"><DashboardGlyph /></Tile>}
          label="Dashboard"
          onSelect={onCreateDashboard}
        />
        <TileRow
          tile={<Tile bg="rgb(241,158,42)"><WhiteboardGlyph /></Tile>}
          label="Whiteboard"
          onSelect={onCreateWhiteboard}
        />
        <TileRow
          tile={<Tile bg="rgb(91,108,242)"><FormGlyph /></Tile>}
          label="Form"
          onSelect={onCreateForm}
        />
      </Group>

      <Divider />

      <Group>
        <PlainRow
          icon={<ImportIcon />}
          label="Imports"
          submenu={<ImportsSubmenu onImport={onImport} />}
        />
        <PlainRow icon={<TemplateIcon />} label="Templates" onSelect={onTemplates} />
      </Group>
    </div>
  );
}

// ── Building blocks ─────────────────────────────────────────────────────────

function Heading({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        height: 27,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 16,
        fontSize: 12,
        fontWeight: 400,
        color: CM.heading,
        userSelect: 'none',
      }}
    >
      {children}
    </div>
  );
}

function Group({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>{children}</div>;
}

function Divider() {
  return <div style={{ height: 1, background: CM.divider, margin: '8px 0' }} />;
}

function TwoLineRow({
  icon,
  title,
  description,
  active,
  onSelect,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  active?: boolean;
  onSelect: () => void;
}) {
  const close = useContext(MenuCloseContext);
  const [hover, setHover] = useState(false);
  return (
    <button
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
        close();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        height: 48,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 8px',
        borderRadius: 6,
        border: 'none',
        background: hover || active ? CM.hover : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        boxSizing: 'border-box',
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
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 14, fontWeight: 400, color: CM.label, letterSpacing: '-0.15px' }}>
          {title}
        </span>
        <span style={{ fontSize: 12, lineHeight: '18px', color: CM.desc }}>{description}</span>
      </span>
    </button>
  );
}

function Tile({ bg, children }: { bg: string; children: ReactNode }) {
  return (
    <span
      style={{
        width: 16,
        height: 16,
        borderRadius: 4,
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: '#fff',
      }}
    >
      {children}
    </span>
  );
}

function TileRow({
  tile,
  label,
  onSelect,
}: {
  tile: ReactNode;
  label: string;
  onSelect: () => void;
}) {
  const close = useContext(MenuCloseContext);
  const [hover, setHover] = useState(false);
  return (
    <button
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
        close();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        height: 28,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 8px',
        borderRadius: 6,
        border: 'none',
        background: hover ? CM.hover : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        boxSizing: 'border-box',
      }}
    >
      {tile}
      <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: CM.label, letterSpacing: '-0.15px' }}>
        {label}
      </span>
    </button>
  );
}

function PlainRow({
  icon,
  label,
  submenu,
  onSelect,
}: {
  icon: ReactNode;
  label: string;
  submenu?: ReactNode;
  onSelect?: () => void;
}) {
  const close = useContext(MenuCloseContext);
  const [hover, setHover] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={rowRef}
      style={{ position: 'relative' }}
      onMouseEnter={() => {
        setHover(true);
        if (submenu) setSubOpen(true);
      }}
      onMouseLeave={() => {
        setHover(false);
        if (submenu) setSubOpen(false);
      }}
    >
      <button
        role="menuitem"
        aria-haspopup={submenu ? 'menu' : undefined}
        aria-expanded={submenu ? subOpen : undefined}
        onClick={(e) => {
          e.stopPropagation();
          if (submenu) {
            setSubOpen((v) => !v);
            return;
          }
          onSelect?.();
          close();
        }}
        style={{
          width: '100%',
          height: 28,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 8px',
          borderRadius: 6,
          border: 'none',
          background: hover ? CM.hover : 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
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
            color: CM.icon,
          }}
        >
          {icon}
        </span>
        <span
          style={{ flex: 1, minWidth: 0, fontSize: 14, color: CM.label, letterSpacing: '-0.15px' }}
        >
          {label}
        </span>
        {submenu && (
          <span style={{ display: 'flex', flexShrink: 0 }}>
            <Chevron />
          </span>
        )}
      </button>
      {submenu && subOpen && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: -8,
            left: '100%',
            marginLeft: 6,
            minWidth: 180,
            ...SPACE_CREATE_MENU_SURFACE,
            zIndex: 10000,
          }}
        >
          {submenu}
        </div>
      )}
    </div>
  );
}

function ImportsSubmenu({ onImport }: { onImport: (source: string) => void }) {
  const close = useContext(MenuCloseContext);
  const options = ['Asana', 'Trello', 'CSV', 'More…'];
  return (
    <Group>
      {options.map((opt) => (
        <SubItem
          key={opt}
          label={opt}
          onSelect={() => {
            onImport(opt);
            close();
          }}
        />
      ))}
    </Group>
  );
}

function SubItem({ label, onSelect }: { label: string; onSelect: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        height: 28,
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        borderRadius: 6,
        border: 'none',
        background: hover ? CM.hover : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        fontSize: 14,
        color: CM.label,
        letterSpacing: '-0.15px',
        boxSizing: 'border-box',
      }}
    >
      {label}
    </button>
  );
}

// ── Icons ───────────────────────────────────────────────────────────────────

function Stroke({ d, size = 16, color = 'currentColor' }: { d: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={d}
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ListIcon({ color }: { color: string }) {
  return <Stroke color={color} d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />;
}
function FolderIcon({ color }: { color: string }) {
  return <Stroke color={color} d="M3.8 7.5h5.7l1.7 2h8.9v7.2a2.2 2.2 0 0 1-2.2 2.2H6a2.2 2.2 0 0 1-2.2-2.2V7.5Z" />;
}
function ImportIcon() {
  return <Stroke d="M14 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H14M9 12h11m0 0l-3-3m3 3l-3 3" />;
}
function TemplateIcon() {
  return <Stroke d="M4.5 6h15M4.5 11h15M4.5 16h9" />;
}
function Chevron() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 6l6 6-6 6" stroke={CM.chevron} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Tile glyphs (10px, white-on-colour).
function DocGlyph() {
  return (
    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 4h7l4 4v12H7zM14 4v4h4M9.5 13h5M9.5 16h5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function DashboardGlyph() {
  return (
    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 18V11M12 18V6M18 18v-4" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
function WhiteboardGlyph() {
  return (
    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 5h16v11H4zM9 20l3-4 3 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function FormGlyph() {
  return (
    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 5h12v14H6zM9 9h6M9 13h6M9 17h3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
