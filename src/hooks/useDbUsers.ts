"use client";

import { useEffect } from "react";
import * as authService from "@/services/authService";
import { useAuthStore } from "@/store/authStore";
import { mapApiUserToAppUser } from "@/lib/auth/map-user";

/** Load all users + restaurant access from Supabase into auth store (admin UI). */
export function useDbUsers(enabled: boolean) {
  const setUsers = useAuthStore((s) => s.setUsers);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const users = await authService.fetchAllUsersForAdmin();
        if (!cancelled) setUsers(users);
      } catch (e) {
        console.error("[useDbUsers]", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, setUsers]);
}
