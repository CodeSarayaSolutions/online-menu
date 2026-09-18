"use client";

import { useCallback, useEffect, useState } from "react";
import * as orderService from "@/services/orderService";
import * as tabService from "@/services/tabService";
import { orderRowToOrder } from "@/lib/orders/map";
import { isCloneSale } from "@/lib/orders/clones";
import type { Order, OrderStatus } from "@/types/order";
import type { OpenTabRow } from "@/services/tabService";
import type { OrderRow as GuestOrderRow } from "@/services/orderService";

type StationLiveResponse = {
  orders?: GuestOrderRow[];
  tabs?: OpenTabRow[];
  error?: string;
};

type LedgerResponse = {
  orders?: GuestOrderRow[];
  error?: string;
};

export type OrdersFeed = "station" | "ledger";

const STATION_POLL_MS = 4000;
const LEDGER_POLL_MS = 8000;

function toDisplayOrders(rows: GuestOrderRow[]): Order[] {
  return rows.filter((row) => !isCloneSale(row)).map(orderRowToOrder);
}

export function useOrders(
  restaurantId: string | null,
  options?: { feed?: OrdersFeed }
) {
  const feed = options?.feed ?? "station";
  const [orders, setOrders] = useState<Order[]>([]);
  const [tabs, setTabs] = useState<OpenTabRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionKey, setSubscriptionKey] = useState(0);

  const refresh = useCallback(async () => {
    if (!restaurantId) {
      setOrders([]);
      setTabs([]);
      setLoading(false);
      return;
    }
    try {
      if (feed === "ledger") {
        const res = await fetch(
          `/api/orders?restaurantId=${encodeURIComponent(restaurantId)}`,
          { credentials: "include" }
        );
        const data = (await res.json().catch(() => null)) as LedgerResponse | null;
        if (!res.ok) {
          throw new Error(data?.error ?? "Učitavanje narudžbi nije uspjelo");
        }
        setOrders(toDisplayOrders(data?.orders ?? []));
        setTabs([]);
      } else {
        const res = await fetch(
          `/api/stations/live?restaurantId=${encodeURIComponent(restaurantId)}`,
          { credentials: "include" }
        );
        const data = (await res.json().catch(() => null)) as StationLiveResponse | null;
        if (!res.ok) {
          throw new Error(data?.error ?? "Učitavanje narudžbi nije uspjelo");
        }
        setOrders(toDisplayOrders(data?.orders ?? []));
        setTabs(data?.tabs ?? []);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, feed]);

  const reconnect = useCallback(() => {
    setSubscriptionKey((key) => key + 1);
  }, []);

  const refreshAndReconnect = useCallback(async () => {
    await refresh();
    reconnect();
  }, [refresh, reconnect]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!restaurantId) return;
    const id = window.setInterval(() => {
      void refresh();
    }, feed === "ledger" ? LEDGER_POLL_MS : STATION_POLL_MS);
    return () => window.clearInterval(id);
  }, [restaurantId, refresh, feed]);

  useEffect(() => {
    if (!restaurantId) return;

    const onOrders = {
      onInsert: (row: GuestOrderRow) => {
        if (isCloneSale(row)) return;
        setOrders((prev) => {
          const next = orderRowToOrder(row);
          if (prev.some((o) => o.id === next.id)) return prev;
          return [next, ...prev];
        });
      },
      onUpdate: (row: GuestOrderRow) => {
        if (isCloneSale(row)) {
          setOrders((prev) => prev.filter((o) => o.id !== row.id));
          return;
        }
        setOrders((prev) =>
          prev.map((o) => (o.id === row.id ? orderRowToOrder(row) : o))
        );
      },
      onDelete: ({ id }: { id: string }) =>
        setOrders((prev) => prev.filter((o) => o.id !== id)),
    };

    const unsubOrders = orderService.subscribeToOrders(restaurantId, onOrders);
    const unsubTabs =
      feed === "station"
        ? tabService.subscribeToTabs(restaurantId, {
            onTabChange: () => void refresh(),
            onItemChange: () => void refresh(),
          })
        : () => undefined;

    return () => {
      unsubOrders();
      unsubTabs();
    };
  }, [restaurantId, subscriptionKey, refresh, feed]);

  const updateStatus = useCallback(async (orderId: string, status: OrderStatus) => {
    const res = await fetch("/api/orders/status", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, status }),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      throw new Error(data?.error ?? "Status nije ažuriran");
    }
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status } : o))
    );
  }, []);

  const removeOrder = useCallback(async (orderId: string) => {
    await orderService.deleteOrder(orderId);
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
  }, []);

  const clearAllOrders = useCallback(async () => {
    if (!restaurantId) return;
    await orderService.clearAllOrders(restaurantId);
    setOrders([]);
  }, [restaurantId]);

  return {
    orders,
    tabs,
    loading,
    error,
    refresh,
    reconnect,
    refreshAndReconnect,
    updateStatus,
    removeOrder,
    clearAllOrders,
  };
}
