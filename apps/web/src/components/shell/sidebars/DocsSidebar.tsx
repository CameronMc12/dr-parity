'use client';

import { DocsHubRail } from '@/components/pages/docs-hub/DocsHubRail';

/**
 * Docs shell sidebar. Renders the Docs hub left rail (All Docs / My Docs /
 * Shared with me / Private / Meeting Notes / Archived, plus Favorites and
 * Popular Wikis), matching the oracle where these collections live in the
 * global-sidebar column beside the docs table. The selected collection is held
 * in the shared docs-hub store so the table reacts to it.
 */
export function DocsSidebar() {
  return <DocsHubRail />;
}
