/**
 * Checkpoint manager — enables resuming a failed extraction run.
 *
 * Each completed phase is persisted to `.checkpoint.json` so that a
 * subsequent `--resume` invocation can skip already-finished work.
 */

import { readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';

export type ExtractionPhase =
  | 'scan'
  | 'animations'
  | 'fonts'
  | 'assets'
  | 'stylesheets'
  | 'interactions'
  | 'screenshots'
  | 'merge'
  | 'prompts';

export interface CheckpointState {
  readonly url: string;
  completedPhases: ExtractionPhase[];
  phaseData: Partial<Record<ExtractionPhase, unknown>>;
  lastUpdated: number;
}

export class CheckpointManager {
  private readonly checkpointPath: string;
  private state: CheckpointState;

  constructor(outputDir: string, url: string) {
    this.checkpointPath = join(outputDir, '.checkpoint.json');
    this.state = {
      url,
      completedPhases: [],
      phaseData: {},
      lastUpdated: Date.now(),
    };
  }

  /** Load an existing checkpoint. Returns true if a valid one was found. */
  async load(): Promise<boolean> {
    try {
      const content = await readFile(this.checkpointPath, 'utf-8');
      const saved: CheckpointState = JSON.parse(content);
      if (saved.url === this.state.url) {
        this.state = saved;
        return true;
      }
      return false; // Different URL — start fresh
    } catch {
      return false;
    }
  }

  isCompleted(phase: ExtractionPhase): boolean {
    return this.state.completedPhases.includes(phase);
  }

  getPhaseData<T>(phase: ExtractionPhase): T | null {
    return (this.state.phaseData[phase] as T) ?? null;
  }

  get completedPhases(): readonly ExtractionPhase[] {
    return this.state.completedPhases;
  }

  async markCompleted(phase: ExtractionPhase, data?: unknown): Promise<void> {
    if (!this.state.completedPhases.includes(phase)) {
      this.state.completedPhases.push(phase);
    }
    if (data !== undefined) {
      this.state.phaseData[phase] = data;
    }
    this.state.lastUpdated = Date.now();
    await this.save();
  }

  async save(): Promise<void> {
    await mkdir(join(this.checkpointPath, '..'), { recursive: true });
    await writeFile(
      this.checkpointPath,
      JSON.stringify(this.state, null, 2),
      'utf-8',
    );
  }

  async clear(): Promise<void> {
    await unlink(this.checkpointPath).catch(() => {});
  }
}
