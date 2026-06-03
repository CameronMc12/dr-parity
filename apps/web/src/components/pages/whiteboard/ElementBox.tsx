'use client';

/**
 * A single positioned, draggable, selectable board element (sticky / rect /
 * ellipse / text). Handles its own pointer-drag-to-move (in board space, so the
 * delta is divided by zoom), selection on pointer-down, double-click to edit,
 * and right-click to open the shared task context menu when it was seeded from a
 * task. Selection handles are drawn as a dashed outline with corner dots.
 */

import { useRef, useState } from 'react';
import type { Task } from '@/store/workspace/types';
import { StickyNote } from './elements/StickyNote';
import { TextElement } from './elements/TextElement';
import { ShapeView } from './elements/Shapes';
import { TaskCard } from './elements/TaskCard';
import { Frame } from './elements/Frame';
import { ImagePlaceholder } from './elements/ImagePlaceholder';
import { ElementContextMenu, type ElementMenuState } from './ElementContextMenu';
import { isEditable, type BoxElement } from './types';

const SELECT_COLOR = 'var(--cu-accent, #4ecdc4)';

interface ElementBoxProps {
  el: BoxElement;
  zoom: number;
  selected: boolean;
  editing: boolean;
  selectMode: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, dx: number, dy: number) => void;
  onBeginEdit: (id: string) => void;
  onChangeText: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onContextMenu?: (e: React.MouseEvent, task: Task) => void;
  taskFor: (id: string) => Task | null;
}

export function ElementBox({
  el,
  zoom,
  selected,
  editing,
  selectMode,
  onSelect,
  onMove,
  onBeginEdit,
  onChangeText,
  onRemove,
  onContextMenu,
  taskFor,
}: ElementBoxProps) {
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [menu, setMenu] = useState<ElementMenuState | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (editing) return;
    e.stopPropagation();
    onSelect(el.id);
    if (!selectMode) return;
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.x) / zoom;
    const dy = (e.clientY - d.y) / zoom;
    if (dx !== 0 || dy !== 0) {
      d.moved = true;
      onMove(el.id, dx, dy);
      d.x = e.clientX;
      d.y = e.clientY;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (drag.current) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* capture may already be released */
      }
    }
    drag.current = null;
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEditable(el)) onBeginEdit(el.id);
  };

  const onContext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(el.id);
    // Seeded task stickies open the shared task menu (real task actions);
    // every other board element gets the generic board-element menu whose
    // Delete removes the canvas node via board.remove (never the task record).
    if (el.kind === 'sticky' && el.taskId && onContextMenu) {
      const task = taskFor(el.taskId);
      if (task) {
        onContextMenu(e, task);
        return;
      }
    }
    setMenu({ id: el.id, x: e.clientX, y: e.clientY });
  };

  return (
    <div
      data-testid={`wb-el-${el.id}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContext}
      style={{
        position: 'absolute',
        left: el.x,
        top: el.y,
        width: el.w,
        height: el.h,
        zIndex: el.z,
        cursor: editing ? 'text' : selectMode ? 'move' : 'default',
        touchAction: 'none',
        outline: selected ? `2px solid ${SELECT_COLOR}` : 'none',
        outlineOffset: 3,
        borderRadius:
          el.kind === 'shape' && el.variant === 'ellipse' ? '50%' : 6,
      }}
    >
      {el.kind === 'sticky' && (
        <StickyNote
          el={el}
          editing={editing}
          onChangeText={(t) => onChangeText(el.id, t)}
        />
      )}
      {el.kind === 'text' && (
        <TextElement
          el={el}
          editing={editing}
          onChangeText={(t) => onChangeText(el.id, t)}
        />
      )}
      {el.kind === 'taskcard' && (
        <TaskCard
          el={el}
          editing={editing}
          onChangeText={(t) => onChangeText(el.id, t)}
        />
      )}
      {el.kind === 'shape' && <ShapeView el={el} />}
      {el.kind === 'frame' && <Frame el={el} />}
      {el.kind === 'image' && <ImagePlaceholder el={el} />}

      {selected && !editing ? (
        <SelectionHandles
          ellipse={el.kind === 'shape' && el.variant === 'ellipse'}
        />
      ) : null}

      <ElementContextMenu
        state={menu}
        onClose={() => setMenu(null)}
        onDelete={onRemove}
      />
    </div>
  );
}

function SelectionHandles({ ellipse }: { ellipse: boolean }) {
  const corners = [
    { left: -4, top: -4 },
    { right: -4, top: -4 },
    { left: -4, bottom: -4 },
    { right: -4, bottom: -4 },
  ];
  return (
    <>
      {corners.map((pos, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            position: 'absolute',
            width: 8,
            height: 8,
            borderRadius: ellipse ? '50%' : 2,
            background: '#fff',
            border: `2px solid ${SELECT_COLOR}`,
            ...pos,
          }}
        />
      ))}
    </>
  );
}
