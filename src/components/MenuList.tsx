"use client";

import { Product } from "@/types/product";
import MenuItemCard from "./MenuItemCard";
import { motion } from "framer-motion";
import { useCmsData } from "@/hooks/useCmsData";
import { useTranslation } from "@/hooks/useTranslation";
import clsx from "clsx";

interface MenuSectionProps {
  title: string;
  products: Product[];
  startIndex?: number;
}

// A single category section with a beautiful heading and vertical items
function MenuSection({ title, products, startIndex = 0 }: MenuSectionProps) {
  const { categoryIcons, pageContent, componentStyles: cs } = useCmsData();
  const { t } = useTranslation();

  if (products.length === 0) return null;

  const icon = categoryIcons[title] || "🍽️";
  const centered = cs.sectionTitleAlign === "center";

  return (
    <motion.div
      id={`category-${title.toLowerCase()}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mb-8 scroll-mt-16"
    >
      {/* ── Section Header ─────────────────────── */}
      <div className={clsx("px-4 md:px-6 lg:px-8 mb-4", centered && "text-center")}>
        <div className={clsx("flex items-center gap-3", centered && "justify-center")}>
          {/* Icon circle */}
          {cs.categoryBarShowIcons && cs.sectionShowIcon && (
            <div
              className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-lg md:text-xl shrink-0"
              style={{ backgroundColor: cs.sectionDividerColor + "1A" }}
            >
              {icon}
            </div>
          )}
          {/* Title + count */}
          <div className={centered && !(cs.categoryBarShowIcons && cs.sectionShowIcon) ? "w-full" : "flex-1"}>
            <h3
              className="text-lg md:text-xl font-extrabold tracking-tight"
              style={{ color: cs.sectionTitleColor }}
            >
              {title}
            </h3>
            <p
              className="text-[11px] md:text-xs font-medium mt-0.5"
              style={{ color: cs.sectionSubtitleColor }}
            >
              {products.length} item{products.length !== 1 ? "s" : ""} {t(pageContent, "itemsAvailableText")}
            </p>
          </div>
          {/* Decorative dot pattern */}
          {!centered && (
            <div className="flex gap-0.5">
              <div className="w-1 h-1 rounded-full" style={{ backgroundColor: cs.sectionDividerColor, opacity: 0.4 }} />
              <div className="w-1 h-1 rounded-full" style={{ backgroundColor: cs.sectionDividerColor, opacity: 0.25 }} />
              <div className="w-1 h-1 rounded-full" style={{ backgroundColor: cs.sectionDividerColor, opacity: 0.15 }} />
            </div>
          )}
        </div>
        {/* Gradient divider */}
        {cs.sectionShowDivider && (
          <div
            className="mt-3 h-px"
            style={{
              background: `linear-gradient(to right, ${cs.sectionDividerColor}4D, ${cs.sectionDividerColor}1A, transparent)`,
            }}
          />
        )}
      </div>

      {/* ── Items list ─────────────────────────── */}
      <div className="px-4 md:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4 lg:gap-5">
        {products.map((product, i) => (
          <MenuItemCard
            key={product.id}
            product={product}
            index={startIndex + i}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ─── Main Menu List ──────────────────────────────────────

interface MenuListProps {
  products: Product[];
  grouped?: boolean;
  categoryName?: string;
}

export default function MenuList({
  products,
  grouped = false,
  categoryName,
}: MenuListProps) {
  const { categoryConfig, categoryIcons, pageContent, componentStyles: cs } = useCmsData();
  const CATEGORY_ORDER = categoryConfig
    .filter((c) => c.id !== "all" && c.id !== "popular")
    .map((c) => c.label);
  const { t } = useTranslation();
  const centered = cs.sectionTitleAlign === "center";

  if (products.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="px-4 py-16 text-center"
      >
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-bg flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl md:text-3xl">😕</span>
        </div>
        <p className="text-muted text-sm md:text-base font-medium">{t(pageContent, "noItemsFoundText")}</p>
        <p className="text-muted/60 text-xs md:text-sm mt-1">{t(pageContent, "noItemsFoundHint")}</p>
      </motion.div>
    );
  }

  // Grouped view: all categories with section headers
  if (grouped) {
    let runningIndex = 0;

    return (
      <div className="pt-2">
        {CATEGORY_ORDER.map((cat) => {
          const catProducts = products
            .filter((p) => p.category === cat)
            .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
          if (catProducts.length === 0) return null;
          const section = (
            <MenuSection
              key={cat}
              title={cat}
              products={catProducts}
              startIndex={runningIndex}
            />
          );
          runningIndex += catProducts.length;
          return section;
        })}
      </div>
    );
  }

  // Single category / filtered view
  return (
    <div className="mb-6 pt-2">
      {categoryName && cs.sectionShowHeaders && (
        <div className={clsx("px-4 md:px-6 lg:px-8 mb-4", centered && "text-center")}>
          <div className={clsx("flex items-center gap-3", centered && "justify-center")}>
            {cs.categoryBarShowIcons && cs.sectionShowIcon && (
              <div
                className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-lg md:text-xl shrink-0"
                style={{ backgroundColor: cs.sectionDividerColor + "1A" }}
              >
                {categoryIcons[categoryName] || "🔍"}
              </div>
            )}
            <div className={centered && !(cs.categoryBarShowIcons && cs.sectionShowIcon) ? "w-full" : "flex-1"}>
              <h3
                className="text-lg md:text-xl font-extrabold tracking-tight"
                style={{ color: cs.sectionTitleColor }}
              >
                {categoryName}
              </h3>
              <p
                className="text-[11px] md:text-xs font-medium mt-0.5"
                style={{ color: cs.sectionSubtitleColor }}
              >
                {products.length} item{products.length !== 1 ? "s" : ""} {t(pageContent, "itemsFoundText")}
              </p>
            </div>
          </div>
          {cs.sectionShowDivider && (
            <div
              className="mt-3 h-px"
              style={{
                background: `linear-gradient(to right, ${cs.sectionDividerColor}4D, ${cs.sectionDividerColor}1A, transparent)`,
              }}
            />
          )}
        </div>
      )}
      <div className="px-4 md:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4 lg:gap-5">
        {[...products].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999)).map((product, i) => (
          <MenuItemCard key={product.id} product={product} index={i} />
        ))}
      </div>
    </div>
  );
}
