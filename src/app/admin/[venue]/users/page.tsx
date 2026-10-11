"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, X, Copy, Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useCmsStore } from "@/store/cmsStore";
import { useOperationalText } from "@/hooks/useOperationalText";
import { canManageVenueStaff, getRestaurantRole } from "@/lib/permissions";
import * as auth from "@/services/authService";
import { performAction } from "@/services/actionService";
import type { AppUser, RestaurantRole } from "@/types/auth";

export default function UsersPage() {
  const params = useParams();
  const venue = typeof params.venue === "string" ? params.venue : "";
  const t = useOperationalText();
  const current = useAuthStore(s => s.getCurrentUser());
  const setUsers = useAuthStore(s => s.setUsers);
  const kitchen = useCmsStore(s => s.allRestaurants[venue]?.restaurant.kitchenEnabled ?? false);
  const [staff, setStaff] = useState<AppUser[]>([]);
  const [create, setCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [issued, setIssued] = useState<{ name: string; code: string } | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", restaurantRole: "employee" as RestaurantRole, platformRole: "user" as "user" | "admin" });
  const admin = current?.platformRole === "admin";
  const role = getRestaurantRole(current, venue);
  const allowed = admin || canManageVenueStaff(current, venue);
  const labels: Record<RestaurantRole, string> = { employee: t("Konobar", "Waiter"), bar: t("Osoblje bara", "Bar staff"), kitchen: t("Kuhinjsko osoblje", "Kitchen staff"), manager: t("Menadžer", "Manager"), owner: t("Vlasnik", "Owner") };
  const roles: RestaurantRole[] = ["employee", "bar", ...(kitchen ? ["kitchen" as const] : []), ...(role === "owner" || admin ? ["manager" as const] : []), ...(admin ? ["owner" as const] : [])];
  const refresh = async () => { const all = await auth.fetchAllUsersForAdmin(); setUsers(all); setStaff(all.filter(u => !venue || u.restaurantAccess.some(a => a.restaurantId === venue))); };
  useEffect(() => { if (allowed) void refresh().catch(() => setError(t("Učitavanje nije uspjelo. Pokušajte ponovo.", "Couldn't load staff. Please try again."))); }, [venue, allowed]);
  const act = async (fn: () => Promise<void>) => { setBusy(true); setError(""); try { await fn(); await refresh(); } catch { setError(t("Žao nam je, nešto nije uspjelo. Pokušajte ponovo.", "Sorry, something went wrong. Please try again.")); } finally { setBusy(false); } };
  if (!allowed) return <p className="p-6">{t("Nemate pristup ovoj stranici.", "You don't have access to this page.")}</p>;
  return <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
    <header className="flex justify-between items-center gap-3"><div><h1 className="text-2xl font-extrabold">{t("Osoblje", "Staff")}</h1><p className="text-sm adm-text-muted mt-1">{t("Ljudi i njihove uloge u ovom lokalu.", "People and their roles at this venue.")}</p></div><button onClick={() => setCreate(true)} className="flex items-center gap-2 min-h-[48px] px-4 rounded-xl bg-primary text-white font-bold"><Plus size={18} />{t("Dodaj", "Add")}</button></header>
    {error && <p role="alert" className="p-3 rounded-xl bg-red-50 text-red-700">{error}</p>}
    <div className="space-y-3">{staff.map(user => {
      const assigned = user.restaurantAccess.find(a => a.restaurantId === venue)?.role;
      const editable = user.id !== current?.id && (admin || (user.platformRole !== "admin" && assigned !== "owner" && (role === "owner" || assigned !== "manager")));
      return <article key={user.id} className="adm-surface border adm-border rounded-2xl p-4 space-y-3"><div><h2 className="font-bold">{user.name}</h2><p className="text-sm adm-text-muted break-all">{user.email}</p></div>
        <label className="block text-sm">{t("Uloga u lokalu", "Venue role")}<select aria-label={`${t("Uloga", "Role")}: ${user.name}`} disabled={!editable || busy} value={assigned ?? ""} onChange={e => void act(async () => { await performAction("staff.role", venue, { userId: user.id, role: e.target.value }); })} className="mt-1 block w-full rounded-xl adm-input border p-3 min-h-[48px]">{assigned && !roles.includes(assigned) && <option value={assigned}>{labels[assigned]}</option>}{roles.map(r => <option key={r} value={r}>{labels[r]}</option>)}</select></label>
        {admin && <label className="block text-sm">{t("Pristup platformi", "Platform access")}<select disabled={busy || user.id === current?.id} value={user.platformRole} onChange={e => void act(async () => { await performAction("staff.platform-role", venue, { userId: user.id, role: e.target.value }); })} className="mt-1 block w-full rounded-xl adm-input border p-3 min-h-[48px]"><option value="user">{t("Korisnik lokala", "Venue user")}</option><option value="admin">{t("Administrator platforme", "Platform administrator")}</option></select></label>}
        {editable && <div className="flex flex-wrap gap-3"><button disabled={busy} onClick={() => void act(async () => { const result = await auth.generatePinResetOtp(user.id, venue); setIssued({ name: user.name, code: result.code }); })} className="min-h-[44px] text-sm font-semibold text-primary">{t("Izdaj privremeni PIN", "Issue temporary PIN")}</button><button disabled={busy} onClick={() => { if (window.confirm(t("Ukloniti pristup ovom lokalu? Historija rada ostaje sačuvana.", "Remove access to this venue? Work history will be preserved."))) void act(async () => { await performAction("staff.remove", venue, { userId: user.id }); }); }} className="min-h-[44px] text-sm text-red-600">{t("Ukloni pristup", "Remove access")}</button></div>}
      </article>;
    })}</div>
    {create && <div className="fixed inset-0 z-[110] bg-black/50 flex items-end sm:items-center justify-center"><form onSubmit={e => { e.preventDefault(); void act(async () => { const result = await auth.inviteUser({ ...form, restaurantId: venue }); setIssued({ name: result.user.name, code: result.inviteCode }); setCreate(false); setForm({ firstName: "", lastName: "", email: "", phone: "", restaurantRole: "employee", platformRole: "user" }); }); }} className="adm-surface rounded-t-3xl sm:rounded-3xl p-5 w-full max-w-md max-h-[92dvh] overflow-y-auto space-y-4" role="dialog" aria-modal="true" aria-labelledby="staff-title">
      <header className="flex items-center justify-between"><h2 id="staff-title" className="text-xl font-extrabold">{t("Novi član osoblja", "New staff member")}</h2><button type="button" aria-label={t("Zatvori", "Close")} onClick={() => setCreate(false)} className="p-3"><X size={20} /></button></header>
      <p className="text-sm adm-text-muted">{t("Unesite kontakt podatke i ulogu. Na kraju ćete dobiti privremeni PIN za prvu prijavu.", "Enter their contact details and role. You'll receive a temporary PIN for their first sign-in.")}</p>
      {([['firstName',t('Ime','First name'),'text','given-name'],['lastName',t('Prezime','Last name'),'text','family-name'],['email','Email','email','email'],['phone',t('Broj telefona','Phone number'),'tel','tel']] as const).map(([key,label,type,complete]) => <label key={key} className="block text-sm font-semibold">{label}<input required type={type} autoComplete={complete} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} className="mt-1 block w-full rounded-xl adm-input border p-3 min-h-[48px]" /></label>)}
      <label className="block text-sm font-semibold">{t("Uloga", "Role")}<select value={form.restaurantRole} onChange={e => setForm({ ...form, restaurantRole: e.target.value as RestaurantRole })} className="mt-1 w-full rounded-xl adm-input border p-3 min-h-[48px]">{roles.map(r => <option key={r} value={r}>{labels[r]}</option>)}</select></label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button disabled={busy} className="w-full min-h-[48px] rounded-xl bg-primary text-white font-bold flex items-center justify-center gap-2">{busy && <Loader2 size={18} className="animate-spin" />}{t("Dodaj člana osoblja", "Add staff member")}</button>
    </form></div>}
    {issued && <div className="fixed inset-0 z-[120] bg-black/50 grid place-items-center p-4"><section role="dialog" aria-modal="true" aria-labelledby="pin-title" className="adm-surface rounded-3xl p-6 max-w-md w-full text-center space-y-4"><h2 id="pin-title" className="text-xl font-bold">{issued.name}</h2><p>{t("Privremeni PIN za prvu prijavu", "Temporary PIN for first sign-in")}</p><p className="text-4xl font-mono tracking-[.3em]">{issued.code}</p><p className="text-sm adm-text-muted">{t("Važi 7 dana. Osoba se prijavljuje svojom email adresom i ovim PIN-om, a zatim postavlja svoj PIN.", "Valid for 7 days. Sign in with the email address and this PIN, then choose a personal PIN.")}</p><button onClick={() => void navigator.clipboard.writeText(issued.code)} className="min-h-[44px] inline-flex items-center gap-2 font-bold text-primary"><Copy size={18} />{t("Kopiraj PIN", "Copy PIN")}</button><button onClick={() => setIssued(null)} className="block w-full min-h-[48px] rounded-xl bg-primary text-white font-bold">{t("Gotovo", "Done")}</button></section></div>}
  </div>;
}
