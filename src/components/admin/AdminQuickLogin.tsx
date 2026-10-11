"use client";
import { useEffect, useState } from "react";
import { getLoginHistoryEntries } from "@/lib/waiter-session";
import AdminLoginForm from "./AdminLoginForm";
import type { SessionPayload } from "@/services/authService";
import { useOperationalText } from "@/hooks/useOperationalText";

type Props = { onSuccess: (session: SessionPayload) => void; onShowEmail: () => void; onPinReset?: () => void; highlightEmail?: boolean };
export default function AdminQuickLogin({ onSuccess, onShowEmail }: Props) {
  const t = useOperationalText();
  const [history, setHistory] = useState<ReturnType<typeof getLoginHistoryEntries>>([]);
  useEffect(() => { setHistory(getLoginHistoryEntries().filter(entry => entry.email)); }, []);
  const [selected, setSelected] = useState<string | null>(null);
  if (!history.length) return null;
  if (selected) return <div className="mb-6"><button className="min-h-[44px] mb-3 text-sm" onClick={() => setSelected(null)}>{t("Nazad", "Back")}</button><AdminLoginForm key={selected} initialEmail={selected} onSuccess={onSuccess} /></div>;
  return <div className="mb-6"><h3 className="font-bold mb-3">{t("Brza prijava", "Quick sign-in")}</h3><div className="flex gap-3 overflow-x-auto pb-3">{history.map(entry => <button key={entry.userId} onClick={() => setSelected(entry.email!)} className="min-h-[64px] min-w-[90px] p-3 rounded-xl adm-bg border adm-border text-sm font-semibold">{entry.name}</button>)}</div><button onClick={onShowEmail} className="min-h-[44px] text-sm text-primary font-semibold">{t("Drugi račun", "Another account")}</button></div>;
}
