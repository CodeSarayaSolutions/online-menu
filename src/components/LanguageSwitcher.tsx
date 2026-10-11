"use client";

import { useLanguageStore } from "@/store/languageStore";
import { useCmsStore } from "@/store/cmsStore";
import { isDark } from "@/lib/color-utils";
import { motion } from "framer-motion";

/**
 * Floating EN / BA language toggle pill – bottom-left corner.
 * Theme-aware: adapts glass style to dark / light pages.
 */
export default function LanguageSwitcher() {
  const { language, toggleLanguage } = useLanguageStore();
  const cs = useCmsStore((s) => s.componentStyles);

  const pageBg = cs?.menuPageBgColor || "#FFFFFF";
  const accentColor = cs?.cardPriceColor || "#F4B400";
  const dark = isDark(pageBg);

  const isEn = language === "en";

  return (
    <motion.button
      type="button"
      aria-label={isEn ? "Switch to Bosnian" : "Prebaci na engleski"}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.3 }}
      className="min-h-[44px] fixed z-50 bottom-4 left-4 flex items-center rounded-full backdrop-blur-xl overflow-hidden cursor-pointer select-none"
      style={{
        backgroundColor: dark
          ? "rgba(0,0,0,0.45)"
          : "rgba(255,255,255,0.88)",
        border: `1px solid ${dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)"}`,
        boxShadow: dark
          ? "0 4px 24px rgba(0,0,0,0.3)"
          : "0 4px 20px rgba(0,0,0,0.08)",
      }}
      onClick={toggleLanguage}
      title={isEn ? "Switch to Bosnian" : "Prebaci na engleski"}
    >
      {/* EN side */}
      <span
        className="relative z-10 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider transition-colors duration-200"
        style={{
          color: isEn ? "#FFFFFF" : dark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.35)",
        }}
      >
        EN
      </span>

      {/* BA side */}
      <span
        className="relative z-10 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider transition-colors duration-200"
        style={{
          color: !isEn ? "#FFFFFF" : dark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.35)",
        }}
      >
        BA
      </span>

      {/* Sliding highlight pill */}
      <motion.div
        layout
        className="absolute top-[3px] bottom-[3px] rounded-full"
        style={{
          backgroundColor: accentColor,
          width: "calc(50% - 3px)",
          left: isEn ? "3px" : "calc(50%)",
        }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </motion.button>
  );
}
