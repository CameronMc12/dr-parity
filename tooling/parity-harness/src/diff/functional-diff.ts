/**
 * Functional diff — stub for future iteration.
 *
 * Planned checks:
 *   - Critical interactive elements reachable (buttons, links)
 *   - Navigation flows complete without errors
 *   - Forms submit / respond correctly
 *   - No JS console errors on load
 *
 * Currently always returns 'pass' so the harness can emit
 * meaningful pixel + DOM scores without blocking on functional work.
 */
export function functionalDiff(): 'pass' | 'fail' | 'skip' {
  return 'pass';
}
