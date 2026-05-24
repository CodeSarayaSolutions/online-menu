"use client";

import { useState } from "react";
import {
  Plus, Trash2, Save, Search, X, Pencil, Flame,
  Image as ImageIcon, Package, Check, Sparkles,
  ArrowUp, ArrowDown, ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCmsStore } from "@/store/cmsStore";
import { ProductItem, Addon, Variation, VariationOption } from "@/types/cms";
import clsx from "clsx";

const blankProduct = (): ProductItem => ({
  id: `p${Date.now()}`,
  restaurantId: "1",
  name: "",
  description: "",
  price: 0,
  image: "",
  category: "Pizza",
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

const blankVariation = (): Variation => ({
  id: `v${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  name: "",
  required: true,
  options: [blankVariationOption()],
});

export default function ProductsEditor() {
  const products = useCmsStore((s) => s.products);
  const categories = useCmsStore((s) => s.categories);
  const addProduct = useCmsStore((s) => s.addProduct);
  const updateProduct = useCmsStore((s) => s.updateProduct);
  const removeProduct = useCmsStore((s) => s.removeProduct);
  const reorderProducts = useCmsStore((s) => s.reorderProducts);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const menuCategories = categories.filter((c) => c.id !== "all" && c.id !== "popular").map((c) => c.label);

  const startAdd = (category?: string) => {
    const p = blankProduct();
    if (category) p.category = category;
    setEditingProduct(p);
    setIsNew(true);
  };
  const startEdit = (p: ProductItem) => {
    setEditingProduct({
      ...p,
      addons: p.addons ? [...p.addons.map((a) => ({ ...a }))] : [],
      variations: p.variations ? p.variations.map((v) => ({ ...v, options: v.options.map((o) => ({ ...o })) })) : [],
    });
    setIsNew(false);
  };
  const cancelEdit = () => { setEditingProduct(null); setIsNew(false); };

  const saveProduct = () => {
    if (!editingProduct || !editingProduct.name || !editingProduct.price) return;
    if (isNew) addProduct(editingProduct);
    else updateProduct(editingProduct.id, editingProduct);
    setSaved(editingProduct.id);
    setTimeout(() => setSaved(null), 1500);
    cancelEdit();
  };

  const handleDelete = (id: string) => {
    removeProduct(id);
    setConfirmDelete(null);
    if (editingProduct?.id === id) cancelEdit();
  };

  const addAddon = () => {
    if (!editingProduct) return;
    setEditingProduct({ ...editingProduct, addons: [...(editingProduct.addons || []), blankAddon()] });
  };

  const updateAddonField = (addonId: string, field: keyof Addon, value: string | number) => {
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
  };

  /* ---- Filtered products for the grouped list ---- */
  const matchesSearch = (p: ProductItem) =>
    !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.description.toLowerCase().includes(searchQuery.toLowerCase());

  const matchesCategory = (catLabel: string) =>
    filterCategory === "all" || catLabel.toLowerCase() === categories.find((c) => c.id === filterCategory)?.label.toLowerCase();

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-dark adm-text tracking-tight">Products</h1>
          <p className="text-sm text-muted adm-text-muted mt-1">{products.length} items in your menu</p>
        </div>
        <button onClick={() => startAdd()} className="flex items-center gap-2 bg-gradient-to-r from-primary to-amber-500 text-white px-5 py-2.5 rounded-2xl text-sm font-bold hover:brightness-105 transition shadow-glow shrink-0">
          <Plus size={16} /> Add Product
        </button>
      </div>

      {/* Search & filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 adm-text-faint" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
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
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-4 py-2.5 adm-surface adm-border border rounded-2xl text-sm text-dark adm-text border border-primary/10 focus:border-primary outline-none min-w-[160px] shadow-soft"
        >
          <option value="all">All Categories</option>
          {categories.filter((c) => c.id !== "all" && c.id !== "popular").map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
          ))}
        </select>
      </div>

      {/* Edit form */}
      <AnimatePresence>
        {editingProduct && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="adm-surface adm-border border rounded-2xl border-2 border-primary/30 p-6 mb-6 shadow-card"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Package size={16} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-[15px] font-extrabold text-dark adm-text">{isNew ? "New Product" : "Edit Product"}</h3>
                  {!isNew && <p className="text-[11px] text-muted adm-text-muted">{editingProduct.name}</p>}
                </div>
              </div>
              <button onClick={cancelEdit} className="p-2 rounded-xl hover:bg-[var(--adm-surface-2)] text-muted adm-text-muted transition"><X size={16} /></button>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
              <div className="lg:w-52 shrink-0">
                <div className="w-full aspect-square lg:aspect-auto lg:h-52 rounded-2xl adm-bg overflow-hidden flex items-center justify-center border-2 border-dashed border-primary/15">
                  {editingProduct.image ? (
                    <img src={editingProduct.image} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-4">
                      <ImageIcon size={28} className="adm-text-faint mx-auto mb-2" />
                      <p className="text-[11px] text-muted adm-text-muted">Add image URL below</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Name *" value={editingProduct.name} onChange={(v) => setEditingProduct({ ...editingProduct, name: v })} placeholder="e.g. Margherita Pizza" />
                  <Field label="Price (KM) *" type="number" value={editingProduct.price || ""} onChange={(v) => setEditingProduct({ ...editingProduct, price: parseFloat(v) || 0 })} placeholder="12.99" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted adm-text-muted uppercase tracking-wider mb-2">Description</label>
                  <textarea
                    value={editingProduct.description}
                    onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                    rows={2}
                    placeholder="Describe the dish..."
                    className="w-full px-3.5 py-2.5 adm-bg rounded-2xl text-sm text-dark adm-text border border-primary/10 focus:border-primary focus:adm-surface adm-border border focus:ring-4 focus:ring-primary/10 outline-none resize-none transition-all placeholder:adm-text-faint"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Image URL" value={editingProduct.image} onChange={(v) => setEditingProduct({ ...editingProduct, image: v })} placeholder="https://images.unsplash.com/..." />
                  <div>
                    <label className="block text-[10px] font-bold text-muted adm-text-muted uppercase tracking-wider mb-2">Category</label>
                    <select
                      value={editingProduct.category}
                      onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                      className="w-full px-3.5 py-2.5 adm-bg rounded-2xl text-sm text-dark adm-text border border-primary/10 focus:border-primary outline-none transition-all"
                    >
                      {menuCategories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                </div>

                <label className="flex items-center gap-3 py-2 cursor-pointer group">
                  <div
                    className={clsx("w-11 h-6 rounded-full transition-all relative cursor-pointer", editingProduct.popular ? "bg-primary" : "adm-bg border border-primary/10")}
                    onClick={() => setEditingProduct({ ...editingProduct, popular: !editingProduct.popular })}
                  >
                    <div className={clsx("absolute top-0.5 w-5 h-5 adm-surface adm-border border rounded-full shadow-md transition-all", editingProduct.popular ? "left-[22px]" : "left-0.5")} />
                  </div>
                  <span className="text-sm font-medium text-dark adm-text flex items-center gap-1.5">
                    <Flame size={14} className={editingProduct.popular ? "text-primary" : "adm-text-faint"} />
                    Mark as Popular
                  </span>
                </label>
              </div>
            </div>

            {/* Addons */}
            <div className="mt-6 border-t border-bg pt-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-primary/50" />
                  <h4 className="text-xs font-bold text-muted adm-text-muted uppercase tracking-wider">Add-ons / Extras</h4>
                </div>
                <button onClick={addAddon} className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:brightness-110 transition">
                  <Plus size={14} /> Add Extra
                </button>
              </div>
              {(editingProduct.addons || []).length === 0 ? (
                <p className="text-xs text-muted adm-text-muted italic py-2">No add-ons yet. Add customization options for this product.</p>
              ) : (
                <div className="space-y-2">
                  {(editingProduct.addons || []).map((addon) => (
                    <div key={addon.id} className="flex items-center gap-3 adm-bg rounded-2xl p-3 border border-primary/5">
                      <input
                        value={addon.name}
                        onChange={(e) => updateAddonField(addon.id, "name", e.target.value)}
                        placeholder="Addon name"
                        className="flex-1 px-3 py-2 adm-surface adm-border border rounded-xl text-sm text-dark adm-text border border-primary/10 focus:border-primary outline-none transition"
                      />
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
                      <button onClick={() => removeAddon(addon.id)} className="p-1.5 rounded-xl adm-text-faint hover:text-accent-red hover:bg-red-50 transition">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Variations */}
            <div className="mt-6 border-t border-bg pt-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Package size={14} className="text-accent-blue/50" />
                  <h4 className="text-xs font-bold text-muted adm-text-muted uppercase tracking-wider">Variations</h4>
                  <span className="text-[10px] adm-text-muted">(e.g. Size, Flavor)</span>
                </div>
                <button onClick={addVariation} className="flex items-center gap-1.5 text-xs font-semibold text-accent-blue hover:brightness-110 transition">
                  <Plus size={14} /> Add Variation
                </button>
              </div>
              {(editingProduct.variations || []).length === 0 ? (
                <p className="text-xs text-muted adm-text-muted italic py-2">No variations. Add size, flavor, or other options customers choose from.</p>
              ) : (
                <div className="space-y-4">
                  {(editingProduct.variations || []).map((variation) => (
                    <div key={variation.id} className="adm-bg rounded-2xl p-4 border border-primary/5">
                      <div className="flex items-center gap-3 mb-3">
                        <input
                          value={variation.name}
                          onChange={(e) => updateVariationField(variation.id, "name", e.target.value)}
                          placeholder="Variation name (e.g. Size)"
                          className="flex-1 px-3 py-2 adm-surface adm-border border rounded-xl text-sm text-dark adm-text font-semibold border border-primary/10 focus:border-primary outline-none transition"
                        />
                        <label className="flex items-center gap-1.5 text-xs text-muted adm-text-muted whitespace-nowrap cursor-pointer">
                          <input
                            type="checkbox"
                            checked={variation.required}
                            onChange={(e) => updateVariationField(variation.id, "required", e.target.checked)}
                            className="w-3.5 h-3.5 accent-primary"
                          />
                          Required
                        </label>
                        <button onClick={() => removeVariation(variation.id)} className="p-1.5 rounded-xl adm-text-faint hover:text-accent-red hover:bg-red-50 transition">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="space-y-2">
                        {variation.options.map((opt) => (
                          <div key={opt.id} className="flex items-center gap-2 pl-2">
                            <span className="adm-text-faint text-xs">•</span>
                            <input
                              value={opt.label}
                              onChange={(e) => updateVariationOption(variation.id, opt.id, "label", e.target.value)}
                              placeholder="Option label (e.g. Small)"
                              className="flex-1 px-3 py-1.5 adm-surface adm-border border rounded-lg text-sm text-dark adm-text border border-primary/10 focus:border-primary outline-none transition"
                            />
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted adm-text-muted">+KM</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={opt.priceAdjustment || ""}
                                onChange={(e) => updateVariationOption(variation.id, opt.id, "priceAdjustment", parseFloat(e.target.value) || 0)}
                                placeholder="0.00"
                                className="w-16 px-2 py-1.5 adm-surface adm-border border rounded-lg text-sm text-dark adm-text border border-primary/10 focus:border-primary outline-none transition"
                              />
                            </div>
                            <button
                              onClick={() => removeVariationOption(variation.id, opt.id)}
                              disabled={variation.options.length <= 1}
                              className={clsx("p-1 rounded-lg transition", variation.options.length <= 1 ? "adm-text-faint cursor-not-allowed" : "adm-text-faint hover:text-accent-red hover:bg-red-50")}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => addVariationOption(variation.id)}
                        className="mt-2 ml-4 flex items-center gap-1 text-[11px] font-medium text-primary/70 hover:text-primary transition"
                      >
                        <Plus size={11} /> Add option
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={cancelEdit} className="flex-1 py-3 rounded-2xl border border-primary/10 text-sm font-semibold text-dark adm-text hover:bg-[var(--adm-surface-2)] transition">Cancel</button>
              <button
                onClick={saveProduct}
                disabled={!editingProduct.name || !editingProduct.price}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-primary to-amber-500 text-white text-sm font-bold hover:brightness-105 transition disabled:opacity-40 flex items-center justify-center gap-2 shadow-glow"
              >
                <Save size={15} /> {isNew ? "Add Product" : "Save Changes"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                <span className="text-xs text-muted adm-text-muted ml-auto">{catProducts.length} item{catProducts.length !== 1 ? "s" : ""}</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); startAdd(cat); if (collapsedCategories.has(cat)) toggleCategory(cat); }}
                className="px-3 py-2 mr-3 my-1 flex items-center gap-1 rounded-xl text-xs font-semibold text-primary hover:bg-primary/10 transition shrink-0"
                title={`Add product to ${cat}`}
              >
                <Plus size={13} /> Add
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
                        className="p-1.5 rounded-lg text-muted adm-text-muted hover:text-primary hover:bg-primary/10 transition"
                        title="Edit"
                      >
                        <Pencil size={14} />
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
        {menuCategories.every((cat) => {
          if (!matchesCategory(cat)) return true;
          return getProductsByCategory(cat).filter(matchesSearch).length === 0;
        }) && (
          <div className="text-center py-20 adm-surface adm-border border rounded-2xl shadow-soft border border-primary/5">
            <Package size={40} className="adm-text-faint mx-auto mb-3" />
            <p className="text-muted adm-text-muted text-sm font-medium">No products found</p>
            <p className="adm-text-faint text-xs mt-1">Try a different search or category filter</p>
          </div>
        )}
      </div>
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
