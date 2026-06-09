/**
 * Purge — deletes ONLY the DR-PARITY-SEED space (and everything under it via
 * cascading space delete). Hard guard: refuses if the resolved space name does
 * not start with the SEED_MARKER, so we can never delete a real workspace space.
 */

import { ClickUpClient } from './clickup-api.js';
import { SEED_MARKER, type SeedFixture } from './types.js';

export interface PurgeResult {
  deletedSpaceId: string | null;
  reason: string;
}

export async function purgeSeed(
  client: ClickUpClient,
  fixture: SeedFixture,
  teamId: string,
  log: (msg: string) => void,
): Promise<PurgeResult> {
  const spaces = await client.listSpaces(teamId);
  const target = spaces.find((s) => s.name === fixture.space.name);

  if (!target) {
    return { deletedSpaceId: null, reason: `No space named "${fixture.space.name}" found. Nothing to purge.` };
  }

  if (!target.name.startsWith(SEED_MARKER)) {
    throw new Error(
      `Refusing to purge: space "${target.name}" does not start with the marker "${SEED_MARKER}".`,
    );
  }

  log(`purging space ${target.name} (${target.id})`);
  await client.deleteSpace(target.id);
  log(`deleted space ${target.id}`);
  return { deletedSpaceId: target.id, reason: 'Deleted seed space and all children.' };
}
