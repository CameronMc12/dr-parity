/** ClickUp-style tag colour palette. Used by the tag picker + chips. */
export const TAG_COLORS: string[] = [
  '#e44332', // red
  '#ff7800', // orange
  '#f9c80e', // yellow
  '#6bc950', // green
  '#1bbc9c', // teal
  '#3db1ff', // blue
  '#7b68ee', // indigo
  '#e040fb', // magenta
  '#ff6f91', // pink
  '#87909e', // grey
];

/** Deterministic colour for a tag name (so chips stay stable per name). */
export function colorForTag(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return TAG_COLORS[hash % TAG_COLORS.length] ?? '#87909e';
}
