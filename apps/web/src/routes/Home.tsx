import { MyTasksOnboarding } from '@/components/home/MyTasksOnboarding';

/**
 * Home route. The real ClickUp home redirects to "My Work" which, with no
 * tasks assigned, renders the "It all begins with tasks" onboarding hero
 * (the parity oracle). We mirror that empty-state hero 1:1.
 */
export function Home(_props: { wsId?: string }) {
  return <MyTasksOnboarding />;
}
