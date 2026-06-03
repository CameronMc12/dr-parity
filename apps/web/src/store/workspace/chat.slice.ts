/**
 * Chat slice. Channels live in a flat list; messages are bucketed by channelId.
 */

import type { StateCreator } from 'zustand';
import { nextId } from './ids';
import type { Channel, Message, WorkspaceState } from './types';

export interface ChatActions {
  createChannel: (name: string) => Channel;
  renameChannel: (id: string, name: string) => void;
  deleteChannel: (id: string) => void;
  sendMessage: (channelId: string, text: string) => Message;
}

export const createChatSlice: StateCreator<WorkspaceState, [], [], ChatActions> = (
  set,
  get,
) => ({
  createChannel: (name) => {
    const id = nextId('ch', set, get);
    const channel: Channel = { id, name };
    set((state) => ({
      channels: [...state.channels, channel],
      messages: { ...state.messages, [id]: [] },
    }));
    return channel;
  },

  renameChannel: (id, name) => {
    const next = name.trim();
    if (!next) return;
    set((state) => ({
      channels: state.channels.map((c) => (c.id === id ? { ...c, name: next } : c)),
    }));
  },

  deleteChannel: (id) => {
    set((state) => {
      const { [id]: _removed, ...messages } = state.messages;
      return {
        channels: state.channels.filter((c) => c.id !== id),
        messages,
        favorites: state.favorites.filter((nodeId) => nodeId !== id),
      };
    });
  },

  sendMessage: (channelId, text) => {
    const id = nextId('msg', set, get);
    const message: Message = {
      id,
      channelId,
      authorId: get().currentMemberId,
      text,
      createdAt: Date.now(),
    };
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: [...(state.messages[channelId] ?? []), message],
      },
    }));
    return message;
  },
});
