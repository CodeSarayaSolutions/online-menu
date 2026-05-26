"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Store,
  UtensilsCrossed,
  ChevronRight,
  Coffee,
  Wine,
  UserCog,
  ShieldCheck,
  Shield,
  ArrowLeft,
  CakeSlice,
  Truck,
  Pizza,
  Beer,
  Martini,
} from "lucide-react";
import { motion } from "framer-motion";
import { useCmsStore, VenueType } from "@/store/cmsStore";
import { useAuthStore } from "@/store/authStore";
import AdminLoginForm from "@/components/admin/AdminLoginForm";
import { mapApiUserToAppUser } from "@/lib/auth/map-user";
import { canAccessRestaurant, getDefaultVenuePath } from "@/lib/permissions";
import type { SessionPayload } from "@/services/authService";
import {
  LOGIN_EMAIL_SUBTITLE,
  VENUE_LOGIN_FOOTER,
  venueLoginTitle,
} from "@/lib/admin-branding";
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

export default function VenueRolePicker() {
  const params = useParams();
  const router = useRouter();
  const venueSlug = typeof params.venue === "string" ? params.venue : "";

  const allRestaurants = useCmsStore((s) => s.allRestaurants);
  const switchRestaurant = useCmsStore((s) => s.switchRestaurant);
  const loadVenuePublic = useCmsStore((s) => s.loadVenuePublic);
  const activeRestaurantId = useAuthStore((s) => s.activeRestaurantId);
  const setActiveRestaurant = useAuthStore((s) => s.setActiveRestaurant);
  const setSessionUser = useAuthStore((s) => s.setSessionUser);
  const currentUser = useAuthStore((s) => s.getCurrentUser());

  const venueData = allRestaurants[venueSlug];

  useEffect(() => {
    if (currentUser && canAccessRestaurant(currentUser, venueSlug)) {
      if (activeRestaurantId && activeRestaurantId !== venueSlug) {
        switchRestaurant(activeRestaurantId, venueSlug);
      } else {
        loadVenuePublic(venueSlug);
      }
      setActiveRestaurant(venueSlug);
      router.replace(getDefaultVenuePath(currentUser, venueSlug));
    }
  }, [currentUser, venueSlug, activeRestaurantId, router, switchRestaurant, loadVenuePublic, setActiveRestaurant]);

  const onLoginSuccess = (session: SessionPayload) => {
    const appUser = mapApiUserToAppUser(session.user, session.restaurantAccess ?? []);
    if (!canAccessRestaurant(appUser, venueSlug)) {
      return;
    }
    setSessionUser(appUser);
    if (activeRestaurantId && activeRestaurantId !== venueSlug) {
      switchRestaurant(activeRestaurantId, venueSlug);
    } else {
      loadVenuePublic(venueSlug);
    }
    setActiveRestaurant(venueSlug);
    router.push(getDefaultVenuePath(appUser, venueSlug));
  };

  // If venue doesn't exist, redirect back
  if (!venueData) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted adm-text-muted text-sm">Lokal nije pronađen.</p>
      </div>
    );
  }

  if (currentUser && canAccessRestaurant(currentUser, venueSlug)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const venueType = venueData.venueType || "restaurant";
  const vConf = VENUE_TYPES.find((v) => v.value === venueType) || VENUE_TYPES[0];
  const vColor = VENUE_COLORS[venueType];

  return (
    <div>
      {/* Back button */}
      <motion.button
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => router.push("/admin")}
        className="flex items-center gap-2 text-[13px] font-semibold text-muted adm-text-muted hover:adm-text transition mb-6 group"
      >
        <div className="w-7 h-7 rounded-lg adm-bg group-hover:bg-primary/10 flex items-center justify-center transition">
          <ArrowLeft size={14} className="group-hover:text-primary transition" />
        </div>
        Nazad na lokale
      </motion.button>

      {/* Venue header card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="adm-surface adm-border border rounded-2xl shadow-card overflow-hidden border border adm-border mb-8"
      >
        <div className="h-36 bg-gradient-to-br from-primary/20 to-amber-500/10 relative overflow-hidden">
          {venueData.restaurant.image && (
            <img src={venueData.restaurant.image} alt={venueData.restaurant.name} className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="absolute top-3 left-3">
            <div className={clsx("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border backdrop-blur-sm adm-surface adm-border border/90", vColor.text, vColor.border)}>
              <vConf.icon size={11} />
              {vConf.label}
            </div>
          </div>
          <div className="absolute bottom-4 left-5">
            <h2 className="text-2xl font-extrabold text-white drop-shadow-md tracking-tight">{venueData.restaurant.name}</h2>
            <p className="text-[12px] text-white/70 font-medium mt-0.5">{venueData.restaurant.tagline || "No tagline set"}</p>
          </div>
        </div>
      </motion.div>

      <div className="max-w-[480px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="adm-surface adm-border border rounded-2xl shadow-card p-6 mb-6"
        >
          <AdminLoginForm
            title={venueLoginTitle(venueData.restaurant.name)}
            subtitle={LOGIN_EMAIL_SUBTITLE}
            onSuccess={onLoginSuccess}
          />
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-[11px] text-muted adm-text-muted text-center mt-6 leading-relaxed"
        >
          {VENUE_LOGIN_FOOTER}
        </motion.p>
      </div>
    </div>
  );
}
