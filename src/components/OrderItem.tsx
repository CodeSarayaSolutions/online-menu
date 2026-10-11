"use client";

import { CartItem as CartItemType } from "@/types/cart";
import { useCartStore } from "@/store/cartStore";
import { useTranslation } from "@/hooks/useTranslation";
import { useCmsData } from "@/hooks/useCmsData";
import { Trash2, Minus, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { isDark, mutedText, subtleSurface } from "@/lib/color-utils";

interface OrderItemProps {
  item: CartItemType;
  index?: number;
}

export default function OrderItem({ item, index = 0 }: OrderItemProps) {
  const {text}=useTranslation();
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const { pageContent, componentStyles: cs } = useCmsData();

  const cardBg = cs.cartCardBgColor || "#FFFFFF";
  const titleColor = cs.cartTitleColor || "#1E1E1E";
  const accent = cs.cartAccentColor || "#F4B400";
  const cardMuted = mutedText(cardBg);
  const cardSurface = subtleSurface(cardBg);
  const cardIsDark = isDark(cardBg);

  // Danger/delete colors
  const dangerColor = cardIsDark ? "rgba(248,113,113,0.5)" : "rgba(156,163,175,0.6)";
  const dangerHover = cardIsDark ? "#F87171" : "#EF4444";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -50, height: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-2xl p-3.5 md:p-4"
      style={{ backgroundColor: cardBg, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
    >
      <div className="flex items-start gap-3 md:gap-4">
        {/* Image */}
        <div className="w-[72px] h-[72px] md:w-[88px] md:h-[88px] rounded-xl overflow-hidden shrink-0" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm md:text-base font-bold line-clamp-1" style={{ color: titleColor }}>
              {item.name}
            </h4>
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={() => removeItem(item.cartKey || item.id)}
              className="p-1 transition shrink-0"
              style={{ color: dangerColor }}
              onMouseEnter={(e) => (e.currentTarget.style.color = dangerHover)}
              onMouseLeave={(e) => (e.currentTarget.style.color = dangerColor)}
            >
              <Trash2 size={14} />
            </motion.button>
          </div>

          {/* Selected variations */}
          {item.selectedVariations && item.selectedVariations.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {item.selectedVariations.map((sv, i) => (
                <span
                  key={i}
                  className="text-[10px] md:text-[11px] px-1.5 py-0.5 rounded-md font-medium"
                  style={{ backgroundColor: cardSurface, color: cardMuted }}
                >
                  {sv.optionLabel}{sv.priceAdjustment > 0 ? ` +${sv.priceAdjustment.toFixed(2)} ${pageContent.currencySymbol}` : ''}
                </span>
              ))}
            </div>
          )}

          {item.selectedAddons && item.selectedAddons.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {item.selectedAddons.map((addon) => (
                <span
                  key={addon.id}
                  className="text-[10px] md:text-[11px] px-1.5 py-0.5 rounded-md font-medium"
                  style={{ backgroundColor: cardSurface, color: cardMuted }}
                >
                  {addon.quantity > 1 ? `${addon.quantity}× ` : ""}
                  {addon.name}
                  {addon.price > 0 ? ` +${(addon.price * addon.quantity).toFixed(2)} ${pageContent.currencySymbol}` : ""}
                </span>
              ))}
            </div>
          )}

          <p className="font-extrabold text-base md:text-lg mt-1" style={{ color: accent }}>
            {(item.price * item.quantity).toFixed(2)} {pageContent.currencySymbol}
          </p>

          {/* Quantity controls */}
          <div className="flex items-center gap-0.5 mt-2">
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={() =>
                item.quantity > 1
                  ? updateQuantity(item.cartKey || item.id, item.quantity - 1)
                  : removeItem(item.cartKey || item.id)
              }
              className="w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center transition"
              style={{ backgroundColor: cardSurface, color: titleColor }}
            >
              <Minus size={14} className="md:w-4 md:h-4" />
            </motion.button>
            <motion.span
              key={item.quantity}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="w-9 md:w-10 text-center text-sm md:text-base font-bold"
              style={{ color: titleColor }}
            >
              {item.quantity}
            </motion.span>
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={() => updateQuantity(item.cartKey || item.id, item.quantity + 1)}
              className="w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center transition"
              style={{ backgroundColor: accent, color: "#FFFFFF" }}
            >
              <Plus size={14} className="md:w-4 md:h-4" />
            </motion.button>

            {/* Per-item price when qty > 1 */}
            {item.quantity > 1 && (
              <span className="text-[11px] ml-2" style={{ color: cardMuted }}>
                {item.price.toFixed(2)} {pageContent.currencySymbol} {text("po komadu","each")}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
