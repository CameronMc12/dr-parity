'use client';

/**
 * Round member avatar tinted with the member's brand colour, showing initials.
 * Unassigned (no colour) falls back to a muted grey disc.
 */

interface MemberAvatarProps {
  initials: string;
  color: string;
  size?: number;
}

export function MemberAvatar({ initials, color, size = 24 }: MemberAvatarProps) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.42),
        fontWeight: 600,
        flexShrink: 0,
        userSelect: 'none',
        textTransform: 'uppercase',
      }}
    >
      {initials.slice(0, 2)}
    </span>
  );
}
