"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const WARN_MS = 9 * 60 * 1000;
const LOGOUT_MS = 10 * 60 * 1000;
const TICK_MS = 30 * 1000;

export function useWaiterIdleTimeout(onTimeout: () => void) {
  const lastActivity = useRef(Date.now());
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const resetActivity = useCallback(() => {
    lastActivity.current = Date.now();
    setShowIdleWarning(false);
  }, []);

  useEffect(() => {
    const bump = () => {
      lastActivity.current = Date.now();
    };
    document.addEventListener("touchstart", bump, { passive: true });
    document.addEventListener("mousedown", bump);
    document.addEventListener("keydown", bump);

    const id = window.setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (idle > LOGOUT_MS) {
        setShowIdleWarning(false);
        onTimeoutRef.current();
      } else if (idle > WARN_MS) {
        setShowIdleWarning(true);
      } else {
        setShowIdleWarning(false);
      }
    }, TICK_MS);

    return () => {
      document.removeEventListener("touchstart", bump);
      document.removeEventListener("mousedown", bump);
      document.removeEventListener("keydown", bump);
      window.clearInterval(id);
    };
  }, []);

  return { showIdleWarning, resetActivity };
}
