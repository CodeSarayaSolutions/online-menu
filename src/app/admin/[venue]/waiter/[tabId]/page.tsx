"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Minus, Plus, Search, X, CreditCard, Banknote } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCmsStore } from "@/store/cmsStore";
import { useAuthStore } from "@/store/authStore";
import * as tabService from "@/services/tabService";
import * as authService from "@/services/authService";
import type { TabWithItems } from "@/services/tabService";
import type { ProductItem } from "@/types/cms";
import type { ProductStation } from "@/types/auth";
import clsx from "clsx";

export default function WaiterTabPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const venueSlug = typeof params.venue === "string" ? params.venue : "";
  const tabId = typeof params.tabId === "string" ? params.tabId : "";
  const readonly = searchParams.get("readonly") === "1";

  const products = useCmsStore((s) => s.products);
  const categories = useCmsStore((s) => s.categories);
  const currentUser = useAuthStore((s) => s.getCurrentUser());
  const logout = useAuthStore((s) => s.logout);

  const [tab, setTab] = useState<TabWithItems | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showPay, setShowPay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canEdit =
    !readonly &&
    !!currentUser &&
    tab?.waiter_id === currentUser.id &&
    tab?.status === "open";

  const menuCategories = useMemo(() => {
    const labels = categories
      .filter((c) => c.id !== "all" && c.id !== "popular")
      .map((c) => c.label);
    const fromProducts = products.map((p) => p.category).filter(Boolean);
    return Array.from(new Set([...labels, ...fromProducts]));
  }, [categories, products]);

  const load = useCallback(async () => {
    if (!tabId) return;
    try {
      const data = await tabService.getTabWithItems(tabId);
      setTab(data);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Učitavanje kartice nije uspjelo");
    } finally {
      setLoading(false);
    }
  }, [tabId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!venueSlug) return;
    return tabService.subscribeToTabs(venueSlug, {
      onTabChange: () => void load(),
      onItemChange: () => void load(),
    });
  }, [venueSlug, load]);

  const productsByCategory = useMemo(() => {
    const q = search.toLowerCase();
    const map = new Map<string, ProductItem[]>();
    for (const cat of menuCategories) {
      const items = products.filter(
        (p) =>
          p.category === cat &&
          (!q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
      );
      if (items.length) map.set(cat, items);
    }
    return map;
  }, [menuCategories, products, search]);

  const addProduct = async (p: ProductItem) => {
    if (!canEdit || !tab) return;
    setBusy(true);
    try {
      const station = (p.station ?? "bar") as ProductStation;
      await tabService.addItemToTab(tab.id, {
        productId: p.id,
        productName: p.name,
        unitPrice: p.price,
        quantity: 1,
        station: station === "kitchen" ? "kitchen" : station === "both" ? "both" : "bar",
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dodavanje nije uspjelo");
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (itemId: string) => {
    if (!canEdit || !tab) return;
    try {
      await tabService.removeItemFromTab(itemId, tab.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Uklanjanje nije uspjelo");
    }
  };

  const handleGotovo = () => {
    void (async () => {
      try {
        await authService.signOut();
      } catch {
        /* ignore */
      }
      logout();
      router.replace("/admin/login");
    })();
  };

  const closeWithPayment = async (method: "cash" | "card") => {
    if (!tab || !canEdit) return;
    setBusy(true);
    try {
      const res = await fetch("/api/tabs/close", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabId: tab.id, paymentMethod: method }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Naplata nije uspjela");
        return;
      }
      router.replace(`/admin/${venueSlug}/waiter`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Naplata nije uspjela");
    } finally {
      setBusy(false);
      setShowPay(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!tab) {
    return (
      <div className="p-6 text-center text-muted adm-text-muted">
        Kartica nije pronađena.
        <button
          type="button"
          className="block mx-auto mt-4 text-primary font-bold"
          onClick={() => router.push(`/admin/${venueSlug}/waiter`)}
        >
          Nazad
        </button>
      </div>
    );
  }

  const tableLabel = tab.table_label;
  const items = tab.tab_items ?? [];

  const actionBarHeight = canEdit ? 88 : 0;

  return (
    <div
      className="flex flex-col min-h-[calc(100vh-64px)]"
      style={{ paddingBottom: `calc(40vh + ${actionBarHeight}px)` }}
    >
      <header className="sticky top-0 z-20 adm-surface adm-border border border-b px-4 py-3">
        <h1 className="font-extrabold text-dark adm-text truncate">{tableLabel}</h1>
        <p className="text-[11px] text-muted adm-text-muted">
          {tab.waiter_name} · {readonly ? "Pregled" : "Aktivna kartica"}
        </p>
      </header>

      {error && (
        <p className="mx-4 mt-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="px-4 py-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted adm-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pretraži jelovnik..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border adm-border text-sm"
            disabled={!canEdit}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-6">
        {Array.from(productsByCategory.entries()).map(([cat, list]) => (
          <section key={cat}>
            <h2 className="text-xs font-bold text-muted adm-text-muted uppercase tracking-wider mb-2">{cat}</h2>
            <div className="space-y-2">
              {list.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 adm-surface adm-border border rounded-xl border border adm-border p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-dark adm-text text-sm truncate">{p.name}</p>
                    <p className="text-xs text-primary font-bold">{p.price.toFixed(2)} KM</p>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void addProduct(p)}
                      className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold"
                    >
                      <Plus size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div
        className={clsx(
          "fixed left-0 right-0 lg:left-[272px] adm-surface adm-border border border-t shadow-elevated z-30 max-h-[40vh] flex flex-col",
          canEdit ? "bottom-[88px]" : "bottom-0"
        )}
      >
        <div className="px-4 py-2 border-b flex justify-between items-center">
          <span className="text-xs font-bold text-muted adm-text-muted uppercase">Stavke na kartici</span>
          <span className="text-lg font-extrabold text-dark adm-text">{Number(tab.total).toFixed(2)} KM</span>
        </div>
        <div className="overflow-y-auto flex-1 divide-y">
          {items.length === 0 ? (
            <p className="text-center text-muted adm-text-muted text-sm py-6">Nema stavki</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex items-center gap-2 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-dark adm-text truncate">{item.product_name}</p>
                  <p className="text-[11px] text-muted adm-text-muted">
                    {item.quantity}× {Number(item.unit_price).toFixed(2)} KM
                  </p>
                </div>
                <span className="text-sm font-bold">{Number(item.total_price).toFixed(2)}</span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => void removeItem(item.id)}
                    className="p-1.5 rounded-lg text-muted adm-text-muted hover:text-red-600"
                  >
                    <Minus size={16} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {canEdit && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-[272px] z-40 p-4 adm-bg border-t adm-border flex gap-3">
          <button
            type="button"
            onClick={handleGotovo}
            className="flex-1 min-h-[56px] rounded-xl border-2 border-primary text-primary bg-transparent text-base font-bold"
          >
            GOTOVO
          </button>
          <button
            type="button"
            onClick={() => setShowPay(true)}
            disabled={items.length === 0 || busy}
            className="flex-1 min-h-[56px] rounded-xl bg-gradient-to-r from-primary to-amber-500 text-white text-base font-bold disabled:opacity-40"
          >
            Naplati
          </button>
        </div>
      )}

      <AnimatePresence>
        {showPay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="adm-surface adm-border border rounded-3xl p-6 w-full max-w-sm"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-extrabold">Način plaćanja</h3>
                <button type="button" onClick={() => setShowPay(false)}>
                  <X size={20} />
                </button>
              </div>
              <p className="text-2xl font-extrabold text-center mb-6">{Number(tab.total).toFixed(2)} KM</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void closeWithPayment("cash")}
                  className="flex flex-col items-center gap-2 py-4 rounded-2xl border-2 border-emerald-200 hover:bg-emerald-50 font-bold text-sm"
                >
                  <Banknote size={24} className="text-emerald-600" />
                  Gotovina
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void closeWithPayment("card")}
                  className="flex flex-col items-center gap-2 py-4 rounded-2xl border-2 border-blue-200 hover:bg-blue-50 font-bold text-sm"
                >
                  <CreditCard size={24} className="text-blue-600" />
                  Kartica
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
