/**
 * Per-scope views store types. The store keeps, per scopeKey, an ordered array of
 * concrete view instances. A scopeKey is `scopeKey(scope)` from view-scope.ts:
 * the raw listId for a single-list scope, or `space:<id>` / `folder:<id>` for a
 * space/folder scope. Scopes with NO stored entry are templated on read from
 * `DEFAULT_VIEW_CODES`, so every list, space, and folder shows the default tab
 * set without any seeding.
 */

export interface View {
  /**
   * Instance id used as the URL view-id segment. For default-template instances
   * this equals the scopeKey (so default list URLs stay `/<ws>/v/<code>/<listId>`);
   * for extra added instances it is a derived id `<scopeKey>~<code>~<n>`.
   */
  id: string;
  /** View-type code from the view-types registry (l, b, cal, …). */
  code: string;
  /** Display name shown on the tab (defaults to the view-type label). */
  name: string;
  /**
   * Owning scope key. For a single-list scope this equals the listId — byte
   * identical to the prior `listId` field — so list routes are unchanged.
   */
  scopeKey: string;
  /**
   * Back-compat alias retained so existing list call sites (e.g. TabContextMenu
   * `view.listId`) keep working. For a list scope this is the listId; for a
   * space/folder scope it equals `scopeKey`.
   */
  listId: string;
}

export interface ViewsState {
  /** Stored per-scope view instances, keyed by scopeKey. Absent keys templated. */
  views: Record<string, View[]>;

  /** Returns the stored OR templated ordered views for a scopeKey. Never empty. */
  getScopeViews: (scopeKey: string) => View[];
  /**
   * Back-compat alias of `getScopeViews`. For a single-list scope the scopeKey
   * IS the listId, so existing sidebar call sites keep working unchanged.
   */
  getListViews: (listId: string) => View[];
  /** Appends a new instance of `code` to a scope, persisting the templated set. */
  addView: (scopeKey: string, code: string, name?: string) => View;
  removeView: (scopeKey: string, viewId: string) => void;
  renameView: (scopeKey: string, viewId: string, name: string) => void;
  /** Reorders a scope's views to match the given id order. */
  reorderViews: (scopeKey: string, orderedIds: string[]) => void;
  /** Maps a URL view-id segment back to its scopeKey + code, or null if unknown. */
  resolveSegment: (seg: string) => { scopeKey: string; code: string } | null;
}
