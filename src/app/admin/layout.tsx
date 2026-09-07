"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import {
  Store,
  Tags,
  UtensilsCrossed,
  ArrowLeft,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  FileText,
  Moon,
  Sun,
  ClipboardList,
  Users,
  Building2,
  LogOut,
  Download,
  Shield,
  ShieldCheck,
  ChefHat,
  Wine,
  LayoutGrid,
  Package,
  HandPlatter,
  Settings,
  CalendarClock,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCmsStore } from "@/store/cmsStore";
import { useAdminStore } from "@/store/adminStore";
import { useAuthStore } from "@/store/authStore";
import { RestaurantRole } from "@/types/auth";
import {
  canManageVenueCms,
  canViewBarStation,
  canViewKitchenStation,
  canViewOrdersList,
  canManageTables,
  canManageInventory,
  canManageShifts,
  canViewWaiterMode,
  canManageVenueStaff,
  isPlatformAdmin,
  isStationRoute,
  isStationOnlyRole,
  restaurantRoleLabel,
} from "@/lib/permissions";
import { useAdminSession } from "@/hooks/useAdminSession";
import { useVenueCloudSync } from "@/hooks/useVenueCloudSync";
import { useDbUsers } from "@/hooks/useDbUsers";
import { ADMIN_PANEL_TAGLINE, ADMIN_PANEL_TITLE, BRAND_NAME } from "@/lib/admin-branding";
import { getDefaultPlatformPath, getDefaultVenuePath } from "@/lib/permissions";
import clsx from "clsx";

const AdminPWA = dynamic(() => import("@/components/admin/AdminPWA"), { ssr: false });

// ─── Nav item definitions ──────────────────────────────────
interface NavItem {
  /** For "Venues" this is "/admin", for sub-pages this is the path suffix e.g. "restaurant" */
  path: string;
  label: string;
  icon: typeof Store;
  desc: string;
  minRole?: RestaurantRole | null;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { path: "/admin", label: "Lokali", icon: Building2, desc: "Svi restorani, kafići i barovi" },
  { path: "restaurant", label: "Restoran", icon: Store, desc: "Naziv, slike, info", minRole: "manager" },
  { path: "products", label: "Proizvodi", icon: UtensilsCrossed, desc: "Stavke menija i vrste", minRole: "manager" },
  { path: "page-content", label: "Sadržaj stranice", icon: FileText, desc: "Svi tekstovi na frontendu", minRole: "manager" },
  { path: "settings", label: "Postavke", icon: Settings, desc: "Online narudžbe i opcije", minRole: "manager" },
  { path: "orders", label: "Narudžbe", icon: ClipboardList, desc: "Sve narudžbe i status", minRole: "employee" },
  { path: "shifts", label: "Smjene", icon: CalendarClock, desc: "Raspored osoblja i sažetci", minRole: "manager" },
  { path: "tables", label: "Stolovi", icon: LayoutGrid, desc: "Raspored stolova i kapacitet" },
  { path: "inventory", label: "Inventar", icon: Package, desc: "Zalihe i kretanja" },
  { path: "waiter", label: "Konobar", icon: HandPlatter, desc: "Rad konobara i otvoreni računi" },
  { path: "kitchen", label: "Kuhinja", icon: ChefHat, desc: "Karte jela — bez cijena" },
  { path: "bar", label: "Bar", icon: Wine, desc: "Pića i kompletna narudžba" },
];

const platformNavItems: NavItem[] = [
  { path: "users", label: "Korisnici i uloge", icon: Users, desc: "Upravljanje pristupom", adminOnly: true },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const restaurant = useCmsStore((s) => s.restaurant);
  const allRestaurants = useCmsStore((s) => s.allRestaurants);
  const switchRestaurant = useCmsStore((s) => s.switchRestaurant);
  const darkMode = useAdminStore((s) => s.darkMode);
  const toggleDarkMode = useAdminStore((s) => s.toggleDarkMode);

  const currentUser = useAuthStore((s) => s.getCurrentUser());
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const activeRestaurantId = useAuthStore((s) => s.activeRestaurantId);
  const setActiveRestaurant = useAuthStore((s) => s.setActiveRestaurant);
  const logout = useAuthStore((s) => s.logout);
  const getUserRestaurantRole = useAuthStore((s) => s.getUserRestaurantRole);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showRestaurantPicker, setShowRestaurantPicker] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const { ready: sessionReady, error: sessionError } = useAdminSession();
  const { venuesReady, loading: venuesLoading, error: venuesError } = useVenueCloudSync(
    sessionReady && !!currentUserId && pathname !== "/admin/login"
  );
  useDbUsers(sessionReady && !!currentUserId && pathname !== "/admin/login");
  const isLoginPage = pathname === "/admin/login";

  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    const lockOrientation = async () => {
      try {
        const orient = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
        if (typeof orient.lock === 'function') {
          await orient.lock('portrait');
        }
      } catch {
        // Orientation lock requires fullscreen on some browsers — silent fail
      }
    };
    void lockOrientation();
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    onFullscreenChange();
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    const check = () => setCanInstall(!!window.__pwaInstallPrompt);
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleInstall = async () => {
    const prompt = window.__pwaInstallPrompt;
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      window.__pwaInstallPrompt = undefined;
      setCanInstall(false);
    }
  };

  const isVenueGrid = pathname === "/admin";
  const needsVenueLoad = !!currentUserId && pathname !== "/admin/login";
  /** Venue list page can render while restaurants load in the background */
  const blockOnVenues = needsVenueLoad && !venuesReady && !isVenueGrid;
  const cloudReady = isLoginPage || (sessionReady && (!blockOnVenues || venuesReady));

  // Determine page type from URL segments
  const urlSegments = useMemo(() => pathname.split("/").filter(Boolean), [pathname]);
  // /admin is the platform/local list. /admin/[venue] is only a transient entry route.
  const isOnVenuePage = pathname === "/admin";

  // Extract venue slug from URL: /admin/[venue]/... → second segment
  const venueSlug = useMemo(() => {
    if (urlSegments.length >= 2 && urlSegments[0] === "admin" && urlSegments[1] !== undefined) {
      return pathname === "/admin" ? null : urlSegments[1];
    }
    return null;
  }, [pathname, urlSegments]);

  const effectiveVenueId = activeRestaurantId || venueSlug;

  // Build a full href from a nav item's path suffix and the current venue slug
  const getHref = (item: NavItem) => {
    if (item.path === "/admin") return "/admin";
    return venueSlug ? `/admin/${venueSlug}/${item.path}` : `/admin/${activeRestaurantId || "_"}/${item.path}`;
  };

  // Check if a nav item is active based on the current pathname
  const isItemActive = (item: NavItem) => {
    if (item.path === "/admin") return pathname === "/admin";
    return pathname.includes(`/${item.path}`);
  };

  // ─── Auth gates ───────────────────────────────────────────
  useEffect(() => {
    if (!hydrated || !sessionReady || isLoginPage) return;

    if (!currentUserId) {
      router.replace("/admin/login");
      return;
    }

    if (!cloudReady) return;

    // Venue-only users should not sit on /admin (platform venue grid)
    if (pathname === "/admin" && currentUser && currentUser.platformRole !== "admin") {
      const first = currentUser.restaurantAccess[0]?.restaurantId;
      const target = first
        ? getDefaultVenuePath(currentUser, first)
        : getDefaultPlatformPath(currentUser);
      if (target !== "/admin" && target !== "/admin/login") {
        router.replace(target);
      }
      return;
    }

    if (!isOnVenuePage && (!effectiveVenueId || !currentUserId)) {
      router.replace(currentUser?.platformRole === "admin" ? "/admin" : "/admin/login");
      return;
    }

  }, [
    pathname,
    isOnVenuePage,
    effectiveVenueId,
    activeRestaurantId,
    venueSlug,
    currentUserId,
    currentUser,
    router,
    hydrated,
    cloudReady,
    isLoginPage,
    sessionReady,
  ]);

  const currentRestaurantRole = useMemo(() => {
    if (!currentUser || !effectiveVenueId) return null;
    return getUserRestaurantRole(currentUser.id, effectiveVenueId);
  }, [currentUser, effectiveVenueId, getUserRestaurantRole]);

  const visibleNavItems = useMemo(() => {
    if (!currentUser || !effectiveVenueId) return [];
    return navItems.filter((item) => {
      if (item.path === "/admin") return isPlatformAdmin(currentUser);
      if (item.path === "restaurant" || item.path === "products" || item.path === "page-content" || item.path === "settings") {
        return canManageVenueCms(currentUser, effectiveVenueId);
      }
      if (item.path === "orders") return canViewOrdersList(currentUser, effectiveVenueId);
      if (item.path === "shifts") return canManageShifts(currentUser, effectiveVenueId);
      if (item.path === "tables") return canManageTables(currentUser, effectiveVenueId);
      if (item.path === "inventory") return canManageInventory(currentUser, effectiveVenueId);
      if (item.path === "waiter") return canViewWaiterMode(currentUser, effectiveVenueId);
      if (item.path === "kitchen") return canViewKitchenStation(currentUser, effectiveVenueId);
      if (item.path === "bar") return canViewBarStation(currentUser, effectiveVenueId);
      return false;
    });
  }, [currentUser, effectiveVenueId]);

  const visiblePlatformNav = useMemo(() => {
    if (!currentUser || !effectiveVenueId) return [];
    return platformNavItems.filter((item) => {
      if (item.adminOnly) {
        return isPlatformAdmin(currentUser);
      }
      return true;
    });
  }, [currentUser, effectiveVenueId]);

  const allNavItems = [...navItems, ...platformNavItems];
  const currentPage = allNavItems.find((item) => isItemActive(item));

  const accessibleRestaurants = useMemo(() => {
    if (!currentUser) return [];
    const ids = Object.keys(allRestaurants);
    if (currentUser.platformRole === "admin") return ids;
    return ids.filter((id) =>
      currentUser.restaurantAccess.some((a) => a.restaurantId === id)
    );
  }, [currentUser, allRestaurants]);

  const handleSwitchRestaurant = (toId: string) => {
    if (!activeRestaurantId || toId === activeRestaurantId) return;
    switchRestaurant(activeRestaurantId, toId);
    setActiveRestaurant(toId);
    setShowRestaurantPicker(false);
    // Update URL to reflect the new venue slug
    if (venueSlug) {
      const restOfPath = pathname.replace(`/admin/${venueSlug}`, "");
      router.push(`/admin/${toId}${restOfPath}`);
    }
  };

  const handleLogout = async () => {
    try {
      const { signOut } = await import("@/services/authService");
      await signOut();
    } catch {
      /* ignore */
    }
    logout();
    router.push("/admin/login");
  };

  if (isLoginPage) {
    return (
      <>
        <AdminPWA />
        {children}
      </>
    );
  }

  // ─── Hydration / session guard ──
  if (!hydrated || !sessionReady) {
    return (
      <div className="fixed inset-0 z-[60] adm-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUserId) {
    if (sessionError) {
      return (
        <div className="fixed inset-0 z-[60] adm-bg flex items-center justify-center p-6">
          <div className="max-w-md w-full adm-surface adm-border border rounded-2xl-red-200 p-6 text-center shadow-card">
            <p className="text-sm font-bold text-dark adm-text mb-2">Provjera sesije nije uspjela</p>
            <p className="text-[13px] text-muted adm-text-muted mb-4">{sessionError}</p>
            <button
              type="button"
              onClick={() => router.replace("/admin/login")}
              className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm"
            >
              Idi na prijavu
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="fixed inset-0 z-[60] adm-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (blockOnVenues) {
    return (
      <div className="fixed inset-0 z-[60] adm-bg flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-semibold text-dark adm-text">Učitavanje lokala…</p>
          {venuesError && (
            <p className="text-[12px] text-red-600 mt-2 bg-red-50 px-3 py-2 rounded-lg">{venuesError}</p>
          )}
        </div>
      </div>
    );
  }

  const bootBanner =
    venuesLoading && isVenueGrid ? (
      <div className="bg-amber-50 border-b border-amber-200/80 px-4 py-2 text-[12px] text-amber-900 text-center">
        Učitavanje restorana iz baze…
        {venuesError ? ` — ${venuesError}` : ""}
      </div>
    ) : venuesError && isVenueGrid ? (
      <div className="bg-red-50 border-b border-red-200/80 px-4 py-2 text-[12px] text-red-800 text-center">
        {venuesError} — provjerite da je schema <strong>sarayamenu</strong> izložena u PostgREST.
      </div>
    ) : null;

  // Non–platform-admin on /admin: show redirect UI (never a blank screen)
  if (pathname === "/admin" && currentUser && currentUser.platformRole !== "admin") {
    const first = currentUser.restaurantAccess[0]?.restaurantId;
    const target = first
      ? getDefaultVenuePath(currentUser, first)
      : getDefaultPlatformPath(currentUser);
    if (target === "/admin/login") {
      return (
        <div className="fixed inset-0 z-[60] adm-bg flex items-center justify-center p-6">
          <div className="max-w-md w-full adm-surface adm-border border rounded-2xl-amber-200 p-6 text-center shadow-card">
            <p className="text-sm font-bold text-dark adm-text mb-2">Nema dodijeljenog restorana</p>
            <p className="text-[13px] text-muted adm-text-muted mb-4">
              Vaš račun nema pristup nijednom lokalu. Administrator mora dodijeliti ulogu u Users &amp; Roles.
            </p>
            <button
              type="button"
              onClick={() => router.replace("/admin/login")}
              className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm"
            >
              Nazad na prijavu
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="fixed inset-0 z-[60] adm-bg flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-semibold text-dark adm-text">Preusmjeravanje na vaš restoran…</p>
        </div>
      </div>
    );
  }

  // ─── Venue selector page: full sidebar chrome, consistent with sub-routes ──────────
  if (isOnVenuePage) {
    return (
      <div className={clsx("fixed inset-0 z-[60] flex adm-bg", darkMode && "admin-dark")} style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
        <AdminPWA />
        {/* Mobile overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
          )}
        </AnimatePresence>

        {/* ── Sidebar ── */}
        <aside className={clsx("fixed lg:static inset-y-0 left-0 z-50 w-[272px] adm-sidebar flex flex-col transition-transform duration-300 ease-out lg:translate-x-0 shadow-card border-r border adm-border", sidebarOpen ? "translate-x-0" : "-translate-x-full")}>
          {/* Logo */}
          <div className="h-[72px] flex items-center justify-between px-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center shadow-glow">
                <span className="text-white font-black text-sm">S</span>
              </div>
              <div>
                <span className="font-extrabold text-dark adm-text text-[15px] tracking-tight">{BRAND_NAME}</span>
                <span className="block text-[10px] text-muted adm-text-muted font-medium -mt-0.5">{ADMIN_PANEL_TITLE}</span>
              </div>
            </div>
            <button className="lg:hidden p-1.5 rounded-xl hover:bg-[var(--adm-surface-2)] text-muted adm-text-muted transition" onClick={() => setSidebarOpen(false)}>
              <X size={18} />
            </button>
          </div>

          <div className="px-5 mb-1"><div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" /></div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
            <p className="px-3 text-[10px] font-bold adm-text-faint uppercase tracking-[0.15em] mb-2">Platforma</p>
            {[navItems[0]].map((item) => {
              const isActive = item.path === "/admin";
              return (
                <Link key={item.path} href="/admin" onClick={() => setSidebarOpen(false)} className={clsx("flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition relative", isActive ? "bg-primary/10 text-dark adm-text shadow-sm" : "text-muted adm-text-muted hover:adm-text hover:bg-[var(--adm-surface-2)]")}>
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary to-amber-500 text-white shadow-sm"><item.icon size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold leading-tight">{item.label}</span>
                    <span className="block text-[10px] mt-0.5 text-primary/60">{item.desc}</span>
                  </div>
                  <ChevronRight size={14} className="text-primary/40" />
                </Link>
              );
            })}
            {currentUser && isPlatformAdmin(currentUser) && accessibleRestaurants.length > 0 && (
              <Link
                href={`/admin/${activeRestaurantId || accessibleRestaurants[0]}/users`}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium text-muted adm-text-muted hover:adm-text hover:bg-[var(--adm-surface-2)] transition"
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--adm-surface-2)] text-muted adm-text-muted"><Users size={16} /></div>
                <div className="flex-1 min-w-0">
                  <span className="block text-[13px] font-semibold leading-tight">Korisnici i uloge</span>
                  <span className="block text-[10px] mt-0.5 adm-text-faint">Upravljanje pristupom</span>
                </div>
              </Link>
            )}
          </nav>

          {/* Sidebar footer */}
          <div className="px-4 mt-auto"><div className="h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" /></div>
          <div className="p-3 space-y-1">
            {currentUser && (
              <div className="mx-1 mb-2 p-3 rounded-2xl adm-surface-2 adm-border border">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl adm-surface adm-border border flex items-center justify-center text-base shrink-0">{currentUser.avatar || "👤"}</div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-[11px] font-bold text-dark adm-text truncate">{currentUser.name}</span>
                    <span className="block text-[9px] text-muted adm-text-muted">{currentUser.platformRole === "admin" ? "Platforma admin" : "User"}</span>
                  </div>
                  <button onClick={handleLogout} className="text-muted adm-text-muted hover:text-accent-red transition" title="Odjava"><LogOut size={13} /></button>
                </div>
              </div>
            )}
            {canInstall && (
              <button
                type="button"
                onClick={() => void handleInstall()}
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium text-primary hover:bg-primary/10 transition w-full"
              >
                <Download size={15} /> Instaliraj aplikaciju
              </button>
            )}
            {(activeRestaurantId || accessibleRestaurants[0]) && (
              <Link href={`/${activeRestaurantId || accessibleRestaurants[0]}`} className="flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium text-muted adm-text-muted hover:adm-text hover:bg-[var(--adm-surface-2)] transition"><ArrowLeft size={15} />Povratak na meni</Link>
            )}
          </div>
        </aside>

        {/* ── Main content ── */}
        <div className="flex-1 flex flex-col min-w-0 adm-bg">
          <header className="h-[64px] adm-header backdrop-blur-md border-b border adm-border flex items-center px-4 lg:px-8 gap-4 shrink-0 sticky top-0 z-10 shadow-soft">
            <button className="lg:hidden p-2 -ml-1 hover:bg-[var(--adm-surface-2)] rounded-xl transition" onClick={() => setSidebarOpen(true)}><Menu size={20} className="text-dark adm-text" /></button>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center"><Building2 size={15} className="text-primary" /></div>
              <div className="min-w-0"><h1 className="text-[15px] font-extrabold text-dark adm-text truncate">Lokali</h1></div>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <motion.button whileTap={{ scale: 0.9 }} onClick={toggleDarkMode} className={clsx("w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200", darkMode ? "bg-primary/15 text-primary" : "bg-[var(--adm-surface-2)] text-muted adm-text-muted hover:adm-text hover:bg-[var(--adm-surface-2)]")} title={darkMode ? "Switch to light mode" : "Switch to dark mode"}>
                <AnimatePresence mode="wait">
                  {darkMode ? (
                    <motion.div key="sun" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: 90 }} transition={{ duration: 0.2 }}><Sun size={16} /></motion.div>
                  ) : (
                    <motion.div key="moon" initial={{ scale: 0, rotate: 90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: -90 }} transition={{ duration: 0.2 }}><Moon size={16} /></motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
              {(activeRestaurantId || accessibleRestaurants[0]) && (
                <Link href={`/${activeRestaurantId || accessibleRestaurants[0]}`} target="_blank" className="hidden md:flex items-center gap-1.5 bg-gradient-to-r from-primary to-amber-500 text-white px-3.5 py-1.5 rounded-full text-[11px] font-bold shadow-glow hover:brightness-105 transition">Pogledaj meni</Link>
              )}
            </div>
          </header>
          {bootBanner}
          <main className="flex-1 overflow-y-auto">
            <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }} className="p-5 lg:p-8">
              {children}
            </motion.div>
          </main>
        </div>
      </div>
    );
  }

  // ─── Gate: if not on venue page and missing context, show nothing (redirect happens via useEffect) ──
  const venueReady = effectiveVenueId && (allRestaurants[effectiveVenueId] || !venuesReady);
  if (!venueReady || !currentUserId || !currentUser || !effectiveVenueId) {
    return null;
  }

  const stationFocus =
    isStationRoute(pathname) &&
    (isStationOnlyRole(currentRestaurantRole) || isFullscreen);

  if (stationFocus) {
    return (
      <div
        className={clsx("fixed inset-0 z-[60] flex flex-col adm-bg", darkMode && "admin-dark")}
        style={{ fontFamily: "Inter, system-ui, sans-serif" }}
      >
        <AdminPWA />
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="absolute top-2 right-2 z-20 px-3 py-1.5 rounded-lg text-[11px] font-bold text-muted adm-text-muted hover:adm-text hover:bg-[var(--adm-surface-2)] transition"
          title="Odjava"
        >
          <LogOut size={14} className="inline -mt-0.5 mr-1" />
          Odjava
        </button>
        <main className="flex-1 overflow-y-auto min-h-0">
          <motion.div
            key={pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="p-2 sm:p-3"
          >
            {children}
          </motion.div>
        </main>
      </div>
    );
  }

  // ─── Full admin panel with sidebar ────────────────────────
  return (
    <div className={clsx("fixed inset-0 z-[60] flex adm-bg", darkMode && "admin-dark")} style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <AdminPWA />
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}
      </AnimatePresence>

      {/* ── Sidebar ── */}
      <aside className={clsx("fixed lg:static inset-y-0 left-0 z-50 w-[272px] adm-sidebar flex flex-col transition-transform duration-300 ease-out lg:translate-x-0 shadow-card border-r border adm-border", sidebarOpen ? "translate-x-0" : "-translate-x-full")}>
        {/* Logo */}
        <div className="h-[72px] flex items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center shadow-glow">
              <span className="text-white font-black text-sm">S</span>
            </div>
            <div>
              <span className="font-extrabold text-dark adm-text text-[15px] tracking-tight">{BRAND_NAME}</span>
              <span className="block text-[10px] text-muted adm-text-muted font-medium -mt-0.5">{ADMIN_PANEL_TAGLINE}</span>
            </div>
          </div>
          <button className="lg:hidden p-1.5 rounded-xl hover:bg-[var(--adm-surface-2)] text-muted adm-text-muted transition" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="px-5 mb-1"><div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" /></div>

        {/* Restaurant selector */}
        <div className="px-3 mb-2 relative">
          <button
            onClick={() => setShowRestaurantPicker(!showRestaurantPicker)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[var(--adm-surface-2)] border border-primary/10 hover:border-primary/20 transition text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-amber-500/10 flex items-center justify-center overflow-hidden shrink-0">
              {allRestaurants[effectiveVenueId]?.restaurant.image ? (
                <img src={allRestaurants[effectiveVenueId].restaurant.image} alt="" className="w-full h-full object-cover" />
              ) : (
                <Store size={14} className="text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className="block text-[12px] font-bold text-dark adm-text truncate">{restaurant.name}</span>
                    <span className="block text-[9px] text-muted adm-text-muted">{currentRestaurantRole ? restaurantRoleLabel(currentRestaurantRole) : "—"}</span>
            </div>
            <ChevronDown size={14} className={clsx("text-muted adm-text-muted transition-transform", showRestaurantPicker && "rotate-180")} />
          </button>
          <AnimatePresence>
            {showRestaurantPicker && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-3 right-3 mt-1 adm-surface adm-border border rounded-xl shadow-elevated border border adm-border z-30 overflow-hidden"
              >
                {accessibleRestaurants.map((rId) => {
                  const rData = allRestaurants[rId];
                  if (!rData) return null;
                  const isSelected = rId === effectiveVenueId;
                  return (
                    <button key={rId} onClick={() => handleSwitchRestaurant(rId)} className={clsx("w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-[var(--adm-surface-2)]", isSelected && "bg-primary/5")}>
                      <div className="w-7 h-7 rounded-lg adm-bg overflow-hidden shrink-0">
                        {rData.restaurant.image ? <img src={rData.restaurant.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Store size={12} className="text-muted adm-text-muted" /></div>}
                      </div>
                      <span className={clsx("text-[12px] font-semibold truncate", isSelected ? "text-primary" : "text-dark adm-text")}>{rData.restaurant.name}</span>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-primary ml-auto shrink-0" />}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          <p className="px-3 text-[10px] font-bold adm-text-faint uppercase tracking-[0.15em] mb-2">Restaurant</p>
          {visibleNavItems.filter((item) => item.path !== "/admin").map((item) => {
            const href = getHref(item);
            const isActive = isItemActive(item);
            return (
              <Link key={item.path} href={href} onClick={() => setSidebarOpen(false)} className={clsx("flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all duration-200 group relative", isActive ? "bg-primary/10 text-dark adm-text shadow-sm" : "text-muted adm-text-muted hover:adm-text hover:bg-[var(--adm-surface-2)]")}>
                {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />}
                <div className={clsx("w-9 h-9 rounded-xl flex items-center justify-center transition-all", isActive ? "bg-gradient-to-br from-primary to-amber-500 text-white shadow-sm" : "bg-[var(--adm-surface-2)] text-muted adm-text-muted group-hover:adm-text")}><item.icon size={16} /></div>
                <div className="flex-1 min-w-0">
                  <span className="block text-[13px] font-semibold leading-tight">{item.label}</span>
                  <span className={clsx("block text-[10px] mt-0.5", isActive ? "text-primary/60" : "adm-text-faint")}>{item.desc}</span>
                </div>
                {isActive && <ChevronRight size={14} className="text-primary/40" />}
              </Link>
            );
          })}
          {visiblePlatformNav.length > 0 && (
            <>
              <div className="pt-3"><p className="px-3 text-[10px] font-bold adm-text-faint uppercase tracking-[0.15em] mb-2">Platform</p></div>
              {visiblePlatformNav.map((item) => {
                const href = getHref(item);
                const isActive = isItemActive(item);
                return (
                  <Link key={item.path} href={href} onClick={() => setSidebarOpen(false)} className={clsx("flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all duration-200 group relative", isActive ? "bg-primary/10 text-dark adm-text shadow-sm" : "text-muted adm-text-muted hover:adm-text hover:bg-[var(--adm-surface-2)]")}>
                    {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />}
                    <div className={clsx("w-9 h-9 rounded-xl flex items-center justify-center transition-all", isActive ? "bg-gradient-to-br from-primary to-amber-500 text-white shadow-sm" : "bg-[var(--adm-surface-2)] text-muted adm-text-muted group-hover:adm-text")}><item.icon size={16} /></div>
                    <div className="flex-1 min-w-0">
                      <span className="block text-[13px] font-semibold leading-tight">{item.label}</span>
                      <span className={clsx("block text-[10px] mt-0.5", isActive ? "text-primary/60" : "adm-text-faint")}>{item.desc}</span>
                    </div>
                    {isActive && <ChevronRight size={14} className="text-primary/40" />}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="px-4 mt-auto"><div className="h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" /></div>
        <div className="p-3 space-y-1">
          <div className="mx-1 mb-2 p-3 rounded-2xl adm-surface-2 adm-border border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl adm-surface adm-border border flex items-center justify-center text-base shrink-0">{currentUser.avatar || "👤"}</div>
              <div className="flex-1 min-w-0">
                <span className="block text-[11px] font-bold text-dark adm-text truncate">{currentUser.name}</span>
                    <span className="block text-[9px] text-muted adm-text-muted">{currentRestaurantRole ? restaurantRoleLabel(currentRestaurantRole) : "—"}</span>
              </div>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium text-muted adm-text-muted hover:adm-text hover:bg-[var(--adm-surface-2)] transition w-full"><LogOut size={15} />Odjava</button>
          {canInstall && (
            <button
              type="button"
              onClick={() => void handleInstall()}
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium text-primary hover:bg-primary/10 transition w-full"
            >
              <Download size={15} /> Instaliraj aplikaciju
            </button>
          )}
          <Link href={`/${effectiveVenueId}`} className="flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium text-muted adm-text-muted hover:adm-text hover:bg-[var(--adm-surface-2)] transition"><ArrowLeft size={15} />Povratak na meni</Link>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 adm-bg">
        <header className="h-[64px] adm-header backdrop-blur-md border-b border adm-border flex items-center px-4 lg:px-8 gap-4 shrink-0 sticky top-0 z-10 shadow-soft">
          <button className="lg:hidden p-2 -ml-1 hover:bg-[var(--adm-surface-2)] rounded-xl transition" onClick={() => setSidebarOpen(true)}><Menu size={20} className="text-dark adm-text" /></button>
          <div className="flex items-center gap-3 min-w-0">
            {currentPage && (
              <>
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center"><currentPage.icon size={15} className="text-primary" /></div>
                <div className="min-w-0"><h1 className="text-[15px] font-extrabold text-dark adm-text truncate">{currentPage.label}</h1></div>
              </>
            )}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={toggleDarkMode} className={clsx("w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200", darkMode ? "bg-primary/15 text-primary" : "bg-[var(--adm-surface-2)] text-muted adm-text-muted hover:adm-text hover:bg-[var(--adm-surface-2)]")} title={darkMode ? "Switch to light mode" : "Switch to dark mode"}>
              <AnimatePresence mode="wait">
                {darkMode ? (
                  <motion.div key="sun" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: 90 }} transition={{ duration: 0.2 }}><Sun size={16} /></motion.div>
                ) : (
                  <motion.div key="moon" initial={{ scale: 0, rotate: 90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: -90 }} transition={{ duration: 0.2 }}><Moon size={16} /></motion.div>
                )}
              </AnimatePresence>
            </motion.button>
            <div className="hidden sm:flex items-center gap-1.5 glass rounded-full px-3 py-1.5 shadow-sm border border-primary/10">
              {currentUser.platformRole === "admin" ? <ShieldCheck size={11} className="text-primary" /> : <Shield size={11} className="text-accent-blue" />}
              <span className="text-[11px] font-semibold text-dark adm-text">{currentRestaurantRole ? restaurantRoleLabel(currentRestaurantRole) : "Viewer"}</span>
            </div>
            <Link href={`/${effectiveVenueId}`} target="_blank" className="hidden md:flex items-center gap-1.5 bg-gradient-to-r from-primary to-amber-500 text-white px-3.5 py-1.5 rounded-full text-[11px] font-bold shadow-glow hover:brightness-105 transition">Pogledaj meni</Link>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: "easeOut" }} className={clsx(pathname.includes("/page-content") || pathname.includes("/products") ? "max-w-none" : "p-5 lg:p-8")}>
            {children}
          </motion.div>
        </main>
      </div>

    </div>
  );
}
