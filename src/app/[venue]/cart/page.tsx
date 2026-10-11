"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, ShoppingBag, Plus, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCartStore } from "@/store/cartStore";
import { useCmsData } from "@/hooks/useCmsData";
import { useTranslation } from "@/hooks/useTranslation";
import OrderItem from "@/components/OrderItem";
import Link from "next/link";
import { isDark, mutedText, subtleBorder, subtleSurface } from "@/lib/color-utils";

export default function CartPage() {
  const { venue } = useParams<{ venue: string }>();
  const venueSlug = decodeURIComponent(venue || "");
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const getTotal = useCartStore((s) => s.getTotal);
  const getItemCount = useCartStore((s) => s.getItemCount);
  const clearCart = useCartStore((s) => s.clearCart);
  const { pageContent, componentStyles: cs } = useCmsData();
  const { text, t } = useTranslation();

  // Redirect to menu in view-only mode
  useEffect(() => {
    if (cs.viewOnlyMode) router.replace(`/${venueSlug}`);
  }, [cs.viewOnlyMode, router, venueSlug]);

  if (cs.viewOnlyMode) return null;

  const total = getTotal();
  const count = getItemCount();

  // ─── Theme-aware color derivations ──────────────────
  const pageBg = cs.cartPageBgColor || "#F7F7F7";
  const cardBg = cs.cartCardBgColor || "#FFFFFF";
  const titleColor = cs.cartTitleColor || "#1E1E1E";
  const accent = cs.cartAccentColor || "#F4B400";
  const pageMuted = mutedText(pageBg);
  const cardMuted = mutedText(cardBg);
  const pageBorder = subtleBorder(pageBg);
  const cardBorder = subtleBorder(cardBg);
  const cardSurface = subtleSurface(cardBg);

  // Delete/clear button color
  const dangerBg = isDark(pageBg) ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.08)";
  const dangerText = isDark(pageBg) ? "#F87171" : "#DC2626";

  // Service note colors: green-tinted
  const serviceBg = isDark(cardBg) ? "rgba(34,197,94,0.1)" : "rgba(34,197,94,0.06)";
  const serviceText = isDark(cardBg) ? "#86EFAC" : "#166534";

  return (
    <div className="pb-36 min-h-screen" style={{ backgroundColor: pageBg }}>
      {/* ── Header ─────────────────────────────────── */}
      <div style={{ backgroundColor: cardBg, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
        <div className="flex items-center gap-3 px-4 md:px-6 lg:px-8 pt-6 pb-4">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => router.back()}
            className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: cardSurface }}
          >
            <ArrowLeft size={20} className="md:w-6 md:h-6" style={{ color: titleColor }} />
          </motion.button>
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl lg:text-3xl font-extrabold" style={{ color: titleColor }}>{t(pageContent, "cartTitle")}</h1>
            <p className="text-[11px] md:text-xs font-medium mt-0.5" style={{ color: cardMuted }}>
              {count > 0
                ? `${count} ${text("stavki u narudžbi","items in your order")}`
                : text("Vaša narudžba je prazna","Your order is empty")}
            </p>
          </div>
          {items.length > 0 && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={clearCart}
              className="flex items-center gap-1 text-xs md:text-sm px-3 md:px-4 py-1.5 md:py-2 rounded-full transition"
              style={{ backgroundColor: dangerBg, color: dangerText }}
            >
              <Trash2 size={12} />
              {t(pageContent, "clearButtonText")}
            </motion.button>
          )}
        </div>
      </div>

      {/* ── Content ────────────────────────────────── */}
      {items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-24 px-6 text-center"
        >
          <motion.div
            initial={{ y: -10 }}
            animate={{ y: 10 }}
            transition={{ repeat: Infinity, repeatType: "reverse", duration: 2 }}
            className="w-24 h-24 md:w-32 md:h-32 rounded-3xl flex items-center justify-center mb-6"
            style={{ backgroundColor: accent + "18" }}
          >
            <ShoppingBag size={40} className="md:w-14 md:h-14" style={{ color: accent }} />
          </motion.div>
          <h2 className="text-xl md:text-2xl font-extrabold" style={{ color: titleColor }}>{t(pageContent, "emptyCartTitle")}</h2>
          <p className="text-sm md:text-base mt-2 max-w-[240px] md:max-w-[320px] leading-relaxed" style={{ color: pageMuted }}>
            {t(pageContent, "emptyCartDescription")}
          </p>
          <Link href={`/${venueSlug}`}>
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="mt-8 px-8 md:px-12 py-3.5 md:py-4 rounded-2xl font-bold text-sm md:text-base"
              style={{
                background: `linear-gradient(to right, ${accent}, ${accent}CC)`,
                color: "#FFFFFF",
                boxShadow: `0 0 20px ${accent}40`,
              }}
            >
              {t(pageContent, "browseMenuText")}
            </motion.button>
          </Link>
        </motion.div>
      ) : (
        <>
          {/* Two-column layout on desktop */}
          <div className="lg:flex lg:gap-6 lg:px-8 lg:mt-6">
            {/* Left column: items */}
            <div className="lg:flex-1">
              {/* Items */}
              <div className="px-4 md:px-6 lg:px-0 mt-4 space-y-3 md:space-y-4">
                <AnimatePresence mode="popLayout">
                  {items.map((item, i) => (
                    <OrderItem key={item.cartKey || item.id} item={item} index={i} />
                  ))}
                </AnimatePresence>
              </div>

              {/* Add more items link */}
              <div className="px-4 md:px-6 lg:px-0 mt-4">
                <Link href={`/${venueSlug}`}>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    className="w-full flex items-center justify-center gap-2 py-3.5 md:py-4 rounded-2xl border-2 border-dashed transition"
                    style={{ borderColor: pageBorder, color: pageMuted }}
                  >
                    <Plus size={16} />
                    <span className="text-sm md:text-base font-semibold">{t(pageContent, "addMoreItemsText")}</span>
                  </motion.button>
                </Link>
              </div>
            </div>

            {/* Right column: summary (desktop) */}
            <div className="lg:w-[380px] xl:w-[420px] lg:shrink-0">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-4 md:px-6 lg:px-0 mt-6 lg:mt-0 lg:sticky lg:top-6"
              >
                <div className="rounded-3xl p-5 md:p-6" style={{ backgroundColor: cardBg, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                  <h3 className="text-xs md:text-sm font-bold uppercase tracking-wider mb-3" style={{ color: cardMuted }}>
                    {t(pageContent, "orderSummaryTitle")}
                  </h3>

                  {/* Item breakdown */}
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={item.cartKey || item.id} className="flex justify-between text-sm">
                        <span style={{ color: cardMuted }}>
                          {item.quantity}× {item.name}
                        </span>
                        <span className="font-semibold" style={{ color: titleColor }}>
                          {(item.price * item.quantity).toFixed(2)} {pageContent.currencySymbol}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Divider */}
                  <div className="my-3 h-px" style={{ background: `linear-gradient(to right, transparent, ${cardBorder}, transparent)` }} />

                  {/* Subtotal */}
                  <div className="flex justify-between text-sm">
                    <span style={{ color: cardMuted }}>{text("Iznos (","Subtotal (")}{count} {text("stavki)","items)")}</span>
                    <span className="font-semibold" style={{ color: titleColor }}>{total.toFixed(2)} {pageContent.currencySymbol}</span>
                  </div>

                  {/* Service note */}
                  <div className="mt-3 rounded-xl px-3 py-2 flex items-center gap-2" style={{ backgroundColor: serviceBg }}>
                    <span className="text-sm">🍽️</span>
                    <span className="text-[11px] font-medium" style={{ color: serviceText }}>
                      {t(pageContent, "dineInServiceNote")}
                    </span>
                  </div>

                  {/* Total */}
                  <div className="mt-4 flex justify-between items-baseline">
                    <span className="text-base md:text-lg font-extrabold" style={{ color: titleColor }}>{text("Ukupno","Total")}</span>
                    <span className="text-2xl md:text-3xl font-extrabold" style={{ color: accent }}>
                      {total.toFixed(2)} {pageContent.currencySymbol}
                    </span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </>
      )}

      {/* ── Place Order Button ─────────────────────── */}
      {items.length > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 max-w-md md:max-w-3xl lg:max-w-6xl xl:max-w-7xl mx-auto p-4 md:p-5 z-50"
          style={{
            backgroundColor: cardBg + "F2",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderTop: `1px solid ${cardBorder}`,
            boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
          }}
        >
          <Link href={`/${venueSlug}/checkout`}>
            <motion.button
              whileTap={{ scale: 0.97 }}
              className="w-full py-4 md:py-5 rounded-2xl text-base md:text-lg font-extrabold flex items-center justify-center gap-2"
              style={{
                background: `linear-gradient(to right, ${accent}, ${accent}CC)`,
                color: "#FFFFFF",
                boxShadow: `0 0 20px ${accent}40`,
              }}
            >
              <span>{t(pageContent, "placeOrderText")}</span>
              <span className="px-3 py-0.5 rounded-full text-sm" style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>
                {total.toFixed(2)} {pageContent.currencySymbol}
              </span>
            </motion.button>
          </Link>
        </div>
      )}
    </div>
  );
}
