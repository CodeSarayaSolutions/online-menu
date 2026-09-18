"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChefHat,
  MessageSquare,
  Clock,
  Utensils,
  PartyPopper,
  QrCode,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCartStore } from "@/store/cartStore";
import { useTableSessionStore } from "@/store/tableSessionStore";
import { useCmsData } from "@/hooks/useCmsData";
import { useTranslation } from "@/hooks/useTranslation";
import { isDark, mutedText, subtleBorder, subtleSurface, contrastText } from "@/lib/color-utils";

type PaymentMethod = "cash" | "card";

export default function CheckoutPage() {
  const { venue } = useParams<{ venue: string }>();
  const venueSlug = decodeURIComponent(venue || "");
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const getTotal = useCartStore((s) => s.getTotal);
  const getItemCount = useCartStore((s) => s.getItemCount);
  const clearCart = useCartStore((s) => s.clearCart);
  const tableNumber = useTableSessionStore((s) => s.tableNumber);
  const tableValid = useTableSessionStore((s) => s.isValid());
  const clearTable = useTableSessionStore((s) => s.clearTable);
  const { pageContent, componentStyles: cs } = useCmsData();
  const { t } = useTranslation();

  // Redirect to menu in view-only mode
  useEffect(() => {
    if (cs.viewOnlyMode) router.replace(`/${venueSlug}`);
  }, [cs.viewOnlyMode, router, venueSlug]);

  if (cs.viewOnlyMode) return null;

  const [confirmedTable, setConfirmedTable] = useState("");
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [isPlaced, setIsPlaced] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const total = getTotal();
  const count = getItemCount();

  // ─── Theme-aware color derivations ──────────────────
  const pageBg = cs.checkoutPageBgColor || "#F7F7F7";
  const cardBg = cs.checkoutCardBgColor || "#FFFFFF";
  const accent = cs.checkoutAccentColor || "#F4B400";
  // Use cart title color for checkout titles too (consistent)
  const titleColor = cs.cartTitleColor || contrastText(cardBg);
  const pageMuted = mutedText(pageBg);
  const cardMuted = mutedText(cardBg);
  const cardBorder = subtleBorder(cardBg);
  const cardSurface = subtleSurface(cardBg);
  const pageSurface = subtleSurface(pageBg);
  const pageIsDark = isDark(pageBg);
  const cardIsDark = isDark(cardBg);

  // Step completion color: green tinted for current theme
  const successBg = cardIsDark ? "rgba(34,197,94,0.15)" : "#22C55E";
  const successText = "#FFFFFF";
  const stepDoneBg = "#22C55E";

  // Service note colors
  const serviceBg = cardIsDark ? "rgba(34,197,94,0.1)" : "rgba(34,197,94,0.06)";
  const serviceText = cardIsDark ? "#86EFAC" : "#166534";
  const serviceTextSub = cardIsDark ? "#6EE7B7" : "#15803D";

  // Disabled button
  const disabledBg = cardIsDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const disabledText = cardIsDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)";

  const handleConfirm = async () => {
    if (!venueSlug || !tableValid || !tableNumber) return;
    setIsSending(true);
    setSendError("");
    try {
      const id = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          restaurantId: venueSlug,
          items: [...items],
          tableNumber,
          kitchenNote: note.trim(),
          paymentMethod,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error ?? "Narudžba nije poslana");
      }
      setConfirmedTable(tableNumber);
      setIsPlaced(true);
      clearCart();
      clearTable();
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Narudžba nije poslana");
      setIsSending(false);
      return;
    }
    setIsSending(false);
  };

  const displayTable = confirmedTable || tableNumber || "";

  // ══════════════════════════════════════════════
  // ORDER CONFIRMED SCREEN
  // ══════════════════════════════════════════════
  if (isPlaced) {
    // Use a gradient that respects the theme
    const confirmBg = pageIsDark
      ? `linear-gradient(to bottom, ${pageBg}, ${cardBg})`
      : `linear-gradient(to bottom, rgba(34,197,94,0.06), ${pageBg})`;
    const confirmTitleColor = contrastText(pageBg);
    const confirmMuted = mutedText(pageBg);
    const confirmCardBg = cardBg;
    const confirmCardMuted = mutedText(cardBg);
    const confirmStepDone = "#22C55E";

    return (
      <div
        className="min-h-screen flex items-center justify-center p-6 md:p-10"
        style={{ background: confirmBg }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", damping: 20 }}
          className="text-center max-w-sm md:max-w-md w-full"
        >
          {/* Success icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
            className="w-28 h-28 md:w-32 md:h-32 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: confirmStepDone, boxShadow: "0 8px 32px rgba(34,197,94,0.3)" }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.35, type: "spring" }}
            >
              <Check size={56} className="md:w-16 md:h-16" strokeWidth={3} style={{ color: "#FFFFFF" }} />
            </motion.div>
          </motion.div>

          {/* Confetti emoji */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex justify-center gap-2 mb-4 items-center"
          >
            <PartyPopper size={24} style={{ color: accent }} />
            <span className="text-2xl md:text-3xl font-extrabold" style={{ color: confirmTitleColor }}>{t(pageContent, "orderSentTitle")}</span>
            <PartyPopper size={24} style={{ color: accent, transform: "scaleX(-1)" }} />
          </motion.div>

          {/* Status card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-3xl p-6 md:p-8 mt-4"
            style={{ backgroundColor: confirmCardBg, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}
          >
            {/* Timeline */}
            <div className="space-y-4 text-left">
              {/* Step 1: Order received */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: confirmStepDone }}>
                  <Check size={14} className="text-white" strokeWidth={3} />
                </div>
                <div>
                  <p className="text-sm md:text-base font-bold" style={{ color: contrastText(confirmCardBg) }}>{t(pageContent, "orderReceivedText")}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: confirmCardMuted }}>{t(pageContent, "orderReceivedDesc")}</p>
                </div>
              </div>

              {/* Connection line */}
              <div className="ml-4 w-px h-4" style={{ background: `linear-gradient(to bottom, ${confirmStepDone}, ${accent})` }} />

              {/* Step 2: Preparing */}
              <div className="flex items-start gap-3">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: accent + "20" }}
                >
                  <ChefHat size={16} style={{ color: accent }} />
                </motion.div>
                <div>
                  <p className="text-sm md:text-base font-bold" style={{ color: contrastText(confirmCardBg) }}>{t(pageContent, "preparingFoodText")}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: confirmCardMuted }}>{t(pageContent, "preparingFoodDesc")}</p>
                </div>
              </div>

              {/* Connection line */}
              <div className="ml-4 w-px h-4" style={{ background: `linear-gradient(to bottom, ${accent}, ${cardBorder})` }} />

              {/* Step 3: Delivery to table */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: cardSurface }}>
                  <Utensils size={14} style={{ color: cardMuted }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: cardMuted }}>{t(pageContent, "comingToTableText")}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: cardMuted }}>
                    A waiter will bring it to{" "}
                    <span className="font-bold" style={{ color: contrastText(confirmCardBg) }}>Stol {displayTable}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Estimated time */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-5 rounded-2xl p-3 flex items-center justify-center gap-2"
              style={{ backgroundColor: cardSurface }}
            >
              <Clock size={14} style={{ color: accent }} />
              <span className="text-xs font-bold" style={{ color: contrastText(confirmCardBg) }}>
                {t(pageContent, "estimatedWaitText")}
              </span>
            </motion.div>
          </motion.div>

          {/* Back to menu */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push(`/${venueSlug}`)}
            className="mt-6 px-8 py-4 md:py-5 rounded-2xl font-extrabold w-full text-sm md:text-base"
            style={{
              background: `linear-gradient(to right, ${accent}, ${accent}CC)`,
              color: "#FFFFFF",
              boxShadow: `0 0 20px ${accent}40`,
            }}
          >
            {t(pageContent, "backToMenuText")}
          </motion.button>

          {/* Order more note */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-[11px] mt-3"
            style={{ color: confirmMuted }}
          >
            {t(pageContent, "orderMoreNote")}
          </motion.p>
        </motion.div>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // CONFIRM ORDER SCREEN
  // ══════════════════════════════════════════════
  return (
    <div className="pb-36 min-h-screen" style={{ backgroundColor: pageBg }}>
      {/* ── Header ─────────────────────── */}
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
          <div>
            <h1 className="text-xl md:text-2xl lg:text-3xl font-extrabold" style={{ color: titleColor }}>{t(pageContent, "confirmOrderTitle")}</h1>
            <p className="text-[11px] md:text-xs font-medium mt-0.5" style={{ color: cardMuted }}>
              {t(pageContent, "confirmOrderSubtitle")}
            </p>
          </div>
        </div>

        {/* Progress steps */}
        <div className="px-4 md:px-6 lg:px-8 pb-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: stepDoneBg }}>
                <Check size={12} strokeWidth={3} style={{ color: "#FFFFFF" }} />
              </div>
              <span className="text-[11px] font-semibold" style={{ color: stepDoneBg }}>Menu</span>
            </div>
            <div className="h-px flex-1" style={{ backgroundColor: stepDoneBg }} />
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: stepDoneBg }}>
                <Check size={12} strokeWidth={3} style={{ color: "#FFFFFF" }} />
              </div>
              <span className="text-[11px] font-semibold" style={{ color: stepDoneBg }}>Order</span>
            </div>
            <div className="h-px flex-1" style={{ backgroundColor: tableValid ? stepDoneBg : cardBorder }} />
            <div className="flex items-center gap-1.5">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                style={{
                  backgroundColor: tableValid ? accent : cardSurface,
                  color: tableValid ? "#FFFFFF" : cardMuted,
                }}
              >
                3
              </div>
              <span className="text-[11px] font-semibold" style={{ color: tableValid ? accent : cardMuted }}>
                Confirm
              </span>
            </div>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 md:px-6 lg:px-8 mt-4"
      >
        {/* Two-column layout on desktop */}
        <div className="lg:flex lg:gap-6 space-y-4 lg:space-y-0">
          {/* Left column: Table + Kitchen Note */}
          <div className="lg:flex-1 space-y-4">
            {/* ── Table (QR session only) ─────────── */}
            <div className="rounded-3xl p-5 md:p-6" style={{ backgroundColor: cardBg, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <div className="flex items-center gap-2 mb-1">
                <QrCode size={16} className="md:w-5 md:h-5" style={{ color: accent }} />
                <h3 className="text-base md:text-lg font-extrabold" style={{ color: titleColor }}>{t(pageContent, "yourTableTitle")}</h3>
              </div>

              {!tableValid ? (
                <motion.div
                  className="mt-3 rounded-2xl px-4 py-4 flex items-start gap-3"
                  style={{ backgroundColor: cardSurface, border: `1px dashed ${cardBorder}` }}
                >
                  <QrCode size={22} className="shrink-0 mt-0.5" style={{ color: accent }} />
                  <div>
                    <p className="text-sm font-bold" style={{ color: titleColor }}>
                      Skenirajte QR kod na stolu da biste naručili
                    </p>
                    <p className="text-[11px] mt-1" style={{ color: cardMuted }}>
                      Broj stola se automatski prepoznaje nakon skeniranja QR koda na stolu.
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  className="mt-3 rounded-2xl px-4 py-4 flex items-center gap-3"
                  style={{ backgroundColor: serviceBg }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: stepDoneBg }}
                  >
                    <Check size={18} strokeWidth={3} style={{ color: "#FFFFFF" }} />
                  </div>
                  <div>
                    <p className="text-lg font-extrabold" style={{ color: titleColor }}>
                      Stol {tableNumber}
                    </p>
                    <p className="text-[11px] font-medium" style={{ color: serviceTextSub }}>
                      Sesija aktivna · spremno za narudžbu
                    </p>
                  </div>
                </motion.div>
              )}
            </div>

            {/* ── Note for Kitchen ─────────────────── */}
            <div className="rounded-3xl p-5 md:p-6" style={{ backgroundColor: cardBg, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare size={16} className="md:w-5 md:h-5" style={{ color: accent }} />
                <h3 className="text-base md:text-lg font-extrabold" style={{ color: titleColor }}>{t(pageContent, "kitchenNoteTitle")}</h3>
                <span
                  className="text-[10px] md:text-xs px-2 py-0.5 rounded-full ml-auto"
                  style={{ color: cardMuted, backgroundColor: cardSurface }}
                >
                  Optional
                </span>
              </div>
              <p className="text-[11px] md:text-xs mb-3 ml-6" style={{ color: cardMuted }}>
                {t(pageContent, "kitchenNoteDescription")}
              </p>
              <textarea
                placeholder={t(pageContent, "kitchenNotePlaceholder")}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 md:py-4 rounded-2xl text-sm md:text-base outline-none transition resize-none"
                style={{
                  backgroundColor: cardSurface,
                  color: titleColor,
                  border: `1px solid transparent`,
                }}
                onFocus={(e) => (e.target.style.border = `1px solid ${accent}40`)}
                onBlur={(e) => (e.target.style.border = "1px solid transparent")}
              />
            </div>
          </div>

          {/* Right column: Order Summary */}
          <div className="lg:w-[380px] xl:w-[420px] lg:shrink-0">
            <div className="rounded-3xl p-5 md:p-6 lg:sticky lg:top-6" style={{ backgroundColor: cardBg, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <h3 className="text-xs md:text-sm font-bold uppercase tracking-wider mb-3" style={{ color: cardMuted }}>
                {t(pageContent, "orderSummaryTitle")}
              </h3>

              <div className="space-y-2.5">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-10 h-10 md:w-12 md:h-12 rounded-lg object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold line-clamp-1" style={{ color: titleColor }}>{item.name}</p>
                      <p className="text-[11px]" style={{ color: cardMuted }}>Qty: {item.quantity}</p>
                    </div>
                    <span className="text-sm font-bold shrink-0" style={{ color: titleColor }}>
                      {(item.price * item.quantity).toFixed(2)} {pageContent.currencySymbol}
                    </span>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div className="my-4 h-px" style={{ background: `linear-gradient(to right, transparent, ${cardBorder}, transparent)` }} />

              {/* Dine-in badge */}
              <div className="rounded-xl px-3 py-2.5 flex items-center gap-2 mb-3" style={{ backgroundColor: serviceBg }}>
                <span className="text-sm">🍽️</span>
                <div>
                  <span className="text-[11px] font-bold block" style={{ color: serviceText }}>{t(pageContent, "dineInBadgeTitle")}</span>
                  <span className="text-[10px]" style={{ color: serviceTextSub }}>{t(pageContent, "dineInBadgeSubtext")}</span>
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-between items-baseline pt-1">
                <span className="text-base md:text-lg font-extrabold" style={{ color: titleColor }}>Total</span>
                <span className="text-2xl md:text-3xl font-extrabold" style={{ color: accent }}>
                  {total.toFixed(2)} {pageContent.currencySymbol}
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Confirm Button ─────────────────────── */}
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
        {/* Table selected indicator */}
        <AnimatePresence>
          {tableValid && tableNumber && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center justify-center gap-2 text-[11px] mb-2.5"
              style={{ color: cardMuted }}
            >
              <Check size={12} style={{ color: accent }} />
              <span>
                Stol <strong style={{ color: titleColor }}>{tableNumber}</strong> · {count} item{count !== 1 ? "s" : ""} · <strong style={{ color: accent }}>{total.toFixed(2)} {pageContent.currencySymbol}</strong>
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-3 mb-4">
          <button
            type="button"
            onClick={() => setPaymentMethod("cash")}
            className="flex-1 py-3 rounded-xl border-2 font-semibold text-sm transition"
            style={{
              borderColor: paymentMethod === "cash" ? accent : cardBorder,
              backgroundColor: paymentMethod === "cash" ? accent + "20" : cardSurface,
              color: paymentMethod === "cash" ? accent : cardMuted,
            }}
          >
            💵 Gotovina
          </button>
          <button
            type="button"
            disabled
            className="flex-1 py-3 rounded-xl border-2 font-semibold text-sm opacity-40 cursor-not-allowed relative"
            style={{ borderColor: "#888", color: "#888" }}
          >
            💳 Online plaćanje
            <span className="absolute -top-2 -right-2 bg-primary text-white text-[9px] px-1.5 py-0.5 rounded-full">
              Uskoro
            </span>
          </button>
        </div>

        {sendError ? (
          <p className="text-sm font-semibold text-center mb-3" style={{ color: "#DC2626" }}>
            {sendError}
          </p>
        ) : null}

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleConfirm}
          disabled={!tableValid || isSending}
          className="w-full py-4 md:py-5 rounded-2xl text-base md:text-lg font-extrabold transition-all duration-300 flex items-center justify-center gap-2"
          style={
            !tableValid
              ? { backgroundColor: disabledBg, color: disabledText, cursor: "not-allowed" }
              : isSending
              ? { backgroundColor: accent, color: "#FFFFFF" }
              : {
                  background: `linear-gradient(to right, ${accent}, ${accent}CC)`,
                  color: "#FFFFFF",
                  boxShadow: `0 0 20px ${accent}40`,
                }
          }
        >
          {isSending ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-5 h-5 border-2 rounded-full"
              style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#FFFFFF" }}
            />
          ) : tableValid ? (
            <>
              <ChefHat size={18} />
              {t(pageContent, "sendToKitchenText")}
            </>
          ) : (
            <>
              <QrCode size={18} />
              Skenirajte QR kod
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}
