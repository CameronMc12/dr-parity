'use client';

/**
 * Whiteboard view. A freeform infinite canvas seeded on first mount from the
 * list's real top-level tasks (one pastel, status-coloured sticky per task in a
 * tidy grid) plus a title text element carrying the list name. A bottom-center
 * floating tool palette creates task cards / stickies / shapes / text / frames /
 * images / connectors; Select moves elements and pans, Hand pans, the wheel
 * zooms. A top-right presence cluster carries the current user, collaborators,
 * Fullscreen and a board-settings gear (background + theme); a bottom-left
 * control drives zoom.
 *
 * Shared chrome (breadcrumb + tab strip) comes from `ViewShell`; the area below
 * it is the whiteboard canvas directly (no task view toolbar — ClickUp's
 * Whiteboard view has none). All element + viewport + board-settings state is
 * local and memoized — no store writes from the canvas, no render loops.
 *
 * Route: /<wsId>/v/wb/:viewId  ->  <WhiteboardView viewId=… />
 * Owns the whole `whiteboard/` folder; sources task data through `@/lib/view-data`.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { resolveViewListId, useViewTasks } from '@/lib/view-data';
import type { ViewScope } from '@/lib/view-scope';
import { useScopeListToken } from '@/lib/view-scope';
import { useTaskContextMenu } from '@/components/menus/useTaskContextMenu';
import { ViewShell } from '@/components/views/ViewShell';
import { useWorkspaceStore, workspaceSelectors } from '@/store/workspace';
import type { Task } from '@/store/workspace/types';
import { AiPanel } from './AiPanel';
import { WhiteboardCanvas } from './WhiteboardCanvas';
import { WhiteboardToolbar } from './WhiteboardToolbar';
import { ZoomControl } from './ZoomControl';
import { PresenceCluster, type BoardTheme } from './PresenceCluster';
import { useCanvasViewport, type ContentBounds } from './useCanvasViewport';
import { useWhiteboard } from './useWhiteboard';
import { hasBox, type BoardBackground, type ShapeVariant, type ToolId, type WhiteboardElement } from './types';

function useListName(listId: string): string {
  return useWorkspaceStore(
    (s) => workspaceSelectors.findList(s, listId)?.list?.name ?? 'Whiteboard',
  );
}

/** Board-space bounding box over every element, or null when empty. */
function contentBounds(elements: WhiteboardElement[]): ContentBounds | null {
  if (elements.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    if (hasBox(el)) {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.w);
      maxY = Math.max(maxY, el.y + el.h);
    } else {
      minX = Math.min(minX, el.x, el.x2);
      minY = Math.min(minY, el.y, el.y2);
      maxX = Math.max(maxX, el.x, el.x2);
      maxY = Math.max(maxY, el.y, el.y2);
    }
  }
  return { minX, minY, maxX, maxY };
}

export function WhiteboardView({ viewId, scope }: { viewId: string; scope?: ViewScope }) {
  const effectiveScope: ViewScope = scope ?? { kind: 'list', listId: resolveViewListId(viewId) };
  // The canvas is seeded from a concrete list's tasks (the scope's default list).
  const dataToken = useScopeListToken(effectiveScope, viewId);
  const listId = resolveViewListId(dataToken);
  const tasks = useViewTasks(dataToken);
  const listName = useListName(listId);

  const seed = useMemo(() => ({ tasks, listName }), [tasks, listName]);
  const board = useWhiteboard(seed);
  const vp = useCanvasViewport();

  const stageRef = useRef<HTMLDivElement>(null);

  const taskFor = useCallback(
    (id: string): Task | null =>
      useWorkspaceStore.getState().tasks[id] ?? null,
    [],
  );

  const { onContextMenu, menu } = useTaskContextMenu();

  const [activeTool, setActiveTool] = useState<ToolId>('select');
  const [shapeVariant, setShapeVariant] = useState<ShapeVariant>('rect');
  const [background, setBackground] = useState<BoardBackground>('dots');
  const [theme, setTheme] = useState<BoardTheme>('dark');
  const [aiOpen, setAiOpen] = useState(false);

  const resetToSelect = useCallback(() => setActiveTool('select'), []);

  const stageSize = useCallback(() => {
    const rect = stageRef.current?.getBoundingClientRect();
    return { w: rect?.width ?? 0, h: rect?.height ?? 0 };
  }, []);

  const onZoomIn = useCallback(() => {
    const { w, h } = stageSize();
    vp.zoomStep(1, w / 2, h / 2);
  }, [vp, stageSize]);

  const onZoomOut = useCallback(() => {
    const { w, h } = stageSize();
    vp.zoomStep(-1, w / 2, h / 2);
  }, [vp, stageSize]);

  const onFitContent = useCallback(() => {
    const bounds = contentBounds(board.elements);
    const { w, h } = stageSize();
    if (!bounds) {
      vp.reset();
      return;
    }
    vp.fitToContent(bounds, w, h);
  }, [board.elements, vp, stageSize]);

  const onAi = useCallback(() => setAiOpen(true), []);

  const onGenerate = useCallback(
    (labels: string[]) => {
      const at = vp.toBoard(stageSize().w / 2, stageSize().h / 2);
      board.addStickies(labels, at.x, at.y);
    },
    [board, vp, stageSize],
  );

  return (
    <ViewShell code="wb" viewId={viewId} scope={scope}>
      <div
        ref={stageRef}
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <WhiteboardCanvas
          board={board}
          vp={vp}
          activeTool={activeTool}
          background={background}
          theme={theme}
          onToolUsed={resetToSelect}
          onContextMenu={onContextMenu}
          taskFor={taskFor}
        />
        <PresenceCluster
          background={background}
          theme={theme}
          onBackground={setBackground}
          onTheme={setTheme}
          fullscreenTarget={stageRef}
        />
        <WhiteboardToolbar
          activeTool={activeTool}
          shapeVariant={shapeVariant}
          onSelectTool={setActiveTool}
          onSelectShape={setShapeVariant}
          onAi={onAi}
          onUndo={board.undo}
          onRedo={board.redo}
          canUndo={board.canUndo}
          canRedo={board.canRedo}
        />
        <ZoomControl
          zoomPct={vp.viewport.zoom * 100}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onResetView={vp.reset}
          onFitContent={onFitContent}
        />
        <AiPanel
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          onGenerate={onGenerate}
        />
        {menu}
      </div>
    </ViewShell>
  );
}
