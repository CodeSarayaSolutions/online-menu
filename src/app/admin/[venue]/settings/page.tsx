"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Settings, ShoppingBag, Eye, Check, Loader2 } from "lucide-react";
import clsx from "clsx";
import { useCmsStore } from "@/store/cmsStore";

export default function VenueSettingsPage() {
  const { venue } = useParams<{ venue: string }>();
  const venueSlug = typeof venue === "string" ? venue : "";

  const componentStyles = useCmsStore((s) => s.componentStyles);
  const updateComponentStyles = useCmsStore((s) => s.updateComponentStyles);
  const saveActiveToAllRestaurants = useCmsStore((s) => s.saveActiveToAllRestaurants);

  const orderingEnabled = !componentStyles.viewOnlyMode;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const setOrderingEnabled = async (enabled: boolean) => {
    if (!venueSlug || saving) return;
    setSaving(true);
    setSaved(false);
    updateComponentStyles({ viewOnlyMode: !enabled });
    try {
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          saveActiveToAllRestaurants(venueSlug);
          resolve();
        }, 0);
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-dark adm-text tracking-tight flex items-center gap-2">
          <Settings size={26} className="text-primary" />
          Postavke
        </h1>
        <p className="text-sm text-muted adm-text-muted mt-1">
          Upravljajte ponašanjem online menija za goste
        </p>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="adm-surface adm-border border rounded-2xl shadow-soft overflow-hidden"
      >
        <div className="px-5 py-4 border-b adm-border">
          <h2 className="text-[15px] font-extrabold text-dark adm-text">Online meni</h2>
          <p className="text-[12px] text-muted adm-text-muted mt-0.5">
            Odredite da li gosti mogu naručivati ili samo pregledavati meni
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div
            className={clsx(
              "rounded-2xl border p-4 transition-colors",
              orderingEnabled
                ? "border-emerald-200 bg-emerald-50/50"
                : "border-amber-200 bg-amber-50/50"
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={clsx(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                    orderingEnabled ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                  )}
                >
                  {orderingEnabled ? <ShoppingBag size={18} /> : <Eye size={18} />}
                </div>
                <div>
                  <p className="text-[14px] font-extrabold text-dark adm-text">
                    {orderingEnabled ? "Narudžbe su uključene" : "Samo pregled menija"}
                  </p>
                  <p className="text-[12px] text-muted adm-text-muted mt-1 leading-relaxed">
                    {orderingEnabled
                      ? "Gosti mogu dodavati stavke u korpu, pregledati narudžbu i poslati je u kuhinju (uz QR kod stola)."
                      : "Gosti mogu pregledavati meni, ali ne vide dugmad za narudžbu, korpu ni checkout."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={orderingEnabled}
                disabled={saving}
                onClick={() => void setOrderingEnabled(!orderingEnabled)}
                className={clsx(
                  "relative w-12 h-7 rounded-full transition-colors shrink-0 disabled:opacity-60",
                  orderingEnabled ? "bg-emerald-500" : "bg-gray-300"
                )}
              >
                <span
                  className={clsx(
                    "absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform",
                    orderingEnabled && "translate-x-5"
                  )}
                />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[12px] text-muted adm-text-muted min-h-[20px]">
            {saving && (
              <>
                <Loader2 size={14} className="animate-spin" />
                Spremanje…
              </>
            )}
            {!saving && saved && (
              <>
                <Check size={14} className="text-emerald-500" />
                <span className="text-emerald-600 font-semibold">Sačuvano</span>
              </>
            )}
          </div>

          <div className="rounded-xl adm-bg px-4 py-3 text-[11px] text-muted adm-text-muted leading-relaxed">
            <strong className="text-dark adm-text">Napomena:</strong> promjena se odmah primjenjuje na
            javni meni (<code className="text-[10px]">/{venueSlug || "venue"}</code>). Gosti koji već imaju
            stavke u korpi neće moći završiti narudžbu dok je pregled uključen.
          </div>
        </div>
      </motion.section>
    </div>
  );
}
