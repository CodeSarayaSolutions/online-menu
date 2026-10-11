"use client";

import { useEffect, useMemo, useState } from "react";
import { useCmsStore } from '@/store/cmsStore';
import {
  getActiveHappyHourPriceMap,
  getActiveHappyHourSchedules,
  type ActiveHappyHourPrice,
  type HappyHourSchedule,
} from "@/services/happyHourService";

export function useHappyHourPricing(restaurantId: string) {
  const [schedules, setSchedules] = useState<HappyHourSchedule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [loadedVenue, setLoadedVenue] = useState('');
  const timezone = useCmsStore(s => s.allRestaurants[restaurantId]?.restaurant.timezone ?? 'Europe/Sarajevo');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setClock(Date.now());
      timer = setTimeout(tick, 60000 - (Date.now() % 60000) + 10);
    };
    tick();
    const resume = () => { clearTimeout(timer); tick(); };
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    return () => { clearTimeout(timer); window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', resume); };
  }, []);

  useEffect(() => {
    if (!restaurantId) return;
    let alive = true;

    const refresh = async () => {
      try {
        const rows = await getActiveHappyHourSchedules(restaurantId);
        if (!alive) return;
        setSchedules(rows);
        setLoadedVenue(restaurantId);
        setError(null);
      } catch (err) {
        console.error("[happy-hour] failed to load active schedules", err);
        if (!alive) return;
        setSchedules([]);
        setError(err instanceof Error ? err.message : "Happy hour nije učitan");
      }
    };
    void refresh();
    window.addEventListener('focus', refresh);
    const freshness = setInterval(() => { if(document.visibilityState === 'visible')void refresh(); },30000);

    return () => {
      alive = false;
      clearInterval(freshness);
      window.removeEventListener('focus', refresh);
    };
  }, [restaurantId]);

  const prices = useMemo<Map<string, ActiveHappyHourPrice>>(
    () => loadedVenue === restaurantId ? getActiveHappyHourPriceMap(schedules, new Date(clock), timezone) : new Map(),
    [schedules, clock, timezone, loadedVenue, restaurantId]
  );

  return { prices, schedules, error };
}
