/** Fake sales written by the old šank poll. Never count these as income. */
export const CLONE_ID_PREFIX = 'TAB-';
export const CLONE_NOTE_PREFIX = '__tab:';
export const VIEW_TICKET_PREFIX = 'view-';

export function displayKitchenNote(note: string | null | undefined): string {
  if (!note) return '';
  return note.replace(/__tab:[0-9a-f-]+/gi, '').trim();
}

export function isCloneSale(order: {
  id?: string | null;
  kitchenNote?: string | null;
  kitchen_note?: string | null;
}): boolean {
  const id = order.id ?? '';
  const note = order.kitchenNote ?? order.kitchen_note ?? '';
  return (
    id.startsWith(CLONE_ID_PREFIX) ||
    id.startsWith(VIEW_TICKET_PREFIX) ||
    note.startsWith(CLONE_NOTE_PREFIX)
  );
}

export function isPersistedGuestOrder(order: {
  id?: string | null;
  kitchenNote?: string | null;
  kitchen_note?: string | null;
}): boolean {
  const id = order.id ?? '';
  if (id.startsWith(VIEW_TICKET_PREFIX) || id.startsWith(CLONE_ID_PREFIX)) {
    return false;
  }
  return !isCloneSale(order);
}

export function isViewTicketId(orderId: string): boolean {
  return orderId.startsWith(VIEW_TICKET_PREFIX);
}

export function tabIdFromViewTicket(orderId: string): string | null {
  if (!isViewTicketId(orderId)) return null;
  return orderId.slice(VIEW_TICKET_PREFIX.length);
}
