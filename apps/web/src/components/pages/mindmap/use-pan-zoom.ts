/**
 * Pan + zoom controller for the Mind Map canvas. Holds a `{ x, y, scale }`
 * transform, drags the canvas with the pointer, zooms toward the cursor on
 * wheel, and exposes imperative zoom-in / zoom-out / fit handlers. All mutation
 * goes through functional setState so React batching is preserved and no
 * setState-during-render ever happens.
 */

import { useCallback, useRef, useState } from 'react';

export interface Transform {
  x: number;
  y: number;
  scale: number;
}

const MIN_SCALE = 0.2;
const MAX_SCALE = 2.5;
/** Fit-to-view never zooms in past 1:1; small trees stay compact. */
const FIT_MAX_SCALE = 1;
const ZOOM_STEP = 1.2;
const WHEEL_SENSITIVITY = 0.0015;

const clampScale = (s: number): number =>
  Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

export interface PanZoom {
  transform: Transform;
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onWheel: (e: React.WheelEvent) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  /** Set an absolute scale (clamped), keeping the canvas centre fixed. */
  zoomTo: (scale: number, cx?: number, cy?: number) => void;
  /**
   * Fit the content box inside the given viewport box. `originX`/`originY` are
   * the content box's top-left in canvas space (defaults to 0,0); pass the real
   * origin when content lives in negative space so fit centres on it.
   */
  fit: (
    contentW: number,
    contentH: number,
    viewW: number,
    viewH: number,
    originX?: number,
    originY?: number,
  ) => void;
  reset: () => void;
}

const INITIAL: Transform = { x: 0, y: 0, scale: 1 };

export function usePanZoom(): PanZoom {
  const [transform, setTransform] = useState<Transform>(INITIAL);
  const [dragging, setDragging] = useState(false);
  const origin = useRef<{ px: number; py: number; tx: number; ty: number } | null>(
    null,
  );
  // Mirror the latest transform so pointer handlers can read it without
  // queueing a reconciliation cycle just to peek at current state.
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setTransform((prev) => {
      const next = clampScale(prev.scale * factor);
      const k = next / prev.scale;
      // Keep the point under (cx, cy) fixed while scaling.
      return {
        scale: next,
        x: cx - (cx - prev.x) * k,
        y: cy - (cy - prev.y) * k,
      };
    });
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Only drag from the empty canvas, never from a node (nodes stop propagation).
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const t = transformRef.current;
    origin.current = { px: e.clientX, py: e.clientY, tx: t.x, ty: t.y };
    setDragging(true);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const o = origin.current;
    if (!o) return;
    const dx = e.clientX - o.px;
    const dy = e.clientY - o.py;
    setTransform((prev) => ({ ...prev, x: o.tx + dx, y: o.ty + dy }));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    origin.current = null;
    setDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // capture may already be gone; ignore.
    }
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * WHEEL_SENSITIVITY);
      zoomAt(factor, cx, cy);
    },
    [zoomAt],
  );

  const zoomIn = useCallback(() => {
    setTransform((prev) => ({ ...prev, scale: clampScale(prev.scale * ZOOM_STEP) }));
  }, []);

  const zoomOut = useCallback(() => {
    setTransform((prev) => ({ ...prev, scale: clampScale(prev.scale / ZOOM_STEP) }));
  }, []);

  const zoomTo = useCallback((scale: number, cx?: number, cy?: number) => {
    setTransform((prev) => {
      const next = clampScale(scale);
      const k = next / prev.scale;
      if (cx === undefined || cy === undefined) {
        return { ...prev, scale: next };
      }
      // Keep the point under (cx, cy) fixed while scaling.
      return { scale: next, x: cx - (cx - prev.x) * k, y: cy - (cy - prev.y) * k };
    });
  }, []);

  const fit = useCallback(
    (
      contentW: number,
      contentH: number,
      viewW: number,
      viewH: number,
      originX = 0,
      originY = 0,
    ) => {
      if (contentW <= 0 || contentH <= 0 || viewW <= 0 || viewH <= 0) return;
      // Fit only shrinks oversized trees; it never magnifies a small one past
      // 1:1 (matching ClickUp — a 3-node map stays compact instead of filling
      // the viewport with giant cards).
      const raw = Math.min(viewW / contentW, viewH / contentH, FIT_MAX_SCALE);
      const scale = clampScale(raw);
      // Centre the content box, then shift by -origin*scale so a box whose
      // top-left sits at (originX, originY) in canvas space lands centred.
      const x = (viewW - contentW * scale) / 2 - originX * scale;
      const y = (viewH - contentH * scale) / 2 - originY * scale;
      setTransform({ x, y, scale });
    },
    [],
  );

  const reset = useCallback(() => setTransform(INITIAL), []);

  return {
    transform,
    dragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
    zoomIn,
    zoomOut,
    zoomTo,
    fit,
    reset,
  };
}
