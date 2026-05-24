"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Store, MapPin, Clock, UtensilsCrossed, Coffee, Wine, CakeSlice, Truck, Pizza, Beer, Martini, Search, X } from "lucide-react";
import { useCmsStore, VenueType, RestaurantData } from "@/store/cmsStore";
import { loadAllVenuesIntoStore } from "@/lib/venue-cloud/sync";
import clsx from "clsx";

// ─── Venue type config ──────────────────────────────────
const VENUE_ICONS: Record<VenueType, { icon: typeof Store; emoji: string }> = {
  restaurant:   { icon: UtensilsCrossed, emoji: "🍽️" },
  cafe:         { icon: Coffee,          emoji: "☕" },
  bar:          { icon: Wine,            emoji: "🍸" },
  bakery:       { icon: CakeSlice,       emoji: "🧁" },
  "food-truck": { icon: Truck,           emoji: "🚚" },
  pizzeria:     { icon: Pizza,           emoji: "🍕" },
  pub:          { icon: Beer,            emoji: "🍺" },
  lounge:       { icon: Martini,         emoji: "🍹" },
};

const VENUE_COLORS: Record<VenueType, string> = {
  restaurant:   "from-orange-400 to-amber-500",
  cafe:         "from-amber-400 to-yellow-500",
  bar:          "from-purple-400 to-violet-500",
  bakery:       "from-pink-400 to-rose-500",
  "food-truck": "from-orange-500 to-red-500",
  pizzeria:     "from-red-400 to-orange-500",
  pub:          "from-amber-500 to-orange-500",
  lounge:       "from-violet-400 to-purple-500",
};

export default function VenuePickerPage() {
  const allRestaurants = useCmsStore((s) => s.allRestaurants);
  const [hydrated, setHydrated] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadAllVenuesIntoStore();
      } catch (e) {
        console.error("[venue-cloud] home load:", e);
      }
      if (!cancelled) setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const venues = Object.entries(allRestaurants);
  const filtered = venues.filter(([slug, data]) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      data.restaurant.name.toLowerCase().includes(q) ||
      slug.toLowerCase().includes(q) ||
      data.venueType.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        </div>
        <div className="relative px-6 py-12 md:py-16 lg:py-20 text-center max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 mb-6">
              <Store size={14} />
              <span className="text-xs font-bold tracking-wide uppercase">Saraya</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
              Discover Restaurants
            </h1>
            <p className="text-sm md:text-base text-white/70 mt-3 max-w-md mx-auto">
              Browse menus from our collection of restaurants and venues
            </p>
          </motion.div>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 md:px-6 -mt-5 relative z-10 max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="relative bg-white rounded-2xl shadow-lg">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search venues..."
              className="w-full pl-12 pr-10 py-4 bg-transparent rounded-2xl outline-none text-sm text-gray-800 placeholder:text-gray-400"
            />
            <AnimatePresence>
              {search && (
                <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                  <X size={12} className="text-gray-500" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Venue Grid */}
      <div className="px-4 md:px-6 py-8 max-w-5xl mx-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Store size={24} className="text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-500">No venues found</p>
            <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {filtered.map(([slug, data], index) => {
              const venueInfo = VENUE_ICONS[data.venueType] || VENUE_ICONS.restaurant;
              const gradient = VENUE_COLORS[data.venueType] || VENUE_COLORS.restaurant;
              const productCount = data.products?.length || 0;
              const categoryCount = data.categories?.filter((c) => c.id !== "all" && c.id !== "popular").length || 0;

              return (
                <motion.div
                  key={slug}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06, duration: 0.4 }}
                >
                  <Link href={`/${slug}`} className="block group">
                    <div className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 hover:border-gray-200">
                      {/* Cover Image */}
                      <div className="relative h-40 overflow-hidden">
                        {data.restaurant.image ? (
                          <img
                            src={data.restaurant.image}
                            alt={data.restaurant.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className={clsx("w-full h-full bg-gradient-to-br flex items-center justify-center", gradient)}>
                            <span className="text-5xl">{venueInfo.emoji}</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                        {/* Venue type badge */}
                        <div className="absolute top-3 left-3">
                          <div className="flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 shadow-sm">
                            <span className="text-xs">{venueInfo.emoji}</span>
                            <span className="text-[10px] font-bold text-gray-700 capitalize">{(data.venueType || "restaurant").replace("-", " ")}</span>
                          </div>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-4">
                        <h3 className="text-base font-extrabold text-gray-900 group-hover:text-orange-600 transition-colors">
                          {data.restaurant.name}
                        </h3>
                        {data.restaurant.tagline && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{data.restaurant.tagline}</p>
                        )}
                        <div className="flex items-center gap-3 mt-3 text-[10px] text-gray-400">
                          {data.restaurant.openHours && (
                            <span className="flex items-center gap-1">
                              <Clock size={10} className="text-orange-400" />
                              {data.restaurant.openHours}
                            </span>
                          )}
                          {data.restaurant.address && (
                            <span className="flex items-center gap-1">
                              <MapPin size={10} className="text-orange-400" />
                              <span className="truncate max-w-[120px]">{data.restaurant.address}</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                          <span className="text-[10px] font-semibold text-gray-400">{productCount} items</span>
                          <span className="text-gray-200">·</span>
                          <span className="text-[10px] font-semibold text-gray-400">{categoryCount} categories</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="py-8 text-center border-t border-gray-100">
        <p className="text-xs text-gray-400">Saraya — digitalni meni</p>
      </footer>
    </div>
  );
}
