"use client";

import { useCallback, useEffect, useState } from "react";
import * as orderService from "@/services/orderService";
import { orderRowToOrder } from "@/lib/orders/map";
import type { Order, OrderStatus } from "@/types/order";

export function useOrders(restaurantId: string | null) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionKey, setSubscriptionKey] = useState(0);

  const refresh = useCallback(async () => {
    if (!restaurantId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await orderService.getOrders(restaurantId);
      setOrders(rows.map(orderRowToOrder));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, subscriptionKey]);

  const reconnect = useCallback(() => {
    setSubscriptionKey((key) => key + 1);
  }, []);

  const refreshAndReconnect = useCallback(async () => {
    await refresh();
    reconnect();
  }, [refresh, reconnect]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!restaurantId) return;

    return orderService.subscribeToOrders(restaurantId, {
      onInsert: (row) =>
        setOrders((prev) => {
          const next = orderRowToOrder(row);
          if (prev.some((o) => o.id === next.id)) return prev;
          return [next, ...prev];
        }),
      onUpdate: (row) =>
        setOrders((prev) =>
          prev.map((o) => (o.id === row.id ? orderRowToOrder(row) : o))
        ),
      onDelete: ({ id }) => setOrders((prev) => prev.filter((o) => o.id !== id)),
    });
  }, [restaurantId]);

  const updateStatus = useCallback(async (orderId: string, status: OrderStatus) => {
    await orderService.updateOrderStatus(orderId, status);
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
