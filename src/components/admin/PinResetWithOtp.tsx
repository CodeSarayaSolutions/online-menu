"use client";
import { useOperationalText } from '@/hooks/useOperationalText';
export default function PinResetWithOtp({onCancel}:{onDone:()=>void;onCancel:()=>void}){
 const t=useOperationalText();
 return <section className="space-y-5"><h2 className="text-xl font-bold">{t('Zaboravili ste PIN?','Forgot your PIN?')}</h2><p className="text-sm adm-text-muted">{t('Zatražite privremeni PIN od menadžera ili vlasnika. Prijavite se svojom email adresom i privremenim PIN-om, a zatim postavite novi PIN.','Ask your manager or owner for a temporary PIN. Sign in with your email and temporary PIN, then choose a new PIN.')}</p><button className="w-full min-h-[48px] rounded-xl bg-primary text-white font-bold" onClick={onCancel}>{t('Nazad na prijavu','Back to sign in')}</button></section>;
}
