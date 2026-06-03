'use client';

import { useState, type ReactNode } from 'react';
import { Menu } from '@/components/ui/Menu';
import { SectionLabel } from './menu-parts';
import { useWorkspaceStore } from '@/store/workspace';
import type { Task, TaskTag } from '@/store/workspace/types';
import { LV } from './tokens';
import { colorForTag, TAG_COLORS } from './tag-colors';

/**
 * Add-tag popover. Lists the task's current tags (click to remove), a text
 * input to create a new tag, and a colour swatch row to pick the chip colour.
 */
export function TagPicker({
  task,
  trigger,
}: {
  task: Task;
  trigger: (args: { ref: React.Ref<HTMLButtonElement>; onClick: (e: React.MouseEvent) => void; open: boolean }) => ReactNode;
}) {
  const addTag = useWorkspaceStore((s) => s.addTag);
  const removeTag = useWorkspaceStore((s) => s.removeTag);
  const tags = task.tags ?? [];

  const [draft, setDraft] = useState('');
  const [color, setColor] = useState<string>(TAG_COLORS[3] ?? '#6bc950');

  const commit = () => {
    const name = draft.trim();
    if (!name) return;
    addTag(task.id, { name, color: color || colorForTag(name) });
    setDraft('');
  };

  return (
    <Menu width={232} align="left" trigger={trigger}>
      <SectionLabel>Tags</SectionLabel>
      <div style={{ padding: '0 8px 6px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {tags.length === 0 ? (
          <span style={{ fontSize: 12, color: LV.textMuted, padding: '2px 6px' }}>No tags yet</span>
        ) : (
          tags.map((t: TaskTag) => (
            <button
              key={t.name}
              data-testid="tag-picker-remove"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(task.id, t.name);
              }}
              title={`Remove ${t.name}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 22,
                padding: '0 8px',
                borderRadius: 11,
                border: 'none',
                cursor: 'pointer',
                background: `color-mix(in srgb, ${t.color} 26%, transparent)`,
                color: t.color,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'inherit',
              }}
            >
              {t.name}
              <span style={{ fontSize: 13, lineHeight: 1 }}>×</span>
            </button>
          ))
        )}
      </div>

      <div style={{ padding: '4px 8px 6px' }}>
        <input
          autoFocus
          data-testid="tag-picker-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
          }}
          placeholder="Add or create a tag"
          style={{
            width: '100%',
            height: 28,
            padding: '0 8px',
            fontSize: 13,
            color: LV.textPrimary,
            background: LV.input,
            border: `1px solid ${LV.border}`,
            borderRadius: 6,
            outline: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <SectionLabel>Colour</SectionLabel>
      <div style={{ padding: '0 12px 8px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {TAG_COLORS.map((c) => (
          <button
            key={c}
            aria-label={`Tag colour ${c}`}
            onClick={(e) => {
              e.stopPropagation();
              setColor(c);
            }}
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: c,
              cursor: 'pointer',
              border: color === c ? '2px solid #fff' : '2px solid transparent',
              boxShadow: color === c ? `0 0 0 2px ${c}` : 'none',
            }}
          />
        ))}
      </div>

      <div style={{ padding: '0 8px 8px' }}>
        <button
          data-testid="tag-picker-add"
          onClick={(e) => {
            e.stopPropagation();
            commit();
          }}
          disabled={!draft.trim()}
          style={{
            width: '100%',
            height: 30,
            borderRadius: 6,
            border: 'none',
            cursor: draft.trim() ? 'pointer' : 'default',
            background: draft.trim() ? color : LV.strong,
            color: draft.trim() ? '#fff' : LV.textMuted,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'inherit',
          }}
        >
          Add tag
        </button>
      </div>
    </Menu>
  );
}
