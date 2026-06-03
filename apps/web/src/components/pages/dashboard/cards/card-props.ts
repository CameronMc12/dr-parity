/**
 * Shared prop contract every card renderer receives. The grid resolves a card's
 * type to its renderer via the registry and passes this shape. `listId` is the
 * resolved underlying list (real task source); `viewId` is the dashboard's URL
 * token; `card` is the live store record (geometry + config + filters).
 */

import type { DashboardCard } from '@/store/dashboard';

export interface CardRenderProps {
  card: DashboardCard;
  listId: string;
  viewId: string;
}
