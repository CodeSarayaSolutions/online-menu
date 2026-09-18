"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useOrders } from "@/hooks/useOrders";
import { isFiredTabItem } from "@/lib/order-stations";
import { isPersistedGuestOrder, tabIdFromViewTicket } from "@/lib/orders/clones";
import { itemFiredAt, viewTicketsFromTabs } from "@/lib/orders/tab-view-tickets";
import type { OrderStatus } from "@/types/order";

function ackKey(restaurantId: string, mode: "bar" | "kitchen") {
  return `station-acked-${mode}-${restaurantId}`;
}

function loadAcked(restaurantId: string, mode: "bar" | "kitchen"): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(ackKey(restaurantId, mode));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

function saveAcked(
  restaurantId: string,
  mode: "bar" | "kitchen",
  map: Record<string, string>
) {
  sessionStorage.setItem(ackKey(restaurantId, mode), JSON.stringify(map));
}

export function useStationBoard(restaurantId: string | null, mode: "bar" | "kitchen") {
  const station = useOrders(restaurantId, { feed: "station" });
  const [ackedAtByTabId, setAckedAtByTabId] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!restaurantId) {
      setAckedAtByTabId({});
      return;
    }
    setAckedAtByTabId(loadAcked(restaurantId, mode));
  }, [restaurantId, mode]);

  const viewTickets = useMemo(
    () => viewTicketsFromTabs(station.tabs, mode, ackedAtByTabId),
    [station.tabs, mode, ackedAtByTabId]
  );

  const boardOrders = useMemo(
    () => [...viewTickets, ...station.orders.filter(isPersistedGuestOrder)],
    [viewTickets, station.orders]
  );

  const updateStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      const tabId = tabIdFromViewTicket(orderId);
      if (tabId) {
        if (!restaurantId) return;
        const tab = station.tabs.find((row) => row.id === tabId);
        const latestFired = Math.max(
          Date.now(),
          ...(tab?.tab_items ?? []).filter(isFiredTabItem).map(itemFiredAt)
        );
        const stamp = new Date(latestFired).toISOString();
        setAckedAtByTabId((prev) => {
          const next = { ...prev, [tabId]: stamp };
          saveAcked(restaurantId, mode, next);
          return next;
        });
        return;
      }
      await station.updateStatus(orderId, status);
    },
    [restaurantId, mode, station]
  );

  return {
    ...station,
    orders: boardOrders,
    updateStatus,
  };
}
