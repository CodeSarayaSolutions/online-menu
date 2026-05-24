"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import AdminLoginForm from "@/components/admin/AdminLoginForm";
import { useAuthStore } from "@/store/authStore";
import { mapApiUserToAppUser } from "@/lib/auth/map-user";
import { getDefaultPlatformPath } from "@/lib/permissions";
import type { SessionPayload } from "@/services/authService";
import {
  ADMIN_PANEL_TITLE,
  BRAND_NAME,
  LOGIN_EMAIL_SUBTITLE,
} from "@/lib/admin-branding";

export default function AdminLoginPage() {
  const router = useRouter();
  const setSessionUser = useAuthStore((s) => s.setSessionUser);
  const currentUser = useAuthStore((s) => s.getCurrentUser());

  useEffect(() => {
    if (currentUser) {
      router.replace(getDefaultPlatformPath(currentUser));
    }
  }, [currentUser, router]);

  const onSuccess = (session: SessionPayload) => {
    const appUser = mapApiUserToAppUser(session.user, session.restaurantAccess ?? []);
    if (appUser.platformRole === "user" && appUser.restaurantAccess.length === 0) {
      throw new Error(
        "Račun nema dodijeljen restoran. Pitajte administratora da vas ponovo pozove (Invite user) i dodijeli ulogu."
      );
    }
    setSessionUser(appUser);
    router.replace(getDefaultPlatformPath(appUser));
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[420px] bg-white rounded-2xl shadow-card border border-gray-100/80 p-8"
      >
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center mx-auto mb-6 shadow-glow">
          <span className="text-white font-black text-lg">S</span>
        </div>
        <AdminLoginForm
          onSuccess={onSuccess}
          title={BRAND_NAME}
          subtitle={`${ADMIN_PANEL_TITLE} · ${LOGIN_EMAIL_SUBTITLE}`}
        />
      </motion.div>
    </div>
  );
}
