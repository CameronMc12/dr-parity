import { HOME_USER } from '@/data/home-dashboard';
import { HomeTopBar } from './HomeTopBar';
import { MyTasksOnboarding } from './MyTasksOnboarding';
import { AgendaWidget } from './widgets/AgendaWidget';
import { MyWorkWidget } from './widgets/MyWorkWidget';
import { RecentsWidget } from './widgets/RecentsWidget';
import {
  AiStandupWidget,
  AssignedCommentsWidget,
  AssignedToMeWidget,
  PersonalListWidget,
  PrioritiesWidget,
} from './widgets/SmallWidgets';

/**
 * ClickUp Home / My Work dashboard main content. Renders the home page header,
 * the empty "My Tasks" onboarding hero, the greeting, and the widget grid.
 */
export function HomeDashboard() {
  return (
    <div className="flex flex-col h-full min-h-0">
      <HomeTopBar />

      <div className="flex-1 min-h-0 overflow-y-auto pb-16">
        <MyTasksOnboarding />

        <div className="px-6 pt-10">
          <h2 className="text-[var(--cu-text-primary)] text-[22px] font-bold mb-5">
            Good afternoon, {HOME_USER.name}
          </h2>

          {/*
            Widget grid — oracle uses grid-auto-flow:column (masonry-ish column
            flow): cards fill the first column top-to-bottom, then wrap into the
            next. We pin grid-template-rows to the tallest column's card count
            so the column-flow break lands where the oracle's does. Gap matches
            the oracle's 10px. Individual widgets are untouched.
          */}
          <div
            className="max-w-[1100px]"
            style={{
              display: 'grid',
              gridAutoFlow: 'column',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gridTemplateRows: 'repeat(3, min-content)',
              gap: 10,
            }}
          >
            {/* column 1 */}
            <RecentsWidget />
            <AssignedToMeWidget />
            <div aria-hidden />
            {/* column 2 */}
            <AgendaWidget />
            <AssignedCommentsWidget />
            <AiStandupWidget />
            {/* column 3 */}
            <MyWorkWidget />
            <PersonalListWidget />
            <PrioritiesWidget />
          </div>
        </div>
      </div>
    </div>
  );
}
