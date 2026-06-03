'use client';

import type { TaskTag } from '@/store/workspace/types';

/** Inline tag chips rendered in the name cell after the task title. */
export function TagChips({ tags }: { tags: TaskTag[] }) {
  if (!tags.length) return null;
  return (
    <span data-testid="row-tag-chips" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      {tags.map((t) => (
        <span
          key={t.name}
          data-testid="row-tag-chip"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            height: 18,
            padding: '0 7px',
            borderRadius: 9,
            background: `color-mix(in srgb, ${t.color} 24%, transparent)`,
            color: t.color,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
          }}
        >
          {t.name}
        </span>
      ))}
    </span>
  );
}
