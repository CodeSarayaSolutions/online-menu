"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getActiveHappyHourPriceMap,
  getActiveHappyHourSchedules,
  type ActiveHappyHourPrice,
  type HappyHourSchedule,
} from "@/services/happyHourService";

export function useHappyHourPricing(restaurantId: string) {
  const [schedules, setSchedules] = useState<HappyHourSchedule[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    let alive = true;

    void (async () => {
      try {
        const rows = await getActiveHappyHourSchedules(restaurantId);
        if (!alive) return;
        setSchedules(rows);
        setError(null);
      } catch (err) {
        console.error("[happy-hour] failed to load active schedules", err);
        if (!alive) return;
        setSchedules([]);
        setError(err instanceof Error ? err.message : "Happy hour nije učitan");
      }
    })();

    return () => {
      alive = false;
    };
  }, [restaurantId]);

  const prices = useMemo<Map<string, ActiveHappyHourPrice>>(
    () => getActiveHappyHourPriceMap(schedules),
    [schedules]
  );

  return { prices, schedules, error };
}
