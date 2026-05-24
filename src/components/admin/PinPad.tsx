"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Delete } from "lucide-react";
import clsx from "clsx";

type PinPadProps = {
  onComplete: (pin: string) => void;
  onCancel?: () => void;
  error?: string | null;
  loading?: boolean;
};

export default function PinPad({ onComplete, onCancel, error, loading }: PinPadProps) {
  const [digits, setDigits] = useState<string[]>([]);
  const [shake, setShake] = useState(false);

  const resetDigits = useCallback(() => {
    setDigits([]);
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
    const next = [...digits, d];
    setDigits(next);
    if (next.length === 3) {
      onComplete(next.join(""));
    }
  };

  const backspace = () => {
    if (loading) return;
    setDigits((prev) => prev.slice(0, -1));
  };

  return (
    <div className="w-full">
      <motion.div
        className="flex justify-center gap-4 mb-4"
        animate={shake ? { x: [0, -12, 12, -8, 8, 0] } : { x: 0 }}
        transition={{ duration: 0.45 }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
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
            disabled={loading}
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
            Odustani
          </button>
        ) : (
          <span className="min-h-[64px]" aria-hidden />
        )}
        <button
          type="button"
          disabled={loading}
          onClick={() => appendDigit("0")}
          className="min-h-[64px] rounded-2xl adm-surface adm-border border text-2xl font-bold text-dark adm-text active:bg-[var(--adm-surface-2)] disabled:opacity-50"
        >
          0
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={backspace}
          className="min-h-[64px] rounded-2xl adm-surface adm-border border flex items-center justify-center text-dark adm-text active:bg-[var(--adm-surface-2)] disabled:opacity-50"
          aria-label="Obriši"
        >
          <Delete size={24} />
        </button>
      </div>
    </div>
  );
}
