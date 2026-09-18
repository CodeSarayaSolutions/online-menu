"use client";

import { useParams } from "next/navigation";
import StationOrdersBoard from "@/components/admin/StationOrdersBoard";
import { useStationBoard } from "@/hooks/useStationBoard";

export default function KitchenStationPage() {
  const params = useParams();
  const venueSlug = typeof params.venue === "string" ? params.venue : "";
  const { orders, updateStatus } = useStationBoard(venueSlug, "kitchen");

  return (
    <StationOrdersBoard mode="kitchen" orders={orders} updateStatus={updateStatus} compact />
  );
}
