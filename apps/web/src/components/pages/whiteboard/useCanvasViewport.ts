/**
 * Pan + zoom viewport state for the whiteboard canvas. Holds a translation
 * (panX/panY, screen px) and a zoom scale, with helpers to convert a screen
 * point to board space and to zoom about a focal point (so wheel-zoom keeps the
 * cursor anchored). Pure local state, no store, no render loop.
 */

import { useCallback, useMemo, useState } from 'react';
import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP } from './types';

export interface Viewport {
  panX: number;
  panY: number;
  zoom: number;
}

/** Axis-aligned board-space bounds of the content to fit. */
export interface ContentBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
const FIT_PADDING = 80;

export interface CanvasViewportApi {
  viewport: Viewport;
  /** Convert a point in canvas-element-local screen px to board space. */
  toBoard: (screenX: number, screenY: number) => { x: number; y: number };
  /** Pan by a screen-px delta. */
  panBy: (dx: number, dy: number) => void;
  /** Zoom by a multiplicative factor about a focal screen point. */
  zoomAt: (factor: number, focalX: number, focalY: number) => void;
  /** Step zoom in/out about the given focal point (toolbar buttons). */
  zoomStep: (dir: 1 | -1, focalX: number, focalY: number) => void;
  /** Pan + zoom so the given content bounds fill the canvas (with padding). */
  fitToContent: (
    bounds: ContentBounds,
    canvasW: number,
    canvasH: number,
  ) => void;
  reset: () => void;
}

const INITIAL: Viewport = { panX: 0, panY: 0, zoom: 1 };

export function useCanvasViewport(): CanvasViewportApi {
  const [viewport, setViewport] = useState<Viewport>(INITIAL);

  const toBoard = useCallback(
    (screenX: number, screenY: number) => ({
      x: (screenX - viewport.panX) / viewport.zoom,
      y: (screenY - viewport.panY) / viewport.zoom,
    }),
    [viewport.panX, viewport.panY, viewport.zoom],
  );

  const panBy = useCallback((dx: number, dy: number) => {
    setViewport((v) => ({ ...v, panX: v.panX + dx, panY: v.panY + dy }));
  }, []);

  const zoomAt = useCallback(
    (factor: number, focalX: number, focalY: number) => {
      setViewport((v) => {
        const next = clampZoom(v.zoom * factor);
        if (next === v.zoom) return v;
        const ratio = next / v.zoom;
        return {
          zoom: next,
          panX: focalX - (focalX - v.panX) * ratio,
          panY: focalY - (focalY - v.panY) * ratio,
        };
      });
    },
    [],
  );

  const zoomStep = useCallback(
    (dir: 1 | -1, focalX: number, focalY: number) => {
      zoomAt(1 + dir * ZOOM_STEP, focalX, focalY);
    },
    [zoomAt],
  );

  const fitToContent = useCallback(
    (bounds: ContentBounds, canvasW: number, canvasH: number) => {
      const contentW = bounds.maxX - bounds.minX;
      const contentH = bounds.maxY - bounds.minY;
      if (
        contentW <= 0 ||
        contentH <= 0 ||
        canvasW <= 0 ||
        canvasH <= 0
      ) {
        setViewport(INITIAL);
        return;
      }
      const zoom = clampZoom(
        Math.min(
          (canvasW - FIT_PADDING * 2) / contentW,
          (canvasH - FIT_PADDING * 2) / contentH,
        ),
      );
      const centerX = bounds.minX + contentW / 2;
      const centerY = bounds.minY + contentH / 2;
      setViewport({
        zoom,
        panX: canvasW / 2 - centerX * zoom,
        panY: canvasH / 2 - centerY * zoom,
      });
    },
    [],
  );

  const reset = useCallback(() => setViewport(INITIAL), []);

  return useMemo(
    () => ({ viewport, toBoard, panBy, zoomAt, zoomStep, fitToContent, reset }),
    [viewport, toBoard, panBy, zoomAt, zoomStep, fitToContent, reset],
  );
}
