/**
 * Progress reporting utility with phase timing visibility.
 *
 * Provides structured console output for multi-phase CLI pipelines
 * (extraction, QA, etc.) so operators can see where time is spent.
 */

export class ProgressReporter {
  private readonly startTime: number;
  private phaseStart: number = 0;
  private readonly totalPhases: number;
  private currentPhase: number = 0;

  constructor(totalPhases: number) {
    this.startTime = Date.now();
    this.totalPhases = totalPhases;
  }

  /** Begin a new numbered phase. Writes the label without a newline. */
  startPhase(label: string): void {
    this.currentPhase++;
    this.phaseStart = Date.now();
    process.stdout.write(
      `  [${this.currentPhase}/${this.totalPhases}] ${label}...`,
    );
  }

  /** Mark the current phase as successfully completed. */
  endPhase(details?: string): void {
    const formatted = this.formatDuration(Date.now() - this.phaseStart);
    const suffix = details ? ` \u2014 ${details}` : '';
    console.log(` \u2713 (${formatted})${suffix}`);
  }

  /** Mark the current phase as failed. */
  failPhase(error: string): void {
    const formatted = this.formatDuration(Date.now() - this.phaseStart);
    console.log(` \u2717 (${formatted}) \u2014 ${error}`);
  }

  /** Print the total elapsed time summary. */
  summary(): void {
    const formatted = this.formatDuration(Date.now() - this.startTime);
    console.log(`\n  Total: ${formatted}`);
  }

  /** Number of phases completed so far. */
  get completed(): number {
    return this.currentPhase;
  }

  /** Elapsed wall-clock time in milliseconds since construction. */
  get elapsedMs(): number {
    return Date.now() - this.startTime;
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private formatDuration(ms: number): string {
    return ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
  }
}
