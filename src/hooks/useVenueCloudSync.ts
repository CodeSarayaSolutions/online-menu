"use client";

import { useEffect, useState } from "react";
import { useCmsStore } from "@/store/cmsStore";
import { loadAllVenuesIntoStore } from "@/lib/venue-cloud/sync";

const VENUE_LOAD_TIMEOUT_MS = 20000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out (${ms / 1000}s)`)), ms)
    ),
  ]);
}

/** Load venues from Supabase into cmsStore when admin session is ready. */
export function useVenueCloudSync(enabled: boolean) {
  const [venuesReady, setVenuesReady] = useState(!enabled);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setVenuesReady(true);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    let cancelled = false;
    (async () => {
      try {
        await withTimeout(loadAllVenuesIntoStore(), VENUE_LOAD_TIMEOUT_MS, "Loading restaurants");
        if (!cancelled) setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load venues from database");
        }
      } finally {
        if (!cancelled) {
          setVenuesReady(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, useCmsStore]);

  return { venuesReady, loading, error };
}
