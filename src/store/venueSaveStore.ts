'use client';
import { create } from 'zustand';
type SaveState = { state: 'saving' | 'saved' | 'error'; conflict?: boolean };
export const useVenueSaveStore = create<{ venues: Record<string, SaveState>; setStatus: (venue: string, status: SaveState) => void }>(set => ({
  venues: {}, setStatus: (venue, status) => set(s => ({ venues: { ...s.venues, [venue]: status } })),
}));
