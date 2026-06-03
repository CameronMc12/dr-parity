/**
 * Whiteboard element-state reducer + hook. Owns the full element list, selection
 * and the in-progress text edit, all in local React state (no store writes, no
 * render loops). Seeding happens once on first mount via a lazy reducer init.
 *
 * Every action returns a fresh array so React re-renders predictably; the view
 * memoizes derived layout off `elements`.
 */

import { useCallback, useMemo, useReducer } from 'react';
import type { Task } from '@/store/workspace/types';
import { buildSeed } from './seed';
import {
  CONNECTOR_LEN,
  CONNECTOR_STROKE,
  FRAME_H,
  FRAME_W,
  IMAGE_H,
  IMAGE_W,
  PEN_POINTS,
  PEN_STROKE,
  SHAPE_H,
  SHAPE_W,
  STICKY_FILLS,
  STICKY_H,
  STICKY_W,
  TASKCARD_H,
  TASKCARD_W,
  TEXT_H,
  TEXT_SIZE,
  TEXT_W,
  isShapeVariant,
  type ConnectorElement,
  type ShapeVariant,
  type ToolId,
  type WhiteboardElement,
} from './types';

interface State {
  elements: WhiteboardElement[];
  selectedId: string | null;
  editingId: string | null;
  nextZ: number;
  seq: number;
  /** Past element snapshots for undo (most recent last). */
  past: WhiteboardElement[][];
  /** Future element snapshots for redo (most recent last). */
  future: WhiteboardElement[][];
}

type Action =
  | { type: 'add'; tool: ToolId; x: number; y: number }
  | { type: 'addStickies'; labels: string[]; x: number; y: number }
  | { type: 'move'; id: string; dx: number; dy: number }
  | { type: 'select'; id: string | null }
  | { type: 'edit'; id: string | null }
  | { type: 'setText'; id: string; text: string }
  | { type: 'delete'; id: string }
  | { type: 'undo' }
  | { type: 'redo' };

/** Cap the undo stack so long sessions cannot grow memory unbounded. */
const HISTORY_LIMIT = 50;

/** Push the current elements onto `past`, trimmed to the history cap. */
function pushHistory(past: WhiteboardElement[][], snapshot: WhiteboardElement[]) {
  const next = [...past, snapshot];
  return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
}

interface SeedArgs {
  tasks: Task[];
  listName: string;
}

function initState({ tasks, listName }: SeedArgs): State {
  const elements = buildSeed(tasks, listName);
  const nextZ = elements.reduce((m, e) => Math.max(m, e.z), 0) + 1;
  return {
    elements,
    selectedId: null,
    editingId: null,
    nextZ,
    seq: 0,
    past: [],
    future: [],
  };
}

function makeShape(
  variant: ShapeVariant,
  x: number,
  y: number,
  z: number,
  id: string,
): WhiteboardElement {
  return {
    id,
    kind: 'shape',
    variant,
    x: x - SHAPE_W / 2,
    y: y - SHAPE_H / 2,
    z,
    w: SHAPE_W,
    h: SHAPE_H,
    fill: 'rgba(255,255,255,0.92)',
    stroke: '#94a3b8',
  };
}

function makePen(
  x: number,
  y: number,
  z: number,
  id: string,
): ConnectorElement {
  const last = PEN_POINTS[PEN_POINTS.length - 1] ?? { x: CONNECTOR_LEN, y: 0 };
  return {
    id,
    kind: 'connector',
    x,
    y,
    z,
    x2: x + last.x,
    y2: y + last.y,
    stroke: PEN_STROKE,
    style: 'pen',
    dashed: true,
    points: PEN_POINTS,
  };
}

function makeStickyWithText(
  text: string,
  x: number,
  y: number,
  z: number,
  seq: number,
): WhiteboardElement {
  return {
    id: `el-${seq}`,
    kind: 'sticky',
    x: x - STICKY_W / 2,
    y: y - STICKY_H / 2,
    z,
    w: STICKY_W,
    h: STICKY_H,
    text,
    fill: STICKY_FILLS[seq % STICKY_FILLS.length] ?? STICKY_FILLS[0],
    accent: null,
    taskId: null,
  };
}

function makeElement(
  tool: ToolId,
  x: number,
  y: number,
  z: number,
  seq: number,
): WhiteboardElement | null {
  const id = `el-${seq}`;
  if (isShapeVariant(tool)) return makeShape(tool, x, y, z, id);
  switch (tool) {
    case 'shape':
      return makeShape('rect', x, y, z, id);
    case 'sticky':
      return {
        id,
        kind: 'sticky',
        x: x - STICKY_W / 2,
        y: y - STICKY_H / 2,
        z,
        w: STICKY_W,
        h: STICKY_H,
        text: '',
        fill: STICKY_FILLS[seq % STICKY_FILLS.length] ?? STICKY_FILLS[0],
        accent: null,
        taskId: null,
      };
    case 'task':
      return {
        id,
        kind: 'taskcard',
        x: x - TASKCARD_W / 2,
        y: y - TASKCARD_H / 2,
        z,
        w: TASKCARD_W,
        h: TASKCARD_H,
        text: '',
        status: 'TO DO',
        statusColor: '#87909e',
        priorityColor: null,
        taskId: null,
      };
    case 'frame':
      return {
        id,
        kind: 'frame',
        x: x - FRAME_W / 2,
        y: y - FRAME_H / 2,
        z,
        w: FRAME_W,
        h: FRAME_H,
        label: `Frame ${seq + 1}`,
      };
    case 'image':
      return {
        id,
        kind: 'image',
        x: x - IMAGE_W / 2,
        y: y - IMAGE_H / 2,
        z,
        w: IMAGE_W,
        h: IMAGE_H,
      };
    case 'text':
      return {
        id,
        kind: 'text',
        x: x - TEXT_W / 2,
        y: y - TEXT_H / 2,
        z,
        w: TEXT_W,
        h: TEXT_H,
        text: '',
        size: TEXT_SIZE,
        color: '#1f2933',
      };
    case 'pen':
      return makePen(x, y, z, id);
    case 'arrow':
    case 'connector':
      return {
        id,
        kind: 'connector',
        x,
        y,
        z,
        x2: x + CONNECTOR_LEN,
        y2: y,
        stroke: CONNECTOR_STROKE,
        style: tool,
        dashed: false,
      };
    default:
      return null;
  }
}

function moveElement(
  el: WhiteboardElement,
  dx: number,
  dy: number,
): WhiteboardElement {
  if (el.kind === 'connector') {
    return { ...el, x: el.x + dx, y: el.y + dy, x2: el.x2 + dx, y2: el.y2 + dy };
  }
  return { ...el, x: el.x + dx, y: el.y + dy };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'add': {
      const el = makeElement(
        action.tool,
        action.x,
        action.y,
        state.nextZ,
        state.seq,
      );
      if (!el) return state;
      const startEdit =
        el.kind === 'sticky' || el.kind === 'text' || el.kind === 'taskcard';
      return {
        ...state,
        elements: [...state.elements, el],
        selectedId: el.id,
        editingId: startEdit ? el.id : null,
        nextZ: state.nextZ + 1,
        seq: state.seq + 1,
        past: pushHistory(state.past, state.elements),
        future: [],
      };
    }
    case 'addStickies': {
      if (action.labels.length === 0) return state;
      const cols = Math.min(3, action.labels.length);
      const gapX = STICKY_W + 24;
      const gapY = STICKY_H + 24;
      const created = action.labels.map((label, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = action.x + (col - (cols - 1) / 2) * gapX;
        const cy = action.y + row * gapY;
        return makeStickyWithText(
          label,
          cx,
          cy,
          state.nextZ + i,
          state.seq + i,
        );
      });
      const last = created[created.length - 1];
      return {
        ...state,
        elements: [...state.elements, ...created],
        selectedId: last ? last.id : state.selectedId,
        editingId: null,
        nextZ: state.nextZ + created.length,
        seq: state.seq + created.length,
        past: pushHistory(state.past, state.elements),
        future: [],
      };
    }
    case 'move': {
      if (action.dx === 0 && action.dy === 0) return state;
      return {
        ...state,
        elements: state.elements.map((el) =>
          el.id === action.id ? moveElement(el, action.dx, action.dy) : el,
        ),
        past: pushHistory(state.past, state.elements),
        future: [],
      };
    }
    case 'select':
      if (state.selectedId === action.id) return state;
      return { ...state, selectedId: action.id };
    case 'edit':
      if (state.editingId === action.id) return state;
      return { ...state, editingId: action.id };
    case 'setText':
      return {
        ...state,
        elements: state.elements.map((el) =>
          el.id === action.id &&
          (el.kind === 'sticky' ||
            el.kind === 'text' ||
            el.kind === 'taskcard')
            ? { ...el, text: action.text }
            : el,
        ),
        past: pushHistory(state.past, state.elements),
        future: [],
      };
    case 'delete':
      return {
        ...state,
        elements: state.elements.filter((el) => el.id !== action.id),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
        editingId: state.editingId === action.id ? null : state.editingId,
        past: pushHistory(state.past, state.elements),
        future: [],
      };
    case 'undo': {
      const prev = state.past[state.past.length - 1];
      if (!prev) return state;
      return {
        ...state,
        elements: prev,
        past: state.past.slice(0, -1),
        future: pushHistory(state.future, state.elements),
        selectedId: null,
        editingId: null,
      };
    }
    case 'redo': {
      const next = state.future[state.future.length - 1];
      if (!next) return state;
      return {
        ...state,
        elements: next,
        future: state.future.slice(0, -1),
        past: pushHistory(state.past, state.elements),
        selectedId: null,
        editingId: null,
      };
    }
    default:
      return state;
  }
}

export interface WhiteboardApi {
  elements: WhiteboardElement[];
  selectedId: string | null;
  editingId: string | null;
  add: (tool: ToolId, x: number, y: number) => void;
  addStickies: (labels: string[], x: number, y: number) => void;
  move: (id: string, dx: number, dy: number) => void;
  select: (id: string | null) => void;
  edit: (id: string | null) => void;
  setText: (id: string, text: string) => void;
  remove: (id: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useWhiteboard(seed: SeedArgs): WhiteboardApi {
  const [state, dispatch] = useReducer(reducer, seed, initState);

  const add = useCallback(
    (tool: ToolId, x: number, y: number) =>
      dispatch({ type: 'add', tool, x, y }),
    [],
  );
  const addStickies = useCallback(
    (labels: string[], x: number, y: number) =>
      dispatch({ type: 'addStickies', labels, x, y }),
    [],
  );
  const move = useCallback(
    (id: string, dx: number, dy: number) =>
      dispatch({ type: 'move', id, dx, dy }),
    [],
  );
  const select = useCallback(
    (id: string | null) => dispatch({ type: 'select', id }),
    [],
  );
  const edit = useCallback(
    (id: string | null) => dispatch({ type: 'edit', id }),
    [],
  );
  const setText = useCallback(
    (id: string, text: string) => dispatch({ type: 'setText', id, text }),
    [],
  );
  const remove = useCallback(
    (id: string) => dispatch({ type: 'delete', id }),
    [],
  );
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  return useMemo(
    () => ({
      elements: state.elements,
      selectedId: state.selectedId,
      editingId: state.editingId,
      add,
      addStickies,
      move,
      select,
      edit,
      setText,
      remove,
      undo,
      redo,
      canUndo,
      canRedo,
    }),
    [
      state.elements,
      state.selectedId,
      state.editingId,
      add,
      addStickies,
      move,
      select,
      edit,
      setText,
      remove,
      undo,
      redo,
      canUndo,
      canRedo,
    ],
  );
}
