'use client';

import { useEffect, useRef, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspace';
import type { Task, TaskTag } from '@/store/workspace/types';
import { TAG_COLORS, colorForTag } from '@/components/pages/listview/tag-colors';
import { fmtDuration, fmtEstimate, parseEstimate, totalTracked } from '@/store/workspace/time';
import { Popover } from './Popover';
import { ValueButton } from './MetaEditors';
import { CheckIcon, TrackTimeIcon } from './icons';

const TEXT_PRIMARY = 'var(--cu-text-primary, #eee)';
const TEXT_MUTED = 'var(--cu-text-muted, #7b7b7b)';
const TEXT_SECONDARY = 'var(--cu-text-secondary, #aaa)';
const BORDER = 'var(--cu-border-divider, #333)';
const INPUT_BG = 'var(--cu-bg-input, #222)';
const HOVER_BG = 'var(--cu-bg-hover, #2a2a2a)';
const ACCENT = 'var(--cu-accent, #7b68ee)';

// ── Time Estimate ─────────────────────────────────────────────────────────────

export function TimeEstimateField({ task }: { task: Task }) {
  const setTimeEstimate = useWorkspaceStore((s) => s.setTimeEstimate);
  return (
    <Popover
      width={220}
      trigger={({ onClick }) => (
        <ValueButton onClick={onClick} empty={!task.timeEstimate}>
          {task.timeEstimate ? fmtEstimate(task.timeEstimate) : 'Empty'}
        </ValueButton>
      )}
    >
      {(close) => <EstimateEditor task={task} onCommit={setTimeEstimate} close={close} />}
    </Popover>
  );
}

function EstimateEditor({
  task,
  onCommit,
  close,
}: {
  task: Task;
  onCommit: (id: string, minutes: number | null) => void;
  close: () => void;
}) {
  const [value, setValue] = useState(fmtEstimate(task.timeEstimate));

  const commit = () => {
    onCommit(task.id, parseEstimate(value));
    close();
  };

  return (
    <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input
        autoFocus
        data-testid="panel-estimate-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
        }}
        placeholder="e.g. 2h 30m"
        style={inputStyle}
      />
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" onClick={commit} style={primaryBtn}>
          Save
        </button>
        {task.timeEstimate != null && (
          <button
            type="button"
            onClick={() => {
              onCommit(task.id, null);
              close();
            }}
            style={ghostBtn}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

// ── Track Time (timer) ────────────────────────────────────────────────────────

export function TrackTimeField({ task }: { task: Task }) {
  const addTimeEntry = useWorkspaceStore((s) => s.addTimeEntry);
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const frame = useRef<number | null>(null);

  const banked = totalTracked(task.timeEntries);

  // Reset the live timer whenever the open task changes.
  useEffect(() => {
    setRunning(false);
    setStartedAt(null);
    setElapsed(0);
  }, [task.id]);

  useEffect(() => {
    if (!running || startedAt == null) return;
    const tick = () => {
      setElapsed(Date.now() - startedAt);
      frame.current = window.requestAnimationFrame(tick);
    };
    frame.current = window.requestAnimationFrame(tick);
    return () => {
      if (frame.current != null) window.cancelAnimationFrame(frame.current);
    };
  }, [running, startedAt]);

  const start = () => {
    setStartedAt(Date.now());
    setElapsed(0);
    setRunning(true);
  };

  const stop = () => {
    if (startedAt != null) {
      const span = Date.now() - startedAt;
      addTimeEntry(task.id, span, startedAt);
    }
    setRunning(false);
    setStartedAt(null);
    setElapsed(0);
  };

  const live = banked + (running ? elapsed : 0);

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button
        type="button"
        data-testid="panel-timer-toggle"
        onClick={running ? stop : start}
        title={running ? 'Stop timer' : 'Start timer'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 24,
          padding: '0 8px',
          borderRadius: 4,
          border: `1px solid ${running ? '#e23f29' : BORDER}`,
          cursor: 'pointer',
          background: running ? 'color-mix(in srgb, #e23f29 18%, transparent)' : 'transparent',
          color: running ? '#e23f29' : TEXT_SECONDARY,
          fontFamily: 'inherit',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {running ? (
          <span style={{ width: 9, height: 9, background: '#e23f29', borderRadius: 1 }} />
        ) : (
          <TrackTimeIcon size={14} />
        )}
        {running ? 'Stop' : 'Start'}
      </button>
      <span
        data-testid="panel-timer-elapsed"
        style={{ fontSize: 13, color: live > 0 ? TEXT_PRIMARY : TEXT_MUTED, fontVariantNumeric: 'tabular-nums' }}
      >
        {live > 0 ? fmtDuration(live) : 'Add time'}
      </span>
    </div>
  );
}

// ── Relationships ─────────────────────────────────────────────────────────────

export function RelationshipsField({
  task,
  allTasks,
}: {
  task: Task;
  allTasks: Task[];
}) {
  const linkTask = useWorkspaceStore((s) => s.linkTask);
  const unlinkTask = useWorkspaceStore((s) => s.unlinkTask);
  const [query, setQuery] = useState('');

  const linkedIds = new Set(task.linkedTaskIds ?? []);
  const linked = allTasks.filter((t) => linkedIds.has(t.id));
  const options = allTasks.filter(
    (t) =>
      t.id !== task.id &&
      t.parent !== task.id &&
      (query ? t.name.toLowerCase().includes(query.toLowerCase()) : true),
  );

  return (
    <Popover
      width={280}
      trigger={({ onClick }) => (
        <ValueButton onClick={onClick} empty={linked.length === 0}>
          {linked.length === 0 ? (
            'Empty'
          ) : (
            <span data-testid="panel-rel-count">{linked.length} linked</span>
          )}
        </ValueButton>
      )}
    >
      {() => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {linked.length > 0 && (
            <div style={{ padding: '6px 8px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {linked.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  data-testid="panel-rel-unlink"
                  onClick={() => unlinkTask(task.id, t.id)}
                  title={`Unlink ${t.name}`}
                  style={chipStyle}
                >
                  {t.name}
                  <span style={{ fontSize: 13, lineHeight: 1 }}>×</span>
                </button>
              ))}
            </div>
          )}
          <div style={{ padding: '4px 8px 6px' }}>
            <input
              autoFocus
              data-testid="panel-rel-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Link a task…"
              style={inputStyle}
            />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto', paddingBottom: 4 }}>
            {options.slice(0, 40).map((t) => {
              const isLinked = linkedIds.has(t.id);
              return (
                <RelRow
                  key={t.id}
                  name={t.name}
                  active={isLinked}
                  onClick={() => (isLinked ? unlinkTask(task.id, t.id) : linkTask(task.id, t.id))}
                />
              );
            })}
            {options.length === 0 && (
              <div style={{ padding: '8px 12px', fontSize: 12, color: TEXT_MUTED }}>No matching tasks</div>
            )}
          </div>
        </div>
      )}
    </Popover>
  );
}

function RelRow({ name, active, onClick }: { name: string; active: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      data-testid="panel-rel-option"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 12px',
        height: 32,
        background: hover ? HOVER_BG : 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: TEXT_PRIMARY,
        fontSize: 13,
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      {active && (
        <span style={{ color: ACCENT, display: 'flex' }}>
          <CheckIcon size={14} />
        </span>
      )}
    </button>
  );
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export function TagsField({ task }: { task: Task }) {
  const addTag = useWorkspaceStore((s) => s.addTag);
  const removeTag = useWorkspaceStore((s) => s.removeTag);
  const tags = task.tags ?? [];

  return (
    <Popover
      width={240}
      trigger={({ onClick }) => (
        <ValueButton onClick={onClick} empty={tags.length === 0}>
          {tags.length === 0 ? (
            'Empty'
          ) : (
            <span data-testid="panel-tag-chips" style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
              {tags.map((t) => (
                <span key={t.name} style={miniChip(t)}>
                  {t.name}
                </span>
              ))}
            </span>
          )}
        </ValueButton>
      )}
    >
      {() => <TagEditor task={task} tags={tags} onAdd={addTag} onRemove={removeTag} />}
    </Popover>
  );
}

function TagEditor({
  task,
  tags,
  onAdd,
  onRemove,
}: {
  task: Task;
  tags: TaskTag[];
  onAdd: (id: string, tag: TaskTag) => void;
  onRemove: (id: string, name: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [color, setColor] = useState<string>(TAG_COLORS[3] ?? '#6bc950');

  const commit = () => {
    const name = draft.trim();
    if (!name) return;
    onAdd(task.id, { name, color: color || colorForTag(name) });
    setDraft('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '6px 8px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {tags.length === 0 ? (
          <span style={{ fontSize: 12, color: TEXT_MUTED, padding: '2px 6px' }}>No tags yet</span>
        ) : (
          tags.map((t) => (
            <button
              key={t.name}
              type="button"
              data-testid="panel-tag-remove"
              onClick={() => onRemove(task.id, t.name)}
              title={`Remove ${t.name}`}
              style={chipStyleColored(t.color)}
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
          data-testid="panel-tag-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
          }}
          placeholder="Add or create a tag"
          style={inputStyle}
        />
      </div>
      <div style={{ padding: '0 12px 8px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {TAG_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Tag colour ${c}`}
            onClick={() => setColor(c)}
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
          type="button"
          data-testid="panel-tag-add"
          onClick={commit}
          disabled={!draft.trim()}
          style={{
            width: '100%',
            height: 30,
            borderRadius: 6,
            border: 'none',
            cursor: draft.trim() ? 'pointer' : 'default',
            background: draft.trim() ? color : INPUT_BG,
            color: draft.trim() ? '#fff' : TEXT_MUTED,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'inherit',
          }}
        >
          Add tag
        </button>
      </div>
    </div>
  );
}

// ── shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 30,
  padding: '0 8px',
  fontSize: 13,
  color: TEXT_PRIMARY,
  background: INPUT_BG,
  border: `1px solid ${BORDER}`,
  borderRadius: 6,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const primaryBtn: React.CSSProperties = {
  flex: 1,
  height: 30,
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  background: ACCENT,
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'inherit',
};

const ghostBtn: React.CSSProperties = {
  height: 30,
  padding: '0 12px',
  borderRadius: 6,
  border: `1px solid ${BORDER}`,
  cursor: 'pointer',
  background: 'transparent',
  color: TEXT_SECONDARY,
  fontSize: 13,
  fontFamily: 'inherit',
};

const chipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  height: 22,
  padding: '0 8px',
  borderRadius: 6,
  border: `1px solid ${BORDER}`,
  cursor: 'pointer',
  background: INPUT_BG,
  color: TEXT_SECONDARY,
  fontSize: 11,
  fontWeight: 600,
  fontFamily: 'inherit',
};

function chipStyleColored(color: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    height: 22,
    padding: '0 8px',
    borderRadius: 11,
    border: 'none',
    cursor: 'pointer',
    background: `color-mix(in srgb, ${color} 26%, transparent)`,
    color,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'inherit',
  };
}

function miniChip(t: TaskTag): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    height: 18,
    padding: '0 7px',
    borderRadius: 9,
    background: `color-mix(in srgb, ${t.color} 24%, transparent)`,
    color: t.color,
    fontSize: 10,
    fontWeight: 600,
  };
}
