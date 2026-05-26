"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { Search, Wifi, Clock, MapPin, X, Star, ChevronRight, QrCode } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { isDark, mutedText, subtleBorder, subtleSurface, hoverSurface } from "@/lib/color-utils";
import { useCmsData } from "@/hooks/useCmsData";
import { useTranslation } from "@/hooks/useTranslation";
import { useHappyHourPricing } from "@/hooks/useHappyHourPricing";
import { MenuSectionItem } from "@/types/cms";
import MenuList from "@/components/MenuList";
import OrderBar from "@/components/OrderBar";
import { useTableSessionStore } from "@/store/tableSessionStore";

// ─── Font map helpers ────────────────────────────────────
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
const GAP_MAP: Record<string, string> = {
  tight: "gap-1",
  normal: "gap-2 md:gap-3",
  wide: "gap-4 md:gap-5",
};

export default function MenuPage() {
  const { venue } = useParams<{ venue: string }>();
  const venueSlug = decodeURIComponent(venue || "");
  const cmsData = useCmsData();
  const { t, tRestaurant, tCategory, tProduct } = useTranslation();

  // CMS data (preview overrides are now handled inside useCmsData)
  const restaurant = cmsData.restaurant;
  const categoryConfig = cmsData.categoryConfig;
  const products = cmsData.products;
  const { prices: happyHourPrices } = useHappyHourPricing(venueSlug);
  const pageContent = cmsData.pageContent;
  const cs = cmsData.componentStyles;
  const lc = cmsData.layoutConfig;

  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const tableValid = useTableSessionStore((s) => s.isValid());
  const searchRef = useRef<HTMLInputElement>(null);
  const menuContentRef = useRef<HTMLDivElement>(null);

  // ─── Scroll to category section ────────────────────────
  const scrollToCategory = useCallback((catId: string) => {
    setActiveCategory(catId);
    setSearchQuery("");
    if (catId === "all" || catId === "popular") {
      menuContentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    // Category IDs are lowercase, section IDs match category label lowercase
    const catConfig = categoryConfig.find((c) => c.id === catId);
    const sectionId = catConfig ? `category-${catConfig.label.toLowerCase()}` : `category-${catId}`;
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [categoryConfig]);

  // ─── Track visible category via IntersectionObserver ───
  useEffect(() => {
    if (searchQuery) return; // don't track when searching
    const sections = document.querySelectorAll<HTMLElement>("[id^='category-']");
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the first section that is intersecting from the top
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const sectionName = visible[0].target.id.replace("category-", "");
          const matchingCat = categoryConfig.find(
            (c) => c.label.toLowerCase() === sectionName
          );
          if (matchingCat) {
            setActiveCategory(matchingCat.id);
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [categoryConfig, searchQuery]);

  // ─── Derived data ──────────────────────────────────────
  const pricedProducts = useMemo(
    () =>
      products.map((product) => {
        const happyHour = happyHourPrices.get(product.id);
        if (!happyHour) return product;
        return {
          ...product,
          originalPrice: product.price,
          happyHourPrice: happyHour.overridePrice,
          happyHourLabel: happyHour.label,
          price: happyHour.overridePrice,
        };
      }),
    [products, happyHourPrices]
  );

  const searchFilteredProducts = pricedProducts.filter((p) => {
    if (searchQuery === "") return true;
    return (
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // ─── Layout helpers ────────────────────────────────────
  const headingFont = HEADING_FONT_MAP[lc.headingFont] || "";
  const bodyFont = BODY_FONT_MAP[lc.bodyFont] || "";
  const fontSize = FONT_SIZE_MAP[lc.baseFontSize] || "";
  const pad = DENSITY_PAD[lc.contentDensity] || DENSITY_PAD.comfortable;
  const heroH = cs.heroHeight === "compact" ? "h-44 md:h-56 lg:h-64" : cs.heroHeight === "tall" ? "h-72 md:h-96 lg:h-[28rem]" : "h-56 md:h-72 lg:h-80";

  // Hero media helper — renders video or image based on CMS setting
  const useVideo = cs.heroMediaType === "video" && !!cs.heroVideoUrl;
  const heroMedia = (extraClass = "w-full h-full object-cover") =>
    useVideo ? (
      <video
        src={cs.heroVideoUrl}
        autoPlay
        loop
        muted
        playsInline
        className={extraClass}
      />
    ) : (
      <img src={cs.heroImageUrl || restaurant.image} alt={tRestaurant(restaurant, "name")} className={extraClass} />
    );
  const overlayOpacity = cs.heroOverlay === "light" ? "from-black/50 via-black/20 to-black/0" : cs.heroOverlay === "medium" ? "from-black/65 via-black/30 to-black/5" : "from-black/80 via-black/40 to-black/5";
  const heroAlign = cs.heroTextAlign === "center" ? "text-center items-center" : cs.heroTextAlign === "right" ? "text-right items-end" : "";
  const heroPos = cs.heroTextAlign === "center" ? "left-0 right-0 flex justify-center" : cs.heroTextAlign === "right" ? "right-0" : "left-0 right-0";

  // ─── Theme-aware derived colors ─────────────────────────
  const pageBg = cs.menuPageBgColor || "#F7F7F7";
  const pageMuted = mutedText(pageBg);
  const pageSurface = subtleSurface(pageBg);
  const pageBorder = subtleBorder(pageBg);
  const pageHover = hoverSurface(pageBg);
  const accentColor = cs.cardPriceColor || "#F4B400";
  const infoBg = cs.infoBarBgColor || "#FFFFFF";
  const infoMuted = mutedText(infoBg);
  const infoSurface = subtleSurface(infoBg);
  const infoBorder = subtleBorder(infoBg);
  const catBg = cs.categoryBarBgColor || "#FFFFFF";
  const catDark = isDark(catBg);
  const catMuted = mutedText(catBg);
  const catSurface = subtleSurface(catBg);
  const catText = catDark ? "#FFFFFF" : "#1E1E1E";
  const catBorder = subtleBorder(catBg);

  // Animation delay helper
  const anim = (delay: number) =>
    lc.animationStyle === "none"
      ? {}
      : {
          initial: { opacity: 0, y: lc.animationStyle === "dramatic" ? 20 : 10 },
          animate: { opacity: 1, y: 0 },
          transition: {
            delay,
            duration: lc.animationStyle === "subtle" ? 0.2 : lc.animationStyle === "playful" ? 0.5 : 0.3,
          },
        };

  // ─── Section renderers ─────────────────────────────────
  const renderHero = () => {
    if (lc.heroVariant === "minimal") {
      return (
        <div className="px-4 md:px-6 lg:px-8 pt-6 pb-3" style={{ backgroundColor: cs.menuPageBgColor }}>
          <motion.div {...anim(0.1)}>
            <h1 className={clsx("text-2xl md:text-3xl font-extrabold tracking-tight", headingFont)} style={{ color: cs.infoBarTextColor }}>{tRestaurant(restaurant, "name")}</h1>
            <p className="text-sm mt-1" style={{ color: pageMuted }}>{tRestaurant(restaurant, "tagline")}</p>
          </motion.div>
        </div>
      );
    }
    if (lc.heroVariant === "centered") {
      return (
        <div className={clsx("relative overflow-hidden", heroH)}>
          {heroMedia("w-full h-full object-cover scale-105")}
          <div className={clsx("absolute inset-0 bg-gradient-to-t", overlayOpacity)} />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
            <motion.div {...anim(0.1)}>
              <h1 className={clsx("text-3xl md:text-5xl font-extrabold text-white tracking-tight", headingFont)}>{tRestaurant(restaurant, "name")}</h1>
              <p className="text-sm md:text-base text-white/60 mt-2 font-medium">{tRestaurant(restaurant, "tagline")}</p>
            </motion.div>
          </div>
          <motion.div {...anim(0.3)} className="absolute top-4 right-4 md:top-6 md:right-6">
            <div className="glass rounded-full px-3 py-1.5 flex items-center gap-1.5 text-[11px] font-semibold shadow-sm" style={{ color: "#1E1E1E" }}>
              <Wifi size={11} style={{ color: accentColor }} />{restaurant.wifi}
            </div>
          </motion.div>
        </div>
      );
    }
    if (lc.heroVariant === "split") {
      return (
        <div className="flex flex-col md:flex-row" style={{ backgroundColor: cs.menuPageBgColor }}>
          <div className="flex-1 p-6 md:p-10 flex flex-col justify-center">
            <motion.div {...anim(0.1)}>
              <h1 className={clsx("text-3xl md:text-4xl font-extrabold tracking-tight", headingFont)} style={{ color: cs.infoBarTextColor }}>{tRestaurant(restaurant, "name")}</h1>
              <p className="text-sm mt-2" style={{ color: pageMuted }}>{tRestaurant(restaurant, "tagline")}</p>
              <div className="flex items-center gap-3 mt-4 text-xs" style={{ color: pageMuted }}>
                <span className="flex items-center gap-1"><Clock size={12} style={{ color: accentColor }} />{tRestaurant(restaurant, "openHours")}</span>
                <span className="flex items-center gap-1"><Wifi size={12} style={{ color: accentColor }} />{restaurant.wifi}</span>
              </div>
            </motion.div>
          </div>
          <div className="h-48 md:h-auto md:w-1/2">
            {heroMedia()}
          </div>
        </div>
      );
    }
    if (lc.heroVariant === "overlay-full") {
      return (
        <div className="relative overflow-hidden h-72 md:h-[28rem]">
          {heroMedia()}
          <div className="absolute inset-0 bg-black/60" />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
            <motion.div {...anim(0.1)}>
              {restaurant.logo && <img src={restaurant.logo} alt="" className="w-16 h-16 rounded-2xl mb-4 shadow-lg" />}
              <h1 className={clsx("text-4xl md:text-6xl font-extrabold text-white tracking-tight", headingFont)}>{tRestaurant(restaurant, "name")}</h1>
              <p className="text-base text-white/50 mt-2 font-medium max-w-md">{tRestaurant(restaurant, "tagline")}</p>
            </motion.div>
          </div>
        </div>
      );
    }
    // Classic (default)
    return (
      <div className={clsx("relative overflow-hidden", heroH)}>
        {heroMedia("w-full h-full object-cover scale-105")}
        <div className={clsx("absolute inset-0 bg-gradient-to-t", overlayOpacity)} />
        <div className={clsx("absolute bottom-0 p-5 md:p-8 lg:p-10", heroPos)}>
          <motion.div {...anim(0.1)} className={heroAlign}>
            <h1 className={clsx("text-3xl md:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-none", headingFont)}>{tRestaurant(restaurant, "name")}</h1>
            <p className="text-sm md:text-base text-white/60 mt-1 md:mt-2 font-medium">{tRestaurant(restaurant, "tagline")}</p>
          </motion.div>
        </div>
        <motion.div {...anim(0.3)} className="absolute top-4 right-4 md:top-6 md:right-6">
          <div className="glass rounded-full px-3 py-1.5 md:px-4 md:py-2 flex items-center gap-1.5 text-[11px] md:text-xs font-semibold shadow-sm" style={{ color: "#1E1E1E" }}>
            <Wifi size={11} className="md:w-3.5 md:h-3.5" style={{ color: accentColor }} />{restaurant.wifi}
          </div>
        </motion.div>
      </div>
    );
  };

  const renderInfoBar = () => (
    <motion.div
      {...anim(0.15)}
      className={clsx(pad, lc.infoBarVariant === "floating" ? "-mt-5 md:-mt-8 relative z-10" : "mt-0")}
    >
      <div
        className={clsx(
          "rounded-2xl p-4 md:p-5 lg:p-6",
          lc.infoBarVariant === "card" ? "shadow-card" : lc.infoBarVariant === "banner" ? "shadow-none" : "shadow-soft"
        )}
        style={{ backgroundColor: cs.infoBarBgColor, border: lc.infoBarVariant === "banner" ? `1px solid ${infoBorder}` : undefined }}
      >
        <div className={clsx("flex items-center gap-4 md:gap-6", lc.infoBarVariant === "inline" && "flex-wrap")}>
          <div className="flex-1">
            <p className={clsx("font-bold", fontSize === "text-[13px]" ? "text-sm" : "text-sm md:text-base", headingFont)} style={{ color: cs.infoBarTextColor }}>
              {t(pageContent, "welcomeTitle")}
            </p>
            <p className={clsx("text-[11px] md:text-xs mt-0.5 leading-relaxed", bodyFont)} style={{ color: cs.infoBarTextColor, opacity: 0.6 }}>
              {t(pageContent, "welcomeDescription")}
            </p>
          </div>
          <div className="flex flex-col md:flex-row gap-1.5 md:gap-3 shrink-0">
            <div className="flex items-center gap-1 text-[10px] rounded-lg px-2 py-1" style={{ color: infoMuted, backgroundColor: infoSurface }}>
              <Clock size={10} style={{ color: accentColor }} />
              <span className="font-medium">{tRestaurant(restaurant, "openHours").split("–")[0].trim()}</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] rounded-lg px-2 py-1" style={{ color: infoMuted, backgroundColor: infoSurface }}>
              <MapPin size={10} style={{ color: accentColor }} />
              <span className="font-medium">{t(pageContent, "dineInLabel")}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderPromoBanner = () => {
    if (lc.promoBannerVariant === "marquee") {
      return (
        <div className="overflow-hidden py-2" style={{ backgroundColor: cs.promoBannerBgColor }}>
          <motion.div animate={{ x: ["100%", "-100%"] }} transition={{ repeat: Infinity, duration: 12, ease: "linear" }} className="whitespace-nowrap">
            <span className="text-sm font-bold px-8" style={{ color: cs.promoBannerTextColor }}>
              {t(pageContent, "promoBannerText")} — {t(pageContent, "promoBannerSubtext")}
            </span>
          </motion.div>
        </div>
      );
    }
    if (lc.promoBannerVariant === "card") {
      return (
        <div className={pad}>
          <motion.div {...anim(0.15)} className="rounded-2xl p-4 shadow-card" style={{ backgroundColor: cs.promoBannerBgColor }}>
            <p className={clsx("text-sm font-bold", headingFont)} style={{ color: cs.promoBannerTextColor }}>{t(pageContent, "promoBannerText")}</p>
            {pageContent.promoBannerSubtext && <p className="text-xs mt-1 opacity-80" style={{ color: cs.promoBannerTextColor }}>{t(pageContent, "promoBannerSubtext")}</p>}
          </motion.div>
        </div>
      );
    }
    if (lc.promoBannerVariant === "floating") {
      return (
        <div className={pad}>
          <motion.div {...anim(0.15)} className="rounded-full px-5 py-2.5 flex items-center justify-center gap-2 shadow-soft" style={{ backgroundColor: cs.promoBannerBgColor }}>
            <span className="text-xs font-bold" style={{ color: cs.promoBannerTextColor }}>{t(pageContent, "promoBannerText")}</span>
          </motion.div>
        </div>
      );
    }
    // ribbon (default)
    return (
      <motion.div {...anim(0.15)} className="py-2.5 text-center" style={{ backgroundColor: cs.promoBannerBgColor }}>
        <p className="text-xs md:text-sm font-bold" style={{ color: cs.promoBannerTextColor }}>{t(pageContent, "promoBannerText")}</p>
        {pageContent.promoBannerSubtext && <p className="text-[10px] mt-0.5 opacity-80" style={{ color: cs.promoBannerTextColor }}>{t(pageContent, "promoBannerSubtext")}</p>}
      </motion.div>
    );
  };

  const renderSearchBar = () => {
    if (lc.searchBarVariant === "hidden") return null;
    const isMinimal = lc.searchBarVariant === "minimal";
    const isPill = lc.searchBarVariant === "pill";
    return (
      <motion.div {...anim(0.2)} className={clsx(pad, "pt-4 pb-2")}>
        <div
          className={clsx(
            "relative flex items-center transition-all duration-300",
            isPill ? "rounded-full" : isMinimal ? "rounded-xl" : "rounded-2xl",
            isSearchFocused && "shadow-soft"
          )}
          style={{
            backgroundColor: isSearchFocused && !isMinimal ? (isDark(pageBg) ? hoverSurface(pageBg) : "#FFFFFF") : pageSurface,
            border: isMinimal ? `1px solid ${isSearchFocused ? accentColor : pageBorder}` : undefined,
            boxShadow: isSearchFocused && !isMinimal ? `0 0 0 2px ${accentColor}66` : undefined,
          }}
        >
          <Search size={18} className="absolute left-3.5 transition-colors" style={{ color: isSearchFocused ? accentColor : pageMuted }} />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholder={t(pageContent, "searchPlaceholder")}
            className={clsx("w-full pl-11 pr-10 py-3.5 bg-transparent outline-none placeholder:opacity-40", bodyFont, isPill ? "rounded-full text-sm" : isMinimal ? "rounded-xl text-sm" : "rounded-2xl text-sm")}
            style={{ color: catText }}
          />
          <AnimatePresence>
            {searchQuery && (
              <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} onClick={() => { setSearchQuery(""); searchRef.current?.focus(); }} className="absolute right-3 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: pageBorder }}>
                <X size={12} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  };

  const renderCategoryBar = () => {
    const isGrid = lc.categoryBarVariant === "grid";
    const isPills = lc.categoryBarVariant === "pills";
    const isUnderline = lc.categoryBarVariant === "underline";
    const isMinimal = lc.categoryBarVariant === "minimal";

    return (
      <motion.div
        {...anim(0.25)}
        className={clsx(
          "z-30",
          !isGrid && "backdrop-blur-md",
          cs.categoryBarSticky ? "sticky top-0" : ""
        )}
        style={{ backgroundColor: cs.categoryBarBgColor ? cs.categoryBarBgColor + "F2" : "rgba(255,255,255,0.95)", borderBottom: !isGrid ? `1px solid ${catBorder}` : undefined }}
      >
        <div className={clsx(pad, "py-3")}>
          {isGrid ? (
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {categoryConfig.map((cat, i) => {
                const isActive = activeCategory === cat.id;
                return (
                  <motion.button key={cat.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.03 * i }}
                    onClick={() => scrollToCategory(cat.id)}
                    className={clsx("flex flex-col items-center p-2 rounded-xl transition-all")}
                    style={{
                      backgroundColor: isActive ? accentColor + "1A" : undefined,
                      color: isActive ? accentColor : catText,
                    }}
                  >
                    {cs.categoryBarShowIcons && cat.icon?.trim() && <span className="text-lg">{cat.icon}</span>}
                    <span className="text-[10px] font-semibold mt-1">{tCategory(cat)}</span>
                  </motion.button>
                );
              })}
            </div>
          ) : isUnderline ? (
            <div className="flex overflow-x-auto gap-4 no-scrollbar pb-0.5">
              {categoryConfig.map((cat, i) => {
                const isActive = activeCategory === cat.id;
                return (
                  <button key={cat.id} onClick={() => scrollToCategory(cat.id)}
                    className={clsx("flex items-center gap-1.5 pb-2 border-b-2 transition-all whitespace-nowrap text-sm font-semibold shrink-0")}
                    style={{
                      borderColor: isActive ? accentColor : "transparent",
                      color: isActive ? accentColor : catMuted,
                    }}
                  >
                    {cs.categoryBarShowIcons && cat.icon?.trim() && <span className="text-base">{cat.icon}</span>} {tCategory(cat)}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className={clsx(
              "flex overflow-x-auto no-scrollbar snap-x-mandatory pb-0.5",
              isMinimal ? "gap-1.5" : isPills ? "gap-2" : "gap-2 md:gap-3",
              "md:justify-center lg:justify-start"
            )}>
              {categoryConfig.map((cat, i) => {
                const isActive = activeCategory === cat.id;
                return (
                  <motion.button
                    key={cat.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.05 * i }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => scrollToCategory(cat.id)}
                    className={clsx(
                      "snap-start flex items-center shrink-0 transition-all duration-200",
                      isPills
                        ? clsx("gap-1.5 px-4 py-2 rounded-full text-xs font-semibold", isActive ? "shadow-glow" : "")
                        : isMinimal
                        ? clsx("gap-1 px-3 py-2 rounded-xl text-xs font-semibold")
                        : clsx("flex-col min-w-[72px] md:min-w-[84px] lg:min-w-[96px] px-3 md:px-4 py-2.5 md:py-3 rounded-2xl",
                            isActive ? "bg-gradient-to-br shadow-card text-white " + cat.color : ""
                          )
                    )}
                    style={{
                      backgroundColor: isPills
                        ? (isActive ? accentColor : catSurface)
                        : isMinimal
                        ? (isActive ? accentColor + "0D" : undefined)
                        : (!isActive ? catSurface : undefined),
                      color: isPills
                        ? (isActive ? "#FFFFFF" : catText)
                        : isMinimal
                        ? (isActive ? accentColor : catMuted)
                        : (!isActive ? catText : undefined),
                    }}
                  >
                    {cs.categoryBarShowIcons && cat.icon?.trim() && (
                      <span className={clsx(
                        isPills || isMinimal ? "text-base" : "text-xl md:text-2xl mb-1",
                        isActive && !isPills && !isMinimal && "scale-110 transition-transform duration-200"
                      )}>
                        {cat.icon}
                      </span>
                    )}
                    <span className={clsx(
                      isPills || isMinimal ? "" : "text-[11px] md:text-xs whitespace-nowrap leading-tight",
                      isActive && !isPills && !isMinimal ? "text-white font-semibold" : !isPills && !isMinimal ? "font-semibold" : ""
                    )}
                    style={{ color: !isActive && !isPills && !isMinimal ? catText : undefined }}
                    >
                      {tCategory(cat)}
                    </span>
                    {isActive && !isPills && !isMinimal && (
                      <motion.div layoutId="categoryDot" className="w-1 h-1 rounded-full bg-white/80 mt-1" />
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  const renderFeaturedSection = () => {
    const featured = pricedProducts.filter((p) => p.popular).slice(0, 5);
    if (featured.length === 0) return null;

    return (
      <motion.div {...anim(0.2)} className={clsx(pad, "py-4")}>
        <div className="mb-3">
          <h2 className={clsx("text-lg font-extrabold", headingFont)} style={{ color: cs.sectionTitleColor }}>{t(pageContent, "featuredSectionTitle")}</h2>
          {pageContent.featuredSectionSubtitle && (
            <p className="text-xs mt-0.5" style={{ color: pageMuted }}>{t(pageContent, "featuredSectionSubtitle")}</p>
          )}
        </div>
        {lc.featuredVariant === "carousel" ? (
          <div className="flex overflow-x-auto gap-3 no-scrollbar pb-2">
            {featured.map((item) => (
              <a key={item.id} href={`/${venueSlug}/product/${item.id}`} className="min-w-[200px] max-w-[200px] shrink-0 rounded-2xl overflow-hidden shadow-card flex flex-col" style={{ backgroundColor: cs.cardBgColor }}>
                <img src={item.image} alt={tProduct(item, "name")} className="w-full h-28 object-cover" />
                <div className="p-3 flex-1 flex flex-col">
                  <p className="text-sm font-bold truncate" style={{ color: cs.cardTitleColor }}>{tProduct(item, "name")}</p>
                  <p className="text-xs font-bold mt-auto pt-1" style={{ color: cs.cardPriceColor }}>{item.price.toFixed(2)} {pageContent.currencySymbol}</p>
                </div>
              </a>
            ))}
          </div>
        ) : lc.featuredVariant === "banner" ? (
          <div className="rounded-2xl overflow-hidden shadow-card relative h-40">
            <img src={featured[0].image} alt={tProduct(featured[0], "name")} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent flex items-center p-6">
              <div>
                <p className="text-xs text-white/60 font-semibold">{t(pageContent, "popularBadgeText")}</p>
                <p className="text-xl font-extrabold text-white mt-1">{tProduct(featured[0], "name")}</p>
                <p className="text-sm text-white/80 mt-0.5">{featured[0].price.toFixed(2)} {pageContent.currencySymbol}</p>
              </div>
            </div>
          </div>
        ) : (
          /* highlight (default) */
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {featured.slice(0, 6).map((item) => (
              <a key={item.id} href={`/${venueSlug}/product/${item.id}`} className="rounded-2xl overflow-hidden shadow-soft hover:shadow-card transition-shadow flex flex-col" style={{ backgroundColor: cs.cardBgColor }}>
                <img src={item.image} alt={tProduct(item, "name")} className="w-full h-24 object-cover" />
                <div className="p-2.5 flex-1 flex flex-col">
                  <p className="text-xs font-bold truncate" style={{ color: cs.cardTitleColor }}>{tProduct(item, "name")}</p>
                  <p className="text-[11px] font-bold mt-auto pt-0.5" style={{ color: cs.cardPriceColor }}>{item.price.toFixed(2)} {pageContent.currencySymbol}</p>
                </div>
              </a>
            ))}
          </div>
        )}
      </motion.div>
    );
  };

  const renderMenuContent = () => (
    <div className="mt-2" ref={menuContentRef}>
      {searchQuery !== "" ? (
        <MenuList
          products={searchFilteredProducts}
          categoryName={`Results for "${searchQuery}"`}
        />
      ) : (
        <MenuList products={pricedProducts} grouped />
      )}
    </div>
  );

  const renderSocialProof = () => {
    if (lc.socialProofVariant === "testimonial") {
      return (
        <motion.div {...anim(0.15)} className={clsx(pad, "py-5")}>
          <div className="rounded-2xl shadow-soft p-5 text-center" style={{ backgroundColor: pageSurface }}>
            <p className="text-sm italic mb-2" style={{ color: pageMuted }}>&ldquo;{t(pageContent, "socialProofText")}&rdquo;</p>
            <div className="flex items-center justify-center gap-0.5 mb-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={14} className={i < Math.round(parseFloat(pageContent.socialProofRating || "4.8")) ? "fill-current" : ""} style={{ color: i < Math.round(parseFloat(pageContent.socialProofRating || "4.8")) ? accentColor : pageBorder }} />
              ))}
            </div>
            <p className="text-xs font-medium" style={{ color: pageMuted }}>{t(pageContent, "socialProofCount")}</p>
          </div>
        </motion.div>
      );
    }
    if (lc.socialProofVariant === "counter") {
      return (
        <motion.div {...anim(0.15)} className={clsx(pad, "py-5")}>
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <p className="text-2xl font-extrabold" style={{ color: cs.cardPriceColor }}>{pageContent.socialProofRating}</p>
              <p className="text-[10px] font-medium" style={{ color: pageMuted }}>Rating</p>
            </div>
            <div className="w-px h-8" style={{ backgroundColor: pageBorder }} />
            <div className="text-center">
              <p className="text-2xl font-extrabold" style={{ color: cs.infoBarTextColor }}>{t(pageContent, "socialProofCount")}</p>
              <p className="text-[10px] font-medium" style={{ color: pageMuted }}>Reviews</p>
            </div>
          </div>
        </motion.div>
      );
    }
    // stars (default)
    return (
      <motion.div {...anim(0.15)} className={clsx(pad, "py-4")}>
        <div className="flex items-center justify-center gap-3 rounded-2xl shadow-soft p-4" style={{ backgroundColor: pageSurface }}>
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={16} className={i < Math.round(parseFloat(pageContent.socialProofRating || "4.8")) ? "fill-current" : ""} style={{ color: i < Math.round(parseFloat(pageContent.socialProofRating || "4.8")) ? accentColor : pageBorder }} />
            ))}
          </div>
          <span className="text-sm font-bold" style={{ color: cs.infoBarTextColor }}>{pageContent.socialProofRating}</span>
          <span className="text-xs" style={{ color: pageMuted }}>· {t(pageContent, "socialProofCount")}</span>
        </div>
      </motion.div>
    );
  };

  const renderFooter = () => {
    if (lc.footerVariant === "detailed") {
      return (
        <footer className="py-8 mt-4" style={{ backgroundColor: cs.footerBgColor }}>
          <div className={clsx(pad, "text-center space-y-3")}>
            <p className={clsx("text-base font-extrabold", headingFont)} style={{ color: cs.footerTextColor }}>{t(pageContent, "footerText")}</p>
            <p className="text-xs opacity-60" style={{ color: cs.footerTextColor }}>{t(pageContent, "footerSubtext")}</p>
            <div className="flex items-center justify-center gap-4 text-xs opacity-50" style={{ color: cs.footerTextColor }}>
              <span className="flex items-center gap-1"><Clock size={10} />{tRestaurant(restaurant, "openHours")}</span>
              <span className="flex items-center gap-1"><MapPin size={10} />{tRestaurant(restaurant, "address")}</span>
            </div>
          </div>
        </footer>
      );
    }
    if (lc.footerVariant === "branded") {
      return (
        <footer className="py-6 mt-4 relative overflow-hidden" style={{ backgroundColor: cs.footerBgColor }}>
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 10px, currentColor 10px, currentColor 11px)", color: cs.footerTextColor }} />
          <div className={clsx(pad, "text-center relative z-10")}>
            {restaurant.logo && <img src={restaurant.logo} alt="" className="w-10 h-10 rounded-xl mx-auto mb-2 shadow-lg" />}
            <p className={clsx("text-sm font-extrabold", headingFont)} style={{ color: cs.footerTextColor }}>{tRestaurant(restaurant, "name")}</p>
            <p className="text-[10px] opacity-50 mt-1" style={{ color: cs.footerTextColor }}>{t(pageContent, "footerSubtext")}</p>
          </div>
        </footer>
      );
    }
    if (lc.footerVariant === "minimal") {
      return (
        <footer className="py-4 mt-4 text-center" style={{ backgroundColor: cs.footerBgColor }}>
          <p className="text-[10px] opacity-50" style={{ color: cs.footerTextColor }}>{t(pageContent, "footerSubtext")}</p>
        </footer>
      );
    }
    // simple (default)
    return (
      <footer className="py-6 mt-4" style={{ backgroundColor: cs.footerBgColor }}>
        <div className={clsx(pad, "text-center")}>
          <p className="text-sm font-bold" style={{ color: cs.footerTextColor }}>{t(pageContent, "footerText")}</p>
          <p className="text-[10px] opacity-50 mt-1" style={{ color: cs.footerTextColor }}>{t(pageContent, "footerSubtext")}</p>
        </div>
      </footer>
    );
  };

  // ─── Section dispatch map ──────────────────────────────
  const SECTION_MAP: Record<string, () => React.ReactNode> = {
    hero: renderHero,
    infoBar: renderInfoBar,
    promoBanner: renderPromoBanner,
    searchBar: renderSearchBar,
    categoryBar: renderCategoryBar,
    featuredSection: renderFeaturedSection,
    menuContent: renderMenuContent,
    socialProof: renderSocialProof,
    footer: renderFooter,
  };

  // ─── Render ────────────────────────────────────────────
  return (
    <div className={clsx("pb-28 md:pb-32", "overscroll-none", bodyFont)} style={{ backgroundColor: cs.menuPageBgColor }}>
      {!tableValid && (
        <div
          className="px-4 py-2 text-center text-[11px] font-medium flex items-center justify-center gap-1.5"
          style={{ backgroundColor: pageSurface, color: pageMuted, borderBottom: `1px solid ${pageBorder}` }}
        >
          <QrCode size={13} style={{ color: accentColor }} />
          Pregledavate meni · Skenirajte QR kod na stolu za naručivanje
        </div>
      )}
      {/* Render sections in configured order */}
      {lc.sections
        .filter((sec: MenuSectionItem) => sec.visible)
        .map((sec: MenuSectionItem) => {
          const renderer = SECTION_MAP[sec.id];
          if (!renderer) return null;
          return <div key={sec.id}>{renderer()}</div>;
        })}

      {/* Order bar hidden in preview mode */}
      <OrderBar />
    </div>
  );
}
