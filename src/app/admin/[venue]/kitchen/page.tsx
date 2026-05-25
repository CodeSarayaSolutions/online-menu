"use client";

import { useParams } from "next/navigation";
import StationOrdersBoard from "@/components/admin/StationOrdersBoard";
import { useOrders } from "@/hooks/useOrders";

export default function KitchenStationPage() {
  const params = useParams();
  const venueSlug = typeof params.venue === "string" ? params.venue : "";
  const { orders, updateStatus } = useOrders(venueSlug);

  return (
    <StationOrdersBoard mode="kitchen" orders={orders} updateStatus={updateStatus} compact />
  );
}
