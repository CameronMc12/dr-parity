/**
 * Tiny shared filesystem helpers for the webapp scaffold writers. Kept in
 * one place so each scaffold module stays focused on its own emission.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function ensureDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

export function writeText(filePath: string, content: string): void {
  ensureDir(filePath);
  writeFileSync(filePath, content, 'utf8');
}

export function writeTextIfMissing(filePath: string, content: string): boolean {
  if (existsSync(filePath)) return false;
  writeText(filePath, content);
  return true;
}
