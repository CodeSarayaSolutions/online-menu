"use client";

import { useLanguageStore } from "@/store/languageStore";
import type { PageContent } from "@/types/cms";

/* ───── Structural types so the helpers work with both cms.ts AND product.ts types ───── */
type TranslatableProduct = { name: string; name_bs?: string; description: string; description_bs?: string };
type TranslatableCategory = { label: string; label_bs?: string };
type TranslatableRestaurant = { name: string; name_bs?: string; tagline: string; tagline_bs?: string; address: string; address_bs?: string; openHours: string; openHours_bs?: string };
type TranslatableAddon = { name: string; name_bs?: string };
type TranslatableVariation = { name: string; name_bs?: string };
type TranslatableVariationOption = { label: string; label_bs?: string };

/**
 * Hook that returns translation helpers based on the current language.
 *
 * Usage:
 *   const { t, tProduct, tCategory, tRestaurant, lang } = useTranslation();
 *   t(pageContent, "welcomeTitle")     → returns BS value if available & lang=bs, else EN
 *   tProduct(product, "name")          → returns product.name_bs or product.name
 *   tCategory(category)                → returns category.label_bs or category.label
 */
export function useTranslation() {
  const language = useLanguageStore((s) => s.language);

  /** Get a translated PageContent field */
  const t = (pc: PageContent, key: keyof PageContent): string => {
    if (language === "bs") {
      const bsKey = `${key}_bs` as keyof PageContent;
      const bsVal = pc[bsKey];
      if (bsVal && typeof bsVal === "string" && bsVal.trim() !== "") return bsVal;
    }
    const val = pc[key];
    return typeof val === "string" ? val : String(val ?? "");
  };

  /** Get a translated product field */
  const tProduct = (
    product: TranslatableProduct,
    field: "name" | "description"
  ): string => {
    if (language === "bs") {
      const bsVal = field === "name" ? product.name_bs : product.description_bs;
      if (bsVal && bsVal.trim() !== "") return bsVal;
    }
    return product[field];
  };

  /** Get a translated category label */
  const tCategory = (category: TranslatableCategory): string => {
    if (language === "bs" && category.label_bs && category.label_bs.trim() !== "") {
      return category.label_bs;
    }
    return category.label;
  };

  /** Get a translated restaurant field */
  const tRestaurant = (
    restaurant: TranslatableRestaurant,
    field: "name" | "tagline" | "address" | "openHours"
  ): string => {
    if (language === "bs") {
      const bsKey = `${field}_bs` as keyof TranslatableRestaurant;
      const bsVal = restaurant[bsKey];
      if (bsVal && typeof bsVal === "string" && bsVal.trim() !== "") return bsVal;
    }
    return restaurant[field];
  };

  /** Get a translated addon name */
  const tAddon = (addon: TranslatableAddon): string => {
    if (language === "bs" && addon.name_bs && addon.name_bs.trim() !== "") {
      return addon.name_bs;
    }
    return addon.name;
  };

  /** Get a translated variation name */
  const tVariation = (variation: TranslatableVariation): string => {
    if (language === "bs" && variation.name_bs && variation.name_bs.trim() !== "") {
      return variation.name_bs;
    }
    return variation.name;
  };

  /** Get a translated variation option label */
  const tVariationOption = (option: TranslatableVariationOption): string => {
    if (language === "bs" && option.label_bs && option.label_bs.trim() !== "") {
      return option.label_bs;
    }
    return option.label;
  };

  return {
    text: (bs:string,en:string) => language === "bs" ? bs : en,
    language,
    t,
    tProduct,
    tCategory,
    tRestaurant,
    tAddon,
    tVariation,
    tVariationOption,
  };
}
