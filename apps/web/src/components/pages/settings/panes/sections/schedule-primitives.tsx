'use client';

/**
 * Day toggle pills and the holiday list row used by WorkSchedulePane. The day
 * toggles are a horizontal row of selectable pills (Mon–Sun); the holiday row
 * is a name + date line with a remove affordance.
 */

export function DayToggle({
  day,
  active,
  onToggle,
}: {
  day: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className="h-9 min-w-[52px] px-3 rounded-[8px] text-[13px] font-medium border transition-colors"
      style={{
        background: active ? '#3e63dd' : 'transparent',
        borderColor: active ? '#3e63dd' : '#2a2a2a',
        color: active ? '#ffffff' : '#b4b4b4',
      }}
    >
      {day}
    </button>
  );
}

const TrashGlyph = (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
  </svg>
);

export function HolidayRow({
  name,
  date,
  onRemove,
}: {
  name: string;
  date: string;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-4 py-2.5">
      <span className="text-[14px] text-white flex-1 min-w-0 truncate">{name}</span>
      <span className="text-[13px] text-[#b4b4b4]">{date}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${name}`}
        className="w-7 h-7 grid place-items-center rounded-[6px] text-[#7b7b7b] hover:text-[#e5484d] hover:bg-[#2a2a2a] transition-colors"
      >
        {TrashGlyph}
      </button>
    </div>
  );
}
