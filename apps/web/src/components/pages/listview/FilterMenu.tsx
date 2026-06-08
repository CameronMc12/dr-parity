'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Menu, MenuDivider } from '@/components/ui/Menu';
import { useWorkspaceStore } from '@/store/workspace';
import type {
  DueDateFilter,
  FilterState,
  ViewConfig,
} from '@/store/workspace/view-config.types';
import type { Task } from '@/store/workspace/types';
import { listStatusOptions, PRIORITY_OPTIONS } from './statuses';
import { CheckMark, Dot, MenuSearch, PickerRow, SectionLabel } from './menu-parts';
import { FlagIcon } from '../list-view-icons';
import { LV } from './tokens';

/** Full ClickUp "Select filter" field list (in capture order). */
const FIELD_LABELS = [
  'Status',
  'Tags',
  'Due date',
  'Priority',
  'Assignee',
  'Archived',
  'Assigned comment',
  'Created by',
  'Date closed',
  'Date created',
  'Date updated',
  'Date done',
  'Dependency',
  'Duration',
  'Location/List',
  'Recurring',
  'Start date',
  'Status is closed',
] as const;

/** Which drill-in panel a root field opens (null = visual-only field). */
type FieldPanel =
  | 'status'
  | 'priority'
  | 'assignee'
  | 'tags'
  | 'dueDate'
  | 'saved'
  | null;

const FIELD_TO_PANEL: Partial<Record<(typeof FIELD_LABELS)[number], FieldPanel>> = {
  Status: 'status',
  Tags: 'tags',
  'Due date': 'dueDate',
  Priority: 'priority',
  Assignee: 'assignee',
};

const DUE_DATE_OPTIONS: { key: NonNullable<DueDateFilter>; label: string }[] = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'none', label: 'No date' },
];

/** Field-glyph stand-in (uppercased monogram) for non-wired filter fields. */
function FieldGlyph({ label }: { label: string }) {
  return (
    <span
      style={{
        width: 16,
        height: 16,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 700,
        color: LV.textMuted,
        flexShrink: 0,
      }}
    >
      {label[0]}
    </span>
  );
}

/** Count of every active filter value across all fields. */
function activeFilterCount(f: FilterState): number {
  return (
    f.status.length +
    f.priority.length +
    f.assignee.length +
    f.tags.length +
    (f.dueDate ? 1 : 0)
  );
}

/** Distinct tag {name,color} pairs present on the view's tasks. */
function collectTags(tasks: Task[]): { name: string; color: string }[] {
  const seen = new Map<string, string>();
  for (const t of tasks) for (const tag of t.tags ?? []) if (!seen.has(tag.name)) seen.set(tag.name, tag.color);
  return [...seen.entries()].map(([name, color]) => ({ name, color })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Trash icon button reused by the header clear-all and per-saved-filter delete. */
function TrashButton({ label, onClick }: { label: string; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      style={{ background: 'transparent', border: 'none', color: LV.textMuted, cursor: 'pointer', padding: 4, display: 'inline-flex' }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-9 0l1 13a1 1 0 001 1h6a1 1 0 001-1l1-13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/**
 * Filter popover (the "Select filter ▾" dropdown of the Filters bar). The root
 * lists every filterable field with a search box; Status / Priority / Assignee /
 * Tags / Due date drill into a functional checklist that filters the rendered
 * rows. A "Saved filters" panel saves the current set under a name and re-applies
 * or deletes saved snapshots, mirroring the real bar.
 */
export function FilterMenu({
  listId,
  listTasks,
  config,
  initialField = null,
  trigger,
}: {
  listId: string;
  listTasks: Task[];
  config: ViewConfig;
  /** Opens the popover focused on a specific field (e.g. the Assignee button). */
  initialField?: FieldPanel;
  trigger: (args: { ref: React.Ref<HTMLButtonElement>; onClick: (e: React.MouseEvent) => void; open: boolean }) => ReactNode;
}) {
  const toggleFilterValue = useWorkspaceStore((s) => s.toggleFilterValue);
  const setDueDateFilter = useWorkspaceStore((s) => s.setDueDateFilter);
  const clearFilters = useWorkspaceStore((s) => s.clearFilters);
  const saveCurrentFilter = useWorkspaceStore((s) => s.saveCurrentFilter);
  const applySavedFilter = useWorkspaceStore((s) => s.applySavedFilter);
  const deleteSavedFilter = useWorkspaceStore((s) => s.deleteSavedFilter);
  const members = useWorkspaceStore((s) => s.members);
  const [panel, setPanel] = useState<FieldPanel>(initialField);
  const [query, setQuery] = useState('');
  const [saveName, setSaveName] = useState('');

  const statusOptions = useMemo(() => listStatusOptions(listTasks), [listTasks]);
  const tagOptions = useMemo(() => collectTags(listTasks), [listTasks]);
  const q = query.trim().toLowerCase();
  const fields = useMemo(() => FIELD_LABELS.filter((l) => l.toLowerCase().includes(q)), [q]);

  const activeCount = activeFilterCount(config.filters);
  const savedFilters = config.savedFilters;

  const submitSave = () => {
    const name = saveName.trim();
    if (!name) return;
    saveCurrentFilter(listId, name);
    setSaveName('');
  };

  return (
    <Menu width={260} align="left" trigger={trigger}>
      {panel === null ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px 0' }}>
            <SectionLabel>Filters{activeCount > 0 ? ` · ${activeCount}` : ''}</SectionLabel>
            <TrashButton
              label="Clear all filters"
              onClick={(e) => {
                e.stopPropagation();
                clearFilters(listId);
              }}
            />
          </div>

          <MenuSearch value={query} onChange={setQuery} placeholder="Search..." />

          {fields.map((label) => {
            const target = FIELD_TO_PANEL[label] ?? null;
            const isFunctional = target !== null;
            return (
              <PickerRow
                key={label}
                onClick={() => target && setPanel(target)}
                trailing={isFunctional ? <span style={{ color: LV.textMuted, fontSize: 13 }}>›</span> : undefined}
              >
                <FieldGlyph label={label} />
                <span style={{ fontSize: 13, color: isFunctional ? LV.textPrimary : LV.textMuted }}>{label}</span>
              </PickerRow>
            );
          })}

          <MenuDivider />
          <PickerRow onClick={() => setPanel('saved')}>
            <span style={{ fontSize: 13, color: LV.textSecondary }}>
              Saved filters{savedFilters.length > 0 ? ` · ${savedFilters.length}` : ''}
            </span>
            <span style={{ marginLeft: 'auto', color: LV.textMuted, fontSize: 13 }}>›</span>
          </PickerRow>
        </>
      ) : (
        <>
          <PickerRow onClick={() => setPanel(null)}>
            <span style={{ fontSize: 13, color: LV.textMuted }}>‹ Back</span>
          </PickerRow>
          <MenuDivider />

          {panel === 'saved' ? (
            <>
              <SectionLabel>Save current as</SectionLabel>
              <div style={{ display: 'flex', gap: 6, padding: '0 12px 8px' }}>
                <input
                  data-testid="filter-save-name"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      submitSave();
                    }
                  }}
                  placeholder="Filter name"
                  disabled={activeCount === 0}
                  style={{
                    flex: 1,
                    minWidth: 0,
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
                <button
                  data-testid="filter-save-submit"
                  onClick={submitSave}
                  disabled={!saveName.trim() || activeCount === 0}
                  style={{
                    height: 28,
                    padding: '0 12px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: saveName.trim() && activeCount > 0 ? LV.indigoText : LV.textMuted,
                    background: saveName.trim() && activeCount > 0 ? LV.indigoBg : LV.strong,
                    border: 'none',
                    borderRadius: 6,
                    cursor: saveName.trim() && activeCount > 0 ? 'pointer' : 'default',
                    fontFamily: 'inherit',
                    flexShrink: 0,
                  }}
                >
                  Save
                </button>
              </div>

              {savedFilters.length > 0 && <SectionLabel>Saved</SectionLabel>}
              {savedFilters.length === 0 ? (
                <div style={{ padding: '4px 14px 10px', fontSize: 12, color: LV.textMuted }}>
                  No saved filters yet.
                </div>
              ) : (
                savedFilters.map((sf) => (
                  <PickerRow
                    key={sf.id}
                    onClick={() => applySavedFilter(listId, sf.id)}
                    trailing={
                      <TrashButton
                        label={`Delete ${sf.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSavedFilter(listId, sf.id);
                        }}
                      />
                    }
                  >
                    <span style={{ fontSize: 13, color: LV.textPrimary }}>{sf.name}</span>
                    <span style={{ fontSize: 12, color: LV.textMuted }}>
                      {activeFilterCount(sf.filters)}
                    </span>
                  </PickerRow>
                ))
              )}
            </>
          ) : (
            <>
              <SectionLabel>{panel === 'dueDate' ? 'Due date' : panel}</SectionLabel>

              {panel === 'status' &&
                statusOptions.map((o) => {
                  const active = config.filters.status.includes(o.status);
                  return (
                    <PickerRow
                      key={o.status}
                      onClick={() => toggleFilterValue(listId, 'status', o.status)}
                      active={active}
                      trailing={active ? <CheckMark /> : undefined}
                    >
                      <Dot color={o.statusColor} />
                      <span style={{ fontSize: 13, color: LV.textPrimary, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.02em' }}>
                        {o.status}
                      </span>
                    </PickerRow>
                  );
                })}

              {panel === 'priority' &&
                PRIORITY_OPTIONS.map((p) => {
                  const active = config.filters.priority.includes(p.key);
                  return (
                    <PickerRow
                      key={p.key}
                      onClick={() => toggleFilterValue(listId, 'priority', p.key)}
                      active={active}
                      trailing={active ? <CheckMark /> : undefined}
                    >
                      <FlagIcon color={p.color} />
                      <span style={{ fontSize: 13, color: LV.textPrimary }}>{p.label}</span>
                    </PickerRow>
                  );
                })}

              {panel === 'assignee' &&
                members.map((m) => {
                  const active = config.filters.assignee.includes(m.id);
                  return (
                    <PickerRow
                      key={m.id}
                      onClick={() => toggleFilterValue(listId, 'assignee', m.id)}
                      active={active}
                      trailing={active ? <CheckMark /> : undefined}
                    >
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: m.color,
                          color: '#fff',
                          fontSize: 9,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {m.initials}
                      </span>
                      <span style={{ fontSize: 13, color: LV.textPrimary }}>{m.name}</span>
                    </PickerRow>
                  );
                })}

              {panel === 'tags' &&
                (tagOptions.length === 0 ? (
                  <div style={{ padding: '4px 14px 10px', fontSize: 12, color: LV.textMuted }}>
                    No tags on these tasks.
                  </div>
                ) : (
                  tagOptions.map((tag) => {
                    const active = config.filters.tags.includes(tag.name);
                    return (
                      <PickerRow
                        key={tag.name}
                        onClick={() => toggleFilterValue(listId, 'tags', tag.name)}
                        active={active}
                        trailing={active ? <CheckMark /> : undefined}
                      >
                        <span
                          style={{
                            height: 18,
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '0 8px',
                            borderRadius: 9,
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#fff',
                            background: tag.color,
                          }}
                        >
                          {tag.name}
                        </span>
                      </PickerRow>
                    );
                  })
                ))}

              {panel === 'dueDate' &&
                DUE_DATE_OPTIONS.map((o) => {
                  const active = config.filters.dueDate === o.key;
                  return (
                    <PickerRow
                      key={o.key}
                      onClick={() => setDueDateFilter(listId, active ? null : o.key)}
                      active={active}
                      trailing={active ? <CheckMark /> : undefined}
                    >
                      <span style={{ fontSize: 13, color: LV.textPrimary }}>{o.label}</span>
                    </PickerRow>
                  );
                })}
            </>
          )}
        </>
      )}
    </Menu>
  );
}
