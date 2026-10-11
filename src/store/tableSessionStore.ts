"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";



type TableSessionState = {
  tableNumber: string | null;
  tableId: string | null;
  venue: string | null;
  activateVenue: (venue: string) => void;
  expiresAt: number | null;
  setTable: (tableNumber: string, tableId: string, expiresAt: number) => void;
  clearTable: () => void;
  isValid: () => boolean;
};

export const useTableSessionStore = create<TableSessionState>()(
  persist(
    (set, get) => ({
      tableNumber: null,
      tableId: null,
      venue: null,
      activateVenue: (venue) => { if (get().venue !== venue) set({venue,tableNumber:null,tableId:null,expiresAt:null}); },
      expiresAt: null,

      setTable: (tableNumber,tableId,expiresAt) =>
        set({
          tableNumber: tableNumber.trim(),
          tableId,
          expiresAt,
        }),

      clearTable: () => set({ tableNumber: null, tableId: null, expiresAt: null }),

      isValid: () => {
        const { tableNumber, expiresAt } = get();
        if (!tableNumber || !expiresAt) return false;
        return Date.now() < expiresAt;
      },
    }),
    {
      name: "saraya_table_session_v2",
      storage: createJSONStorage(() => sessionStorage),
      onRehydrateStorage: () => (state) => {
        if (!state?.tableNumber || !state.expiresAt) return;
        if (Date.now() >= state.expiresAt) {
          state.clearTable();
        }
      },
    }
  )
);
