'use client';

import { useWorkspaceStore } from '@/store/workspace';
import { useSubtasks } from '@/store/workspace/hooks';
import type { Task } from '@/store/workspace/types';
import { CheckIcon, PlusSmallIcon } from './icons';

const TEXT_PRIMARY = 'var(--cu-text-primary, #eee)';
const TEXT_MUTED = 'var(--cu-text-muted, #7b7b7b)';
const BORDER = 'var(--cu-border-divider, #333)';
const HOVER_BG = 'var(--cu-bg-hover, #2a2a2a)';

/** Subtask list + "Add subtask" creator, mirrored into the List view via store. */
export function SubtasksBlock({ task }: { task: Task }) {
  const subtasks = useSubtasks(task.id);
  const createTask = useWorkspaceStore((s) => s.createTask);
  const toggleTaskComplete = useWorkspaceStore((s) => s.toggleTaskComplete);

  const addSubtask = () => {
    createTask({
      name: 'New subtask',
      listId: task.listId,
      parent: task.id,
      status: task.status,
      statusColor: task.statusColor,
      statusType: task.statusType,
    });
  };

  return (
    <div style={{ padding: '24px 0 0' }} data-testid="panel-subtasks">
      <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700, color: TEXT_PRIMARY }}>
        {subtasks.length > 0 ? `Subtasks (${subtasks.length})` : 'Add subtask'}
      </h3>

      {subtasks.length > 0 && (
        <ul
          data-testid="panel-subtask-list"
          style={{
            listStyle: 'none',
            margin: '0 0 10px',
            padding: 0,
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {subtasks.map((sub) => {
            const done = sub.statusType === 'closed' || sub.statusType === 'done';
            return (
              <li
                key={sub.id}
                data-testid="panel-subtask-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  minHeight: 38,
                  padding: '0 12px',
                  borderBottom: `1px solid ${BORDER}`,
                }}
              >
                <button
                  type="button"
                  data-testid="panel-subtask-toggle"
                  onClick={() => toggleTaskComplete(sub.id)}
                  title="Toggle complete"
                  style={{
                    width: 18,
                    height: 18,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    border: `1.5px solid ${done ? '#64c6a2' : sub.statusColor}`,
                    background: done ? '#64c6a2' : 'transparent',
                    color: '#fff',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {done && <CheckIcon size={12} />}
                </button>
                <span
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: TEXT_PRIMARY,
                    textDecoration: done ? 'line-through' : 'none',
                    opacity: done ? 0.6 : 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {sub.name}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '.02em',
                    color: '#fff',
                    background: sub.statusColor,
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                >
                  {sub.status}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        data-testid="panel-add-subtask"
        onClick={addSubtask}
        onMouseDown={(e) => e.preventDefault()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 32,
          padding: '0 12px',
          borderRadius: 6,
          border: `1px dashed ${BORDER}`,
          cursor: 'pointer',
          background: 'transparent',
          color: TEXT_MUTED,
          fontFamily: 'inherit',
          fontSize: 13,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = HOVER_BG)}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <PlusSmallIcon size={14} /> Add Task
      </button>
    </div>
  );
}
