'use client';

import { useState } from 'react';
import { useWorkspaceStore } from '@/store/workspace';
import type { Task } from '@/store/workspace/types';
import { Popover } from './Popover';
import { EllipsisIcon, LinkIcon, CloseIcon } from './icons';

const TEXT_MUTED = 'var(--cu-text-muted, #7b7b7b)';
const TEXT_PRIMARY = 'var(--cu-text-primary, #eee)';
const HOVER_BG = 'var(--cu-bg-hover, #2a2a2a)';

function taskLink(task: Task): string {
  if (typeof window === 'undefined') return `/t/${task.id}`;
  return `${window.location.origin}/t/${task.id}`;
}

async function copyLink(task: Task): Promise<boolean> {
  const url = taskLink(task);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Copy-link button — copies `/t/<id>` and flashes a confirmation. */
export function CopyLinkButton({ task }: { task: Task }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      data-testid="panel-copy-link"
      title={copied ? 'Link copied' : 'Copy link'}
      aria-label="Copy link"
      onClick={async () => {
        if (await copyLink(task)) {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        }
      }}
      style={iconBtn(copied ? 'var(--cu-accent, #7b68ee)' : TEXT_MUTED)}
    >
      <LinkIcon size={16} />
    </button>
  );
}

/** "..." more menu — copy link + delete task. */
export function MoreMenu({ task, onClose }: { task: Task; onClose: () => void }) {
  const deleteTask = useWorkspaceStore((s) => s.deleteTask);

  return (
    <Popover
      width={200}
      align="right"
      trigger={({ onClick, open }) => (
        <button
          type="button"
          data-testid="panel-more-menu"
          aria-label="More"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={onClick}
          style={iconBtn(TEXT_MUTED)}
        >
          <EllipsisIcon />
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuItem
            onClick={async () => {
              await copyLink(task);
              close();
            }}
            testid="panel-menu-copy-link"
          >
            <LinkIcon size={15} /> Copy link
          </MenuItem>
          <div style={{ height: 1, background: 'var(--cu-border-divider, #333)', margin: '4px 0' }} />
          <MenuItem
            danger
            onClick={() => {
              close();
              deleteTask(task.id);
              onClose();
            }}
            testid="panel-menu-delete"
          >
            <CloseIcon size={15} /> Delete task
          </MenuItem>
        </>
      )}
    </Popover>
  );
}

function MenuItem({
  children,
  onClick,
  danger,
  testid,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  testid?: string;
}) {
  const [hover, setHover] = useState(false);
  const color = danger ? '#e23f29' : TEXT_PRIMARY;
  return (
    <button
      type="button"
      role="menuitem"
      data-testid={testid}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 12px',
        height: 34,
        background: hover ? HOVER_BG : 'transparent',
        border: 'none',
        cursor: 'pointer',
        color,
        fontSize: 13,
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

function iconBtn(color: string): React.CSSProperties {
  return {
    width: 30,
    height: 30,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    background: 'transparent',
    color,
  };
}
