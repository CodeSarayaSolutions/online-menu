"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ensureVenueLoaded } from "@/lib/venue-cloud/sync";
import { useTableSessionStore } from "@/store/tableSessionStore";
import LanguageSwitcher from "@/components/LanguageSwitcher";

function SessionToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] max-w-sm w-[calc(100%-2rem)] px-4 py-3 rounded-2xl shadow-elevated text-sm font-semibold text-center"
      style={{ backgroundColor: "#1E1E1E", color: "#FFFFFF" }}
    >
      {message}
    </motion.div>
  );
}

function TableSessionManager() {
  const searchParams = useSearchParams();
  const setTable = useTableSessionStore((s) => s.setTable);
  const clearTable = useTableSessionStore((s) => s.clearTable);
  const [expiredToast, setExpiredToast] = useState(false);

  useEffect(() => {
    const table = searchParams.get("table");
    if (table?.trim()) {
      setTable(table.trim());
    }
  }, [searchParams, setTable]);

  useEffect(() => {
    const interval = setInterval(() => {
      const state = useTableSessionStore.getState();
      const hadTable = state.tableNumber !== null;
      if (hadTable && !state.isValid()) {
        clearTable();
        setExpiredToast(true);
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [clearTable]);

  return (
    <AnimatePresence>
      {expiredToast && (
        <SessionToast
          message="Sesija je istekla. Skenirajte QR kod ponovo."
          onDismiss={() => setExpiredToast(false)}
        />
      )}
    </AnimatePresence>
  );
}

export default function VenueLayout({ children }: { children: React.ReactNode }) {
  const { venue } = useParams<{ venue: string }>();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!venue) return;

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("preview") === "1") {
        setReady(true);
        return;
      }
    }

    const slug = decodeURIComponent(venue);
    let cancelled = false;
    (async () => {
      const ok = await ensureVenueLoaded(slug);
      if (cancelled) return;
      if (!ok) {
        router.replace("/");
        return;
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [venue, router]);

  if (!ready) {
    return (
      <motion.div className="min-h-screen flex items-center justify-center">
        <motion.div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </motion.div>
    );
  }

  return (
    <>
      <Suspense fallback={null}>
        <TableSessionManager />
      </Suspense>
      <LanguageSwitcher />
      {children}
    </>
  );
}
