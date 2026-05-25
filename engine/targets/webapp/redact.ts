/**
 * Shared redaction utilities for the webapp target. Captured network traffic
 * routinely contains live JWTs, bearer tokens, cookies, and session data. We
 * scrub those before baking fixtures/handlers/spec output so secrets are never
 * committed to a generated clone.
 *
 * Two entry points:
 *   redactString  — scrub a raw string (JSON payloads are passed as strings).
 *   redactSecrets — deep-clone a value, redact secret-keyed properties, and
 *                   run every string value through redactString.
 */

const REDACTED = '[REDACTED]';

// JWT: three base64url segments separated by dots, leading `eyJ`.
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

// `Bearer <token>` / `Token <token>` style values.
const BEARER_PATTERN = /\b(Bearer|Token)\s+[A-Za-z0-9._~+/=-]{12,}/gi;

// Long opaque token-ish substrings (hex/base64url) that are likely secrets.
const LONG_TOKEN_PATTERN = /\b[A-Za-z0-9_-]{40,}\b/g;

const SECRET_KEY_PATTERN =
  /authorization|auth[-_]?token|access[-_]?token|refresh[-_]?token|\btoken\b|cookie|set-cookie|secret|password|passwd|jwt|api[-_]?key|session[-_]?token|x-csrf/i;

export function redactString(s: string): string {
  if (s.length === 0) return s;
  return s
    .replace(JWT_PATTERN, REDACTED)
    .replace(BEARER_PATTERN, (_match, scheme: string) => `${scheme} ${REDACTED}`)
    .replace(LONG_TOKEN_PATTERN, REDACTED);
}

function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key);
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') return redactString(value);
  if (value === null || typeof value !== 'object') return value;

  if (seen.has(value as object)) return REDACTED;
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (isSecretKey(key)) {
      out[key] = REDACTED;
      continue;
    }
    out[key] = redactValue(val, seen);
  }
  return out;
}

export function redactSecrets<T>(value: T): T {
  try {
    return redactValue(value, new WeakSet<object>()) as T;
  } catch {
    return value;
  }
}
