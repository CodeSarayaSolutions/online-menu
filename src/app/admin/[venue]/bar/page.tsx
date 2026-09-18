"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Maximize2, Minimize2, Volume2, VolumeX } from "lucide-react";
import clsx from "clsx";
import StationOrdersBoard from "@/components/admin/StationOrdersBoard";
import BarActiveTabs from "@/components/admin/BarActiveTabs";
import { useStationBoard } from "@/hooks/useStationBoard";
import {
  isBarSoundMuted,
  playBarChime,
  setBarSoundMuted,
} from "@/lib/bar-notification-sound";

export default function BarStationPage() {
  const params = useParams();
  const venueSlug = typeof params.venue === "string" ? params.venue : "";
  const { orders, tabs, updateStatus, refreshAndReconnect, error } = useStationBoard(
    venueSlug,
    "bar"
  );

  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const knownSigRef = useRef<Map<string, string>>(new Map());
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
      if (document.visibilityState === "visible") {
        void requestWakeLock();
        void refreshAndReconnect();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      void wakeLock?.release();
    };
  }, [refreshAndReconnect]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setBarSoundMuted(next);
  };

  // Play chime when a new pending order arrives or a pending ticket grows
  useEffect(() => {
    if (!venueSlug) return;

    let shouldChime = false;
    for (const order of orders) {
      const sig = `${order.status}:${order.itemCount}:${order.total.toFixed(2)}`;
      const prev = knownSigRef.current.get(order.id);
      if (!initializedRef.current) {
        knownSigRef.current.set(order.id, sig);
        continue;
      }
      if (prev !== sig) {
        knownSigRef.current.set(order.id, sig);
        if (
          order.status === "pending" &&
          document.visibilityState === "visible" &&
          !muted
        ) {
          shouldChime = true;
        }
      }
    }

    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    if (shouldChime) playBarChime();
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
        try {
          const orientation = screen.orientation as ScreenOrientation & {
            lock?: (orientation: "portrait") => Promise<void>;
          };
          await orientation.lock?.("portrait");
        } catch {
          // Orientation lock is not supported by all browsers.
        }
      }
    } catch {
      // Fullscreen may be blocked by browser policy
    }
  }, []);

  const controlBtnClass =
    "w-10 h-10 rounded-xl adm-surface adm-border border flex items-center justify-center text-muted adm-text-muted hover:adm-text hover:bg-[var(--adm-surface-2)] transition";

  return (
    <div className="relative">
      {!fullscreen && (
        <div className="flex items-center justify-end gap-2 mb-2">
          <button
            type="button"
            onClick={toggleMute}
            className={controlBtnClass}
            title={muted ? "Uključi zvuk" : "Isključi zvuk"}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      )}

      {fullscreen && (
        <div className="fixed top-2 right-2 z-[60] flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-2xl px-2 py-1.5">
          <button
            type="button"
            onClick={toggleMute}
            className={controlBtnClass}
            title={muted ? "Uključi zvuk" : "Isključi zvuk"}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className={controlBtnClass}
            title="Izađi iz cijelog ekrana"
          >
            <Minimize2 size={18} />
          </button>
        </div>
      )}

      {error ? (
        <p className="mb-3 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
      ) : null}
      <StationOrdersBoard mode="bar" orders={orders} updateStatus={updateStatus} compact />
      {venueSlug ? <BarActiveTabs restaurantId={venueSlug} tabs={tabs} /> : null}

      {!fullscreen && (
        <button
          type="button"
          onClick={() => void toggleFullscreen()}
          className={clsx(
            "fixed bottom-6 right-6 z-50 w-12 h-12 rounded-2xl shadow-elevated flex items-center justify-center transition",
            "adm-surface adm-border border text-dark adm-text hover:bg-[var(--adm-surface-2)]"
          )}
          title="Cijeli ekran"
        >
          <Maximize2 size={20} />
        </button>
      )}
    </div>
  );
}
