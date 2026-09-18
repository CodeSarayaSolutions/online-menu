"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Minus, Plus, Check, Flame, Star, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { useCmsData } from "@/hooks/useCmsData";
import { useTranslation } from "@/hooks/useTranslation";
import { useHappyHourPricing } from "@/hooks/useHappyHourPricing";
import { useCartStore } from "@/store/cartStore";
import type { Addon, Variation, VariationOption } from "@/types/cms";

// ─── Font & layout maps (same as main page for consistency) ────
const HEADING_FONT_MAP: Record<string, string> = {
  system: "font-sans",
  serif: "font-serif",
  mono: "font-mono",
  display: "font-sans font-black tracking-tight",
  handwritten: "font-serif italic",
};
const BODY_FONT_MAP: Record<string, string> = {
  system: "font-sans",
  serif: "font-serif",
  mono: "font-mono",
  elegant: "font-serif",
};
const FONT_SIZE_MAP: Record<string, string> = {
  sm: "text-[13px]",
  md: "text-sm",
  lg: "text-base",
};
const DENSITY_PAD: Record<string, string> = {
  compact: "px-3 md:px-4 lg:px-6",
  comfortable: "px-4 md:px-6 lg:px-8",
  spacious: "px-6 md:px-8 lg:px-12",
};
const RADIUS_MAP: Record<string, string> = {
  sm: "rounded-lg",
  md: "rounded-xl",
  lg: "rounded-2xl",
  xl: "rounded-3xl",
};
const SHADOW_MAP: Record<string, string> = {
  none: "shadow-none",
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
};
const BTN_RADIUS: Record<string, string> = {
  rounded: "rounded-2xl",
  pill: "rounded-full",
  square: "rounded-lg",
};

export default function ProductPage() {
  const { id, venue } = useParams();
  const venueSlug = decodeURIComponent((venue as string) || "");
  const router = useRouter();
  const {
    products,
    categoryIcons,
    pageContent,
    componentStyles: cs,
    layoutConfig: lc,
  } = useCmsData();
  const { t, tProduct, tAddon, tVariation, tVariationOption } = useTranslation();
  const { prices: happyHourPrices } = useHappyHourPricing(venueSlug);
  const addItem = useCartStore((s) => s.addItem);
  const items = useCartStore((s) => s.items);

  const pricedProducts = useMemo(
    () =>
      products.map((item) => {
        const happyHour = happyHourPrices.get(item.id);
        if (!happyHour) return item;
        return {
          ...item,
          originalPrice: item.price,
          happyHourPrice: happyHour.overridePrice,
          happyHourLabel: happyHour.label,
          price: happyHour.overridePrice,
        };
      }),
    [products, happyHourPrices]
  );

  const product = pricedProducts.find((p) => p.id === id);
  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({});
  const [selectedVariations, setSelectedVariations] = useState<Record<string, string[]>>({});
  const [added, setAdded] = useState(false);

  // Related items from same category
  const relatedItems = product
    ? pricedProducts
        .filter((p) => p.category === product.category && p.id !== product.id)
        .slice(0, 4)
    : [];

  const hasSelectedDependency = (dependsOn?: { variationId: string; optionId: string }) => {
    if (!dependsOn) return true;
    return selectedVariations[dependsOn.variationId]?.includes(dependsOn.optionId) ?? false;
  };

  const visibleVariationOptions = (variation: Variation): VariationOption[] =>
    variation.options.filter((option) => hasSelectedDependency(option.dependsOn));

  const visibleAddons = (product?.addons ?? []).filter((addon) => hasSelectedDependency(addon.dependsOn));

  const addonGroupKey = (addon: Addon) => addon.groupId || "__default__";
  const addonGroupLabel = (addon: Addon) => addon.groupLabel || "Extras";
  const addonGroupLimit = (addon: Addon) => addon.maxSelect ?? 0;
  const addonGroupMin = (addon: Addon) => addon.minSelect ?? 0;

  const selectedAddonCountForGroup = (groupId: string) =>
    visibleAddons.filter((addon) => addonGroupKey(addon) === groupId && (selectedAddons[addon.id] ?? 0) > 0).length;

  const setAddonQuantity = (addon: Addon, nextQty: number) => {
    setSelectedAddons((prev) => {
      const currentQty = prev[addon.id] ?? 0;
      const normalizedQty = Math.max(0, nextQty);
      const groupId = addonGroupKey(addon);
      const maxSelect = addonGroupLimit(addon);
      const selectedInGroup = visibleAddons.filter(
        (a) => addonGroupKey(a) === groupId && (prev[a.id] ?? 0) > 0 && a.id !== addon.id
      ).length;

      if (currentQty === 0 && normalizedQty > 0 && maxSelect > 0 && selectedInGroup >= maxSelect) {
        return prev;
      }

      const next = { ...prev };
      if (normalizedQty <= 0) delete next[addon.id];
      else next[addon.id] = normalizedQty;
      return next;
    });
  };

  const toggleAddon = (addon: Addon) => {
    const qty = selectedAddons[addon.id] ?? 0;
    setAddonQuantity(addon, qty > 0 ? 0 : 1);
  };

  const addonsTotal = useMemo(() => {
    if (!product?.addons) return 0;
    return product.addons
      .filter((a) => hasSelectedDependency(a.dependsOn))
      .reduce((sum, a) => sum + a.price * (selectedAddons[a.id] ?? 0), 0);
  }, [selectedAddons, selectedVariations, product]);

  const variationsTotal = useMemo(() => {
    if (!product?.variations) return 0;
    return product.variations.reduce((sum, v) => {
      const selectedOptIds = selectedVariations[v.id] ?? [];
      const selectedOptions = v.options.filter((o) => selectedOptIds.includes(o.id) && hasSelectedDependency(o.dependsOn));
      return sum + selectedOptions.reduce((optionSum, opt) => optionSum + (opt.priceAdjustment || 0), 0);
    }, 0);
  }, [selectedVariations, product]);

  const totalPrice = product ? (product.price + addonsTotal + variationsTotal) * quantity : 0;
  const existingInCart = items.find((i) => i.id === product?.id);

  // Check if all required variations are selected
  const allRequiredSelected = product?.variations
    ? product.variations.every((v) => {
        const min = v.minSelect ?? (v.required ? 1 : 0);
        const max = v.maxSelect ?? 1;
        const visibleSelected = (selectedVariations[v.id] ?? []).filter((optionId) =>
          visibleVariationOptions(v).some((option) => option.id === optionId)
        );
        return visibleSelected.length >= min && visibleSelected.length <= max;
      })
    : true;

  const allAddonGroupsValid = visibleAddons.every((addon) => {
    const min = addonGroupMin(addon);
    if (min <= 0) return true;
    return selectedAddonCountForGroup(addonGroupKey(addon)) >= min;
  });
  const canAddToOrder = allRequiredSelected && allAddonGroupsValid;

  // ─── Theme-aware helpers ────────────────────────────────
  const variant = lc.productPageVariant || "classic";
  const headingFont = HEADING_FONT_MAP[lc.headingFont] || "";
  const bodyFont = BODY_FONT_MAP[lc.bodyFont] || "";
  const fontSize = FONT_SIZE_MAP[lc.baseFontSize] || "text-sm";
  const pad = DENSITY_PAD[lc.contentDensity] || DENSITY_PAD.comfortable;
  const radius = RADIUS_MAP[cs.cardBorderRadius] || RADIUS_MAP.xl;
  const shadow = SHADOW_MAP[cs.cardShadow] || SHADOW_MAP.sm;
  const btnRadius = BTN_RADIUS[cs.buttonStyle] || BTN_RADIUS.rounded;

  // Animation helper (exact same pattern as main page)
  const anim = (delay: number) =>
    lc.animationStyle === "none"
      ? {}
      : {
          initial: {
            opacity: 0,
            y: lc.animationStyle === "dramatic" ? 20 : 10,
          },
          animate: { opacity: 1, y: 0 },
          transition: {
            delay,
            duration:
              lc.animationStyle === "subtle"
                ? 0.2
                : lc.animationStyle === "playful"
                ? 0.5
                : 0.3,
          },
        };

  // Detect dark backgrounds for contrast
  const isDark = (hex: string) => {
    const c = hex.replace("#", "");
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return r * 0.299 + g * 0.587 + b * 0.114 < 128;
  };
  const pageBg = cs.productPageBgColor || cs.menuPageBgColor || "#FFFFFF";
  const pageDark = isDark(pageBg);
  const cardBg = cs.productCardBgColor || "#FFFFFF";
  const cardDark = isDark(cardBg);
  const stickyBg = cs.productStickyBarBgColor || cardBg;
  const stickyDark = isDark(stickyBg);
  const mutedColor = pageDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)";
  const cardMutedColor = cardDark
    ? "rgba(255,255,255,0.5)"
    : "rgba(0,0,0,0.4)";
  const stickyMutedColor = stickyDark
    ? "rgba(255,255,255,0.5)"
    : "rgba(0,0,0,0.4)";
  const borderColor = pageDark
    ? "rgba(255,255,255,0.1)"
    : "rgba(0,0,0,0.06)";
  const cardBorderColor = cardDark
    ? "rgba(255,255,255,0.1)"
    : "rgba(0,0,0,0.06)";
  const subtleBg = pageDark
    ? "rgba(255,255,255,0.06)"
    : "rgba(0,0,0,0.03)";

  // ─── 404 state ──────────────────────────────────────────
  if (!product) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen gap-4 px-6"
        style={{ backgroundColor: pageBg }}
      >
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ backgroundColor: subtleBg }}
        >
          <span className="text-3xl">🍽️</span>
        </div>
        <p className="font-medium" style={{ color: mutedColor }}>
          {t(pageContent, "itemNotFoundText")}
        </p>
        <button
          onClick={() => router.push(`/${venueSlug}`)}
          className="text-sm font-semibold"
          style={{ color: cs.productButtonBgColor }}
        >
          {t(pageContent, "backToMenuText")}
        </button>
      </div>
    );
  }

  const handleAddToOrder = () => {
    if (!canAddToOrder) return;
    // Build a unique cart key from product id + selected variation options
    const varKey = product.variations && product.variations.length > 0
      ? product.variations
          .map((v) => {
            const visibleOptionIds = new Set(visibleVariationOptions(v).map((option) => option.id));
            return (selectedVariations[v.id] ?? []).filter((optionId) => visibleOptionIds.has(optionId)).join(".") || "none";
          })
          .join("-")
      : "";
    const addonKey = Object.entries(selectedAddons)
      .filter(([, qty]) => qty > 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([addonId, qty]) => `${addonId}:${qty}`)
      .join("-");
    const cartKeyParts = [product.id, varKey, addonKey].filter(Boolean);
    const cartKey = cartKeyParts.join("__");

    // Build selected variation labels for display
    const selectedVarLabels = product.variations
      ? product.variations
          .flatMap((v) =>
            (selectedVariations[v.id] ?? [])
              .map((optionId) => v.options.find((o) => o.id === optionId))
              .filter((opt): opt is VariationOption => !!opt && hasSelectedDependency(opt.dependsOn))
              .map((opt) => ({
                variationName: v.name,
                optionLabel: opt.label,
                priceAdjustment: opt.priceAdjustment,
              }))
          )
      : [];

    const varDesc = selectedVarLabels.length > 0 ? ` (${selectedVarLabels.map((v) => v.optionLabel).join(", ")})` : "";
    const selectedAddonLabels = visibleAddons
      .filter((addon) => (selectedAddons[addon.id] ?? 0) > 0)
      .map((addon) => ({
        id: addon.id,
        name: addon.name,
        quantity: selectedAddons[addon.id] ?? 0,
        price: addon.price,
        groupId: addon.groupId,
        groupLabel: addon.groupLabel,
      }));

    addItem({
      id: product.id,
      cartKey,
      name: product.name + varDesc,
      price: product.price + addonsTotal + variationsTotal,
      quantity,
      image: product.image,
      station: product.station ?? 'both',
      selectedVariations: selectedVarLabels,
      selectedAddons: selectedAddonLabels,
      addonQuantities: selectedAddons,
    });
    setAdded(true);
    setTimeout(() => router.back(), 800);
  };

  const catIcon = categoryIcons[product.category] || "🍽️";

  // ── HERO IMAGE ─────────────────────────────────────────
  const renderHeroImage = () => {
    const compactMode = variant === "compact";
    const elegantMode = variant === "elegant";
    const minimalMode = variant === "minimal";

    const imageDesktopWidth =
      minimalMode || compactMode ? "lg:w-2/5" : "lg:w-1/2";

    return (
      <motion.div
        {...anim(0)}
        className={clsx(
          "relative w-full",
          imageDesktopWidth,
          "lg:sticky lg:top-0 lg:self-start lg:h-screen"
        )}
      >
        {/* Image container */}
        <div
          className={clsx(
            "relative overflow-hidden w-full",
            compactMode
              ? "h-56 md:h-64 lg:h-full"
              : elegantMode
              ? "h-72 md:h-96 lg:h-full"
              : "h-64 md:h-80 lg:h-full"
          )}
        >
          <img
            src={product.image}
            alt={tProduct(product, "name")}
            className="w-full h-full object-cover"
          />
          {/* Bottom gradient overlay */}
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent"
          />
          {/* Top gradient for back button readability */}
          <div
            className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent"
          />
        </div>

        {/* Back button */}
        <button
          onClick={() => router.back()}
          className={clsx(
            "absolute top-4 left-4 z-10 flex items-center justify-center",
            "w-10 h-10 rounded-full bg-black/30 backdrop-blur-md",
            "text-white hover:bg-black/50 transition-colors"
          )}
        >
          <ArrowLeft size={20} />
        </button>

        {/* Popular badge on image */}
        {product.popular && (
          <motion.div
            {...anim(0.15)}
            className={clsx(
              "absolute top-4 right-4 z-10 flex items-center gap-1.5",
              "px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-md"
            )}
          >
            <Flame size={14} className="text-orange-400" />
            <span className="text-xs font-bold text-white">
              {t(pageContent, "popularChoiceText")}
            </span>
          </motion.div>
        )}

        {/* Product name + price overlay on mobile (bottom of image) */}
        <div
          className={clsx(
            "absolute bottom-0 inset-x-0 p-4 md:p-6 lg:hidden"
          )}
        >
          {elegantMode && cs.categoryBarShowIcons && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{catIcon}</span>
              <span className="text-xs font-medium text-white/70 uppercase tracking-wider">
                {product.category}
              </span>
            </div>
          )}
          {elegantMode && !cs.categoryBarShowIcons && (
            <div className="mb-2">
              <span className="text-xs font-medium text-white/70 uppercase tracking-wider">
                {product.category}
              </span>
            </div>
          )}
          <h1
            className={clsx(
              "font-extrabold text-white",
              compactMode ? "text-xl" : elegantMode ? "text-3xl" : "text-2xl",
              headingFont
            )}
          >
            {tProduct(product, "name")}
          </h1>
          <p
            className={clsx(
              "font-bold mt-1",
              compactMode ? "text-lg" : "text-xl"
            )}
            style={{ color: cs.productPriceColor }}
          >
            {product.happyHourPrice !== undefined && product.originalPrice !== undefined && (
              <span className="mr-2 text-sm line-through text-white/60">
                {product.originalPrice.toFixed(2)}
              </span>
            )}
            {product.price.toFixed(2)}
            {" "}{pageContent.currencySymbol}
            {product.happyHourPrice !== undefined && (
              <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px] uppercase">
                Happy Hour
              </span>
            )}
          </p>
        </div>
      </motion.div>
    );
  };

  // ── INFO CARD ──────────────────────────────────────────
  const renderInfoCard = () => {
    const compactMode = variant === "compact";
    const elegantMode = variant === "elegant";
    const minimalMode = variant === "minimal";

    return (
      <motion.div
        {...anim(0.1)}
        className={clsx(
          compactMode ? "p-4 md:p-5" : elegantMode ? "p-5 md:p-8" : "p-4 md:p-6",
          pad
        )}
      >
        <div
          className={clsx(radius, shadow, "overflow-hidden")}
          style={{
            backgroundColor: cardBg,
            border: `1px solid ${cardBorderColor}`,
          }}
        >
          <div
            className={clsx(
              compactMode ? "p-4" : elegantMode ? "p-6 md:p-8" : "p-5 md:p-6"
            )}
          >
            {/* Category badge */}
            <div className="flex items-center gap-2 mb-3">
              <span
                className={clsx(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                )}
                style={{
                  backgroundColor: subtleBg,
                  color: mutedColor,
                }}
              >
                {cs.categoryBarShowIcons && <span>{catIcon}</span>}
                {product.category}
              </span>
              {existingInCart && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                  style={{
                    backgroundColor: cs.productButtonBgColor + "18",
                    color: cs.productButtonBgColor,
                  }}
                >
                  <Check size={12} strokeWidth={3} />
                  {existingInCart.quantity} in cart
                </span>
              )}
            </div>

            {/* Product name — hidden on mobile (shown on image overlay), visible on desktop */}
            <h1
              className={clsx(
                "font-extrabold hidden lg:block",
                compactMode
                  ? "text-xl md:text-2xl"
                  : elegantMode
                  ? "text-2xl md:text-4xl"
                  : "text-xl md:text-3xl",
                headingFont
              )}
              style={{ color: cs.productTitleColor }}
            >
              {tProduct(product, "name")}
            </h1>

            {/* Price — hidden on mobile, visible on desktop */}
            <div className="hidden lg:flex items-baseline gap-2 mt-2">
              {product.happyHourPrice !== undefined && product.originalPrice !== undefined && (
                <span
                  className="text-sm font-semibold line-through"
                  style={{ color: cardMutedColor }}
                >
                  {product.originalPrice.toFixed(2)}
                </span>
              )}
              <span
                className={clsx(
                  "font-extrabold",
                  compactMode ? "text-xl" : elegantMode ? "text-3xl" : "text-2xl"
                )}
                style={{ color: cs.productPriceColor }}
              >
                {product.price.toFixed(2)}
                {" "}{pageContent.currencySymbol}
              </span>
              <span
                className="text-xs font-medium"
                style={{ color: cardMutedColor }}
              >
                {product.happyHourPrice !== undefined ? "Happy Hour" : t(pageContent, "basePriceLabel")}
              </span>
            </div>

            {/* Description */}
            {product.description && (
              <p
                className={clsx(
                  "mt-3 leading-relaxed",
                  compactMode ? "text-xs" : elegantMode ? "text-base" : "text-sm",
                  bodyFont
                )}
                style={{
                  color: cs.productDescriptionColor || cardMutedColor,
                }}
              >
                {tProduct(product, "description")}
              </p>
            )}

            {/* Popular badge inline (if not compact — compact shows on image) */}
            {product.popular && !compactMode && (
              <div
                className="flex items-center gap-2 mt-4 p-3 rounded-xl"
                style={{ backgroundColor: subtleBg }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: cs.productButtonBgColor + "18" }}
                >
                  <Star
                    size={14}
                    className="fill-current"
                    style={{ color: cs.productButtonBgColor }}
                  />
                </div>
                <div>
                  <p
                    className="text-xs font-bold"
                    style={{ color: cardDark ? "#F5F5F5" : cs.productTitleColor }}
                  >
                    {t(pageContent, "popularChoiceText")}
                  </p>
                  <p
                    className="text-[10px]"
                    style={{ color: cardMutedColor }}
                  >
                    Loved by our guests
                  </p>
                </div>
              </div>
            )}

            {/* Variations — rendered inline as a continuation of the product card */}
            {renderVariationsInline()}
          </div>
        </div>
      </motion.div>
    );
  };

  // ── VARIATIONS (rendered inline inside the info card) ──
  const renderVariationsInline = () => {
    if (!product.variations || product.variations.length === 0) return null;
    if (cs.viewOnlyMode) return null;

    const addonBg = cs.productAddonBgColor || cardBg;
    const addonDark = isDark(addonBg);
    const activeBorder = cs.productAddonActiveBorderColor || cs.productButtonBgColor;

    const selectionBounds = (variation: Variation) => ({
      min: variation.minSelect ?? (variation.required ? 1 : 0),
      max: Math.max(1, variation.maxSelect ?? 1),
    });

    const renderLimitLabel = (variation: Variation) => {
      const { min, max } = selectionBounds(variation);
      if (min === 0 && max === 1) return null;
      const label = min === max ? `Choose ${max}` : `Choose ${min}-${max}`;
      return (
        <span className="text-[10px] font-semibold" style={{ color: cardMutedColor }}>
          {label}
        </span>
      );
    };

    // Shared: toggle handler
    const toggle = (variation: Variation, optionId: string, isSelected: boolean) =>
      setSelectedVariations((prev) => {
        const current = prev[variation.id] ?? [];
        const { max } = selectionBounds(variation);
        const nextSelected = isSelected
          ? current.filter((id) => id !== optionId)
          : max === 1
          ? [optionId]
          : current.length >= max
          ? current
          : [...current, optionId];
        return {
          ...prev,
          [variation.id]: nextSelected,
        };
      });

    // Shared: required / optional badge
    const renderBadge = (required: boolean, size: "sm" | "md") => {
      if (required) {
        return (
          <span
            className={clsx(
              "px-2 py-0.5 rounded-full font-bold uppercase tracking-wide",
              size === "sm" ? "text-[9px]" : "text-[10px]"
            )}
            style={{
              backgroundColor: cs.productButtonBgColor + "18",
              color: cs.productButtonBgColor,
            }}
          >
            Required
          </span>
        );
      }
      return (
        <span
          className={clsx(
            "px-2 py-0.5 rounded-full font-medium",
            size === "sm" ? "text-[9px]" : "text-[10px]"
          )}
          style={{ backgroundColor: subtleBg, color: cardMutedColor }}
        >
          {t(pageContent, "optionalLabel")}
        </span>
      );
    };

    // The variations content — no outer card wrapper, just the inner content
    // so it flows naturally inside the info card

    // ── CLASSIC: Clean card grid with radio-dot indicators ──
    if (variant === "classic") {
      return (
        <>
          <div className="my-5 h-px" style={{ backgroundColor: cardBorderColor }} />
          <h3
            className={clsx("font-bold mb-4 text-base", headingFont)}
            style={{ color: cardDark ? "#F5F5F5" : cs.productTitleColor }}
          >
            {t(pageContent, "customizeSectionTitle")}
          </h3>
          <div className="space-y-5">
            {product.variations.map((variation) => (
              <div key={variation.id}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold" style={{ color: cardDark ? "#F5F5F5" : cs.productTitleColor }}>
                    {tVariation(variation)}
                  </span>
                  {renderBadge(variation.required, "md")}
                  {renderLimitLabel(variation)}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                  {visibleVariationOptions(variation).map((option) => {
                    const isSelected = (selectedVariations[variation.id] ?? []).includes(option.id);
                    return (
                      <motion.button
                        key={option.id}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => toggle(variation, option.id, isSelected)}
                        className={clsx("relative flex items-center gap-3 p-3.5 transition-all duration-200", radius)}
                        style={{
                          backgroundColor: isSelected ? activeBorder + "10" : addonBg,
                          border: `2px solid ${isSelected ? activeBorder : cardBorderColor}`,
                          boxShadow: isSelected ? `0 0 0 1px ${activeBorder}30` : "none",
                        }}
                      >
                        {/* Radio dot */}
                        <div
                          className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 transition-colors duration-200"
                          style={{ borderColor: isSelected ? activeBorder : cardMutedColor + "60" }}
                        >
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: activeBorder }}
                            />
                          )}
                        </div>
                        <div className="flex flex-col items-start min-w-0">
                          <span
                            className="text-sm font-semibold leading-tight truncate w-full"
                            style={{ color: isSelected ? activeBorder : addonDark ? "#F5F5F5" : cs.productTitleColor }}
                          >
                            {tVariationOption(option)}
                          </span>
                          {option.priceAdjustment !== 0 && (
                            <span className="text-xs mt-0.5" style={{ color: isSelected ? activeBorder : cardMutedColor }}>
                              {option.priceAdjustment > 0 ? "+" : ""}{option.priceAdjustment.toFixed(2)} {pageContent.currencySymbol}
                            </span>
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      );
    }

    // ── MINIMAL: Horizontal pill chips ──
    if (variant === "minimal") {
      return (
        <>
          <div className="my-5 h-px" style={{ backgroundColor: cardBorderColor }} />
          <h3
            className={clsx("font-semibold mb-4 text-[15px] tracking-tight", headingFont)}
            style={{ color: cardDark ? "#F5F5F5" : cs.productTitleColor }}
          >
            {t(pageContent, "customizeSectionTitle")}
          </h3>
          <div className="space-y-5">
            {product.variations.map((variation) => (
              <div key={variation.id}>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-xs font-medium uppercase tracking-wider" style={{ color: cardMutedColor }}>
                    {tVariation(variation)}
                  </span>
                  {renderBadge(variation.required, "sm")}
                  {renderLimitLabel(variation)}
                </div>
                <div className="flex flex-wrap gap-2">
                  {visibleVariationOptions(variation).map((option) => {
                    const isSelected = (selectedVariations[variation.id] ?? []).includes(option.id);
                    return (
                      <motion.button
                        key={option.id}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => toggle(variation, option.id, isSelected)}
                        className="relative flex items-center gap-1.5 px-4 py-2 rounded-full transition-all duration-200"
                        style={{
                          backgroundColor: isSelected ? activeBorder : addonBg,
                          border: `1.5px solid ${isSelected ? activeBorder : cardBorderColor}`,
                          color: isSelected ? "#FFFFFF" : addonDark ? "#F5F5F5" : cs.productTitleColor,
                        }}
                      >
                        {isSelected && (
                          <motion.span initial={{ width: 0, opacity: 0 }} animate={{ width: 14, opacity: 1 }} className="overflow-hidden">
                            <Check size={14} strokeWidth={2.5} />
                          </motion.span>
                        )}
                        <span className="text-[13px] font-semibold whitespace-nowrap">
                          {tVariationOption(option)}
                        </span>
                        {option.priceAdjustment !== 0 && (
                          <span className="text-[11px] font-medium opacity-75 whitespace-nowrap">
                            {option.priceAdjustment > 0 ? "+" : ""}{option.priceAdjustment.toFixed(2)} {pageContent.currencySymbol}
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      );
    }

    // ── COMPACT: Dense horizontal tags ──
    if (variant === "compact") {
      return (
        <>
          <div className="my-3 h-px" style={{ backgroundColor: cardBorderColor }} />
          <h3
            className={clsx("font-bold mb-2.5 text-sm", headingFont)}
            style={{ color: cardDark ? "#F5F5F5" : cs.productTitleColor }}
          >
            {t(pageContent, "customizeSectionTitle")}
          </h3>
          <div className="space-y-3">
            {product.variations.map((variation) => (
              <div key={variation.id}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[11px] font-semibold" style={{ color: cardDark ? "#F5F5F5" : cs.productTitleColor }}>
                    {tVariation(variation)}
                  </span>
                  {renderBadge(variation.required, "sm")}
                  {renderLimitLabel(variation)}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {visibleVariationOptions(variation).map((option) => {
                    const isSelected = (selectedVariations[variation.id] ?? []).includes(option.id);
                    return (
                      <motion.button
                        key={option.id}
                        whileTap={{ scale: 0.93 }}
                        onClick={() => toggle(variation, option.id, isSelected)}
                        className="relative flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all duration-150"
                        style={{
                          backgroundColor: isSelected ? activeBorder + "15" : addonBg,
                          border: `1.5px solid ${isSelected ? activeBorder : cardBorderColor}`,
                        }}
                      >
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-3 h-3 rounded-full flex items-center justify-center shrink-0"
                            style={{ backgroundColor: activeBorder }}
                          >
                            <Check size={8} strokeWidth={3} color="#FFFFFF" />
                          </motion.div>
                        )}
                        <span
                          className="text-[11px] font-bold whitespace-nowrap"
                          style={{ color: isSelected ? activeBorder : addonDark ? "#F5F5F5" : cs.productTitleColor }}
                        >
                          {tVariationOption(option)}
                        </span>
                        {option.priceAdjustment !== 0 && (
                          <span className="text-[9px] font-semibold whitespace-nowrap" style={{ color: isSelected ? activeBorder : cardMutedColor }}>
                            {option.priceAdjustment > 0 ? "+" : ""}{option.priceAdjustment.toFixed(2)} {pageContent.currencySymbol}
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      );
    }

    // ── IMMERSIVE: Bold full-width rows with filled selection ──
    if (variant === "immersive") {
      return (
        <>
          <div className="my-5 h-px" style={{ backgroundColor: cardBorderColor }} />
          <h3
            className={clsx("font-extrabold mb-4 text-lg tracking-tight", headingFont)}
            style={{ color: cardDark ? "#F5F5F5" : cs.productTitleColor }}
          >
            {t(pageContent, "customizeSectionTitle")}
          </h3>
          <div className="space-y-5">
            {product.variations.map((variation) => (
              <div key={variation.id}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-bold" style={{ color: cardDark ? "#F5F5F5" : cs.productTitleColor }}>
                    {tVariation(variation)}
                  </span>
                  {renderBadge(variation.required, "md")}
                  {renderLimitLabel(variation)}
                </div>
                <div className="space-y-2">
                  {visibleVariationOptions(variation).map((option) => {
                    const isSelected = (selectedVariations[variation.id] ?? []).includes(option.id);
                    return (
                      <motion.button
                        key={option.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toggle(variation, option.id, isSelected)}
                        className={clsx(
                          "relative w-full flex items-center justify-between p-4 transition-all duration-250",
                          radius
                        )}
                        style={{
                          backgroundColor: isSelected ? activeBorder : addonBg,
                          border: `2px solid ${isSelected ? activeBorder : cardBorderColor}`,
                          boxShadow: isSelected ? `0 4px 20px ${activeBorder}35` : "none",
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200"
                            style={{
                              borderColor: isSelected ? "#FFFFFF" : cardMutedColor + "50",
                              backgroundColor: isSelected ? "rgba(255,255,255,0.25)" : "transparent",
                            }}
                          >
                            {isSelected && (
                              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                <Check size={12} strokeWidth={3} color="#FFFFFF" />
                              </motion.div>
                            )}
                          </div>
                          <span
                            className="text-sm font-bold"
                            style={{ color: isSelected ? "#FFFFFF" : addonDark ? "#F5F5F5" : cs.productTitleColor }}
                          >
                            {tVariationOption(option)}
                          </span>
                        </div>
                        {option.priceAdjustment !== 0 && (
                          <span
                            className="text-xs font-bold"
                            style={{ color: isSelected ? "rgba(255,255,255,0.85)" : cardMutedColor }}
                          >
                            {option.priceAdjustment > 0 ? "+" : ""}{option.priceAdjustment.toFixed(2)} {pageContent.currencySymbol}
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      );
    }

    // ── ELEGANT: Refined list with decorative divider & serif accents ──
    return (
      <>
        {/* Decorative divider with title */}
        <div className="flex items-center gap-4 mt-6 mb-5">
          <div className="h-px flex-1" style={{ backgroundColor: cardBorderColor }} />
          <h3
            className={clsx("font-bold text-[13px] tracking-wide uppercase", headingFont)}
            style={{ color: cardDark ? "#F5F5F5" : cs.productTitleColor }}
          >
            {t(pageContent, "customizeSectionTitle")}
          </h3>
          <div className="h-px flex-1" style={{ backgroundColor: cardBorderColor }} />
        </div>
        <div className="space-y-6">
          {product.variations.map((variation) => (
            <div key={variation.id}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[13px] font-semibold tracking-wide" style={{ color: cardDark ? "#F5F5F5" : cs.productTitleColor }}>
                  {tVariation(variation)}
                </span>
                {renderBadge(variation.required, "md")}
                  {renderLimitLabel(variation)}
              </div>
              <div className="space-y-0">
                {visibleVariationOptions(variation).map((option, oi) => {
                  const isSelected = (selectedVariations[variation.id] ?? []).includes(option.id);
                  return (
                    <motion.button
                      key={option.id}
                      whileTap={{ scale: 0.995 }}
                      onClick={() => toggle(variation, option.id, isSelected)}
                      className={clsx(
                        "relative w-full flex items-center justify-between py-3.5 px-3 transition-all duration-200",
                        oi === 0 && "rounded-t-xl",
                        oi === visibleVariationOptions(variation).length - 1 && "rounded-b-xl"
                      )}
                      style={{
                        backgroundColor: isSelected ? activeBorder + "08" : "transparent",
                        borderBottom: oi < variation.options.length - 1 ? `1px solid ${cardBorderColor}` : "none",
                      }}
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className="w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex items-center justify-center shrink-0 transition-all duration-200"
                          style={{
                            borderColor: isSelected ? activeBorder : cardMutedColor + "40",
                            backgroundColor: isSelected ? activeBorder : "transparent",
                          }}
                        >
                          {isSelected && (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                              <Check size={11} strokeWidth={2.5} color="#FFFFFF" />
                            </motion.div>
                          )}
                        </div>
                        <span
                          className={clsx("text-[14px] font-medium", bodyFont)}
                          style={{ color: isSelected ? activeBorder : addonDark ? "#F5F5F5" : cs.productTitleColor }}
                        >
                          {tVariationOption(option)}
                        </span>
                      </div>
                      {option.priceAdjustment !== 0 && (
                        <span
                          className="text-xs font-semibold tabular-nums"
                          style={{ color: isSelected ? activeBorder : cardMutedColor }}
                        >
                          {option.priceAdjustment > 0 ? "+" : ""}{option.priceAdjustment.toFixed(2)} {pageContent.currencySymbol}
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </>
    );
  };

  // ── ADDONS ─────────────────────────────────────────────
  const renderAddons = () => {
    if (!product.addons || product.addons.length === 0) return null;
    if (visibleAddons.length === 0) return null;
    const compactMode = variant === "compact";
    const elegantMode = variant === "elegant";

    const addonBg = cs.productAddonBgColor || cardBg;
    const addonDark = isDark(addonBg);
    const activeBorder = cs.productAddonActiveBorderColor || cs.productButtonBgColor;
    const addonGroups = Array.from(
      visibleAddons.reduce((groups, addon) => {
        const key = addonGroupKey(addon);
        const current = groups.get(key) ?? [];
        current.push(addon);
        groups.set(key, current);
        return groups;
      }, new Map<string, Addon[]>())
    );

    return (
      <motion.div
        {...anim(0.2)}
        className={clsx(
          compactMode ? "px-4 pb-3" : elegantMode ? "px-5 md:px-8 pb-4" : "px-4 md:px-6 pb-4",
          pad
        )}
      >
        <div
          className={clsx(radius, shadow, "overflow-hidden")}
          style={{
            backgroundColor: cardBg,
            border: `1px solid ${cardBorderColor}`,
          }}
        >
          <div
            className={clsx(
              compactMode ? "p-4" : elegantMode ? "p-6 md:p-8" : "p-5 md:p-6"
            )}
          >
            <div className="flex items-center gap-2 mb-4">
              <h2
                className={clsx(
                  "font-bold",
                  compactMode ? "text-sm" : elegantMode ? "text-lg" : "text-base",
                  headingFont
                )}
                style={{ color: cardDark ? "#F5F5F5" : cs.productTitleColor }}
              >
                Extras
              </h2>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{
                  backgroundColor: subtleBg,
                  color: cardMutedColor,
                }}
              >
                {t(pageContent, "optionalLabel")}
              </span>
            </div>

            <div className="space-y-4">
              {addonGroups.map(([groupId, addons]) => {
                const firstAddon = addons[0];
                const maxSelect = addonGroupLimit(firstAddon);
                const minSelect = addonGroupMin(firstAddon);
                const selectedInGroup = selectedAddonCountForGroup(groupId);
                const limitLabel =
                  minSelect > 0 || maxSelect > 0
                    ? minSelect === maxSelect && maxSelect > 0
                      ? `Choose ${maxSelect}`
                      : `Choose ${minSelect}-${maxSelect || addons.length}`
                    : null;

                return (
                  <div key={groupId} className="space-y-2">
                    {groupId !== "__default__" && (
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold" style={{ color: cardDark ? "#F5F5F5" : cs.productTitleColor }}>
                          {addonGroupLabel(firstAddon)}
                        </p>
                        {limitLabel && (
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: subtleBg, color: cardMutedColor }}
                          >
                            {limitLabel}
                          </span>
                        )}
                      </div>
                    )}
                    {addons.map((addon) => {
                      const qty = selectedAddons[addon.id] ?? 0;
                      const isSelected = qty > 0;
                      const limitReached = maxSelect > 0 && selectedInGroup >= maxSelect && !isSelected;

                      return (
                        <div
                          key={addon.id}
                          role="button"
                          tabIndex={limitReached ? -1 : 0}
                          onClick={() => { if (!limitReached) toggleAddon(addon); }}
                          onKeyDown={(e) => { if (!limitReached && (e.key === "Enter" || e.key === " ")) toggleAddon(addon); }}
                          aria-disabled={limitReached}
                          className={clsx(
                            "w-full flex items-center justify-between p-3 transition-all duration-200",
                            limitReached && "opacity-45 cursor-not-allowed",
                            compactMode ? "rounded-xl" : radius
                          )}
                          style={{
                            backgroundColor: isSelected
                              ? activeBorder + "12"
                              : addonBg,
                            border: `2px solid ${
                              isSelected ? activeBorder : cardBorderColor
                            }`,
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Checkbox */}
                            <div
                              className={clsx(
                                "w-5 h-5 rounded-md flex items-center justify-center transition-colors shrink-0",
                                "border-2"
                              )}
                              style={{
                                backgroundColor: isSelected
                                  ? activeBorder
                                  : "transparent",
                                borderColor: isSelected
                                  ? activeBorder
                                  : cardMutedColor,
                              }}
                            >
                              {isSelected && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                >
                                  <Check
                                    size={12}
                                    strokeWidth={3}
                                    color="#FFFFFF"
                                  />
                                </motion.div>
                              )}
                            </div>
                            <span
                              className={clsx(
                                "font-semibold truncate",
                                compactMode ? "text-xs" : "text-sm"
                              )}
                              style={{
                                color: isSelected
                                  ? activeBorder
                                  : addonDark
                                  ? "#F5F5F5"
                                  : cs.productTitleColor,
                              }}
                            >
                              {tAddon(addon)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {isSelected && (
                              <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => setAddonQuantity(addon, qty - 1)}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                                  style={{ backgroundColor: subtleBg, color: activeBorder }}
                                  aria-label={`Decrease ${addon.name}`}
                                >
                                  <Minus size={14} />
                                </button>
                                <span className="w-5 text-center text-sm font-bold" style={{ color: activeBorder }}>
                                  {qty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setAddonQuantity(addon, qty + 1)}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                                  style={{ backgroundColor: activeBorder, color: "#FFFFFF" }}
                                  aria-label={`Increase ${addon.name}`}
                                >
                                  <Plus size={14} />
                                </button>
                              </span>
                            )}
                            <span
                              className={clsx(
                                "font-bold",
                                compactMode ? "text-xs" : "text-sm"
                              )}
                              style={{
                                color: isSelected ? activeBorder : cs.productPriceColor,
                              }}
                            >
                              +{addon.price.toFixed(2)}
                              {" "}{pageContent.currencySymbol}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    </div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  // ── QUANTITY SELECTOR ──────────────────────────────────
  const renderQuantity = () => {
    const compactMode = variant === "compact";
    const elegantMode = variant === "elegant";

    const qtyBg = cs.productQuantityBgColor || subtleBg;
    const qtyDark = isDark(qtyBg.startsWith("rgba") ? "#888888" : qtyBg);

    return (
      <motion.div
        {...anim(0.25)}
        className={clsx(
          compactMode ? "px-4 pb-3" : elegantMode ? "px-5 md:px-8 pb-4" : "px-4 md:px-6 pb-4",
          pad
        )}
      >
        <div
          className={clsx(radius, shadow, "overflow-hidden")}
          style={{
            backgroundColor: cardBg,
            border: `1px solid ${cardBorderColor}`,
          }}
        >
          <div
            className={clsx(
              "flex items-center justify-between",
              compactMode ? "p-4" : elegantMode ? "p-6 md:p-8" : "p-5 md:p-6"
            )}
          >
            <div>
              <h2
                className={clsx(
                  "font-bold",
                  compactMode ? "text-sm" : elegantMode ? "text-lg" : "text-base",
                  headingFont
                )}
                style={{ color: cardDark ? "#F5F5F5" : cs.productTitleColor }}
              >
                {t(pageContent, "quantityLabel")}
              </h2>
              <p
                className={clsx(
                  "mt-0.5",
                  compactMode ? "text-[10px]" : "text-xs"
                )}
                style={{ color: cardMutedColor }}
              >
                {t(pageContent, "quantityDescription")}
              </p>
            </div>

            {/* Quantity controls */}
            <div
              className={clsx(
                "flex items-center gap-3",
                compactMode ? "p-1.5 rounded-xl" : "p-2 rounded-2xl"
              )}
              style={{ backgroundColor: qtyBg }}
            >
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className={clsx(
                  "flex items-center justify-center rounded-xl transition-all",
                  compactMode ? "w-8 h-8" : "w-10 h-10",
                  quantity <= 1 && "opacity-40"
                )}
                style={{
                  backgroundColor: cardBg,
                  color: cardDark ? "#F5F5F5" : cs.productTitleColor,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                }}
              >
                <Minus size={compactMode ? 14 : 16} strokeWidth={2.5} />
              </button>

              <span
                className={clsx(
                  "font-extrabold min-w-[2rem] text-center",
                  compactMode ? "text-base" : "text-lg"
                )}
                style={{
                  color: cardDark ? "#F5F5F5" : cs.productTitleColor,
                }}
              >
                {quantity}
              </span>

              <button
                onClick={() => setQuantity((q) => q + 1)}
                className={clsx(
                  "flex items-center justify-center rounded-xl transition-all",
                  compactMode ? "w-8 h-8" : "w-10 h-10"
                )}
                style={{
                  backgroundColor: cs.productButtonBgColor,
                  color: cs.productButtonTextColor,
                  boxShadow: `0 2px 8px ${cs.productButtonBgColor}40`,
                }}
              >
                <Plus size={compactMode ? 14 : 16} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  // ── RELATED ITEMS ──────────────────────────────────────
  const renderRelated = () => {
    if (relatedItems.length === 0) return null;
    const compactMode = variant === "compact";
    const elegantMode = variant === "elegant";

    const relBg = cs.productRelatedBgColor || cardBg;
    const relDark = isDark(relBg);

    return (
      <motion.div
        {...anim(0.3)}
        className={clsx(
          compactMode ? "px-4 pb-4" : elegantMode ? "px-5 md:px-8 pb-6" : "px-4 md:px-6 pb-6",
          pad
        )}
      >
        {/* Section title */}
        <h3
          className={clsx(
            "font-bold mb-3",
            compactMode ? "text-sm" : elegantMode ? "text-lg" : "text-base",
            headingFont
          )}
          style={{ color: pageDark ? "#F5F5F5" : cs.productTitleColor }}
        >
          {t(pageContent, "moreCategoryPrefix")} {product.category}
        </h3>

        {/* Horizontal scrollable items */}
        <div
          className={clsx(
            "flex overflow-x-auto no-scrollbar pb-1",
            compactMode ? "gap-2" : "gap-3 md:gap-4"
          )}
        >
          {relatedItems.map((item, idx) => (
            <motion.button
              key={item.id}
              {...anim(0.05 * idx + 0.25)}
              onClick={() => router.push(`/${venueSlug}/product/${item.id}`)}
              className={clsx(
                "shrink-0 overflow-hidden transition-all group",
                compactMode
                  ? "w-28 rounded-xl"
                  : variant === "elegant"
                  ? "w-36 md:w-44 lg:w-48"
                  : "w-32 md:w-40 lg:w-44",
                radius,
                shadow
              )}
              style={{ backgroundColor: relBg }}
            >
              <div
                className={clsx(
                  "overflow-hidden",
                  compactMode
                    ? "h-16"
                    : variant === "elegant"
                    ? "h-24 md:h-28 lg:h-32"
                    : "h-20 md:h-24 lg:h-28"
                )}
              >
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
              </div>
              <div
                className={clsx(
                  compactMode ? "p-2" : "p-2.5 md:p-3"
                )}
              >
                <p
                  className={clsx(
                    "font-bold line-clamp-1",
                    compactMode ? "text-[10px]" : "text-xs md:text-sm",
                    headingFont
                  )}
                  style={{
                    color: relDark ? "#F5F5F5" : cs.productTitleColor,
                  }}
                >
                  {tProduct(item, "name")}
                </p>
                <p
                  className={clsx(
                    "font-bold mt-0.5",
                    compactMode ? "text-[10px]" : "text-xs md:text-sm"
                  )}
                  style={{ color: cs.productPriceColor }}
                >
                  {item.price.toFixed(2)}
                  {" "}{pageContent.currencySymbol}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    );
  };

  // ── STICKY ADD TO ORDER BAR ────────────────────────────
  const renderStickyBar = () => {
    const compactMode = variant === "compact";

    return (
      <div
        className={clsx(
          "fixed bottom-0 left-0 right-0 z-50",
          compactMode ? "p-3" : "p-4 md:p-5"
        )}
        style={{
          backgroundColor: stickyBg + "F2",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderTop: `1px solid ${stickyDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`,
        }}
      >
        <div
          className={clsx(
            "max-w-md md:max-w-3xl lg:max-w-6xl xl:max-w-7xl mx-auto"
          )}
        >
          {/* Price breakdown */}
          {(addonsTotal > 0 || variationsTotal > 0 || quantity > 1) && (
            <div
              className={clsx(
                "flex items-center justify-between mb-2.5 px-1",
                compactMode ? "text-[10px]" : "text-[11px]"
              )}
              style={{ color: stickyMutedColor }}
            >
              <span>
                {product.price.toFixed(2)} {pageContent.currencySymbol}
                {variationsTotal > 0 &&
                  ` + ${variationsTotal.toFixed(2)} ${pageContent.currencySymbol}`}
                {addonsTotal > 0 &&
                  ` + ${addonsTotal.toFixed(2)} ${pageContent.currencySymbol} extras`}
                {quantity > 1 && ` × ${quantity}`}
              </span>
              <span
                className="font-bold"
                style={{
                  color: stickyDark ? "#F5F5F5" : cs.productTitleColor,
                }}
              >
                {totalPrice.toFixed(2)}
                {" "}{pageContent.currencySymbol}
              </span>
            </div>
          )}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleAddToOrder}
            disabled={added || !canAddToOrder}
            className={clsx(
              "w-full flex items-center justify-center gap-2 font-extrabold transition-all duration-300",
              compactMode
                ? "py-3 text-sm"
                : "py-4 md:py-5 text-base md:text-lg",
              btnRadius,
              !canAddToOrder && "opacity-50 cursor-not-allowed"
            )}
            style={{
              backgroundColor: added
                ? "#22C55E"
                : cs.productButtonBgColor,
              color: added ? "#FFFFFF" : cs.productButtonTextColor,
              boxShadow: added
                ? "0 4px 14px rgba(34,197,94,0.4)"
                : `0 4px 14px ${cs.productButtonBgColor}40`,
            }}
          >
            <AnimatePresence mode="wait">
              {added ? (
                <motion.div
                  key="added"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-2"
                >
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <Check size={20} strokeWidth={3} />
                  </motion.div>
                  {t(pageContent, "addedToOrderText")}
                </motion.div>
              ) : (
                <motion.span key="add">
                  {t(pageContent, "addToOrderText")} — {totalPrice.toFixed(2)}
                  {" "}{pageContent.currencySymbol}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // MAIN LAYOUT — variant-aware structure
  // ═══════════════════════════════════════════════════════════
  const desktopSplit =
    variant === "minimal" || variant === "compact"
      ? "lg:w-3/5"
      : "lg:w-1/2";

  const bottomPadding =
    cs.viewOnlyMode ? "pb-8" : variant === "compact" ? "pb-24" : "pb-32";

  return (
    <div
      className={clsx(bottomPadding, bodyFont, fontSize)}
      style={{ backgroundColor: pageBg }}
    >
      {/* Desktop: side-by-side layout */}
      <div
        className={clsx(
          "lg:flex lg:gap-0 lg:min-h-screen",
          cs.productImagePosition === "right" && "lg:flex-row-reverse"
        )}
      >
        {/* Hero image section */}
        {renderHeroImage()}

        {/* Content area */}
        <div className={clsx(desktopSplit, "lg:overflow-y-auto", bottomPadding)}>
          {renderInfoCard()}
          {!cs.viewOnlyMode && renderAddons()}
          {!cs.viewOnlyMode && renderQuantity()}
          {renderRelated()}
        </div>
      </div>

      {/* Sticky bottom bar */}
      {!cs.viewOnlyMode && renderStickyBar()}
    </div>
  );
}
