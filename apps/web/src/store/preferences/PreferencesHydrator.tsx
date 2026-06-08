'use client';

/**
 * Client-only hydrator for the persisted preferences store. The store uses
 * persist({ skipHydration: true }) so SSR renders deterministic defaults; this
 * triggers rehydration once on the client to swap in any persisted edits, then
 * applies the resolved theme as a data attribute on documentElement.
 *
 * This component owns theme application via `data-parity-theme` /
 * `data-parity-density` attributes on <html> — it does NOT edit global layout or
 * AppShell. Subscribes to appearance changes so live edits reflect immediately.
 */

import { useEffect } from 'react';
import { usePreferencesStore } from './index';
import type { Theme } from './types';

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  }
  return theme;
}

function applyAppearance(): void {
  if (typeof document === 'undefined') return;
  const { appearance } = usePreferencesStore.getState();
  const root = document.documentElement;
  const resolved = resolveTheme(appearance.theme);
  root.setAttribute('data-parity-theme', resolved);
  // tokens.css keys the dark palette on [data-theme="dark"]; keep both in sync.
  root.setAttribute('data-theme', resolved);
  root.style.colorScheme = resolved;
  root.setAttribute('data-parity-density', appearance.sidebarDensity);
}

export function PreferencesHydrator() {
  useEffect(() => {
    void Promise.resolve(usePreferencesStore.persist.rehydrate()).then(() => {
      applyAppearance();
    });
    const unsub = usePreferencesStore.subscribe(applyAppearance);
    return () => unsub();
  }, []);
  return null;
}
