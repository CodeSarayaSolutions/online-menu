"use client";

import { useState, useEffect, useRef } from "react";
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
  const tableId = useTableSessionStore((s) => s.tableId);
  const tableNumber = useTableSessionStore((s) => s.tableNumber);
  const tableValid = useTableSessionStore((s) => s.isValid());
  const clearTable = useTableSessionStore((s) => s.clearTable);
  const { pageContent, componentStyles: cs } = useCmsData();
  const { text, t } = useTranslation();

  // Redirect to menu in view-only mode
  useEffect(() => {
    if (cs.viewOnlyMode) router.replace(`/${venueSlug}`);
  }, [cs.viewOnlyMode, router, venueSlug]);

  const [sendError,setSendError]=useState(false);
  const [confirmedTable, setConfirmedTable] = useState("");
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [isPlaced, setIsPlaced] = useState(false);
  const [placedOrder,setPlacedOrder]=useState<{id:string;status:string;total:number;estimated_minutes?:number|null}|null>(null);
  useEffect(()=>{
    if(items.length)return;
    try{const saved=JSON.parse(sessionStorage.getItem('onm_receipt:'+venueSlug)??'null');if(!saved||Date.now()-saved.createdAt>7200000)return;
      let cancelled=false;void fetch('/api/guest/orders?'+new URLSearchParams({venue:venueSlug,id:saved.id}),{credentials:'include',cache:'no-store'}).then(async response=>{if(!response.ok)return;const order=await response.json();if(!cancelled){setPlacedOrder(order);setConfirmedTable(saved.table);setIsPlaced(true);}}).catch(()=>{});return()=>{cancelled=true;};
    }catch{}
  },[venueSlug,items.length]);
  const attempt=useRef<{payload:string;key:string}|null>(null);
  useEffect(()=>{
    if(!placedOrder?.id)return;
    const poll=()=>{if(document.hidden)return;void fetch('/api/guest/orders?'+new URLSearchParams({venue:venueSlug,id:placedOrder.id}),{credentials:'include',cache:'no-store'}).then(async r=>{if(r.ok)setPlacedOrder(await r.json());}).catch(()=>{});};
    const timer=setInterval(poll,10000);window.addEventListener('focus',poll);return()=>{clearInterval(timer);window.removeEventListener('focus',poll);};
  },[placedOrder?.id,venueSlug]);
  const [isSending, setIsSending] = useState(false);

  if (cs.viewOnlyMode) return null;

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
    if (!venueSlug || !tableValid || !tableNumber || !tableId || !items.length || isSending) return;
    setIsSending(true);
    setSendError(false);
    try {
      const payload=JSON.stringify({venue:venueSlug,tableId,items,note:note.trim()});
      if(attempt.current?.payload!==payload)attempt.current={payload,key:crypto.randomUUID()};
      const response=await fetch('/api/guest/orders',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({...JSON.parse(payload),requestKey:attempt.current.key})});
      if(!response.ok){if(response.status===401)clearTable();throw new Error('Order unavailable');}
      const saved=await response.json();setPlacedOrder(saved);
      sessionStorage.setItem("onm_receipt:"+venueSlug,JSON.stringify({id:saved.id,table:tableNumber,createdAt:Date.now()}));
      setConfirmedTable(tableNumber);
      setIsPlaced(true);
      clearCart();
      clearTable();
    } catch {
      setSendError(true);
      setIsSending(false);
      return;
    }
    setIsSending(false);
  };

  const displayTable = confirmedTable || tableNumber || "";

  // ══════════════════════════════════════════════
  // ORDER CONFIRMED SCREEN
  // ══════════════════════════════════════════════
  if(isPlaced&&placedOrder)return <main className="min-h-screen p-6 flex items-center justify-center" style={{background:pageBg,color:titleColor}}><div className="max-w-md w-full rounded-3xl p-6 space-y-5" style={{background:cardBg}}><h1 className="text-2xl font-bold">{placedOrder.status==='cancelled'?text('Narudžba nije prihvaćena','Order not accepted'):placedOrder.status==='pending'?text('Narudžba je poslana','Order sent'):placedOrder.status==='ready'?text('Narudžba je spremna','Order ready'):text('Narudžba je prihvaćena','Order accepted')}</h1><p>{text('Stol','Table')} {displayTable} · #{placedOrder.id.slice(-8).toUpperCase()}</p><p>{placedOrder.status==='pending'?text('Osoblje će potvrditi narudžbu.','Staff will confirm your order.'):placedOrder.status==='cancelled'?text('Molimo obratite se osoblju.','Please speak to a member of staff.'):placedOrder.estimated_minutes?text('Procijenjena priprema:','Estimated preparation:')+' '+placedOrder.estimated_minutes+' min':''}</p><p className="font-bold">{Number(placedOrder.total).toFixed(2)} KM</p><p className="text-sm">{text('Plaćanje kod osoblja. Ova potvrda ne znači da je račun plaćen.','Pay with a member of staff. This confirmation does not mean the bill is paid.')}</p><button className="w-full min-h-[48px] rounded-xl bg-primary text-white font-bold" onClick={()=>router.push('/'+venueSlug)}>{text('Nazad na meni','Back to menu')}</button></div></main>;

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
              {text("Provjerite narudžbu i broj stola.","Review your order and table number.")}
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
              <span className="text-[11px] font-semibold" style={{ color: stepDoneBg }}>{text("Meni","Menu")}</span>
            </div>
            <div className="h-px flex-1" style={{ backgroundColor: stepDoneBg }} />
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: stepDoneBg }}>
                <Check size={12} strokeWidth={3} style={{ color: "#FFFFFF" }} />
              </div>
              <span className="text-[11px] font-semibold" style={{ color: stepDoneBg }}>{text("Narudžba","Order")}</span>
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
                {text("Potvrda","Confirm")}
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
                      {text("Skenirajte QR kod na stolu da biste naručili","Scan the QR code on your table to order")}
                    </p>
                    <p className="text-[11px] mt-1" style={{ color: cardMuted }}>
                      {text("Broj stola se automatski prepoznaje nakon skeniranja QR koda na stolu.","Your table is identified when you scan its QR code.")}
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
                      {text("Stol","Table")} {tableNumber}
                    </p>
                    <p className="text-[11px] font-medium" style={{ color: serviceTextSub }}>
                      {text("Sesija aktivna · spremno za narudžbu","Session active · ready to order")}
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
                  {text("Neobavezno","Optional")}
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
                  <div key={item.cartKey || item.id} className="flex items-center gap-3">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-10 h-10 md:w-12 md:h-12 rounded-lg object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold line-clamp-1" style={{ color: titleColor }}>{item.name}</p>
                      <p className="text-[11px]" style={{ color: cardMuted }}>{text("Količina:","Qty:")} {item.quantity}</p>
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
                <span className="text-base md:text-lg font-extrabold" style={{ color: titleColor }}>{text("Ukupno","Total")}</span>
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
                {text("Stol","Table")} <strong style={{ color: titleColor }}>{tableNumber}</strong> · {count} {text("stavki","items")} · <strong style={{ color: accent }}>{total.toFixed(2)} {pageContent.currencySymbol}</strong>
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
            {text("💵 Gotovina","💵 Cash")}
          </button>
          <button
            type="button"
            disabled
            className="flex-1 py-3 rounded-xl border-2 font-semibold text-sm opacity-40 cursor-not-allowed relative"
            style={{ borderColor: "#888", color: "#888" }}
          >
            {text("💳 Online plaćanje","💳 Online payment")}
            <span className="absolute -top-2 -right-2 bg-primary text-white text-[9px] px-1.5 py-0.5 rounded-full">
              {text("Uskoro","Coming soon")}
            </span>
          </button>
        </div>

        {sendError && <p role="alert" className="mb-3 text-sm">{text("Žao nam je, narudžba nije poslana. Pokušajte ponovo ili se obratite osoblju.","Sorry, your order could not be sent. Please try again or speak to staff.")}</p>}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleConfirm}
          disabled={!tableValid || isSending || !items.length}
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
              {text("Pošalji narudžbu","Send order")}
            </>
          ) : (
            <>
              <QrCode size={18} />
              {text("Skenirajte QR kod","Scan the QR code")}
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}
