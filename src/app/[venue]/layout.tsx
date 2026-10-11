"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ensureVenueLoaded } from "@/lib/venue-cloud/sync";
import { useTableSessionStore } from "@/store/tableSessionStore";
import { useCartStore } from "@/store/cartStore";
import { useLanguageStore } from "@/store/languageStore";
import { useCmsStore } from "@/store/cmsStore";
import { useTranslation } from "@/hooks/useTranslation";
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
  const { text } = useTranslation();
  const generation = useRef(0);
  const exchanges = useRef<Promise<void>>(Promise.resolve());
  const {venue}=useParams<{venue:string}>();
  const router = useRouter();
  const setTable = useTableSessionStore((s) => s.setTable);
  const clearTable = useTableSessionStore((s) => s.clearTable);
  const [expiredToast, setExpiredToast] = useState(false);

  useEffect(() => {
    const table = searchParams.get("table");
    if (table?.trim()) {

      const attempt = ++generation.current;
      clearTable();
      exchanges.current = exchanges.current.catch(() => undefined).then(() => fetch('/api/guest/session',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({venue:decodeURIComponent(venue),table:table.trim()})})).then(async response=>{
        if(!response.ok)throw new Error('Session unavailable');const session=await response.json();
        if(attempt===generation.current && useTableSessionStore.getState().venue===decodeURIComponent(venue))setTable(session.tableNumber,session.tableId,session.expiresAt);
      }).catch(()=>{if(attempt===generation.current && useTableSessionStore.getState().venue===decodeURIComponent(venue)){clearTable();setExpiredToast(true);}});
      // Consume the QR parameter once; ordinary navigation must not renew expiry.

      const url = new URL(window.location.href); url.searchParams.delete("table");
      router.replace(url.pathname + url.search + url.hash, {scroll:false});
    }
  }, [searchParams, setTable, router, venue, clearTable]);

  useEffect(() => {
    const interval = setInterval(() => {
      const state = useTableSessionStore.getState();
      const hadTable = state.tableNumber !== null;
      if (hadTable && !state.isValid()) {
        clearTable();
        setExpiredToast(true);
      }
    }, 5_000);
    return () => clearInterval(interval);
  }, [clearTable]);

  return (
    <AnimatePresence>
      {expiredToast && (
        <SessionToast
          message={text("Sesija je istekla. Skenirajte QR kod ponovo.", "Your session expired. Scan the table QR code again.")}
          onDismiss={() => setExpiredToast(false)}
        />
      )}
    </AnimatePresence>
  );
}

export default function VenueLayout({ children }: { children: React.ReactNode }) {
  const { venue } = useParams<{ venue: string }>();
  const router = useRouter();
  const [readyVenue, setReadyVenue] = useState<string|null>(null);

  useEffect(() => {
    if (!venue) return;
    const slug = decodeURIComponent(venue);
    useCartStore.getState().activateVenue(slug);
    useTableSessionStore.getState().activateVenue(slug);

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("preview") === "1") {
        setReadyVenue(venue);
        return;
      }
    }

    let cancelled = false;
    (async () => {
      const ok = await ensureVenueLoaded(slug);
      if (cancelled) return;
      if (!ok) {
        router.replace("/");
        return;
      }
      if(!useLanguageStore.getState().hasPreference)useLanguageStore.setState({language:useCmsStore.getState().allRestaurants[slug]?.restaurant.language??"bs"});
      setReadyVenue(venue);
    })();

    return () => {
      cancelled = true;
    };
  }, [venue, router]);

  if (readyVenue !== venue) {
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
