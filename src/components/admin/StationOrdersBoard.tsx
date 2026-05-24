"use client";

import { useState } from "react";
import {
  ChefHat,
  Wine,
  Clock,
  ChevronDown,
  ChevronUp,
  MapPin,
  MessageSquare,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams } from "next/navigation";
import { useOrders } from "@/hooks/useOrders";
import type { Order, OrderStatus } from "@/types/order";
import type { CartItem } from "@/types/cart";
import {
  itemsForKitchen,
  itemsForBar,
  itemsFoodOnlyOnBar,
  lineTotal,
} from "@/lib/order-stations";
import clsx from "clsx";

type StationMode = "kitchen" | "bar";

const STATUS_FLOW: OrderStatus[] = ["pending", "preparing", "ready", "served"];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function nextStatus(current: OrderStatus): OrderStatus | null {
  const i = STATUS_FLOW.indexOf(current);
  if (i < 0 || i >= STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[i + 1];
}

function ItemLines({
  items,
  showPrices,
}: {
  items: CartItem[];
  showPrices: boolean;
}) {
  if (items.length === 0) {
    return <p className="text-[12px] text-muted italic">No items for this station</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.cartKey || item.id} className="flex justify-between gap-3 text-[13px]">
          <span className="font-semibold text-dark">
            <span className="text-primary font-bold">{item.quantity}×</span> {item.name}
            {item.selectedVariations?.length ? (
              <span className="block text-[11px] font-normal text-muted mt-0.5">
                {item.selectedVariations.map((v) => v.optionLabel).join(", ")}
              </span>
            ) : null}
          </span>
          {showPrices && (
            <span className="font-bold text-dark shrink-0">
              €{lineTotal(item).toFixed(2)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function OrderCard({
  order,
  mode,
  onAdvance,
}: {
  order: Order;
  mode: StationMode;
  onAdvance: (id: string, status: OrderStatus) => void;
}) {
  const [showFull, setShowFull] = useState(false);
  const primary =
    mode === "kitchen" ? itemsForKitchen(order.items) : itemsForBar(order.items);
  const foodOnly = mode === "bar" ? itemsFoodOnlyOnBar(order.items) : [];
  const hasPrimary = primary.length > 0;
  const next = nextStatus(order.status);

  if (!hasPrimary && mode === "kitchen") return null;
  if (!hasPrimary && foodOnly.length === 0 && mode === "bar") return null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-100/80 shadow-soft overflow-hidden"
    >
      <div
        className={clsx(
          "px-4 py-3 flex items-center justify-between border-b",
          mode === "kitchen" ? "bg-amber-50/80 border-amber-100" : "bg-purple-50/80 border-purple-100"
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={clsx(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              mode === "kitchen" ? "bg-amber-500/15" : "bg-purple-500/15"
            )}
          >
            {mode === "kitchen" ? (
              <ChefHat size={20} className="text-amber-700" />
            ) : (
              <Wine size={20} className="text-purple-700" />
            )}
          </div>
          <div>
            <p className="text-lg font-extrabold text-dark">Table {order.tableNumber || "—"}</p>
            <p className="text-[11px] text-muted flex items-center gap-1">
              <Clock size={11} />
              {formatTime(order.createdAt)} · {order.status}
            </p>
          </div>
        </div>
        {next && (
          <button
            type="button"
            onClick={() => onAdvance(order.id, next)}
            className={clsx(
              "px-3 py-1.5 rounded-xl text-[11px] font-bold text-white transition",
              mode === "kitchen"
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-purple-600 hover:bg-purple-700"
            )}
          >
            Mark {next}
          </button>
        )}
      </div>

      <div className="p-4 space-y-3">
        <ItemLines items={primary} showPrices={mode === "bar"} />

        {mode === "bar" && foodOnly.length > 0 && !showFull && (
          <button
            type="button"
            onClick={() => setShowFull(true)}
            className="text-[12px] font-semibold text-muted hover:text-dark flex items-center gap-1"
          >
            <ChevronDown size={14} />
            + {foodOnly.length} food item{foodOnly.length !== 1 ? "s" : ""} (kitchen) — show full order
          </button>
        )}

        <AnimatePresence>
          {showFull && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-gray-100 pt-3"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  Full order
                </span>
                <button
                  type="button"
                  onClick={() => setShowFull(false)}
                  className="text-muted hover:text-dark"
                >
                  <ChevronUp size={16} />
                </button>
              </div>
              <ItemLines items={order.items} showPrices={mode === "bar"} />
              {mode === "bar" && (
                <p className="text-[13px] font-bold text-dark mt-2 text-right">
                  Total €{order.total.toFixed(2)}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {mode === "kitchen" && (
          <button
            type="button"
            onClick={() => setShowFull(!showFull)}
            className="text-[12px] font-semibold text-primary hover:underline flex items-center gap-1"
          >
            {showFull ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showFull ? "Hide" : "View"} full order (all items, no prices)
          </button>
        )}

        {order.kitchenNote && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-bg text-[12px]">
            <MessageSquare size={14} className="text-muted shrink-0 mt-0.5" />
            <span className="text-dark">{order.kitchenNote}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function StationOrdersBoard({ mode }: { mode: StationMode }) {
  const params = useParams();
  const venueSlug = typeof params.venue === "string" ? params.venue : "";
  const { orders, updateStatus } = useOrders(venueSlug);

  const active = orders.filter(
    (o) => o.status !== "served" && o.status !== "cancelled"
  );

  const visible = active.filter((o) => {
    if (mode === "kitchen") return itemsForKitchen(o.items).length > 0;
    return itemsForBar(o.items).length > 0 || itemsFoodOnlyOnBar(o.items).length > 0;
  });

  const Icon = mode === "kitchen" ? ChefHat : Wine;
  const title = mode === "kitchen" ? "Kitchen" : "Bar";
  const subtitle =
    mode === "kitchen"
      ? "Food items only — prices hidden"
      : "Drinks with prices — expand for full order";

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div
          className={clsx(
            "w-12 h-12 rounded-2xl flex items-center justify-center",
            mode === "kitchen" ? "bg-amber-500/15" : "bg-purple-500/15"
          )}
        >
          <Icon size={24} className={mode === "kitchen" ? "text-amber-700" : "text-purple-700"} />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-dark">{title} station</h1>
          <p className="text-[13px] text-muted">{subtitle}</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[12px] font-bold text-muted">
          <MapPin size={14} />
          {visible.length} active
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <CheckCircle2 size={40} className="mx-auto text-muted/30 mb-3" />
          <p className="text-sm font-semibold text-muted">No active orders for {title.toLowerCase()}</p>
          <p className="text-[12px] text-muted/70 mt-1">
            Guest orders appear here when they include {mode === "kitchen" ? "food" : "bar"} items.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              mode={mode}
              onAdvance={updateStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}
