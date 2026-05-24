"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Store,
  UtensilsCrossed,
  Plus,
  Trash2,
  Package,
  Tags,
  UserCog,
  Users,
  Crown,
  ShieldCheck,
  Shield,
  Star,
  Calendar,
  MapPin,
  Clock,
  X,
  AlertTriangle,
  Coffee,
  Wine,
  Building2,
  CakeSlice,
  Truck,
  Pizza,
  Beer,
  Martini,
  Sparkles,
  Mail,
  TrendingUp,
  Palette,
  Globe,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCmsStore, VenueType } from "@/store/cmsStore";
import { useAuthStore } from "@/store/authStore";
import * as authService from "@/services/authService";
import clsx from "clsx";

// ─── Venue type config ──────────────────────────────────
const VENUE_TYPES: { value: VenueType; label: string; icon: typeof Store; emoji: string; desc: string }[] = [
  { value: "restaurant", label: "Restaurant", icon: UtensilsCrossed, emoji: "🍽️", desc: "Full-service dining" },
  { value: "cafe",       label: "Café",       icon: Coffee,          emoji: "☕",  desc: "Coffee & light bites" },
  { value: "bar",        label: "Bar",        icon: Wine,            emoji: "🍸",  desc: "Cocktails & spirits" },
  { value: "bakery",     label: "Bakery",     icon: CakeSlice,       emoji: "🧁",  desc: "Pastries & bread" },
  { value: "food-truck", label: "Food Truck", icon: Truck,           emoji: "🚚",  desc: "Street food on wheels" },
  { value: "pizzeria",   label: "Pizzeria",   icon: Pizza,           emoji: "🍕",  desc: "Pizza & Italian" },
  { value: "pub",        label: "Pub",        icon: Beer,            emoji: "🍺",  desc: "Drinks & pub grub" },
  { value: "lounge",     label: "Lounge",     icon: Martini,         emoji: "🍹",  desc: "Premium drinks & vibes" },
];

const VENUE_COLORS: Record<VenueType, { bg: string; text: string; border: string }> = {
  restaurant:  { bg: "bg-primary/10",     text: "text-primary",      border: "border-primary/20" },
  cafe:        { bg: "bg-amber-500/10",   text: "text-amber-600",    border: "border-amber-500/20" },
  bar:         { bg: "bg-purple-500/10",  text: "text-purple-600",   border: "border-purple-500/20" },
  bakery:      { bg: "bg-pink-500/10",    text: "text-pink-600",     border: "border-pink-500/20" },
  "food-truck":{ bg: "bg-orange-500/10",  text: "text-orange-600",   border: "border-orange-500/20" },
  pizzeria:    { bg: "bg-red-500/10",     text: "text-red-600",      border: "border-red-500/20" },
  pub:         { bg: "bg-yellow-500/10",  text: "text-yellow-700",   border: "border-yellow-500/20" },
  lounge:      { bg: "bg-indigo-500/10",  text: "text-indigo-600",   border: "border-indigo-500/20" },
};

export default function AdminDashboard() {
  const router = useRouter();

  const allRestaurants = useCmsStore((s) => s.allRestaurants);
  const createRestaurant = useCmsStore((s) => s.createRestaurant);
  const deleteRestaurant = useCmsStore((s) => s.deleteRestaurant);
  const switchRestaurant = useCmsStore((s) => s.switchRestaurant);

  const currentUser = useAuthStore((s) => s.getCurrentUser());
  const activeRestaurantId = useAuthStore((s) => s.activeRestaurantId);
  const setActiveRestaurant = useAuthStore((s) => s.setActiveRestaurant);
  const users = useAuthStore((s) => s.users);
  const assignRestaurantRole = useAuthStore((s) => s.assignRestaurantRole);
  const getUserRestaurantRole = useAuthStore((s) => s.getUserRestaurantRole);
  const login = useAuthStore((s) => s.login);
  const isLoggedIn = !!currentUser;

  // Step flow: click a venue → navigate to /admin/[venue] for role picker
  const handleClickVenue = (id: string) => {
    router.push(`/admin/${id}`);
  };

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Create form
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newVenueType, setNewVenueType] = useState<VenueType>("restaurant");

  const isAdmin = currentUser?.platformRole === "admin";
  const restaurantIds = useMemo(() => {
    const all = Object.keys(allRestaurants);
    if (!currentUser) return [];
    if (isAdmin) return all;
    return all.filter((id) =>
      currentUser.restaurantAccess.some((a) => a.restaurantId === id)
    );
  }, [allRestaurants, currentUser, isAdmin]);

  // ─── Computed global stats ─────────────────────────────
  const globalStats = useMemo(() => {
    const ids = Object.keys(allRestaurants);
    const totalProducts = ids.reduce((sum, id) => sum + allRestaurants[id].products.length, 0);
    const totalCategories = ids.reduce(
      (sum, id) =>
        sum + allRestaurants[id].categories.filter((c) => c.id !== "all" && c.id !== "popular").length,
      0
    );
    const totalPopular = ids.reduce(
      (sum, id) => sum + allRestaurants[id].products.filter((p) => p.popular).length,
      0
    );

    // Venue type breakdown
    const venueTypeCounts: Record<string, number> = {};
    ids.forEach((id) => {
      const vt = allRestaurants[id].venueType || "restaurant";
      venueTypeCounts[vt] = (venueTypeCounts[vt] || 0) + 1;
    });

    // User breakdown across all venues
    const totalUsers = users.length;
    const platformAdmins = users.filter((u) => u.platformRole === "admin").length;
    const managers = users.filter(
      (u) => u.platformRole !== "admin" && u.restaurantAccess.some((ra) => ra.role === "manager")
    ).length;
    const employees = users.filter(
      (u) => u.platformRole !== "admin" && u.restaurantAccess.some((ra) => ra.role === "employee")
    ).length;

    return { totalProducts, totalCategories, totalPopular, venueTypeCounts, totalUsers, platformAdmins, managers, employees };
  }, [allRestaurants, users]);

  // ─── Per-venue user breakdown helper ───────────────────
  const getVenueUserBreakdown = (venueId: string) => {
    const venueUsers = users.filter(
      (u) => u.platformRole === "admin" || u.restaurantAccess.some((ra) => ra.restaurantId === venueId)
    );
    const admins = venueUsers.filter((u) => u.platformRole === "admin");
    const managers = venueUsers.filter(
      (u) => u.platformRole !== "admin" && u.restaurantAccess.some((ra) => ra.restaurantId === venueId && ra.role === "manager")
    );
    const employees = venueUsers.filter(
      (u) => u.platformRole !== "admin" && u.restaurantAccess.some((ra) => ra.restaurantId === venueId && ra.role === "employee")
    );
    return { all: venueUsers, admins, managers, employees };
  };

  const handleCreate = () => {
    if (!newName.trim() || !newSlug.trim()) return;
    const slug = newSlug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    if (allRestaurants[slug]) {
      alert("A venue with this ID already exists.");
      return;
    }
    createRestaurant(slug, newName.trim(), newVenueType);

    if (currentUser) {
      void authService
        .assignRestaurantRole(currentUser.id, slug, "owner")
        .then(() => assignRestaurantRole(currentUser.id, slug, "owner"))
        .catch(console.error);
    }

    setNewName("");
    setNewSlug("");
    setNewVenueType("restaurant");
    setShowCreateModal(false);
  };

  const handleDelete = (id: string) => {
    if (id === activeRestaurantId) {
      const other = restaurantIds.find((r) => r !== id);
      if (other && activeRestaurantId) {
        switchRestaurant(activeRestaurantId, other);
        setActiveRestaurant(other);
      }
    }
    deleteRestaurant(id);
    setDeleteTarget(null);
  };

  // Step 1: User clicks a venue → navigate to /admin/[venue] for role picker
  // (handleClickVenue is defined above)

  // Helper: format date nicely
  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "Unknown";
    }
  };

  const formatTimeAgo = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return "today";
      if (diffDays === 1) return "yesterday";
      if (diffDays < 30) return `${diffDays}d ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
      return `${Math.floor(diffDays / 365)}y ago`;
    } catch {
      return "";
    }
  };

  // ═══════════════════════════════════════════════════════════
  // STEP 1: Venue Grid (pick or create a venue)
  // ═══════════════════════════════════════════════════════════
  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <div>
          <h1 className="text-xl lg:text-2xl font-extrabold text-dark tracking-tight">All Venues</h1>
          <p className="text-[13px] text-muted mt-1">
            Manage your restaurants, cafés, and more
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-primary to-amber-500 text-white px-5 py-2.5 rounded-2xl text-[13px] font-bold shadow-glow hover:brightness-105 transition"
        >
          <Plus size={15} />
          New Venue
        </motion.button>
      </motion.div>

      {/* ── Global Stats Summary ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-white rounded-2xl border border-gray-100/80 shadow-soft p-5 mb-6"
      >
        {/* Top row: key numbers */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Globe size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-lg font-extrabold text-dark leading-none">{restaurantIds.length}</p>
              <p className="text-[11px] text-muted mt-0.5">Total Venues</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-blue/10 flex items-center justify-center shrink-0">
              <Package size={18} className="text-accent-blue" />
            </div>
            <div>
              <p className="text-lg font-extrabold text-dark leading-none">{globalStats.totalProducts}</p>
              <p className="text-[11px] text-muted mt-0.5">Total Products</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-green/10 flex items-center justify-center shrink-0">
              <Users size={18} className="text-accent-green" />
            </div>
            <div>
              <p className="text-lg font-extrabold text-dark leading-none">{globalStats.totalUsers}</p>
              <p className="text-[11px] text-muted mt-0.5">Total Users</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <Star size={18} className="text-amber-500" />
            </div>
            <div>
              <p className="text-lg font-extrabold text-dark leading-none">{globalStats.totalPopular}</p>
              <p className="text-[11px] text-muted mt-0.5">Popular Items</p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100 my-3" />

        {/* Bottom row: venue type breakdown + user role breakdown */}
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {/* Venue type chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">By Type:</span>
            {Object.entries(globalStats.venueTypeCounts).map(([type, count]) => {
              const vConf = VENUE_TYPES.find((v) => v.value === type);
              const vColor = VENUE_COLORS[type as VenueType];
              return (
                <span
                  key={type}
                  className={clsx("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold", vColor?.bg, vColor?.text)}
                >
                  {vConf?.emoji} {count} {vConf?.label || type}
                </span>
              );
            })}
          </div>

          {/* User role chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Staff:</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700">
              <Crown size={10} /> {globalStats.platformAdmins} Admin{globalStats.platformAdmins !== 1 ? "s" : ""}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-700">
              <ShieldCheck size={10} /> {globalStats.managers} Manager{globalStats.managers !== 1 ? "s" : ""}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-700">
              <Shield size={10} /> {globalStats.employees} Employee{globalStats.employees !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Total categories */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Categories:</span>
            <span className="text-[11px] font-bold text-dark">{globalStats.totalCategories}</span>
          </div>
        </div>
      </motion.div>

      {/* ── Venue Grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {restaurantIds.map((id, i) => {
          const data = allRestaurants[id];
          const venueType = data.venueType || "restaurant";
          const vConf = VENUE_TYPES.find((v) => v.value === venueType) || VENUE_TYPES[0];
          const vColor = VENUE_COLORS[venueType];
          const isActive = id === activeRestaurantId;
          const productCount = data.products.length;
          const categoryCount = data.categories.filter((c) => c.id !== "all" && c.id !== "popular").length;
          const popularCount = data.products.filter((p) => p.popular).length;
          const venueBreakdown = getVenueUserBreakdown(id);
          const createdAt = data.createdAt || "2025-01-15T10:00:00.000Z";
          const activeTheme = data.layoutConfig?.activeTheme || "custom";

          return (
            <motion.div
              key={id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.35 }}
              className={clsx(
                "bg-white rounded-2xl shadow-soft overflow-hidden border-2 transition-all duration-300 cursor-pointer group",
                isActive ? "border-primary shadow-card" : "border-gray-100/80 hover:border-primary/20 hover:shadow-card"
              )}
              onClick={() => handleClickVenue(id)}
            >
              {/* Hero image + info */}
              <div className="h-32 bg-gradient-to-br from-primary/20 to-amber-500/10 relative overflow-hidden">
                {data.restaurant.image && (
                  <img src={data.restaurant.image} alt={data.restaurant.name} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                {isActive && isLoggedIn && (
                  <div className="absolute top-3 right-3 bg-primary text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    Active
                  </div>
                )}
                <div className="absolute top-3 left-3">
                  <div className={clsx("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border backdrop-blur-sm bg-white/90", vColor.text, vColor.border)}>
                    <vConf.icon size={11} />
                    {vConf.label}
                  </div>
                </div>
                <div className="absolute bottom-3 left-4 right-4">
                  <h3 className="text-lg font-extrabold text-white drop-shadow-md tracking-tight">{data.restaurant.name}</h3>
                  <p className="text-[11px] text-white/70 font-medium truncate">{data.restaurant.tagline || "No tagline set"}</p>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {/* Row 1: Stats chips */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <Package size={12} className="text-primary" />
                    <span className="font-bold text-dark">{productCount}</span>
                    <span className="text-muted">products</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <Tags size={12} className="text-accent-blue" />
                    <span className="font-bold text-dark">{categoryCount}</span>
                    <span className="text-muted">categories</span>
                  </div>
                  {popularCount > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <Star size={12} className="text-amber-500" />
                      <span className="font-bold text-dark">{popularCount}</span>
                      <span className="text-muted">popular</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <UserCog size={12} className="text-accent-green" />
                    <span className="font-bold text-dark">{venueBreakdown.all.length}</span>
                    <span className="text-muted">users</span>
                  </div>
                </div>

                {/* Row 2: Meta info (created, address, hours, theme) */}
                <div className="flex items-center gap-3 flex-wrap text-[10px] text-muted">
                  <div className="flex items-center gap-1" title={`Created ${formatDate(createdAt)}`}>
                    <Calendar size={10} className="text-muted/60" />
                    <span>Created {formatTimeAgo(createdAt)}</span>
                    <span className="text-muted/40">({formatDate(createdAt)})</span>
                  </div>
                  {data.restaurant.address && (
                    <div className="flex items-center gap-1">
                      <MapPin size={10} className="text-muted/60" />
                      <span className="truncate max-w-[140px]">{data.restaurant.address}</span>
                    </div>
                  )}
                  {data.restaurant.openHours && (
                    <div className="flex items-center gap-1">
                      <Clock size={10} className="text-muted/60" />
                      <span>{data.restaurant.openHours}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Palette size={10} className="text-muted/60" />
                    <span className="capitalize">{activeTheme === "custom" ? "Custom Theme" : activeTheme.replace(/-/g, " ")}</span>
                  </div>
                </div>

                {/* Row 3: Staff breakdown — users with emails */}
                <div className="bg-gray-50/80 rounded-xl p-3 space-y-1.5">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Staff & Access</p>

                  {venueBreakdown.admins.length > 0 && (
                    <div className="space-y-1">
                      {venueBreakdown.admins.map((u) => (
                        <div key={u.id} className="flex items-center gap-2 text-[11px]">
                          <span className="text-sm leading-none">{u.avatar || "👤"}</span>
                          <span className="font-semibold text-dark">{u.name}</span>
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 text-[9px] font-bold">
                            <Crown size={8} />
                            Admin
                          </span>
                          <span className="flex items-center gap-1 text-muted ml-auto">
                            <Mail size={9} />
                            {u.email}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {venueBreakdown.managers.length > 0 && (
                    <div className="space-y-1">
                      {venueBreakdown.managers.map((u) => (
                        <div key={u.id} className="flex items-center gap-2 text-[11px]">
                          <span className="text-sm leading-none">{u.avatar || "👤"}</span>
                          <span className="font-semibold text-dark">{u.name}</span>
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-700 text-[9px] font-bold">
                            <ShieldCheck size={8} />
                            Manager
                          </span>
                          <span className="flex items-center gap-1 text-muted ml-auto">
                            <Mail size={9} />
                            {u.email}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {venueBreakdown.employees.length > 0 && (
                    <div className="space-y-1">
                      {venueBreakdown.employees.map((u) => (
                        <div key={u.id} className="flex items-center gap-2 text-[11px]">
                          <span className="text-sm leading-none">{u.avatar || "👤"}</span>
                          <span className="font-semibold text-dark">{u.name}</span>
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-700 text-[9px] font-bold">
                            <Shield size={8} />
                            Employee
                          </span>
                          <span className="flex items-center gap-1 text-muted ml-auto">
                            <Mail size={9} />
                            {u.email}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {venueBreakdown.all.length === 0 && (
                    <p className="text-[11px] text-muted/60 italic">No users assigned</p>
                  )}
                </div>

                {/* Row 4: Venue slug / ID */}
                <div className="flex items-center gap-2 text-[10px] text-muted/60">
                  <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">/{id}</span>
                  <span>&middot;</span>
                  <span>{data.categories.length} total cat. (incl. All & Popular)</span>
                </div>

                {/* CTA */}
                <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleClickVenue(id)}
                    className={clsx(
                      "flex-1 py-2.5 rounded-xl text-[13px] font-bold transition flex items-center justify-center gap-2",
                      isActive && isLoggedIn
                        ? "bg-primary text-white shadow-glow"
                        : "bg-primary/10 text-primary hover:bg-primary/20"
                    )}
                  >
                    <Store size={14} />
                    Enter Venue
                  </button>
                  {restaurantIds.length > 1 && (
                    <button
                      onClick={() => setDeleteTarget(id)}
                      className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-muted hover:text-accent-red hover:border-red-200 hover:bg-red-50 transition shrink-0"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {restaurantIds.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-2xl border border-gray-100/80 shadow-soft p-16 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Building2 size={28} className="text-primary/40" />
          </div>
          <p className="text-[14px] font-semibold text-dark">No venues yet</p>
          <p className="text-[12px] text-muted mt-1.5">Create your first restaurant, café, or bar to get started</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-5 inline-flex items-center gap-2 bg-gradient-to-r from-primary to-amber-500 text-white px-5 py-2.5 rounded-2xl text-[13px] font-bold shadow-glow hover:brightness-105 transition"
          >
            <Plus size={15} />
            Create Venue
          </button>
        </motion.div>
      )}

      {/* ── Create Modal ── */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 24 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="bg-white rounded-3xl max-w-[520px] w-full shadow-elevated overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary/20 to-amber-500/10 flex items-center justify-center">
                      <Sparkles size={18} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="text-[16px] font-extrabold text-dark tracking-tight">Create New Venue</h3>
                      <p className="text-[11px] text-muted mt-0.5">Choose a type and give it a name</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center text-muted hover:text-dark transition"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-5 max-h-[calc(100vh-220px)] overflow-y-auto">
                {/* Venue type selector — 2x4 grid */}
                <div>
                  <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-2.5">Venue Type</label>
                  <div className="grid grid-cols-4 gap-2">
                    {VENUE_TYPES.map((vt) => {
                      const isSelected = newVenueType === vt.value;
                      const vc = VENUE_COLORS[vt.value];
                      return (
                        <motion.button
                          key={vt.value}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setNewVenueType(vt.value)}
                          className={clsx(
                            "relative flex flex-col items-center gap-1 p-3 rounded-2xl border-2 transition-all duration-200",
                            isSelected
                              ? `${vc.bg} ${vc.border} ${vc.text} shadow-sm`
                              : "border-gray-100 hover:border-gray-200 text-muted hover:text-dark"
                          )}
                        >
                          {isSelected && (
                            <motion.div
                              layoutId="venue-type-indicator"
                              className="absolute inset-0 rounded-2xl border-2 border-current opacity-20"
                              transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            />
                          )}
                          <span className="text-xl leading-none">{vt.emoji}</span>
                          <span className="text-[10px] font-bold leading-tight mt-0.5">{vt.label}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                  {/* Selected type description */}
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={newVenueType}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15 }}
                      className="text-[11px] text-muted mt-2 text-center"
                    >
                      {VENUE_TYPES.find((v) => v.value === newVenueType)?.desc}
                    </motion.p>
                  </AnimatePresence>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-100" />

                {/* Name */}
                <div>
                  <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">Venue Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => {
                      setNewName(e.target.value);
                      setNewSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-|-$/g, "")
                      );
                    }}
                    placeholder={
                      newVenueType === "cafe" ? "e.g., Sunrise Café" :
                      newVenueType === "bar" ? "e.g., The Blue Lounge" :
                      newVenueType === "bakery" ? "e.g., Golden Crust" :
                      newVenueType === "food-truck" ? "e.g., Taco Express" :
                      newVenueType === "pizzeria" ? "e.g., Napoli Pizza" :
                      newVenueType === "pub" ? "e.g., The Crown & Anchor" :
                      newVenueType === "lounge" ? "e.g., Velvet Sky" :
                      "e.g., Pizza Palace"
                    }
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 text-dark text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary focus:bg-white placeholder:text-muted/40 transition"
                  />
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">Venue ID (slug)</label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] text-muted/50 font-mono">/</div>
                    <input
                      type="text"
                      value={newSlug}
                      onChange={(e) => setNewSlug(e.target.value)}
                      placeholder="auto-generated-from-name"
                      className="w-full pl-7 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 text-dark text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary focus:bg-white placeholder:text-muted/30 transition"
                    />
                  </div>
                  <p className="text-[10px] text-muted/60 mt-1.5">Unique identifier — lowercase, no spaces</p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-[13px] font-bold text-dark hover:bg-white transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || !newSlug.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-primary to-amber-500 text-white text-[13px] font-bold hover:brightness-105 transition shadow-glow disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Plus size={14} />
                  Create {VENUE_TYPES.find((v) => v.value === newVenueType)?.label}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete Confirmation ── */}
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
              className="bg-white rounded-3xl p-6 max-w-[380px] w-full shadow-elevated"
            >
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={22} className="text-accent-red" />
              </div>
              <h3 className="text-lg font-extrabold text-dark text-center">Delete Venue?</h3>
              <p className="text-sm text-muted mt-2 text-center leading-relaxed">
                This will permanently delete{" "}
                <span className="font-bold text-dark">{allRestaurants[deleteTarget]?.restaurant.name}</span>
                {" "}and all its data. This cannot be undone.
              </p>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-bold text-dark hover:bg-bg transition">Cancel</button>
                <button onClick={() => handleDelete(deleteTarget)} className="flex-1 py-3 rounded-2xl bg-accent-red text-white text-sm font-bold hover:brightness-110 transition shadow-lg shadow-red-200">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
