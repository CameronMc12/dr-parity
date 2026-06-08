import type { WhiteboardPreview } from '@/data/whiteboards-seed';

const CONNECTOR = 'rgb(176, 182, 196)';
const SHADOW = 'rgba(20, 24, 40, 0.12)';

/**
 * Faux mini-whiteboard rendered from a preview spec: connector lines beneath a
 * scatter of coloured sticky notes. All coordinates are percentages so the
 * preview scales to whatever box the card gives it.
 */
export function WhiteboardThumbnail({ preview }: { preview: WhiteboardPreview }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: preview.bg,
        backgroundImage:
          'radial-gradient(rgba(120,128,150,0.16) 1px, transparent 1px)',
        backgroundSize: '14px 14px',
        overflow: 'hidden',
      }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        aria-hidden="true"
      >
        {preview.lines.map((line, i) => (
          <line
            key={i}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={CONNECTOR}
            strokeWidth={0.9}
            strokeLinecap="round"
          />
        ))}
      </svg>
      {preview.notes.map((note, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: `${note.x}%`,
            top: `${note.y}%`,
            width: `${note.w}%`,
            height: `${note.h}%`,
            background: note.fill,
            borderRadius: 3,
            boxShadow: `0 1px 3px ${SHADOW}`,
          }}
        />
      ))}
    </div>
  );
}
