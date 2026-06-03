import { GlobalSidebar } from './GlobalSidebar';
import { DASHBOARDS_SECTION } from '@/data/sidebar-sections';

export function DashboardsSidebar() {
  return <GlobalSidebar section={DASHBOARDS_SECTION} />;
}
