"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import clsx from "clsx";
import AdminLoginForm from "@/components/admin/AdminLoginForm";
import AdminQuickLogin from "@/components/admin/AdminQuickLogin";
import PinResetWithOtp from "@/components/admin/PinResetWithOtp";
import { useAuthStore } from "@/store/authStore";
import { useAdminStore } from "@/store/adminStore";
import { mapApiUserToAppUser } from "@/lib/auth/map-user";
import { getDefaultPlatformPath } from "@/lib/permissions";
import { saveLoginToHistory, getLoginHistoryEntries } from "@/lib/waiter-session";
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
  const darkMode = useAdminStore((s) => s.darkMode);

  const [hasHistory, setHasHistory] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(true);
  const [highlightEmail, setHighlightEmail] = useState(false);
  const [showPinReset, setShowPinReset] = useState(false);

  useEffect(() => {
    const entries = getLoginHistoryEntries();
    const exists = entries.length > 0;
    setHasHistory(exists);
    setShowEmailForm(!exists);
  }, []);

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
    saveLoginToHistory({
      userId: appUser.id,
      name: appUser.name,
      avatar: appUser.avatar ?? null,
      email: session.user.email,
    });
    setSessionUser(appUser);
    router.replace(getDefaultPlatformPath(appUser));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={clsx(
        "fixed inset-0 adm-bg flex items-center justify-center p-6 overflow-y-auto",
        darkMode && "admin-dark"
      )}
      style={{ background: darkMode ? "#0f0f0f" : undefined }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[420px] adm-surface adm-border border rounded-2xl shadow-card p-8"
      >
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center mx-auto mb-6 shadow-glow">
          <span className="text-white font-black text-lg">S</span>
        </div>

        {showPinReset ? (
          <PinResetWithOtp
            onDone={() => setShowPinReset(false)}
            onCancel={() => setShowPinReset(false)}
          />
        ) : (
          <>
            <AdminQuickLogin
              onSuccess={onSuccess}
              onShowEmail={() => {
                setShowEmailForm(true);
                setHighlightEmail(true);
              }}
              onPinReset={() => setShowPinReset(true)}
              highlightEmail={highlightEmail}
            />

            {(showEmailForm || !hasHistory) && (
          <div
            className={clsx(
              hasHistory && !showEmailForm && "hidden",
              highlightEmail && "ring-2 ring-primary/40 rounded-xl p-1 -m-1"
            )}
          >
            <AdminLoginForm
              onSuccess={onSuccess}
              title={hasHistory ? undefined : BRAND_NAME}
              subtitle={
                hasHistory
                  ? LOGIN_EMAIL_SUBTITLE
                  : `${ADMIN_PANEL_TITLE} · ${LOGIN_EMAIL_SUBTITLE}`
              }
            />
          </div>
            )}

            {hasHistory && !showEmailForm && (
              <button
                type="button"
                onClick={() => setShowEmailForm(true)}
                className="w-full mt-4 text-xs text-muted adm-text-muted underline cursor-pointer text-center"
              >
                Prijava lozinkom
              </button>
            )}

            {hasHistory && (
              <button
                type="button"
                onClick={() => setShowPinReset(true)}
                className="w-full mt-2 text-xs text-primary font-semibold underline cursor-pointer text-center"
              >
                Promijeni PIN (kod od administratora)
              </button>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
