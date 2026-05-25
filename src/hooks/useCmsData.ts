"use client";

import { useCmsStore } from "@/store/cmsStore";
import {
  defaultPageContent,
  defaultComponentStyles,
  defaultLayoutConfig,
} from "@/store/cmsStore";
import {
  restaurant as fallbackRestaurant,
  categoryConfig as fallbackCategories,
  products as fallbackProducts,
  categoryIcons as fallbackCategoryIcons,
} from "@/data/restaurants";
import { PageContent, ComponentStyles, LayoutConfig } from "@/types/cms";
import { useState, useEffect, useCallback } from "react";

/**
 * Hook that provides CMS data with SSR-safe hydration.
 *
 * On the server (and first client render) it returns the static
 * fallback data from `@/data/restaurants`. After hydration it
 * switches to the live CMS store (localStorage-backed).
 *
 * When loaded inside the admin preview iframe, the hook also
 * listens for `cms-preview-update` postMessages from the parent
 * and overrides the returned data with the preview payload.
 * This makes EVERY page that uses useCmsData() preview-aware.
 */
export function useCmsData() {
  const [hydrated, setHydrated] = useState(false);

  // ─── Preview overrides (from admin LivePreview iframe) ──
  const [previewOverrides, setPreviewOverrides] = useState<{
    pageContent?: PageContent;
    componentStyles?: ComponentStyles;
    layoutConfig?: LayoutConfig;
    products?: import("@/types/cms").ProductItem[];
    categories?: import("@/types/cms").CategoryInfo[];
    restaurant?: import("@/types/cms").RestaurantInfo;
  } | null>(null);

  const storeRestaurant = useCmsStore((s) => s.restaurant);
  const storeCategories = useCmsStore((s) => s.categories);
  const storeProducts = useCmsStore((s) => s.products);
  const storePageContent = useCmsStore((s) => s.pageContent);
  const storeComponentStyles = useCmsStore((s) => s.componentStyles);
  const storeLayoutConfig = useCmsStore((s) => s.layoutConfig);

  useEffect(() => {
    setHydrated(true);
  }, []);

  // ─── Preview iframe listener ────────────────────────────
  useEffect(() => {
    // Only activate when loaded inside an iframe (admin preview)
    if (typeof window === "undefined") return;
    let isInIframe = false;
    try {
      isInIframe = window.parent !== window;
    } catch {
      // cross-origin: not our preview iframe
      return;
    }
    if (!isInIframe) return;

    // Notify parent that the preview page is ready
    try {
      window.parent.postMessage({ type: "cms-preview-ready" }, "*");
    } catch {
      /* ignore */
    }

    const handler = (event: MessageEvent) => {
      if (event.data?.type === "cms-preview-update") {
        setPreviewOverrides(event.data.payload);
        // Re-signal readiness after receiving update
        try {
          window.parent.postMessage({ type: "cms-preview-ready" }, "*");
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // ─── Merge store data with defaults ─────────────────────
  const restaurant = previewOverrides?.restaurant || (hydrated ? storeRestaurant : fallbackRestaurant);
  const categoryConfig = previewOverrides?.categories || (hydrated ? storeCategories : fallbackCategories);
  const products = previewOverrides?.products || (hydrated ? storeProducts : fallbackProducts);

  const storePageContentMerged = hydrated
    ? { ...defaultPageContent, ...storePageContent }
    : defaultPageContent;
  const storeComponentStylesMerged = hydrated
    ? { ...defaultComponentStyles, ...storeComponentStyles }
    : defaultComponentStyles;
  const storeLayoutConfigMerged = hydrated
    ? { ...defaultLayoutConfig, ...storeLayoutConfig }
    : defaultLayoutConfig;

  // ─── Preview overrides take priority ────────────────────
  const pageContent = previewOverrides?.pageContent || storePageContentMerged;
  const componentStyles =
    previewOverrides?.componentStyles || storeComponentStylesMerged;
  const layoutConfig =
    previewOverrides?.layoutConfig || storeLayoutConfigMerged;

  // Build dynamic categoryIcons map from CMS categories (use resolved categoryConfig which includes preview overrides)
  const categoryIcons: Record<string, string> = (hydrated || previewOverrides?.categories)
    ? Object.fromEntries(
        categoryConfig
          .filter((c) => c.id !== "all" && c.id !== "popular")
          .map((c) => [c.label, c.icon ?? ""])
      )
    : fallbackCategoryIcons;

  return {
    restaurant,
    categoryConfig,
    products,
    categoryIcons,
    pageContent,
    componentStyles,
    layoutConfig,
  };
}
