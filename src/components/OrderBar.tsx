"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ShoppingBag, ChevronRight } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useCmsData } from "@/hooks/useCmsData";
import { useTranslation } from "@/hooks/useTranslation";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { isDark } from "@/lib/color-utils";

const BTN_RADIUS = { rounded: "rounded-2xl", pill: "rounded-full", square: "rounded-xl" } as const;

export default function OrderBar() {
  const { venue } = useParams<{ venue: string }>();
  const venueSlug = decodeURIComponent(venue || "");
  const total = useCartStore((s) => s.getTotal());
  const count = useCartStore((s) => s.getItemCount());
  const { pageContent, componentStyles: cs } = useCmsData();
  const { t } = useTranslation();

  if (count === 0 || cs.viewOnlyMode) return null;

  const barRadius = BTN_RADIUS[cs.buttonStyle] || BTN_RADIUS.rounded;
  const isGlass = cs.orderBarStyle === "glass";
  const isGradient = cs.orderBarStyle === "gradient";
  const pageBgDark = isDark(cs.menuPageBgColor || "#F7F7F7");

  const barStyle: React.CSSProperties = isGlass
    ? { background: pageBgDark ? "rgba(30,30,30,0.85)" : "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }
    : isGradient
    ? { background: `linear-gradient(to right, ${cs.orderBarBgColor}, ${cs.orderBarBgColor}CC)` }
    : { backgroundColor: cs.orderBarBgColor };

  const textColor = isGlass ? (pageBgDark ? "#FFFFFF" : "#1E1E1E") : cs.orderBarTextColor;
  const subTextColor = isGlass ? (pageBgDark ? "#AAAAAA" : "#777777") : cs.orderBarTextColor + "B3";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 max-w-md md:max-w-3xl lg:max-w-6xl xl:max-w-7xl mx-auto p-4 md:p-5 z-50"
      >
        <Link href={`/${venueSlug}/cart`}>
          <motion.div
            whileTap={{ scale: 0.97 }}
            className={clsx("px-5 md:px-8 py-4 md:py-5 shadow-elevated flex items-center justify-between relative overflow-hidden", barRadius)}
            style={barStyle}
          >
            {/* Decorative glow */}
            {!isGlass && (
              <>
                <div className="absolute -top-8 -right-8 w-24 h-24 bg-white/10 rounded-full blur-xl" />
                <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-white/10 rounded-full blur-lg" />
              </>
            )}

            <div className="flex items-center gap-3 relative">
              <div className="relative">
                <ShoppingBag size={22} strokeWidth={2.5} className="md:w-6 md:h-6" style={{ color: textColor }} />
                <motion.span
                  key={count}
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-2.5 -right-2.5 text-[11px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center shadow-sm"
                  style={
                    isGlass
                      ? { backgroundColor: cs.orderBarBgColor, color: "#FFFFFF" }
                      : { backgroundColor: "#FFFFFF", color: cs.orderBarBgColor }
                  }
                >
                  {count}
                </motion.span>
              </div>
              <div>
                <span className="font-bold text-sm md:text-base block leading-tight" style={{ color: textColor }}>
                  {t(pageContent, "orderBarViewText")}
                </span>
                <span className="text-[11px] md:text-xs font-medium" style={{ color: subTextColor }}>
                  {count} {t(pageContent, "orderBarItemAddedText")}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 relative">
              <span className="font-extrabold text-xl md:text-2xl" style={{ color: textColor }}>
                {total.toFixed(2)} {pageContent.currencySymbol}
              </span>
              <ChevronRight size={18} style={{ color: subTextColor }} />
            </div>
          </motion.div>
        </Link>
      </motion.div>
    </AnimatePresence>
  );
}
