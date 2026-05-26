"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Plus, Check, Sparkles } from "lucide-react";
import { Product } from "@/types/product";
import { motion, AnimatePresence } from "framer-motion";
import { useCartStore } from "@/store/cartStore";
import { useCmsData } from "@/hooks/useCmsData";
import { useTranslation } from "@/hooks/useTranslation";
import { useState } from "react";
import clsx from "clsx";
import { isDark } from "@/lib/color-utils";

interface MenuItemCardProps {
  product: Product;
  index: number;
}

const RADIUS_MAP = { sm: "rounded-lg", md: "rounded-xl", lg: "rounded-2xl", xl: "rounded-[20px]" } as const;
const SHADOW_MAP = { none: "", sm: "shadow-soft", md: "shadow-card", lg: "shadow-elevated" } as const;
const BTN_RADIUS = { rounded: "rounded-xl", pill: "rounded-full", square: "rounded-lg" } as const;

export default function MenuItemCard({ product, index }: MenuItemCardProps) {
  const { venue } = useParams<{ venue: string }>();
  const venueSlug = decodeURIComponent(venue || "");
  const addItem = useCartStore((s) => s.addItem);
  const items = useCartStore((s) => s.items);
  const { pageContent, componentStyles: cs } = useCmsData();
  const { t, tProduct, tVariation, tVariationOption } = useTranslation();
  const [justAdded, setJustAdded] = useState(false);

  const cartItem = items.find((i) => i.id === product.id);
  const qtyInCart = cartItem?.quantity ?? 0;

  // ── Variation helpers ──
  const variations = product.variations || [];
  const hasRequiredVariation = variations.some((v) => v.required);
  const maxPriceAdjustment = variations.reduce((max, v) => {
    const vMax = Math.max(...v.options.map((o) => o.priceAdjustment));
    return max + vMax;
  }, 0);
  const hasVariations = variations.length > 0;
  const hasPriceRange = maxPriceAdjustment > 0;

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasRequiredVariation) return; // must choose on product page
    addItem({
      id: product.id,
      cartKey: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      image: product.image,
      station: product.station ?? 'kitchen',
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 800);
  };

  const radius = RADIUS_MAP[cs.cardBorderRadius] || RADIUS_MAP.xl;
  const shadow = SHADOW_MAP[cs.cardShadow] || SHADOW_MAP.sm;
  const btnRadius = BTN_RADIUS[cs.buttonStyle] || BTN_RADIUS.rounded;
  const isVertical = cs.cardLayout === "vertical";
  const imgRight = !isVertical && cs.cardImagePosition === "right";

  // Theme-aware badge colors
  const cardDark = isDark(cs.cardBgColor || "#FFFFFF");
  const popularBadgeBg = cardDark ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.9)";
  const popularBadgeColor = cs.cardPriceColor || "#F4B400";
  const customizeBadgeBg = (cs.cardPriceColor || "#F4B400") + "15";
  const customizeBadgeColor = cs.cardPriceColor || "#F4B400";
  const customizeBadgeBorder = (cs.cardPriceColor || "#F4B400") + "30";
  const viewOnly = cs.viewOnlyMode;
  const hasHappyHour = product.happyHourPrice !== undefined && product.originalPrice !== undefined;
  const priceBlock = (
    <div>
      <div className="flex items-baseline gap-1.5 flex-wrap">
        {hasPriceRange && (
          <span className="text-[9px] md:text-[10px] font-medium" style={{ color: cs.cardDescriptionColor }}>from</span>
        )}
        {hasHappyHour && (
          <span className="text-[10px] md:text-[11px] line-through font-semibold" style={{ color: cs.cardDescriptionColor }}>
            {product.originalPrice!.toFixed(2)}
          </span>
        )}
        <span
          className="font-extrabold text-[16px] md:text-[17px] tracking-tight"
          style={{ color: cs.cardPriceColor }}
        >
          {product.price.toFixed(2)} {pageContent.currencySymbol}
        </span>
      </div>
      {hasHappyHour && (
        <span
          className="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide"
          style={{ backgroundColor: `${cs.cardPriceColor || "#F4B400"}1A`, color: cs.cardPriceColor || "#F4B400" }}
        >
          Happy Hour
        </span>
      )}
    </div>
  );

  // ─── VERTICAL CARD ────────────────────────────────────
  if (isVertical) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04, duration: 0.35, ease: "easeOut" }}
        className="flex flex-col h-full"
      >
        <Link href={`/${venueSlug}/product/${product.id}`} className="flex-1 flex flex-col min-h-0">
          <div
            className={clsx("overflow-hidden transition-all duration-300 group relative flex-1 flex flex-col", radius, shadow, "hover:shadow-card")}
            style={{ backgroundColor: cs.cardBgColor }}
          >
            {/* Image */}
            {product.image && (
              <div className="relative h-36 md:h-44 overflow-hidden shrink-0">
                <img
                  src={product.image}
                  alt={tProduct(product, "name")}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />

                {product.popular && (
                  <div className="absolute top-2 left-2">
                    <span
                      className="inline-flex items-center gap-[3px] backdrop-blur-sm text-[9px] md:text-[10px] font-bold px-2 py-[3px] rounded-full shadow-sm"
                      style={{ backgroundColor: popularBadgeBg, color: popularBadgeColor, border: `1px solid ${popularBadgeColor}20` }}
                    >
                      {t(pageContent, "popularBadgeText")}
                    </span>
                  </div>
                )}

                <AnimatePresence>
                  {!viewOnly && qtyInCart > 0 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute bottom-2 left-2 min-w-[22px] h-[22px] rounded-full flex items-center justify-center shadow-md px-1"
                      style={{ backgroundColor: cs.cardPriceColor }}
                    >
                      <span className="text-white text-[10px] font-extrabold leading-none">{qtyInCart}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Content */}
            <div className="p-3 md:p-4 flex-1 flex flex-col">
              <h4
                className="text-[14px] md:text-[15px] font-bold leading-snug line-clamp-1"
                style={{ color: cs.cardTitleColor }}
              >
                {tProduct(product, "name")}
              </h4>

              {/* Badge row — fixed height so all cards align even without badge */}
              <div className="flex items-center gap-1.5 mt-1 min-h-[20px]">
                {product.addons && product.addons.length > 0 && (
                  <span
                    className="inline-flex items-center gap-[3px] text-[9px] font-semibold px-2 py-[2px] rounded-full"
                    style={{ backgroundColor: customizeBadgeBg, color: customizeBadgeColor, border: `1px solid ${customizeBadgeBorder}` }}
                  >
                    <Sparkles size={9} />
                    {t(pageContent, "customizableBadgeText")}
                  </span>
                )}
              </div>

              <p
                className="text-[11px] md:text-[12px] mt-1.5 line-clamp-2 leading-[1.5]"
                style={{ color: cs.cardDescriptionColor }}
              >
                {tProduct(product, "description")}
              </p>

              <div className="flex items-center justify-between mt-auto pt-2">
                {priceBlock}

                {!viewOnly && !hasRequiredVariation && (
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={handleQuickAdd}
                  className={clsx(
                    "w-9 h-9 md:w-10 md:h-10 flex items-center justify-center transition-all duration-200",
                    btnRadius,
                    justAdded
                      ? "bg-accent-green text-white shadow-md"
                      : "text-white shadow-sm hover:shadow-glow hover:brightness-105"
                  )}
                  style={!justAdded ? { backgroundColor: cs.cardPriceColor } : undefined}
                >
                  <AnimatePresence mode="wait">
                    {justAdded ? (
                      <motion.div key="check" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}>
                        <Check size={15} strokeWidth={3} />
                      </motion.div>
                    ) : (
                      <motion.div key="plus" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                        <Plus size={16} strokeWidth={2.5} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
                )}
              </div>
            </div>
          </div>
        </Link>

        {/* ── Variation Eyelets (below the card — doesn't affect card height) ── */}
        {hasVariations && (
          <div className="w-full mt-1 flex flex-col gap-[3px]">
            {variations.map((v) => (
              <Link
                key={v.id}
                href={`/${venueSlug}/product/${product.id}`}
                className="block w-full"
              >
                <div
                  className={clsx(
                    "w-full px-3 py-[6px] flex items-center gap-2 transition-colors",
                    radius === 'rounded-[20px]' ? 'rounded-b-[14px] rounded-t-[4px]'
                      : radius === 'rounded-2xl' ? 'rounded-b-xl rounded-t-[3px]'
                      : radius === 'rounded-xl' ? 'rounded-b-lg rounded-t-[3px]'
                      : 'rounded-b-md rounded-t-[2px]'
                  )}
                  style={{
                    backgroundColor: (cs.cardPriceColor || '#F4B400') + '0D',
                    borderLeft: `3px solid ${(cs.cardPriceColor || '#F4B400')}40`,
                  }}
                >
                  <span
                    className="text-[9px] font-bold uppercase tracking-wide shrink-0"
                    style={{ color: (cs.cardPriceColor || '#F4B400') + 'CC' }}
                  >
                    {tVariation(v)}
                  </span>
                  <div className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-none">
                    {v.options.map((opt) => (
                      <span
                        key={opt.id}
                        className="inline-flex items-center whitespace-nowrap text-[9px] font-medium px-[6px] py-[1px] rounded-full shrink-0"
                        style={{
                          backgroundColor: (cs.cardPriceColor || '#F4B400') + '12',
                          color: cs.cardTitleColor || '#1E1E1E',
                        }}
                      >
                        {tVariationOption(opt)}
                      </span>
                    ))}
                  </div>
                  {(() => {
                    const maxAdj = Math.max(...v.options.map(o => o.priceAdjustment));
                    if (maxAdj > 0) return (
                      <span
                        className="text-[10px] font-bold whitespace-nowrap shrink-0 ml-auto"
                        style={{ color: cs.cardPriceColor || '#F4B400' }}
                      >
                        {(product.price + maxAdj).toFixed(2)}{pageContent.currencySymbol}
                      </span>
                    );
                    return null;
                  })()}
                </div>
              </Link>
            ))}
          </div>
        )}
      </motion.div>
    );
  }

  // ─── HORIZONTAL CARD ──────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: "easeOut" }}
      className="flex flex-col h-full"
    >
      <Link href={`/${venueSlug}/product/${product.id}`} className="flex-1 flex flex-col min-h-0">
        <div
          className={clsx(
            "flex overflow-hidden transition-all duration-300 group relative flex-1",
            radius, shadow, "hover:shadow-card",
            imgRight && "flex-row-reverse"
          )}
          style={{ backgroundColor: cs.cardBgColor }}
        >
          {/* Image */}
          {product.image && (
            <div className="relative w-[110px] md:w-[150px] lg:w-[170px] min-h-[120px] shrink-0 overflow-hidden self-stretch">
              <img
                src={product.image}
                alt={tProduct(product, "name")}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className={clsx(
                "absolute inset-0",
                imgRight
                  ? "bg-gradient-to-l from-transparent via-transparent to-white/20"
                  : "bg-gradient-to-r from-transparent via-transparent to-white/20"
              )} />

              {product.popular && (
                <div className="absolute top-2 left-2">
                  <span
                    className="inline-flex items-center gap-[3px] backdrop-blur-sm text-[9px] md:text-[10px] font-bold px-2 py-[3px] rounded-full shadow-sm"
                    style={{ backgroundColor: popularBadgeBg, color: popularBadgeColor, border: `1px solid ${popularBadgeColor}20` }}
                  >
                    {t(pageContent, "popularBadgeText")}
                  </span>
                </div>
              )}

              <AnimatePresence>
                {!viewOnly && qtyInCart > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute bottom-2 left-2 min-w-[22px] h-[22px] rounded-full flex items-center justify-center shadow-md px-1"
                    style={{ backgroundColor: cs.cardPriceColor }}
                  >
                    <span className="text-white text-[10px] font-extrabold leading-none">{qtyInCart}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0 p-3 md:p-4 flex flex-col">
            <div className="min-w-0">
              <h4
                className="text-[15px] md:text-base lg:text-[17px] font-bold leading-snug pr-1 line-clamp-1"
                style={{ color: cs.cardTitleColor }}
              >
                {tProduct(product, "name")}
              </h4>

              {/* Badge row — fixed height so all cards align even without badge */}
              <div className="flex items-center gap-1.5 mt-1 min-h-[20px]">
                {product.addons && product.addons.length > 0 && (
                  <span
                    className="inline-flex items-center gap-[3px] text-[9px] md:text-[10px] font-semibold px-2 py-[2px] rounded-full"
                    style={{ backgroundColor: customizeBadgeBg, color: customizeBadgeColor, border: `1px solid ${customizeBadgeBorder}` }}
                  >
                    <Sparkles size={9} />
                    {t(pageContent, "customizableBadgeText")}
                  </span>
                )}
              </div>

              <p
                className="text-[11.5px] md:text-[13px] mt-1.5 line-clamp-2 leading-[1.5]"
                style={{ color: cs.cardDescriptionColor }}
              >
                {tProduct(product, "description")}
              </p>
            </div>

            <div className="flex items-center justify-between mt-auto pt-1.5">
              {priceBlock}

              {!viewOnly && !hasRequiredVariation && (
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={handleQuickAdd}
                className={clsx(
                  "w-9 h-9 md:w-10 md:h-10 flex items-center justify-center transition-all duration-200",
                  btnRadius,
                  justAdded
                    ? "bg-accent-green text-white shadow-md"
                    : "text-white shadow-sm hover:shadow-glow hover:brightness-105"
                )}
                style={!justAdded ? { backgroundColor: cs.cardPriceColor } : undefined}
              >
                <AnimatePresence mode="wait">
                  {justAdded ? (
                    <motion.div key="check" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}>
                      <Check size={15} strokeWidth={3} />
                    </motion.div>
                  ) : (
                    <motion.div key="plus" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                      <Plus size={16} strokeWidth={2.5} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
              )}
            </div>
          </div>
        </div>
      </Link>

      {/* ── Variation Eyelets (below the card — doesn't affect card height) ── */}
      {hasVariations && (
        <div className="w-full mt-1 flex flex-col gap-[3px]">
          {variations.map((v) => (
            <Link
              key={v.id}
              href={`/${venueSlug}/product/${product.id}`}
              className="block w-full"
            >
              <div
                className={clsx(
                  "w-full px-3 py-[6px] flex items-center gap-2 transition-colors",
                  radius === 'rounded-[20px]' ? 'rounded-b-[14px] rounded-t-[4px]'
                    : radius === 'rounded-2xl' ? 'rounded-b-xl rounded-t-[3px]'
                    : radius === 'rounded-xl' ? 'rounded-b-lg rounded-t-[3px]'
                    : 'rounded-b-md rounded-t-[2px]'
                )}
                style={{
                  backgroundColor: (cs.cardPriceColor || '#F4B400') + '0D',
                  borderLeft: `3px solid ${(cs.cardPriceColor || '#F4B400')}40`,
                }}
              >
                <span
                  className="text-[9px] font-bold uppercase tracking-wide shrink-0"
                  style={{ color: (cs.cardPriceColor || '#F4B400') + 'CC' }}
                >
                  {tVariation(v)}
                </span>
                <div className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-none">
                  {v.options.map((opt) => (
                    <span
                      key={opt.id}
                      className="inline-flex items-center whitespace-nowrap text-[9px] font-medium px-[6px] py-[1px] rounded-full shrink-0"
                      style={{
                        backgroundColor: (cs.cardPriceColor || '#F4B400') + '12',
                        color: cs.cardTitleColor || '#1E1E1E',
                      }}
                    >
                      {tVariationOption(opt)}
                    </span>
                  ))}
                </div>
                {(() => {
                  const maxAdj = Math.max(...v.options.map(o => o.priceAdjustment));
                  if (maxAdj > 0) return (
                    <span
                      className="text-[10px] font-bold whitespace-nowrap shrink-0 ml-auto"
                      style={{ color: cs.cardPriceColor || '#F4B400' }}
                    >
                      {(product.price + maxAdj).toFixed(2)}{pageContent.currencySymbol}
                    </span>
                  );
                  return null;
                })()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </motion.div>
  );
}
