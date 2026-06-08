'use client';

/**
 * Dashboard widgets for the hub's per-dashboard grid. Every widget is a card
 * with a header and a body computed from real workspace tasks. Charts are
 * hand-drawn inline SVG (horizontal bars + a donut) — no charting dependency.
 */

import type { ReactNode } from 'react';
import { BORDER, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED } from '../page-primitives';
import type { HubMetrics, PrioritySlice, DueSoonItem } from './hub-metrics';
import type { StatusSlice, AssigneeSlice } from '../dashboard/dashboard-data';
import type { Task } from '@/store/workspace/types';
import type { WidgetKind } from '@/data/dashboards-seed';

const CARD_BG = 'var(--cu-bg-menu, rgb(255, 255, 255))';
const TRACK = 'var(--cu-bg-hover, rgb(238, 240, 243))';

function WidgetCard({
  title,
  subtitle,
  children,
  span = 1,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  span?: number;
}) {
  return (
    <section
      style={{
        gridColumn: `span ${span}`,
        display: 'flex',
        flexDirection: 'column',
        background: CARD_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
        overflow: 'hidden',
        minWidth: 0,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          padding: '12px 16px',
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>{title}</h3>
        {subtitle && <span style={{ fontSize: 11, color: TEXT_MUTED }}>{subtitle}</span>}
      </header>
      <div style={{ flex: 1, padding: 16, minWidth: 0 }}>{children}</div>
    </section>
  );
}

function EmptyBody({ label }: { label: string }) {
  return (
    <div style={{ fontSize: 12, color: TEXT_MUTED, padding: '8px 0' }}>{label}</div>
  );
}

/* ── Horizontal bar list ──────────────────────────────────────────────────── */

interface BarRow {
  key: string;
  label: string;
  color: string;
  count: number;
}

function BarList({ rows }: { rows: BarRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map((row) => (
        <div key={row.key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span
              style={{ width: 9, height: 9, borderRadius: 3, background: row.color, flexShrink: 0 }}
            />
            <span
              style={{
                color: TEXT_SECONDARY,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1,
              }}
            >
              {row.label}
            </span>
            <span style={{ color: TEXT_PRIMARY, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {row.count}
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: TRACK, overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.round((row.count / max) * 100)}%`,
                height: '100%',
                borderRadius: 4,
                background: row.color,
                transition: 'width 240ms ease',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Donut ────────────────────────────────────────────────────────────────── */

interface DonutSlice {
  key: string;
  label: string;
  color: string;
  count: number;
}

function Donut({ slices, centerLabel, centerValue }: {
  slices: DonutSlice[];
  centerLabel: string;
  centerValue: number;
}) {
  const total = slices.reduce((sum, s) => sum + s.count, 0);
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <svg width={132} height={132} viewBox="0 0 132 132" style={{ flexShrink: 0 }}>
        <circle cx={66} cy={66} r={r} fill="none" stroke={TRACK} strokeWidth={16} />
        {total > 0 &&
          slices.map((s) => {
            const len = (s.count / total) * c;
            const dash = (
              <circle
                key={s.key}
                cx={66}
                cy={66}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={16}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 66 66)"
                strokeLinecap="butt"
              />
            );
            offset += len;
            return dash;
          })}
        <text x={66} y={62} textAnchor="middle" fontSize={22} fontWeight={700} fill={TEXT_PRIMARY}>
          {centerValue}
        </text>
        <text x={66} y={80} textAnchor="middle" fontSize={10} fill={TEXT_MUTED}>
          {centerLabel}
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0, flex: 1 }}>
        {slices.map((s) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span
              style={{
                color: TEXT_SECONDARY,
                flex: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {s.label}
            </span>
            <span style={{ color: TEXT_PRIMARY, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {s.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Stat tile ────────────────────────────────────────────────────────────── */

function StatTile({ value, label, accent }: { value: number; label: string; accent: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, height: '100%', justifyContent: 'center' }}>
      <span style={{ fontSize: 38, fontWeight: 700, lineHeight: 1, color: accent, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
      <span style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: 500 }}>{label}</span>
    </div>
  );
}

/* ── Avatar chip ──────────────────────────────────────────────────────────── */

function Avatar({ initials, color }: { initials: string; color: string }) {
  return (
    <span
      style={{
        width: 22,
        height: 22,
        borderRadius: 9999,
        background: color,
        color: 'white',
        fontSize: 9,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  );
}

/* ── Lists ────────────────────────────────────────────────────────────────── */

function dueLabel(daysOut: number): { text: string; color: string } {
  if (daysOut < 0) return { text: `${Math.abs(daysOut)}d overdue`, color: '#e85d75' };
  if (daysOut === 0) return { text: 'Due today', color: '#f6a609' };
  if (daysOut === 1) return { text: 'Due tomorrow', color: '#f6a609' };
  return { text: `In ${daysOut}d`, color: TEXT_MUTED };
}

function DueSoonList({ items }: { items: DueSoonItem[] }) {
  if (items.length === 0) return <EmptyBody label="Nothing due in the next 7 days." />;
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map(({ task, daysOut }) => {
        const due = dueLabel(daysOut);
        return (
          <li key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: task.statusColor, flexShrink: 0 }} />
            <span
              style={{
                fontSize: 12,
                color: TEXT_SECONDARY,
                flex: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {task.name}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: due.color, whiteSpace: 'nowrap' }}>
              {due.text}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function RecentList({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) return <EmptyBody label="No recent activity." />;
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {tasks.map((task) => (
        <li key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {task.assignees[0] ? (
            <Avatar initials={task.assignees[0].initials} color={task.assignees[0].color} />
          ) : (
            <span style={{ width: 8, height: 8, borderRadius: 2, background: task.statusColor, flexShrink: 0, marginLeft: 7, marginRight: 7 }} />
          )}
          <span
            style={{
              fontSize: 12,
              color: TEXT_SECONDARY,
              flex: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {task.name}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: TEXT_MUTED,
              background: TRACK,
              borderRadius: 4,
              padding: '2px 6px',
              whiteSpace: 'nowrap',
            }}
          >
            {task.status}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ── Widget switch ────────────────────────────────────────────────────────── */

function statusRows(slices: StatusSlice[]): BarRow[] {
  return slices.map((s) => ({ key: s.status, label: s.status, color: s.color, count: s.count }));
}

function priorityRows(slices: PrioritySlice[]): BarRow[] {
  return slices.map((s) => ({ key: s.label, label: s.label, color: s.color, count: s.count }));
}

function assigneeRows(slices: AssigneeSlice[]): BarRow[] {
  return slices.map((s) => ({
    key: s.member?.id ?? '__none__',
    label: s.member?.name ?? 'Unassigned',
    color: s.member?.color ?? '#c9ced6',
    count: s.count,
  }));
}

/** Render one widget by kind. Returns null for unknown kinds (defensive). */
export function Widget({ kind, metrics }: { kind: WidgetKind; metrics: HubMetrics }): ReactNode {
  switch (kind) {
    case 'statTotal':
      return (
        <WidgetCard title="Total tasks">
          <StatTile value={metrics.total} label="across the workspace" accent={TEXT_PRIMARY} />
        </WidgetCard>
      );
    case 'statCompleted':
      return (
        <WidgetCard title="Completed">
          <StatTile value={metrics.completed} label="tasks closed or done" accent="#2bab6f" />
        </WidgetCard>
      );
    case 'statOverdue':
      return (
        <WidgetCard title="Overdue">
          <StatTile value={metrics.overdue} label="past due, still open" accent="#e85d75" />
        </WidgetCard>
      );
    case 'statusBar':
      return (
        <WidgetCard title="Tasks by status" span={2} subtitle={`${metrics.total} tasks`}>
          {metrics.status.length ? <BarList rows={statusRows(metrics.status)} /> : <EmptyBody label="No tasks." />}
        </WidgetCard>
      );
    case 'statusDonut':
      return (
        <WidgetCard title="Status breakdown" span={2}>
          {metrics.status.length ? (
            <Donut
              slices={metrics.status.map((s) => ({ key: s.status, label: s.status, color: s.color, count: s.count }))}
              centerLabel="tasks"
              centerValue={metrics.total}
            />
          ) : (
            <EmptyBody label="No tasks." />
          )}
        </WidgetCard>
      );
    case 'priorityBreakdown':
      return (
        <WidgetCard title="Tasks by priority" span={2}>
          {metrics.priority.length ? <BarList rows={priorityRows(metrics.priority)} /> : <EmptyBody label="No tasks." />}
        </WidgetCard>
      );
    case 'assigneeBar':
      return (
        <WidgetCard title="Tasks by assignee" span={2}>
          {metrics.assignees.length ? <BarList rows={assigneeRows(metrics.assignees)} /> : <EmptyBody label="No tasks." />}
        </WidgetCard>
      );
    case 'dueSoon':
      return (
        <WidgetCard title="Due soon" span={2} subtitle="next 7 days">
          <DueSoonList items={metrics.dueSoon} />
        </WidgetCard>
      );
    case 'recentActivity':
      return (
        <WidgetCard title="Recent activity" span={2}>
          <RecentList tasks={metrics.recent} />
        </WidgetCard>
      );
    default:
      return null;
  }
}
