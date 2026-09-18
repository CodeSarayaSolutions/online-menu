import type { CartItem } from '@/types/cart';
import type { Order } from '@/types/order';
import type { OpenTabRow, TabItemRow } from '@/services/tabService';
import {
  isFiredTabItem,
  itemsForBar,
  itemsForKitchen,
  resolveItemStation,
} from '@/lib/order-stations';
import { VIEW_TICKET_PREFIX } from '@/lib/orders/clones';

export function itemFiredAt(item: TabItemRow): number {
  const raw = item.fired_at || item.created_at;
  const t = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

function toCartItem(item: TabItemRow): CartItem {
  return {
    id: item.product_id,
    cartKey: item.id,
    name: item.product_name,
    price: Number(item.unit_price),
    quantity: Number(item.quantity),
    image: '',
    station: resolveItemStation(item.station),
  };
}

export function viewTicketsFromTabs(
  tabs: OpenTabRow[],
  mode: 'bar' | 'kitchen',
  ackedAtByTabId: Record<string, string>
): Order[] {
  const tickets: Order[] = [];

  for (const tab of tabs) {
    const fired = (tab.tab_items ?? []).filter(isFiredTabItem).map(toCartItem);
    const items = mode === 'kitchen' ? itemsForKitchen(fired) : itemsForBar(fired);
    const displayItems = items.length > 0 ? items : mode === 'bar' ? fired : [];
    if (displayItems.length === 0) continue;

    const latestFired = Math.max(
      0,
      ...(tab.tab_items ?? [])
        .filter(isFiredTabItem)
        .map(itemFiredAt)
    );
    const ackedAt = ackedAtByTabId[tab.id];
    if (ackedAt && latestFired <= new Date(ackedAt).getTime()) continue;

    const total = displayItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const itemCount = displayItems.reduce((sum, item) => sum + item.quantity, 0);
    const createdAt = new Date(latestFired || Date.now()).toISOString();

    tickets.push({
      id: `${VIEW_TICKET_PREFIX}${tab.id}`,
      items: displayItems,
      tableNumber: tab.table_label || 'Stol',
      kitchenNote: tab.waiter_name ? `Konobar: ${tab.waiter_name}` : '',
      total,
      itemCount,
      status: 'pending',
      createdAt,
      paymentMethod: 'tab',
    });
  }

  return tickets;
}
