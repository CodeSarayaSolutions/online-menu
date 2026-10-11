"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppLanguage } from "@/types/cms";

interface LanguageState {
  language: AppLanguage;
  hasPreference: boolean;
  setLanguage: (lang: AppLanguage) => void;
  toggleLanguage: () => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      language: "bs",
      hasPreference: false,
      setLanguage: (lang) => set({ language: lang, hasPreference:true }),
      toggleLanguage: () =>
        set({ language: get().language === "en" ? "bs" : "en",hasPreference:true }),
    }),
    {
      name: "saraya-language",
    }
  )
);
