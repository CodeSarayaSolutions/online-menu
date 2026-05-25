"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  Users,
  Shield,
  ShieldCheck,
  X,
  ChevronDown,
  Store,
  UserCog,
  ClipboardList,
  AlertTriangle,
  Copy,
  KeyRound,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useCmsStore } from "@/store/cmsStore";
import { AppUser, PlatformRole, RestaurantRole } from "@/types/auth";
import * as authService from "@/services/authService";
import { mapApiUserToAppUser } from "@/lib/auth/map-user";
import { canManageVenueStaff, isPlatformAdmin } from "@/lib/permissions";
import clsx from "clsx";

const PLATFORM_ROLE_LABELS: Record<PlatformRole, { label: string; color: string; icon: typeof Shield }> = {
  admin: { label: "Admin", color: "text-primary bg-primary/10", icon: ShieldCheck },
  user: { label: "Korisnik", color: "text-accent-blue bg-accent-blue/10", icon: Shield },
};

const RESTAURANT_ROLE_LABELS: Record<RestaurantRole, { label: string; desc: string; color: string }> = {
  owner: { label: "Vlasnik", desc: "Pun pristup lokalu + osoblje + pozivnice", color: "text-amber-700 bg-amber-500/10 border-amber-500/20" },
  manager: { label: "Menadžer", desc: "Meni, narudžbe i postavke", color: "text-primary bg-primary/10 border-primary/20" },
  kitchen: { label: "Kuhinja", desc: "Samo kuhinjska stanica", color: "text-orange-700 bg-orange-500/10 border-orange-500/20" },
  bar: { label: "Bar", desc: "Samo bar stanica", color: "text-purple-700 bg-purple-500/10 border-purple-500/20" },
  employee: { label: "Osoblje", desc: "Lista narudžbi", color: "text-accent-green bg-accent-green/10 border-accent-green/20" },
};

const AVATARS = ["👑", "👨‍🍳", "🧑‍💼", "👩‍🍳", "🧑‍💻", "👤", "🍽️", "⭐"];

export default function UsersPage() {
  const params = useParams();
  const venueSlug =
    typeof params.venue === "string" ? params.venue : useAuthStore.getState().activeRestaurantId ?? "";

  const users = useAuthStore((s) => s.users);
  const currentUser = useAuthStore((s) => s.getCurrentUser());
  const addUser = useAuthStore((s) => s.addUser);
  const setUsers = useAuthStore((s) => s.setUsers);
  const updateUser = useAuthStore((s) => s.updateUser);
  const removeUser = useAuthStore((s) => s.removeUser);
  const assignRestaurantRole = useAuthStore((s) => s.assignRestaurantRole);
  const removeRestaurantAccess = useAuthStore((s) => s.removeRestaurantAccess);

  const allRestaurants = useCmsStore((s) => s.allRestaurants);
  const restaurantIds = Object.keys(allRestaurants);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // New user form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newAvatar, setNewAvatar] = useState("👤");
  const [newPlatformRole, setNewPlatformRole] = useState<PlatformRole>("user");
  const [newRestaurantRole, setNewRestaurantRole] = useState<RestaurantRole>("owner");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteResult, setInviteResult] = useState<{
    code: string;
    email: string;
    name: string;
    expiresAt: string;
  } | null>(null);
  const [pinResetLoading, setPinResetLoading] = useState(false);
  const [pinResetResult, setPinResetResult] = useState<{
    code: string;
    name: string;
    expiresAt: string;
  } | null>(null);

  const isAdmin = currentUser?.platformRole === "admin";
  const canManageStaff =
    !!venueSlug && !!currentUser && (isPlatformAdmin(currentUser) || canManageVenueStaff(currentUser, venueSlug));

  const handleInvite = async () => {
    if (!newName.trim() || !newEmail.trim()) return;
    setInviteLoading(true);
    setInviteError("");
    try {
      const result = await authService.inviteUser({
        email: newEmail.trim(),
        name: newName.trim(),
        platformRole: newPlatformRole,
        restaurantId: venueSlug || undefined,
        restaurantRole: newRestaurantRole,
      });
      const appUser = mapApiUserToAppUser(
        {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          avatar: newAvatar,
          platform_role: newPlatformRole,
          created_at: new Date().toISOString(),
        },
        venueSlug
          ? [{ restaurantId: venueSlug, role: newRestaurantRole }]
          : []
      );
      addUser(appUser);
      const all = await authService.fetchAllUsersForAdmin();
      setUsers(all);
      setInviteResult({
        code: result.inviteCode,
        email: result.user.email,
        name: result.user.name,
        expiresAt: result.inviteExpiresAt,
      });
      setShowCreateModal(false);
      setNewName("");
      setNewEmail("");
      setNewAvatar("👤");
      setNewPlatformRole("user");
      setNewRestaurantRole("owner");
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setInviteLoading(false);
    }
  };

  const copyInviteCode = () => {
    if (inviteResult?.code) navigator.clipboard.writeText(inviteResult.code);
  };

  const copyPinResetCode = () => {
    if (pinResetResult?.code) navigator.clipboard.writeText(pinResetResult.code);
  };

  const handlePinResetOtp = async (user: AppUser) => {
    setPinResetLoading(true);
    try {
      const result = await authService.generatePinResetOtp(user.id, venueSlug || undefined);
      setPinResetResult({
        code: result.code,
        name: user.name,
        expiresAt: result.expiresAt,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Generiranje PIN koda nije uspjelo");
    } finally {
      setPinResetLoading(false);
    }
  };

  const handleReinvite = async (user: AppUser) => {
    setInviteLoading(true);
    setInviteError("");
    try {
      const access = user.restaurantAccess.find((a) => a.restaurantId === venueSlug);
      const result = await authService.inviteUser({
        email: user.email,
        name: user.name,
        platformRole: user.platformRole,
        restaurantId: venueSlug || undefined,
        restaurantRole: access?.role ?? "owner",
      });
      setInviteResult({
        code: result.inviteCode,
        email: result.user.email,
        name: result.user.name,
        expiresAt: result.inviteExpiresAt,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Re-invite failed");
    } finally {
      setInviteLoading(false);
    }
  };

  const persistRestaurantRole = async (
    userId: string,
    restaurantId: string,
    role: RestaurantRole
  ) => {
    try {
      await authService.assignRestaurantRole(userId, restaurantId, role);
      assignRestaurantRole(userId, restaurantId, role);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not save role");
    }
  };

  const persistRemoveAccess = async (userId: string, restaurantId: string) => {
    try {
      await authService.removeRestaurantAccess(userId, restaurantId);
      removeRestaurantAccess(userId, restaurantId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not remove access");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await authService.deleteUser(id);
      removeUser(id);
      const all = await authService.fetchAllUsersForAdmin();
      setUsers(all);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not delete user");
    }
    setDeleteTarget(null);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-dark adm-text tracking-tight">
            Korisnici i uloge
          </h1>
          <p className="text-sm text-muted adm-text-muted mt-1">
            {users.length} user{users.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        {isAdmin && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-primary to-amber-500 text-white px-5 py-2.5 rounded-2xl text-sm font-bold shadow-glow hover:brightness-105 transition"
          >
            <Plus size={16} />
            Invite user
          </motion.button>
        )}
      </div>

      {/* Role legend */}
      <div className="adm-surface adm-border border rounded-2xl shadow-soft border border-primary/5 p-5 mb-6">
        <h3 className="text-xs font-bold text-dark adm-text uppercase tracking-wider mb-3">Role Reference</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-bold text-muted adm-text-muted uppercase tracking-wider mb-2">Platform Roles (Saraya)</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-primary" />
                <span className="text-[12px] font-bold text-dark adm-text">Admin</span>
                <span className="text-[11px] text-muted adm-text-muted">— Full control, assigns restaurants</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-accent-blue" />
                <span className="text-[12px] font-bold text-dark adm-text">User</span>
                <span className="text-[11px] text-muted adm-text-muted">— Accesses assigned restaurants only</span>
              </div>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted adm-text-muted uppercase tracking-wider mb-2">Restaurant Roles (Client)</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <UserCog size={14} className="text-primary" />
                <span className="text-[12px] font-bold text-dark adm-text">Manager</span>
                <span className="text-[11px] text-muted adm-text-muted">— Changes prices, categories & products</span>
              </div>
              <div className="flex items-center gap-2">
                <ClipboardList size={14} className="text-accent-green" />
                <span className="text-[12px] font-bold text-dark adm-text">Employee</span>
                <span className="text-[11px] text-muted adm-text-muted">— Receives and manages orders</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Users list */}
      <div className="space-y-3">
        {users.map((user, i) => {
          const roleInfo = PLATFORM_ROLE_LABELS[user.platformRole];
          const RoleIcon = roleInfo.icon;
          const isExpanded = expandedUser === user.id;
          const isSelf = user.id === currentUser?.id;

          return (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
              className={clsx(
                "adm-surface adm-border border rounded-2xl shadow-soft border overflow-hidden transition-all",
                isSelf ? "border-primary/20" : "border-primary/5"
              )}
            >
              {/* User row */}
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-[var(--adm-surface-2)]/50 transition"
                onClick={() => setExpandedUser(isExpanded ? null : user.id)}
              >
                <div className="w-11 h-11 rounded-2xl adm-bg flex items-center justify-center text-xl shrink-0">
                  {user.avatar || "👤"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold text-dark adm-text truncate">{user.name}</span>
                    {isSelf && (
                      <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">YOU</span>
                    )}
                  </div>
                  <p className="text-[12px] text-muted adm-text-muted truncate">{user.email}</p>
                </div>
                <div className={clsx("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold", roleInfo.color)}>
                  <RoleIcon size={12} />
                  {roleInfo.label}
                </div>
                <div className="text-[12px] text-muted adm-text-muted font-medium">
                  {user.platformRole === "admin"
                    ? "All restaurants"
                    : `${user.restaurantAccess.length} restaurant${user.restaurantAccess.length !== 1 ? "s" : ""}`}
                </div>
                <ChevronDown
                  size={16}
                  className={clsx("text-muted adm-text-muted transition-transform", isExpanded && "rotate-180")}
                />
              </div>

              {/* Expanded: restaurant access management */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-1 border-t border-bg">
                      {/* Platform role changer */}
                      {isAdmin && !isSelf && (
                        <div className="mb-4">
                          <p className="text-[10px] font-bold text-muted adm-text-muted uppercase tracking-wider mb-2">Platform Role</p>
                          <div className="flex gap-2">
                            {(["admin", "user"] as PlatformRole[]).map((role) => (
                              <button
                                key={role}
                                onClick={() => updateUser(user.id, { platformRole: role })}
                                className={clsx(
                                  "px-4 py-2 rounded-xl text-[12px] font-bold transition border",
                                  user.platformRole === role
                                    ? "bg-primary/10 text-primary border-primary/20"
                                    : "adm-bg text-muted adm-text-muted border-transparent hover:adm-text"
                                )}
                              >
                                {PLATFORM_ROLE_LABELS[role].label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {isAdmin && !isSelf && (
                        <button
                          type="button"
                          onClick={() => void handleReinvite(user)}
                          disabled={inviteLoading}
                          className="mb-3 w-full py-2.5 rounded-xl border border-primary/20 text-[12px] font-bold text-primary hover:bg-primary/5 transition"
                        >
                          <KeyRound size={14} className="inline mr-1.5 -mt-0.5" />
                          Novi pozivni kod (6 znamenki)
                        </button>
                      )}

                      {canManageStaff && !isSelf && (
                        <button
                          type="button"
                          onClick={() => void handlePinResetOtp(user)}
                          disabled={pinResetLoading}
                          className="mb-4 w-full py-2.5 rounded-xl border border-purple-500/25 text-[12px] font-bold text-purple-700 hover:bg-purple-500/5 transition"
                        >
                          <KeyRound size={14} className="inline mr-1.5 -mt-0.5" />
                          Generiraj PIN kod (6 znamenki)
                        </button>
                      )}

                      {/* Restaurant access */}
                      {user.platformRole !== "admin" && (
                        <div>
                          <p className="text-[10px] font-bold text-muted adm-text-muted uppercase tracking-wider mb-2">Restaurant Access</p>
                          <div className="space-y-2">
                            {restaurantIds.map((rId) => {
                              const rData = allRestaurants[rId];
                              const access = user.restaurantAccess.find((a) => a.restaurantId === rId);

                              return (
                                <div
                                  key={rId}
                                  className="flex items-center gap-3 p-3 rounded-xl adm-bg/50 border border-primary/5"
                                >
                                  <Store size={14} className="text-muted adm-text-muted shrink-0" />
                                  <span className="text-[13px] font-semibold text-dark adm-text flex-1 truncate">
                                    {rData.restaurant.name}
                                  </span>
                                  {isAdmin && (
                                    <div className="flex items-center gap-1.5">
                                      {(["owner", "manager", "kitchen", "bar", "employee"] as RestaurantRole[]).map((role) => (
                                        <button
                                          key={role}
                                          onClick={() => void persistRestaurantRole(user.id, rId, role)}
                                          className={clsx(
                                            "px-3 py-1.5 rounded-lg text-[11px] font-bold transition border",
                                            access?.role === role
                                              ? RESTAURANT_ROLE_LABELS[role].color
                                              : "adm-surface adm-border border text-muted adm-text-muted border adm-border hover:adm-text"
                                          )}
                                        >
                                          {RESTAURANT_ROLE_LABELS[role].label}
                                        </button>
                                      ))}
                                      {access && (
                                        <button
                                          onClick={() => void persistRemoveAccess(user.id, rId)}
                                          className="p-1.5 rounded-lg text-muted adm-text-muted hover:text-accent-red hover:bg-red-50 transition"
                                          title="Remove access"
                                        >
                                          <X size={12} />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                  {!isAdmin && access && (
                                    <span className={clsx(
                                      "px-3 py-1 rounded-lg text-[11px] font-bold border",
                                      RESTAURANT_ROLE_LABELS[access.role].color
                                    )}>
                                      {RESTAURANT_ROLE_LABELS[access.role].label}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {user.platformRole === "admin" && (
                        <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                          <p className="text-[12px] text-primary font-medium">
                            Platform admins have full access to all restaurants as managers.
                          </p>
                        </div>
                      )}

                      {/* Delete button */}
                      {isAdmin && !isSelf && (
                        <div className="mt-4 pt-3 border-t border-bg">
                          <button
                            onClick={() => setDeleteTarget(user.id)}
                            className="flex items-center gap-2 text-[12px] font-bold text-accent-red/70 hover:text-accent-red transition"
                          >
                            <Trash2 size={13} />
                            Remove user
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* ── Create User Modal ── */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25 }}
              className="adm-surface adm-border border rounded-3xl p-6 max-w-[420px] w-full shadow-elevated"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-extrabold text-dark adm-text">Invite user</h3>
                <p className="text-[11px] text-muted adm-text-muted mt-0.5">No email sent — copy the code below</p>
                <button onClick={() => setShowCreateModal(false)} className="p-1.5 rounded-xl hover:bg-[var(--adm-surface-2)] text-muted adm-text-muted transition">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Avatar picker */}
                <div>
                  <label className="block text-[12px] font-bold text-dark adm-text/70 mb-1.5 uppercase tracking-wider">Avatar</label>
                  <div className="flex gap-2 flex-wrap">
                    {AVATARS.map((a) => (
                      <button
                        key={a}
                        onClick={() => setNewAvatar(a)}
                        className={clsx(
                          "w-10 h-10 rounded-xl flex items-center justify-center text-lg transition border-2",
                          newAvatar === a
                            ? "border-primary bg-primary/10"
                            : "border-transparent adm-bg hover:border-primary/20"
                        )}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-dark adm-text/70 mb-1.5 uppercase tracking-wider">Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g., John Doe"
                    className="w-full px-4 py-3 rounded-xl border border adm-border text-dark adm-text text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:adm-text-faint transition"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-dark adm-text/70 mb-1.5 uppercase tracking-wider">Email</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="e.g., john@example.com"
                    className="w-full px-4 py-3 rounded-xl border border adm-border text-dark adm-text text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:adm-text-faint transition"
                  />
                </div>

                {isAdmin && (
                  <div>
                    <label className="block text-[12px] font-bold text-dark adm-text/70 mb-1.5 uppercase tracking-wider">Platform Role</label>
                    <div className="flex gap-2">
                      {(["user", "admin"] as PlatformRole[]).map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setNewPlatformRole(role)}
                          className={clsx(
                            "flex-1 py-2.5 rounded-xl text-[13px] font-bold transition border",
                            newPlatformRole === role
                              ? "bg-primary/10 text-primary border-primary/20"
                              : "adm-bg text-muted adm-text-muted border-transparent hover:adm-text"
                          )}
                        >
                          {PLATFORM_ROLE_LABELS[role].label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {venueSlug && (
                  <div>
                    <label className="block text-[12px] font-bold text-dark adm-text/70 mb-1.5 uppercase tracking-wider">Role at this venue</label>
                    <select
                      value={newRestaurantRole}
                      onChange={(e) => setNewRestaurantRole(e.target.value as RestaurantRole)}
                      className="w-full px-4 py-3 rounded-xl border border adm-border text-sm font-medium"
                    >
                      {(["owner", "manager", "kitchen", "bar", "employee"] as RestaurantRole[]).map((r) => (
                        <option key={r} value={r}>
                          {RESTAURANT_ROLE_LABELS[r].label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <p className="text-[11px] text-muted adm-text-muted bg-amber-50 border border-amber-200/60 rounded-xl px-3 py-2 leading-relaxed">
                  <strong>Prva prijava:</strong> korisnik unese email → dobije polje za{" "}
                  <strong>6-cifreni kod</strong> (ne lozinku koju vi znate). Zatim postavi svoju lozinku.
                </p>

                {inviteError && (
                  <p className="text-[12px] text-red-600 bg-red-50 px-3 py-2 rounded-lg">{inviteError}</p>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 rounded-2xl border border adm-border text-sm font-bold text-dark adm-text hover:bg-[var(--adm-surface-2)] transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleInvite}
                  disabled={!newName.trim() || !newEmail.trim() || inviteLoading}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-primary to-amber-500 text-white text-sm font-bold hover:brightness-105 transition shadow-glow disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {inviteLoading ? "Creating…" : "Create & get code"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PIN reset OTP (copy for employee) ── */}
      <AnimatePresence>
        {pinResetResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="adm-surface adm-border border rounded-3xl p-6 max-w-[400px] w-full shadow-elevated"
            >
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                <KeyRound size={22} className="text-purple-700" />
              </div>
              <h3 className="text-lg font-extrabold text-dark adm-text text-center">PIN kod</h3>
              <p className="text-sm text-muted adm-text-muted text-center mt-2">
                Pošaljite kod korisniku{" "}
                <span className="font-bold text-dark adm-text">{pinResetResult.name}</span>. Na prijavi:
                <strong> Promijeni PIN</strong> → unos koda → novi PIN (3 cifre).
              </p>
              <div className="mt-4 p-4 adm-bg rounded-2xl text-center">
                <p className="text-3xl font-black tracking-[0.4em] text-dark adm-text font-mono">
                  {pinResetResult.code}
                </p>
                <p className="text-[10px] text-muted adm-text-muted mt-2">
                  Vrijedi do {new Date(pinResetResult.expiresAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={copyPinResetCode}
                  className="flex-1 py-3 rounded-2xl border border-purple-500/25 text-sm font-bold text-purple-700 flex items-center justify-center gap-2"
                >
                  <Copy size={16} />
                  Kopiraj kod
                </button>
                <button
                  type="button"
                  onClick={() => setPinResetResult(null)}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-primary to-amber-500 text-white text-sm font-bold"
                >
                  Gotovo
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Invite code (copy for client) ── */}
      <AnimatePresence>
        {inviteResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="adm-surface adm-border border rounded-3xl p-6 max-w-[400px] w-full shadow-elevated"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <KeyRound size={22} className="text-primary" />
              </div>
              <h3 className="text-lg font-extrabold text-dark adm-text text-center">Invite code</h3>
              <p className="text-sm text-muted adm-text-muted text-center mt-2">
                Pošaljite kod korisniku <span className="font-bold text-dark adm-text">{inviteResult.name}</span> (
                {inviteResult.email}). Prijava: email → <strong>kod</strong> → nova lozinka (ne postojeća lozinka).
              </p>
              <div className="mt-4 p-4 adm-bg rounded-2xl text-center">
                <p className="text-3xl font-black tracking-[0.4em] text-dark adm-text font-mono">{inviteResult.code}</p>
                <p className="text-[10px] text-muted adm-text-muted mt-2">
                  Valid until {new Date(inviteResult.expiresAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={copyInviteCode}
                  className="flex-1 py-3 rounded-2xl border border-primary/20 text-sm font-bold text-primary flex items-center justify-center gap-2"
                >
                  <Copy size={16} />
                  Copy code
                </button>
                <button
                  type="button"
                  onClick={() => setInviteResult(null)}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-primary to-amber-500 text-white text-sm font-bold"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete Confirmation Modal ── */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25 }}
              className="adm-surface adm-border border rounded-3xl p-6 max-w-[380px] w-full shadow-elevated"
            >
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={22} className="text-accent-red" />
              </div>
              <h3 className="text-lg font-extrabold text-dark adm-text text-center">Remove User?</h3>
              <p className="text-sm text-muted adm-text-muted mt-2 text-center leading-relaxed">
                This will remove{" "}
                <span className="font-bold text-dark adm-text">
                  {users.find((u) => u.id === deleteTarget)?.name}
                </span>{" "}
                and all their access. This cannot be undone.
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-3 rounded-2xl border border adm-border text-sm font-bold text-dark adm-text hover:bg-[var(--adm-surface-2)] transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteTarget)}
                  className="flex-1 py-3 rounded-2xl bg-accent-red text-white text-sm font-bold hover:brightness-110 transition shadow-lg shadow-red-200"
                >
                  Remove
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
