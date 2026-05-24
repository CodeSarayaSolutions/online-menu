"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Package, Plus, Trash2, AlertTriangle } from "lucide-react";
import * as inventoryService from "@/services/inventoryService";
import * as productService from "@/services/productService";
import type { Tables } from "@/types/supabase";
import clsx from "clsx";

type InvRow = Tables<"inventory">;
type MovRow = Tables<"inventory_movements">;

export default function InventoryPage() {
  const params = useParams();
  const venueSlug = typeof params.venue === "string" ? params.venue : "";

  const [rows, setRows] = useState<InvRow[]>([]);
  const [movements, setMovements] = useState<MovRow[]>([]);
  const [menuProducts, setMenuProducts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [newProductId, setNewProductId] = useState("");
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState(0);
  const [newUnit, setNewUnit] = useState("kom");
  const [newThreshold, setNewThreshold] = useState<number | "">("");

  const load = useCallback(async () => {
    if (!venueSlug) return;
    setLoading(true);
    try {
      const [inv, mov, prods] = await Promise.all([
        inventoryService.getInventory(venueSlug),
        inventoryService.getMovements(
          venueSlug,
          fromDate ? `${fromDate}T00:00:00.000Z` : undefined,
          toDate ? `${toDate}T23:59:59.999Z` : undefined
        ),
        productService.getProducts(venueSlug),
      ]);
      setRows(inv);
      setMovements(mov);
      setMenuProducts(prods.map((p) => ({ id: p.id, name: p.name })));
    } finally {
      setLoading(false);
    }
  }, [venueSlug, fromDate, toDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = async () => {
    const name =
      newName.trim() ||
      menuProducts.find((p) => p.id === newProductId)?.name ||
      newProductId;
    if (!newProductId || !name) return;
    await inventoryService.upsertInventoryItem(
      venueSlug,
      newProductId,
      name,
      newQty,
      newUnit,
      newThreshold === "" ? null : Number(newThreshold)
    );
    setShowAdd(false);
    setNewProductId("");
    setNewName("");
    setNewQty(0);
    await load();
  };

  const updateRow = async (row: InvRow, field: keyof InvRow, value: string | number) => {
    await inventoryService.updateInventoryRow(row.id, {
      [field]: value,
      updated_at: new Date().toISOString(),
    } as Partial<InvRow>);
    await load();
  };

  const removeRow = async (id: string) => {
    if (!confirm("Obrisati stavku iz inventara?")) return;
    await inventoryService.deleteInventoryItem(id);
    await load();
  };

  const isLow = (r: InvRow) =>
    r.low_stock_threshold != null && Number(r.quantity) <= Number(r.low_stock_threshold);

  return (
    <div className="p-5 lg:p-8 max-w-[1200px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-dark adm-text">Inventar</h1>
          <p className="text-sm text-muted adm-text-muted mt-1">Zalihe i kretanje po narudžbama s kartica</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-primary to-amber-500 text-white px-5 py-2.5 rounded-2xl text-sm font-bold shadow-glow"
        >
          <Plus size={16} /> Dodaj artikal
        </button>
      </div>

      {showAdd && (
        <div className="adm-surface adm-border border rounded-2xl-primary/20 p-5 mb-6 shadow-soft space-y-3">
          <h3 className="font-bold text-dark adm-text text-sm">Nova stavka inventara</h3>
          <select
            value={newProductId}
            onChange={(e) => {
              setNewProductId(e.target.value);
              const p = menuProducts.find((x) => x.id === e.target.value);
              if (p) setNewName(p.name);
            }}
            className="w-full px-3 py-2 rounded-xl border text-sm"
          >
            <option value="">— Proizvod s menija —</option>
            {menuProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Naziv (ili prilagođeni)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border text-sm"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              placeholder="Količina"
              value={newQty}
              onChange={(e) => setNewQty(parseFloat(e.target.value) || 0)}
              className="px-3 py-2 rounded-xl border text-sm"
            />
            <input
              placeholder="Jedinica"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              className="px-3 py-2 rounded-xl border text-sm"
            />
            <input
              type="number"
              placeholder="Min. zaliha"
              value={newThreshold}
              onChange={(e) =>
                setNewThreshold(e.target.value === "" ? "" : parseFloat(e.target.value))
              }
              className="px-3 py-2 rounded-xl border text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-2 border rounded-xl text-sm font-bold">
              Odustani
            </button>
            <button
              type="button"
              onClick={() => void handleAdd()}
              className="flex-1 py-2 bg-primary text-white rounded-xl text-sm font-bold"
            >
              Spremi
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="adm-surface adm-border border rounded-2xl border shadow-soft overflow-hidden mb-8">
            <table className="w-full text-sm">
              <thead className="adm-bg text-left text-[10px] font-bold uppercase text-muted adm-text-muted">
                <tr>
                  <th className="px-4 py-3">Artikal</th>
                  <th className="px-4 py-3">Stanje</th>
                  <th className="px-4 py-3">Jedinica</th>
                  <th className="px-4 py-3">Min.</th>
                  <th className="px-4 py-3">Ažurirano</th>
                  <th className="px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className={clsx(isLow(r) && "bg-amber-50/80")}
                  >
                    <td className="px-4 py-3 font-semibold text-dark adm-text">
                      {isLow(r) && (
                        <AlertTriangle size={14} className="inline text-amber-600 mr-1" />
                      )}
                      {r.product_name}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        className="w-20 px-2 py-1 rounded-lg border text-sm"
                        value={Number(r.quantity)}
                        onChange={(e) =>
                          void updateRow(r, "quantity", parseFloat(e.target.value) || 0)
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        className="w-16 px-2 py-1 rounded-lg border text-sm"
                        value={r.unit}
                        onChange={(e) => void updateRow(r, "unit", e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        className="w-20 px-2 py-1 rounded-lg border text-sm"
                        value={r.low_stock_threshold ?? ""}
                        onChange={(e) =>
                          void updateRow(
                            r,
                            "low_stock_threshold",
                            e.target.value === "" ? 0 : parseFloat(e.target.value)
                          )
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-muted adm-text-muted text-xs">
                      {new Date(r.updated_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void removeRow(r.id)}
                        className="text-muted adm-text-muted hover:text-red-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <p className="text-center text-muted adm-text-muted py-10 text-sm">Inventar je prazan</p>
            )}
          </div>

          <h2 className="text-lg font-extrabold text-dark adm-text mb-3 flex items-center gap-2">
            <Package size={18} /> Kretanje zaliha
          </h2>
          <div className="flex flex-wrap gap-2 mb-4">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 rounded-xl border text-sm"
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 rounded-xl border text-sm"
            />
            <button
              type="button"
              onClick={() => void load()}
              className="px-4 py-2 rounded-xl adm-bg text-sm font-semibold"
            >
              Filtriraj
            </button>
          </div>
          <div className="adm-surface adm-border border rounded-2xl border shadow-soft divide-y max-h-[400px] overflow-y-auto">
            {movements.map((m) => (
              <div key={m.id} className="px-4 py-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span className="font-semibold text-dark adm-text">{m.product_name}</span>
                <span
                  className={clsx(
                    "font-bold",
                    m.quantity_delta < 0 ? "text-red-600" : "text-emerald-600"
                  )}
                >
                  {m.quantity_delta > 0 ? "+" : ""}
                  {m.quantity_delta}
                </span>
                <span className="text-muted adm-text-muted">{m.reason}</span>
                <span className="text-muted adm-text-muted text-xs ml-auto">
                  {new Date(m.created_at).toLocaleString()}
                </span>
              </div>
            ))}
            {movements.length === 0 && (
              <p className="text-center text-muted adm-text-muted py-8 text-sm">Nema promjena u periodu</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
