"use client";

import { productCategoryId } from "@/lib/category-identity";
import { useUiText } from "@/hooks/useUiText";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Minus, Plus, Search, X, CreditCard, Banknote } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCmsStore } from "@/store/cmsStore";
import { useAuthStore } from "@/store/authStore";
import { useHappyHourPricing } from "@/hooks/useHappyHourPricing";
import * as tabService from "@/services/tabService";
import * as authService from "@/services/authService";
import type { TabWithItems } from "@/services/tabService";
import type { ProductItem } from "@/types/cms";
import type { ProductStation } from "@/types/auth";
import clsx from "clsx";
import { performAction } from "@/services/actionService";
import { getRestaurantRole } from "@/lib/permissions";
import { useOperationalText } from "@/hooks/useOperationalText";

export default function WaiterTabPage() {
  const uiText = useUiText();
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
  const { prices: happyHourPrices } = useHappyHourPricing(venueSlug);

  const t = useOperationalText();
  const [intervention, setIntervention] = useState(false);
  const [showIntervention, setShowIntervention] = useState(false);
  const role = getRestaurantRole(currentUser, venueSlug);
  const canIntervene = currentUser?.platformRole === "admin" || role === "owner" || role === "manager";

  const [tab, setTab] = useState<TabWithItems | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showPay, setShowPay] = useState(false);
  const [showEmptyExitConfirm, setShowEmptyExitConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fireMode, setFireMode] = useState<"fired" | "backlog">("fired");

  const canEdit =
    !!currentUser &&
    ((!readonly && tab?.waiter_id === currentUser.id) || (canIntervene && intervention)) &&
    tab?.status === "open";

  const menuCategories = useMemo(() => {
    const labels = categories
      .filter((c) => c.id !== "all" && c.id !== "popular")
      .map((c) => c.id);
    const fromProducts = products.map((p) => productCategoryId(p,categories) ?? `legacy:${p.category}`).filter(Boolean);
    return Array.from(new Set([...labels, ...fromProducts]));
  }, [categories, products]);

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

  const load = useCallback(async () => {
    if (!tabId) return;
    try {
      const data = await tabService.getTabWithItems(tabId);
      setTab(data);
      setError("");
    } catch (e) {
      setError(t("Učitavanje nije uspjelo. Pokušajte ponovo.", "Could not load this bill. Please try again."));
    } finally {
      setLoading(false);
    }
  }, [tabId]);

  useEffect(() => {
    if (tab?.id===tabId && tab.status==='open' && tab.waiter_id && tab.waiter_id!==currentUser?.id && canIntervene) setShowIntervention(true);
  }, [tabId, tab?.id, tab?.waiter_id, canIntervene, currentUser?.id]);

  useEffect(() => { setIntervention(false); setShowIntervention(false); }, [tabId]);

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
      const items = pricedProducts.filter(
        (p) =>
          (productCategoryId(p,categories) ?? `legacy:${p.category}`) === cat &&
          (!q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
      );
      if (items.length) map.set(cat, items);
    }
    return map;
  }, [menuCategories, pricedProducts, search]);

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
        fireStatus: fireMode,
      }, intervention);
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
      await tabService.removeItemFromTab(itemId, tab.id, intervention);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Uklanjanje nije uspjelo");
    }
  };

  const activateBacklogItems = async (itemIds: string[]) => {
    if (!canEdit || itemIds.length === 0) return;
    setBusy(true);
    setError("");
    try {
      await tabService.activateTabItems(itemIds, intervention);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Aktiviranje nije uspjelo");
    } finally {
      setBusy(false);
    }
  };

  const signOutAndExit = () => {
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

  const discardEmptyAndExit = () => {
    void (async () => {
      if (!tab || !currentUser) return;
      setBusy(true);
      setError("");
      try {
        const res = await fetch("/api/tabs/discard-empty", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tabId: tab.id, intervention }),
        });
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          throw new Error(data?.error ?? "Prazna kartica nije odbačena");
        }
        try {
          await authService.signOut();
        } catch {
          /* ignore */
        }
        logout();
        router.replace("/admin/login");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Prazna kartica nije odbačena");
      } finally {
        setBusy(false);
        setShowEmptyExitConfirm(false);
      }
    })();
  };

  const handleGotovo = () => {
    if (!tab?.tab_items?.length) {
      setShowEmptyExitConfirm(true);
      return;
    }
    signOutAndExit();
  };

  const closeWithPayment = async (method: "cash" | "card") => {
    if (!tab || !canEdit) return;
    setBusy(true);
    try {
      await tabService.closeTab(tab.id, method, intervention);
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
        {uiText("Kartica nije pronađena.")}
        <button
          type="button"
          className="block mx-auto mt-4 text-primary font-bold"
          onClick={() => router.push(`/admin/${venueSlug}/waiter`)}
        >
          {uiText("Nazad")}
        </button>
      </div>
    );
  }

  const tableLabel = tab.table_label;
  const items = tab.tab_items ?? [];
  const backlogItems = items.filter((item) => item.fire_status === "backlog");
  const backlogItemIds = backlogItems.map((item) => item.id);

  const actionBarHeight = canEdit ? (backlogItems.length > 0 ? 152 : 88) : 0;

  return (
    <div
      className="flex flex-col min-h-[calc(100vh-64px)]"
      style={{ paddingBottom: `calc(40vh + ${actionBarHeight}px)` }}
    >
      <header className="sticky top-0 z-20 adm-surface adm-border border border-b px-4 py-3">
        <h1 className="font-extrabold text-dark adm-text truncate">{tableLabel}</h1>
        <p className="text-[11px] text-muted adm-text-muted">
          {tab.waiter_name} · {readonly ? uiText("Pregled stola") : uiText("Aktivna kartica")}
        </p>
      </header>

      {tab.status === "open" && tab.waiter_id && tab.waiter_id !== currentUser?.id && canIntervene && !intervention && (
        <button onClick={() => setShowIntervention(true)} className="mx-4 mt-3 min-h-[48px] rounded-xl border border-amber-400 bg-amber-50 text-amber-900 font-bold">{t("Intervencija na računu", "Intervene on this bill")}</button>
      )}
      {tab.status === "open" && !tab.waiter_id && (
        <button disabled={busy} onClick={() => { setBusy(true); void performAction("tab.claim", venueSlug, { tabId: tab.id }).then(() => { router.replace(`/admin/${venueSlug}/waiter/${tab.id}`); return load(); }).catch(() => setError(t("Stol trenutno nije dostupan. Pokušajte ponovo.", "This table is unavailable. Please try again."))).finally(() => setBusy(false)); }} className="mx-4 mt-3 min-h-[48px] rounded-xl bg-sky-600 text-white font-bold">{t("Preuzmi posluživanje", "Take responsibility for this table")}</button>
      )}
      {intervention && <p className="mx-4 mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t("Intervencija se bilježi pod vašim imenom. Odgovornost za račun ostaje konobaru.", "Your changes are logged under your name. The assigned waiter remains responsible for this bill.")}</p>}
      {showIntervention && <div className="fixed inset-0 z-[120] bg-black/50 grid place-items-center p-4"><section role="dialog" aria-modal="true" aria-labelledby="intervention-title" className="adm-surface rounded-2xl p-5 max-w-sm space-y-4"><h2 id="intervention-title" className="font-bold text-lg">{t("Intervencija na računu", "Intervene on this bill")}</h2><p>{t("Za ovaj račun odgovoran je", "This bill is assigned to")} <strong>{tab.waiter_name}</strong>. {t("Vaš ulazak i sve promjene bit će zabilježeni pod vašim imenom. Konobar ostaje odgovoran za račun.", "Your entry and changes will be logged under your name. The waiter remains responsible for this bill.")}</p><button disabled={busy} className="w-full min-h-[48px] bg-primary text-white rounded-xl font-bold" onClick={() => { setBusy(true); void performAction("tab.enter", venueSlug, { tabId: tab.id, intervention: true }).then(() => { setIntervention(true); setShowIntervention(false); }).catch(() => setError(t("Pokušajte ponovo.", "Please try again."))).finally(() => setBusy(false)); }}>{t("Razumijem, nastavi", "I understand, continue")}</button><button className="w-full min-h-[44px]" onClick={() => { setShowIntervention(false); router.push(`/admin/${venueSlug}/waiter`); }}>{t("Odustani", "Cancel")}</button></section></div>}
      {error && (
        <p className="mx-4 mt-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      {canEdit && (
        <div className="px-4 pt-3">
          <div className="grid grid-cols-2 rounded-xl adm-surface adm-border border p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setFireMode("fired")}
              className={clsx(
                "min-h-[40px] rounded-lg transition",
                fireMode === "fired"
                  ? "bg-primary text-white shadow-soft"
                  : "text-muted adm-text-muted"
              )}
            >
              {uiText("Pošalji odmah")}
            </button>
            <button
              type="button"
              onClick={() => setFireMode("backlog")}
              className={clsx(
                "min-h-[40px] rounded-lg transition",
                fireMode === "backlog"
                  ? "bg-amber-500 text-white shadow-soft"
                  : "text-muted adm-text-muted"
              )}
            >
              {uiText("Odgodi")}
            </button>
          </div>
        </div>
      )}

      <div className="px-4 py-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted adm-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={uiText("Pretraži jelovnik...")}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border adm-border text-sm"
            disabled={!canEdit}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-6">
        {Array.from(productsByCategory.entries()).map(([cat, list]) => (
          <section key={cat}>
            <h2 className="text-xs font-bold text-muted adm-text-muted uppercase tracking-wider mb-2">{categories.find(c=>c.id===cat)?.label ?? uiText("Bez vrste")}</h2>
            <div className="space-y-2">
              {list.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 adm-surface adm-border border rounded-xl border border adm-border p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-dark adm-text text-sm truncate">{p.name}</p>
                    <p className="text-xs text-primary font-bold">
                      {p.originalPrice !== undefined && (
                        <span className="mr-1 text-muted adm-text-muted line-through">
                          {p.originalPrice.toFixed(2)}
                        </span>
                      )}
                      {p.price.toFixed(2)} KM
                      {p.happyHourPrice !== undefined && (
                        <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] uppercase">
                          HH
                        </span>
                      )}
                    </p>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`${t("Dodaj", "Add")} ${p.name}`}
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
        className="fixed left-0 right-0 lg:left-[272px] adm-surface adm-border border border-t shadow-elevated z-30 max-h-[40vh] flex flex-col"
        style={{ bottom: `${actionBarHeight}px` }}
      >
        <div className="px-4 py-2 border-b flex justify-between items-center">
          <span className="text-xs font-bold text-muted adm-text-muted uppercase">{uiText("Stavke na kartici")}</span>
          <span className="text-lg font-extrabold text-dark adm-text">{Number(tab.total).toFixed(2)} KM</span>
        </div>
        <div className="overflow-y-auto flex-1 divide-y">
          {items.length === 0 ? (
            <p className="text-center text-muted adm-text-muted text-sm py-6">{uiText("Nema stavki")}</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex items-center gap-2 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-dark adm-text truncate">{item.product_name}</p>
                  <p className="text-[11px] text-muted adm-text-muted">
                    {item.quantity}× {Number(item.unit_price).toFixed(2)} KM
                  </p>
                  {item.fire_status === "backlog" && (
                    <span className="inline-flex mt-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      {uiText("Na čekanju")}
                    </span>
                  )}
                </div>
                <span className="text-sm font-bold">{Number(item.total_price).toFixed(2)}</span>
                {canEdit && (
                  <button
                    type="button"
                    aria-label={`${t("Ukloni", "Remove")} ${item.product_name}`}
                    disabled={busy}
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
        <div className="fixed bottom-0 left-0 right-0 lg:left-[272px] z-40 p-4 adm-bg border-t adm-border space-y-3">
          {backlogItems.length > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void activateBacklogItems(backlogItemIds)}
              className="w-full min-h-[48px] rounded-xl bg-amber-500 text-white text-sm font-extrabold disabled:opacity-50"
            >
              {uiText("Aktiviraj sve na čekanju (")}{backlogItems.length})
            </button>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleGotovo}
              className="flex-1 min-h-[56px] rounded-xl border-2 border-primary text-primary bg-transparent text-base font-bold"
            >
              {uiText("GOTOVO")}
            </button>
            <button
              type="button"
              onClick={() => setShowPay(true)}
              disabled={items.length === 0 || busy}
              className="flex-1 min-h-[56px] rounded-xl bg-gradient-to-r from-primary to-amber-500 text-white text-base font-bold disabled:opacity-40"
            >
              {uiText("Naplati")}
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showEmptyExitConfirm && (
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
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-extrabold">{uiText("Stol nema narudžbi")}</h3>
                <button type="button" onClick={() => setShowEmptyExitConfirm(false)}>
                  <X size={20} />
                </button>
              </div>
              <p className="text-sm text-muted adm-text-muted mb-5">
                {uiText("Stol nema narudžbi. Jeste li sigurni da želite izaći?")}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShowEmptyExitConfirm(false)}
                  className="min-h-[48px] rounded-xl border adm-border text-sm font-bold adm-text"
                >
                  {uiText("Ostani")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={discardEmptyAndExit}
                  className="min-h-[48px] rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50"
                >
                  {uiText("Izađi")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

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
                <h3 className="text-lg font-extrabold">{uiText("Način plaćanja")}</h3>
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
                  {uiText("Gotovina")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void closeWithPayment("card")}
                  className="flex flex-col items-center gap-2 py-4 rounded-2xl border-2 border-blue-200 hover:bg-blue-50 font-bold text-sm"
                >
                  <CreditCard size={24} className="text-blue-600" />
                  {uiText("Kartica")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
