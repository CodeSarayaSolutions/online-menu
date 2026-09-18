"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Plus, Trash2, Save, Search, X, Pencil, Flame,
  Image as ImageIcon, Package, Check, Sparkles,
  ArrowUp, ArrowDown, ChevronDown, ChevronUp, Tags,
  PanelRightClose, PanelRightOpen, Clock, ChefHat, Wine,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCmsStore } from "@/store/cmsStore";
import { useAuthStore } from "@/store/authStore";
import { ProductItem, Addon, Variation, VariationOption, CategoryInfo } from "@/types/cms";
import LivePreview from "@/components/admin/LivePreview";
import BsCollapse from "@/components/admin/BsCollapse";
import ImageUploadField from "@/components/admin/ImageUploadField";
import * as happyHourService from "@/services/happyHourService";
import * as inventoryService from "@/services/inventoryService";
import type { HappyHourSchedule, HappyHourScheduleInput } from "@/services/happyHourService";
import type { Tables } from "@/types/supabase";
import clsx from "clsx";

/* ─── Color presets for categories ──────────────────────── */
const colorPresets = [
  "from-amber-400 to-orange-500",
  "from-red-400 to-rose-500",
  "from-yellow-400 to-amber-500",
  "from-orange-400 to-red-400",
  "from-amber-500 to-yellow-600",
  "from-yellow-300 to-amber-400",
  "from-green-400 to-emerald-500",
  "from-pink-400 to-rose-500",
  "from-blue-400 to-cyan-500",
  "from-purple-400 to-violet-500",
  "from-teal-400 to-green-500",
  "from-indigo-400 to-blue-500",
];

/* ─── Blank helpers ─────────────────────────────────────── */
const blankProduct = (venueSlug: string): ProductItem => ({
  id: `p${Date.now()}`,
  restaurantId: venueSlug,
  name: "",
  description: "",
  price: 0,
  image: "",
  category: "",
  station: "both",
  addons: [],
  popular: false,
});

const blankAddon = (): Addon => ({
  id: `a${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  name: "",
  price: 0,
});

const blankVariationOption = (): VariationOption => ({
  id: `vo${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  label: "",
  priceAdjustment: 0,
});

const defaultCategoryColor = "from-amber-400 to-orange-500";

const categoryForSave = (cat: CategoryInfo): CategoryInfo => ({
  ...cat,
  icon: (cat.icon ?? "").trim(),
});

const blankVariation = (): Variation => ({
  id: `v${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  name: "",
  required: true,
  minSelect: 1,
  maxSelect: 1,
  options: [blankVariationOption()],
});

type InventoryRow = Tables<"inventory">;

type HappyHourForm = {
  id?: string;
  label: string;
  startTime: string;
  endTime: string;
  active: boolean;
  products: Record<string, string>;
};

const blankHappyHourForm = (): HappyHourForm => ({
  label: "",
  startTime: "08:00",
  endTime: "10:00",
  active: false,
  products: {},
});

const scheduleProductMap = (schedules: HappyHourSchedule[]) => {
  const map = new Map<string, HappyHourSchedule[]>();
  for (const schedule of schedules) {
    for (const product of schedule.products) {
      const rows = map.get(product.product_id) ?? [];
      rows.push(schedule);
      map.set(product.product_id, rows);
    }
  }
  return map;
};

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════ */
export default function ProductsEditor() {
  const { venue } = useParams<{ venue: string }>();
  const currentUser = useAuthStore((s) => s.getCurrentUser());
  /* ─── CMS store ─────────────────────────────────────────── */
  const products = useCmsStore((s) => s.products);
  const categories = useCmsStore((s) => s.categories);
  const addProduct = useCmsStore((s) => s.addProduct);
  const updateProduct = useCmsStore((s) => s.updateProduct);
  const removeProduct = useCmsStore((s) => s.removeProduct);
  const reorderProducts = useCmsStore((s) => s.reorderProducts);
  const addCategory = useCmsStore((s) => s.addCategory);
  const updateCategory = useCmsStore((s) => s.updateCategory);
  const removeCategory = useCmsStore((s) => s.removeCategory);
  const reorderCategories = useCmsStore((s) => s.reorderCategories);
  const pageContent = useCmsStore((s) => s.pageContent);
  const componentStyles = useCmsStore((s) => s.componentStyles);
  const layoutConfig = useCmsStore((s) => s.layoutConfig);
  const saveActiveToAllRestaurants = useCmsStore((s) => s.saveActiveToAllRestaurants);

  /* ─── Product state ─────────────────────────────────────── */
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [initialStock, setInitialStock] = useState(0);
  const [pendingInventoryTracked, setPendingInventoryTracked] = useState(true);
  const [inventoryRows, setInventoryRows] = useState<InventoryRow[]>([]);
  const [trackingConfirm, setTrackingConfirm] = useState<{
    productId: string;
    productName: string;
    nextTracked: boolean;
  } | null>(null);
  const [stockToast, setStockToast] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const [happyHourSchedules, setHappyHourSchedules] = useState<HappyHourSchedule[]>([]);
  const [showHappyHourPanel, setShowHappyHourPanel] = useState(false);
  const [happyHourForm, setHappyHourForm] = useState<HappyHourForm | null>(null);
  const [happyHourToast, setHappyHourToast] = useState<string | null>(null);
  const [happyHourBusy, setHappyHourBusy] = useState(false);

  /* ─── Category state ────────────────────────────────────── */
  const [showCatPanel, setShowCatPanel] = useState(false);
  const [catEditingId, setCatEditingId] = useState<string | null>(null);
  const [catEditForm, setCatEditForm] = useState<CategoryInfo | null>(null);
  const [showCatAdd, setShowCatAdd] = useState(false);
  const [newCat, setNewCat] = useState<CategoryInfo>({ id: "", label: "", icon: "", color: defaultCategoryColor });
  const [catSaved, setCatSaved] = useState<string | null>(null);
  const [catConfirmDelete, setCatConfirmDelete] = useState<string | null>(null);
  /** Quick-create category from product form dropdown */
  const [showProductCatModal, setShowProductCatModal] = useState(false);
  const [quickNewCat, setQuickNewCat] = useState<CategoryInfo>({
    id: "",
    label: "",
    icon: "",
    color: defaultCategoryColor,
  });

  /* ─── Preview state ──────────────────────────────────────── */
  const [showPreview, setShowPreview] = useState(true);

  /* ═════════════════════════════════════════════════════════
     CATEGORY ACTIONS
     ═════════════════════════════════════════════════════════ */
  const isSpecialCat = (id: string) => id === "all" || id === "popular";

  const startCatEdit = (cat: CategoryInfo) => { setCatEditingId(cat.id); setCatEditForm({ ...cat }); };
  const cancelCatEdit = () => { setCatEditingId(null); setCatEditForm(null); };

  const saveCatEdit = () => {
    if (catEditingId && catEditForm) {
      updateCategory(catEditingId, categoryForSave(catEditForm));
      setTimeout(() => saveActiveToAllRestaurants(venue), 0);
      setCatSaved(catEditingId);
      setTimeout(() => setCatSaved(null), 1200);
      cancelCatEdit();
    }
  };

  const handleCatAdd = () => {
    if (!newCat.id || !newCat.label) return;
    addCategory(categoryForSave(newCat));
    setTimeout(() => saveActiveToAllRestaurants(venue), 0);
    setCatSaved(newCat.id);
    setTimeout(() => setCatSaved(null), 1200);
    setNewCat({ id: "", label: "", icon: "", color: defaultCategoryColor });
    setShowCatAdd(false);
  };

  const handleCatDelete = (id: string) => { removeCategory(id); setTimeout(() => saveActiveToAllRestaurants(venue), 0); setCatConfirmDelete(null); };

  const moveCat = (index: number, direction: "up" | "down") => {
    const arr = [...categories];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= arr.length) return;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    reorderCategories(arr);
    setTimeout(() => saveActiveToAllRestaurants(venue), 0);
  };

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const realCategories = categories.filter((c) => c.id !== "all" && c.id !== "popular");
  const productHappyHourMap = useMemo(() => scheduleProductMap(happyHourSchedules), [happyHourSchedules]);
  const currentInventoryRow = editingProduct
    ? inventoryRows.find((row) => row.product_id === editingProduct.id)
    : undefined;
  const currentInventoryTracked = isNew
    ? pendingInventoryTracked
    : currentInventoryRow?.tracked !== false;

  const loadInventoryRows = async () => {
    if (!venue) return;
    try {
      const rows = await inventoryService.getInventory(venue);
      setInventoryRows(rows);
    } catch (err) {
      console.error("[inventory] failed to load rows", err);
    }
  };

  const loadHappyHours = async () => {
    if (!venue) return;
    try {
      const schedules = await happyHourService.getHappyHourSchedules(venue);
      setHappyHourSchedules(schedules);
    } catch (err) {
      console.error("[happy-hour] failed to load schedules", err);
      setHappyHourToast(err instanceof Error ? err.message : "Happy hour nije učitan");
    }
  };

  useEffect(() => {
    void loadInventoryRows();
    void loadHappyHours();
  }, [venue]);
  /** Labels used in product.category — includes DB categories + any product bucket not in the list */
  const menuCategories = useMemo(() => {
    const fromCats = realCategories.map((c) => c.label);
    const fromProducts = products.map((p) => p.category).filter(Boolean);
    return Array.from(new Set([...fromCats, ...fromProducts]));
  }, [realCategories, products]);

  const startAdd = (category?: string) => {
    const p = blankProduct(venue);
    if (category) p.category = category;
    setEditingProduct(p);
    setIsNew(true);
    setInitialStock(0);
    setPendingInventoryTracked(true);
    setStockToast(null);
  };

  const openProductCatModal = () => {
    setQuickNewCat({ id: "", label: "", icon: "", color: defaultCategoryColor });
    setShowProductCatModal(true);
  };

  const saveQuickCategory = () => {
    if (!quickNewCat.label.trim()) return;
    const id =
      quickNewCat.id.trim() ||
      quickNewCat.label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    const cat: CategoryInfo = categoryForSave({ ...quickNewCat, id, label: quickNewCat.label.trim() });
    addCategory(cat);
    setTimeout(() => saveActiveToAllRestaurants(venue), 0);
    if (editingProduct) {
      setEditingProduct({ ...editingProduct, category: cat.label });
    }
    setFilterCategory(id);
    setShowProductCatModal(false);
    setCatSaved(id);
    setTimeout(() => setCatSaved(null), 1200);
  };
  const startEdit = (p: ProductItem) => {
    setEditingProduct({
      ...p,
      addons: p.addons ? [...p.addons.map((a) => ({ ...a }))] : [],
      variations: p.variations ? p.variations.map((v) => ({ ...v, options: v.options.map((o) => ({ ...o })) })) : [],
    });
    setIsNew(false);
    setPendingInventoryTracked(true);
  };
  const cancelEdit = () => {
    setEditingProduct(null);
    setIsNew(false);
    setInitialStock(0);
    setStockToast(null);
  };

  const saveProduct = () => {
    if (!editingProduct || !editingProduct.name || !editingProduct.price) return;
    const catLabel = editingProduct.category?.trim();
    if (!catLabel) {
      openProductCatModal();
      return;
    }
    const payload = {
      ...editingProduct,
      restaurantId: venue,
      category: catLabel,
      variations: (editingProduct.variations || []).map((variation) => ({
        ...variation,
        minSelect: variation.minSelect ?? (variation.required ? 1 : 0),
        maxSelect: Math.max(variation.maxSelect ?? 1, variation.minSelect ?? 0, 1),
      })),
    };
    if (catLabel) {
      const catId = catLabel.toLowerCase().replace(/\s+/g, "-");
      const hasCat = categories.some(
        (c) => c.label.toLowerCase() === catLabel.toLowerCase() || c.id === catId
      );
      if (!hasCat) {
        addCategory({
          id: catId,
          label: catLabel,
          icon: "",
          color: defaultCategoryColor,
        });
      }
    }
    if (isNew) {
      addProduct(payload);
      const stock = initialStock;
      setTimeout(() => saveActiveToAllRestaurants(venue), 0);
      setSaved(editingProduct.id);
      setTimeout(() => setSaved(null), 1500);
      fetch("/api/inventory/adjust", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: venue,
          productId: payload.id,
          productName: payload.name,
          delta: stock,
          reason: "init",
          tracked: pendingInventoryTracked,
        }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("Inventory adjust failed");
          setStockToast(
            stock > 0
              ? `Stavka dodana. Zaliha postavljena na ${stock}.`
              : "Stavka dodana. Zaliha je trenutno 0 — ažurirajte u Inventaru."
          );
          setTimeout(() => cancelEdit(), 2500);
          void loadInventoryRows();
        })
        .catch((e) => {
          console.error("[inventory] auto-init failed", e);
          cancelEdit();
        });
      return;
    }
    updateProduct(payload.id, payload);
    /* Sync flat state → allRestaurants so public pages & reloads see the change */
    setTimeout(() => saveActiveToAllRestaurants(venue), 0);
    setSaved(editingProduct.id);
    setTimeout(() => setSaved(null), 1500);
    cancelEdit();
  };

  const openHappyHourForm = (schedule?: HappyHourSchedule) => {
    if (!schedule) {
      setHappyHourForm(blankHappyHourForm());
      setShowHappyHourPanel(true);
      return;
    }
    setHappyHourForm({
      id: schedule.id,
      label: schedule.label ?? "",
      startTime: schedule.start_time.slice(0, 5),
      endTime: schedule.end_time.slice(0, 5),
      active: schedule.active,
      products: Object.fromEntries(
        schedule.products.map((product) => [
          product.product_id,
          String(Number(product.override_price)),
        ])
      ),
    });
    setShowHappyHourPanel(true);
  };

  const saveHappyHour = async () => {
    if (!happyHourForm || !venue) return;
    const selectedProducts = Object.entries(happyHourForm.products)
      .map(([productId, value]) => ({ productId, overridePrice: Number(value) }))
      .filter((product) => product.overridePrice > 0);

    const input: HappyHourScheduleInput = {
      id: happyHourForm.id,
      label: happyHourForm.label,
      startTime: happyHourForm.startTime,
      endTime: happyHourForm.endTime,
      active: happyHourForm.active,
      products: selectedProducts,
    };

    if (happyHourForm.startTime >= happyHourForm.endTime) {
      setHappyHourToast("Vrijeme početka mora biti prije vremena završetka.");
      return;
    }
    if (Object.keys(happyHourForm.products).length !== selectedProducts.length) {
      setHappyHourToast("Happy hour cijena mora biti veća od 0 za svaki odabrani proizvod.");
      return;
    }

    setHappyHourBusy(true);
    try {
      await happyHourService.saveHappyHourSchedule(venue, input);
      await loadHappyHours();
      setHappyHourForm(null);
      setHappyHourToast("Happy hour je spremljen.");
    } catch (err) {
      setHappyHourToast(err instanceof Error ? err.message : "Spremanje happy houra nije uspjelo");
    } finally {
      setHappyHourBusy(false);
    }
  };

  const deleteHappyHour = async (scheduleId: string) => {
    setHappyHourBusy(true);
    try {
      await happyHourService.deleteHappyHourSchedule(scheduleId);
      await loadHappyHours();
      setHappyHourToast("Happy hour je obrisan.");
      if (happyHourForm?.id === scheduleId) setHappyHourForm(null);
    } catch (err) {
      setHappyHourToast(err instanceof Error ? err.message : "Brisanje happy houra nije uspjelo");
    } finally {
      setHappyHourBusy(false);
    }
  };

  const confirmTrackingChange = async () => {
    if (!trackingConfirm || !currentUser) return;
    if (isNew) {
      setPendingInventoryTracked(trackingConfirm.nextTracked);
      setTrackingConfirm(null);
      return;
    }
    setStockToast(null);
    try {
      const result = await inventoryService.setInventoryTracked(
        trackingConfirm.productId,
        venue,
        trackingConfirm.nextTracked,
        { id: currentUser.id, name: currentUser.name }
      );
      setInventoryRows((rows) =>
        rows.map((row) => (row.product_id === trackingConfirm.productId ? result.row : row))
      );
      setStockToast(
        result.auditWarning ??
          (trackingConfirm.nextTracked
            ? "Stavka će se opet oduzimati iz inventara."
            : "Stavka se više neće oduzimati iz inventara.")
      );
    } catch (err) {
      setStockToast(err instanceof Error ? err.message : "Promjena praćenja nije uspjela");
    } finally {
      setTrackingConfirm(null);
    }
  };

  const handleDelete = (id: string) => {
    removeProduct(id);
    setTimeout(() => saveActiveToAllRestaurants(venue), 0);
    setConfirmDelete(null);
    if (editingProduct?.id === id) cancelEdit();
  };

  const addAddon = () => {
    if (!editingProduct) return;
    setEditingProduct({ ...editingProduct, addons: [...(editingProduct.addons || []), blankAddon()] });
  };

  const updateAddonField = (addonId: string, field: keyof Addon, value: Addon[keyof Addon]) => {
    if (!editingProduct) return;
    setEditingProduct({
      ...editingProduct,
      addons: (editingProduct.addons || []).map((a) => a.id === addonId ? { ...a, [field]: value } : a),
    });
  };

  const removeAddon = (addonId: string) => {
    if (!editingProduct) return;
    setEditingProduct({ ...editingProduct, addons: (editingProduct.addons || []).filter((a) => a.id !== addonId) });
  };

  const dependencyOptions = (editingProduct?.variations || []).flatMap((variation) =>
    variation.options.map((option) => ({
      value: `${variation.id}|${option.id}`,
      label: `${variation.name || "Varijacija"}: ${option.label || "Opcija"}`,
      variationId: variation.id,
      optionId: option.id,
    }))
  );

  const dependencyValue = (dependsOn?: { variationId: string; optionId: string }) =>
    dependsOn ? `${dependsOn.variationId}|${dependsOn.optionId}` : "";

  const parseDependency = (value: string) => {
    if (!value) return undefined;
    const [variationId, optionId] = value.split("|");
    return variationId && optionId ? { variationId, optionId } : undefined;
  };

  /* ---- Variation helpers ---- */
  const addVariation = () => {
    if (!editingProduct) return;
    setEditingProduct({ ...editingProduct, variations: [...(editingProduct.variations || []), blankVariation()] });
  };

  const removeVariation = (varId: string) => {
    if (!editingProduct) return;
    setEditingProduct({ ...editingProduct, variations: (editingProduct.variations || []).filter((v) => v.id !== varId) });
  };

  const updateVariationField = (varId: string, field: keyof Variation, value: any) => {
    if (!editingProduct) return;
    setEditingProduct({
      ...editingProduct,
      variations: (editingProduct.variations || []).map((v) => v.id === varId ? { ...v, [field]: value } : v),
    });
  };

  const addVariationOption = (varId: string) => {
    if (!editingProduct) return;
    setEditingProduct({
      ...editingProduct,
      variations: (editingProduct.variations || []).map((v) =>
        v.id === varId ? { ...v, options: [...v.options, blankVariationOption()] } : v
      ),
    });
  };

  const updateVariationOption = (varId: string, optId: string, field: keyof VariationOption, value: any) => {
    if (!editingProduct) return;
    setEditingProduct({
      ...editingProduct,
      variations: (editingProduct.variations || []).map((v) =>
        v.id === varId ? { ...v, options: v.options.map((o) => o.id === optId ? { ...o, [field]: value } : o) } : v
      ),
    });
  };

  const removeVariationOption = (varId: string, optId: string) => {
    if (!editingProduct) return;
    setEditingProduct({
      ...editingProduct,
      variations: (editingProduct.variations || []).map((v) =>
        v.id === varId ? { ...v, options: v.options.filter((o) => o.id !== optId) } : v
      ),
    });
  };

  /* ---- Reorder helpers ---- */
  const getProductsByCategory = (cat: string) =>
    products
      .filter((p) => p.category === cat)
      .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));

  const moveProduct = (cat: string, index: number, direction: "up" | "down") => {
    const catProducts = getProductsByCategory(cat);
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= catProducts.length) return;

    const newCatProducts = [...catProducts];
    [newCatProducts[index], newCatProducts[targetIdx]] = [newCatProducts[targetIdx], newCatProducts[index]];

    const updatedIds = new Map<string, number>();
    newCatProducts.forEach((p, i) => updatedIds.set(p.id, i));

    const newProducts = products.map((p) =>
      updatedIds.has(p.id) ? { ...p, sortOrder: updatedIds.get(p.id)! } : p
    );
    reorderProducts(newProducts);
    setTimeout(() => saveActiveToAllRestaurants(venue), 0);
  };

  /* ---- Filtered products for the grouped list ---- */
  const matchesSearch = (p: ProductItem) =>
    !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.description.toLowerCase().includes(searchQuery.toLowerCase());

  const matchesCategory = (catLabel: string) =>
    filterCategory === "all" || catLabel.toLowerCase() === categories.find((c) => c.id === filterCategory)?.label.toLowerCase();

  return (
    <div className="flex gap-0">
      {/* ── Editor Panel ── */}
      <div className={clsx("flex-1 min-w-0 h-[calc(100vh-64px)] overflow-y-auto p-5 lg:p-8 transition-all duration-300", showPreview ? "lg:mr-0" : "")}>
      {/* ───────────── Header ───────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-dark adm-text tracking-tight">Stavke menija</h1>
          <p className="text-sm text-muted adm-text-muted mt-1">{products.length} stavki &middot; {categories.filter((c) => c.id !== "all" && c.id !== "popular").length} vrste</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={clsx(
              "hidden lg:flex px-3 py-2 rounded-2xl border text-sm font-semibold transition items-center gap-2",
              showPreview
                ? "border-primary/20 bg-primary/5 text-primary"
                : "border-primary/10 text-dark adm-text hover:bg-[var(--adm-surface-2)]"
            )}
            title={showPreview ? "Sakrij pregled" : "Prikaži pregled"}
          >
            {showPreview ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
            <span className="hidden 2xl:inline">{showPreview ? "Sakrij pregled" : "Prikaži pregled"}</span>
          </button>
          <button
            onClick={() => setShowCatPanel(!showCatPanel)}
            className={clsx(
              "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition border shrink-0",
              showCatPanel
                ? "bg-primary/10 border-primary/30 text-dark adm-text"
                : "adm-surface adm-border border border-primary/10 text-muted adm-text-muted hover:adm-text hover:border-primary/20"
            )}
          >
            <Tags size={15} />
            Vrste
            <span className="text-[10px] font-bold adm-bg rounded-full px-2 py-0.5 text-muted adm-text-muted">{categories.filter((c) => c.id !== "all" && c.id !== "popular").length}</span>
          </button>
          <button onClick={() => startAdd()} className="flex items-center gap-2 bg-gradient-to-r from-primary to-amber-500 text-white px-5 py-2.5 rounded-2xl text-sm font-bold hover:brightness-105 transition shadow-glow shrink-0">
            <Plus size={16} /> Dodaj stavku
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          CATEGORIES PANEL (collapsible)
          ══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showCatPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden mb-6"
          >
            <div className="adm-surface adm-border border rounded-2xl-primary/10 shadow-soft overflow-hidden">
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-primary/5 adm-bg/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Tags size={14} className="text-primary" />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-dark adm-text">Upravljanje vrstama</h2>
                    <p className="text-[10px] text-muted adm-text-muted">{categories.length} ukupno &middot; Promijenite redoslijed, uredite ili dodajte</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCatAdd(true)}
                    className="flex items-center gap-1.5 bg-gradient-to-r from-primary to-amber-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold hover:brightness-105 transition shadow-glow"
                  >
                    <Plus size={13} /> Nova vrsta
                  </button>
                  <button
                    onClick={() => setShowCatPanel(false)}
                    className="p-1.5 rounded-xl hover:bg-[var(--adm-surface-2)] text-muted adm-text-muted transition"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Add category form */}
              <AnimatePresence>
                {showCatAdd && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 py-5 border-b border-primary/10 bg-primary/[0.02]">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[13px] font-extrabold text-dark adm-text">Kreiraj vrstu</h3>
                        <button onClick={() => setShowCatAdd(false)} className="p-1 rounded-lg hover:bg-[var(--adm-surface-2)] text-muted adm-text-muted transition"><X size={14} /></button>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <CatField label="ID (mala slova)" value={newCat.id} onChange={(v) => setNewCat((c) => ({ ...c, id: v.toLowerCase().replace(/\s/g, "-") }))} placeholder="e.g. seafood" />
                        <div>
                          <label className="block text-[10px] font-bold text-muted adm-text-muted uppercase tracking-wider mb-2">Naziv za prikaz</label>
                          <div>
                            <input value={newCat.label} onChange={(e) => setNewCat((c) => ({ ...c, label: e.target.value }))} placeholder="e.g. Seafood" className="w-full px-3 py-2 adm-bg rounded-xl text-sm text-dark adm-text border border-primary/10 focus:border-primary focus:adm-surface adm-border border focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:adm-text-faint" />
                            <BsCollapse hasValue={!!((newCat as any).label_bs)}>
                              <input value={(newCat as any).label_bs || ""} onChange={(e) => setNewCat((c) => ({ ...c, label_bs: e.target.value }))} placeholder="npr. Morski plodovi" className="w-full px-3 py-2 adm-bg rounded-xl text-sm text-dark adm-text border border-blue-200/30 focus:border-blue-400 focus:adm-surface adm-border border focus:ring-4 focus:ring-blue-100 outline-none transition-all placeholder:adm-text-faint" />
                            </BsCollapse>
                          </div>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-muted adm-text-muted uppercase tracking-wider mb-2">Boja</label>
                          <div className="flex flex-wrap gap-1.5">
                            {colorPresets.map((color) => (
                              <button
                                key={color}
                                onClick={() => setNewCat((c) => ({ ...c, color }))}
                                className={clsx("w-6 h-6 rounded-lg bg-gradient-to-br transition-all", color, newCat.color === color ? "ring-2 ring-offset-1 ring-dark scale-110" : "hover:scale-105")}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => setShowCatAdd(false)} className="flex-1 py-2 rounded-xl border border-primary/10 text-xs font-semibold text-dark adm-text hover:bg-[var(--adm-surface-2)] transition">Odustani</button>
                        <button onClick={handleCatAdd} disabled={!newCat.id || !newCat.label} className="flex-1 py-2 rounded-xl bg-gradient-to-r from-primary to-amber-500 text-white text-xs font-bold hover:brightness-105 transition disabled:opacity-40 shadow-glow">Kreiraj</button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Category list */}
              <div className="divide-y divide-primary/5">
                {categories.map((cat, index) => {
                  const isEditing = catEditingId === cat.id;
                  const productCount = products.filter((p) => p.category.toLowerCase() === cat.id).length;

                  return (
                    <div key={cat.id} className={clsx("transition-colors", isEditing ? "bg-primary/[0.03]" : catSaved === cat.id ? "bg-green-50/40" : "hover:bg-[var(--adm-surface-2)]/50")}>
                      {isEditing && catEditForm ? (
                        <div className="px-5 py-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-extrabold text-dark adm-text">Editing: {cat.label}</h4>
                            <button onClick={cancelCatEdit} className="p-1 rounded-lg hover:bg-[var(--adm-surface-2)] text-muted adm-text-muted transition"><X size={13} /></button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-muted adm-text-muted uppercase tracking-wider mb-2">Naziv za prikaz</label>
                              <div>
                                <input value={catEditForm.label} onChange={(e) => setCatEditForm((f) => f ? { ...f, label: e.target.value } : f)} placeholder="e.g. Seafood" className="w-full px-3 py-2 adm-bg rounded-xl text-sm text-dark adm-text border border-primary/10 focus:border-primary focus:adm-surface adm-border border focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:adm-text-faint" />
                                <BsCollapse hasValue={!!(catEditForm.label_bs)}>
                                  <input value={catEditForm.label_bs || ""} onChange={(e) => setCatEditForm((f) => f ? { ...f, label_bs: e.target.value } : f)} placeholder="npr. Morski plodovi" className="w-full px-3 py-2 adm-bg rounded-xl text-sm text-dark adm-text border border-blue-200/30 focus:border-blue-400 focus:adm-surface adm-border border focus:ring-4 focus:ring-blue-100 outline-none transition-all placeholder:adm-text-faint" />
                                </BsCollapse>
                              </div>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-muted adm-text-muted uppercase tracking-wider mb-1.5">Boja</label>
                            <div className="flex flex-wrap gap-1.5">
                              {colorPresets.map((color) => (
                                <button
                                  key={color}
                                  onClick={() => setCatEditForm((f) => f ? { ...f, color } : f)}
                                  className={clsx("w-6 h-6 rounded-lg bg-gradient-to-br transition-all", color, catEditForm.color === color ? "ring-2 ring-offset-1 ring-dark scale-110" : "hover:scale-105")}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button onClick={cancelCatEdit} className="flex-1 py-2 rounded-xl border border-primary/10 text-xs font-semibold text-dark adm-text hover:bg-[var(--adm-surface-2)] transition">Odustani</button>
                            <button onClick={saveCatEdit} className="flex-1 py-2 rounded-xl bg-gradient-to-r from-primary to-amber-500 text-white text-xs font-bold hover:brightness-105 flex items-center justify-center gap-1.5 shadow-glow">
                              <Save size={12} /> Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2.5 px-5 py-3">
                          <div className="flex flex-col gap-0 shrink-0">
                            <button onClick={() => moveCat(index, "up")} disabled={index === 0} className="p-0.5 rounded adm-text-faint hover:text-primary disabled:opacity-20 transition"><ChevronUp size={13} /></button>
                            <button onClick={() => moveCat(index, "down")} disabled={index === categories.length - 1} className="p-0.5 rounded adm-text-faint hover:text-primary disabled:opacity-20 transition"><ChevronDown size={13} /></button>
                          </div>
                          <div className={clsx("w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-white text-base shrink-0 shadow-sm", cat.color)}>
                            {cat.icon?.trim() ? cat.icon : (
                              <span className="text-sm font-bold">{cat.label.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-dark adm-text">{cat.label}</p>
                            <p className="text-[10px] text-muted adm-text-muted">
                              {isSpecialCat(cat.id) ? <span className="text-primary font-medium">System</span> : `${productCount} ${productCount !== 1 ? "stavki" : "stavka"}`}
                            </p>
                          </div>
                          {catSaved === cat.id && <Check size={15} className="text-accent-green shrink-0" strokeWidth={3} />}
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => startCatEdit(cat)} className="p-1.5 rounded-lg text-muted adm-text-muted hover:text-primary hover:bg-primary/10 transition"><Pencil size={13} /></button>
                            {!isSpecialCat(cat.id) && (
                              catConfirmDelete === cat.id ? (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => handleCatDelete(cat.id)} className="px-2 py-1 rounded-lg text-[10px] font-bold bg-accent-red text-white hover:brightness-110 transition">Delete</button>
                                  <button onClick={() => setCatConfirmDelete(null)} className="px-1.5 py-1 rounded-lg text-[10px] text-muted adm-text-muted hover:bg-[var(--adm-surface-2)] transition">No</button>
                                </div>
                              ) : (
                                <button onClick={() => setCatConfirmDelete(cat.id)} className="p-1.5 rounded-lg adm-text-faint hover:text-accent-red hover:bg-red-50 transition"><Trash2 size={13} /></button>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-6 adm-surface adm-border border rounded-2xl shadow-soft overflow-hidden">
        <button
          type="button"
          onClick={() => setShowHappyHourPanel((open) => !open)}
          className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-[var(--adm-surface-2)] transition"
        >
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Clock size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-extrabold text-dark adm-text">Happy Hour</h2>
            <p className="text-[11px] text-muted adm-text-muted">
              {happyHourSchedules.length} raspored(a) · ručno aktivirajte popuste po vremenu
            </p>
          </div>
          <ChevronDown
            size={16}
            className={clsx("adm-text-faint transition-transform", showHappyHourPanel && "rotate-180")}
          />
        </button>

        <AnimatePresence>
          {showHappyHourPanel && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t adm-border"
            >
              <div className="p-5 space-y-4">
                {happyHourToast && (
                  <p className="rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
                    {happyHourToast}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {happyHourSchedules.map((schedule) => (
                    <div key={schedule.id} className="rounded-2xl adm-bg adm-border border p-3 min-w-[220px] flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-extrabold text-dark adm-text">
                            {schedule.label || "Happy Hour"}
                          </p>
                          <p className="text-xs text-muted adm-text-muted">
                            {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)} · {schedule.products.length} stavki
                          </p>
                        </div>
                        <span
                          className={clsx(
                            "rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase",
                            schedule.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                          )}
                        >
                          {schedule.active ? "Aktivno" : "Ugašeno"}
                        </span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => openHappyHourForm(schedule)}
                          className="flex-1 rounded-xl adm-surface adm-border border px-3 py-2 text-xs font-bold adm-text"
                        >
                          Uredi
                        </button>
                        <button
                          type="button"
                          disabled={happyHourBusy}
                          onClick={() => void deleteHappyHour(schedule.id)}
                          className="rounded-xl px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-40"
                        >
                          Obriši
                        </button>
                      </div>
                    </div>
                  ))}
                  {happyHourSchedules.length === 0 && (
                    <p className="text-xs text-muted adm-text-muted py-2">
                      Nema happy hour rasporeda.
                    </p>
                  )}
                </div>

                {happyHourForm ? (
                  <div className="rounded-2xl border adm-border adm-bg p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Field
                        label="Naziv"
                        value={happyHourForm.label}
                        onChange={(v) => setHappyHourForm((form) => form ? { ...form, label: v } : form)}
                        placeholder="Jutarnji happy hour"
                      />
                      <Field
                        label="Početak"
                        type="time"
                        value={happyHourForm.startTime}
                        onChange={(v) => setHappyHourForm((form) => form ? { ...form, startTime: v } : form)}
                      />
                      <Field
                        label="Kraj"
                        type="time"
                        value={happyHourForm.endTime}
                        onChange={(v) => setHappyHourForm((form) => form ? { ...form, endTime: v } : form)}
                      />
                    </div>

                    <label className="inline-flex items-center gap-2 text-sm font-bold adm-text">
                      <input
                        type="checkbox"
                        checked={happyHourForm.active}
                        onChange={(e) => setHappyHourForm((form) => form ? { ...form, active: e.target.checked } : form)}
                        className="h-4 w-4 accent-primary"
                      />
                      Aktivno
                    </label>

                    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                      <p className="text-[10px] font-bold text-muted adm-text-muted uppercase tracking-wider">
                        Proizvodi i happy hour cijene
                      </p>
                      {products.map((product) => {
                        const selected = Object.prototype.hasOwnProperty.call(happyHourForm.products, product.id);
                        return (
                          <div key={product.id} className="flex items-center gap-3 rounded-xl adm-surface adm-border border p-3">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(e) =>
                                setHappyHourForm((form) => {
                                  if (!form) return form;
                                  const next = { ...form.products };
                                  if (e.target.checked) next[product.id] = product.price.toFixed(2);
                                  else delete next[product.id];
                                  return { ...form, products: next };
                                })
                              }
                              className="h-4 w-4 accent-primary"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold adm-text truncate">{product.name}</p>
                              <p className="text-[11px] text-muted adm-text-muted">{product.price.toFixed(2)} KM</p>
                            </div>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              disabled={!selected}
                              value={happyHourForm.products[product.id] ?? ""}
                              onChange={(e) =>
                                setHappyHourForm((form) =>
                                  form ? { ...form, products: { ...form.products, [product.id]: e.target.value } } : form
                                )
                              }
                              placeholder="HH cijena"
                              className="w-28 rounded-xl adm-bg adm-border border px-3 py-2 text-sm adm-text disabled:opacity-40"
                            />
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setHappyHourForm(null)}
                        className="flex-1 rounded-xl adm-surface adm-border border px-4 py-2.5 text-sm font-bold adm-text"
                      >
                        Odustani
                      </button>
                      <button
                        type="button"
                        disabled={happyHourBusy}
                        onClick={() => void saveHappyHour()}
                        className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
                      >
                        Spremi Happy Hour
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openHappyHourForm()}
                    className="min-h-[44px] rounded-xl bg-primary text-white px-4 text-sm font-bold"
                  >
                    + Novi Happy Hour
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Search & filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 adm-text-faint" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pretraži stavke..."
            className="w-full pl-10 pr-9 py-2.5 adm-surface adm-border border rounded-2xl text-sm text-dark adm-text border border-primary/10 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all shadow-soft"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 adm-text-faint hover:adm-text">
              <X size={14} />
            </button>
          )}
        </div>
        <select
          value={filterCategory}
          onChange={(e) => {
            if (e.target.value === "__create__") {
              openProductCatModal();
              return;
            }
            setFilterCategory(e.target.value);
          }}
          className="px-4 py-2.5 adm-surface adm-border border rounded-2xl text-sm text-dark adm-text border border-primary/10 focus:border-primary outline-none min-w-[180px] shadow-soft"
        >
          <option value="all">Sve vrste (samo filter)</option>
          {realCategories.map((c) => (
            <option key={c.id} value={c.id}>{c.icon?.trim() ? `${c.icon} ` : ""}{c.label}</option>
          ))}
          <option value="__create__">➕ Kreiraj novu vrstu…</option>
        </select>
      </div>

      {/* Products grouped by category */}
      <div className="space-y-5">
        {menuCategories.map((cat) => {
          if (!matchesCategory(cat)) return null;
          const catProducts = getProductsByCategory(cat).filter(matchesSearch);
          if (catProducts.length === 0 && searchQuery) return null;
          const catObj = categories.find((c) => c.label === cat);
          return (
            <div key={cat} className="adm-surface adm-border border rounded-2xl-primary/5 shadow-soft overflow-hidden">
              <div className="adm-bg border-b border-primary/5 flex items-center">
              <button
                onClick={() => toggleCategory(cat)}
                className="flex-1 px-5 py-3.5 flex items-center gap-2 hover:bg-primary/[0.03] transition cursor-pointer text-left"
              >
                <ChevronDown
                  size={14}
                  className={clsx(
                    "adm-text-faint transition-transform duration-200 shrink-0",
                    collapsedCategories.has(cat) && "-rotate-90"
                  )}
                />
                {catObj?.icon && <span className="text-base">{catObj.icon}</span>}
                <h3 className="text-sm font-extrabold text-dark adm-text">{cat}</h3>
                <span className="text-xs text-muted adm-text-muted ml-auto">{catProducts.length} {catProducts.length !== 1 ? "stavki" : "stavka"}</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); startAdd(cat); if (collapsedCategories.has(cat)) toggleCategory(cat); }}
                className="px-3 py-2 mr-3 my-1 flex items-center gap-1 rounded-xl text-xs font-semibold text-primary hover:bg-primary/10 transition shrink-0"
                title={`Add product to ${cat}`}
              >
                <Plus size={13} /> Dodaj
              </button>
              </div>
              {!collapsedCategories.has(cat) && (
              <div className="divide-y divide-bg">
                {catProducts.map((product, idx) => (
                  <div
                    key={product.id}
                    className={clsx(
                      "flex items-center gap-3 px-5 py-3 transition",
                      saved === product.id ? "bg-accent-green/5" : "hover:bg-[var(--adm-surface-2)]/50",
                      editingProduct?.id === product.id && "ring-2 ring-primary/20 bg-primary/[0.02]"
                    )}
                  >
                    <span className="text-xs font-bold adm-text-faint w-5 text-center shrink-0">{idx + 1}</span>
                    <div className="w-10 h-10 rounded-xl adm-bg overflow-hidden shrink-0">
                      {product.image ? (
                        <img src={product.image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><ImageIcon size={14} className="adm-text-faint" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-dark adm-text truncate">{product.name}</p>
                        {product.popular && (
                          <span className="shrink-0 bg-gradient-to-r from-primary to-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <Flame size={8} /> Popular
                          </span>
                        )}
                        {productHappyHourMap.has(product.id) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const names = productHappyHourMap
                                .get(product.id)
                                ?.map((schedule) => schedule.label || "Happy Hour")
                                .join(", ");
                              setHappyHourToast(`${product.name}: ${names}`);
                              setShowHappyHourPanel(true);
                            }}
                            className="shrink-0 bg-primary/10 text-primary text-[9px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                            title="Happy hour rasporedi"
                          >
                            <Clock size={8} /> HH
                          </button>
                        )}
                        {saved === product.id && (
                          <Check size={14} className="text-accent-green shrink-0" strokeWidth={3} />
                        )}
                      </div>
                      <p className="text-xs text-muted adm-text-muted">
                        {product.price.toFixed(2)} KM
                        {product.addons && product.addons.length > 0 && (
                          <span className="ml-1.5 text-accent-blue">{product.addons.length} addon{product.addons.length > 1 ? "s" : ""}</span>
                        )}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => startEdit(product)}
                        className="w-10 h-10 p-2 rounded-xl text-muted adm-text-muted hover:text-primary hover:bg-primary/10 transition flex items-center justify-center"
                        title="Edit"
                        aria-label={`Uredi ${product.name}`}
                      >
                        <Pencil size={18} />
                      </button>
                      {confirmDelete === product.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(product.id)} className="px-2 py-1 rounded-lg text-[10px] font-bold bg-accent-red text-white hover:brightness-110 transition">Delete</button>
                          <button onClick={() => setConfirmDelete(null)} className="px-1.5 py-1 rounded-lg text-[10px] text-muted adm-text-muted hover:bg-[var(--adm-surface-2)] transition">No</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(product.id)}
                          className="p-1.5 rounded-lg adm-text-faint hover:text-accent-red hover:bg-red-50 transition"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      <div className="w-px h-5 bg-primary/5 mx-0.5" />
                      <button
                        onClick={() => moveProduct(cat, idx, "up")}
                        disabled={idx === 0}
                        className={clsx(
                          "p-1.5 rounded-lg transition",
                          idx === 0 ? "adm-text-faint cursor-not-allowed" : "text-muted adm-text-muted hover:text-primary hover:bg-primary/10"
                        )}
                        title="Move up"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        onClick={() => moveProduct(cat, idx, "down")}
                        disabled={idx === catProducts.length - 1}
                        className={clsx(
                          "p-1.5 rounded-lg transition",
                          idx === catProducts.length - 1 ? "adm-text-faint cursor-not-allowed" : "text-muted adm-text-muted hover:text-primary hover:bg-primary/10"
                        )}
                        title="Move down"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </div>
          );
        })}

        {/* Empty state */}
        {products.filter(matchesSearch).length === 0 && (
          <div className="text-center py-20 adm-surface adm-border border rounded-2xl shadow-soft border border-primary/5">
            <Package size={40} className="adm-text-faint mx-auto mb-3" />
            <p className="text-muted adm-text-muted text-sm font-medium">Nema pronađenih stavki</p>
            <p className="adm-text-faint text-xs mt-1">
              {searchQuery || filterCategory !== "all"
                ? "Pokušajte drugi pretragu ili filter vrste"
                : "Prvo dodajte vrstu, zatim kreirajte prvu stavku"}
            </p>
          </div>
        )}
      </div>
      </div>

      {/* Product add/edit drawer */}
      <AnimatePresence>
        {editingProduct && (
          <>
            <motion.div
              key="product-drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50"
              onClick={cancelEdit}
              aria-hidden
            />
            <motion.aside
              key="product-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="product-drawer-title"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
              className="fixed inset-y-0 right-0 z-50 flex flex-col w-full md:w-[480px] adm-surface adm-border border-l border-primary/10 shadow-elevated"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Sticky header */}
              <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-b border-primary/10 adm-bg/90 backdrop-blur-md">
                <div className="min-w-0">
                  <h2 id="product-drawer-title" className="text-[15px] font-extrabold text-dark adm-text truncate">
                    {isNew ? "Nova stavka" : "Uredi stavku"}
                  </h2>
                  {!isNew && (
                    <p className="text-[11px] text-muted adm-text-muted truncate mt-0.5">{editingProduct.name}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="p-2 rounded-xl hover:bg-[var(--adm-surface-2)] text-muted adm-text-muted transition shrink-0"
                  aria-label="Zatvori"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable body */}
              <div
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-5 space-y-4"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-muted adm-text-muted uppercase tracking-wider mb-2">Naziv *</label>
                    <div className="flex items-start gap-3">
                      {editingProduct.image ? (
                        <img
                          src={editingProduct.image}
                          alt=""
                          className="w-12 h-12 rounded-xl object-cover shrink-0 border border-primary/10 adm-bg"
                        />
                      ) : null}
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={editingProduct.name}
                          onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                          placeholder="e.g. Margherita Pizza"
                          className="w-full px-3 py-2.5 adm-bg rounded-2xl text-sm text-dark adm-text border border-primary/10 focus:border-primary focus:adm-surface adm-border border focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:adm-text-faint"
                        />
                        <BsCollapse hasValue={!!(editingProduct.name_bs)}>
                          <input
                            type="text"
                            value={editingProduct.name_bs || ""}
                            onChange={(e) => setEditingProduct({ ...editingProduct, name_bs: e.target.value })}
                            placeholder="npr. Margherita Pizza"
                            className="w-full px-3 py-2.5 adm-bg rounded-2xl text-sm text-dark adm-text border border-blue-200/30 focus:border-blue-400 focus:adm-surface adm-border border focus:ring-4 focus:ring-blue-100 outline-none transition-all placeholder:adm-text-faint mt-2"
                          />
                        </BsCollapse>
                      </div>
                    </div>
                  </div>
                  <Field
                    label="Cijena (KM) *"
                    type="number"
                    value={editingProduct.price || ""}
                    onChange={(v) => setEditingProduct({ ...editingProduct, price: parseFloat(v) || 0 })}
                    placeholder="12.99"
                  />
                  {isNew && (
                    <div>
                      <label className="block text-[10px] font-bold text-muted adm-text-muted uppercase tracking-wider mb-2">
                        Početna zaliha
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={initialStock}
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10);
                          setInitialStock(Number.isNaN(n) ? 0 : Math.max(0, n));
                        }}
                        placeholder="0"
                        className="w-full px-3.5 py-2.5 adm-bg rounded-2xl text-sm text-dark adm-text border border-primary/10 focus:border-primary focus:adm-surface adm-border border focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:adm-text-faint"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-muted adm-text-muted uppercase tracking-wider mb-2">Opis</label>
                  <div>
                    <textarea
                      value={editingProduct.description}
                      onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                      rows={2}
                      placeholder="Opišite jelo..."
                      className="w-full px-3.5 py-2.5 adm-bg rounded-2xl text-sm text-dark adm-text border border-primary/10 focus:border-primary focus:adm-surface adm-border border focus:ring-4 focus:ring-primary/10 outline-none resize-none transition-all placeholder:adm-text-faint"
                    />
                    <BsCollapse hasValue={!!(editingProduct.description_bs)}>
                      <textarea
                        value={editingProduct.description_bs || ""}
                        onChange={(e) => setEditingProduct({ ...editingProduct, description_bs: e.target.value })}
                        rows={2}
                        placeholder="Opišite jelo..."
                        className="w-full px-3.5 py-2.5 adm-bg rounded-2xl text-sm text-dark adm-text border border-blue-200/30 focus:border-blue-400 focus:adm-surface adm-border border focus:ring-4 focus:ring-blue-100 outline-none resize-none transition-all placeholder:adm-text-faint mt-2"
                      />
                    </BsCollapse>
                  </div>
                </div>

                <div className="space-y-4">
                  <ImageUploadField
                    hidePreview
                    label="Slika proizvoda"
                    restaurantId={venue}
                    placement="product"
                    value={editingProduct.image}
                    onChange={(url) => setEditingProduct({ ...editingProduct, image: url })}
                    className="min-w-0"
                  />
                  <div>
                    <label className="block text-[10px] font-bold text-muted adm-text-muted uppercase tracking-wider mb-2">Vrsta *</label>
                    <select
                      value={editingProduct.category || ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "__create__") {
                          openProductCatModal();
                          return;
                        }
                        setEditingProduct({ ...editingProduct, category: v });
                      }}
                      className="w-full px-3.5 py-2.5 adm-bg rounded-2xl text-sm text-dark adm-text border border-primary/10 focus:border-primary outline-none transition-all"
                    >
                      <option value="" disabled>
                        {realCategories.length === 0 ? "Još nema vrsta — kreirajte jednu" : "Odaberite vrstu"}
                      </option>
                      {realCategories.map((c) => (
                        <option key={c.id} value={c.label}>
                          {c.icon?.trim() ? `${c.icon} ` : ""}{c.label}
                        </option>
                      ))}
                      {menuCategories
                        .filter((label) => !realCategories.some((c) => c.label === label))
                        .map((label) => (
                          <option key={`legacy-${label}`} value={label}>
                            {label} (iz postojećih stavki)
                          </option>
                        ))}
                      <option value="__create__">➕ Kreiraj novu vrstu…</option>
                    </select>
                    <p className="text-[10px] text-muted adm-text-muted mt-1.5">
                      Svaka stavka mora imati svoju vrstu.
                    </p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted adm-text-muted uppercase tracking-wider mb-2">
                      Stanica
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { id: "kitchen", label: "Kuhinja", icon: ChefHat },
                          { id: "bar", label: "Šank", icon: Wine },
                          { id: "both", label: "Oba", icon: Package },
                        ] as const
                      ).map((option) => {
                        const selected = (editingProduct.station ?? "both") === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() =>
                              setEditingProduct({ ...editingProduct, station: option.id })
                            }
                            className={clsx(
                              "flex flex-col items-center gap-1 rounded-2xl px-2 py-2.5 text-[11px] font-bold border transition",
                              selected
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-primary/10 adm-bg text-muted adm-text-muted"
                            )}
                          >
                            <option.icon size={16} />
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-muted adm-text-muted mt-1.5">
                      Pića šaljite na šank, jela na kuhinju. Oba se vidi na obje stanice.
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-3 py-2 cursor-pointer group">
                  <div
                    className={clsx(
                      "w-11 h-6 rounded-full transition-all relative cursor-pointer",
                      editingProduct.popular ? "bg-primary" : "adm-bg border border-primary/10"
                    )}
                    onClick={() => setEditingProduct({ ...editingProduct, popular: !editingProduct.popular })}
                  >
                    <div
                      className={clsx(
                        "absolute top-0.5 w-5 h-5 adm-surface adm-border border rounded-full shadow-md transition-all",
                        editingProduct.popular ? "left-[22px]" : "left-0.5"
                      )}
                    />
                  </div>
                  <span className="text-sm font-medium text-dark adm-text flex items-center gap-1.5">
                    <Flame size={14} className={editingProduct.popular ? "text-primary" : "adm-text-faint"} />
                    Označi kao popularno
                  </span>
                </label>

                {(isNew || currentInventoryRow) && (
                  <div className="rounded-2xl adm-bg adm-border border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-extrabold adm-text">Prati stanje zaliha</p>
                        <p className="text-[11px] text-muted adm-text-muted mt-0.5">
                          {currentInventoryTracked
                            ? "Narudžbe će skidati količinu iz inventara."
                            : "Stavka ostaje u inventaru, ali se količina ne skida."}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setTrackingConfirm({
                            productId: editingProduct.id,
                            productName: editingProduct.name || "Stavka",
                            nextTracked: !currentInventoryTracked,
                          })
                        }
                        className={clsx(
                          "relative h-7 w-12 rounded-full transition shrink-0",
                          currentInventoryTracked ? "bg-primary" : "bg-slate-300"
                        )}
                        aria-pressed={currentInventoryTracked}
                      >
                        <span
                          className={clsx(
                            "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition",
                            currentInventoryTracked ? "left-6" : "left-1"
                          )}
                        />
                      </button>
                    </div>
                  </div>
                )}

                {/* Addons */}
                <div className="border-t border-primary/10 pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-primary/50" />
                      <h4 className="text-xs font-bold text-muted adm-text-muted uppercase tracking-wider">Dodaci / Extras</h4>
                    </div>
                    <button
                      type="button"
                      onClick={addAddon}
                      className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:brightness-110 transition"
                    >
                      <Plus size={14} /> Dodaj extra
                    </button>
                  </div>
                  {(editingProduct.addons || []).length === 0 ? (
                    <p className="text-xs text-muted adm-text-muted italic py-2">Još nema dodataka. Dodajte opcije za ovu stavku.</p>
                  ) : (
                    <div className="space-y-2">
                      {(editingProduct.addons || []).map((addon) => (
                        <div key={addon.id} className="adm-bg rounded-2xl p-3 border border-primary/5 space-y-1.5">
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <input
                                value={addon.name}
                                onChange={(e) => updateAddonField(addon.id, "name", e.target.value)}
                                placeholder="Naziv dodatka"
                                className="w-full px-3 py-2 adm-surface adm-border border rounded-xl text-sm text-dark adm-text border border-primary/10 focus:border-primary outline-none transition"
                              />
                              <BsCollapse hasValue={!!(addon.name_bs)}>
                                <input
                                  value={addon.name_bs || ""}
                                  onChange={(e) => updateAddonField(addon.id, "name_bs", e.target.value)}
                                  placeholder="Naziv dodatka"
                                  className="w-full px-3 py-2 adm-surface adm-border border rounded-xl text-sm text-dark adm-text border border-blue-200/30 focus:border-blue-400 outline-none transition mt-1.5"
                                />
                              </BsCollapse>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted adm-text-muted font-medium">KM</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={addon.price || ""}
                                onChange={(e) => updateAddonField(addon.id, "price", parseFloat(e.target.value) || 0)}
                                placeholder="0.00"
                                className="w-20 px-3 py-2 adm-surface adm-border border rounded-xl text-sm text-dark adm-text border border-primary/10 focus:border-primary outline-none transition"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeAddon(addon.id)}
                              className="p-1.5 rounded-xl adm-text-faint hover:text-accent-red hover:bg-red-50 transition"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2">
                            <input
                              value={addon.groupId || ""}
                              onChange={(e) => updateAddonField(addon.id, "groupId", e.target.value)}
                              placeholder="ID grupe"
                              className="px-3 py-2 adm-surface adm-border border rounded-xl text-xs text-dark adm-text border border-primary/10 focus:border-primary outline-none transition"
                            />
                            <input
                              value={addon.groupLabel || ""}
                              onChange={(e) => updateAddonField(addon.id, "groupLabel", e.target.value)}
                              placeholder="Naziv grupe"
                              className="px-3 py-2 adm-surface adm-border border rounded-xl text-xs text-dark adm-text border border-primary/10 focus:border-primary outline-none transition"
                            />
                            <input
                              type="number"
                              min="0"
                              value={addon.minSelect ?? ""}
                              onChange={(e) => updateAddonField(addon.id, "minSelect", e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)))}
                              placeholder="Min"
                              className="px-3 py-2 adm-surface adm-border border rounded-xl text-xs text-dark adm-text border border-primary/10 focus:border-primary outline-none transition"
                            />
                            <input
                              type="number"
                              min="0"
                              value={addon.maxSelect ?? ""}
                              onChange={(e) => updateAddonField(addon.id, "maxSelect", e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)))}
                              placeholder="Max"
                              className="px-3 py-2 adm-surface adm-border border rounded-xl text-xs text-dark adm-text border border-primary/10 focus:border-primary outline-none transition"
                            />
                          </div>
                          {dependencyOptions.length > 0 && (
                            <select
                              value={dependencyValue(addon.dependsOn)}
                              onChange={(e) => updateAddonField(addon.id, "dependsOn", parseDependency(e.target.value))}
                              className="w-full px-3 py-2 adm-surface adm-border border rounded-xl text-xs text-dark adm-text border border-primary/10 focus:border-primary outline-none transition"
                            >
                              <option value="">Uvijek prikaži dodatak</option>
                              {dependencyOptions.map((option) => (
                                <option key={`${addon.id}-${option.value}`} value={option.value}>
                                  Prikaži ako je odabrano: {option.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Variations */}
                <div className="border-t border-primary/10 pt-5 pb-2">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Package size={14} className="text-accent-blue/50" />
                      <h4 className="text-xs font-bold text-muted adm-text-muted uppercase tracking-wider">Varijacije</h4>
                      <span className="text-[10px] adm-text-muted">(npr. Veličina, Okus)</span>
                    </div>
                    <button
                      type="button"
                      onClick={addVariation}
                      className="flex items-center gap-1.5 text-xs font-semibold text-accent-blue hover:brightness-110 transition shrink-0"
                    >
                      <Plus size={14} /> Dodaj varijaciju
                    </button>
                  </div>
                  {(editingProduct.variations || []).length === 0 ? (
                    <p className="text-xs text-muted adm-text-muted italic py-2">Nema varijacija. Dodajte veličinu, okus ili slične opcije.</p>
                  ) : (
                    <div className="space-y-4">
                      {(editingProduct.variations || []).map((variation) => (
                        <div key={variation.id} className="adm-bg rounded-2xl p-4 border border-primary/5">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="flex-1">
                              <input
                                value={variation.name}
                                onChange={(e) => updateVariationField(variation.id, "name", e.target.value)}
                                placeholder="Naziv varijacije (npr. Veličina)"
                                className="w-full px-3 py-2 adm-surface adm-border border rounded-xl text-sm text-dark adm-text font-semibold border border-primary/10 focus:border-primary outline-none transition"
                              />
                              <BsCollapse hasValue={!!(variation.name_bs)}>
                                <input
                                  value={variation.name_bs || ""}
                                  onChange={(e) => updateVariationField(variation.id, "name_bs", e.target.value)}
                                  placeholder="Naziv varijacije (npr. Veličina)"
                                  className="w-full px-3 py-2 adm-surface adm-border border rounded-xl text-sm text-dark adm-text font-semibold border border-blue-200/30 focus:border-blue-400 outline-none transition mt-1.5"
                                />
                              </BsCollapse>
                            </div>
                            <label className="flex items-center gap-1.5 text-xs text-muted adm-text-muted whitespace-nowrap cursor-pointer">
                              <input
                                type="checkbox"
                                checked={variation.required}
                                onChange={(e) => updateVariationField(variation.id, "required", e.target.checked)}
                                className="w-3.5 h-3.5 accent-primary"
                              />
                              Obavezno
                            </label>
                            <div className="hidden sm:flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                value={variation.minSelect ?? ""}
                                onChange={(e) => updateVariationField(variation.id, "minSelect", e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)))}
                                placeholder="Min"
                                className="w-16 px-2 py-1.5 adm-surface adm-border border rounded-lg text-xs text-dark adm-text border border-primary/10 focus:border-primary outline-none transition"
                              />
                              <input
                                type="number"
                                min="1"
                                value={variation.maxSelect ?? ""}
                                onChange={(e) => updateVariationField(variation.id, "maxSelect", e.target.value === "" ? undefined : Math.max(1, Number(e.target.value)))}
                                placeholder="Max"
                                className="w-16 px-2 py-1.5 adm-surface adm-border border rounded-lg text-xs text-dark adm-text border border-primary/10 focus:border-primary outline-none transition"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeVariation(variation.id)}
                              className="p-1.5 rounded-xl adm-text-faint hover:text-accent-red hover:bg-red-50 transition"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="sm:hidden grid grid-cols-2 gap-2 mb-3">
                            <input
                              type="number"
                              min="0"
                              value={variation.minSelect ?? ""}
                              onChange={(e) => updateVariationField(variation.id, "minSelect", e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)))}
                              placeholder="Min odabira"
                              className="px-3 py-2 adm-surface adm-border border rounded-xl text-xs text-dark adm-text border border-primary/10 focus:border-primary outline-none transition"
                            />
                            <input
                              type="number"
                              min="1"
                              value={variation.maxSelect ?? ""}
                              onChange={(e) => updateVariationField(variation.id, "maxSelect", e.target.value === "" ? undefined : Math.max(1, Number(e.target.value)))}
                              placeholder="Max odabira"
                              className="px-3 py-2 adm-surface adm-border border rounded-xl text-xs text-dark adm-text border border-primary/10 focus:border-primary outline-none transition"
                            />
                          </div>
                          <div className="space-y-2">
                            {variation.options.map((opt) => (
                              <div key={opt.id} className="flex items-start gap-2 pl-2">
                                <span className="adm-text-faint text-xs mt-2">•</span>
                                <div className="flex-1">
                                  <input
                                    value={opt.label}
                                    onChange={(e) => updateVariationOption(variation.id, opt.id, "label", e.target.value)}
                                    placeholder="Opcija (npr. Malo)"
                                    className="w-full px-2 py-1.5 adm-surface adm-border border rounded-lg text-sm text-dark adm-text border border-primary/10 focus:border-primary outline-none transition"
                                  />
                                  <BsCollapse hasValue={!!(opt.label_bs)}>
                                    <input
                                      value={opt.label_bs || ""}
                                      onChange={(e) => updateVariationOption(variation.id, opt.id, "label_bs", e.target.value)}
                                      placeholder="Oznaka opcije (npr. Malo)"
                                      className="w-full px-2 py-1.5 adm-surface adm-border border rounded-lg text-sm text-dark adm-text border border-blue-200/30 focus:border-blue-400 outline-none transition mt-1"
                                    />
                                  </BsCollapse>
                                  {dependencyOptions.length > 0 && (
                                    <select
                                      value={dependencyValue(opt.dependsOn)}
                                      onChange={(e) => updateVariationOption(variation.id, opt.id, "dependsOn", parseDependency(e.target.value))}
                                      className="w-full px-2 py-1.5 adm-surface adm-border border rounded-lg text-xs text-dark adm-text border border-primary/10 focus:border-primary outline-none transition mt-1"
                                    >
                                      <option value="">Uvijek prikaži opciju</option>
                                      {dependencyOptions
                                        .filter((dependency) => dependency.optionId !== opt.id)
                                        .map((dependency) => (
                                          <option key={`${opt.id}-${dependency.value}`} value={dependency.value}>
                                            Prikaži ako je odabrano: {dependency.label}
                                          </option>
                                        ))}
                                    </select>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-muted adm-text-muted">+KM</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={opt.priceAdjustment || ""}
                                    onChange={(e) =>
                                      updateVariationOption(variation.id, opt.id, "priceAdjustment", parseFloat(e.target.value) || 0)
                                    }
                                    placeholder="0.00"
                                    className="w-16 px-2 py-1.5 adm-surface adm-border border rounded-lg text-sm text-dark adm-text border border-primary/10 focus:border-primary outline-none transition"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeVariationOption(variation.id, opt.id)}
                                  disabled={variation.options.length <= 1}
                                  className={clsx(
                                    "p-1 rounded-lg transition",
                                    variation.options.length <= 1
                                      ? "adm-text-faint cursor-not-allowed"
                                      : "adm-text-faint hover:text-accent-red hover:bg-red-50"
                                  )}
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => addVariationOption(variation.id)}
                            className="mt-2 ml-4 flex items-center gap-1 text-[11px] font-medium text-primary/70 hover:text-primary transition"
                          >
                            <Plus size={11} /> Dodaj opciju
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {stockToast && (
                  <motion.div
                    key="stock-toast"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute bottom-[5.25rem] left-1/2 -translate-x-1/2 z-10 bg-dark text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-lg max-w-[calc(100%-2.5rem)] text-center pointer-events-none"
                  >
                    {stockToast}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Sticky footer */}
              <div className="shrink-0 flex gap-3 px-5 py-4 border-t border-primary/10 adm-bg/90 backdrop-blur-md">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="flex-1 py-3 rounded-2xl border border-primary/10 text-sm font-semibold text-dark adm-text hover:bg-[var(--adm-surface-2)] transition"
                >
                  Odustani
                </button>
                <button
                  type="button"
                  onClick={saveProduct}
                  disabled={!editingProduct.name || !editingProduct.price || !editingProduct.category?.trim()}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-primary to-amber-500 text-white text-sm font-bold hover:brightness-105 transition disabled:opacity-40 flex items-center justify-center gap-2 shadow-glow"
                >
                  <Save size={15} />
                  {isNew ? "Dodaj stavku" : "Spremi"}
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {trackingConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[120] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              className="adm-surface adm-border border rounded-3xl w-full max-w-[420px] shadow-elevated overflow-hidden"
            >
              <div className="p-6">
                <h3 className="text-lg font-extrabold adm-text">Jeste li sigurni?</h3>
                <p className="mt-2 text-sm text-muted adm-text-muted leading-relaxed">
                  {trackingConfirm.nextTracked
                    ? "Ova stavka će se ponovo oduzimati iz inventara pri narudžbi."
                    : "Ova stavka neće više biti oduzimana iz inventara pri narudžbi."}
                </p>
                <p className="mt-3 text-sm font-bold adm-text">{trackingConfirm.productName}</p>
              </div>
              <div className="px-6 py-4 border-t adm-border flex gap-3">
                <button
                  type="button"
                  onClick={() => setTrackingConfirm(null)}
                  className="flex-1 rounded-xl adm-border border py-2.5 text-sm font-bold adm-text"
                >
                  Otkaži
                </button>
                <button
                  type="button"
                  onClick={() => void confirmTrackingChange()}
                  className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-white"
                >
                  Potvrdi
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick-create category modal (from product category dropdown or filter) */}
      <AnimatePresence>
        {showProductCatModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => setShowProductCatModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="adm-surface adm-border border rounded-3xl max-w-[440px] w-full shadow-elevated overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 pt-6 pb-4 border-b border adm-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Tags size={18} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-extrabold text-dark adm-text">Nova vrsta</h3>
                    <p className="text-[11px] text-muted adm-text-muted">Stavke su grupirane po vrstama u meniju</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProductCatModal(false)}
                  className="w-8 h-8 rounded-xl hover:bg-[var(--adm-surface-2)] flex items-center justify-center text-muted adm-text-muted"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <CatField
                  label="ID (slug)"
                  value={quickNewCat.id}
                  onChange={(v) =>
                    setQuickNewCat((c) => ({
                      ...c,
                      id: v.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
                    }))
                  }
                  placeholder="e.g. pizza"
                />
                <CatField
                  label="Naziv *"
                  value={quickNewCat.label}
                  onChange={(v) => {
                    setQuickNewCat((c) => ({
                      ...c,
                      label: v,
                      id:
                        c.id ||
                        v
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-|-$/g, ""),
                    }));
                  }}
                  placeholder="e.g. Pizza"
                />
                <div>
                  <label className="block text-[10px] font-bold text-muted adm-text-muted uppercase tracking-wider mb-2">Boja</label>
                  <div className="flex flex-wrap gap-1.5">
                    {colorPresets.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setQuickNewCat((c) => ({ ...c, color }))}
                        className={clsx(
                          "w-7 h-7 rounded-lg bg-gradient-to-br transition-all",
                          color,
                          quickNewCat.color === color ? "ring-2 ring-offset-1 ring-dark scale-110" : "hover:scale-105"
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border adm-border adm-surface-2/50 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowProductCatModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border adm-border text-[13px] font-bold text-dark adm-text hover:adm-surface adm-border border transition"
                >
                  Odustani
                </button>
                <button
                  type="button"
                  onClick={saveQuickCategory}
                  disabled={!quickNewCat.label.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-primary to-amber-500 text-white text-[13px] font-bold hover:brightness-105 transition disabled:opacity-40 shadow-glow"
                >
                  Kreiraj i koristi
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Live Preview Panel ── */}
      {showPreview && (
        <div className="hidden lg:flex flex-col shrink-0 border-l border adm-border adm-surface adm-border border sticky top-0 h-[calc(100vh-64px)] w-[340px] xl:w-[420px]">
          <LivePreview
            pageContent={pageContent}
            componentStyles={componentStyles}
            layoutConfig={layoutConfig}
            venueSlug={venue as string}
          />
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string | number; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-muted adm-text-muted uppercase tracking-wider mb-2">{label}</label>
      <input
        type={type}
        step={type === "number" ? "0.01" : undefined}
        min={type === "number" ? "0" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 adm-bg rounded-2xl text-sm text-dark adm-text border border-primary/10 focus:border-primary focus:adm-surface adm-border border focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:adm-text-faint"
      />
    </div>
  );
}

function CatField({ label, value, onChange, placeholder }: { label?: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      {label && <label className="block text-[10px] font-bold text-muted adm-text-muted uppercase tracking-wider mb-2">{label}</label>}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 adm-bg rounded-xl text-sm text-dark adm-text border border-primary/10 focus:border-primary focus:adm-surface adm-border border focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:adm-text-faint"
      />
    </div>
  );
}
