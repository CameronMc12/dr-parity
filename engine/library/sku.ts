/**
 * SKU generator.
 *
 * SKU format: `sec-<site-id>-<page>-<component-slug>-<3char-hash>`
 *
 * The 3-char hash is base32 of the first 3 chars of sha1(normalised source).
 * Normalisation strips whitespace + comments so trivially-reformatted code
 * keeps the same hash.
 */

import { createHash } from "node:crypto";

const BASE32_ALPHABET = "0123456789abcdefghjkmnpqrstuvwxyz";

export function hashSource(source: string): string {
  const normalised = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim();

  const sha = createHash("sha1").update(normalised).digest();
  // Pack the first 15 bits of the digest (3 * 5) into an int.
  // We need 15 bits total to produce 3 base32 chars (each char = 5 bits).
  const packed = ((sha[0] << 8) | sha[1]) & 0x7fff;

  let out = "";
  let remainder = packed;
  for (let i = 0; i < 3; i++) {
    const idx = remainder & 0x1f;
    out = BASE32_ALPHABET[idx] + out;
    remainder = remainder >> 5;
  }
  return out;
}

export function buildSku(opts: {
  siteId: string;
  page: string;
  componentSlug: string;
  source: string;
}): string {
  const hash = hashSource(opts.source);
  return `sec-${opts.siteId}-${opts.page}-${opts.componentSlug}-${hash}`;
}

export function kebab(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .toLowerCase()
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function humaniseComponentName(filename: string): string {
  const base = filename.replace(/\.tsx?$/, "");
  const stripped = base.replace(/^Section\d+_?/i, "");
  const target = stripped.length > 0 ? stripped : base;
  return target
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
}
