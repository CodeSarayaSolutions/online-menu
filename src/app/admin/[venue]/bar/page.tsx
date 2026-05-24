"use client";

import { useParams } from "next/navigation";
import StationOrdersBoard from "@/components/admin/StationOrdersBoard";
import BarActiveTabs from "@/components/admin/BarActiveTabs";

export default function BarStationPage() {
  const params = useParams();
  const venueSlug = typeof params.venue === "string" ? params.venue : "";

  return (
    <div className="p-5 lg:p-8">
      <StationOrdersBoard mode="bar" />
      {venueSlug ? <BarActiveTabs restaurantId={venueSlug} /> : null}
    </div>
  );
}
