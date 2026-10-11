"use client";

import { useUiText } from "@/hooks/useUiText";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutGrid, HandPlatter } from "lucide-react";
import * as tableService from "@/services/tableService";
import * as tabService from "@/services/tabService";
import * as authService from "@/services/authService";
import type { OpenTabRow, WaiterBacklogTab } from "@/services/tabService";
import type { Tables } from "@/types/supabase";
import { useAuthStore } from "@/store/authStore";
import clsx from "clsx";

type TableRow = Tables<"restaurant_tables">;

export default function WaiterFloorPage() {
  const uiText = useUiText();
  const params = useParams();
  const router = useRouter();
  const venueSlug = typeof params.venue === "string" ? params.venue : "";
  const currentUser = useAuthStore((s) => s.getCurrentUser());
  const logout = useAuthStore((s) => s.logout);

  const [tables, setTables] = useState<TableRow[]>([]);
  const [openTabs, setOpenTabs] = useState<OpenTabRow[]>([]);
  const [backlogTabs, setBacklogTabs] = useState<WaiterBacklogTab[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmTable, setConfirmTable] = useState<TableRow | null>(null);
  const [confirmEndShift, setConfirmEndShift] = useState(false);
  const [showBacklogSheet, setShowBacklogSheet] = useState(false);
  const [selectedBacklogIds, setSelectedBacklogIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!venueSlug) return;
    try {
      if (currentUser) {
        try {
          const cleanup = await fetch("/api/tabs/discard-empty", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ restaurantId: venueSlug }),
          });
          if (!cleanup.ok) {
            const data = (await cleanup.json().catch(() => null)) as { error?: string } | null;
            console.warn("[waiter] stale empty tab cleanup failed", data?.error ?? cleanup.status);
          }
        } catch (cleanupError) {
          console.warn("[waiter] stale empty tab cleanup failed", cleanupError);
        }
      }
      const [t, tabs, backlog] = await Promise.all([
        tableService.getTables(venueSlug),
        tabService.getOpenTabs(venueSlug),
        currentUser
          ? tabService.getBacklogForWaiter(venueSlug, currentUser.id)
          : Promise.resolve([]),
      ]);
      setTables(t);
      setOpenTabs(tabs);
      setBacklogTabs(backlog);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Učitavanje nije uspjelo");
    } finally {
      setLoading(false);
    }
  }, [venueSlug, currentUser]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;

    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await navigator.wakeLock.request("screen");
        }
      } catch {
        // Wake lock not available
      }
    };

    void requestWakeLock();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") void requestWakeLock();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      void wakeLock?.release();
    };
  }, []);

  useEffect(() => {
    if (!venueSlug) return;
    return tabService.subscribeToTabs(venueSlug, {
      onTabChange: () => void refresh(),
      onItemChange: () => void refresh(),
    });
  }, [venueSlug, refresh]);

  const tabForTable = (tableId: string) =>
    openTabs.find((tab) => tab.table_id === tableId);

  const allBacklogItems = useMemo(
    () =>
      backlogTabs.flatMap((tab) =>
        tab.tab_items.map((item) => ({
          ...item,
          table_label: tab.table_label,
          tab_id: tab.id,
        }))
      ),
    [backlogTabs]
  );

  const allBacklogIds = useMemo(
    () => allBacklogItems.map((item) => item.id),
    [allBacklogItems]
  );

  const groupedBacklog = useMemo(
    () =>
      backlogTabs.map((tab) => ({
        tabId: tab.id,
        tableLabel: tab.table_label,
        items: tab.tab_items,
      })),
    [backlogTabs]
  );

  const openBacklogSheet = () => {
    setSelectedBacklogIds(new Set(allBacklogIds));
    setShowBacklogSheet(true);
  };

  const toggleBacklogItem = (itemId: string) => {
    setSelectedBacklogIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const activateSelectedBacklog = async () => {
    const ids = Array.from(selectedBacklogIds);
    if (ids.length === 0) return;
    setBusy(true);
    setError("");
    try {
      await tabService.activateTabItems(ids);
      setShowBacklogSheet(false);
      setSelectedBacklogIds(new Set());
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Aktiviranje nije uspjelo");
    } finally {
      setBusy(false);
    }
  };

  const handleTableTap = (table: TableRow) => {
    if (!currentUser) return;
    const tab = tabForTable(table.id);
    if (tab) {
      if (tab.waiter_id === currentUser.id || !tab.waiter_id) {
        router.push(`/admin/${venueSlug}/waiter/${tab.id}`);
        return;
      }
      router.push(`/admin/${venueSlug}/waiter/${tab.id}?readonly=1`);
      return;
    }
    setConfirmTable(table);
  };

  const startTab = async () => {
    if (!confirmTable || !currentUser) return;
    setBusy(true);
    try {
      const tab = await tabService.openTab(venueSlug, confirmTable.id, currentUser.id);
      setConfirmTable(null);
      router.push(`/admin/${venueSlug}/waiter/${tab.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Otvaranje kartice nije uspjelo");
    } finally {
      setBusy(false);
    }
  };

  const endShift = async () => {
    try {
      await authService.signOut();
    } catch {
      /* ignore */
    }
    logout();
    setConfirmEndShift(false);
    router.replace("/admin/login");
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center adm-bg">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto pb-24 adm-bg min-h-[calc(100vh-64px)]">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <HandPlatter size={22} className="text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold text-dark adm-text">{uiText("Konobar")}</h1>
            <p className="text-xs text-muted adm-text-muted truncate">
              {currentUser?.name ?? "—"} {uiText("· Odaberite stol")}
            </p>
          </div>
        </div>
        <div className="shrink-0">
          {confirmEndShift ? (
            <div className="adm-surface adm-border border rounded-xl p-2 text-right max-w-[200px]">
              <p className="text-[11px] font-semibold adm-text mb-2">{uiText("Završiti smjenu?")}</p>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => void endShift()}
                  className="px-2 py-1 text-[11px] font-bold text-red-600"
                >
                  {uiText("Da")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmEndShift(false)}
                  className="px-2 py-1 text-[11px] font-bold adm-text-muted"
                >
                  {uiText("Ne")}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmEndShift(true)}
              className="px-3 py-2 min-h-[44px] rounded-xl adm-border border text-[11px] font-semibold text-muted adm-text-muted"
            >
              {uiText("Završi smjenu")}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2 mb-4">{error}</p>
      )}

      {tables.length === 0 ? (
        <div className="adm-surface adm-border border rounded-2xl p-10 text-center text-muted adm-text-muted text-sm">
          {uiText("Nema aktivnih stolova. Vlasnik treba dodati stolove u sekciji Stolovi.")}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {tables.map((table) => {
            const tab = tabForTable(table.id);
            const occupied = !!tab;
            const mine = tab?.waiter_id === currentUser?.id;
            const label = tab?.table_label ?? table.label;

            return (
              <motion.button
                key={table.id}
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => handleTableTap(table)}
                className={clsx(
                  "rounded-2xl border-2 p-4 text-left transition shadow-soft min-h-[120px] flex flex-col",
                  tab?.origin === "guest" ? "border-sky-500 bg-sky-50" : occupied
                    ? mine
                      ? "border-primary bg-primary/5"
                      : "border-red-300 bg-red-50/80"
                    : "border-emerald-200 adm-surface adm-border hover:border-emerald-400"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <LayoutGrid size={16} className={occupied ? "text-red-500" : "text-emerald-600"} />
                  <span
                    className={clsx(
                      "w-2.5 h-2.5 rounded-full",
                      occupied ? "bg-red-500" : "bg-emerald-500"
                    )}
                  />
                </div>
                <span className="font-extrabold text-dark adm-text text-lg leading-tight">
                  {label}
                </span>
                {tab?.origin === "guest" && <span className="text-xs font-bold text-sky-700 mt-1">{tab.waiter_id ? uiText("Narudžba gosta") : uiText("Nova narudžba gosta · preuzmi")}</span>}
                {occupied ? (
                  <>
                    <span className="text-[11px] text-muted adm-text-muted mt-1">
                      {tab?.waiter_name ?? "Konobar"} · {Number(tab?.total ?? 0).toFixed(2)} KM
                    </span>
                    {!mine && tab?.waiter_id && (
                      <span className="text-[10px] text-red-600 font-semibold mt-1">
                        {uiText("Pregled stola")}
                      </span>
                    )}
                  </>
                ) : (
                  <span
                    className="text-[11px] font-medium mt-1"
                    style={{ color: "var(--adm-success)" }}
                  >
                    {uiText("Slobodan")}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      {confirmTable && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-end sm:items-center justify-center p-4">
          <div className="adm-surface adm-border border rounded-3xl p-6 w-full max-w-sm shadow-elevated">
            <h3 className="text-lg font-extrabold text-dark adm-text mb-2">{uiText("Otvoriti karticu?")}</h3>
            <p className="text-sm text-muted adm-text-muted mb-6">
              {uiText("Stol")} <strong>{confirmTable.label}</strong> {uiText("— započinjete novu narudžbu.")}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmTable(null)}
                className="flex-1 py-3 min-h-[44px] rounded-xl border font-bold text-sm adm-text"
              >
                {uiText("Odustani")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void startTab()}
                className="flex-1 py-3 min-h-[44px] rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-50"
              >
                {uiText("Otvori")}
              </button>
            </div>
          </div>
        </div>
      )}

      {allBacklogItems.length > 0 && (
        <div className="fixed left-0 right-0 bottom-0 lg:left-[272px] z-50 p-4 adm-bg border-t adm-border">
          <button
            type="button"
            onClick={openBacklogSheet}
            className="w-full min-h-[54px] rounded-2xl bg-amber-500 text-white text-sm font-extrabold shadow-elevated"
          >
            {uiText("Na čekanju:")} {allBacklogItems.length} {uiText("stavki — Aktiviraj")}
          </button>
        </div>
      )}

      {showBacklogSheet && (
        <div className="fixed inset-0 bg-black/50 z-[110] flex items-end justify-center p-0 sm:p-4">
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="adm-surface adm-border border rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[82vh] flex flex-col shadow-elevated"
          >
            <div className="px-5 py-4 border-b adm-border">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-extrabold text-dark adm-text">{uiText("Na čekanju")}</h3>
                  <p className="text-xs text-muted adm-text-muted">
                    {uiText("Odaberite stavke koje šaljete na bar.")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBacklogSheet(false)}
                  className="text-sm font-bold adm-text-muted min-h-[36px] px-2"
                >
                  {uiText("Zatvori")}
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
              {groupedBacklog.map((group) => (
                <section key={group.tabId}>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider adm-text-muted mb-2">
                    {group.tableLabel}
                  </h4>
                  <div className="space-y-2">
                    {group.items.map((item) => {
                      const checked = selectedBacklogIds.has(item.id);
                      return (
                        <label
                          key={item.id}
                          className={clsx(
                            "flex items-center gap-3 rounded-xl border adm-border p-3 cursor-pointer",
                            checked ? "bg-amber-50 border-amber-200" : "adm-surface"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleBacklogItem(item.id)}
                            className="h-5 w-5 accent-amber-500"
                          />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-bold text-dark adm-text truncate">
                              {item.quantity}× {item.product_name}
                            </span>
                            <span className="block text-[11px] text-muted adm-text-muted">
                              {Number(item.total_price).toFixed(2)} KM
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            <div className="p-5 border-t adm-border">
              <button
                type="button"
                disabled={busy || selectedBacklogIds.size === 0}
                onClick={() => void activateSelectedBacklog()}
                className="w-full min-h-[52px] rounded-2xl bg-gradient-to-r from-primary to-amber-500 text-white text-sm font-extrabold disabled:opacity-50"
              >
                {uiText("Pošalji na bar (")}{selectedBacklogIds.size})
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
