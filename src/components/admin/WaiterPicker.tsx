"use client";

import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import PinPad from "@/components/admin/PinPad";
import type { AppUser } from "@/types/auth";
import { getWaiterHistory, setWaiterSession, type WaiterSession } from "@/lib/waiter-session";
import clsx from "clsx";

const AVATAR_COLORS = [
  "bg-violet-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-indigo-500",
];

type Props = {
  venueSlug: string;
  users: AppUser[];
  onLogin: (session: WaiterSession) => void;
};

type PinMode = "verify" | "set";

function avatarColor(name: string) {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

export default function WaiterPicker({ venueSlug, users, onLogin }: Props) {
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [pinMode, setPinMode] = useState<PinMode>("verify");
  const [pinError, setPinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sortedUsers = useMemo(() => {
    const history = getWaiterHistory();
    const historyIndex = new Map(history.map((id, i) => [id, i]));
    return [...users].sort((a, b) => {
      const ah = historyIndex.get(a.id) ?? 999;
      const bh = historyIndex.get(b.id) ?? 999;
      if (ah !== bh) return ah - bh;
      return a.name.localeCompare(b.name, "bs");
    });
  }, [users]);

  const goBack = () => {
    setSelectedUser(null);
    setPinMode("verify");
    setPinError(null);
  };

  const completeLogin = (user: { id: string; name: string; avatar: string | null }) => {
    const session: WaiterSession = {
      waiterId: user.id,
      waiterName: user.name,
      waiterAvatar: user.avatar,
      venueSlug,
      loginTime: new Date().toISOString(),
    };
    setWaiterSession(session);
    onLogin(session);
  };

  const submitPin = async (pin: string) => {
    if (!selectedUser || busy) return;
    setBusy(true);
    setPinError(null);

    try {
      if (pinMode === "set") {
        const setRes = await fetch("/api/waiter/set-pin", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: selectedUser.id, pin }),
        });
        const setData = (await setRes.json()) as { error?: string };
        if (!setRes.ok) {
          setPinError(setData.error ?? "Postavljanje PIN-a nije uspjelo");
          return;
        }
      }

      const verifyRes = await fetch("/api/waiter/verify-pin", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.id, pin }),
      });
      const verifyData = (await verifyRes.json()) as {
        ok?: boolean;
        reason?: string;
        user?: { id: string; name: string; avatar: string | null };
        error?: string;
      };

      if (!verifyRes.ok) {
        setPinError(verifyData.error ?? "Provjera PIN-a nije uspjela");
        return;
      }

      if (verifyData.ok && verifyData.user) {
        completeLogin(verifyData.user);
        return;
      }

      if (verifyData.reason === "no_pin") {
        setPinMode("set");
        setPinError(null);
        return;
      }

      if (verifyData.reason === "wrong_pin") {
        setPinError("Pogrešan PIN");
        return;
      }

      setPinError("Neuspjela prijava");
    } catch {
      setPinError("Greška mreže");
    } finally {
      setBusy(false);
    }
  };

  if (!selectedUser) {
    return (
      <div className="min-h-[calc(100vh-64px)] adm-bg flex flex-col items-center px-4 py-10">
        <h1 className="text-2xl font-extrabold text-dark adm-text text-center">Ko si ti?</h1>
        <p className="text-sm text-muted adm-text-muted mt-2 mb-8">Odaberi svoje ime</p>
        <div className="grid grid-cols-2 gap-3 w-full max-w-md">
          {sortedUsers.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => {
                setSelectedUser(user);
                setPinMode("verify");
                setPinError(null);
              }}
              className="adm-surface adm-border border rounded-2xl p-4 flex flex-col items-center justify-center min-h-[88px] min-w-0 active:scale-[0.98] transition"
            >
              {user.avatar ? (
                <span className="text-3xl mb-2">{user.avatar}</span>
              ) : (
                <span
                  className={clsx(
                    "w-12 h-12 rounded-full text-white font-bold text-lg flex items-center justify-center mb-2",
                    avatarColor(user.name)
                  )}
                >
                  {user.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="text-sm font-bold text-dark adm-text text-center leading-tight">
                {user.name}
              </span>
            </button>
          ))}
        </div>
        {sortedUsers.length === 0 && (
          <p className="text-sm text-muted adm-text-muted">Nema korisnika za prikaz.</p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] adm-bg flex flex-col px-4 py-6 max-w-md mx-auto w-full">
      <button
        type="button"
        onClick={goBack}
        className="flex items-center gap-2 text-sm font-semibold text-muted adm-text-muted mb-6 min-h-[44px]"
      >
        <ArrowLeft size={20} /> Nazad
      </button>

      <div className="flex flex-col items-center mb-6">
        {selectedUser.avatar ? (
          <span className="text-5xl mb-3">{selectedUser.avatar}</span>
        ) : (
          <span
            className={clsx(
              "w-16 h-16 rounded-full text-white font-bold text-2xl flex items-center justify-center mb-3",
              avatarColor(selectedUser.name)
            )}
          >
            {selectedUser.name.charAt(0).toUpperCase()}
          </span>
        )}
        <h2 className="text-xl font-extrabold text-dark adm-text">{selectedUser.name}</h2>
        <p className="text-sm text-muted adm-text-muted mt-1">
          {pinMode === "set" ? "Postavite vaš PIN" : "Unesite PIN"}
        </p>
      </div>

      <PinPad
        onComplete={(pin) => void submitPin(pin)}
        onCancel={goBack}
        error={pinError}
        loading={busy}
      />
    </div>
  );
}
