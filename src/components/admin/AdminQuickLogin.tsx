"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import PinPad from "@/components/admin/PinPad";
import { getLoginHistoryEntries, saveLoginToHistory, type LoginHistoryEntry } from "@/lib/waiter-session";
import { pinSignIn, type SessionPayload } from "@/services/authService";
import clsx from "clsx";

const AVATAR_COLORS = [
  "bg-violet-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-indigo-500",
];

function avatarColor(name: string) {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

function UserAvatar({ entry }: { entry: LoginHistoryEntry }) {
  if (entry.avatar) {
    return <span className="text-2xl">{entry.avatar}</span>;
  }
  return (
    <span
      className={clsx(
        "w-12 h-12 rounded-full text-white font-bold text-lg flex items-center justify-center",
        avatarColor(entry.name || "?")
      )}
    >
      {(entry.name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

type Props = {
  onSuccess: (session: SessionPayload) => void;
  onShowEmail: () => void;
  highlightEmail?: boolean;
};

export default function AdminQuickLogin({ onSuccess, onShowEmail, highlightEmail }: Props) {
  const [history] = useState(() => getLoginHistoryEntries());
  const [selected, setSelected] = useState<LoginHistoryEntry | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [noPinMessage, setNoPinMessage] = useState(false);
  const [loading, setLoading] = useState(false);

  if (history.length === 0) return null;

  const handlePin = async (pin: string) => {
    if (!selected) return;
    setLoading(true);
    setPinError(null);
    setNoPinMessage(false);

    try {
      const result = await pinSignIn(selected.userId, pin);

      if ("reason" in result) {
        if (result.reason === "no_pin") {
          setNoPinMessage(true);
          onShowEmail();
          setSelected(null);
          return;
        }
        if (result.reason === "wrong_pin") {
          setPinError("Pogrešan PIN");
          return;
        }
        setPinError("Prijava nije uspjela");
        return;
      }

      const session = result as SessionPayload;
      saveLoginToHistory({
        userId: session.user.id,
        name: session.user.name,
        avatar: session.user.avatar,
        email: session.user.email,
      });
      onSuccess(session);
    } catch (e) {
      setPinError(e instanceof Error ? e.message : "Greška mreže");
    } finally {
      setLoading(false);
    }
  };

  if (selected) {
    return (
      <div className="mb-6">
        <button
          type="button"
          onClick={() => {
            setSelected(null);
            setPinError(null);
          }}
          className="flex items-center gap-2 text-sm font-semibold text-muted adm-text-muted mb-4 min-h-[44px]"
        >
          <ArrowLeft size={18} /> Nazad
        </button>
        <div className="flex flex-col items-center mb-4">
          <UserAvatar entry={selected} />
          <p className="font-extrabold text-dark adm-text mt-2">{selected.name}</p>
          <p className="text-sm text-muted adm-text-muted">Unesite PIN</p>
        </div>
        <PinPad
          onComplete={(pin) => void handlePin(pin)}
          onCancel={() => {
            setSelected(null);
            setPinError(null);
          }}
          error={pinError}
          loading={loading}
        />
        <button
          type="button"
          onClick={() => {
            onShowEmail();
            setSelected(null);
            setPinError(null);
          }}
          className="text-xs text-muted adm-text-muted underline cursor-pointer mt-2 text-center w-full"
        >
          Koristite lozinku
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <h3 className="text-sm font-extrabold text-dark adm-text mb-3">Brza prijava</h3>
      {noPinMessage && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
          PIN nije postavljen. Prijavite se emailom prvi put.
        </p>
      )}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
        {history.map((entry) => (
          <button
            key={entry.userId}
            type="button"
            onClick={() => {
              setSelected(entry);
              setPinError(null);
              setNoPinMessage(false);
            }}
            className={clsx(
              "snap-start shrink-0 w-[120px] min-h-[100px] adm-surface adm-border border rounded-2xl p-3 flex flex-col items-center justify-center gap-2 active:scale-[0.98] transition",
              highlightEmail && "opacity-60"
            )}
          >
            <UserAvatar entry={entry} />
            <span className="text-xs font-bold text-dark adm-text text-center leading-tight line-clamp-2">
              {entry.name || entry.email}
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onShowEmail}
        className="text-xs text-muted adm-text-muted underline cursor-pointer mt-2 text-center block w-full"
      >
        Prijava lozinkom / novi račun
      </button>
    </div>
  );
}
