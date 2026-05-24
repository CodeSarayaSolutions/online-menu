"use client";

import { useEffect, useState } from "react";
import * as authService from "@/services/authService";
import { useAuthStore } from "@/store/authStore";
import { mapApiUserToAppUser } from "@/lib/auth/map-user";

/** Restore DB session into auth store on admin pages. */
export function useAdminSession() {
  const setSessionUser = useAuthStore((s) => s.setSessionUser);
  const logout = useAuthStore((s) => s.logout);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await authService.restoreSession();
        if (cancelled) return;
        if (session?.user) {
          setSessionUser(
            mapApiUserToAppUser(session.user, session.restaurantAccess ?? [])
          );
        } else {
          logout();
        }
        setError(null);
      } catch (e) {
        if (!cancelled) {
          logout();
          setError(e instanceof Error ? e.message : 'Session check failed');
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setSessionUser, logout]);

  const currentUserId = useAuthStore((s) => s.currentUserId);
  return { ready, isLoggedIn: !!currentUserId, error };
}
