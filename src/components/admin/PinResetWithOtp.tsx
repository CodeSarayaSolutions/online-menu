"use client";

import { useState } from "react";
import { ArrowLeft, KeyRound } from "lucide-react";
import PinPad from "@/components/admin/PinPad";
import { resetPinWithOtp } from "@/services/authService";
import { getLoginHistoryEntries, type LoginHistoryEntry } from "@/lib/waiter-session";
type Props = {
  onDone: () => void;
  onCancel: () => void;
};

export default function PinResetWithOtp({ onDone, onCancel }: Props) {
  const [history] = useState(() => getLoginHistoryEntries());
  const [selected, setSelected] = useState<LoginHistoryEntry | null>(null);
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"pick" | "otp" | "pin">("pick");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  const submitNewPin = async (pin: string) => {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      await resetPinWithOtp(selected.userId, otp.trim(), pin);
      setSuccess(true);
      setTimeout(() => onDone(), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Greška");
    } finally {
      setBusy(false);
    }
  };

  if (success) {
    return (
      <p className="text-sm text-center text-accent-green font-semibold py-4">
        PIN je promijenjen. Možete se prijaviti novim PIN-om.
      </p>
    );
  }

  if (step === "pick") {
    if (history.length === 0) {
      return (
        <p className="text-sm text-muted adm-text-muted text-center py-2">
          Nema sačuvanih korisnika. Prvo se prijavite jednom, zatim pokušajte ponovo.
        </p>
      );
    }
    return (
      <div className="mb-4">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-muted adm-text-muted underline mb-3"
        >
          Nazad na prijavu
        </button>
        <p className="text-sm font-bold text-dark adm-text mb-3">Odaberite račun</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {history.map((entry) => (
            <button
              key={entry.userId}
              type="button"
              onClick={() => {
                setSelected(entry);
                setStep("otp");
                setError(null);
              }}
              className="shrink-0 px-3 py-2 rounded-xl adm-surface adm-border border text-xs font-bold text-dark adm-text"
            >
              {entry.name || entry.email}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === "otp") {
    return (
      <div className="mb-4">
        <button
          type="button"
          onClick={() => {
            setStep("pick");
            setOtp("");
            setError(null);
          }}
          className="flex items-center gap-2 text-sm font-semibold text-muted adm-text-muted mb-3"
        >
          <ArrowLeft size={16} /> Nazad
        </button>
        <p className="text-sm font-bold text-dark adm-text mb-1">{selected?.name}</p>
        <p className="text-xs text-muted adm-text-muted mb-3">
          Unesite 6-cifreni kod koji vam je dao administrator
        </p>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          className="w-full px-4 py-3 rounded-xl border border adm-border text-center text-lg font-mono tracking-[0.3em] adm-bg text-dark adm-text"
        />
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        <button
          type="button"
          disabled={otp.length !== 6}
          onClick={() => {
            setStep("pin");
            setError(null);
          }}
          className="w-full mt-3 py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-40"
        >
          Dalje — novi PIN
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => {
          setStep("otp");
          setError(null);
        }}
        className="flex items-center gap-2 text-sm font-semibold text-muted adm-text-muted mb-3"
      >
        <ArrowLeft size={16} /> Nazad
      </button>
      <p className="text-sm font-bold text-dark adm-text mb-1 flex items-center gap-2">
        <KeyRound size={14} className="text-primary" />
        Novi PIN (3 cifre)
      </p>
      <PinPad onComplete={(pin) => void submitNewPin(pin)} error={error} loading={busy} />
    </div>
  );
}
