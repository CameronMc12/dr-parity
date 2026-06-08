/**
 * Shared types for the global search engine. A SearchResult is a normalised,
 * rankable hit across every searchable entity (task, list, folder, space, doc,
 * person). The engine produces these; the UI groups and renders them.
 */

export type SearchKind = 'task' | 'list' | 'folder' | 'space' | 'doc' | 'person';

/** A contiguous run of characters that matched the query, for highlighting. */
export interface MatchRange {
  start: number;
  end: number;
}

export interface SearchResult {
  /** Stable id of the underlying entity. */
  id: string;
  kind: SearchKind;
  /** Primary label shown in the result row. */
  title: string;
  /** Secondary line (status, location, email, etc.). May be empty. */
  subtitle: string;
  /** Matched ranges within `title`, for substring highlighting. */
  ranges: MatchRange[];
  /** Higher is better. Used to order within and across groups. */
  score: number;
  /** Optional accent colour (status/space colour) for the leading glyph. */
  color?: string;
  /** Optional initials (people) for an avatar chip. */
  initials?: string;
}

/** A labelled bucket of results of a single kind. */
export interface SearchGroup {
  kind: SearchKind;
  label: string;
  results: SearchResult[];
}
