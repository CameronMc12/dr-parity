import { WhiteboardGlyph } from './whiteboard-icons';

const PANEL_BG = 'var(--cu-bg-hover)';
const PLACEHOLDER = 'var(--cu-border-strong)';

/**
 * Empty whiteboard thumbnail. Matches real ClickUp: a flat light panel with a
 * single faint grey whiteboard glyph centred inside a soft rounded outline.
 * No sticky notes, no connector scatter.
 */
export function WhiteboardThumbnail() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: PANEL_BG,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 54,
          height: 54,
          borderRadius: 12,
          border: `1.5px solid ${PLACEHOLDER}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: PLACEHOLDER,
        }}
      >
        <WhiteboardGlyph size={30} color={PLACEHOLDER} />
      </div>
    </div>
  );
}
