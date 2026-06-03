'use client';

/**
 * Hand-rolled SVG chart primitives for the dashboard. No chart library: every
 * shape is computed here so it stays tiny, themeable via `var(--cu-*)`, and
 * pixel-matched to ClickUp's dark dashboards. Both primitives are responsive
 * (they draw into a fixed `viewBox` and scale to their container) and expose a
 * lightweight hover tooltip driven by local state.
 *
 * - <Pie>  : a donut. Slices are arc paths; the hole is left transparent so the
 *            host (PieCard) can drop a centre total in over it.
 * - <Bars> : horizontal OR vertical bars with a 0..max axis and gridlines.
 */

import { useCallback, useId, useMemo, useState } from 'react';
import { DASH } from '../tokens';

export interface ChartDatum {
  label: string;
  color: string;
  value: number;
}

// ── Tooltip ───────────────────────────────────────────────────────────────

interface TipState {
  x: number;
  y: number;
  label: string;
  value: number;
  pct?: number;
}

function Tooltip({ tip }: { tip: TipState }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: tip.x,
        top: tip.y,
        transform: 'translate(-50%, -120%)',
        pointerEvents: 'none',
        background: 'var(--cu-bg-tooltip, rgba(20,22,28,0.96))',
        border: `1px solid ${DASH.border}`,
        borderRadius: 6,
        padding: '5px 8px',
        fontSize: 11,
        lineHeight: 1.3,
        color: DASH.textPrimary,
        whiteSpace: 'nowrap',
        boxShadow: DASH.shadowHover,
        zIndex: 5,
      }}
    >
      <span style={{ color: DASH.textSecondary }}>{tip.label}</span>{' '}
      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{tip.value}</strong>
      {tip.pct != null && (
        <span style={{ color: DASH.textMuted }}> · {tip.pct}%</span>
      )}
    </div>
  );
}

// ── Pie / Donut ─────────────────────────────────────────────────────────────

interface PieProps {
  data: ChartDatum[];
  /** Donut hole ratio (0 = full pie, 0.6 = thick ring). */
  innerRatio?: number;
  size?: number;
}

const TAU = Math.PI * 2;

/** Point on a circle for a given angle (0 = 12 o'clock, clockwise). */
function polar(cx: number, cy: number, r: number, angle: number): [number, number] {
  const a = angle - Math.PI / 2;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/** SVG path for one donut segment between two angles (radians). */
function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  start: number,
  end: number,
): string {
  const large = end - start > Math.PI ? 1 : 0;
  const [ox1, oy1] = polar(cx, cy, rOuter, start);
  const [ox2, oy2] = polar(cx, cy, rOuter, end);
  const [ix2, iy2] = polar(cx, cy, rInner, end);
  const [ix1, iy1] = polar(cx, cy, rInner, start);
  return [
    `M ${ox1} ${oy1}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${ox2} ${oy2}`,
    `L ${ix2} ${iy2}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${ix1} ${iy1}`,
    'Z',
  ].join(' ');
}

export function Pie({ data, innerRatio = 0.62, size = 120 }: PieProps) {
  const [hover, setHover] = useState<number | null>(null);
  const [tip, setTip] = useState<TipState | null>(null);

  const total = useMemo(() => data.reduce((n, d) => n + d.value, 0), [data]);

  const segments = useMemo(() => {
    if (total === 0) return [];
    const cx = 50;
    const cy = 50;
    const rOuter = 50;
    const rInner = rOuter * innerRatio;
    let acc = 0;
    return data.map((d) => {
      const start = (acc / total) * TAU;
      acc += d.value;
      const end = (acc / total) * TAU;
      // Full-circle guard: a lone non-zero slice can't be a single arc.
      const safeEnd = end - start >= TAU ? end - 0.0001 : end;
      return {
        d: arcPath(cx, cy, rOuter, rInner, start, safeEnd),
        color: d.color,
        label: d.label,
        value: d.value,
        pct: Math.round((d.value / total) * 100),
      };
    });
  }, [data, total, innerRatio]);

  const moveTip = useCallback((e: React.MouseEvent, seg: (typeof segments)[number]) => {
    const box = e.currentTarget.closest('div')?.getBoundingClientRect();
    if (!box) return;
    setTip({
      x: e.clientX - box.left,
      y: e.clientY - box.top,
      label: seg.label,
      value: seg.value,
      pct: seg.pct,
    });
  }, []);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Donut chart">
        {segments.map((seg, i) => (
          <path
            key={`${seg.label}-${i}`}
            d={seg.d}
            fill={seg.color}
            opacity={hover == null || hover === i ? 1 : 0.4}
            style={{ transition: 'opacity 120ms ease-out', cursor: 'default' }}
            onMouseEnter={() => setHover(i)}
            onMouseMove={(e) => moveTip(e, seg)}
            onMouseLeave={() => {
              setHover(null);
              setTip(null);
            }}
          />
        ))}
      </svg>
      {tip && <Tooltip tip={tip} />}
    </div>
  );
}

// ── Bars ──────────────────────────────────────────────────────────────────

interface BarsProps {
  data: ChartDatum[];
  orientation: 'horizontal' | 'vertical';
  /** Override the axis ceiling. Defaults to the max value (rounded up). */
  max?: number;
  /** Number of gridlines/ticks across the value axis. */
  ticks?: number;
}

/** Round a max up to a friendly axis ceiling (1,2,5 × 10ⁿ). */
function niceCeil(value: number): number {
  if (value <= 0) return 1;
  if (value <= 5) return value;
  const pow = 10 ** Math.floor(Math.log10(value));
  const norm = value / pow;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * pow;
}

export function Bars({ data, orientation, max, ticks = 4 }: BarsProps) {
  const uid = useId();
  const [hover, setHover] = useState<number | null>(null);
  const [tip, setTip] = useState<TipState | null>(null);

  const axisMax = useMemo(() => {
    if (max != null) return max;
    const rawMax = data.reduce((m, d) => Math.max(m, d.value), 0);
    return niceCeil(rawMax) || 1;
  }, [data, max]);
  const tickValues = useMemo(
    () => Array.from({ length: ticks + 1 }, (_, i) => Math.round((axisMax / ticks) * i)),
    [axisMax, ticks],
  );

  const moveTip = useCallback((e: React.MouseEvent, d: ChartDatum) => {
    const root = e.currentTarget.closest('[data-bars-root]') as Element | null;
    const box = root?.getBoundingClientRect();
    if (!box) return;
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, label: d.label, value: d.value });
  }, []);

  if (orientation === 'horizontal') {
    return (
      <div data-bars-root style={{ position: 'relative', width: '100%', height: '100%' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            height: '100%',
            overflowY: 'auto',
            paddingRight: 4,
          }}
        >
          {data.map((d, i) => (
            <div key={`${uid}-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  color: DASH.textSecondary,
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.label}
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums', color: DASH.textMuted }}>
                  {d.value}
                </span>
              </div>
              <div
                style={{ height: 10, borderRadius: 5, background: DASH.cardHoverBg, overflow: 'hidden' }}
                onMouseEnter={() => setHover(i)}
                onMouseMove={(e) => moveTip(e, d)}
                onMouseLeave={() => {
                  setHover(null);
                  setTip(null);
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, (d.value / axisMax) * 100)}%`,
                    height: '100%',
                    background: d.color,
                    borderRadius: 5,
                    opacity: hover == null || hover === i ? 1 : 0.5,
                    transition: 'width 320ms cubic-bezier(0.16,1,0.3,1), opacity 120ms ease-out',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        {tip && <Tooltip tip={tip} />}
      </div>
    );
  }

  // Vertical: SVG-free flex columns sitting on a gridlined plot.
  return (
    <div data-bars-root style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div style={{ display: 'flex', height: '100%', gap: 8 }}>
        {/* Y axis labels */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column-reverse',
            justifyContent: 'space-between',
            fontSize: 10,
            color: DASH.textMuted,
            fontVariantNumeric: 'tabular-nums',
            paddingBottom: 18,
          }}
        >
          {tickValues.map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
        {/* Plot area */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
          {/* gridlines */}
          <div style={{ position: 'absolute', inset: '0 0 18px 0' }}>
            {tickValues.map((_t, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: `${(i / ticks) * 100}%`,
                  height: 1,
                  background: DASH.border,
                  opacity: i === 0 ? 0.9 : 0.4,
                }}
              />
            ))}
          </div>
          {/* bars */}
          <div
            style={{
              position: 'absolute',
              inset: '0 0 18px 0',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-around',
              gap: 6,
              padding: '0 4px',
            }}
          >
            {data.map((d, i) => (
              <div
                key={`${uid}-${i}`}
                style={{
                  flex: 1,
                  maxWidth: 48,
                  height: `${Math.min(100, (d.value / axisMax) * 100)}%`,
                  minHeight: d.value > 0 ? 2 : 0,
                  background: d.color,
                  borderRadius: '4px 4px 0 0',
                  opacity: hover == null || hover === i ? 1 : 0.5,
                  transition:
                    'height 320ms cubic-bezier(0.16,1,0.3,1), opacity 120ms ease-out',
                }}
                onMouseEnter={() => setHover(i)}
                onMouseMove={(e) => moveTip(e, d)}
                onMouseLeave={() => {
                  setHover(null);
                  setTip(null);
                }}
              />
            ))}
          </div>
          {/* X axis labels */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 16,
              display: 'flex',
              justifyContent: 'space-around',
              gap: 6,
              padding: '0 4px',
            }}
          >
            {data.map((d, i) => (
              <span
                key={`${uid}-x-${i}`}
                style={{
                  flex: 1,
                  maxWidth: 48,
                  textAlign: 'center',
                  fontSize: 10,
                  color: DASH.textMuted,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {d.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      {tip && <Tooltip tip={tip} />}
    </div>
  );
}
