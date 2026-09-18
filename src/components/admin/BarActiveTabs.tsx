"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Wine, Check } from "lucide-react";
import type { OpenTabRow, TabItemRow } from "@/services/tabService";
import { isFiredTabItem } from "@/lib/order-stations";
import {
  isBarSoundMuted,
  playBarChime,
} from "@/lib/bar-notification-sound";
import clsx from "clsx";

function clearedKey(restaurantId: string) {
  return `bar-cleared-tabs-${restaurantId}`;
}

function loadCleared(restaurantId: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(clearedKey(restaurantId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    // Old format was a tab-id array and hid the whole ticket forever.
    if (Array.isArray(parsed) || !parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

function saveCleared(restaurantId: string, map: Record<string, string>) {
  sessionStorage.setItem(clearedKey(restaurantId), JSON.stringify(map));
}

function itemFiredAt(item: TabItemRow): number {
  const raw = item.fired_at || item.created_at;
  const t = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

function barItemsForTab(tab: OpenTabRow): TabItemRow[] {
  return (tab.tab_items ?? []).filter(isFiredTabItem);
}

function tabHasBarWork(tab: OpenTabRow, clearedAt: string | undefined): boolean {
  const items = barItemsForTab(tab);
  if (items.length === 0) return false;
  if (!clearedAt) return true;
  const clearedMs = new Date(clearedAt).getTime();
  return items.some((item) => itemFiredAt(item) > clearedMs);
}

export default function BarActiveTabs({
  restaurantId,
  tabs,
}: {
  restaurantId: string;
  tabs: OpenTabRow[];
}) {
  const [cleared, setCleared] = useState<Record<string, string>>(() =>
    loadCleared(restaurantId)
  );
  const knownItemIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    setCleared(loadCleared(restaurantId));
    initializedRef.current = false;
    knownItemIdsRef.current = new Set();
  }, [restaurantId]);

  const barTabs = useMemo(
    () => tabs.filter((tab) => tabHasBarWork(tab, cleared[tab.id])),
    [tabs, cleared]
  );

  useEffect(() => {
    const visibleItems = barTabs.flatMap((tab) => barItemsForTab(tab));
    if (!initializedRef.current) {
      visibleItems.forEach((item) => knownItemIdsRef.current.add(item.id));
      initializedRef.current = true;
      return;
    }

    let newFired = false;
    for (const item of visibleItems) {
      if (!knownItemIdsRef.current.has(item.id)) {
        knownItemIdsRef.current.add(item.id);
        newFired = true;
      }
    }
    if (
      newFired &&
      document.visibilityState === "visible" &&
      !isBarSoundMuted()
    ) {
      playBarChime();
    }
  }, [barTabs]);

  const markClear = (tabId: string) => {
    const next = { ...cleared, [tabId]: new Date().toISOString() };
    setCleared(next);
    saveCleared(restaurantId, next);
  };

  return (
    <section className="mt-8 border-t border adm-border pt-8">
      <div className="flex items-center gap-2 mb-4">
        <Wine size={18} className="text-purple-600" />
        <h2 className="text-lg font-extrabold text-dark adm-text">Aktivne kartice (šank)</h2>
      </div>
      {barTabs.length === 0 ? (
        <div className="text-center adm-surface adm-border border rounded-xl border p-6">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted adm-text-muted mb-2">
            Konobar / šanker kartice
          </p>
          <p className="text-sm text-muted adm-text-muted">Nema aktivnih kartica za šank.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {barTabs.map((tab) => {
            const barItems = barItemsForTab(tab);
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
                      <span className="font-semibold shrink-0">
                        {Number(i.total_price).toFixed(2)}
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
