"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useCmsStore } from "@/store/cmsStore";
import { useAuthStore } from "@/store/authStore";
import { canAccessRestaurant, canManageVenueCms, canManageVenueStaff, canManageShifts, canManageTables, canManageInventory, canViewOrdersList, canViewWaiterMode, canViewBarStation, canViewKitchenStation } from "@/lib/permissions";
import { useOperationalText } from "@/hooks/useOperationalText";
import { useAdminSession } from "@/hooks/useAdminSession";
import VenueSaveFeedback from "@/components/admin/VenueSaveFeedback";

/**
 * [venue] layout — syncs the URL venue slug to the active restaurant in the store.
 * If the slug doesn't match any known restaurant, redirects back to /admin.
 */
export default function VenueLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const venueSlug = typeof params.venue === "string" ? params.venue : "";
  const [hydrated, setHydrated] = useState(false);

  const allRestaurants = useCmsStore((s) => s.allRestaurants);
  const switchRestaurant = useCmsStore((s) => s.switchRestaurant);
  const loadVenuePublic = useCmsStore((s) => s.loadVenuePublic);
  const activeRestaurantId = useAuthStore((s) => s.activeRestaurantId);
  const setActiveRestaurant = useAuthStore((s) => s.setActiveRestaurant);
  const currentUser = useAuthStore(s => s.getCurrentUser());
  const t = useOperationalText();
  const currentUserId = useAuthStore((s) => s.currentUserId);
  const { ready: sessionReady } = useAdminSession();

  // Check if we're on the venue's role picker page (no sub-route)
  // e.g. /admin/my-venue (exactly 2 segments after splitting)
  const isRolePickerPage = (() => {
    const segments = pathname.split("/").filter(Boolean);
    return segments.length === 2; // ['admin', 'venue-slug']
  })();

  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    if (!hydrated) return;

    const storeIsEmpty = Object.keys(allRestaurants).length === 0;
    const matchedId = Object.keys(allRestaurants).find((id) => id === venueSlug);

    if (!matchedId && !storeIsEmpty) {
      router.replace("/admin");
      return;
    }

    if (!matchedId) {
      return;
    }

    if (isRolePickerPage) return;

    if (!currentUserId && sessionReady) {
      router.replace("/admin");
      return;
    }

    if (!currentUserId) return;

    if (matchedId !== activeRestaurantId) {
      if (activeRestaurantId) {
        switchRestaurant(activeRestaurantId, matchedId);
      } else {
        loadVenuePublic(matchedId);
      }
      setActiveRestaurant(matchedId);
    }
  }, [
    hydrated,
    venueSlug,
    allRestaurants,
    activeRestaurantId,
    currentUserId,
    sessionReady,
    router,
    switchRestaurant,
    loadVenuePublic,
    setActiveRestaurant,
    isRolePickerPage,
  ]);

  if (!hydrated) return null;
  const section = pathname.split("/").filter(Boolean)[2];
  const checks: Record<string, () => boolean> = {
    restaurant: () => canManageVenueCms(currentUser, venueSlug), products: () => canManageVenueCms(currentUser, venueSlug), categories: () => canManageVenueCms(currentUser, venueSlug),
    "page-content": () => canManageVenueCms(currentUser, venueSlug), settings: () => canManageVenueCms(currentUser, venueSlug),
    users: () => canManageVenueStaff(currentUser, venueSlug), shifts: () => canManageShifts(currentUser, venueSlug), tables: () => canManageTables(currentUser, venueSlug),
    inventory: () => canManageInventory(currentUser, venueSlug), orders: () => canViewOrdersList(currentUser, venueSlug), waiter: () => canViewWaiterMode(currentUser, venueSlug),
    bar: () => canViewBarStation(currentUser, venueSlug), kitchen: () => !!allRestaurants[venueSlug]?.restaurant.kitchenEnabled && canViewKitchenStation(currentUser, venueSlug),
  };
  if (currentUser && (!canAccessRestaurant(currentUser, venueSlug) || (section && checks[section] && !checks[section]()))) return <p className="p-6">{t("Nemate pristup ovoj stranici.", "You don't have access to this page.")}</p>;
  return <><VenueSaveFeedback venue={venueSlug} />{children}</>;
}
