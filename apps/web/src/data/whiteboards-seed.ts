/**
 * Whiteboards hub seed. Self-contained sample data for the Whiteboards gallery
 * page ("All Whiteboards") and its sidebar. Mirrors the real ClickUp Whiteboards
 * home: empty light card thumbnails (a faint centered placeholder glyph), a name,
 * an "Edited <date>" subtitle, and an owner avatar. No coloured sticky notes.
 */

export interface WhiteboardAuthor {
  initials: string;
  color: string;
}

export interface Whiteboard {
  id: string;
  name: string;
  /** Subtitle line under the name, e.g. "Edited May 25" or "Legacy · Edited May 25". */
  editedLabel: string;
  /** True for the older legacy whiteboard engine (prefixes the subtitle). */
  legacy?: boolean;
  author: WhiteboardAuthor;
}

const OWNER: WhiteboardAuthor = { initials: 'CM', color: 'rgb(32, 32, 32)' };

export const WHITEBOARDS: Whiteboard[] = [
  { id: 'wb-whiteboard', name: 'Whiteboard', editedLabel: 'Edited Jun 2', author: OWNER },
  { id: 'wb-customer-journey-1', name: 'Customer Journey Map', editedLabel: 'Edited May 25', author: OWNER },
  { id: 'wb-impact-effort', name: 'Impact Effort Matrix', editedLabel: 'Edited May 25', legacy: true, author: OWNER },
  { id: 'wb-customer-journey-2', name: 'Customer Journey Map', editedLabel: 'Edited May 25', author: OWNER },
  { id: 'wb-product-roadmap', name: 'Product Roadmap', editedLabel: 'Edited May 21', author: OWNER },
  { id: 'wb-sprint-retro', name: 'Sprint Retro', editedLabel: 'Edited May 18', author: OWNER },
];

/** Whiteboards shown in the sidebar "Recents" section, in display order. */
const RECENT_ORDER = ['wb-whiteboard', 'wb-impact-effort', 'wb-customer-journey-1', 'wb-customer-journey-2'];

export const RECENT_WHITEBOARDS: Whiteboard[] = RECENT_ORDER
  .map((id) => WHITEBOARDS.find((board) => board.id === id))
  .filter((board): board is Whiteboard => board !== undefined);
