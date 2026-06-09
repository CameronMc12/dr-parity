#!/usr/bin/env tsx
/**
 * Seed view-type creator (Part 2).
 *
 * Ensures the DR-PARITY-SEED Backlog list exposes one view of each type the
 * crawler needs (board / calendar / gantt / timeline / table) via the ClickUp
 * public API v2. Idempotent: existing views of a type are skipped. Created view
 * ids are written to docs/research/clickup-parity/seed/seed-views.json.
 *
 * Auth: CLICKUP_API_TOKEN env var (never written to a file).
 *
 * Usage:
 *   CLICKUP_API_TOKEN=pk_... npm run seed:views
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const API = 'https://api.clickup.com/api/v2';
const SEED_LIST_ID = '901523751540'; // DR-PARITY-SEED > Product > Backlog
const OUT_PATH = 'docs/research/clickup-parity/seed/seed-views.json';

/** View types to ensure. Order = creation order. */
const TARGET_TYPES = ['board', 'calendar', 'gantt', 'timeline', 'table'] as const;
type ViewType = (typeof TARGET_TYPES)[number];

type ClickUpView = { id: string; name: string; type: string };

type ViewRecord = {
  type: ViewType;
  status: 'existing' | 'created' | 'gap';
  id: string | null;
  name: string | null;
  note?: string;
};

function token(): string {
  const t = process.env.CLICKUP_API_TOKEN;
  if (!t) {
    throw new Error('CLICKUP_API_TOKEN is not set in the environment.');
  }
  return t;
}

async function listViews(listId: string): Promise<ClickUpView[]> {
  const res = await fetch(`${API}/list/${listId}/view`, {
    headers: { Authorization: token() },
  });
  if (!res.ok) {
    throw new Error(`GET list views failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { views?: ClickUpView[] };
  return json.views ?? [];
}

/** Minimal required body. ClickUp accepts empty nested objects. */
function createBody(type: ViewType): Record<string, unknown> {
  const label = type.charAt(0).toUpperCase() + type.slice(1);
  return {
    name: `DR Parity ${label}`,
    type,
    grouping: {},
    divide: {},
    sorting: {},
    filters: {},
    columns: {},
    team_sidebar: {},
    settings: {},
  };
}

async function createView(
  listId: string,
  type: ViewType,
): Promise<{ ok: true; view: ClickUpView } | { ok: false; error: string }> {
  const res = await fetch(`${API}/list/${listId}/view`, {
    method: 'POST',
    headers: { Authorization: token(), 'Content-Type': 'application/json' },
    body: JSON.stringify(createBody(type)),
  });
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, error: `${res.status} ${text}` };
  }
  let parsed: { view?: ClickUpView };
  try {
    parsed = JSON.parse(text) as { view?: ClickUpView };
  } catch {
    return { ok: false, error: `unparseable response: ${text.slice(0, 200)}` };
  }
  if (!parsed.view?.id) {
    return { ok: false, error: `no view in response: ${text.slice(0, 200)}` };
  }
  return { ok: true, view: parsed.view };
}

async function main(): Promise<void> {
  token(); // fail fast if unset

  const existing = await listViews(SEED_LIST_ID);
  const byType = new Map<string, ClickUpView>();
  for (const v of existing) {
    if (!byType.has(v.type)) byType.set(v.type, v);
  }

  const records: ViewRecord[] = [];

  for (const type of TARGET_TYPES) {
    const found = byType.get(type);
    if (found) {
      records.push({ type, status: 'existing', id: found.id, name: found.name });
      console.log(`[seed-views] ${type}: existing ${found.id} (${found.name})`);
      continue;
    }

    const result = await createView(SEED_LIST_ID, type);
    if (result.ok) {
      records.push({
        type,
        status: 'created',
        id: result.view.id,
        name: result.view.name,
      });
      console.log(`[seed-views] ${type}: created ${result.view.id}`);
    } else {
      records.push({
        type,
        status: 'gap',
        id: null,
        name: null,
        note: `not creatable via public API: ${result.error}`,
      });
      console.warn(`[seed-views] ${type}: GAP — ${result.error}`);
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    listId: SEED_LIST_ID,
    views: records,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`[seed-views] wrote ${OUT_PATH}`);
}

main().catch((err) => {
  console.error('[seed-views] FATAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
