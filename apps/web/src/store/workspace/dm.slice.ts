/**
 * Direct-message slice. DM conversations live in a flat list; their messages are
 * bucketed by DM id (mirroring the channel/message split in chat.slice). Persists
 * through the workspace store's localStorage layer like every other slice.
 */

import type { StateCreator } from 'zustand';
import { nextId } from './ids';
import type { DirectMessage, DmMessage, WorkspaceState } from './types';

export interface DmActions {
  /** Open the DM for a member, creating it if one does not exist. Returns its id. */
  openOrCreateDM: (memberId: string) => string;
  sendDirectMessage: (dmId: string, text: string) => DmMessage;
}

/** True when a DM's participant set equals the given (current member, target) pair. */
function matchesParticipants(
  dm: DirectMessage,
  currentId: string,
  memberId: string,
): boolean {
  const wanted =
    memberId === currentId ? [currentId] : [currentId, memberId].sort();
  const have = [...dm.memberIds].sort();
  return have.length === wanted.length && have.every((id, i) => id === wanted[i]);
}

export const createDmSlice: StateCreator<WorkspaceState, [], [], DmActions> = (
  set,
  get,
) => ({
  openOrCreateDM: (memberId) => {
    const currentId = get().currentMemberId;
    const existing = get().dms.find((dm) =>
      matchesParticipants(dm, currentId, memberId),
    );
    if (existing) return existing.id;

    const id = nextId('dm', set, get);
    const memberIds =
      memberId === currentId ? [currentId] : [currentId, memberId].sort();
    const dm: DirectMessage = { id, memberIds };
    set((state) => ({
      dms: [...state.dms, dm],
      dmMessages: { ...state.dmMessages, [id]: [] },
    }));
    return id;
  },

  sendDirectMessage: (dmId, text) => {
    const id = nextId('dmsg', set, get);
    const message: DmMessage = {
      id,
      dmId,
      authorId: get().currentMemberId,
      text,
      createdAt: Date.now(),
    };
    set((state) => ({
      dmMessages: {
        ...state.dmMessages,
        [dmId]: [...(state.dmMessages[dmId] ?? []), message],
      },
    }));
    return message;
  },
});
