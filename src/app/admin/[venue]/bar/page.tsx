"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Maximize2, Minimize2, Volume2, VolumeX } from "lucide-react";
import clsx from "clsx";
import StationOrdersBoard from "@/components/admin/StationOrdersBoard";
import BarActiveTabs from "@/components/admin/BarActiveTabs";
import { useOrders } from "@/hooks/useOrders";
import {
  isBarSoundMuted,
  playBarChime,
  setBarSoundMuted,
} from "@/lib/bar-notification-sound";

export default function BarStationPage() {
  const params = useParams();
  const venueSlug = typeof params.venue === "string" ? params.venue : "";
  const { orders } = useOrders(venueSlug);

  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const hiddenWhileFullscreenRef = useRef(false);
  const pendingWhileHiddenRef = useRef(0);

  useEffect(() => {
    setMuted(isBarSoundMuted());
  }, []);

  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;

    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await navigator.wakeLock.request("screen");
        }
      } catch {
        // Wake lock not available — silent fail
      }
    };

    void requestWakeLock();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") void requestWakeLock();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      void wakeLock?.release();
    };
  }, []);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setBarSoundMuted(next);
  };

  // Play chime when a new pending order arrives
  useEffect(() => {
    if (!venueSlug) return;

    if (!initializedRef.current) {
      orders.forEach((o) => knownIdsRef.current.add(o.id));
      initializedRef.current = true;
      return;
    }

    for (const order of orders) {
      if (!knownIdsRef.current.has(order.id)) {
        knownIdsRef.current.add(order.id);
        if (
          order.status === "pending" &&
          document.visibilityState === "visible" &&
          !muted
        ) {
          playBarChime();
        }
      }
    }
  }, [orders, venueSlug, muted]);

  // Fullscreen state
  useEffect(() => {
    const onFullscreenChange = () => {
      setFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // Notify when returning from screen lock while fullscreen
  useEffect(() => {
    const onVisibility = () => {
      const pendingCount = orders.filter(
        (o) => o.status === "pending" || o.status === "preparing"
      ).length;

      if (document.hidden && document.fullscreenElement) {
        hiddenWhileFullscreenRef.current = true;
        pendingWhileHiddenRef.current = pendingCount;
        return;
      }

      if (
        !document.hidden &&
        hiddenWhileFullscreenRef.current &&
        document.fullscreenElement
      ) {
        hiddenWhileFullscreenRef.current = false;
        if (pendingCount > pendingWhileHiddenRef.current && !muted) {
          playBarChime(true);
        }
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [orders, muted]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Fullscreen may be blocked by browser policy
    }
  }, []);

  return (
    <div className="p-5 lg:p-8 relative">
      <div className="flex items-center justify-end gap-2 mb-4">
        <button
          type="button"
          onClick={toggleMute}
          className="w-10 h-10 rounded-xl adm-surface adm-border border flex items-center justify-center text-muted adm-text-muted hover:adm-text hover:bg-[var(--adm-surface-2)] transition"
          title={muted ? "Uključi zvuk" : "Isključi zvuk"}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      <StationOrdersBoard mode="bar" />
      {venueSlug ? <BarActiveTabs restaurantId={venueSlug} /> : null}

      <button
        type="button"
        onClick={() => void toggleFullscreen()}
        className={clsx(
          "fixed bottom-6 right-6 z-50 w-12 h-12 rounded-2xl shadow-elevated flex items-center justify-center transition",
          "adm-surface adm-border border text-dark adm-text hover:bg-[var(--adm-surface-2)]"
        )}
        title={fullscreen ? "Izađi iz cijelog ekrana" : "Cijeli ekran"}
      >
        {fullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
      </button>
    </div>
  );
}
