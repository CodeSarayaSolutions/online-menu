import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { supabasePostgrestSchema } from '@/lib/supabase-schema';
import type { Database, InsertDto, Tables } from '@/types/supabase';

type DbClient = SupabaseClient<Database, 'sarayamenu'>;
import { deductTabFromInventory } from '@/services/inventoryService';

const realtimeSchema = supabasePostgrestSchema;
const TAB_ITEMS_BATCH_SIZE = 75;

export type TableTabRow = Tables<'table_tabs'>;
export type TabItemRow = Tables<'tab_items'>;

export type OpenTabRow = TableTabRow & {
  table_label: string;
  table_capacity: number;
  waiter_name: string;
  tab_items?: TabItemRow[];
  item_count?: number;
};

export type TabWithItems = TableTabRow & {
  tab_items: TabItemRow[];
  table_label: string;
  waiter_name: string;
};

async function enrichTabs(tabs: TableTabRow[], client?: DbClient): Promise<OpenTabRow[]> {
  if (tabs.length === 0) return [];

  const db = client ?? supabase;
  const tableIds = Array.from(new Set(tabs.map((t) => t.table_id)));
  const waiterIds = Array.from(new Set(tabs.map((t) => t.waiter_id)));

  const [{ data: tables }, { data: waiters }] = await Promise.all([
    db.from('restaurant_tables').select('id, label, capacity').in('id', tableIds),
    db.from('users').select('id, name').in('id', waiterIds),
  ]);

  const tableMap = new Map((tables ?? []).map((t) => [t.id, t]));
  const waiterMap = new Map((waiters ?? []).map((w) => [w.id, w]));

  return tabs.map((tab) => {
    const table = tableMap.get(tab.table_id);
    const waiter = waiterMap.get(tab.waiter_id);
    return {
      ...tab,
      table_label: table?.label ?? 'Stol',
      table_capacity: table?.capacity ?? 4,
      waiter_name: waiter?.name ?? '—',
    };
  });
}

async function attachItemsToTabs<T extends OpenTabRow>(
  tabs: T[],
  client?: DbClient
): Promise<T[]> {
  if (tabs.length === 0) return tabs;

  const db = client ?? supabase;
  const tabIds = tabs.map((t) => t.id);
  const items: TabItemRow[] = [];

  for (let i = 0; i < tabIds.length; i += TAB_ITEMS_BATCH_SIZE) {
    const chunk = tabIds.slice(i, i + TAB_ITEMS_BATCH_SIZE);
    const { data, error } = await db
      .from('tab_items')
      .select('*')
      .in('tab_id', chunk)
      .order('created_at', { ascending: true });

    if (error) throw error;
    items.push(...(data ?? []));
  }

  const byTab = new Map<string, TabItemRow[]>();
  for (const item of items) {
    const list = byTab.get(item.tab_id) ?? [];
    list.push(item);
    byTab.set(item.tab_id, list);
  }

  return tabs.map((tab) => {
    const tabItems = byTab.get(tab.id) ?? [];
    return {
      ...tab,
      tab_items: tabItems,
      item_count: tabItems.length,
    };
  });
}

async function recalcTabTotal(tabId: string): Promise<number> {
  const { data: items, error } = await supabase
    .from('tab_items')
    .select('total_price')
    .eq('tab_id', tabId);

  if (error) throw error;
  const total = (items ?? []).reduce((s, i) => s + Number(i.total_price), 0);
  const { error: upErr } = await supabase.from('table_tabs').update({ total }).eq('id', tabId);
  if (upErr) throw upErr;
  return total;
}

export async function getOpenTabs(restaurantId: string): Promise<OpenTabRow[]> {
  const { data, error } = await supabase
    .from('table_tabs')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'open')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return attachItemsToTabs(await enrichTabs(data ?? []));
}

export async function getClosedTabs(
  restaurantId: string,
  from?: string,
  to?: string,
  client?: DbClient
): Promise<OpenTabRow[]> {
  const db = client ?? supabase;
  let q = db
    .from('table_tabs')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'closed')
    .order('closed_at', { ascending: false });

  if (from) q = q.gte('closed_at', from);
  if (to) q = q.lte('closed_at', to);

  const { data, error } = await q;
  if (error) throw error;
  return attachItemsToTabs(await enrichTabs(data ?? [], client), client);
}

export async function getOpenTabForTable(tableId: string): Promise<TableTabRow | null> {
  const { data, error } = await supabase
    .from('table_tabs')
    .select('*')
    .eq('table_id', tableId)
    .eq('status', 'open')
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function openTab(
  restaurantId: string,
  tableId: string,
  waiterId: string
): Promise<TableTabRow> {
  const existing = await getOpenTabForTable(tableId);
  if (existing) {
    throw new Error('Ovaj stol već ima otvorenu karticu.');
  }

  const row: InsertDto<'table_tabs'> = {
    restaurant_id: restaurantId,
    table_id: tableId,
    waiter_id: waiterId,
    status: 'open',
    total: 0,
  };

  const { data, error } = await supabase.from('table_tabs').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function addItemToTab(
  tabId: string,
  item: {
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    station: 'kitchen' | 'bar' | 'both';
  }
): Promise<TabItemRow> {
  const { data: existing, error: findError } = await supabase
    .from('tab_items')
    .select('*')
    .eq('tab_id', tabId)
    .eq('product_id', item.productId)
    .maybeSingle();

  if (findError) throw findError;

  if (existing) {
    const quantity = Number(existing.quantity) + item.quantity;
    const unitPrice = Number(existing.unit_price);
    const totalPrice = unitPrice * quantity;
    const { data, error } = await supabase
      .from('tab_items')
      .update({
        quantity,
        total_price: totalPrice,
        product_name: item.productName,
        station: item.station,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    await recalcTabTotal(tabId);
    return data;
  }

  const totalPrice = item.unitPrice * item.quantity;
  const row: InsertDto<'tab_items'> = {
    tab_id: tabId,
    product_id: item.productId,
    product_name: item.productName,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    total_price: totalPrice,
    station: item.station,
  };

  const { data, error } = await supabase.from('tab_items').insert(row).select().single();
  if (error) throw error;
  await recalcTabTotal(tabId);
  return data;
}

export async function removeItemFromTab(tabItemId: string, tabId: string): Promise<void> {
  const { error } = await supabase.from('tab_items').delete().eq('id', tabItemId);
  if (error) throw error;
  await recalcTabTotal(tabId);
}

export async function discardEmptyTab(
  tabId: string,
  waiterId?: string,
  client?: DbClient
): Promise<void> {
  const db = client ?? supabase;
  const tab = await getTabWithItems(tabId, client);
  if (!tab || tab.status !== 'open') {
    throw new Error('Kartica nije otvorena.');
  }
  if (waiterId && tab.waiter_id !== waiterId) {
    throw new Error('Nemate dozvolu zatvoriti ovu karticu.');
  }
  if ((tab.tab_items ?? []).length > 0) {
    throw new Error('Kartica ima stavke i ne može se odbaciti kao prazna.');
  }

  const { error } = await db.from('table_tabs').delete().eq('id', tabId);
  if (error) throw error;
}

export async function discardStaleEmptyOpenTabs(
  restaurantId: string,
  options: { waiterId?: string; olderThanMs?: number } = {},
  client?: DbClient
): Promise<number> {
  const db = client ?? supabase;
  const olderThanMs = options.olderThanMs ?? 2 * 60 * 1000;
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();

  let query = db
    .from('table_tabs')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'open')
    .lt('created_at', cutoff);

  if (options.waiterId) {
    query = query.eq('waiter_id', options.waiterId);
  }

  const { data: tabs, error } = await query;
  if (error) throw error;
  if (!tabs?.length) return 0;

  const enriched = await attachItemsToTabs(await enrichTabs(tabs, client), client);
  const emptyIds = enriched
    .filter((tab) => (tab.tab_items ?? []).length === 0)
    .map((tab) => tab.id);

  if (emptyIds.length === 0) return 0;

  for (let i = 0; i < emptyIds.length; i += TAB_ITEMS_BATCH_SIZE) {
    const chunk = emptyIds.slice(i, i + TAB_ITEMS_BATCH_SIZE);
    const { error: deleteError } = await db.from('table_tabs').delete().in('id', chunk);
    if (deleteError) throw deleteError;
  }
  return emptyIds.length;
}

export async function closeTab(
  tabId: string,
  paymentMethod: 'cash' | 'card',
  client?: DbClient
): Promise<TableTabRow> {
  const db = client ?? supabase;
  const tab = await getTabWithItems(tabId, client);
  if (!tab || tab.status !== 'open') {
    throw new Error('Kartica nije otvorena.');
  }

  const { data, error } = await db
    .from('table_tabs')
    .update({
      status: 'closed',
      payment_method: paymentMethod,
      closed_at: new Date().toISOString(),
    })
    .eq('id', tabId)
    .select()
    .single();

  if (error) throw error;

  await deductTabFromInventory(
    { id: tab.id, restaurant_id: tab.restaurant_id, waiter_id: tab.waiter_id },
    (tab.tab_items ?? []).map((i) => ({
      product_id: i.product_id,
      product_name: i.product_name,
      quantity: i.quantity,
    })),
    client
  );

  return data;
}

export async function getTabWithItems(tabId: string, client?: DbClient): Promise<TabWithItems | null> {
  const db = client ?? supabase;
  const { data: tab, error } = await db
    .from('table_tabs')
    .select('*')
    .eq('id', tabId)
    .maybeSingle();

  if (error) throw error;
  if (!tab) return null;

  const [{ data: items, error: itemsError }, enriched] = await Promise.all([
    db.from('tab_items').select('*').eq('tab_id', tabId).order('created_at'),
    enrichTabs([tab], client),
  ]);

  if (itemsError) throw itemsError;

  const meta = enriched[0];
  return {
    ...tab,
    tab_items: items ?? [],
    table_label: meta?.table_label ?? 'Stol',
    waiter_name: meta?.waiter_name ?? '—',
  };
}

export function subscribeToTabs(
  restaurantId: string,
  handlers: {
    onTabChange?: () => void;
    onItemChange?: () => void;
  }
) {
  const channel = supabase
    .channel(`tabs-${restaurantId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: realtimeSchema,
        table: 'table_tabs',
        filter: `restaurant_id=eq.${restaurantId}`,
      },
      () => handlers.onTabChange?.()
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: realtimeSchema,
        table: 'tab_items',
      },
      () => handlers.onItemChange?.()
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
