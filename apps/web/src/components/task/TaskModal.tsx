'use client';

import { useEffect } from 'react';
import { useUiStore } from '@/store/ui-store';
import { TaskPanel } from './TaskPanel';

/**
 * Global task-detail modal. When the ui-store holds an `openTaskId`, the task
 * panel content renders as a centered dialog floating over a dimmed backdrop,
 * with the underlying list/page left mounted and visible behind it — matching
 * the real ClickUp task popover. Mounted once at the shell level.
 *
 * Closes on backdrop click, Escape, and the panel's own close (X).
 */
export function TaskModal({ wsId = '90152566819' }: { wsId?: string }) {
  const openTaskId = useUiStore((s) => s.openTaskId);
  const close = useUiStore((s) => s.closeTask);

  useEffect(() => {
    if (!openTaskId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [openTaskId, close]);

  if (!openTaskId) return null;

  return (
    <div
      role="presentation"
      data-testid="task-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10040,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        boxSizing: 'border-box',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Task details"
        data-testid="task-modal"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 1400,
          height: '100%',
          maxHeight: 'calc(100vh - 48px)',
          background: 'var(--cu-bg-app, #111)',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
          border: '1px solid var(--cu-border-divider, #333)',
          overflow: 'hidden',
        }}
      >
        <TaskPanel taskId={openTaskId} wsId={wsId} onClose={close} />
      </div>
    </div>
  );
}
