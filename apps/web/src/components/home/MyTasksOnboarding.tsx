import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '@/components/ui/Icons';
import { ONBOARDING_CARDS } from '@/data/home-dashboard';

/** Faint skeleton illustration used inside the onboarding preview cards. */
function PreviewSkeleton({ tinted }: { tinted?: boolean }) {
  return (
    <div
      className="rounded-[6px] border border-[var(--cu-border-divider)] p-3 flex flex-col gap-2"
      style={{ background: tinted ? 'var(--cu-accent-light)' : 'var(--cu-bg-hover)' }}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full border border-[var(--cu-grey-400)]" />
          <div
            className="h-1.5 rounded-full bg-[var(--cu-grey-300)]"
            style={{ width: `${70 - i * 8}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function OnboardingCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="w-[230px] shrink-0 rounded-[var(--cu-radius-lg)] bg-[var(--cu-bg-menu)] border border-[var(--cu-border-divider)] shadow-[var(--cu-shadow-sm)] overflow-hidden">
      <div className="grid grid-cols-3 gap-2 p-3 bg-[var(--cu-bg-app)]">
        <PreviewSkeleton />
        <PreviewSkeleton tinted />
        <PreviewSkeleton />
      </div>
      <div className="p-4 pt-3">
        <h3 className="text-[var(--cu-text-primary)] text-[13px] font-semibold mb-1">
          {title}
        </h3>
        <p className="text-[var(--cu-text-muted)] text-[12px] leading-[1.4]">{body}</p>
      </div>
    </div>
  );
}

/**
 * Empty-state "My Tasks" widget: header row, hero copy + CTA on the left, a
 * carousel of onboarding preview cards on the right. 1:1 with the oracle.
 */
export function MyTasksOnboarding() {
  return (
    <section className="px-6 pt-5">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[var(--cu-text-primary)] text-[15px] font-semibold">My Tasks</h2>
        <button
          type="button"
          className="text-[var(--cu-text-secondary)] text-[12px] font-medium px-2.5 h-7 rounded-[var(--cu-radius-sm)] hover:bg-[var(--cu-bg-hover)]"
        >
          Manage cards
        </button>
      </div>

      <div className="flex items-center gap-10 min-h-[300px]">
        {/* hero copy */}
        <div className="w-[300px] shrink-0">
          <h1 className="text-[var(--cu-text-primary)] text-[34px] leading-[1.15] font-bold mb-4">
            It all begins
            <br />
            with{' '}
            <span className="relative inline-block">
              tasks
              <span className="absolute left-0 -bottom-1 w-full h-[3px] bg-[var(--cu-status-purple)] rounded-full" />
            </span>
          </h1>
          <p className="text-[var(--cu-text-secondary)] text-[14px] leading-[1.5] mb-6">
            Begin getting organized and productive with tasks.
          </p>
          <button
            type="button"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-[var(--cu-radius-lg)] bg-[var(--cu-text-primary)] text-[var(--cu-bg-app)] text-[14px] font-medium hover:opacity-90 transition-opacity"
          >
            <PlusIcon className="w-4 h-4" />
            Create your first task
          </button>
        </div>

        {/* card carousel */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex gap-4">
            {ONBOARDING_CARDS.map((card) => (
              <OnboardingCard key={card.id} title={card.title} body={card.body} />
            ))}
          </div>
        </div>
      </div>

      {/* carousel controls */}
      <div className="flex items-center justify-center gap-2 mt-5">
        <button
          type="button"
          aria-label="Previous"
          className="w-8 h-8 rounded-full border border-[var(--cu-border-divider)] bg-[var(--cu-bg-menu)] flex items-center justify-center text-[var(--cu-text-muted)] hover:bg-[var(--cu-bg-hover)]"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          aria-label="Next"
          className="w-8 h-8 rounded-full border border-[var(--cu-border-divider)] bg-[var(--cu-bg-menu)] flex items-center justify-center text-[var(--cu-text-muted)] hover:bg-[var(--cu-bg-hover)]"
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
}
