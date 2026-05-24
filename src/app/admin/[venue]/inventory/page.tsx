"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Trash2, X, FileText } from "lucide-react";
import * as inventoryService from "@/services/inventoryService";
import * as productService from "@/services/productService";
import type { Tables } from "@/types/supabase";
import clsx from "clsx";

type InvRow = Tables<"inventory">;
type MovRow = Tables<"inventory_movements">;

type AdjustAction = "add" | "remove";

function todayLocalStartIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function formatTodayDate(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function reasonLabel(reason: string): string {
  if (reason === "order") return "Narudžba";
  if (reason === "manual") return "Ručno";
  if (reason === "init") return "Inicijalno";
  return reason;
}

export default function InventoryPage() {
  const params = useParams();
  const venueSlug = typeof params.venue === "string" ? params.venue : "";

  const [rows, setRows] = useState<InvRow[]>([]);
  const [movements, setMovements] = useState<MovRow[]>([]);
  const [todayMovements, setTodayMovements] = useState<MovRow[]>([]);
  const [menuProducts, setMenuProducts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [movementsOpen, setMovementsOpen] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [newProductId, setNewProductId] = useState("");
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newUnit, setNewUnit] = useState("kom");

  const [inlineAdjust, setInlineAdjust] = useState<{
    rowId: string;
    action: AdjustAction;
  } | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [adjustBusy, setAdjustBusy] = useState(false);
  const [error, setError] = useState("");

  const loadInventory = useCallback(async () => {
    if (!venueSlug) return;
    const [inv, prods, todayMov] = await Promise.all([
      inventoryService.getInventory(venueSlug),
      productService.getProducts(venueSlug),
      inventoryService.getMovements(venueSlug, todayLocalStartIso()),
    ]);
    setRows(inv);
    setMenuProducts(prods.map((p) => ({ id: p.id, name: p.name })));
    setTodayMovements(todayMov);
  }, [venueSlug]);

  const loadMovements = useCallback(async () => {
    if (!venueSlug) return;
    const mov = await inventoryService.getMovements(
      venueSlug,
      fromDate ? `${fromDate}T00:00:00.000Z` : undefined,
      toDate ? `${toDate}T23:59:59.999Z` : undefined
    );
    setMovements(mov);
  }, [venueSlug, fromDate, toDate]);

  const load = useCallback(async () => {
    if (!venueSlug) return;
    setLoading(true);
    setError("");
    try {
      await loadInventory();
      if (movementsOpen) {
        await loadMovements();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Učitavanje nije uspjelo");
    } finally {
      setLoading(false);
    }
  }, [venueSlug, loadInventory, loadMovements, movementsOpen]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!movementsOpen || !venueSlug) return;
    void loadMovements();
  }, [movementsOpen, fromDate, toDate, venueSlug, loadMovements]);

  const soldTodayByProduct = useMemo(() => {
    const map = new Map<string, number>();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    for (const m of todayMovements) {
      if (m.reason !== "order") continue;
      if (new Date(m.created_at) < start) continue;
      const prev = map.get(m.product_id) ?? 0;
      map.set(m.product_id, prev + Math.abs(Number(m.quantity_delta)));
    }
    return map;
  }, [todayMovements]);

  const reportRows = useMemo(() => {
    return rows.map((r) => {
      const sold = soldTodayByProduct.get(r.product_id) ?? 0;
      const current = Number(r.quantity);
      const start = current + sold;
      return {
        id: r.id,
        name: r.product_name,
        start,
        sold,
        current,
        unit: r.unit,
      };
    });
  }, [rows, soldTodayByProduct]);

  const handleAdd = async () => {
    const name =
      newName.trim() ||
      menuProducts.find((p) => p.id === newProductId)?.name ||
      "";
    if (!newProductId || !name) return;
    const qty = Number(newQty) || 0;
    try {
      await inventoryService.upsertInventoryItem(
        venueSlug,
        newProductId,
        name,
        qty,
        newUnit,
        null
      );
      setShowAdd(false);
      setNewProductId("");
      setNewName("");
      setNewQty("");
      setNewUnit("kom");
      await loadInventory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Spremanje nije uspjelo");
    }
  };

  const confirmAdjust = async (row: InvRow) => {
    const qty = Number(adjustQty);
    if (!inlineAdjust || !qty || qty <= 0) return;
    setAdjustBusy(true);
    setError("");
    try {
      const delta = inlineAdjust.action === "add" ? qty : -qty;
      const res = await fetch("/api/inventory/adjust", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: venueSlug,
          productId: row.product_id,
          productName: row.product_name,
          delta,
          reason: "manual",
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Ažuriranje nije uspjelo");
        return;
      }
      setInlineAdjust(null);
      setAdjustQty("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ažuriranje nije uspjelo");
    } finally {
      setAdjustBusy(false);
    }
  };

  const removeRow = async (row: InvRow) => {
    try {
      await inventoryService.deleteInventoryItem(row.id);
      setConfirmDeleteId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Brisanje nije uspjelo");
    }
  };

  const copyReportText = async () => {
    const header = "Artikal | Početak | Prodano | Stanje";
    const lines = reportRows.map(
      (r) =>
        `${r.name} | ${r.start} ${r.unit} | ${r.sold} ${r.unit} | ${r.current} ${r.unit}`
    );
    await navigator.clipboard.writeText([header, ...lines].join("\n"));
  };

  return (
    <div className="p-4 lg:p-8 max-w-lg mx-auto pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-dark adm-text">Inventar</h1>
          <p className="text-sm text-muted adm-text-muted mt-1">Zalihe i kretanje</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowReport(true)}
            className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-2xl adm-surface adm-border border text-sm font-bold text-dark adm-text"
          >
            <FileText size={16} /> Izvještaj
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-primary to-amber-500 text-white px-4 py-2.5 min-h-[44px] rounded-2xl text-sm font-bold shadow-glow"
          >
            <Plus size={16} /> Dodaj artikal
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 rounded-xl px-4 py-2 mb-4">
          {error}
        </p>
      )}

      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-8">
            {rows.map((r) => {
              const isAdjusting =
                inlineAdjust?.rowId === r.id ? inlineAdjust.action : null;
              const isConfirmingDelete = confirmDeleteId === r.id;

              return (
                <div
                  key={r.id}
                  className="adm-surface adm-border border rounded-2xl p-4 shadow-soft relative"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmDeleteId(isConfirmingDelete ? null : r.id)
                    }
                    className="absolute top-3 right-3 p-2 text-muted adm-text-muted hover:text-red-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="Obriši"
                  >
                    <Trash2 size={18} />
                  </button>

                  {isConfirmingDelete ? (
                    <div className="pr-12">
                      <p className="text-sm font-semibold text-dark adm-text mb-3">
                        Obrisati {r.product_name}?
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void removeRow(r)}
                          className="flex-1 min-h-[44px] rounded-xl bg-red-600 text-white text-sm font-bold"
                        >
                          Da, obriši
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="flex-1 min-h-[44px] rounded-xl adm-border border text-sm font-bold adm-text"
                        >
                          Ne
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-base font-extrabold text-dark adm-text pr-10">
                        {r.product_name}
                      </p>
                      <p className="text-3xl font-extrabold text-primary mt-1">
                        {Number(r.quantity)}{" "}
                        <span className="text-lg font-semibold text-muted adm-text-muted">
                          {r.unit}
                        </span>
                      </p>

                      <div className="grid grid-cols-2 gap-2 mt-4">
                        <button
                          type="button"
                          onClick={() => {
                            setInlineAdjust({ rowId: r.id, action: "remove" });
                            setAdjustQty("");
                          }}
                          disabled={adjustBusy}
                          className="min-h-[44px] rounded-xl adm-border border font-bold text-sm adm-text"
                        >
                          − Skini
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setInlineAdjust({ rowId: r.id, action: "add" });
                            setAdjustQty("");
                          }}
                          disabled={adjustBusy}
                          className="min-h-[44px] rounded-xl bg-primary text-white font-bold text-sm"
                        >
                          + Dodaj
                        </button>
                      </div>

                      {isAdjusting && (
                        <div className="mt-3 pt-3 border-t adm-border space-y-2">
                          <input
                            type="number"
                            inputMode="decimal"
                            placeholder="Količina"
                            value={adjustQty}
                            onChange={(e) => setAdjustQty(e.target.value)}
                            className="w-full px-3 py-3 min-h-[44px] rounded-xl adm-border border text-base adm-bg adm-text"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={adjustBusy}
                              onClick={() => {
                                setInlineAdjust(null);
                                setAdjustQty("");
                              }}
                              className="flex-1 min-h-[44px] rounded-xl adm-border border text-sm font-bold adm-text"
                            >
                              Odustani
                            </button>
                            <button
                              type="button"
                              disabled={adjustBusy || !adjustQty}
                              onClick={() => void confirmAdjust(r)}
                              className="flex-1 min-h-[44px] rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-40"
                            >
                              Potvrdi
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
            {rows.length === 0 && (
              <p className="text-center text-muted adm-text-muted py-10 text-sm">
                Inventar je prazan
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMovementsOpen((o) => !o)}
            className="w-full min-h-[44px] text-sm font-bold text-primary mb-3"
          >
            {movementsOpen ? "▲ Sakrij kretanje" : "▼ Prikaži kretanje zaliha"}
          </button>

          {movementsOpen && (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="flex-1 min-h-[44px] px-3 rounded-xl adm-border border text-sm adm-bg adm-text"
                />
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="flex-1 min-h-[44px] px-3 rounded-xl adm-border border text-sm adm-bg adm-text"
                />
              </div>
              <div className="adm-surface adm-border border rounded-2xl divide-y max-h-[360px] overflow-y-auto">
                {movements.map((m) => (
                  <div
                    key={m.id}
                    className="px-4 py-3 flex flex-wrap items-center gap-2 text-sm"
                  >
                    <span className="font-semibold text-dark adm-text flex-1 min-w-[120px]">
                      {m.product_name}
                    </span>
                    <span
                      className={clsx(
                        "font-bold",
                        m.quantity_delta < 0 ? "text-red-600" : "text-emerald-600"
                      )}
                    >
                      {m.quantity_delta > 0 ? "+" : ""}
                      {m.quantity_delta}
                    </span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full adm-bg adm-text-muted">
                      {reasonLabel(m.reason)}
                    </span>
                    <span className="text-muted adm-text-muted text-xs ml-auto">
                      {formatTime(m.created_at)}
                    </span>
                  </div>
                ))}
                {movements.length === 0 && (
                  <p className="text-center text-muted adm-text-muted py-8 text-sm">
                    Nema promjena u periodu
                  </p>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Add bottom sheet */}
      <div
        className={clsx(
          "fixed inset-0 z-40 transition",
          showAdd ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        <button
          type="button"
          aria-label="Zatvori"
          className={clsx(
            "absolute inset-0 bg-black/50 transition-opacity",
            showAdd ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setShowAdd(false)}
        />
        <div
          className={clsx(
            "absolute bottom-0 left-0 right-0 adm-surface adm-border border-t rounded-t-3xl p-5 pb-8 max-w-lg mx-auto transition-transform duration-300",
            showAdd ? "translate-y-0" : "translate-y-full"
          )}
        >
          <h3 className="font-extrabold text-dark adm-text mb-4">Dodaj artikal</h3>
          <div className="space-y-3">
            <select
              value={newProductId}
              onChange={(e) => {
                setNewProductId(e.target.value);
                const p = menuProducts.find((x) => x.id === e.target.value);
                if (p) setNewName(p.name);
              }}
              className="w-full min-h-[44px] px-3 rounded-xl adm-border border text-sm adm-bg adm-text"
            >
              <option value="">— Proizvod s menija —</option>
              {menuProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              placeholder="Naziv"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl adm-border border text-sm adm-bg adm-text"
            />
            <input
              type="number"
              inputMode="decimal"
              placeholder="npr. 20"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl adm-border border text-sm adm-bg adm-text"
            />
            <input
              placeholder="Jedinica"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl adm-border border text-sm adm-bg adm-text"
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="flex-1 min-h-[44px] rounded-xl adm-border border font-bold text-sm adm-text"
              >
                Odustani
              </button>
              <button
                type="button"
                onClick={() => void handleAdd()}
                className="flex-1 min-h-[44px] rounded-xl bg-primary text-white font-bold text-sm"
              >
                Spremi
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Report modal */}
      {showReport && (
        <div className="fixed inset-0 z-50 adm-bg flex flex-col overflow-hidden">
          <header className="flex items-center justify-between px-4 py-4 border-b adm-border shrink-0">
            <h2 className="text-lg font-extrabold text-dark adm-text">
              Izvještaj — {formatTodayDate()}
            </h2>
            <button
              type="button"
              onClick={() => setShowReport(false)}
              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-[var(--adm-surface-2)]"
              aria-label="Zatvori"
            >
              <X size={22} className="adm-text" />
            </button>
          </header>
          <div className="flex-1 overflow-auto p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase text-muted adm-text-muted border-b adm-border">
                    <th className="py-2 pr-2">Artikal</th>
                    <th className="py-2 pr-2">Početak dana</th>
                    <th className="py-2 pr-2">Prodano danas</th>
                    <th className="py-2 pr-2">Trenutno stanje</th>
                    <th className="py-2">Prihod</th>
                  </tr>
                </thead>
                <tbody className="divide-y adm-border">
                  {reportRows.map((r) => (
                    <tr key={r.id} className="adm-text">
                      <td className="py-2 pr-2 font-semibold">{r.name}</td>
                      <td className="py-2 pr-2">
                        {r.start} {r.unit}
                      </td>
                      <td className="py-2 pr-2">
                        {r.sold} {r.unit}
                      </td>
                      <td className="py-2 pr-2">
                        {r.current} {r.unit}
                      </td>
                      <td className="py-2 text-muted adm-text-muted">—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted adm-text-muted mt-4">
              Prihod će biti dostupan kada se poveže cijena artikla.
            </p>
          </div>
          <div className="p-4 border-t adm-border flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowReport(false)}
              className="flex-1 min-h-[44px] rounded-xl adm-border border font-bold text-sm adm-text"
            >
              Zatvori
            </button>
            <button
              type="button"
              onClick={() => void copyReportText()}
              className="flex-1 min-h-[44px] rounded-xl bg-primary text-white font-bold text-sm"
            >
              Kopiraj kao tekst
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
