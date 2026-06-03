'use client';

/**
 * Mind Map view. A pannable, zoomable node graph of the list's task hierarchy:
 * root (list) -> top-level tasks -> subtasks. Nodes are status-coloured cards
 * connected by smooth bezier curves on a transformed (translate + scale) canvas.
 * Drag empty space to pan; wheel or the +/-/fit controls to zoom. Click a node
 * to open it, hover for a "+" to add a child, right-click for the task menu.
 *
 * Owns the whole `mindmap/` folder; sources all data through `@/lib/view-data`.
 * Route: /<wsId>/v/mm/:viewId  ->  <MindMapView viewId=… />
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { resolveViewListId } from '@/lib/view-data';
import { useTaskContextMenu } from '@/components/menus/useTaskContextMenu';
import { ViewShell } from '@/components/views/ViewShell';
import { ViewToolbar } from '@/components/views/ViewToolbar';
import { useUiStore } from '@/store/ui-store';
import { useWorkspaceStore } from '@/store/workspace';
import { FreeformCanvas } from './FreeformCanvas';
import { buildLayout, type MindNode } from './layout';
import { MindConnectors } from './MindConnectors';
import { MindControls } from './MindControls';
import { MindNodeCard } from './MindNodeCard';
import { MindToggles } from './MindToggles';
import { StructureChooser } from './StructureChooser';
import { StructureSwitch } from './StructureSwitch';
import { useListName, useMindTree } from './use-mind-tree';
import { usePanZoom } from './use-pan-zoom';
import { useStructureChoice } from './use-structure';

const CANVAS_BG = 'var(--cu-bg-app, rgb(20,20,20))';
const TEXT_MUTED = 'var(--cu-text-muted, rgb(120,120,120))';

export function MindMapView({ viewId }: { viewId: string }) {
  const listId = resolveViewListId(viewId);
  const listName = useListName(listId);
  const { structure, choose, reset } = useStructureChoice(viewId);

  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const input = useMindTree(viewId, listId, listName, query);
  const layout = useMemo(() => buildLayout(input, collapsed), [input, collapsed]);

  const openTask = useUiStore((s) => s.openTask);
  const createTask = useWorkspaceStore((s) => s.createTask);
  const { onContextMenu, menu } = useTaskContextMenu();

  const pz = usePanZoom();
  const { fit } = pz;
  const viewportRef = useRef<HTMLDivElement>(null);
  const didFit = useRef(false);
  const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 });

  const handleToggle = useCallback((nodeId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const runFit = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    fit(layout.width, layout.height, el.clientWidth, el.clientHeight);
  }, [fit, layout.width, layout.height]);

  // Fit once on first paint so the whole tree is visible without manual zoom.
  useLayoutEffect(() => {
    if (didFit.current) return;
    const el = viewportRef.current;
    if (!el || el.clientWidth === 0) return;
    didFit.current = true;
    runFit();
  }, [runFit]);

  // Re-fit when the viewport resizes (sidebar toggles, window resize) and keep
  // the viewport size in state so the minimap can draw an accurate view rect.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    setViewportSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(() => {
      setViewportSize({ w: el.clientWidth, h: el.clientHeight });
      if (didFit.current) runFit();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [runFit]);

  const handleOpen = useCallback(
    (node: MindNode) => {
      if (node.task) openTask(node.task.id);
    },
    [openTask],
  );

  const handleAddChild = useCallback(
    (node: MindNode) => {
      if (node.kind === 'root') {
        createTask({ name: 'New Task', listId });
        return;
      }
      const parent = node.task;
      if (!parent) return;
      createTask({
        name: 'New Subtask',
        listId: parent.listId,
        parent: parent.id,
        status: parent.status,
        statusColor: parent.statusColor,
        statusType: parent.statusType,
      });
    },
    [createTask, listId],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, node: MindNode) => {
      if (!node.task) return;
      onContextMenu(e, node.task);
    },
    [onContextMenu],
  );

  const hasTasks = layout.nodes.length > 1;

  // Parity: a populated list opens straight into the Tasks tree (matching the
  // captured ClickUp view). The structure chooser only appears when there is no
  // persisted choice AND the list is empty, or when the user explicitly resets.
  const showChooser = structure === null && !hasTasks;
  const activeStructure = structure ?? 'tasks';

  if (showChooser) {
    return (
      <ViewShell code="mm" viewId={viewId}>
        <div style={{ position: 'relative', height: '100%', minHeight: 0 }}>
          <StructureChooser onChoose={choose} />
        </div>
      </ViewShell>
    );
  }

  if (activeStructure === 'freeform') {
    return (
      <ViewShell code="mm" viewId={viewId}>
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minHeight: 0,
          }}
        >
          <StructureSwitch active="freeform" onChange={(s) => (s === 'tasks' ? choose('tasks') : undefined)} onReset={reset} />
          <FreeformCanvas viewId={viewId} listId={listId} />
        </div>
      </ViewShell>
    );
  }

  return (
    <ViewShell code="mm" viewId={viewId}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
        }}
      >
        <ViewToolbar
          listId={listId}
          viewId={viewId}
          controls={['filter', 'closed', 'search', 'customize', 'addTask']}
          searchValue={query}
          onSearchChange={setQuery}
        />

        <div
          ref={viewportRef}
          data-testid="mindmap-canvas"
          onPointerDown={pz.onPointerDown}
          onPointerMove={pz.onPointerMove}
          onPointerUp={pz.onPointerUp}
          onPointerCancel={pz.onPointerUp}
          onWheel={pz.onWheel}
          style={{
            position: 'relative',
            flex: 1,
            minHeight: 0,
            width: '100%',
            background: CANVAS_BG,
            backgroundImage:
              'radial-gradient(var(--cu-border-divider, rgba(255,255,255,0.06)) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            overflow: 'hidden',
            cursor: pz.dragging ? 'grabbing' : 'grab',
            touchAction: 'none',
          }}
        >
        <StructureSwitch active="tasks" onChange={(s) => (s === 'freeform' ? choose('freeform') : undefined)} onReset={reset} />
        {!hasTasks && (
          <div
            data-testid="mindmap-empty"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: TEXT_MUTED,
              fontSize: 13,
            }}
          >
            No tasks to map. Add a task to start building your mind map.
          </div>
        )}

        <div
          data-testid="mindmap-stage"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            transformOrigin: '0 0',
            transform: `translate(${pz.transform.x}px, ${pz.transform.y}px) scale(${pz.transform.scale})`,
            willChange: 'transform',
          }}
        >
          <MindConnectors edges={layout.edges} width={layout.width} height={layout.height} />
          {layout.nodes.map((node) => (
            <MindNodeCard
              key={node.id}
              node={node}
              onOpen={handleOpen}
              onAddChild={handleAddChild}
              onContextMenu={handleContextMenu}
            />
          ))}
          <MindToggles toggles={layout.toggles} onToggle={handleToggle} />
        </div>

        <MindControls
          scale={pz.transform.scale}
          transform={pz.transform}
          layout={layout}
          viewport={viewportSize}
          onZoomIn={pz.zoomIn}
          onZoomOut={pz.zoomOut}
          onZoomTo={(s) => pz.zoomTo(s)}
        />
        </div>
      </div>

      {menu}
    </ViewShell>
  );
}
