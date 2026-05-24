// ─── CMS Types ───────────────────────────────────────────
// These types define the shape of all CMS-editable data.
// Currently backed by Zustand + localStorage.
// TODO: Replace with Supabase table types when migrating.

// ─── Language Support ────────────────────────────────────
// All user-facing text fields have an optional `_bs` (Bosnian)
// counterpart. English is the default / primary language.
// The public pages use `useLanguage()` to pick the right value.

export type AppLanguage = 'en' | 'bs';

export interface RestaurantInfo {
  name: string;
  name_bs?: string;
  tagline: string;
  tagline_bs?: string;
  image: string;
  logo: string;
  address: string;
  address_bs?: string;
  openHours: string;
  openHours_bs?: string;
  wifi: string;
  phone: string;
}

export interface CategoryInfo {
  id: string;
  label: string;
  label_bs?: string;
  icon: string;
  color: string; // tailwind gradient class e.g. "from-amber-400 to-orange-500"
}

export interface Addon {
  id: string;
  name: string;
  name_bs?: string;
  price: number;
}

export interface VariationOption {
  id: string;
  label: string;          // e.g. "Small", "Medium", "Large"
  label_bs?: string;
  priceAdjustment: number; // added to base price (0 = no change)
}

export interface Variation {
  id: string;
  name: string;            // e.g. "Size", "Crust"
  name_bs?: string;
  required: boolean;
  options: VariationOption[];
}

export interface ProductItem {
  id: string;
  restaurantId: string;
  name: string;
  name_bs?: string;
  description: string;
  description_bs?: string;
  price: number;
  image: string;
  category: string;
  station?: 'kitchen' | 'bar' | 'both';
  addons?: Addon[];
  variations?: Variation[];
  popular?: boolean;
  sortOrder?: number;
}

// ─── Page Content (all editable frontend text) ─────────

export interface PageContent {
  // ── Menu Page ──
  welcomeTitle: string;
  welcomeTitle_bs?: string;
  welcomeDescription: string;
  welcomeDescription_bs?: string;
  dineInLabel: string;
  dineInLabel_bs?: string;
  searchPlaceholder: string;
  searchPlaceholder_bs?: string;
  currencySymbol: string;

  // ── Badges (shared) ──
  popularBadgeText: string;
  popularBadgeText_bs?: string;
  customizableBadgeText: string;
  customizableBadgeText_bs?: string;

  // ── Order Bar ──
  orderBarViewText: string;
  orderBarViewText_bs?: string;
  orderBarItemAddedText: string;
  orderBarItemAddedText_bs?: string;

  // ── Cart Page ──
  cartTitle: string;
  cartTitle_bs?: string;
  emptyCartTitle: string;
  emptyCartTitle_bs?: string;
  emptyCartDescription: string;
  emptyCartDescription_bs?: string;
  browseMenuText: string;
  browseMenuText_bs?: string;
  addMoreItemsText: string;
  addMoreItemsText_bs?: string;
  orderSummaryTitle: string;
  orderSummaryTitle_bs?: string;
  dineInServiceNote: string;
  dineInServiceNote_bs?: string;
  placeOrderText: string;
  placeOrderText_bs?: string;
  clearButtonText: string;
  clearButtonText_bs?: string;

  // ── Checkout Page ──
  confirmOrderTitle: string;
  confirmOrderTitle_bs?: string;
  confirmOrderSubtitle: string;
  confirmOrderSubtitle_bs?: string;
  tableCount: number;
  yourTableTitle: string;
  yourTableTitle_bs?: string;
  yourTableDescription: string;
  yourTableDescription_bs?: string;
  kitchenNoteTitle: string;
  kitchenNoteTitle_bs?: string;
  kitchenNoteDescription: string;
  kitchenNoteDescription_bs?: string;
  kitchenNotePlaceholder: string;
  kitchenNotePlaceholder_bs?: string;
  dineInBadgeTitle: string;
  dineInBadgeTitle_bs?: string;
  dineInBadgeSubtext: string;
  dineInBadgeSubtext_bs?: string;
  sendToKitchenText: string;
  sendToKitchenText_bs?: string;
  selectTableText: string;
  selectTableText_bs?: string;

  // ── Order Confirmed ──
  orderSentTitle: string;
  orderSentTitle_bs?: string;
  orderReceivedText: string;
  orderReceivedText_bs?: string;
  orderReceivedDesc: string;
  orderReceivedDesc_bs?: string;
  preparingFoodText: string;
  preparingFoodText_bs?: string;
  preparingFoodDesc: string;
  preparingFoodDesc_bs?: string;
  comingToTableText: string;
  comingToTableText_bs?: string;
  estimatedWaitText: string;
  estimatedWaitText_bs?: string;
  backToMenuText: string;
  backToMenuText_bs?: string;
  orderMoreNote: string;
  orderMoreNote_bs?: string;

  // ── Product Page ──
  itemNotFoundText: string;
  itemNotFoundText_bs?: string;
  popularChoiceText: string;
  popularChoiceText_bs?: string;
  basePriceLabel: string;
  basePriceLabel_bs?: string;
  customizeSectionTitle: string;
  customizeSectionTitle_bs?: string;
  optionalLabel: string;
  optionalLabel_bs?: string;
  quantityLabel: string;
  quantityLabel_bs?: string;
  quantityDescription: string;
  quantityDescription_bs?: string;
  addToOrderText: string;
  addToOrderText_bs?: string;
  addedToOrderText: string;
  addedToOrderText_bs?: string;
  moreCategoryPrefix: string;
  moreCategoryPrefix_bs?: string;

  // ── Menu List ──
  noItemsFoundText: string;
  noItemsFoundText_bs?: string;
  noItemsFoundHint: string;
  noItemsFoundHint_bs?: string;
  itemsAvailableText: string;
  itemsAvailableText_bs?: string;
  itemsFoundText: string;
  itemsFoundText_bs?: string;

  // ── Promo Banner (optional extra section) ──
  promoBannerText: string;
  promoBannerText_bs?: string;
  promoBannerSubtext: string;
  promoBannerSubtext_bs?: string;

  // ── Featured Section ──
  featuredSectionTitle: string;
  featuredSectionTitle_bs?: string;
  featuredSectionSubtitle: string;
  featuredSectionSubtitle_bs?: string;

  // ── Social Proof ──
  socialProofText: string;
  socialProofText_bs?: string;
  socialProofRating: string;
  socialProofCount: string;
  socialProofCount_bs?: string;

  // ── Footer ──
  footerText: string;
  footerText_bs?: string;
  footerSubtext: string;
  footerSubtext_bs?: string;
}

// ─── Component Styles (visual layout & color customization) ─────

export interface ComponentStyles {
  // ── Hero Banner ──
  heroHeight: 'compact' | 'normal' | 'tall';
  heroTextAlign: 'left' | 'center' | 'right';
  heroOverlay: 'light' | 'medium' | 'dark';
  heroMediaType: 'image' | 'video';
  heroImageUrl: string;
  heroVideoUrl: string;

  // ── Info Bar ──
  infoBarBgColor: string;
  infoBarTextColor: string;
  infoBarVisible: boolean;

  // ── Menu Item Cards ──
  cardLayout: 'horizontal' | 'vertical';
  cardImagePosition: 'left' | 'right';
  cardBgColor: string;
  cardTitleColor: string;
  cardDescriptionColor: string;
  cardPriceColor: string;
  cardBorderRadius: 'sm' | 'md' | 'lg' | 'xl';
  cardShadow: 'none' | 'sm' | 'md' | 'lg';

  // ── Section Headers ──
  sectionTitleAlign: 'left' | 'center';
  sectionTitleColor: string;
  sectionSubtitleColor: string;
  sectionShowDivider: boolean;
  sectionShowIcon: boolean;
  sectionShowHeaders: boolean;
  sectionDividerColor: string;

  // ── Category Bar ──
  categoryBarBgColor: string;
  categoryBarSticky: boolean;
  categoryBarShowIcons: boolean;

  // ── Order Bar ──
  orderBarStyle: 'gradient' | 'solid' | 'glass';
  orderBarBgColor: string;
  orderBarTextColor: string;

  // ── Product Detail Page ──
  productCardBgColor: string;
  productTitleColor: string;
  productDescriptionColor: string;
  productPriceColor: string;
  productImagePosition: 'left' | 'right';
  productPageBgColor: string;
  productButtonBgColor: string;
  productButtonTextColor: string;
  productStickyBarBgColor: string;
  productAddonBgColor: string;
  productAddonActiveBorderColor: string;
  productQuantityBgColor: string;
  productRelatedBgColor: string;

  // ── Cart Page ──
  cartPageBgColor: string;
  cartCardBgColor: string;
  cartTitleColor: string;
  cartAccentColor: string;

  // ── Checkout Page ──
  checkoutPageBgColor: string;
  checkoutCardBgColor: string;
  checkoutAccentColor: string;

  // ── General ──
  menuPageBgColor: string;
  buttonStyle: 'rounded' | 'pill' | 'square';
  viewOnlyMode: boolean;

  // ── Promo Banner ──
  promoBannerBgColor: string;
  promoBannerTextColor: string;

  // ── Footer ──
  footerBgColor: string;
  footerTextColor: string;
}

// ─── Section Ordering & Variants ─────────────────────────
// Each menu page section can be shown/hidden, reordered, and
// have its visual variant changed independently.

export type MenuSectionId =
  | 'hero'
  | 'infoBar'
  | 'promoBanner'
  | 'searchBar'
  | 'categoryBar'
  | 'featuredSection'
  | 'menuContent'
  | 'socialProof'
  | 'footer';

export interface MenuSectionItem {
  id: MenuSectionId;
  visible: boolean;
  variant: string;
}

// ─── Section Variant Types ──────────────────────────────

export type HeroVariant = 'classic' | 'minimal' | 'centered' | 'split' | 'overlay-full';
export type InfoBarVariant = 'card' | 'inline' | 'floating' | 'banner';
export type SearchBarVariant = 'default' | 'minimal' | 'pill' | 'hidden';
export type CategoryBarVariant = 'scroll' | 'pills' | 'underline' | 'grid' | 'minimal';
export type MenuContentVariant = 'sections' | 'grid' | 'list' | 'magazine' | 'compact';
export type OrderBarVariant = 'floating' | 'sticky-bottom' | 'fab' | 'minimal';
export type PromoBannerVariant = 'ribbon' | 'card' | 'floating' | 'marquee';
export type FeaturedVariant = 'carousel' | 'highlight' | 'banner';
export type SocialProofVariant = 'stars' | 'testimonial' | 'counter';
export type FooterVariant = 'simple' | 'detailed' | 'minimal' | 'branded';export type ProductPageVariant = 'classic' | 'minimal' | 'immersive' | 'elegant' | 'compact';
// ─── Layout Configuration ───────────────────────────────

export interface LayoutConfig {
  // ── Section order & visibility ──
  sections: MenuSectionItem[];

  // ── Section variants ──
  heroVariant: HeroVariant;
  infoBarVariant: InfoBarVariant;
  searchBarVariant: SearchBarVariant;
  categoryBarVariant: CategoryBarVariant;
  menuContentVariant: MenuContentVariant;
  orderBarVariant: OrderBarVariant;
  promoBannerVariant: PromoBannerVariant;
  featuredVariant: FeaturedVariant;
  socialProofVariant: SocialProofVariant;
  footerVariant: FooterVariant;

  // ── Product Page ──
  productPageVariant: ProductPageVariant;

  // ── Page layout ──
  pageLayout: 'standard' | 'sidebar' | 'magazine' | 'compact' | 'fullWidth';

  // ── Typography ──
  headingFont: 'system' | 'serif' | 'mono' | 'display' | 'handwritten';
  bodyFont: 'system' | 'serif' | 'mono' | 'elegant';
  baseFontSize: 'sm' | 'md' | 'lg';

  // ── Animation ──
  animationStyle: 'none' | 'subtle' | 'smooth' | 'playful' | 'dramatic';

  // ── Spacing & Density ──
  contentDensity: 'compact' | 'comfortable' | 'spacious';
  cardGap: 'tight' | 'normal' | 'wide';

  // ── Active Theme ──
  activeTheme: ThemePresetId;
}

// ─── Theme Presets ──────────────────────────────────────

export type ThemePresetId =
  | 'bella-classic'
  | 'modern-minimal'
  | 'dark-elegance'
  | 'vibrant-pop'
  | 'rustic-italian'
  | 'ocean-breeze'
  | 'cozy-cafe'
  | 'fresh-garden'
  | 'warm-sunset'
  | 'nordic-clean'
  | 'tokyo-street'
  | 'desert-sand'
  | 'wine-bistro'
  | 'french-patisserie'
  | 'midnight-blue'
  | 'tropical-paradise'
  | 'steakhouse-grill'
  | 'retro-diner'
  | 'rooftop-lounge'
  | 'art-deco'
  | 'custom';

export interface ThemePreset {
  id: ThemePresetId;
  name: string;
  description: string;
  preview: { bg: string; accent: string; text: string; card: string };
  styles: Partial<ComponentStyles>;
  layout: Partial<LayoutConfig>;
  content?: Partial<PageContent>;
}
