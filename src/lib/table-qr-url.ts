import type { Tables } from "@/types/supabase";

type TableRow = Tables<"restaurant_tables">;

/** Table identifier for QR URL `?table=` param — matches order table_number. */
export function tableQrParam(t: TableRow): string {
  // Use label as slug: "Stol 1" → "stol-1", "Terasa A" → "terasa-a"
  return t.label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .trim();
}

export function buildTableMenuUrl(origin: string, venueSlug: string, table: TableRow): string {
  return `${origin}/${encodeURIComponent(venueSlug)}?table=${encodeURIComponent(tableQrParam(table))}`;
}
