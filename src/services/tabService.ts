import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { supabasePostgrestSchema } from '@/lib/supabase-schema';
import type { Database, Tables } from '@/types/supabase';

type DbClient = SupabaseClient<Database, 'sarayamenu'>;
import { performAction } from '@/services/actionService';

const realtimeSchema = supabasePostgrestSchema;
const TAB_ITEMS_BATCH_SIZE = 75;

export type TableTabRow = Tables<'table_tabs'>;
export type TabItemRow = Tables<'tab_items'>;
export type TabItemFireStatus = TabItemRow['fire_status'];

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

export type WaiterBacklogTab = OpenTabRow & {
  tab_items: TabItemRow[];
  item_count: number;
};

async function enrichTabs(tabs: TableTabRow[], client?: DbClient): Promise<OpenTabRow[]> {
  if (tabs.length === 0) return [];

  const db = client ?? supabase;
  const tableIds = Array.from(new Set(tabs.map((t) => t.table_id)));
  const waiterIds = Array.from(new Set(tabs.map((t) => t.waiter_id).filter((id): id is string => !!id)));

  const tables: Pick<Tables<'restaurant_tables'>,'id'|'label'|'capacity'>[]=[];
  const waiters: Pick<Tables<'users'>,'id'|'name'>[]=[];
  for(let i=0;i<tableIds.length;i+=100){const {data,error}=await db.from('restaurant_tables').select('id,label,capacity').in('id',tableIds.slice(i,i+100));if(error)throw error;tables.push(...data??[]);}
  for(let i=0;i<waiterIds.length;i+=100){const {data,error}=await db.from('users').select('id,name').in('id',waiterIds.slice(i,i+100));if(error)throw error;waiters.push(...data??[]);}

  const tableMap = new Map((tables ?? []).map((t) => [t.id, t]));
  const waiterMap = new Map((waiters ?? []).map((w) => [w.id, w]));

  return tabs.map((tab) => {
    const table = tableMap.get(tab.table_id);
    const waiter = tab.waiter_id ? waiterMap.get(tab.waiter_id) : undefined;
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
    for(let offset=0;;offset+=500){
      const {data,error}=await db.from('tab_items').select('*').in('tab_id',chunk).order('created_at').order('id').range(offset,offset+499);
      if(error)throw error;items.push(...data??[]);if(!data||data.length<500)break;
    }
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

export async function getOpenTabs(restaurantId: string): Promise<OpenTabRow[]> {
  const rows:TableTabRow[]=[];
  for(let offset=0;;offset+=200){
    const {data,error}=await supabase.from('table_tabs').select('*').eq('restaurant_id',restaurantId).eq('status','open').order('created_at',{ascending:false}).order('id').range(offset,offset+199);
    if(error)throw error;rows.push(...data??[]);if(!data||data.length<200)break;
  }
  return attachItemsToTabs(await enrichTabs(rows));
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
  return performAction<TableTabRow>('tab.open', restaurantId, { tableId });
}

export async function addItemToTab(
  tabId: string,
  item: { productId: string; productName: string; unitPrice: number; quantity: number; station: 'kitchen' | 'bar' | 'both'; fireStatus?: TabItemFireStatus },
  intervention = false
): Promise<TabItemRow> {
  return performAction<TabItemRow>('tab.add', '', { tabId, productId: item.productId, quantity: item.quantity, fireStatus: item.fireStatus ?? 'fired', intervention });
}

export async function activateTabItems(itemIds: string[], intervention = false): Promise<void> {
  if (!itemIds.length) return;
  // Backlog can span several bills; each transaction checks every supplied line against its bill.
  const { data, error } = await supabase.from('tab_items').select('id,tab_id').in('id', itemIds);
  if (error) throw error;
  if (data.length !== new Set(itemIds).size) throw new Error('Stavke nisu dostupne.');
  const groups = new Map<string, string[]>();
  for (const item of data) groups.set(item.tab_id, [...(groups.get(item.tab_id) ?? []), item.id]);
  for (const [tabId, ids] of Array.from(groups.entries())) await performAction('tab.fire', '', { tabId, itemIds: ids, intervention });
}

export async function getBacklogForWaiter(
  restaurantId: string,
  waiterId: string
): Promise<WaiterBacklogTab[]> {
  const tabs = await getOpenTabs(restaurantId);
  return tabs
    .filter((tab) => tab.waiter_id === waiterId)
    .map((tab) => {
      const backlogItems = (tab.tab_items ?? []).filter((item) => item.fire_status === 'backlog');
      return {
        ...tab,
        tab_items: backlogItems,
        item_count: backlogItems.length,
      };
    })
    .filter((tab) => tab.tab_items.length > 0);
}

export async function removeItemFromTab(tabItemId: string, tabId: string, intervention = false): Promise<void> {
  await performAction('tab.remove', '', { tabId, itemId: tabItemId, intervention });
}

export async function closeTab(tabId: string, paymentMethod: 'cash' | 'card', intervention = false): Promise<TableTabRow> {
  return performAction<TableTabRow>('tab.close', '', { tabId, paymentMethod, intervention });
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

  const [loaded] = await attachItemsToTabs(await enrichTabs([tab],client),client);
  return { ...loaded, tab_items: loaded.tab_items ?? [] };
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
