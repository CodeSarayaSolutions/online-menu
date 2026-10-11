"use client";

import { useParams } from "next/navigation";
import BarActiveTabs from "@/components/admin/BarActiveTabs";
import { useCmsStore } from "@/store/cmsStore";

export default function KitchenStationPage() {
  const params = useParams();
  const venueSlug = typeof params.venue === "string" ? params.venue : "";

  const enabled = useCmsStore(s => s.allRestaurants[venueSlug]?.restaurant.kitchenEnabled ?? false);
  if (!enabled) return null;
  return <BarActiveTabs restaurantId={venueSlug} station="kitchen" />;
}
