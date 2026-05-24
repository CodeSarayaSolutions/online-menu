"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const SESSION_MS = 45 * 60 * 1000;

type TableSessionState = {
  tableNumber: string | null;
  expiresAt: number | null;
  setTable: (tableNumber: string) => void;
  clearTable: () => void;
  isValid: () => boolean;
};

export const useTableSessionStore = create<TableSessionState>()(
  persist(
    (set, get) => ({
      tableNumber: null,
      expiresAt: null,

      setTable: (tableNumber) =>
        set({
          tableNumber: tableNumber.trim(),
          expiresAt: Date.now() + SESSION_MS,
        }),

      clearTable: () => set({ tableNumber: null, expiresAt: null }),

      isValid: () => {
        const { tableNumber, expiresAt } = get();
        if (!tableNumber || !expiresAt) return false;
        return Date.now() < expiresAt;
      },
    }),
    {
      name: "saraya_table_session",
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
