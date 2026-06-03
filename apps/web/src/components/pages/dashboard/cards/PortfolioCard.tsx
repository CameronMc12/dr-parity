'use client';

/**
 * PortfolioCard — a rollup table across every list in the workspace. Each row is
 * a real list (folderless or inside a folder) carrying its space colour, a
 * progress bar, and a done/total count derived from the live task store. The
 * card's own list is highlighted. Counts come from one flat pass over active
 * tasks, bucketed by listId, so the table stays in sync with every view.
 */

import { useMemo } from 'react';
import { useSpaces, useAllTasksFlat } from '@/store/workspace/hooks';
import { DASH } from '../tokens';
import type { Task } from '@/store/workspace/types';
import type { CardRenderProps } from './card-props';

const COMPLETE = new Set(['closed', 'done']);

interface PortfolioRow {
  listId: string;
  name: string;
  color: string;
  done: number;
  total: number;
}

function buildRows(
  spaces: ReturnType<typeof useSpaces>,
  tasks: Task[],
): PortfolioRow[] {
  const counts = new Map<string, { done: number; total: number }>();
  for (const t of tasks) {
    const bucket = counts.get(t.listId) ?? { done: 0, total: 0 };
    bucket.total += 1;
    if (COMPLETE.has(t.statusType)) bucket.done += 1;
    counts.set(t.listId, bucket);
  }

  const rows: PortfolioRow[] = [];
  for (const space of spaces) {
    const push = (id: string, name: string) => {
      const c = counts.get(id) ?? { done: 0, total: 0 };
      rows.push({ listId: id, name, color: space.color, done: c.done, total: c.total });
    };
    for (const list of space.folderlessLists) push(list.id, list.name);
    for (const folder of space.folders) {
      for (const list of folder.lists) push(list.id, `${folder.name} / ${list.name}`);
    }
  }
  return rows.sort((a, b) => b.total - a.total);
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div
      style={{
        height: 6,
        borderRadius: 3,
        background: DASH.cardHoverBg,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: 3,
          transition: 'width 240ms ease-out',
        }}
      />
    </div>
  );
}

export function PortfolioCard({ listId }: CardRenderProps) {
  const spaces = useSpaces();
  const tasks = useAllTasksFlat();
  const rows = useMemo(() => buildRows(spaces, tasks), [spaces, tasks]);

  if (rows.length === 0) {
    return (
      <div style={{ padding: 18, fontSize: 12, color: DASH.textMuted }}>
        No lists to roll up yet.
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '8px 0' }}>
      {rows.map((row) => {
        const pct = row.total === 0 ? 0 : Math.round((row.done / row.total) * 100);
        const active = row.listId === listId;
        return (
          <div
            key={row.listId}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              padding: '8px 18px',
              background: active ? DASH.accentSubtle : 'transparent',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  flexShrink: 0,
                  background: row.color,
                }}
              />
              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: active ? DASH.textPrimary : DASH.textSecondary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {row.name}
              </span>
              <span
                style={{
                  fontSize: 11,
                  flexShrink: 0,
                  color: DASH.textMuted,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {row.done}/{row.total}
              </span>
            </div>
            <ProgressBar pct={pct} color={row.color} />
          </div>
        );
      })}
    </div>
  );
}
