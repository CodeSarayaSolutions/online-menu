"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Wine, ChefHat } from "lucide-react";
import * as tabService from "@/services/tabService";
import type { OpenTabRow } from "@/services/tabService";
import { performAction } from "@/services/actionService";
import { useOperationalText } from "@/hooks/useOperationalText";

function optionsText(value: unknown){
 const options=value as {variations?:{optionLabel:string}[];addons?:{name:string;quantity:number}[];note?:string}|null;
 return [...(options?.variations??[]).map(v=>v.optionLabel),...(options?.addons??[]).map(a=>a.quantity+'× '+a.name),options?.note??''].filter(Boolean).join(' · ');
}
export default function BarActiveTabs({ restaurantId, station = "bar" }: { restaurantId: string; station?: "bar" | "kitchen" }) {
  const t = useOperationalText();
  const [tabs, setTabs] = useState<OpenTabRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const generation = ++sequence.current;
    try { const result = await tabService.getOpenTabs(restaurantId); if (generation === sequence.current) { setTabs(result); setError(false); } }
    catch { if (generation === sequence.current) setError(true); }
    finally { if (generation === sequence.current) setLoaded(true); }
  }, [restaurantId]);
  useEffect(() => {
    setTabs([]); setLoaded(false); void refresh();
    const unsubscribe = tabService.subscribeToTabs(restaurantId, { onTabChange: () => void refresh(), onItemChange: () => void refresh() });
    // Realtime reconnects and sleeping tablets must recover persisted acknowledgements.
    const focused = () => { if (!document.hidden) void refresh(); };
    window.addEventListener("hos:tabs-changed", focused); window.addEventListener("focus", focused); document.addEventListener("visibilitychange", focused);
    const timer = window.setInterval(focused, 30000);
    return () => { sequence.current++; unsubscribe(); clearInterval(timer); window.removeEventListener("hos:tabs-changed", focused); window.removeEventListener("focus", focused); document.removeEventListener("visibilitychange", focused); };
  }, [restaurantId, refresh]);
  const pending = tabs.map(tab => ({ ...tab, lines: (tab.tab_items ?? []).filter(i => i.fire_status === "fired" && (station === "bar" || i.station === "kitchen" || i.station === "both") && i.quantity > (station === "bar" ? i.bar_done_quantity : i.kitchen_done_quantity)) })).filter(tab => tab.lines.length);
  const done = async (tab: typeof pending[number]) => {
    if (busy) return; setBusy(tab.id);
    try { await performAction("station.done", restaurantId, { tabId: tab.id, station, lines: tab.lines.map(i => ({ id: i.id, quantity: i.quantity })) }); await refresh(); }
    catch { setError(true); } finally { setBusy(null); }
  };
  const Icon = station === "bar" ? Wine : ChefHat;
  return <section className="p-4 space-y-4"><header className="flex items-center gap-2"><Icon size={22} /><h2 className="text-xl font-bold">{station === "bar" ? t("Priprema u baru", "Bar preparation") : t("Priprema u kuhinji", "Kitchen preparation")}</h2></header>
    {error && <div role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t("Osvježavanje nije uspjelo. Pokušajte ponovo.", "Couldn't refresh. Please try again.")} <button onClick={() => void refresh()} className="min-h-[44px] font-bold underline">{t("Ponovi", "Retry")}</button></div>}
    {!loaded ? <p>{t("Učitavanje…", "Loading…")}</p> : !pending.length ? <p className="adm-surface border adm-border rounded-xl p-6 text-center adm-text-muted">{t("Sve je pripremljeno.", "Everything is prepared.")}</p> : <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{pending.map(tab => <article key={tab.id} className="adm-surface border adm-border rounded-2xl p-4 space-y-4"><header><h3 className="font-extrabold text-lg">{tab.table_label}</h3><p className="text-xs adm-text-muted">{tab.waiter_name} · #{tab.id.slice(-6).toUpperCase()}</p>{tab.origin === "guest" && <p className="text-xs text-sky-700 font-semibold">{t("Narudžba gosta", "Guest order")}</p>}</header><ul className="space-y-2">{tab.lines.map(line => <li key={line.id} className="text-base"><strong>{line.quantity - (station === "bar" ? line.bar_done_quantity : line.kitchen_done_quantity)}×</strong> {line.product_name}{line.source_order_id&&<span className="block text-xs adm-text-muted">#{line.source_order_id.slice(-8).toUpperCase()}</span>}{optionsText(line.options)&&<span className="block text-sm">{optionsText(line.options)}</span>}{station === "bar" && (line.station === "kitchen" || line.station === "both") && <span className="block text-xs adm-text-muted">{line.kitchen_done_quantity >= line.quantity ? t("Kuhinja: spremno", "Kitchen: ready") : t("Kuhinja: priprema", "Kitchen: preparing")}</span>}</li>)}</ul><button disabled={!!busy} onClick={() => void done(tab)} className="w-full min-h-[48px] rounded-xl bg-emerald-600 text-white font-bold flex justify-center items-center gap-2 disabled:opacity-50"><Check size={18} />{t("Gotovo", "Done")}</button></article>)}</div>}
  </section>;
}
