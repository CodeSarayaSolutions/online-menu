"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutGrid, HandPlatter } from "lucide-react";
import * as tableService from "@/services/tableService";
import * as tabService from "@/services/tabService";
import type { OpenTabRow } from "@/services/tabService";
import type { Tables } from "@/types/supabase";
import { useAuthStore } from "@/store/authStore";
import clsx from "clsx";

type TableRow = Tables<"restaurant_tables">;

export default function WaiterFloorPage() {
  const params = useParams();
  const router = useRouter();
  const venueSlug = typeof params.venue === "string" ? params.venue : "";
  const currentUser = useAuthStore((s) => s.getCurrentUser());

  const [tables, setTables] = useState<TableRow[]>([]);
  const [openTabs, setOpenTabs] = useState<OpenTabRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmTable, setConfirmTable] = useState<TableRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!venueSlug) return;
    try {
      const [t, tabs] = await Promise.all([
        tableService.getTables(venueSlug),
        tabService.getOpenTabs(venueSlug),
      ]);
      setTables(t);
      setOpenTabs(tabs);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Učitavanje nije uspjelo");
    } finally {
      setLoading(false);
    }
  }, [venueSlug]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!venueSlug) return;
    return tabService.subscribeToTabs(venueSlug, {
      onTabChange: () => void refresh(),
      onItemChange: () => void refresh(),
    });
  }, [venueSlug, refresh]);

  const tabForTable = (tableId: string) =>
    openTabs.find((tab) => tab.table_id === tableId);

  const handleTableTap = (table: TableRow) => {
    const tab = tabForTable(table.id);
    if (tab) {
      if (tab.waiter_id === currentUser?.id) {
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

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto pb-24">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
          <HandPlatter size={22} className="text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-dark adm-text">Konobar</h1>
          <p className="text-xs text-muted adm-text-muted">Odaberite stol za novu ili postojeću karticu</p>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2 mb-4">{error}</p>
      )}

      {tables.length === 0 ? (
        <div className="adm-surface adm-border border rounded-2xl border p-10 text-center text-muted adm-text-muted text-sm">
          Nema aktivnih stolova. Vlasnik treba dodati stolove u sekciji Stolovi.
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
                  occupied
                    ? mine
                      ? "border-primary bg-primary/5"
                      : "border-red-300 bg-red-50/80"
                    : "border-emerald-200 adm-surface adm-border border hover:border-emerald-400"
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
                <span className="font-extrabold text-dark adm-text text-lg leading-tight">{label}</span>
                {occupied ? (
                  <>
                    <span className="text-[11px] text-muted adm-text-muted mt-1">
                      {tab?.waiter_name ?? "Konobar"} · {Number(tab?.total ?? 0).toFixed(2)} KM
                    </span>
                    {!mine && (
                      <span className="text-[10px] text-red-600 font-semibold mt-1">Samo pregled</span>
                    )}
                  </>
                ) : (
                  <span className="text-[11px] font-medium mt-1" style={{ color: "var(--adm-success)" }}>Slobodan</span>
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      {confirmTable && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-end sm:items-center justify-center p-4">
          <div className="adm-surface adm-border border rounded-3xl p-6 w-full max-w-sm shadow-elevated">
            <h3 className="text-lg font-extrabold text-dark adm-text mb-2">Otvoriti karticu?</h3>
            <p className="text-sm text-muted adm-text-muted mb-6">
              Stol <strong>{confirmTable.label}</strong> — započinjete novu narudžbu.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmTable(null)}
                className="flex-1 py-3 rounded-xl border font-bold text-sm"
              >
                Odustani
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void startTab()}
                className="flex-1 py-3 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-50"
              >
                Otvori
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
