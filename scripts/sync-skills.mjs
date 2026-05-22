#!/usr/bin/env node

/**
 * Generates clone-website command/skill files for all supported AI coding platforms.
 * Source of truth: .claude/skills/clone-website/SKILL.md
 *
 * Usage: node scripts/sync-skills.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, '.claude', 'skills', 'clone-website', 'SKILL.md');

// --- Parse source skill ---

let raw;
try {
  raw = readFileSync(SOURCE, 'utf8').replace(/\r\n/g, '\n');
} catch {
  console.error(`Error: Source skill not found at .claude/skills/clone-website/SKILL.md`);
  process.exit(1);
}

const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
if (!match) {
  console.error('Error: Could not parse SKILL.md frontmatter');
  process.exit(1);
}

const body = match[2];
const shortDesc = 'Reverse-engineer and clone any website as a pixel-perfect replica';

// --- Helpers ---

function write(relPath, content) {
  const full = join(ROOT, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf8');
  console.log(`  \u2713 ${relPath}`);
}

const HEADER =
  '<!-- AUTO-GENERATED from .claude/skills/clone-website/SKILL.md \u2014 do not edit directly.\n' +
  '     Run `node scripts/sync-skills.mjs` to regenerate. -->\n\n';

const noArgs = (text) => text.replace(/\$ARGUMENTS/g, 'the target URL provided by the user');

// --- Generate ---

console.log('Syncing clone-website skill to all platforms...');
console.log(`  Source: .claude/skills/clone-website/SKILL.md\n`);

// Only regenerate skill copies for platforms that still live in this repo.
// The other AI-tool configs were intentionally pruned in commit 3b4efd2
// and must not be resurrected by this sync.

// GitHub Copilot — same SKILL.md format
write('.github/skills/clone-website/SKILL.md', raw);

// Mark unused variables so lint stays clean if anyone re-enables platforms later.
void shortDesc;
void HEADER;
void noArgs;

console.log('\nDone! 1 platform command file generated from source skill.');
