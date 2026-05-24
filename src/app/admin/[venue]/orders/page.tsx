"use client";

import { useState } from "react";
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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams } from "next/navigation";
import { useOrders } from "@/hooks/useOrders";
import { Order, OrderStatus } from "@/types/order";
import clsx from "clsx";

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
    color: "text-gray-500",
    bg: "bg-gray-50",
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

  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const filtered =
    filter === "all"
      ? orders
      : orders.filter((o) => o.status === filter);

  const activeCount = orders.filter(
    (o) => o.status === "pending" || o.status === "preparing"
  ).length;

  const todayOrders = orders.filter(
    (o) => new Date(o.createdAt).toDateString() === new Date().toDateString()
  );
  const todayRevenue = todayOrders.reduce((s, o) => s + o.total, 0);

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
          <h1 className="text-2xl lg:text-3xl font-extrabold text-dark tracking-tight">
            Orders
          </h1>
          <p className="text-sm text-muted mt-1">
            Track and manage customer orders in real-time
          </p>
        </div>
        {orders.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-accent-red/70 hover:text-accent-red hover:bg-red-50 border border-red-100 transition self-start"
          >
            <Trash2 size={14} />
            Clear All
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Total Orders",
            value: orders.length,
            icon: ShoppingBag,
            iconBg: "bg-primary/10",
            iconColor: "text-primary",
          },
          {
            label: "Active",
            value: activeCount,
            icon: RefreshCw,
            iconBg: "bg-blue-50",
            iconColor: "text-blue-500",
          },
          {
            label: "Today",
            value: todayOrders.length,
            icon: Clock,
            iconBg: "bg-emerald-50",
            iconColor: "text-emerald-500",
          },
          {
            label: "Today Revenue",
            value: `${todayRevenue.toFixed(2)} KM`,
            icon: Package,
            iconBg: "bg-amber-50",
            iconColor: "text-amber-500",
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="bg-white rounded-2xl p-4 shadow-soft border border-primary/5"
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
                <p className="text-lg font-extrabold text-dark leading-tight">
                  {stat.value}
                </p>
                <p className="text-[10px] text-muted font-medium">
                  {stat.label}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
        <Filter size={14} className="text-muted shrink-0" />
        {(["all", "pending", "preparing", "ready", "served", "cancelled"] as const).map(
          (s) => {
            const count =
              s === "all"
                ? orders.length
                : orders.filter((o) => o.status === s).length;
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={clsx(
                  "px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all whitespace-nowrap",
                  filter === s
                    ? "bg-primary text-white shadow-sm"
                    : "bg-white text-muted hover:text-dark border border-gray-100"
                )}
              >
                {s === "all" ? "All" : STATUS_CONFIG[s].label}
                <span className="ml-1 opacity-70">({count})</span>
              </button>
            );
          }
        )}
      </div>

      {/* Orders list */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-20"
        >
          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <ShoppingBag size={32} className="text-primary/50" />
          </div>
          <h3 className="text-lg font-bold text-dark">No orders yet</h3>
          <p className="text-sm text-muted mt-1.5 max-w-xs mx-auto">
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
                  "bg-white rounded-2xl shadow-soft border overflow-hidden transition-all hover:shadow-card",
                  order.status === "pending" && "border-amber-200",
                  order.status === "preparing" && "border-blue-200",
                  order.status === "ready" && "border-emerald-200",
                  order.status === "served" && "border-gray-100",
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
                          <span className="font-extrabold text-dark text-[15px]">
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
                        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted">
                          <span className="flex items-center gap-1">
                            <MapPin size={10} />
                            Table {order.tableNumber}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {formatTime(order.createdAt)}
                          </span>
                          <span className="text-muted/50">
                            {timeAgo(order.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-lg font-extrabold text-dark">
                        {order.total.toFixed(2)} KM
                      </p>
                      <p className="text-[10px] text-muted">
                        {order.itemCount} item{order.itemCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  {/* Items preview */}
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    {order.items.slice(0, 4).map((item) => (
                      <div
                        key={item.cartKey || item.id}
                        className="flex items-center gap-1.5 bg-bg rounded-lg px-2 py-1"
                      >
                        {item.image && (
                          <img
                            src={item.image}
                            alt=""
                            className="w-5 h-5 rounded object-cover"
                          />
                        )}
                        <span className="text-[11px] font-medium text-dark">
                          {item.quantity}× {item.name}
                        </span>
                      </div>
                    ))}
                    {order.items.length > 4 && (
                      <span className="text-[11px] text-muted font-medium">
                        +{order.items.length - 4} more
                      </span>
                    )}
                  </div>

                  {/* Kitchen note */}
                  {order.kitchenNote && (
                    <div className="mt-2 flex items-start gap-1.5 text-[11px] text-muted bg-amber-50/50 rounded-lg px-2.5 py-1.5">
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
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold text-muted hover:text-dark hover:bg-bg border border-gray-100 transition"
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
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold text-muted hover:text-red-500 hover:bg-red-50 transition"
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
              className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-elevated"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="sticky top-0 bg-white/95 backdrop-blur-md rounded-t-3xl border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
                <div>
                  <h2 className="text-lg font-extrabold text-dark">
                    {selectedOrder.id}
                  </h2>
                  <p className="text-[11px] text-muted">
                    {formatDate(selectedOrder.createdAt)} at{" "}
                    {formatTime(selectedOrder.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="w-9 h-9 rounded-xl hover:bg-bg flex items-center justify-center text-muted hover:text-dark transition"
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
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-bg">
                    <MapPin size={12} className="text-muted" />
                    <span className="text-[12px] font-semibold text-dark">
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
                  <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2">
                    Items ({selectedOrder.itemCount})
                  </p>
                  <div className="space-y-2">
                    {selectedOrder.items.map((item) => (
                      <div
                        key={item.cartKey || item.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-bg"
                      >
                        {item.image && (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-12 h-12 rounded-xl object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-dark truncate">
                            {item.name}
                          </p>
                          {/* Variations */}
                          {item.selectedVariations &&
                            item.selectedVariations.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {item.selectedVariations.map((v, vi) => (
                                  <span
                                    key={vi}
                                    className="text-[10px] font-medium text-muted bg-white rounded px-1.5 py-0.5"
                                  >
                                    {v.variationName}: {v.optionLabel}
                                    {v.priceAdjustment > 0 &&
                                      ` (+${v.priceAdjustment.toFixed(2)} KM)`}
                                  </span>
                                ))}
                              </div>
                            )}
                          <p className="text-[11px] text-muted mt-0.5">
                            {item.price.toFixed(2)} KM × {item.quantity}
                          </p>
                        </div>
                        <p className="text-[14px] font-extrabold text-dark">
                          {(item.price * item.quantity).toFixed(2)} KM
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-primary/5 to-amber-50 border border-primary/10">
                  <span className="text-[13px] font-bold text-dark">
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
              className="bg-white rounded-3xl p-6 max-w-[380px] w-full shadow-elevated"
            >
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={22} className="text-accent-red" />
              </div>
              <h3 className="text-lg font-extrabold text-dark text-center">
                Clear All Orders?
              </h3>
              <p className="text-sm text-muted mt-2 text-center leading-relaxed">
                This will permanently remove all order history. This cannot be
                undone.
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-bold text-dark hover:bg-bg transition"
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
