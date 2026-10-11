"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Delete } from "lucide-react";
import clsx from "clsx";
import { useOperationalText } from "@/hooks/useOperationalText";

type PinPadProps = {
  onComplete: (pin: string) => void;
  onCancel?: () => void;
  error?: string | null;
  loading?: boolean;
  value?: string;
  onChange?: (pin: string) => void;
};

export default function PinPad({ onComplete, onCancel, error, loading, value, onChange }: PinPadProps) {
  const t = useOperationalText();
  const [localValue, setLocalValue] = useState("");
  const digits = value ?? localValue;
  const pad = useRef<HTMLDivElement>(null);
  const [shake, setShake] = useState(false);
  useEffect(() => { pad.current?.focus(); }, []);

  const resetDigits = useCallback(() => {
    setLocalValue("");
  }, []);

  useEffect(() => {
    if (error) {
      setShake(true);
      const t = setTimeout(() => setShake(false), 500);
      resetDigits();
      return () => clearTimeout(t);
    }
    return undefined;
  }, [error, resetDigits]);

  const appendDigit = (d: string) => {
    if (loading || digits.length >= 3) return;
    const next = digits + d;
    if (onChange) onChange(next);
    else setLocalValue(next);
    // Controlled onboarding uses an explicit Next button on each step.
    if (!onChange && next.length === 3) {
      onComplete(next);
    }
  };

  const backspace = () => {
    if (loading) return;
    const next = digits.slice(0, -1);
    if (onChange) onChange(next);
    else setLocalValue(next);
  };

  return (
    <div ref={pad} tabIndex={0} role="group" aria-label={t("Trocifreni PIN", "Three-digit PIN")}
      className="w-full rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      onKeyDown={event => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (/^\d$/.test(event.key)) { event.preventDefault(); appendDigit(event.key); }
        else if (event.key === "Backspace" || event.key === "Delete") { event.preventDefault(); backspace(); }
        else if (event.key === "Enter" && event.target === event.currentTarget && digits.length === 3 && !loading) { event.preventDefault(); onComplete(digits); }
      }}>
      <motion.div
        className="flex justify-center gap-4 mb-4"
        animate={shake ? { x: [0, -12, 12, -8, 8, 0] } : { x: 0 }}
        transition={{ duration: 0.45 }}
        role="status"
        aria-label={t(`Uneseno ${digits.length} od 3 cifre`, `${digits.length} of 3 digits entered`)}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            aria-hidden="true"
            className={clsx(
              "w-4 h-4 rounded-full border-2",
              digits.length > i
                ? "bg-primary border-primary"
                : "border-[var(--adm-border)] bg-transparent"
            )}
          />
        ))}
      </motion.div>

      {error && (
        <p className="text-center text-sm font-semibold text-red-600 mb-4">{error}</p>
      )}

      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
          <button
            key={n}
            type="button"
            disabled={loading || digits.length === 3}
            onClick={() => appendDigit(n)}
            className="min-h-[64px] rounded-2xl adm-surface adm-border border text-2xl font-bold text-dark adm-text active:bg-[var(--adm-surface-2)] disabled:opacity-50"
          >
            {n}
          </button>
        ))}
        {onCancel ? (
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="min-h-[64px] rounded-2xl adm-surface adm-border border text-sm font-bold text-muted adm-text-muted active:bg-[var(--adm-surface-2)] disabled:opacity-50"
          >
            {t("Odustani", "Cancel")}
          </button>
        ) : (
          <span className="min-h-[64px]" aria-hidden />
        )}
        <button
          type="button"
          disabled={loading || digits.length === 3}
          onClick={() => appendDigit("0")}
          className="min-h-[64px] rounded-2xl adm-surface adm-border border text-2xl font-bold text-dark adm-text active:bg-[var(--adm-surface-2)] disabled:opacity-50"
        >
          0
        </button>
        <button
          type="button"
          disabled={loading || digits.length === 0}
          onClick={backspace}
          className="min-h-[64px] rounded-2xl adm-surface adm-border border flex items-center justify-center text-dark adm-text active:bg-[var(--adm-surface-2)] disabled:opacity-50"
          aria-label={t("Obriši zadnju cifru", "Delete last digit")}
        >
          <Delete size={24} />
        </button>
      </div>
    </div>
  );
}
