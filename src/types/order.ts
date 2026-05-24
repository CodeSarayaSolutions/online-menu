import { CartItem } from "./cart";

export type OrderStatus = "pending" | "preparing" | "ready" | "served" | "cancelled";

export interface Order {
  id: string;
  items: CartItem[];
  tableNumber: string;
  kitchenNote: string;
  total: number;
  itemCount: number;
  status: OrderStatus;
  createdAt: string; // ISO timestamp
  paymentMethod: string;
}
