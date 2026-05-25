import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const V2_BASE = "https://api.clickup.com/api/v2";
const V3_BASE = "https://api.clickup.com/api/v3";

const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1000;
const INTER_REQUEST_DELAY_MS = 650;

const RETRYABLE_NET_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "EPIPE",
  "ENOTFOUND",
  "UND_ERR_SOCKET",
]);

export interface ClickUpConfig {
  token: string;
  teamId: string;
}

export interface CallRecord {
  method: string;
  pathTemplate: string;
  returns: string;
  count: number;
  sample: unknown;
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

export function loadConfig(envPath = resolve(process.cwd(), ".clickup.env")): ClickUpConfig {
  const raw = readFileSync(envPath, "utf8");
  const map: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    map[key] = value;
  }
  const token = map.CLICKUP_TOKEN;
  const teamId = map.CLICKUP_TEAM_ID;
  if (!token) throw new Error("CLICKUP_TOKEN missing from .clickup.env");
  if (!teamId) throw new Error("CLICKUP_TEAM_ID missing from .clickup.env");
  return { token, teamId };
}

function extractNetCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code ?? e.cause?.code;
}

/**
 * Fetch JSON with exponential backoff. Retries on 429 (Retry-After aware),
 * 5xx, and socket-level errors. Throws on non-retryable 4xx after surfacing status.
 */
export async function fetchJson<T = unknown>(
  url: string,
  token: string,
): Promise<{ ok: true; data: T } | { ok: false; status: number; body: string }> {
  let attempt = 0;
  while (true) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: token, "Content-Type": "application/json" },
      });

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : BASE_BACKOFF_MS * 2 ** attempt;
        if (attempt >= MAX_RETRIES) {
          return { ok: false, status: 429, body: "rate limited (max retries)" };
        }
        attempt += 1;
        await sleep(waitMs);
        continue;
      }

      if (res.status >= 500) {
        if (attempt >= MAX_RETRIES) {
          return { ok: false, status: res.status, body: await safeBody(res) };
        }
        attempt += 1;
        await sleep(BASE_BACKOFF_MS * 2 ** attempt + Math.random() * 250);
        continue;
      }

      if (!res.ok) {
        return { ok: false, status: res.status, body: await safeBody(res) };
      }

      const data = (await res.json()) as T;
      return { ok: true, data };
    } catch (err) {
      const code = extractNetCode(err);
      const retryable = code ? RETRYABLE_NET_CODES.has(code) : false;
      if (!retryable || attempt >= MAX_RETRIES) {
        return {
          ok: false,
          status: 0,
          body: `network error: ${code ?? (err as Error).message}`,
        };
      }
      attempt += 1;
      await sleep(BASE_BACKOFF_MS * 2 ** attempt + Math.random() * 250);
    }
  }
}

async function safeBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "<unreadable body>";
  }
}

export function v2(path: string): string {
  return `${V2_BASE}${path}`;
}

export function v3(path: string): string {
  return `${V3_BASE}${path}`;
}

export async function throttle(): Promise<void> {
  await sleep(INTER_REQUEST_DELAY_MS);
}
