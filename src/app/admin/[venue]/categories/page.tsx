"use client";

import { useState } from "react";
import { Plus, Trash2, Save, Check, ChevronUp, ChevronDown, X, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams } from "next/navigation";
import { useCmsStore } from "@/store/cmsStore";
import { CategoryInfo } from "@/types/cms";
import clsx from "clsx";

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

export default function CategoriesEditor() {
  const { venue } = useParams<{ venue: string }>();
  const categories = useCmsStore((s) => s.categories);
  const addCategory = useCmsStore((s) => s.addCategory);
  const updateCategory = useCmsStore((s) => s.updateCategory);
  const removeCategory = useCmsStore((s) => s.removeCategory);
  const reorderCategories = useCmsStore((s) => s.reorderCategories);
  const products = useCmsStore((s) => s.products);
  const saveActiveToAllRestaurants = useCmsStore((s) => s.saveActiveToAllRestaurants);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CategoryInfo | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newCat, setNewCat] = useState<CategoryInfo>({
    id: "", label: "", icon: "", color: "from-amber-400 to-orange-500",
  });
  const [saved, setSaved] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const startEdit = (cat: CategoryInfo) => { setEditingId(cat.id); setEditForm({ ...cat }); };
  const cancelEdit = () => { setEditingId(null); setEditForm(null); };

  const saveEdit = () => {
    if (editingId && editForm) {
      updateCategory(editingId, { ...editForm, icon: (editForm.icon ?? "").trim() });
      setTimeout(() => saveActiveToAllRestaurants(venue), 0);
      setSaved(editingId);
      setTimeout(() => setSaved(null), 1200);
      cancelEdit();
    }
  };

  const handleAdd = () => {
    if (!newCat.id || !newCat.label) return;
    addCategory({ ...newCat, icon: (newCat.icon ?? "").trim() });
    setTimeout(() => saveActiveToAllRestaurants(venue), 0);
    setSaved(newCat.id);
    setTimeout(() => setSaved(null), 1200);
    setNewCat({ id: "", label: "", icon: "", color: "from-amber-400 to-orange-500" });
    setShowAdd(false);
  };

  const handleDelete = (id: string) => { removeCategory(id); setTimeout(() => saveActiveToAllRestaurants(venue), 0); setConfirmDelete(null); };

  const moveCategory = (index: number, direction: "up" | "down") => {
    const arr = [...categories];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= arr.length) return;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    reorderCategories(arr);
    setTimeout(() => saveActiveToAllRestaurants(venue), 0);
  };

  const isSpecial = (id: string) => id === "all" || id === "popular";

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-dark adm-text tracking-tight">Vrste</h1>
          <p className="text-sm text-muted adm-text-muted mt-1">{categories.length} vrsti ukupno</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-primary to-amber-500 text-white px-4 py-2.5 rounded-2xl text-sm font-bold hover:brightness-105 transition shadow-glow"
        >
          <Plus size={16} />
          Nova vrsta
        </button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="adm-surface adm-border border rounded-2xl border-2 border-primary/30 p-6 shadow-card">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[15px] font-extrabold text-dark adm-text">Kreiraj vrstu</h3>
                <button onClick={() => setShowAdd(false)} className="p-1.5 rounded-xl hover:bg-[var(--adm-surface-2)] text-muted adm-text-muted transition"><X size={16} /></button>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <InputField label="ID (mala slova)" value={newCat.id} onChange={(v) => setNewCat((c) => ({ ...c, id: v.toLowerCase().replace(/\s/g, "-") }))} placeholder="npr. morski-plodovi" />
                <InputField label="Naziv za prikaz" value={newCat.label} onChange={(v) => setNewCat((c) => ({ ...c, label: v }))} placeholder="npr. Morski plodovi" />
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-muted adm-text-muted uppercase tracking-wider mb-2">Boja</label>
                  <div className="flex flex-wrap gap-1.5">
                    {colorPresets.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewCat((c) => ({ ...c, color }))}
                        className={clsx("w-7 h-7 rounded-xl bg-gradient-to-br transition-all", color, newCat.color === color ? "ring-2 ring-offset-2 ring-dark scale-110" : "hover:scale-105")}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-2xl border border-primary/10 text-sm font-semibold text-dark adm-text hover:bg-[var(--adm-surface-2)] transition">Odustani</button>
                <button onClick={handleAdd} disabled={!newCat.id || !newCat.label} className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-primary to-amber-500 text-white text-sm font-bold hover:brightness-105 transition disabled:opacity-40 shadow-glow">Kreiraj</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category list */}
      <div className="space-y-2">
        {categories.map((cat, index) => {
          const isEditing = editingId === cat.id;
          const productCount = products.filter((p) => p.category.toLowerCase() === cat.id).length;

          return (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03, duration: 0.3 }}
              className={clsx(
                "adm-surface adm-border border rounded-2xl border transition-all duration-200",
                isEditing ? "border-primary/40 shadow-card ring-1 ring-primary/20" : saved === cat.id ? "border-accent-green/40 bg-green-50/30" : "border-primary/5 hover:shadow-soft shadow-soft"
              )}
            >
              {isEditing && editForm ? (
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-extrabold text-dark adm-text">Uređivanje: {cat.label}</h4>
                    <button onClick={cancelEdit} className="p-1.5 rounded-xl hover:bg-[var(--adm-surface-2)] text-muted adm-text-muted transition"><X size={14} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <InputField label="Naziv za prikaz" value={editForm.label} onChange={(v) => setEditForm((f) => f ? { ...f, label: v } : f)} placeholder="npr. Morski plodovi" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted adm-text-muted uppercase tracking-wider mb-2">Boja</label>
                    <div className="flex flex-wrap gap-1.5">
                      {colorPresets.map((color) => (
                        <button
                          key={color}
                          onClick={() => setEditForm((f) => f ? { ...f, color } : f)}
                          className={clsx("w-7 h-7 rounded-xl bg-gradient-to-br transition-all", color, editForm.color === color ? "ring-2 ring-offset-2 ring-dark scale-110" : "hover:scale-105")}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button onClick={cancelEdit} className="flex-1 py-2.5 rounded-2xl border border-primary/10 text-sm font-semibold text-dark adm-text hover:bg-[var(--adm-surface-2)] transition">Odustani</button>
                    <button onClick={saveEdit} className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-primary to-amber-500 text-white text-sm font-bold hover:brightness-105 flex items-center justify-center gap-2 shadow-glow">
                      <Save size={14} /> Spremi
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4">
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button onClick={() => moveCategory(index, "up")} disabled={index === 0} className="p-0.5 rounded adm-text-faint hover:text-primary disabled:opacity-20 transition">
                      <ChevronUp size={14} />
                    </button>
                    <button onClick={() => moveCategory(index, "down")} disabled={index === categories.length - 1} className="p-0.5 rounded adm-text-faint hover:text-primary disabled:opacity-20 transition">
                      <ChevronDown size={14} />
                    </button>
                  </div>

                  <div className={clsx("w-10 h-10 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white text-lg shrink-0 shadow-sm", cat.color)}>
                    {cat.icon?.trim() ? cat.icon : (
                      <span className="text-sm font-bold">{cat.label.charAt(0).toUpperCase()}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-dark adm-text">{cat.label}</p>
                    <p className="text-[11px] text-muted adm-text-muted">
                      {isSpecial(cat.id) ? <span className="text-primary font-medium">Sistem</span> : `${productCount} ${productCount !== 1 ? "stavki" : "stavka"}`}
                    </p>
                  </div>

                  {saved === cat.id && <Check size={18} className="text-accent-green shrink-0" strokeWidth={3} />}

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => startEdit(cat)} className="p-2 rounded-xl text-muted adm-text-muted hover:text-primary hover:bg-primary/10 transition">
                      <Pencil size={14} />
                    </button>
                    {!isSpecial(cat.id) && (
                      confirmDelete === cat.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(cat.id)} className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-accent-red text-white hover:brightness-110 transition">Obriši</button>
                          <button onClick={() => setConfirmDelete(null)} className="px-2 py-1.5 rounded-xl text-[11px] text-muted adm-text-muted hover:bg-[var(--adm-surface-2)] transition">Ne</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete(cat.id)} className="p-2 rounded-xl adm-text-faint hover:text-accent-red hover:bg-red-50 transition">
                          <Trash2 size={14} />
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder }: { label?: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      {label && <label className="block text-[10px] font-bold text-muted adm-text-muted uppercase tracking-wider mb-2">{label}</label>}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 adm-bg rounded-2xl text-sm text-dark adm-text border border-primary/10 focus:border-primary focus:adm-surface adm-border border focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:adm-text-faint"
      />
    </div>
  );
}
