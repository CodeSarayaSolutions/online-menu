"use client";

import { useState } from "react";
import { LogIn, Mail, Lock, Eye, EyeOff, Loader2, KeyRound, ArrowRight } from "lucide-react";
import * as authService from "@/services/authService";
import clsx from "clsx";
import {
  BTN_ACTIVATE,
  BTN_CONTINUE,
  BTN_DIFFERENT_EMAIL,
  BTN_SIGN_IN,
  INVITE_HELP,
  LOGIN_EMAIL_SUBTITLE,
} from "@/lib/admin-branding";

export type LoginMode = "email" | "password" | "invite";

type Props = {
  onSuccess: (session: authService.SessionPayload) => void;
  title?: string;
  subtitle?: string;
};

export default function AdminLoginForm({
  onSuccess,
  title = "Prijava",
  subtitle = LOGIN_EMAIL_SUBTITLE,
}: Props) {
  const [step, setStep] = useState<LoginMode>("email");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const resetToEmail = () => {
    setStep("email");
    setPassword("");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
  };

  const handleEmailContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Enter your email");
      return;
    }
    setLoading(true);
    try {
      const result = await authService.checkLoginMode(email.trim());
      if (result.mode === "not_found") {
        setError(
          result.hint ??
            "No account found for this email. If you created the user in Table Editor, expose schema sarayamenu to PostgREST (PGRST_DB_SCHEMAS) and restart the API."
        );
        return;
      }
      setDisplayName(result.name ?? "");
      setStep(result.mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check email");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await authService.signIn(email.trim(), { password });
      onSuccess(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleInviteActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const session = await authService.signIn(email.trim(), {
        otp: otp.trim(),
        newPassword,
      });
      onSuccess(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-xl font-extrabold text-dark adm-text">{title}</h2>
        <p className="text-[13px] text-muted adm-text-muted mt-1">
          {step === "invite"
            ? `Dobrodošli${displayName ? `, ${displayName}` : ""} — unesite kod od administratora`
            : step === "password"
            ? `Dobrodošli natrag${displayName ? `, ${displayName}` : ""}`
            : subtitle}
        </p>
      </div>

      {step === "email" && (
        <form onSubmit={handleEmailContinue} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-muted adm-text-muted uppercase tracking-wider mb-1.5">
              Email
            </label>
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 adm-text-faint" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border adm-input text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="you@example.com"
                required
                disabled={loading}
                autoComplete="email"
              />
            </div>
          </div>
          {error && <ErrorBox message={error} />}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary to-amber-500 text-white font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
            {BTN_CONTINUE}
          </button>
        </form>
      )}

      {step === "password" && (
        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <p className="text-[12px] text-muted adm-text-muted adm-bg rounded-lg px-3 py-2">{email}</p>
          <div>
            <label className="block text-[11px] font-bold text-muted adm-text-muted uppercase tracking-wider mb-1.5">
              Lozinka
            </label>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 adm-text-faint" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-3 rounded-xl border adm-input text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                required
                disabled={loading}
                autoFocus
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted adm-text-muted"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          {error && <ErrorBox message={error} />}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary to-amber-500 text-white font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
            {BTN_SIGN_IN}
          </button>
          <button type="button" onClick={resetToEmail} className="w-full text-[12px] text-muted adm-text-muted hover:adm-text">
            {BTN_DIFFERENT_EMAIL}
          </button>
        </form>
      )}

      {step === "invite" && (
        <form onSubmit={handleInviteActivate} className="space-y-4">
          <p className="text-[12px] text-muted adm-text-muted bg-amber-50 border border-amber-200/60 rounded-lg px-3 py-2">
            {INVITE_HELP} <span className="font-semibold text-dark adm-text">{email}</span>
          </p>
          <div>
            <label className="block text-[11px] font-bold text-muted adm-text-muted uppercase tracking-wider mb-1.5">
              Pozivni kod
            </label>
            <div className="relative">
              <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 adm-text-faint" />
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full pl-10 pr-4 py-3 rounded-xl border adm-input text-[13px] tracking-[0.3em] font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="000000"
                required
                disabled={loading}
                autoFocus
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-muted adm-text-muted uppercase tracking-wider mb-1.5">
              Nova lozinka
            </label>
            <input
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border adm-input text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
              minLength={8}
              required
              disabled={loading}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-muted adm-text-muted uppercase tracking-wider mb-1.5">
              Potvrdi lozinku
            </label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border adm-input text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
              minLength={8}
              required
              disabled={loading}
              autoComplete="new-password"
            />
          </div>
          {error && <ErrorBox message={error} />}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary to-amber-500 text-white font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
            {BTN_ACTIVATE}
          </button>
          <button type="button" onClick={resetToEmail} className="w-full text-[12px] text-muted adm-text-muted hover:adm-text">
            {BTN_DIFFERENT_EMAIL}
          </button>
        </form>
      )}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <p className="text-[12px] text-red-600 font-medium bg-red-50 px-3 py-2 rounded-lg">{message}</p>
  );
}
