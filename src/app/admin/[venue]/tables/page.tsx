"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid, Plus, Pencil, Trash2, X, Users, QrCode } from "lucide-react";
import TableQrModal from "@/components/admin/TableQrModal";
import * as tableService from "@/services/tableService";
import type { Tables } from "@/types/supabase";
import clsx from "clsx";

type TableRow = Tables<"restaurant_tables">;

export default function TablesPage() {
  const params = useParams();
  const venueSlug = typeof params.venue === "string" ? params.venue : "";

  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editCapacity, setEditCapacity] = useState(4);
  const [newLabel, setNewLabel] = useState("");
  const [newCapacity, setNewCapacity] = useState(4);
  const [error, setError] = useState("");
  const [qrTable, setQrTable] = useState<TableRow | null>(null);

  const load = useCallback(async () => {
    if (!venueSlug) return;
    setLoading(true);
    try {
      const rows = await tableService.getAllTables(venueSlug);
      setTables(rows.filter((t) => t.is_active));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Učitavanje stolova nije uspjelo");
    } finally {
      setLoading(false);
    }
  }, [venueSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  const suggestLabel = () => {
    const n = tables.length + 1;
    setNewLabel(`Stol ${n}`);
  };

  const handleCreate = async () => {
    if (!newLabel.trim()) return;
    try {
      await tableService.createTable(
        venueSlug,
        newLabel.trim(),
        newCapacity,
        tables.length
      );
      setShowAdd(false);
      setNewLabel("");
      setNewCapacity(4);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kreiranje nije uspjelo");
    }
  };

  const startEdit = (t: TableRow) => {
    setEditingId(t.id);
    setEditLabel(t.label);
    setEditCapacity(t.capacity);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await tableService.updateTable(editingId, {
        label: editLabel.trim(),
        capacity: editCapacity,
      });
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Spremanje nije uspjelo");
    }
  };

  const deactivate = async (id: string) => {
    if (!confirm("Deaktivirati ovaj stol?")) return;
    try {
      await tableService.deleteTable(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Brisanje nije uspjelo");
    }
  };

  return (
    <div className="p-5 lg:p-8 max-w-[1100px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-dark adm-text tracking-tight">Stolovi</h1>
          <p className="text-sm text-muted adm-text-muted mt-1">
            {tables.length} aktivnih stolova · raspored za konobare
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            suggestLabel();
            setShowAdd(true);
          }}
          className="flex items-center gap-2 bg-gradient-to-r from-primary to-amber-500 text-white px-5 py-2.5 rounded-2xl text-sm font-bold shadow-glow hover:brightness-105 transition"
        >
          <Plus size={16} /> Novi stol
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2 mb-4">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tables.length === 0 ? (
        <div className="adm-surface adm-border border rounded-2xl adm-border shadow-soft p-16 text-center">
          <LayoutGrid size={40} className="text-primary/30 mx-auto mb-4" />
          <p className="font-semibold text-dark adm-text">Nema stolova</p>
          <p className="text-sm text-muted adm-text-muted mt-1">Dodajte prvi stol za konobarski rad</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {tables.map((t) => (
            <div
              key={t.id}
              className="adm-surface adm-border border rounded-2xl adm-border shadow-soft p-5 flex flex-col items-center text-center relative"
            >
              {editingId === t.id ? (
                <div className="w-full space-y-3">
                  <input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-primary/20 text-sm font-bold text-center"
                  />
                  <p className="text-[10px] text-muted adm-text-muted text-center -mt-1">
                    Mora biti jedinstveno (npr. Stol 1, Terasa A)
                  </p>
                  <input
                    type="number"
                    min={1}
                    value={editCapacity}
                    onChange={(e) => setEditCapacity(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 rounded-xl border border-primary/20 text-sm text-center"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="flex-1 py-2 rounded-xl border text-xs font-bold"
                    >
                      Odustani
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveEdit()}
                      className="flex-1 py-2 rounded-xl bg-primary text-white text-xs font-bold"
                    >
                      Spremi
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                    <LayoutGrid size={24} className="text-primary" />
                  </div>
                  <h3 className="text-lg font-extrabold text-dark adm-text">{t.label}</h3>
                  <p className="text-xs text-muted adm-text-muted flex items-center gap-1 mt-1">
                    <Users size={12} /> {t.capacity} mjesta
                  </p>
                  <div className="flex gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => setQrTable(t)}
                      className="p-2 rounded-xl hover:bg-[var(--adm-surface-2)] text-muted adm-text-muted hover:text-primary transition"
                      title="QR kod"
                    >
                      <QrCode size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(t)}
                      className="p-2 rounded-xl hover:bg-[var(--adm-surface-2)] text-muted adm-text-muted hover:text-primary transition"
                      title="Uredi"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void deactivate(t.id)}
                      className="p-2 rounded-xl hover:bg-red-50 text-muted adm-text-muted hover:text-accent-red transition"
                      title="Deaktiviraj"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {qrTable && venueSlug && (
          <TableQrModal
            table={qrTable}
            venueSlug={venueSlug}
            onClose={() => setQrTable(null)}
          />
        )}
        {showAdd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => setShowAdd(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 12 }}
              className="adm-surface adm-border border rounded-3xl p-6 max-w-md w-full shadow-elevated"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-extrabold text-dark adm-text">Novi stol</h3>
                <button type="button" onClick={() => setShowAdd(false)} className="p-1.5 rounded-lg hover:bg-[var(--adm-surface-2)]">
                  <X size={18} />
                </button>
              </div>
              <label className="block text-[10px] font-bold text-muted adm-text-muted uppercase mb-1.5">Naziv</label>
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Stol 1"
                className="w-full px-4 py-3 rounded-xl border border adm-border mb-1 text-sm"
              />
              <p className="text-[10px] text-muted adm-text-muted mb-4">
                Mora biti jedinstveno (npr. Stol 1, Terasa A)
              </p>
              <label className="block text-[10px] font-bold text-muted adm-text-muted uppercase mb-1.5">Kapacitet</label>
              <input
                type="number"
                min={1}
                value={newCapacity}
                onChange={(e) => setNewCapacity(parseInt(e.target.value, 10) || 4)}
                className="w-full px-4 py-3 rounded-xl border border adm-border mb-6 text-sm"
              />
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={!newLabel.trim()}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-primary to-amber-500 text-white font-bold text-sm disabled:opacity-40"
              >
                Kreiraj stol
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
