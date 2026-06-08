import { BORDER, TEXT_MUTED, HOVER_BG } from '../page-primitives';
import { BigFolderPlus } from './goals-icons';

/**
 * Leading "create folder" tile in the Goals grid. Oracle: a square dashed-feel
 * light tile with a large outlined folder glyph carrying a small dark + badge.
 */
export function NewFolderTile() {
  return (
    <button
      aria-label="New folder"
      style={{
        position: 'relative',
        width: 152,
        height: 152,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgb(247, 247, 247)',
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        cursor: 'pointer',
        color: TEXT_MUTED,
        transition: 'background 120ms ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_BG)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgb(247, 247, 247)')}
    >
      <BigFolderPlus size={56} />
      <span
        style={{
          position: 'absolute',
          bottom: 52,
          right: 52,
          width: 20,
          height: 20,
          borderRadius: 9999,
          background: 'rgb(48, 48, 48)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          lineHeight: 1,
        }}
      >
        +
      </span>
    </button>
  );
}
