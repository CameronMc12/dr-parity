'use client';

import { FolderOpenIcon } from './goals-icons';

const TILE_BG = 'rgb(247, 248, 249)';
const ICON = 'rgb(196, 199, 205)';
const BADGE_BG = 'rgb(89, 93, 102)';

/**
 * First grid tile on the Goals landing: an empty light square with an
 * open-folder glyph and a "+" badge that invites creating a goal folder.
 */
export function CreateFolderTile({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Create goal folder"
      style={{
        width: 152,
        height: 152,
        background: TILE_BG,
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span style={{ position: 'relative', color: ICON, lineHeight: 0 }}>
        <FolderOpenIcon size={58} />
        <span
          style={{
            position: 'absolute',
            right: -4,
            bottom: -2,
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: BADGE_BG,
            color: 'white',
            fontSize: 15,
            fontWeight: 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          +
        </span>
      </span>
    </button>
  );
}
