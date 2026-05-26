"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Download, Printer, X } from "lucide-react";
import type { Tables } from "@/types/supabase";
import { buildTableMenuUrl } from "@/lib/table-qr-url";
import { loadQrCodeScript, qrCanvasFromContainer, renderQrCode } from "@/lib/qrcode-loader";

type TableRow = Tables<"restaurant_tables">;

type Props = {
  table: TableRow;
  venueSlug: string;
  onClose: () => void;
};

export default function TableQrModal({ table, venueSlug, onClose }: Props) {
  const qrRef = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const menuUrl = buildTableMenuUrl(window.location.origin, venueSlug, table);
    setUrl(menuUrl);

    let cancelled = false;
    (async () => {
      try {
        await loadQrCodeScript();
        if (cancelled || !qrRef.current) return;
        renderQrCode(qrRef.current, menuUrl, 240);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "QR kod nije učitan");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [table, venueSlug]);

  const handleDownload = () => {
    if (!qrRef.current) return;
    const canvas = qrCanvasFromContainer(qrRef.current);
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `qr-${table.label.replace(/\s+/g, "-").toLowerCase()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handlePrint = () => {
    const canvas = qrRef.current ? qrCanvasFromContainer(qrRef.current) : null;
    const dataUrl = canvas?.toDataURL("image/png") ?? "";
    const win = window.open("", "_blank", "width=400,height=520");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head><title>${table.label} — QR</title></head>
        <body style="font-family:system-ui,sans-serif;text-align:center;padding:32px;">
          <h1 style="font-size:22px;margin:0 0 8px;">${table.label}</h1>
          <p style="color:#666;font-size:12px;margin:0 0 24px;">Skenirajte za narudžbu</p>
          <img src="${dataUrl}" width="240" height="240" alt="QR kod" />
          <p style="font-size:10px;color:#888;margin-top:16px;word-break:break-all;">${url}</p>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 12 }}
        className="adm-surface adm-border border rounded-3xl p-6 max-w-sm w-full shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-extrabold text-dark adm-text">QR kod — {table.label}</h3>
            <p className="text-[11px] text-muted adm-text-muted mt-0.5">Link za goste na stolu</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--adm-surface-2)]">
            <X size={18} />
          </button>
        </div>

        <div className="flex justify-center mb-4">
          <div className="relative w-[256px] min-h-[256px] flex items-center justify-center">
            <div
              ref={qrRef}
              className={`rounded-xl overflow-hidden bg-white p-2 ${loading || error ? "invisible absolute inset-0" : ""}`}
            />
            {loading ? (
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : error ? (
              <p className="text-sm text-red-600 text-center px-3">{error}</p>
            ) : null}
          </div>
        </div>

        <p className="text-[11px] text-muted adm-text-muted break-all text-center mb-4 px-2">{url}</p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={loading || !!error}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border adm-border text-[13px] font-bold text-dark adm-text hover:bg-[var(--adm-surface-2)] disabled:opacity-40"
          >
            <Download size={15} /> Preuzmi
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={loading || !!error}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-primary to-amber-500 text-white text-[13px] font-bold disabled:opacity-40"
          >
            <Printer size={15} /> Printaj
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
