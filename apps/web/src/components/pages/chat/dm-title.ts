/**
 * Derive a DM conversation's display title + the "other" member to show. For the
 * self-DM (only the owner participates) ClickUp shows "<name> — You"; for a 1:1
 * it shows the other member's name.
 */

import type { DirectMessage, Member } from '@/store/workspace/types';

export interface DmDisplay {
  title: string;
  /** The member whose avatar/online dot represents this DM. */
  other: Member | undefined;
  isSelf: boolean;
}

export function dmDisplay(
  dm: DirectMessage,
  currentMemberId: string,
  memberById: Record<string, Member>,
): DmDisplay {
  const others = dm.memberIds.filter((id) => id !== currentMemberId);
  if (others.length === 0) {
    const me = memberById[currentMemberId];
    return {
      title: me ? `${me.name} — You` : 'You',
      other: me,
      isSelf: true,
    };
  }
  const otherId = others[0];
  const other = otherId ? memberById[otherId] : undefined;
  return {
    title: other?.name ?? 'Direct Message',
    other,
    isSelf: false,
  };
}
