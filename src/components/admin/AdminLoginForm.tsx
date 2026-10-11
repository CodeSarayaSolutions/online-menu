"use client";
import { useUiText } from "@/hooks/useUiText";
import { useRef, useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import * as authService from "@/services/authService";
import { useOperationalText } from "@/hooks/useOperationalText";
import PinPad from "@/components/admin/PinPad";

type Step = "email" | "pin" | "welcome" | "new-pin" | "confirm" | "done";
type Props = { onSuccess: (session: authService.SessionPayload) => void; title?: string; subtitle?: string; initialEmail?: string };
export default function AdminLoginForm({ onSuccess, title, subtitle, initialEmail = "" }: Props) {
  const uiText = useUiText();
  const t = useOperationalText();
  const form = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState<Step>(initialEmail ? "pin" : "email");
  const [email, setEmail] = useState(initialEmail);
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<authService.SessionPayload | null>(null);
  const headings: Record<Step, string> = {
    email: title ?? t("Prijava", "Sign in"), pin: t("Unesite PIN", "Enter your PIN"),
    welcome: t("Dobrodošli", "Welcome"), "new-pin": t("Postavite svoj PIN", "Choose your PIN"),
    confirm: t("Ponovite svoj PIN", "Repeat your PIN"), done: t("Sve je spremno", "You're ready"),
  };
  const next = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return;
    setError("");
    if (step === "email") { setStep("pin"); return; }
    if (step === "welcome") { setPin(""); setStep("new-pin"); return; }
    if (step === "done" && session) { onSuccess(session); return; }
    if (!/^\d{3}$/.test(pin)) { setError(t("Unesite tri cifre.", "Enter three digits.")); return; }
    if (step === "new-pin") { setNewPin(pin); setPin(""); setStep("confirm"); return; }
    if (step === "confirm" && pin !== newPin) { setError(t("PIN se ne podudara. Pokušajte ponovo.", "The PINs don't match. Please try again.")); setPin(""); return; }
    setBusy(true);
    try {
      if (step === "pin") {
        const result = await authService.signIn(email, { pin });
        setPin("");
        if ("onboarding" in result) setStep("welcome");
        else onSuccess(result);
      } else {
        setSession(await authService.completeOnboarding(newPin, pin));
        setPin(""); setNewPin(""); setStep("done");
      }
    } catch (e) { setError(t("Prijava nije uspjela. Provjerite podatke i pokušajte ponovo.", "Sign-in failed. Check your details and try again.")); }
    finally { setBusy(false); }
  };
  return <form ref={form} onSubmit={next} className="space-y-5">
    <div className="text-center">
      {step === "done" && <Check className="mx-auto mb-3 text-emerald-600" size={40} />}
      <h2 className="text-xl font-extrabold adm-text">{headings[step]}</h2>
      <p className="mt-2 text-sm adm-text-muted">{step === "email" ? subtitle ?? t("Prijavite se svojom email adresom.", "Sign in with your email address.") : step === "welcome" ? t("Prije početka postavite svoj trocifreni PIN. Njime ćete se prijavljivati na posao.", "Before you start, choose your own three-digit PIN. You'll use it to sign in at work.") : step === "done" ? t("Vaš PIN je sačuvan. Možete početi.", "Your PIN is saved. You're ready to start.") : email}</p>
    </div>
    {step === "email" && <label className="block text-sm font-semibold">{uiText("Email")}<input autoFocus type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border adm-input p-3 min-h-[48px]" /></label>}
    {["pin", "new-pin", "confirm"].includes(step) && <PinPad key={step} value={pin} onChange={value => { setPin(value); setError(""); }} loading={busy} onComplete={() => form.current?.requestSubmit()} />}
    {error && <p role="alert" className="rounded-xl bg-red-50 text-red-700 p-3 text-sm">{error}</p>}
    <button disabled={busy || (["pin", "new-pin", "confirm"].includes(step) && pin.length !== 3)} className="min-h-[48px] w-full rounded-xl bg-primary text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">{busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}{step === "done" ? t("Gotovo", "Done") : t("Dalje", "Next")}</button>
    {step === "pin" && <><button type="button" onClick={() => { setStep("email"); setPin(""); setError(""); }} className="w-full min-h-[44px] text-sm adm-text-muted">{t("Druga email adresa", "Use another email")}</button><p className="text-xs text-center adm-text-muted">{t("Zaboravili ste PIN? Voditelj vam može izdati privremeni PIN.", "Forgot your PIN? Ask your manager for a temporary PIN.")}</p></>}
    {step === "confirm" && <button type="button" onClick={() => { setPin(""); setStep("new-pin"); setError(""); }} className="w-full min-h-[44px] text-sm">{t("Odaberite drugi PIN", "Choose a different PIN")}</button>}
  </form>;
}
