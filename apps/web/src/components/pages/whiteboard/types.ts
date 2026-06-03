/**
 * Whiteboard element model + canvas constants. Every element is a freeform node
 * on an infinite canvas, positioned in *board space* (pre-zoom/pan world units).
 * The view layer applies pan/zoom to convert board space to screen space.
 */

export type ToolId =
  | 'select'
  | 'hand'
  | 'task'
  | 'pen'
  | 'shape'
  | 'arrow'
  | 'sticky'
  | 'text'
  | 'frame'
  | 'image'
  | 'connector'
  | 'rect'
  | 'ellipse'
  | 'triangle'
  | 'diamond';

/**
 * Concrete shape the `shape` tool flyout places. The toolbar exposes these as a
 * sub-menu; the canvas treats every shape variant uniformly via `ShapeElement`.
 */
export type ShapeVariant = 'rect' | 'ellipse' | 'triangle' | 'diamond';

export type ElementKind =
  | 'sticky'
  | 'shape'
  | 'text'
  | 'connector'
  | 'taskcard'
  | 'frame'
  | 'image';

/** Shared fields every board element carries. */
interface BaseElement {
  id: string;
  /** Board-space top-left. */
  x: number;
  y: number;
  /** Z-order; higher renders on top. */
  z: number;
}

export interface StickyElement extends BaseElement {
  kind: 'sticky';
  w: number;
  h: number;
  text: string;
  /** Pastel fill hex. */
  fill: string;
  /** Optional accent bar colour (status colour of the seeding task). */
  accent: string | null;
  /** Source task id when seeded from a task; null for hand-drawn notes. */
  taskId: string | null;
}

export interface ShapeElement extends BaseElement {
  kind: 'shape';
  variant: ShapeVariant;
  w: number;
  h: number;
  fill: string;
  stroke: string;
}

export interface TextElement extends BaseElement {
  kind: 'text';
  w: number;
  h: number;
  text: string;
  /** Font size in board units. */
  size: number;
  color: string;
}

/** Which tool drew a connector — governs its rendered style. */
export type ConnectorStyle = 'arrow' | 'connector' | 'pen';

export interface ConnectorElement extends BaseElement {
  kind: 'connector';
  /** Board-space end-point (x/y is the start). */
  x2: number;
  y2: number;
  stroke: string;
  /** Source tool: arrow (solid + head), connector (elbow + head), pen (curved, no head). */
  style: ConnectorStyle;
  /** Dashed stroke (pen freehand stub). */
  dashed: boolean;
  /** Extra path points for the pen freehand stroke (board space, relative offsets). */
  points?: ReadonlyArray<{ x: number; y: number }>;
}

/**
 * A live task card placed on the board by the Task tool. Mirrors a real list
 * task: title, status pill, priority flag. Seeded ones carry the source taskId.
 */
export interface TaskCardElement extends BaseElement {
  kind: 'taskcard';
  w: number;
  h: number;
  text: string;
  status: string;
  statusColor: string;
  priorityColor: string | null;
  taskId: string | null;
}

/** A labelled container/section the Frame tool drops to group content. */
export interface FrameElement extends BaseElement {
  kind: 'frame';
  w: number;
  h: number;
  label: string;
}

/** An image placeholder the Image tool drops (upload affordance, no real I/O). */
export interface ImageElement extends BaseElement {
  kind: 'image';
  w: number;
  h: number;
}

export type WhiteboardElement =
  | StickyElement
  | ShapeElement
  | TextElement
  | ConnectorElement
  | TaskCardElement
  | FrameElement
  | ImageElement;

/** Elements that expose an editable text body (double-click to edit). */
export type EditableElement = StickyElement | TextElement | TaskCardElement;

export function isEditable(el: WhiteboardElement): el is EditableElement {
  return (
    el.kind === 'sticky' || el.kind === 'text' || el.kind === 'taskcard'
  );
}

/** Elements that have a width/height box (everything except connectors). */
export type BoxElement =
  | StickyElement
  | ShapeElement
  | TextElement
  | TaskCardElement
  | FrameElement
  | ImageElement;

export function hasBox(el: WhiteboardElement): el is BoxElement {
  return el.kind !== 'connector';
}

/** Canvas dotted/grid/blank background mode (board settings). */
export type BoardBackground = 'dots' | 'grid' | 'blank';

// ── Canvas geometry constants (board-space units) ───────────────────────────
export const STICKY_W = 180;
export const STICKY_H = 150;
export const SHAPE_W = 200;
export const SHAPE_H = 130;
export const TEXT_W = 220;
export const TEXT_H = 44;
export const TEXT_SIZE = 22;
export const CONNECTOR_LEN = 160;
/** Default stroke colours per connector style. */
export const CONNECTOR_STROKE = '#64748b';
export const PEN_STROKE = '#f08c00';
/** Relative offsets that give the pen stub a curved freehand-looking stroke. */
export const PEN_POINTS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 0, y: 0 },
  { x: 36, y: -26 },
  { x: 78, y: 14 },
  { x: 120, y: -18 },
  { x: 160, y: 6 },
] as const;
export const TASKCARD_W = 224;
export const TASKCARD_H = 96;
export const FRAME_W = 360;
export const FRAME_H = 260;
export const IMAGE_W = 220;
export const IMAGE_H = 160;

export const GRID = 40;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 3;
export const ZOOM_STEP = 0.15;

/** Pastel sticky fills (ClickUp whiteboard palette). */
export const STICKY_FILLS = [
  '#fff3bf',
  '#d3f9d8',
  '#d0ebff',
  '#ffe3e3',
  '#f3d9fa',
  '#ffe8cc',
] as const;

/** Which tool ids create a shape via the unified ShapeElement. */
export const SHAPE_VARIANTS: readonly ShapeVariant[] = [
  'rect',
  'ellipse',
  'triangle',
  'diamond',
] as const;

export function isShapeVariant(tool: ToolId): tool is ShapeVariant {
  return (SHAPE_VARIANTS as readonly string[]).includes(tool);
}
