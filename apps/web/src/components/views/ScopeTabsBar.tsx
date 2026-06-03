'use client';

/**
 * Scope-aware tab strip for space/folder scopes. Styled byte-identically to
 * ViewTabsBar (container gap 2 / height 36 / padX 20/16 / 1px divider; tab
 * borderBottom 2px when active, fontWeight 600/500, glyph at size 15 in its own
 * colour) but it renders a FIXED default set of task views rather than the
 * per-list stored views — a space/folder has no per-list views registry. Add /
 * rename / reorder are intentionally out of scope here.
 *
 * Clicking a tab pushes /<wsId>/<space|folder>/<id>/v/<code>. The active tab is
 * the current `code`.
 */

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { viewTypeByCode } from '@/lib/view-types';
import type { ViewScope } from '@/lib/view-scope';

const TEXT_PRIMARY = 'var(--cu-text-primary)';
const TEXT_SECONDARY = 'var(--cu-text-secondary)';
const BORDER = 'var(--cu-border-divider)';
const ROW_PAD_LEFT = 20;
const ROW_PAD_RIGHT = 16;

/** Default task-view codes shown for a space/folder, in tab order. */
export const SCOPE_TAB_CODES: readonly string[] = ['l', 'b', 'cal', 'gtt', 'tbl', 'tl', 'wl'];

function ScopeTabButton({
  code,
  active,
  onSelect,
}: {
  code: string;
  active: boolean;
  onSelect: () => void;
}) {
  const [hover, setHover] = useState(false);
  const type = viewTypeByCode(code);
  const Glyph = type?.Glyph;
  const color = type?.color ?? 'rgb(160,164,172)';
  const label = type?.label ?? code;

  return (
    <button
      data-testid={`scopetab-${code}`}
      aria-current={active ? 'page' : undefined}
      onClick={active ? undefined : onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 36,
        padding: '0 9px',
        background: 'transparent',
        border: 'none',
        borderBottom: `2px solid ${active ? TEXT_PRIMARY : 'transparent'}`,
        cursor: 'pointer',
        color: active ? TEXT_PRIMARY : hover ? TEXT_PRIMARY : TEXT_SECONDARY,
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        whiteSpace: 'nowrap',
        fontFamily: 'inherit',
      }}
    >
      {Glyph && <Glyph size={15} color={color} />}
      {label}
    </button>
  );
}

export function ScopeTabsBar({
  scope,
  activeCode,
}: {
  scope: Extract<ViewScope, { kind: 'space' | 'folder' }>;
  activeCode: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const wsId = pathname.split('/').filter(Boolean)[0] ?? '';
  const id = scope.kind === 'space' ? scope.spaceId : scope.folderId;

  const goToCode = (code: string) => {
    if (!wsId) return;
    router.push(`/${wsId}/${scope.kind}/${id}/v/${code}`);
  };

  return (
    <div
      data-testid="scope-view-tabs"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        height: 36,
        paddingLeft: ROW_PAD_LEFT,
        paddingRight: ROW_PAD_RIGHT,
        borderBottom: `1px solid ${BORDER}`,
        flexShrink: 0,
        overflowX: 'auto',
      }}
    >
      {SCOPE_TAB_CODES.map((code) => (
        <ScopeTabButton
          key={code}
          code={code}
          active={code === activeCode}
          onSelect={() => goToCode(code)}
        />
      ))}
    </div>
  );
}
