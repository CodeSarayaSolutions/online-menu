"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useCmsStore } from "@/store/cmsStore";
import { useAuthStore } from "@/store/authStore";
import { useAdminSession } from "@/hooks/useAdminSession";

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
  return <>{children}</>;
}
