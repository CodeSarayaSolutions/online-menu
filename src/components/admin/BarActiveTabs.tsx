"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Wine, Check } from "lucide-react";
import * as tabService from "@/services/tabService";
import type { OpenTabRow } from "@/services/tabService";
import clsx from "clsx";

function clearedKey(restaurantId: string) {
  return `bar-cleared-tabs-${restaurantId}`;
}

function loadCleared(restaurantId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(clearedKey(restaurantId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveCleared(restaurantId: string, ids: Set<string>) {
  sessionStorage.setItem(clearedKey(restaurantId), JSON.stringify(Array.from(ids)));
}

export default function BarActiveTabs({ restaurantId }: { restaurantId: string }) {
  const [tabs, setTabs] = useState<OpenTabRow[]>([]);
  const [itemsByTab, setItemsByTab] = useState<Record<string, Awaited<ReturnType<typeof tabService.getTabWithItems>>>>({});
  const [cleared, setCleared] = useState<Set<string>>(() => loadCleared(restaurantId));
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const open = await tabService.getOpenTabs(restaurantId);
      setTabs(open);
      const details: Record<string, Awaited<ReturnType<typeof tabService.getTabWithItems>>> = {};
      await Promise.all(
        open.map(async (t) => {
          details[t.id] = await tabService.getTabWithItems(t.id);
        })
      );
      setItemsByTab(details);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    setCleared(loadCleared(restaurantId));
    void refresh();
  }, [restaurantId, refresh]);

  useEffect(() => {
    return tabService.subscribeToTabs(restaurantId, {
      onTabChange: () => void refresh(),
      onItemChange: () => void refresh(),
    });
  }, [restaurantId, refresh]);

  const barTabs = useMemo(() => {
    return tabs.filter((tab) => {
      if (cleared.has(tab.id)) return false;
      const detail = itemsByTab[tab.id];
      const items = detail?.tab_items ?? [];
      return items.some(
        (i) => i.fire_status === "fired" && (i.station === "bar" || i.station === "both")
      );
    });
  }, [tabs, itemsByTab, cleared]);

  const markClear = (tabId: string) => {
    const next = new Set(cleared);
    next.add(tabId);
    setCleared(next);
    saveCleared(restaurantId, next);
  };

  if (loading) {
    return (
      <div className="py-8 text-center text-muted adm-text-muted text-sm">Učitavanje kartica…</div>
    );
  }

  return (
    <section className="mt-8 border-t border adm-border pt-8">
      <div className="flex items-center gap-2 mb-4">
        <Wine size={18} className="text-purple-600" />
        <h2 className="text-lg font-extrabold text-dark adm-text">Aktivne kartice (bar)</h2>
      </div>
      {barTabs.length === 0 ? (
        <div className="text-center adm-surface adm-border border rounded-xl border p-6">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted adm-text-muted mb-2">
            Konobar kartice
          </p>
          <p className="text-sm text-muted adm-text-muted">Nema aktivnih kartica za bar.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {barTabs.map((tab) => {
            const detail = itemsByTab[tab.id];
            const barItems = (detail?.tab_items ?? []).filter(
              (i) => i.fire_status === "fired" && (i.station === "bar" || i.station === "both")
            );
            const tableLabel = tab.table_label;

            return (
              <div
                key={tab.id}
                className="adm-surface adm-border border rounded-2xl border-purple-100 shadow-soft p-4"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-extrabold text-dark adm-text">{tableLabel}</h3>
                    <p className="text-[11px] text-muted adm-text-muted">{tab.waiter_name}</p>
                  </div>
                  <span className="text-sm font-bold text-primary">
                    {Number(tab.total).toFixed(2)} KM
                  </span>
                </div>
                <ul className="space-y-1 mb-4 text-sm">
                  {barItems.map((i) => (
                    <li key={i.id} className="flex justify-between text-dark adm-text">
                      <span>
                        {i.quantity}× {i.product_name}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => markClear(tab.id)}
                  className={clsx(
                    "w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5",
                    "bg-purple-50 text-purple-800 hover:bg-purple-100 transition"
                  )}
                >
                  <Check size={14} /> Jasno
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
