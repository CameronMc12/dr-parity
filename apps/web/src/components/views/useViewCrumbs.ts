'use client';

/**
 * Shared breadcrumb resolver for every templated view. Resolves a listId to its
 * space / folder / list path via the same `findList` selector the List, Board,
 * Calendar, and Gantt views use, returning the `Crumb[]` the shared `Breadcrumb`
 * renders. Falls back to a single labelled crumb when the list is unknown.
 */

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore, workspaceSelectors } from '@/store/workspace';
import type { ViewScope } from '@/lib/view-scope';

const SPACE_GLYPH = '▣';
const LIST_GLYPH = '☰';
const SPACE_COLOR = '#4ecdc4';
const FOLDER_COLOR = '#7b7b7b';

export interface Crumb {
  label: string;
  glyph: string;
  color: string;
}

export function useViewCrumbs(listId: string, fallbackLabel: string): Crumb[] {
  const { spaceName, spaceColor, folderName, listName } = useWorkspaceStore(
    useShallow((s) => {
      const resolved = workspaceSelectors.findList(s, listId);
      return {
        spaceName: resolved?.space.name ?? null,
        spaceColor: resolved?.space.color ?? null,
        folderName: resolved?.folder?.name ?? null,
        listName: resolved?.list?.name ?? null,
      };
    }),
  );

  return useMemo<Crumb[]>(() => {
    if (!spaceName) return [{ label: fallbackLabel, glyph: LIST_GLYPH, color: FOLDER_COLOR }];
    const out: Crumb[] = [
      { label: spaceName, glyph: SPACE_GLYPH, color: spaceColor || SPACE_COLOR },
    ];
    if (folderName) out.push({ label: folderName, glyph: SPACE_GLYPH, color: FOLDER_COLOR });
    if (listName) out.push({ label: listName, glyph: LIST_GLYPH, color: FOLDER_COLOR });
    return out;
  }, [spaceName, spaceColor, folderName, listName, fallbackLabel]);
}

/** Crumb path for a space-scoped view: just the space itself. */
export function useSpaceCrumbs(spaceId: string): Crumb[] {
  const { spaceName, spaceColor } = useWorkspaceStore(
    useShallow((s) => {
      const space = workspaceSelectors.spaces(s).find((sp) => sp.id === spaceId);
      return {
        spaceName: space?.name ?? null,
        spaceColor: space?.color ?? null,
      };
    }),
  );

  return useMemo<Crumb[]>(() => {
    if (!spaceName) return [];
    return [{ label: spaceName, glyph: SPACE_GLYPH, color: spaceColor || SPACE_COLOR }];
  }, [spaceName, spaceColor]);
}

/** Crumb path for a folder-scoped view: space then folder. */
export function useFolderCrumbs(folderId: string): Crumb[] {
  const { spaceName, spaceColor, folderName } = useWorkspaceStore(
    useShallow((s) => {
      for (const space of workspaceSelectors.spaces(s)) {
        const folder = space.folders.find((f) => f.id === folderId);
        if (folder) {
          return {
            spaceName: space.name,
            spaceColor: space.color,
            folderName: folder.name,
          };
        }
      }
      return { spaceName: null, spaceColor: null, folderName: null };
    }),
  );

  return useMemo<Crumb[]>(() => {
    if (!spaceName || !folderName) return [];
    return [
      { label: spaceName, glyph: SPACE_GLYPH, color: spaceColor || SPACE_COLOR },
      { label: folderName, glyph: SPACE_GLYPH, color: FOLDER_COLOR },
    ];
  }, [spaceName, spaceColor, folderName]);
}

/**
 * Unified crumb resolver for any scope. ONE store read; the scope kind is
 * branched on INSIDE the selector (never via conditional hook calls), so the
 * rules of hooks hold for every scope. Mirrors the per-kind hooks above:
 *  - list   -> space › folder? › list (or the fallback label when unknown)
 *  - space  -> space
 *  - folder -> space › folder
 */
export function useScopeCrumbs(scope: ViewScope, fallbackLabel: string): Crumb[] {
  const resolved = useWorkspaceStore(
    useShallow((s) => {
      switch (scope.kind) {
        case 'list': {
          const found = workspaceSelectors.findList(s, scope.listId);
          return {
            spaceName: found?.space.name ?? null,
            spaceColor: found?.space.color ?? null,
            folderName: found?.folder?.name ?? null,
            listName: found?.list?.name ?? null,
          };
        }
        case 'space': {
          const space = workspaceSelectors.spaces(s).find((sp) => sp.id === scope.spaceId);
          return {
            spaceName: space?.name ?? null,
            spaceColor: space?.color ?? null,
            folderName: null,
            listName: null,
          };
        }
        case 'folder': {
          for (const space of workspaceSelectors.spaces(s)) {
            const folder = space.folders.find((f) => f.id === scope.folderId);
            if (folder) {
              return {
                spaceName: space.name,
                spaceColor: space.color,
                folderName: folder.name,
                listName: null,
              };
            }
          }
          return { spaceName: null, spaceColor: null, folderName: null, listName: null };
        }
      }
    }),
  );

  const { spaceName, spaceColor, folderName, listName } = resolved;
  return useMemo<Crumb[]>(() => {
    if (!spaceName) {
      return scope.kind === 'list'
        ? [{ label: fallbackLabel, glyph: LIST_GLYPH, color: FOLDER_COLOR }]
        : [];
    }
    const out: Crumb[] = [
      { label: spaceName, glyph: SPACE_GLYPH, color: spaceColor || SPACE_COLOR },
    ];
    if (folderName) out.push({ label: folderName, glyph: SPACE_GLYPH, color: FOLDER_COLOR });
    if (listName) out.push({ label: listName, glyph: LIST_GLYPH, color: FOLDER_COLOR });
    return out;
  }, [spaceName, spaceColor, folderName, listName, fallbackLabel, scope.kind]);
}
