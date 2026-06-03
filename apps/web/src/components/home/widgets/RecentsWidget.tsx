import { DocsIcon } from '@/components/ui/Icons';
import { type RecentItem, RECENTS } from '@/data/home-dashboard';
import { useRecentTasks } from '@/store/workspace/hooks';
import { WidgetCard } from '../WidgetCard';

const KIND_GLYPH: Record<RecentItem['kind'], { bg: string; glyph: string }> = {
  doc: { bg: 'var(--cu-bg-hover)', glyph: '📄' },
  task: { bg: 'var(--cu-accent-subtle)', glyph: '✓' },
  list: { bg: 'var(--cu-bg-hover)', glyph: '☰' },
  space: { bg: 'var(--cu-bg-hover)', glyph: '◆' },
};

function RecentRow({ item }: { item: RecentItem }) {
  const k = KIND_GLYPH[item.kind];
  return (
    <button
      type="button"
      className="w-full flex items-center gap-2.5 h-[34px] px-2 -mx-2 rounded-[var(--cu-radius-sm)] hover:bg-[var(--cu-bg-hover)] text-left"
    >
      <span
        className="w-5 h-5 rounded-[4px] flex items-center justify-center text-[10px] shrink-0"
        style={{ background: k.bg }}
      >
        {k.glyph}
      </span>
      <span className="text-[var(--cu-text-primary)] text-[13px] truncate">{item.name}</span>
      <span className="text-[var(--cu-text-muted)] text-[12px] shrink-0">in</span>
      <span className="text-[var(--cu-text-muted)] text-[12px] truncate">{item.location}</span>
    </button>
  );
}

export function RecentsWidget() {
  // Live: most-recently-updated workspace tasks, surfaced above seeded recents.
  const liveTasks = useRecentTasks(5);
  return (
    <WidgetCard title="Recents" icon={<DocsIcon size={15} />}>
      <div data-testid="recents-list" className="flex flex-col">
        {liveTasks.map((t) => (
          <RecentRow
            key={t.id}
            item={{ id: t.id, name: t.name, kind: 'task', location: 'My Tasks' }}
          />
        ))}
        {RECENTS.map((item) => (
          <RecentRow key={item.id} item={item} />
        ))}
      </div>
    </WidgetCard>
  );
}
