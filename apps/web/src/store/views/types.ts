/**
 * Per-list views store types. The store keeps, per listId, an ordered array of
 * concrete view instances. Lists with NO stored entry are templated on read from
 * `DEFAULT_VIEW_CODES`, so every project shows the default tab set without any
 * seeding.
 */

export interface View {
  /**
   * Instance id used as the URL view-id segment. For default-template instances
   * this equals the listId (so default URLs stay `/<ws>/v/<code>/<listId>`); for
   * extra added instances it is a derived id `<listId>~<code>~<n>`.
   */
  id: string;
  /** View-type code from the view-types registry (l, b, cal, …). */
  code: string;
  /** Display name shown on the tab (defaults to the view-type label). */
  name: string;
  /** Owning list. */
  listId: string;
}

export interface ViewsState {
  /** Stored per-list view instances. Absent keys are templated on read. */
  views: Record<string, View[]>;

  /** Returns the stored OR templated ordered views for a list. Never empty. */
  getListViews: (listId: string) => View[];
  /** Appends a new instance of `code` to a list, persisting the templated set. */
  addView: (listId: string, code: string, name?: string) => View;
  removeView: (listId: string, viewId: string) => void;
  renameView: (listId: string, viewId: string, name: string) => void;
  /** Reorders a list's views to match the given id order. */
  reorderViews: (listId: string, orderedIds: string[]) => void;
  /** Maps a URL view-id segment back to its list + code, or null if unknown. */
  resolveSegment: (seg: string) => { listId: string; code: string } | null;
}
