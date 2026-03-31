/**
 * Extraction caching — stores phase results on disk to avoid re-extraction.
 *
 * Cache entries expire after 1 hour by default. Pass `--no-cache` to the
 * extract CLI to bypass.
 */

import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { createHash } from 'crypto';
import { join } from 'path';

export interface CacheEntry {
  readonly url: string;
  readonly urlHash: string;
  readonly timestamp: number;
  readonly phase: string;
  readonly data: unknown;
}

const DEFAULT_TTL_MS = 3_600_000; // 1 hour

export class ExtractionCache {
  private readonly cacheDir: string;
  private readonly ttlMs: number;

  constructor(projectDir: string, ttlMs = DEFAULT_TTL_MS) {
    this.cacheDir = join(projectDir, 'docs', 'research', '.cache');
    this.ttlMs = ttlMs;
  }

  private hashUrl(url: string): string {
    return createHash('sha256').update(url).digest('hex').slice(0, 12);
  }

  private entryPath(url: string, phase: string): string {
    const hash = this.hashUrl(url);
    return join(this.cacheDir, `${hash}-${phase}.json`);
  }

  async initialize(): Promise<void> {
    await mkdir(this.cacheDir, { recursive: true });
  }

  async get<T>(url: string, phase: string): Promise<T | null> {
    const path = this.entryPath(url, phase);
    try {
      const content = await readFile(path, 'utf-8');
      const entry: CacheEntry = JSON.parse(content);
      if (Date.now() - entry.timestamp > this.ttlMs) return null;
      return entry.data as T;
    } catch {
      return null;
    }
  }

  async set(url: string, phase: string, data: unknown): Promise<void> {
    const hash = this.hashUrl(url);
    const entry: CacheEntry = {
      url,
      urlHash: hash,
      timestamp: Date.now(),
      phase,
      data,
    };
    const path = this.entryPath(url, phase);
    await writeFile(path, JSON.stringify(entry), 'utf-8');
  }

  async hasValidCache(url: string, phase: string): Promise<boolean> {
    return (await this.get(url, phase)) !== null;
  }

  async clearAll(): Promise<void> {
    await rm(this.cacheDir, { recursive: true, force: true });
    await this.initialize();
  }
}
