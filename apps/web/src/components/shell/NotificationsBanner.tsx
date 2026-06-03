'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { BellIcon } from '@/components/ui/Icons';

/**
 * Shell-level browser-notification permission banner. Sits above the main page
 * content (right of the sidebar) on the Home experience routes. Matches the
 * page-inbox / home-main oracle: dark strip, bell glyph, copy, Enable / Remind
 * me actions, dismissible via the trailing ×.
 *
 * Copy is read verbatim from the oracle DOM (page-inbox/dom.html):
 *   "ClickUp needs your permission to send notifications"
 */

const BANNER_ROUTE_HINTS = [
  '/home',
  '/my-work',
  '/inbox',
  '/notifications',
  '/chat/r/threads',
  '/chat/r/assigned',
];

function isBannerRoute(pathname: string): boolean {
  return BANNER_ROUTE_HINTS.some((hint) => pathname.includes(hint));
}

export function NotificationsBanner() {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !isBannerRoute(pathname)) return null;

  return (
    <div
      className="flex shrink-0 items-center gap-2 px-4 h-[34px]"
      style={{ background: 'var(--cu-bg-tooltip)' }}
    >
      <BellIcon className="w-3.5 h-3.5 text-white/80" />
      <span className="text-white text-[12px] flex-1 truncate">
        ClickUp needs your permission to send notifications
      </span>
      <button
        type="button"
        className="text-white text-[11px] font-medium px-2 py-1 rounded-[var(--cu-radius-sm)] hover:bg-white/10"
      >
        Enable
      </button>
      <button
        type="button"
        className="text-white/80 text-[11px] px-2 py-1 rounded-[var(--cu-radius-sm)] hover:bg-white/10"
      >
        Remind me
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        className="text-white/70 text-[14px] leading-none px-1.5 hover:text-white"
      >
        ×
      </button>
    </div>
  );
}
