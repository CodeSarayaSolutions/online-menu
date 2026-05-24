"use client";

import { useState, useEffect, useRef } from "react";
import {
  Save,
  RotateCcw,
  Type,
  ShoppingCart,
  CreditCard,
  FileText,
  UtensilsCrossed,
  List,
  ChevronRight,
  Check,
  Coins,
  Palette,
  Layout,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Square,
  Circle,
  RectangleHorizontal,
  Grip,
  Rows,
  Columns,
  Layers,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Sparkles,
  Monitor,
  TypeIcon,
  Zap,
  Grid3X3,
  Smartphone,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useCmsStore,
  defaultPageContent,
  defaultComponentStyles,
  defaultLayoutConfig,
  THEME_PRESETS,
} from "@/store/cmsStore";
import type { ThemeCustomization } from "@/store/cmsStore";
import { PageContent, ComponentStyles, LayoutConfig, MenuSectionItem } from "@/types/cms";
import clsx from "clsx";
import LivePreview from "@/components/admin/LivePreview";

// ═══════════════════════════════════════════════════════════
// TEXT CONTENT CONFIG
// ═══════════════════════════════════════════════════════════

interface SectionConfig {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  fields: FieldConfig[];
}

interface FieldConfig {
  key: keyof PageContent;
  label: string;
  type: "text" | "textarea" | "number";
  placeholder?: string;
  hint?: string;
}

const SECTIONS: SectionConfig[] = [
  {
    id: "menu",
    title: "Menu Page",
    description: "Welcome message, search bar, and info bar settings",
    icon: UtensilsCrossed,
    fields: [
      { key: "welcomeTitle", label: "Welcome Title", type: "text", hint: "Shown in the info card below the hero" },
      { key: "welcomeDescription", label: "Welcome Description", type: "textarea", hint: "Subtitle text below the welcome title" },
      { key: "dineInLabel", label: "Dine-in Label", type: "text", hint: "Info pill label (e.g. 'Dine-in', 'Takeaway')" },
      { key: "searchPlaceholder", label: "Search Placeholder", type: "text", hint: "Placeholder text in the search bar" },
      { key: "currencySymbol", label: "Currency Symbol", type: "text", hint: "Currency prefix for all prices (e.g. KM, €, £)" },
    ],
  },
  {
    id: "badges",
    title: "Badges & Labels",
    description: "Popular badge, customizable badge text used across cards",
    icon: Type,
    fields: [
      { key: "popularBadgeText", label: "Popular Badge Text", type: "text", hint: "Badge shown on popular items (e.g. '🔥 Popular')" },
      { key: "customizableBadgeText", label: "Customizable Badge", type: "text", hint: "Badge for items with add-ons" },
    ],
  },
  {
    id: "orderbar",
    title: "Order Bar",
    description: "Floating order bar at bottom of menu page",
    icon: ShoppingCart,
    fields: [
      { key: "orderBarViewText", label: "View Order Text", type: "text", hint: "Primary button label" },
      { key: "orderBarItemAddedText", label: "Items Added Text", type: "text", hint: "Shown as '{count} {this text}'" },
    ],
  },
  {
    id: "cart",
    title: "Cart Page",
    description: "Cart title, empty state, order summary labels",
    icon: ShoppingCart,
    fields: [
      { key: "cartTitle", label: "Cart Title", type: "text" },
      { key: "emptyCartTitle", label: "Empty Cart Title", type: "text" },
      { key: "emptyCartDescription", label: "Empty Cart Description", type: "textarea" },
      { key: "browseMenuText", label: "Browse Menu Button", type: "text" },
      { key: "addMoreItemsText", label: "Add More Items Text", type: "text" },
      { key: "orderSummaryTitle", label: "Order Summary Title", type: "text" },
      { key: "dineInServiceNote", label: "Dine-in Service Note", type: "text", hint: "e.g. 'Dine-in — no service charge'" },
      { key: "placeOrderText", label: "Place Order Button", type: "text" },
      { key: "clearButtonText", label: "Clear Button Text", type: "text" },
    ],
  },
  {
    id: "checkout",
    title: "Checkout Page",
    description: "Table selection, kitchen note, confirm button",
    icon: CreditCard,
    fields: [
      { key: "confirmOrderTitle", label: "Confirm Title", type: "text" },
      { key: "confirmOrderSubtitle", label: "Confirm Subtitle", type: "text" },
      { key: "tableCount", label: "Number of Tables", type: "number", hint: "How many table buttons to show" },
      { key: "yourTableTitle", label: "Table Section Title", type: "text" },
      { key: "yourTableDescription", label: "Table Section Description", type: "text" },
      { key: "kitchenNoteTitle", label: "Kitchen Note Title", type: "text" },
      { key: "kitchenNoteDescription", label: "Kitchen Note Description", type: "text" },
      { key: "kitchenNotePlaceholder", label: "Kitchen Note Placeholder", type: "text" },
      { key: "dineInBadgeTitle", label: "Dine-in Badge Title", type: "text" },
      { key: "dineInBadgeSubtext", label: "Dine-in Badge Subtext", type: "text" },
      { key: "sendToKitchenText", label: "Send to Kitchen Button", type: "text" },
      { key: "selectTableText", label: "Select Table Prompt", type: "text" },
    ],
  },
  {
    id: "confirmed",
    title: "Order Confirmed",
    description: "Success screen shown after placing an order",
    icon: Check,
    fields: [
      { key: "orderSentTitle", label: "Order Sent Title", type: "text" },
      { key: "orderReceivedText", label: "Order Received Label", type: "text" },
      { key: "orderReceivedDesc", label: "Order Received Description", type: "text" },
      { key: "preparingFoodText", label: "Preparing Food Label", type: "text" },
      { key: "preparingFoodDesc", label: "Preparing Food Description", type: "text" },
      { key: "comingToTableText", label: "Coming to Table Label", type: "text" },
      { key: "estimatedWaitText", label: "Estimated Wait Text", type: "text", hint: "e.g. 'Estimated wait: 10-15 minutes'" },
      { key: "backToMenuText", label: "Back to Menu Button", type: "text" },
      { key: "orderMoreNote", label: "Order More Note", type: "textarea" },
    ],
  },
  {
    id: "product",
    title: "Product Page",
    description: "Product detail page labels, buttons, and badges",
    icon: FileText,
    fields: [
      { key: "itemNotFoundText", label: "Item Not Found Text", type: "text" },
      { key: "popularChoiceText", label: "Popular Choice Badge", type: "text" },
      { key: "basePriceLabel", label: "Base Price Label", type: "text" },
      { key: "customizeSectionTitle", label: "Customize Section Title", type: "text" },
      { key: "optionalLabel", label: "Optional Label", type: "text" },
      { key: "quantityLabel", label: "Quantity Label", type: "text" },
      { key: "quantityDescription", label: "Quantity Description", type: "text" },
      { key: "addToOrderText", label: "Add to Order Button", type: "text" },
      { key: "addedToOrderText", label: "Added Confirmation", type: "text" },
      { key: "moreCategoryPrefix", label: "Related Items Prefix", type: "text", hint: "e.g. 'More in' → 'More in Pizza 🍕'" },
    ],
  },
  {
    id: "menulist",
    title: "Menu List",
    description: "Category sections and empty state messages",
    icon: List,
    fields: [
      { key: "noItemsFoundText", label: "No Items Found Text", type: "text" },
      { key: "noItemsFoundHint", label: "No Items Hint", type: "text" },
      { key: "itemsAvailableText", label: "Items Available Suffix", type: "text", hint: "e.g. '{n} items available'" },
      { key: "itemsFoundText", label: "Items Found Suffix", type: "text", hint: "e.g. '{n} items found'" },
    ],
  },
];

// ═══════════════════════════════════════════════════════════
// COLOR PALETTES
// ═══════════════════════════════════════════════════════════

const BG_COLORS = [
  { label: "White", value: "#FFFFFF" },
  { label: "Off-white", value: "#F7F7F7" },
  { label: "Warm Cream", value: "#FFF9E6" },
  { label: "Amber Light", value: "#FEF3C7" },
  { label: "Green Tint", value: "#F0FDF4" },
  { label: "Blue Tint", value: "#EFF6FF" },
  { label: "Pink Tint", value: "#FDF2F8" },
  { label: "Lavender", value: "#F5F3FF" },
  { label: "Orange Tint", value: "#FFF7ED" },
  { label: "Slate Light", value: "#F1F5F9" },
  { label: "Dark", value: "#1E1E1E" },
  { label: "Charcoal", value: "#111827" },
];

const TEXT_COLORS = [
  { label: "Dark", value: "#1E1E1E" },
  { label: "Charcoal", value: "#374151" },
  { label: "Gray", value: "#4B5563" },
  { label: "Muted", value: "#777777" },
  { label: "Light", value: "#9CA3AF" },
  { label: "White", value: "#FFFFFF" },
  { label: "Gold", value: "#F4B400" },
  { label: "Amber", value: "#D97706" },
  { label: "Red", value: "#DC2626" },
  { label: "Green", value: "#16A34A" },
  { label: "Blue", value: "#2563EB" },
  { label: "Purple", value: "#7C3AED" },
];

const ACCENT_COLORS = [
  { label: "Gold", value: "#F4B400" },
  { label: "Amber", value: "#F59E0B" },
  { label: "Orange", value: "#F97316" },
  { label: "Rose", value: "#F43F5E" },
  { label: "Blue", value: "#3B82F6" },
  { label: "Emerald", value: "#10B981" },
  { label: "Purple", value: "#8B5CF6" },
  { label: "Pink", value: "#EC4899" },
  { label: "Teal", value: "#14B8A6" },
  { label: "Indigo", value: "#6366F1" },
];

// ═══════════════════════════════════════════════════════════
// REUSABLE CONTROLS
// ═══════════════════════════════════════════════════════════

function ColorPicker({
  value,
  onChange,
  palette,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  palette: typeof BG_COLORS;
  label: string;
}) {
  const [showCustom, setShowCustom] = useState(false);
  const isCustom = !palette.some((c) => c.value.toUpperCase() === value.toUpperCase());

  return (
    <div>
      <label className="block text-xs font-semibold text-dark adm-text mb-2">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {palette.map((c) => (
          <button
            key={c.value}
            type="button"
            title={c.label}
            onClick={() => { onChange(c.value); setShowCustom(false); }}
            className={clsx(
              "w-8 h-8 rounded-xl border-2 transition-all hover:scale-110",
              value.toUpperCase() === c.value.toUpperCase()
                ? "border-primary ring-2 ring-primary/30 scale-110"
                : "border adm-border"
            )}
            style={{ backgroundColor: c.value }}
          />
        ))}
        <button
          type="button"
          onClick={() => setShowCustom(!showCustom)}
          className={clsx(
            "w-8 h-8 rounded-xl border-2 border-dashed flex items-center justify-center text-xs font-bold transition-all",
            isCustom || showCustom ? "border-primary text-primary" : "border-gray-300 text-muted adm-text-muted"
          )}
        >
          #
        </button>
      </div>
      <AnimatePresence>
        {(showCustom || isCustom) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 mt-2">
              <input
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-8 h-8 rounded-lg cursor-pointer border-0"
              />
              <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="flex-1 px-3 py-1.5 adm-bg border border-primary/10 rounded-xl text-xs text-dark adm-text font-mono outline-none focus:border-primary"
                placeholder="#FFFFFF"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function OptionSelector<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  label: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-dark adm-text mb-2">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={clsx(
              "px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border",
              value === opt.value
                ? "bg-primary/10 border-primary text-primary"
                : "adm-bg border-transparent text-dark adm-text hover:bg-[var(--adm-surface-2)]"
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToggleSwitch({
  value,
  onChange,
  label,
  hint,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-xs font-semibold text-dark adm-text">{label}</span>
        {hint && <p className="text-[10px] text-muted adm-text-muted mt-0.5">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={clsx(
          "w-11 h-6 rounded-full transition-all relative",
          value ? "bg-primary" : "bg-gray-300"
        )}
      >
        <motion.div
          animate={{ x: value ? 20 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="absolute top-1 w-4 h-4 adm-surface adm-border border rounded-full shadow-sm"
        />
      </button>
    </div>
  );
}

function CardLayoutPreview({ layout, imagePos, active }: { layout: string; imagePos: string; active: boolean }) {
  if (layout === "vertical") {
    return (
      <div className={clsx("w-16 h-20 rounded-lg border-2 overflow-hidden flex flex-col", active ? "border-primary" : "border adm-border")}>
        <div className="h-8 bg-primary/20" />
        <div className="flex-1 p-1 space-y-0.5">
          <div className="h-1 w-8 bg-gray-400 rounded" />
          <div className="h-1 w-6 bg-gray-300 rounded" />
          <div className="h-1 w-4 bg-primary/50 rounded mt-1" />
        </div>
      </div>
    );
  }
  const imgFirst = imagePos === "left";
  return (
    <div className={clsx("w-20 h-14 rounded-lg border-2 overflow-hidden flex", active ? "border-primary" : "border adm-border", !imgFirst && "flex-row-reverse")}>
      <div className="w-8 bg-primary/20 shrink-0" />
      <div className="flex-1 p-1 space-y-0.5 flex flex-col justify-center">
        <div className="h-1 w-full bg-gray-400 rounded" />
        <div className="h-1 w-3/4 bg-gray-300 rounded" />
        <div className="h-1 w-1/2 bg-primary/50 rounded" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DESIGN SECTIONS
// ═══════════════════════════════════════════════════════════

interface DesignSectionConfig {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
}

const DESIGN_SECTIONS: DesignSectionConfig[] = [
  { id: "general", title: "General Settings", description: "Page backgrounds, button style", icon: Palette },
  { id: "hero", title: "Hero Banner", description: "Height, text alignment, and overlay darkness", icon: ImageIcon },
  { id: "infobar", title: "Info Bar", description: "Welcome card background and text colors", icon: Layout },
  { id: "cards", title: "Menu Item Cards", description: "Card layout, image position, colors, and shadow", icon: Grip },
  { id: "sections", title: "Section Headers", description: "Category header alignment, colors, and decorations", icon: AlignLeft },
  { id: "catbar", title: "Category Bar", description: "Category scroll bar background and behavior", icon: Rows },
  { id: "orderbar", title: "Order Bar", description: "Floating order bar style and colors", icon: RectangleHorizontal },
  { id: "productpage", title: "Product Detail", description: "Product page card colors and image layout", icon: FileText },
  { id: "cartpage", title: "Cart Page", description: "Cart page background and card colors", icon: ShoppingCart },
  { id: "checkoutpage", title: "Checkout Page", description: "Checkout background and card colors", icon: CreditCard },
];

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export default function PageContentEditor() {
  const storeContent = useCmsStore((s) => s.pageContent);
  const storeStyles = useCmsStore((s) => s.componentStyles);
  const storeLayout = useCmsStore((s) => s.layoutConfig);
  const storeThemeCustomizations = useCmsStore((s) => s.themeCustomizations);
  const updatePageContent = useCmsStore((s) => s.updatePageContent);
  const updateComponentStyles = useCmsStore((s) => s.updateComponentStyles);
  const updateLayoutConfig = useCmsStore((s) => s.updateLayoutConfig);
  const updateThemeCustomizations = useCmsStore((s) => s.updateThemeCustomizations);

  // Per-theme customization tracking (local mirror of store themeCustomizations)
  const themeCustomsRef = useRef<Record<string, ThemeCustomization>>({});

  const [activeTab, setActiveTab] = useState<"content" | "design" | "themes">("content");
  const [form, setForm] = useState<PageContent>({ ...defaultPageContent });
  const [styles, setStyles] = useState<ComponentStyles>({ ...defaultComponentStyles });
  const [layout, setLayout] = useState<LayoutConfig>({ ...defaultLayoutConfig });
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["menu"]));
  const [expandedDesign, setExpandedDesign] = useState<Set<string>>(new Set(["general"]));
  const [saved, setSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  // Sync per-theme customizations from store on load
  useEffect(() => {
    if (storeThemeCustomizations) {
      themeCustomsRef.current = { ...storeThemeCustomizations };
    }
  }, [storeThemeCustomizations]);

  useEffect(() => {
    if (storeContent) setForm({ ...defaultPageContent, ...storeContent });
  }, [storeContent]);

  useEffect(() => {
    if (storeStyles) setStyles({ ...defaultComponentStyles, ...storeStyles });
  }, [storeStyles]);

  useEffect(() => {
    if (storeLayout) setLayout({ ...defaultLayoutConfig, ...storeLayout });
  }, [storeLayout]);

  useEffect(() => {
    if (!storeContent || !storeStyles || !storeLayout) return;
    const contentChanged = (Object.keys(defaultPageContent) as (keyof PageContent)[]).some(
      (k) => String(form[k]) !== String(storeContent[k])
    );
    const storedStyles = { ...defaultComponentStyles, ...storeStyles };
    const stylesChanged = (Object.keys(defaultComponentStyles) as (keyof ComponentStyles)[]).some(
      (k) => String(styles[k]) !== String(storedStyles[k])
    );
    const storedLayout = { ...defaultLayoutConfig, ...storeLayout };
    const layoutChanged = JSON.stringify(layout) !== JSON.stringify(storedLayout);
    setHasChanges(contentChanged || stylesChanged || layoutChanged);
  }, [form, styles, layout, storeContent, storeStyles, storeLayout]);

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleDesign = (id: string) => {
    setExpandedDesign((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleChange = (key: keyof PageContent, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleStyleChange = <K extends keyof ComponentStyles>(key: K, value: ComponentStyles[K]) => {
    setStyles((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    // Save current state into per-theme customizations for the active theme
    const activeThemeId = layout.activeTheme;
    themeCustomsRef.current = {
      ...themeCustomsRef.current,
      [activeThemeId]: {
        componentStyles: { ...styles },
        layoutConfig: { ...layout },
        pageContent: { ...form },
      },
    };

    updatePageContent(form);
    updateComponentStyles(styles);
    updateLayoutConfig(layout);
    updateThemeCustomizations(themeCustomsRef.current);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleResetSection = (section: SectionConfig) => {
    const updates: Partial<PageContent> = {};
    section.fields.forEach((f) => { (updates as Record<string, unknown>)[f.key] = defaultPageContent[f.key]; });
    setForm((prev) => ({ ...prev, ...updates }));
  };

  const handleResetAll = () => {
    if (activeTab === "content") {
      setForm({ ...defaultPageContent });
    } else if (activeTab === "design") {
      setStyles({ ...defaultComponentStyles });
    } else {
      setLayout({ ...defaultLayoutConfig });
    }
  };

  // ─── Design section renderer ───────────────────────────
  const renderDesignFields = (sectionId: string) => {
    switch (sectionId) {
      case "general":
        return (
          <div className="space-y-5">
            <ToggleSwitch label="View-Only Mode" value={styles.viewOnlyMode} onChange={(v) => handleStyleChange("viewOnlyMode", v)} hint="Hide all ordering features (&quot;Add to Cart&quot; buttons, cart, checkout). Customers can only browse the menu." />
            <ColorPicker label="Menu Page Background" value={styles.menuPageBgColor} onChange={(v) => handleStyleChange("menuPageBgColor", v)} palette={BG_COLORS} />
            <ColorPicker label="Cart Page Background" value={styles.cartPageBgColor} onChange={(v) => handleStyleChange("cartPageBgColor", v)} palette={BG_COLORS} />
            <ColorPicker label="Checkout Page Background" value={styles.checkoutPageBgColor} onChange={(v) => handleStyleChange("checkoutPageBgColor", v)} palette={BG_COLORS} />
            <OptionSelector label="Button Corner Style" value={styles.buttonStyle} onChange={(v) => handleStyleChange("buttonStyle", v)} options={[
              { value: "rounded", label: "Rounded", icon: <Square size={12} /> },
              { value: "pill", label: "Pill", icon: <Circle size={12} /> },
              { value: "square", label: "Sharp", icon: <RectangleHorizontal size={12} /> },
            ]} />
          </div>
        );

      case "hero":
        return (
          <div className="space-y-5">
            <OptionSelector label="Banner Height" value={styles.heroHeight} onChange={(v) => handleStyleChange("heroHeight", v)} options={[
              { value: "compact", label: "Compact" },
              { value: "normal", label: "Normal" },
              { value: "tall", label: "Tall" },
            ]} />
            <OptionSelector label="Text Alignment" value={styles.heroTextAlign} onChange={(v) => handleStyleChange("heroTextAlign", v)} options={[
              { value: "left", label: "Left", icon: <AlignLeft size={12} /> },
              { value: "center", label: "Center", icon: <AlignCenter size={12} /> },
              { value: "right", label: "Right", icon: <AlignRight size={12} /> },
            ]} />
            <OptionSelector label="Overlay Darkness" value={styles.heroOverlay} onChange={(v) => handleStyleChange("heroOverlay", v)} options={[
              { value: "light", label: "Light" },
              { value: "medium", label: "Medium" },
              { value: "dark", label: "Dark" },
            ]} />
            <OptionSelector label="Hero Media" value={styles.heroMediaType || 'image'} onChange={(v) => handleStyleChange("heroMediaType", v)} options={[
              { value: "image", label: "Image" },
              { value: "video", label: "Video" },
            ]} />
            {(!styles.heroMediaType || styles.heroMediaType === 'image') && (
              <div>
                <label className="block text-[12px] font-bold text-dark adm-text mb-1.5">Image URL</label>
                <input
                  type="text"
                  value={styles.heroImageUrl || ''}
                  onChange={(e) => handleStyleChange("heroImageUrl", e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3 py-2.5 rounded-xl border border adm-border text-[13px] text-dark adm-text placeholder:adm-text-faint focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition adm-bg"
                />
                <p className="text-[10px] text-muted adm-text-muted mt-1">Direct link to a hero banner image. Leave empty to use the image from Restaurant Info.</p>
              </div>
            )}
            {(styles.heroMediaType === 'video') && (
              <div>
                <label className="block text-[12px] font-bold text-dark adm-text mb-1.5">Video URL</label>
                <input
                  type="text"
                  value={styles.heroVideoUrl || ''}
                  onChange={(e) => handleStyleChange("heroVideoUrl", e.target.value)}
                  placeholder="https://example.com/video.mp4"
                  className="w-full px-3 py-2.5 rounded-xl border border adm-border text-[13px] text-dark adm-text placeholder:adm-text-faint focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition adm-bg"
                />
                <p className="text-[10px] text-muted adm-text-muted mt-1">Direct link to .mp4, .webm, or .ogg video file. The video will autoplay, loop, and be muted.</p>
              </div>
            )}
          </div>
        );

      case "infobar":
        return (
          <div className="space-y-5">
            <ToggleSwitch label="Show Info Bar" value={styles.infoBarVisible} onChange={(v) => handleStyleChange("infoBarVisible", v)} hint="Toggle the welcome card below the hero" />
            <ColorPicker label="Background Color" value={styles.infoBarBgColor} onChange={(v) => handleStyleChange("infoBarBgColor", v)} palette={BG_COLORS} />
            <ColorPicker label="Text Color" value={styles.infoBarTextColor} onChange={(v) => handleStyleChange("infoBarTextColor", v)} palette={TEXT_COLORS} />
          </div>
        );

      case "cards":
        return (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-dark adm-text mb-2">Card Layout</label>
              <div className="flex gap-3">
                {[
                  { layout: "horizontal" as const, imgPos: "left" as const, label: "Image Left" },
                  { layout: "horizontal" as const, imgPos: "right" as const, label: "Image Right" },
                  { layout: "vertical" as const, imgPos: "left" as const, label: "Vertical" },
                ].map((opt) => {
                  const isActive = styles.cardLayout === opt.layout && (opt.layout === "vertical" || styles.cardImagePosition === opt.imgPos);
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => {
                        handleStyleChange("cardLayout", opt.layout);
                        if (opt.layout === "horizontal") handleStyleChange("cardImagePosition", opt.imgPos);
                      }}
                      className={clsx("flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all", isActive ? "border-primary bg-primary/5" : "border adm-border hover:border-[var(--adm-border-strong)]")}
                    >
                      <CardLayoutPreview layout={opt.layout} imagePos={opt.imgPos} active={isActive} />
                      <span className={clsx("text-[10px] font-semibold", isActive ? "text-primary" : "text-muted adm-text-muted")}>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <ColorPicker label="Card Background" value={styles.cardBgColor} onChange={(v) => handleStyleChange("cardBgColor", v)} palette={BG_COLORS} />
            <ColorPicker label="Title Color" value={styles.cardTitleColor} onChange={(v) => handleStyleChange("cardTitleColor", v)} palette={TEXT_COLORS} />
            <ColorPicker label="Description Color" value={styles.cardDescriptionColor} onChange={(v) => handleStyleChange("cardDescriptionColor", v)} palette={TEXT_COLORS} />
            <ColorPicker label="Price Color" value={styles.cardPriceColor} onChange={(v) => handleStyleChange("cardPriceColor", v)} palette={ACCENT_COLORS} />
            <OptionSelector label="Corner Radius" value={styles.cardBorderRadius} onChange={(v) => handleStyleChange("cardBorderRadius", v)} options={[
              { value: "sm", label: "Small" },
              { value: "md", label: "Medium" },
              { value: "lg", label: "Large" },
              { value: "xl", label: "Extra Large" },
            ]} />
            <OptionSelector label="Shadow Depth" value={styles.cardShadow} onChange={(v) => handleStyleChange("cardShadow", v)} options={[
              { value: "none", label: "None" },
              { value: "sm", label: "Subtle" },
              { value: "md", label: "Medium" },
              { value: "lg", label: "Strong" },
            ]} />
          </div>
        );

      case "sections":
        return (
          <div className="space-y-5">
            <OptionSelector label="Title Alignment" value={styles.sectionTitleAlign} onChange={(v) => handleStyleChange("sectionTitleAlign", v)} options={[
              { value: "left", label: "Left", icon: <AlignLeft size={12} /> },
              { value: "center", label: "Center", icon: <AlignCenter size={12} /> },
            ]} />
            <ColorPicker label="Title Color" value={styles.sectionTitleColor} onChange={(v) => handleStyleChange("sectionTitleColor", v)} palette={TEXT_COLORS} />
            <ColorPicker label="Subtitle Color" value={styles.sectionSubtitleColor} onChange={(v) => handleStyleChange("sectionSubtitleColor", v)} palette={TEXT_COLORS} />
            <ColorPicker label="Divider Color" value={styles.sectionDividerColor} onChange={(v) => handleStyleChange("sectionDividerColor", v)} palette={ACCENT_COLORS} />
            <ToggleSwitch label="Show Category Icon" value={styles.sectionShowIcon} onChange={(v) => handleStyleChange("sectionShowIcon", v)} hint="Show emoji icon next to category section titles" />
            <ToggleSwitch label="Show Divider Line" value={styles.sectionShowDivider} onChange={(v) => handleStyleChange("sectionShowDivider", v)} />
            <ToggleSwitch label="Show Category Headers" value={styles.sectionShowHeaders} onChange={(v) => handleStyleChange("sectionShowHeaders", v)} hint="Toggle category section headers (title, subtitle, divider). When off, items display without category grouping labels." />
          </div>
        );

      case "catbar":
        return (
          <div className="space-y-5">
            <ColorPicker label="Background Color" value={styles.categoryBarBgColor} onChange={(v) => handleStyleChange("categoryBarBgColor", v)} palette={BG_COLORS} />
            <ToggleSwitch label="Sticky on Scroll" value={styles.categoryBarSticky} onChange={(v) => handleStyleChange("categoryBarSticky", v)} hint="Keep category bar visible when scrolling" />
            <ToggleSwitch label="Show Category Icons" value={styles.categoryBarShowIcons} onChange={(v) => handleStyleChange("categoryBarShowIcons", v)} hint="Display emoji icons for categories everywhere (bar, headers, product page)" />
          </div>
        );

      case "orderbar":
        return (
          <div className="space-y-5">
            <OptionSelector label="Bar Style" value={styles.orderBarStyle} onChange={(v) => handleStyleChange("orderBarStyle", v)} options={[
              { value: "gradient", label: "Gradient" },
              { value: "solid", label: "Solid Color" },
              { value: "glass", label: "Glass Effect" },
            ]} />
            <ColorPicker label="Background Color" value={styles.orderBarBgColor} onChange={(v) => handleStyleChange("orderBarBgColor", v)} palette={ACCENT_COLORS} />
            <ColorPicker label="Text Color" value={styles.orderBarTextColor} onChange={(v) => handleStyleChange("orderBarTextColor", v)} palette={TEXT_COLORS} />
          </div>
        );

      case "productpage":
        return (
          <div className="space-y-5">
            <OptionSelector label="Image Position (Desktop)" value={styles.productImagePosition} onChange={(v) => handleStyleChange("productImagePosition", v)} options={[
              { value: "left", label: "Left", icon: <Columns size={12} /> },
              { value: "right", label: "Right", icon: <Columns size={12} className="scale-x-[-1]" /> },
            ]} />
            <ColorPicker label="Info Card Background" value={styles.productCardBgColor} onChange={(v) => handleStyleChange("productCardBgColor", v)} palette={BG_COLORS} />
            <ColorPicker label="Title Color" value={styles.productTitleColor} onChange={(v) => handleStyleChange("productTitleColor", v)} palette={TEXT_COLORS} />
            <ColorPicker label="Description Color" value={styles.productDescriptionColor} onChange={(v) => handleStyleChange("productDescriptionColor", v)} palette={TEXT_COLORS} />
            <ColorPicker label="Price Color" value={styles.productPriceColor} onChange={(v) => handleStyleChange("productPriceColor", v)} palette={ACCENT_COLORS} />
          </div>
        );

      case "cartpage":
        return (
          <div className="space-y-5">
            <ColorPicker label="Page Background" value={styles.cartPageBgColor} onChange={(v) => handleStyleChange("cartPageBgColor", v)} palette={BG_COLORS} />
            <ColorPicker label="Card Background" value={styles.cartCardBgColor} onChange={(v) => handleStyleChange("cartCardBgColor", v)} palette={BG_COLORS} />
            <ColorPicker label="Title Color" value={styles.cartTitleColor} onChange={(v) => handleStyleChange("cartTitleColor", v)} palette={TEXT_COLORS} />
            <ColorPicker label="Accent Color" value={styles.cartAccentColor} onChange={(v) => handleStyleChange("cartAccentColor", v)} palette={ACCENT_COLORS} />
          </div>
        );

      case "checkoutpage":
        return (
          <div className="space-y-5">
            <ColorPicker label="Page Background" value={styles.checkoutPageBgColor} onChange={(v) => handleStyleChange("checkoutPageBgColor", v)} palette={BG_COLORS} />
            <ColorPicker label="Card Background" value={styles.checkoutCardBgColor} onChange={(v) => handleStyleChange("checkoutCardBgColor", v)} palette={BG_COLORS} />
            <ColorPicker label="Accent Color" value={styles.checkoutAccentColor} onChange={(v) => handleStyleChange("checkoutAccentColor", v)} palette={ACCENT_COLORS} />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex gap-0">
      {/* ── Editor Panel ── */}
      <div className={clsx(
        "flex-1 min-w-0 p-5 lg:p-8 transition-all duration-300",
        showPreview ? "lg:mr-0" : ""
      )}>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-dark adm-text">Page Content</h2>
          <p className="text-sm text-muted adm-text-muted mt-1">
            Edit text content and visual design for every frontend component.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Preview toggle button */}
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={clsx(
              "hidden lg:flex px-3 py-2 rounded-2xl border text-sm font-semibold transition items-center gap-2",
              showPreview
                ? "border-primary/20 bg-primary/5 text-primary"
                : "border-primary/10 text-dark adm-text hover:bg-[var(--adm-surface-2)]"
            )}
            title={showPreview ? "Hide Preview" : "Show Preview"}
          >
            {showPreview ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
            <span className="hidden 2xl:inline">{showPreview ? "Hide" : "Show"} Preview</span>
          </button>
          <button
            onClick={handleResetAll}
            className="px-4 py-2 rounded-2xl border border-primary/10 text-sm font-semibold text-dark adm-text hover:bg-[var(--adm-surface-2)] transition flex items-center gap-2"
          >
            <RotateCcw size={14} />
            Reset {activeTab === "content" ? "Text" : activeTab === "design" ? "Design" : "Layout"}
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges && !saved}
            className={clsx(
              "px-6 py-2.5 rounded-2xl text-sm font-bold transition-all flex items-center gap-2",
              saved
                ? "bg-accent-green text-white shadow-lg shadow-green-200"
                : hasChanges
                ? "bg-gradient-to-r from-primary to-amber-500 text-white shadow-glow hover:brightness-105"
                : "adm-bg text-muted adm-text-muted cursor-not-allowed"
            )}
          >
            {saved ? (<><Check size={15} />Saved!</>) : (<><Save size={15} />Save Changes</>)}
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 adm-bg rounded-2xl p-1">
        {[
          { id: "content" as const, label: "Text Content", icon: Type },
          { id: "design" as const, label: "Design & Layout", icon: Palette },
          { id: "themes" as const, label: "Sections & Themes", icon: Layers },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all",
              activeTab === tab.id
                ? "adm-surface adm-border border text-dark adm-text shadow-soft"
                : "text-muted adm-text-muted hover:adm-text"
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Change indicator */}
      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3 flex items-center gap-3"
          >
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm text-dark adm-text font-medium">You have unsaved changes</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════ */}
      {/* TEXT CONTENT TAB                       */}
      {/* ═══════════════════════════════════════ */}
      {activeTab === "content" && (
        <div className="space-y-3">
          {SECTIONS.map((section, sIdx) => {
            const isExpanded = expandedSections.has(section.id);
            const Icon = section.icon;
            return (
              <motion.div
                key={section.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: sIdx * 0.04, duration: 0.3 }}
                className="adm-surface adm-border border rounded-2xl shadow-soft overflow-hidden border border-primary/5"
              >
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center gap-4 p-5 hover:bg-[var(--adm-surface-2)]/50 transition text-left"
                >
                  <div className={clsx(
                    "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-all",
                    isExpanded ? "bg-gradient-to-br from-primary to-amber-500 text-white shadow-sm" : "adm-bg text-muted adm-text-muted"
                  )}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-extrabold text-dark adm-text">{section.title}</h3>
                    <p className="text-xs text-muted adm-text-muted mt-0.5">{section.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold adm-text-faint adm-bg px-2.5 py-0.5 rounded-full">
                      {section.fields.length} fields
                    </span>
                    <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronRight size={16} className={isExpanded ? "text-primary" : "adm-text-faint"} />
                    </motion.div>
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-bg">
                        <div className="p-5 space-y-4">
                          {section.fields.map((field, fIdx) => (
                            <motion.div
                              key={field.key}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: fIdx * 0.03, duration: 0.25 }}
                            >
                              <label className="block text-xs font-semibold text-dark adm-text mb-1.5">
                                {field.label}
                                {field.key === "currencySymbol" && (
                                  <Coins size={10} className="inline ml-1 text-primary/50" />
                                )}
                              </label>
                              {field.type === "textarea" ? (
                                <textarea
                                  value={String(form[field.key] ?? "")}
                                  onChange={(e) => handleChange(field.key, e.target.value)}
                                  rows={3}
                                  className="w-full px-4 py-3 adm-bg border border-primary/10 rounded-2xl text-sm text-dark adm-text outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:adm-surface adm-border border transition resize-none placeholder:adm-text-faint"
                                  placeholder={field.placeholder || String(defaultPageContent[field.key])}
                                />
                              ) : field.type === "number" ? (
                                <input
                                  type="number"
                                  value={form[field.key] as number}
                                  onChange={(e) => handleChange(field.key, parseInt(e.target.value) || 0)}
                                  min={1}
                                  max={100}
                                  className="w-full px-4 py-2.5 adm-bg border border-primary/10 rounded-2xl text-sm text-dark adm-text outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:adm-surface adm-border border transition placeholder:adm-text-faint"
                                />
                              ) : (
                                <input
                                  type="text"
                                  value={String(form[field.key] ?? "")}
                                  onChange={(e) => handleChange(field.key, e.target.value)}
                                  className="w-full px-4 py-2.5 adm-bg border border-primary/10 rounded-2xl text-sm text-dark adm-text outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:adm-surface adm-border border transition placeholder:adm-text-faint"
                                  placeholder={field.placeholder || String(defaultPageContent[field.key])}
                                />
                              )}
                              {field.hint && (
                                <p className="text-[11px] text-muted adm-text-muted mt-1 ml-1">{field.hint}</p>
                              )}
                            </motion.div>
                          ))}
                        </div>
                        <div className="px-5 py-3 adm-bg/50 border-t border-bg flex justify-end">
                          <button
                            onClick={() => handleResetSection(section)}
                            className="text-xs text-muted adm-text-muted hover:text-accent-red transition font-medium flex items-center gap-1"
                          >
                            <RotateCcw size={11} />
                            Reset this section
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* DESIGN & LAYOUT TAB                    */}
      {/* ═══════════════════════════════════════ */}
      {activeTab === "design" && (
        <div className="space-y-3">
          {DESIGN_SECTIONS.map((section, sIdx) => {
            const isExpanded = expandedDesign.has(section.id);
            const Icon = section.icon;
            return (
              <motion.div
                key={section.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: sIdx * 0.04, duration: 0.3 }}
                className="adm-surface adm-border border rounded-2xl shadow-soft overflow-hidden border border-primary/5"
              >
                <button
                  onClick={() => toggleDesign(section.id)}
                  className="w-full flex items-center gap-4 p-5 hover:bg-[var(--adm-surface-2)]/50 transition text-left"
                >
                  <div className={clsx(
                    "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-all",
                    isExpanded ? "bg-gradient-to-br from-primary to-amber-500 text-white shadow-sm" : "adm-bg text-muted adm-text-muted"
                  )}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-extrabold text-dark adm-text">{section.title}</h3>
                    <p className="text-xs text-muted adm-text-muted mt-0.5">{section.description}</p>
                  </div>
                  <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronRight size={16} className={isExpanded ? "text-primary" : "adm-text-faint"} />
                  </motion.div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-bg p-5">
                        {renderDesignFields(section.id)}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* SECTIONS & THEMES TAB                  */}
      {/* ═══════════════════════════════════════ */}
      {activeTab === "themes" && (
        <div className="space-y-6">

          {/* ─── Theme Presets ─────────────────── */}
          <div className="adm-surface adm-border border rounded-2xl shadow-soft border border-primary/5 overflow-hidden">
            <div className="p-5 border-b border-bg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center text-white shadow-sm">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="text-[15px] font-extrabold text-dark adm-text">Theme Presets</h3>
                  <p className="text-xs text-muted adm-text-muted mt-0.5">One-click complete visual redesign — colors, fonts, layout</p>
                </div>
              </div>
            </div>
            <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {THEME_PRESETS.map((theme) => {
                const isActive = layout.activeTheme === theme.id;
                return (
                  <motion.button
                    key={theme.id}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      if (theme.id === layout.activeTheme) return; // already active

                      // Save current local state for the current theme
                      const currentThemeId = layout.activeTheme;
                      themeCustomsRef.current = {
                        ...themeCustomsRef.current,
                        [currentThemeId]: {
                          componentStyles: { ...styles },
                          layoutConfig: { ...layout },
                          pageContent: { ...form },
                        },
                      };

                      // Check if we have saved customizations for the new theme
                      const saved = themeCustomsRef.current[theme.id];

                      if (saved) {
                        // Load previously saved customizations
                        setStyles({ ...defaultComponentStyles, ...saved.componentStyles });
                        setLayout({ ...defaultLayoutConfig, ...saved.layoutConfig, activeTheme: theme.id });
                        setForm({ ...defaultPageContent, ...saved.pageContent });
                      } else {
                        // No saved customizations — load from theme preset defaults
                        setLayout((prev) => ({
                          ...prev,
                          ...theme.layout,
                          activeTheme: theme.id,
                        }));
                        setStyles({ ...defaultComponentStyles, ...theme.styles });
                        if (theme.content) {
                          setForm({ ...defaultPageContent, ...theme.content });
                        }
                      }
                    }}
                    className={clsx(
                      "rounded-2xl border-2 p-3 text-left transition-all",
                      isActive
                        ? "border-primary shadow-glow ring-2 ring-primary/20"
                        : "border adm-border hover:border-[var(--adm-border-strong)] hover:shadow-sm"
                    )}
                  >
                    {/* Mini preview */}
                    <div className="flex gap-1.5 mb-3">
                      <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: theme.preview.bg, border: '1px solid #e5e7eb' }} />
                      <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: theme.preview.accent }} />
                      <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: theme.preview.card, border: '1px solid #e5e7eb' }} />
                      <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: theme.preview.text }} />
                    </div>
                    <p className={clsx("text-xs font-bold", isActive ? "text-primary" : "text-dark adm-text")}>{theme.name}</p>
                    <p className="text-[10px] text-muted adm-text-muted mt-0.5 line-clamp-2">{theme.description}</p>
                    {isActive && (
                      <div className="mt-2 flex items-center gap-1">
                        <Check size={10} className="text-primary" />
                        <span className="text-[10px] font-bold text-primary">Active</span>
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* ─── Section Order & Visibility ───── */}
          <div className="adm-surface adm-border border rounded-2xl shadow-soft border border-primary/5 overflow-hidden">
            <div className="p-5 border-b border-bg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center text-white shadow-sm">
                  <Layers size={18} />
                </div>
                <div>
                  <h3 className="text-[15px] font-extrabold text-dark adm-text">Section Order & Visibility</h3>
                  <p className="text-xs text-muted adm-text-muted mt-0.5">Drag sections to reorder, toggle visibility on/off</p>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-2">
              {layout.sections.map((sec, idx) => {
                const sectionLabels: Record<string, { label: string; desc: string }> = {
                  hero: { label: 'Hero Banner', desc: 'Main image banner at the top' },
                  infoBar: { label: 'Info Bar', desc: 'Welcome message and restaurant info' },
                  promoBanner: { label: 'Promo Banner', desc: 'Promotional announcement ribbon' },
                  searchBar: { label: 'Search Bar', desc: 'Menu item search input' },
                  categoryBar: { label: 'Category Bar', desc: 'Category filter tabs' },
                  featuredSection: { label: 'Featured Section', desc: "Chef's specials highlight" },
                  menuContent: { label: 'Menu Content', desc: 'Main menu items grid' },
                  socialProof: { label: 'Social Proof', desc: 'Reviews and ratings display' },
                  footer: { label: 'Footer', desc: 'Page footer with branding' },
                };
                const info = sectionLabels[sec.id] || { label: sec.id, desc: '' };

                return (
                  <motion.div
                    key={sec.id}
                    layout
                    className={clsx(
                      "flex items-center gap-3 p-3 rounded-xl border transition-all",
                      sec.visible
                        ? "border-primary/10 adm-surface adm-border border"
                        : "border adm-border adm-surface-2 opacity-60"
                    )}
                  >
                    {/* Reorder buttons */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          const secs = [...layout.sections];
                          if (idx > 0) { [secs[idx - 1], secs[idx]] = [secs[idx], secs[idx - 1]]; }
                          setLayout((prev) => ({ ...prev, sections: secs }));
                        }}
                        disabled={idx === 0}
                        className={clsx("p-1 rounded-lg transition", idx > 0 ? "hover:bg-primary/10 text-dark adm-text" : "adm-text-faint cursor-not-allowed")}
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const secs = [...layout.sections];
                          if (idx < secs.length - 1) { [secs[idx], secs[idx + 1]] = [secs[idx + 1], secs[idx]]; }
                          setLayout((prev) => ({ ...prev, sections: secs }));
                        }}
                        disabled={idx === layout.sections.length - 1}
                        className={clsx("p-1 rounded-lg transition", idx < layout.sections.length - 1 ? "hover:bg-primary/10 text-dark adm-text" : "adm-text-faint cursor-not-allowed")}
                      >
                        <ArrowDown size={12} />
                      </button>
                    </div>

                    {/* Section info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-dark adm-text">{info.label}</p>
                      <p className="text-[10px] text-muted adm-text-muted">{info.desc}</p>
                    </div>

                    {/* Order badge */}
                    <span className="text-[10px] font-bold adm-text-faint adm-bg px-2 py-0.5 rounded-full shrink-0">
                      #{idx + 1}
                    </span>

                    {/* Visibility toggle */}
                    <button
                      type="button"
                      onClick={() => {
                        const secs = layout.sections.map((s) =>
                          s.id === sec.id ? { ...s, visible: !s.visible } : s
                        );
                        setLayout((prev) => ({ ...prev, sections: secs }));
                      }}
                      className={clsx(
                        "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                        sec.visible
                          ? "bg-primary/10 text-primary hover:bg-primary/20"
                          : "adm-surface-2 text-muted adm-text-muted hover:bg-[var(--adm-surface-2)]"
                      )}
                    >
                      {sec.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* ─── Section Variants ─────────────── */}
          <div className="adm-surface adm-border border rounded-2xl shadow-soft border border-primary/5 overflow-hidden">
            <div className="p-5 border-b border-bg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center text-white shadow-sm">
                  <Grid3X3 size={18} />
                </div>
                <div>
                  <h3 className="text-[15px] font-extrabold text-dark adm-text">Section Variants</h3>
                  <p className="text-xs text-muted adm-text-muted mt-0.5">Choose a visual style for each section</p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-5">
              <OptionSelector label="Hero Style" value={layout.heroVariant} onChange={(v) => setLayout((p) => ({ ...p, heroVariant: v }))} options={[
                { value: "classic", label: "Classic" },
                { value: "minimal", label: "Minimal" },
                { value: "centered", label: "Centered" },
                { value: "split", label: "Split" },
                { value: "overlay-full", label: "Full Overlay" },
              ]} />
              <OptionSelector label="Info Bar Style" value={layout.infoBarVariant} onChange={(v) => setLayout((p) => ({ ...p, infoBarVariant: v }))} options={[
                { value: "card", label: "Card" },
                { value: "inline", label: "Inline" },
                { value: "floating", label: "Floating" },
                { value: "banner", label: "Banner" },
              ]} />
              <OptionSelector label="Search Bar Style" value={layout.searchBarVariant} onChange={(v) => setLayout((p) => ({ ...p, searchBarVariant: v }))} options={[
                { value: "default", label: "Default" },
                { value: "minimal", label: "Minimal" },
                { value: "pill", label: "Pill" },
                { value: "hidden", label: "Hidden" },
              ]} />
              <OptionSelector label="Category Bar Style" value={layout.categoryBarVariant} onChange={(v) => setLayout((p) => ({ ...p, categoryBarVariant: v }))} options={[
                { value: "scroll", label: "Scroll" },
                { value: "pills", label: "Pills" },
                { value: "underline", label: "Underline" },
                { value: "grid", label: "Grid" },
                { value: "minimal", label: "Minimal" },
              ]} />
              <OptionSelector label="Menu Content Style" value={layout.menuContentVariant} onChange={(v) => setLayout((p) => ({ ...p, menuContentVariant: v }))} options={[
                { value: "sections", label: "Sections" },
                { value: "grid", label: "Grid" },
                { value: "list", label: "List" },
                { value: "magazine", label: "Magazine" },
                { value: "compact", label: "Compact" },
              ]} />
              <OptionSelector label="Order Bar Style" value={layout.orderBarVariant} onChange={(v) => setLayout((p) => ({ ...p, orderBarVariant: v }))} options={[
                { value: "floating", label: "Floating" },
                { value: "sticky-bottom", label: "Sticky Bottom" },
                { value: "fab", label: "FAB Button" },
                { value: "minimal", label: "Minimal" },
              ]} />
              <OptionSelector label="Promo Banner Style" value={layout.promoBannerVariant} onChange={(v) => setLayout((p) => ({ ...p, promoBannerVariant: v }))} options={[
                { value: "ribbon", label: "Ribbon" },
                { value: "card", label: "Card" },
                { value: "floating", label: "Floating" },
                { value: "marquee", label: "Marquee" },
              ]} />
              <OptionSelector label="Featured Section Style" value={layout.featuredVariant} onChange={(v) => setLayout((p) => ({ ...p, featuredVariant: v }))} options={[
                { value: "carousel", label: "Carousel" },
                { value: "highlight", label: "Highlight" },
                { value: "banner", label: "Banner" },
              ]} />
              <OptionSelector label="Social Proof Style" value={layout.socialProofVariant} onChange={(v) => setLayout((p) => ({ ...p, socialProofVariant: v }))} options={[
                { value: "stars", label: "Stars" },
                { value: "testimonial", label: "Testimonial" },
                { value: "counter", label: "Counter" },
              ]} />
              <OptionSelector label="Footer Style" value={layout.footerVariant} onChange={(v) => setLayout((p) => ({ ...p, footerVariant: v }))} options={[
                { value: "simple", label: "Simple" },
                { value: "detailed", label: "Detailed" },
                { value: "minimal", label: "Minimal" },
                { value: "branded", label: "Branded" },
              ]} />
            </div>
          </div>

          {/* ─── Page Layout & Typography ─────── */}
          <div className="adm-surface adm-border border rounded-2xl shadow-soft border border-primary/5 overflow-hidden">
            <div className="p-5 border-b border-bg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center text-white shadow-sm">
                  <Monitor size={18} />
                </div>
                <div>
                  <h3 className="text-[15px] font-extrabold text-dark adm-text">Page Layout & Typography</h3>
                  <p className="text-xs text-muted adm-text-muted mt-0.5">Overall page structure, fonts, and sizing</p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-5">
              <OptionSelector label="Page Layout" value={layout.pageLayout} onChange={(v) => setLayout((p) => ({ ...p, pageLayout: v }))} options={[
                { value: "standard", label: "Standard" },
                { value: "sidebar", label: "Sidebar" },
                { value: "magazine", label: "Magazine" },
                { value: "compact", label: "Compact" },
                { value: "fullWidth", label: "Full Width" },
              ]} />
              <OptionSelector label="Heading Font" value={layout.headingFont} onChange={(v) => setLayout((p) => ({ ...p, headingFont: v }))} options={[
                { value: "system", label: "System Default" },
                { value: "serif", label: "Serif Elegant" },
                { value: "mono", label: "Monospace" },
                { value: "display", label: "Display Bold" },
                { value: "handwritten", label: "Handwritten" },
              ]} />
              <OptionSelector label="Body Font" value={layout.bodyFont} onChange={(v) => setLayout((p) => ({ ...p, bodyFont: v }))} options={[
                { value: "system", label: "System Default" },
                { value: "serif", label: "Serif" },
                { value: "mono", label: "Monospace" },
                { value: "elegant", label: "Elegant" },
              ]} />
              <OptionSelector label="Base Font Size" value={layout.baseFontSize} onChange={(v) => setLayout((p) => ({ ...p, baseFontSize: v }))} options={[
                { value: "sm", label: "Small" },
                { value: "md", label: "Medium" },
                { value: "lg", label: "Large" },
              ]} />
            </div>
          </div>

          {/* ─── Animation & Spacing ─────────── */}
          <div className="adm-surface adm-border border rounded-2xl shadow-soft border border-primary/5 overflow-hidden">
            <div className="p-5 border-b border-bg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center text-white shadow-sm">
                  <Zap size={18} />
                </div>
                <div>
                  <h3 className="text-[15px] font-extrabold text-dark adm-text">Animation & Spacing</h3>
                  <p className="text-xs text-muted adm-text-muted mt-0.5">Motion effects, content density, and gaps</p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-5">
              <OptionSelector label="Animation Style" value={layout.animationStyle} onChange={(v) => setLayout((p) => ({ ...p, animationStyle: v }))} options={[
                { value: "none", label: "None" },
                { value: "subtle", label: "Subtle" },
                { value: "smooth", label: "Smooth" },
                { value: "playful", label: "Playful" },
                { value: "dramatic", label: "Dramatic" },
              ]} />
              <OptionSelector label="Content Density" value={layout.contentDensity} onChange={(v) => setLayout((p) => ({ ...p, contentDensity: v }))} options={[
                { value: "compact", label: "Compact" },
                { value: "comfortable", label: "Comfortable" },
                { value: "spacious", label: "Spacious" },
              ]} />
              <OptionSelector label="Card Gap" value={layout.cardGap} onChange={(v) => setLayout((p) => ({ ...p, cardGap: v }))} options={[
                { value: "tight", label: "Tight" },
                { value: "normal", label: "Normal" },
                { value: "wide", label: "Wide" },
              ]} />
            </div>
          </div>

          {/* ─── Extra Section Content ────────── */}
          <div className="adm-surface adm-border border rounded-2xl shadow-soft border border-primary/5 overflow-hidden">
            <div className="p-5 border-b border-bg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center text-white shadow-sm">
                  <TypeIcon size={18} />
                </div>
                <div>
                  <h3 className="text-[15px] font-extrabold text-dark adm-text">Extra Section Content</h3>
                  <p className="text-xs text-muted adm-text-muted mt-0.5">Text for promo banner, featured section, social proof, footer</p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              {[
                { key: "promoBannerText" as keyof PageContent, label: "Promo Banner Text" },
                { key: "promoBannerSubtext" as keyof PageContent, label: "Promo Banner Subtext" },
                { key: "featuredSectionTitle" as keyof PageContent, label: "Featured Section Title" },
                { key: "featuredSectionSubtitle" as keyof PageContent, label: "Featured Section Subtitle" },
                { key: "socialProofText" as keyof PageContent, label: "Social Proof Text" },
                { key: "socialProofRating" as keyof PageContent, label: "Social Proof Rating" },
                { key: "socialProofCount" as keyof PageContent, label: "Social Proof Count" },
                { key: "footerText" as keyof PageContent, label: "Footer Text" },
                { key: "footerSubtext" as keyof PageContent, label: "Footer Subtext" },
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-semibold text-dark adm-text mb-1.5">{field.label}</label>
                  <input
                    type="text"
                    value={String(form[field.key] ?? "")}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    className="w-full px-4 py-2.5 adm-bg border border-primary/10 rounded-2xl text-sm text-dark adm-text outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary focus:adm-surface adm-border border transition placeholder:adm-text-faint"
                    placeholder={String(defaultPageContent[field.key])}
                  />
                </div>
              ))}
              {/* Extra section colors */}
              <div className="border-t border-bg pt-4 space-y-5">
                <ColorPicker label="Promo Banner Background" value={styles.promoBannerBgColor} onChange={(v) => handleStyleChange("promoBannerBgColor", v)} palette={ACCENT_COLORS} />
                <ColorPicker label="Promo Banner Text Color" value={styles.promoBannerTextColor} onChange={(v) => handleStyleChange("promoBannerTextColor", v)} palette={TEXT_COLORS} />
                <ColorPicker label="Footer Background" value={styles.footerBgColor} onChange={(v) => handleStyleChange("footerBgColor", v)} palette={BG_COLORS} />
                <ColorPicker label="Footer Text Color" value={styles.footerTextColor} onChange={(v) => handleStyleChange("footerTextColor", v)} palette={TEXT_COLORS} />
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
      </div>

      {/* ── Live Preview Panel ── */}
      {showPreview && (
        <div
          className="hidden lg:flex flex-col shrink-0 border-l border adm-border adm-surface adm-border border sticky top-0 h-[calc(100vh-64px)] w-[340px] xl:w-[420px]"
        >
          <LivePreview
            pageContent={form}
            componentStyles={styles}
            layoutConfig={layout}
          />
        </div>
      )}
    </div>
  );
}
