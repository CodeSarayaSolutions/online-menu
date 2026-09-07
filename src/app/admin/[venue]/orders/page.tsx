"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clock,
  ChefHat,
  CheckCircle2,
  Utensils,
  XCircle,
  Trash2,
  Eye,
  X,
  Package,
  MapPin,
  MessageSquare,
  ShoppingBag,
  AlertTriangle,
  Filter,
  RefreshCw,
  Download,
  CreditCard,
  Banknote,
  User,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams } from "next/navigation";
import { useOrders } from "@/hooks/useOrders";
import { Order, OrderStatus } from "@/types/order";
import type { OpenTabRow } from "@/services/tabService";
import { useAuthStore } from "@/store/authStore";
import clsx from "clsx";

type DateRangeKey = "today" | "week" | "custom";

function tabPaymentLabel(method: string | null | undefined): string {
  const m = (method ?? "").toLowerCase();
  if (m === "card" || m === "kartica") return "Kartica";
  if (m === "cash" || m === "gotovina") return "Gotovina";
  return "—";
}

function isTabCardPayment(method: string | null | undefined): boolean {
  const m = (method ?? "").toLowerCase();
  return m === "card" || m === "kartica";
}

function rangeBounds(
  key: DateRangeKey,
  customFrom: string,
  customTo: string
): { from: Date; to: Date } {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  if (key === "today") {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }
  if (key === "week") {
    const from = new Date();
    from.setDate(from.getDate() - 7);
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }
  const from = customFrom ? new Date(`${customFrom}T00:00:00`) : new Date(0);
  const end = customTo ? new Date(`${customTo}T23:59:59`) : to;
  return { from, to: end };
}

function inRange(iso: string, from: Date, to: Date) {
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t <= to.getTime();
}

/* ── Status config ───────────────────────────────── */
const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; icon: typeof Clock; color: string; bg: string; ring: string }
> = {
  pending: {
    label: "Pending",
    icon: Clock,
    color: "text-amber-600",
    bg: "bg-amber-50",
    ring: "ring-amber-200",
  },
  preparing: {
    label: "Preparing",
    icon: ChefHat,
    color: "text-blue-600",
    bg: "bg-blue-50",
    ring: "ring-blue-200",
  },
  ready: {
    label: "Ready",
    icon: CheckCircle2,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    ring: "ring-emerald-200",
  },
  served: {
    label: "Served",
    icon: Utensils,
    color: "adm-text-muted",
    bg: "adm-surface-2",
    ring: "ring-gray-200",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    color: "text-red-500",
    bg: "bg-red-50",
    ring: "ring-red-200",
  },
};

const STATUS_FLOW: OrderStatus[] = ["pending", "preparing", "ready", "served"];

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatDateTime(iso: string) {
  return `${formatDate(iso)} ${formatTime(iso)}`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminOrdersPage() {
  const params = useParams();
  const venueSlug = typeof params.venue === "string" ? params.venue : "";
  const { orders, updateStatus, removeOrder, clearAllOrders, loading, refresh } =
    useOrders(venueSlug);
  const users = useAuthStore((s) => s.users);

  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeKey>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [closedTabs, setClosedTabs] = useState<OpenTabRow[]>([]);
  const [selectedClosedTab, setSelectedClosedTab] = useState<OpenTabRow | null>(null);

  const { from: rangeFrom, to: rangeTo } = useMemo(
    () => rangeBounds(dateRange, customFrom, customTo),
    [dateRange, customFrom, customTo]
  );

  const loadTabs = useCallback(async () => {
    if (!venueSlug) return;
    try {
      const params = new URLSearchParams({
        restaurantId: venueSlug,
        from: rangeFrom.toISOString(),
        to: rangeTo.toISOString(),
      });
      const res = await fetch(`/api/tabs/closed?${params.toString()}`, {
        credentials: "include",
      });
      const data = (await res.json().catch(() => null)) as
        | { tabs?: OpenTabRow[]; error?: string }
        | null;
      if (!res.ok) {
        throw new Error(data?.error ?? "Učitavanje konobarskih kartica nije uspjelo");
      }
      setClosedTabs(data?.tabs ?? []);
    } catch (error) {
      console.warn("[orders] closed waiter tabs failed", error);
      setClosedTabs([]);
    }
  }, [venueSlug, rangeFrom, rangeTo]);

  useEffect(() => {
    void loadTabs();
  }, [loadTabs]);

  const ordersInRange = useMemo(
    () => orders.filter((o) => inRange(o.createdAt, rangeFrom, rangeTo)),
    [orders, rangeFrom, rangeTo]
  );

  const userNameById = useMemo(
    () => new Map(users.map((user) => [user.id, user.name])),
    [users]
  );

  const waiterNameForTab = useCallback(
    (tab: OpenTabRow) => {
      if (tab.waiter_name && tab.waiter_name !== "—") return tab.waiter_name;
      return userNameById.get(tab.waiter_id) ?? "Nepoznat konobar";
    },
    [userNameById]
  );

  const filtered =
    filter === "all"
      ? ordersInRange
      : ordersInRange.filter((o) => o.status === filter);

  const activeCount = orders.filter(
    (o) => o.status === "pending" || o.status === "preparing"
  ).length;

  const analytics = useMemo(() => {
    const allSales = [
      ...ordersInRange.map((o) => ({ total: o.total, items: o.items, at: o.createdAt })),
      ...closedTabs.map((t) => ({
        total: Number(t.total),
        items: t.tab_items ?? [],
        at: t.closed_at ?? t.created_at,
      })),
    ];
    const revenue = allSales.reduce((s, x) => s + x.total, 0);
    const count = ordersInRange.length + closedTabs.length;
    const avg = count > 0 ? revenue / count : 0;
    const productCounts = new Map<string, number>();
    for (const o of ordersInRange) {
      for (const item of o.items) {
        const name = item.name;
        productCounts.set(name, (productCounts.get(name) ?? 0) + item.quantity);
      }
    }
    for (const tab of closedTabs) {
      for (const item of tab.tab_items ?? []) {
        const name = item.product_name;
        productCounts.set(name, (productCounts.get(name) ?? 0) + Number(item.quantity));
      }
    }
    let topProduct = "—";
    let topQty = 0;
    productCounts.forEach((qty, name) => {
      if (qty > topQty) {
        topQty = qty;
        topProduct = name;
      }
    });
    return { count, revenue, avg, topProduct };
  }, [ordersInRange, closedTabs]);

  const exportCsv = () => {
    const lines = [
      "type,id,date,table,waiter,payment,total,status",
      ...ordersInRange.map(
        (o) =>
          `order,${o.id},${o.createdAt},${o.tableNumber},,,${o.total.toFixed(2)},${o.status}`
      ),
      ...closedTabs.map(
        (t) =>
          `tab,${t.id},${t.closed_at ?? t.created_at},${t.table_label},${waiterNameForTab(t)},${t.payment_method ?? ""},${Number(t.total).toFixed(2)},closed`
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `narudzbe-${venueSlug}-${dateRange}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Next status action ────────────────── */
  const getNextStatus = (current: OrderStatus): OrderStatus | null => {
    const idx = STATUS_FLOW.indexOf(current);
    if (idx === -1 || idx === STATUS_FLOW.length - 1) return null;
    return STATUS_FLOW[idx + 1];
  };

  const nextActionLabel = (current: OrderStatus): string => {
    const next = getNextStatus(current);
    if (!next) return "";
    const map: Record<string, string> = {
      preparing: "Start Preparing",
      ready: "Mark Ready",
      served: "Mark Served",
    };
    return map[next] || "";
  };

  return (
    <div className="p-5 lg:p-8 max-w-[1200px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-dark adm-text tracking-tight">
            Orders
          </h1>
          <p className="text-sm text-muted adm-text-muted mt-1">
            Track and manage customer orders in real-time
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          <button
            type="button"
            onClick={exportCsv}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold border border-primary/20 text-primary hover:bg-primary/5 transition"
          >
            <Download size={14} />
            Export CSV
          </button>
          {orders.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-accent-red/70 hover:text-accent-red hover:bg-red-50 border border-red-100 transition"
            >
              <Trash2 size={14} />
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Date range */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(
          [
            ["today", "Danas"],
            ["week", "Ova sedmica"],
            ["custom", "Prilagođeno"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setDateRange(key)}
            className={clsx(
              "px-3 py-1.5 rounded-full text-[12px] font-semibold",
              dateRange === key ? "bg-primary text-white" : "adm-surface adm-border border border text-muted adm-text-muted"
            )}
          >
            {label}
          </button>
        ))}
        {dateRange === "custom" && (
          <>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-2 py-1 rounded-lg border text-sm"
            />
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-2 py-1 rounded-lg border text-sm"
            />
          </>
        )}
        <button
          type="button"
          onClick={() => {
            void refresh();
            void loadTabs();
          }}
          className="ml-auto flex items-center gap-1 text-[12px] font-semibold text-muted adm-text-muted hover:adm-text"
        >
          <RefreshCw size={14} /> Osvježi
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Ukupno narudžbi",
            value: analytics.count,
            icon: ShoppingBag,
            iconBg: "bg-primary/10",
            iconColor: "text-primary",
          },
          {
            label: "Ukupno prihoda",
            value: `${analytics.revenue.toFixed(2)} KM`,
            icon: Package,
            iconBg: "bg-amber-50",
            iconColor: "text-amber-500",
          },
          {
            label: "Prosječna vrijednost",
            value: `${analytics.avg.toFixed(2)} KM`,
            icon: Clock,
            iconBg: "bg-emerald-50",
            iconColor: "text-emerald-500",
          },
          {
            label: "Najprodavaniji artikal",
            value: analytics.topProduct,
            icon: RefreshCw,
            iconBg: "bg-blue-50",
            iconColor: "text-blue-500",
          },
          {
            label: "Aktivne (QR)",
            value: activeCount,
            icon: Filter,
            iconBg: "adm-surface-2",
            iconColor: "adm-text-muted",
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="adm-surface adm-border border rounded-2xl p-4 shadow-soft border border-primary/5"
          >
            <div className="flex items-center gap-3">
              <div
                className={clsx(
                  "w-9 h-9 rounded-xl flex items-center justify-center",
                  stat.iconBg
                )}
              >
                <stat.icon size={16} className={stat.iconColor} />
              </div>
              <div>
                <p className="text-lg font-extrabold text-dark adm-text leading-tight">
                  {stat.value}
                </p>
                <p className="text-[10px] text-muted adm-text-muted font-medium">
                  {stat.label}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
        <Filter size={14} className="text-muted adm-text-muted shrink-0" />
        {(["all", "pending", "preparing", "ready", "served", "cancelled"] as const).map(
          (s) => {
            const count =
              s === "all"
                ? ordersInRange.length
                : ordersInRange.filter((o) => o.status === s).length;
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={clsx(
                  "px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all whitespace-nowrap",
                  filter === s
                    ? "bg-primary text-white shadow-sm"
                    : "adm-surface adm-border border text-muted adm-text-muted hover:adm-text border border adm-border"
                )}
              >
                {s === "all" ? "All" : STATUS_CONFIG[s].label}
                <span className="ml-1 opacity-70">({count})</span>
              </button>
            );
          }
        )}
      </div>

      {/* Closed table tabs in range */}
      {closedTabs.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-extrabold text-dark adm-text mb-3">Zatvorene kartice (konobar)</h2>
          <div className="space-y-3">
            {closedTabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                onClick={() => setSelectedClosedTab(tab)}
                className="adm-surface adm-border border rounded-2xl border-purple-100 shadow-soft p-4 flex flex-wrap items-center gap-3 w-full text-left cursor-pointer hover:shadow-card hover:border-purple-200 transition"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold uppercase text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                    Konobar
                  </span>
                  <p className="font-extrabold text-dark adm-text mt-1">
                    {tab.table_label} · {Number(tab.total).toFixed(2)} KM
                  </p>
                  <div className="flex flex-wrap gap-3 text-[11px] text-muted adm-text-muted mt-1">
                    <span className="flex items-center gap-1">
                      <User size={10} /> {waiterNameForTab(tab)}
                    </span>
                    <span className="flex items-center gap-1">
                      {isTabCardPayment(tab.payment_method) ? (
                        <CreditCard size={10} />
                      ) : (
                        <Banknote size={10} />
                      )}
                      {tabPaymentLabel(tab.payment_method)}
                    </span>
                    <span>
                      {formatDate(tab.closed_at ?? tab.created_at)}{" "}
                      {formatTime(tab.closed_at ?? tab.created_at)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Orders list */}
      {filtered.length === 0 && closedTabs.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-20"
        >
          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <ShoppingBag size={32} className="text-primary/50" />
          </div>
          <h3 className="text-lg font-bold text-dark adm-text">No orders yet</h3>
          <p className="text-sm text-muted adm-text-muted mt-1.5 max-w-xs mx-auto">
            When customers place orders, they will appear here for you to
            manage.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order, i) => {
            const sc = STATUS_CONFIG[order.status];
            const StatusIcon = sc.icon;
            const next = getNextStatus(order.status);
            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={clsx(
                  "adm-surface adm-border border rounded-2xl shadow-soft border overflow-hidden transition-all hover:shadow-card",
                  order.status === "pending" && "border-amber-200",
                  order.status === "preparing" && "border-blue-200",
                  order.status === "ready" && "border-emerald-200",
                  order.status === "served" && "border adm-border",
                  order.status === "cancelled" && "border-red-200"
                )}
              >
                <div className="p-4 sm:p-5">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={clsx(
                          "w-10 h-10 rounded-xl flex items-center justify-center ring-1",
                          sc.bg,
                          sc.ring
                        )}
                      >
                        <StatusIcon size={18} className={sc.color} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-dark adm-text text-[15px]">
                            {order.id}
                          </span>
                          <span
                            className={clsx(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide",
                              sc.bg,
                              sc.color
                            )}
                          >
                            {sc.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted adm-text-muted flex-wrap">
                          <span className="flex items-center gap-1">
                            <MapPin size={10} />
                            Stol {order.tableNumber || "—"}
                          </span>
                          <span className="flex items-center gap-1 adm-text-muted">
                            QR meni
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {formatTime(order.createdAt)}
                          </span>
                          <span className="adm-text-faint">
                            {timeAgo(order.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-lg font-extrabold text-dark adm-text">
                        {order.total.toFixed(2)} KM
                      </p>
                      <p className="text-[10px] text-muted adm-text-muted">
                        {order.itemCount} item{order.itemCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  {/* Items preview */}
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    {order.items.slice(0, 4).map((item) => (
                      <div
                        key={item.cartKey || item.id}
                        className="flex items-center gap-1.5 adm-bg rounded-lg px-2 py-1"
                      >
                        {item.image && (
                          <img
                            src={item.image}
                            alt=""
                            className="w-5 h-5 rounded object-cover"
                          />
                        )}
                        <span className="text-[11px] font-medium text-dark adm-text">
                          {item.quantity}× {item.name}
                        </span>
                      </div>
                    ))}
                    {order.items.length > 4 && (
                      <span className="text-[11px] text-muted adm-text-muted font-medium">
                        +{order.items.length - 4} more
                      </span>
                    )}
                  </div>

                  {/* Kitchen note */}
                  {order.kitchenNote && (
                    <div className="mt-2 flex items-start gap-1.5 text-[11px] text-muted adm-text-muted bg-amber-50/50 rounded-lg px-2.5 py-1.5">
                      <MessageSquare
                        size={12}
                        className="text-amber-500 shrink-0 mt-0.5"
                      />
                      <span className="italic">{order.kitchenNote}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold text-muted adm-text-muted hover:adm-text hover:bg-[var(--adm-surface-2)] border border adm-border transition"
                    >
                      <Eye size={13} />
                      Details
                    </button>

                    {next && (
                      <button
                        onClick={() => updateStatus(order.id, next)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold text-white bg-gradient-to-r from-primary to-amber-500 shadow-sm hover:brightness-105 transition"
                      >
                        {nextActionLabel(order.status)}
                      </button>
                    )}

                    {order.status !== "cancelled" && order.status !== "served" && (
                      <button
                        onClick={() => updateStatus(order.id, "cancelled")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold text-red-400 hover:text-red-600 hover:bg-red-50 border border-red-100 transition"
                      >
                        <XCircle size={13} />
                        Cancel
                      </button>
                    )}

                    {(order.status === "served" || order.status === "cancelled") && (
                      <button
                        onClick={() => removeOrder(order.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold text-muted adm-text-muted hover:text-red-500 hover:bg-red-50 transition"
                      >
                        <Trash2 size={13} />
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Closed tab detail modal ── */}
      <AnimatePresence>
        {selectedClosedTab && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => setSelectedClosedTab(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: "spring", damping: 25 }}
              className="adm-surface adm-border border rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-elevated"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 adm-header backdrop-blur-md rounded-t-3xl border-b border adm-border px-6 py-4 flex items-center justify-between z-10">
                <div>
                  <span className="text-[10px] font-bold uppercase text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                    Konobar
                  </span>
                  <h2 className="text-lg font-extrabold text-dark adm-text mt-1">
                    {selectedClosedTab.table_label}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedClosedTab(null)}
                  className="w-9 h-9 rounded-xl hover:bg-[var(--adm-surface-2)] flex items-center justify-center text-muted adm-text-muted hover:adm-text transition"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl adm-bg">
                    <p className="text-[10px] font-bold text-muted adm-text-muted uppercase tracking-wider">
                      Konobar
                    </p>
                    <p className="text-[13px] font-bold text-dark adm-text mt-0.5 flex items-center gap-1.5">
                      <User size={13} className="text-purple-500" />
                      {waiterNameForTab(selectedClosedTab)}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl adm-bg">
                    <p className="text-[10px] font-bold text-muted adm-text-muted uppercase tracking-wider">
                      Plaćanje
                    </p>
                    <p className="text-[13px] font-bold text-dark adm-text mt-0.5 flex items-center gap-1.5">
                      {isTabCardPayment(selectedClosedTab.payment_method) ? (
                        <CreditCard size={13} className="text-purple-500" />
                      ) : (
                        <Banknote size={13} className="text-purple-500" />
                      )}
                      {tabPaymentLabel(selectedClosedTab.payment_method)}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl adm-bg">
                    <p className="text-[10px] font-bold text-muted adm-text-muted uppercase tracking-wider">
                      Otvoreno
                    </p>
                    <p className="text-[13px] font-semibold text-dark adm-text mt-0.5 flex items-center gap-1.5">
                      <Clock size={13} className="text-purple-500" />
                      {formatDateTime(selectedClosedTab.created_at)}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl adm-bg">
                    <p className="text-[10px] font-bold text-muted adm-text-muted uppercase tracking-wider">
                      Račun zatvoren
                    </p>
                    <p className="text-[13px] font-semibold text-dark adm-text mt-0.5 flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-purple-500" />
                      {selectedClosedTab.closed_at
                        ? formatDateTime(selectedClosedTab.closed_at)
                        : "—"}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-bold text-muted adm-text-muted uppercase tracking-wider mb-2">
                    Stavke
                  </p>
                  {(selectedClosedTab.tab_items ?? []).length === 0 ? (
                    <p className="text-[13px] text-muted adm-text-muted italic">
                      Nema stavki na kartici.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {(selectedClosedTab.tab_items ?? []).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 p-3 rounded-xl adm-bg"
                        >
                          <p className="text-[13px] font-semibold text-dark adm-text">
                            {item.quantity > 1 ? `${item.quantity}× ` : ""}
                            {item.product_name}
                          </p>
                          <p className="text-[14px] font-extrabold text-dark adm-text shrink-0">
                            {Number(item.total_price).toFixed(2)} KM
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-purple-50 to-purple-100/50 border border-purple-100">
                  <span className="text-[13px] font-bold text-dark adm-text">Ukupno</span>
                  <span className="text-xl font-extrabold text-purple-700">
                    {Number(selectedClosedTab.total).toFixed(2)} KM
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Order detail modal ── */}
      <AnimatePresence>
        {selectedOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => setSelectedOrder(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: "spring", damping: 25 }}
              className="adm-surface adm-border border rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-elevated"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="sticky top-0 adm-header backdrop-blur-md backdrop-blur-md rounded-t-3xl border-b border adm-border px-6 py-4 flex items-center justify-between z-10">
                <div>
                  <h2 className="text-lg font-extrabold text-dark adm-text">
                    {selectedOrder.id}
                  </h2>
                  <p className="text-[11px] text-muted adm-text-muted">
                    {formatDate(selectedOrder.createdAt)} at{" "}
                    {formatTime(selectedOrder.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="w-9 h-9 rounded-xl hover:bg-[var(--adm-surface-2)] flex items-center justify-center text-muted adm-text-muted hover:adm-text transition"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Status + Table */}
                <div className="flex items-center gap-3">
                  {(() => {
                    const sc = STATUS_CONFIG[selectedOrder.status];
                    const Icon = sc.icon;
                    return (
                      <div
                        className={clsx(
                          "flex items-center gap-2 px-3 py-1.5 rounded-full",
                          sc.bg
                        )}
                      >
                        <Icon size={14} className={sc.color} />
                        <span
                          className={clsx(
                            "text-[12px] font-bold",
                            sc.color
                          )}
                        >
                          {sc.label}
                        </span>
                      </div>
                    );
                  })()}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full adm-bg">
                    <MapPin size={12} className="text-muted adm-text-muted" />
                    <span className="text-[12px] font-semibold text-dark adm-text">
                      Table {selectedOrder.tableNumber}
                    </span>
                  </div>
                </div>

                {/* Kitchen note */}
                {selectedOrder.kitchenNote && (
                  <div className="flex items-start gap-2 p-3 rounded-2xl bg-amber-50 border border-amber-100">
                    <MessageSquare
                      size={14}
                      className="text-amber-500 shrink-0 mt-0.5"
                    />
                    <div>
                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-0.5">
                        Kitchen Note
                      </p>
                      <p className="text-[13px] text-amber-800">
                        {selectedOrder.kitchenNote}
                      </p>
                    </div>
                  </div>
                )}

                {/* Items */}
                <div>
                  <p className="text-[11px] font-bold text-muted adm-text-muted uppercase tracking-wider mb-2">
                    Items ({selectedOrder.itemCount})
                  </p>
                  <div className="space-y-2">
                    {selectedOrder.items.map((item) => (
                      <div
                        key={item.cartKey || item.id}
                        className="flex items-center gap-3 p-3 rounded-xl adm-bg"
                      >
                        {item.image && (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-12 h-12 rounded-xl object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-dark adm-text truncate">
                            {item.name}
                          </p>
                          {/* Variations */}
                          {item.selectedVariations &&
                            item.selectedVariations.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {item.selectedVariations.map((v, vi) => (
                                  <span
                                    key={vi}
                                    className="text-[10px] font-medium text-muted adm-text-muted adm-surface adm-border border rounded px-1.5 py-0.5"
                                  >
                                    {v.variationName}: {v.optionLabel}
                                    {v.priceAdjustment > 0 &&
                                      ` (+${v.priceAdjustment.toFixed(2)} KM)`}
                                  </span>
                                ))}
                              </div>
                            )}
                          <p className="text-[11px] text-muted adm-text-muted mt-0.5">
                            {item.price.toFixed(2)} KM × {item.quantity}
                          </p>
                        </div>
                        <p className="text-[14px] font-extrabold text-dark adm-text">
                          {(item.price * item.quantity).toFixed(2)} KM
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-primary/5 to-amber-50 border border-primary/10">
                  <span className="text-[13px] font-bold text-dark adm-text">
                    Order Total
                  </span>
                  <span className="text-xl font-extrabold text-primary">
                    {selectedOrder.total.toFixed(2)} KM
                  </span>
                </div>

                {/* Status change actions */}
                {selectedOrder.status !== "served" &&
                  selectedOrder.status !== "cancelled" && (
                    <div className="flex gap-2">
                      {(() => {
                        const next = getNextStatus(selectedOrder.status);
                        if (!next) return null;
                        return (
                          <button
                            onClick={() => {
                              updateStatus(selectedOrder.id, next);
                              setSelectedOrder({
                                ...selectedOrder,
                                status: next,
                              });
                            }}
                            className="flex-1 py-3 rounded-2xl text-[13px] font-bold text-white bg-gradient-to-r from-primary to-amber-500 shadow-glow hover:brightness-105 transition"
                          >
                            {nextActionLabel(selectedOrder.status)}
                          </button>
                        );
                      })()}
                      <button
                        onClick={() => {
                          updateStatus(selectedOrder.id, "cancelled");
                          setSelectedOrder({
                            ...selectedOrder,
                            status: "cancelled",
                          });
                        }}
                        className="px-5 py-3 rounded-2xl text-[13px] font-bold text-red-500 border border-red-200 hover:bg-red-50 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Clear all confirm modal ── */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25 }}
              className="adm-surface adm-border border rounded-3xl p-6 max-w-[380px] w-full shadow-elevated"
            >
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={22} className="text-accent-red" />
              </div>
              <h3 className="text-lg font-extrabold text-dark adm-text text-center">
                Clear All Orders?
              </h3>
              <p className="text-sm text-muted adm-text-muted mt-2 text-center leading-relaxed">
                This will permanently remove all order history. This cannot be
                undone.
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-3 rounded-2xl border border adm-border text-sm font-bold text-dark adm-text hover:bg-[var(--adm-surface-2)] transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    void clearAllOrders();
                    setShowClearConfirm(false);
                  }}
                  className="flex-1 py-3 rounded-2xl bg-accent-red text-white text-sm font-bold hover:brightness-110 transition shadow-lg shadow-red-200"
                >
                  Clear Everything
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
