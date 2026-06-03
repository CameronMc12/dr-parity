'use client';

import { useState, type ReactNode } from 'react';
import type { Task } from '@/store/workspace/types';
import { PlusSquareIcon, RenameIcon, TagIcon } from '../list-view-icons';
import { TagPicker } from './TagPicker';

const MUTED = 'var(--cu-text-muted)';
const TEXT = 'var(--cu-text-secondary)';
const BORDER = 'var(--cu-border-strong, rgba(255,255,255,0.16))';

/** A single rounded-square quick-action button, matching the oracle group. */
function QuickActionButton({
  label,
  testid,
  icon,
  onClick,
  refProp,
  active,
}: {
  label: string;
  testid: string;
  icon: ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  refProp?: React.Ref<HTMLButtonElement>;
  active?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      ref={refProp}
      aria-label={label}
      title={label}
      data-testid={testid}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 24,
        height: 24,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hover || active ? 'rgba(255,255,255,0.08)' : 'transparent',
        border: `1px solid ${BORDER}`,
        borderRadius: 6,
        cursor: 'pointer',
        color: hover || active ? TEXT : MUTED,
        padding: 0,
        flexShrink: 0,
      }}
    >
      {icon}
    </button>
  );
}

/**
 * The three hover quick-action buttons that appear right after the task name.
 *
 * Function mapping (confirmed against the captured ClickUp list DOM + oracle):
 *   "+"    → Add subtask  (creates a child task, auto-expands the parent)
 *   tag    → Add tag      (opens the tag picker popover)
 *   pencil → Rename       (inline-edits the task name)
 */
export function RowQuickActions({
  task,
  onAddSubtask,
  onRename,
}: {
  task: Task;
  onAddSubtask: () => void;
  onRename: () => void;
}) {
  return (
    <span
      data-testid="row-quick-actions"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
    >
      <QuickActionButton
        label="Add subtask"
        testid="row-action-add-subtask"
        icon={<PlusSquareIcon size={15} />}
        onClick={onAddSubtask}
      />
      <TagPicker
        task={task}
        trigger={({ ref, onClick, open }) => (
          <QuickActionButton
            label="Add tag"
            testid="row-action-add-tag"
            icon={<TagIcon size={14} />}
            refProp={ref}
            onClick={onClick}
            active={open}
          />
        )}
      />
      <QuickActionButton
        label="Rename"
        testid="row-action-rename"
        icon={<RenameIcon />}
        onClick={onRename}
      />
    </span>
  );
}
