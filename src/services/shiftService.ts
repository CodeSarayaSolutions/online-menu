import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Database, InsertDto, Tables } from '@/types/supabase';
import type { RestaurantRole } from '@/types/auth';
import type {
  DateRoster,
  DayHours,
  DayOfWeek,
  DayShiftSegment,
  EligibleShiftStaff,
  RosterHistoryEntry,
  SaveDateRosterInput,
  SaveDayScheduleInput,
  SegmentAssignment,
  ShiftSummary,
  ShiftSummaryClosedTab,
  ShiftSummaryItemLine,
  ShiftSummaryQrOrder,
  WeeklyShiftSchedule,
} from '@/types/shift';
import { DAY_LABELS } from '@/types/shift';
import { USER_PUBLIC_COLUMNS } from '@/lib/auth/constants';

type DbClient = SupabaseClient<Database, 'sarayamenu'>;

const ASSIGNABLE_ROLES = new Set<RestaurantRole>(['manager', 'kitchen', 'bar', 'employee']);

const DEFAULT_OPENS = '07:00:00';
const DEFAULT_CLOSES = '23:00:00';

export type { EligibleShiftStaff };

function normalizeTime(value: string): string {
  if (!value) return '00:00:00';
  const parts = value.split(':');
  const h = parts[0]?.padStart(2, '0') ?? '00';
  const m = parts[1]?.padStart(2, '0') ?? '00';
  return `${h}:${m}:00`;
}

function timeToInput(value: string): string {
  return normalizeTime(value).slice(0, 5);
}

function parseTimeToMinutes(value: string): number {
  const [h, m] = normalizeTime(value).split(':').map(Number);
  return h * 60 + m;
}

function combineDateAndTime(dateStr: string, timeStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = normalizeTime(timeStr).split(':').map(Number);
  const local = new Date(y, mo - 1, d, h, mi, 0, 0);
  return local.toISOString();
}

function dateToDayOfWeek(dateStr: string): DayOfWeek {
  const d = new Date(`${dateStr}T12:00:00`);
  const jsDay = d.getDay();
  return (jsDay === 0 ? 7 : jsDay) as DayOfWeek;
}

export async function getEligibleShiftStaff(
  restaurantId: string,
  client?: DbClient
): Promise<EligibleShiftStaff[]> {
  const db = client ?? supabase;
  const { data, error } = await db
    .from('restaurant_access')
    .select(`user_id, role, user:users(${USER_PUBLIC_COLUMNS})`)
    .eq('restaurant_id', restaurantId)
    .neq('role', 'owner');

  if (error) throw error;

  return (data ?? [])
    .filter((row) => ASSIGNABLE_ROLES.has(row.role as RestaurantRole))
    .map((row) => {
      const user = row.user as { id: string; name: string; email: string } | null;
      return {
        userId: row.user_id,
        name: user?.name ?? '—',
        email: user?.email ?? '',
        role: row.role as RestaurantRole,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function loadSegmentAssignments(
  segmentIds: string[],
  client: DbClient
): Promise<Map<string, SegmentAssignment[]>> {
  const map = new Map<string, SegmentAssignment[]>();
  if (segmentIds.length === 0) return map;

  const { data: rows, error } = await client
    .from('day_shift_segment_assignments')
    .select('*')
    .in('segment_id', segmentIds);
  if (error) throw error;

  const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
  const usersById = new Map<string, { name: string; email: string }>();
  if (userIds.length > 0) {
    const { data: users, error: uErr } = await client
      .from('users')
      .select(USER_PUBLIC_COLUMNS)
      .in('id', userIds);
    if (uErr) throw uErr;
    for (const u of users ?? []) {
      usersById.set(u.id, { name: u.name, email: u.email });
    }
  }

  for (const row of rows ?? []) {
    const user = usersById.get(row.user_id);
    const item: SegmentAssignment = {
      id: row.id,
      userId: row.user_id,
      userName: user?.name ?? '—',
      userEmail: user?.email ?? '',
      restaurantRole: row.restaurant_role,
    };
    const list = map.get(row.segment_id) ?? [];
    list.push(item);
    map.set(row.segment_id, list);
  }

  return map;
}

function defaultDayHours(dayOfWeek: DayOfWeek): DayHours {
  return {
    dayOfWeek,
    opensAt: timeToInput(DEFAULT_OPENS),
    closesAt: timeToInput(DEFAULT_CLOSES),
    isClosed: false,
  };
}

export async function getWeeklySchedule(
  restaurantId: string,
  client?: DbClient
): Promise<WeeklyShiftSchedule> {
  const db = client ?? supabase;

  const [{ data: hourRows, error: hErr }, { data: segmentRows, error: sErr }] =
    await Promise.all([
      db.from('restaurant_day_hours').select('*').eq('restaurant_id', restaurantId),
      db
        .from('day_shift_segments')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('day_of_week')
        .order('sort_order'),
    ]);

  if (hErr) throw hErr;
  if (sErr) throw sErr;

  const hoursByDay = new Map<number, Tables<'restaurant_day_hours'>>();
  for (const row of hourRows ?? []) {
    hoursByDay.set(row.day_of_week, row);
  }

  const segments = segmentRows ?? [];
  const assignmentMap = await loadSegmentAssignments(
    segments.map((s) => s.id),
    db
  );

  const segmentsByDay = new Map<number, DayShiftSegment[]>();
  for (const seg of segments) {
    const list = segmentsByDay.get(seg.day_of_week) ?? [];
    list.push({
      id: seg.id,
      dayOfWeek: seg.day_of_week as DayOfWeek,
      label: seg.label,
      startsAt: timeToInput(seg.starts_at),
      endsAt: timeToInput(seg.ends_at),
      sortOrder: seg.sort_order,
      assignments: assignmentMap.get(seg.id) ?? [],
    });
    segmentsByDay.set(seg.day_of_week, list);
  }

  const days = ([1, 2, 3, 4, 5, 6, 7] as DayOfWeek[]).map((dayOfWeek) => {
    const stored = hoursByDay.get(dayOfWeek);
    return {
      hours: stored
        ? {
            dayOfWeek,
            opensAt: timeToInput(stored.opens_at),
            closesAt: timeToInput(stored.closes_at),
            isClosed: stored.is_closed,
          }
        : defaultDayHours(dayOfWeek),
      segments: segmentsByDay.get(dayOfWeek) ?? [],
    };
  });

  return { restaurantId, days };
}

function validateDaySchedule(input: SaveDayScheduleInput): void {
  if (input.isClosed) return;

  const openMin = parseTimeToMinutes(input.opensAt);
  const closeMin = parseTimeToMinutes(input.closesAt);
  if (closeMin <= openMin) {
    throw new Error('Radno vrijeme: kraj mora biti poslije početka.');
  }

  for (const seg of input.segments) {
    const start = parseTimeToMinutes(seg.startsAt);
    const end = parseTimeToMinutes(seg.endsAt);
    if (end <= start) {
      throw new Error('Svaka smjena mora imati kraj poslije početka.');
    }
    if (start < openMin || end > closeMin) {
      throw new Error('Smjene moraju biti unutar radnog vremena tog dana.');
    }
  }

  const sorted = [...input.segments].sort(
    (a, b) => parseTimeToMinutes(a.startsAt) - parseTimeToMinutes(b.startsAt)
  );
  for (let i = 1; i < sorted.length; i++) {
    if (parseTimeToMinutes(sorted[i].startsAt) < parseTimeToMinutes(sorted[i - 1].endsAt)) {
      throw new Error('Smjene se ne smiju preklapati.');
    }
  }
}

export async function saveDaySchedule(
  restaurantId: string,
  input: SaveDayScheduleInput,
  client?: DbClient
): Promise<WeeklyShiftSchedule> {
  const db = client ?? supabase;
  validateDaySchedule(input);

  const { error: hoursErr } = await db.from('restaurant_day_hours').upsert(
    {
      restaurant_id: restaurantId,
      day_of_week: input.dayOfWeek,
      opens_at: normalizeTime(input.opensAt),
      closes_at: normalizeTime(input.closesAt),
      is_closed: input.isClosed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'restaurant_id,day_of_week' }
  );
  if (hoursErr) throw hoursErr;

  const { data: existingSegments, error: exErr } = await db
    .from('day_shift_segments')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('day_of_week', input.dayOfWeek);
  if (exErr) throw exErr;

  const keepIds = new Set(input.segments.map((s) => s.id).filter(Boolean) as string[]);
  for (const row of existingSegments ?? []) {
    if (!keepIds.has(row.id)) {
      const { error } = await db.from('day_shift_segments').delete().eq('id', row.id);
      if (error) throw error;
    }
  }

  if (input.isClosed) {
    for (const row of existingSegments ?? []) {
      const { error } = await db.from('day_shift_segments').delete().eq('id', row.id);
      if (error) throw error;
    }
    return getWeeklySchedule(restaurantId, db);
  }

  for (let i = 0; i < input.segments.length; i++) {
    const seg = input.segments[i];
    const payload = {
      restaurant_id: restaurantId,
      day_of_week: input.dayOfWeek,
      label: seg.label?.trim() || `Smjena ${i + 1}`,
      starts_at: normalizeTime(seg.startsAt),
      ends_at: normalizeTime(seg.endsAt),
      sort_order: i,
    };

    let segmentId = seg.id;
    if (segmentId) {
      const { error } = await db.from('day_shift_segments').update(payload).eq('id', segmentId);
      if (error) throw error;
    } else {
      const { data, error } = await db.from('day_shift_segments').insert(payload).select('id').single();
      if (error) throw error;
      segmentId = data.id;
    }
  }

  return getWeeklySchedule(restaurantId, db);
}

async function loadDateAssignmentsForSegments(
  restaurantId: string,
  rosterDate: string,
  segmentIds: string[],
  client: DbClient
): Promise<Map<string, SegmentAssignment[]>> {
  const map = new Map<string, SegmentAssignment[]>();
  if (segmentIds.length === 0) return map;

  const { data: rows, error } = await client
    .from('shift_date_assignments')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('roster_date', rosterDate)
    .in('segment_id', segmentIds);
  if (error) throw error;

  const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
  const usersById = new Map<string, { name: string; email: string }>();
  if (userIds.length > 0) {
    const { data: users, error: uErr } = await client
      .from('users')
      .select(USER_PUBLIC_COLUMNS)
      .in('id', userIds);
    if (uErr) throw uErr;
    for (const u of users ?? []) {
      usersById.set(u.id, { name: u.name, email: u.email });
    }
  }

  for (const row of rows ?? []) {
    const user = usersById.get(row.user_id);
    const item: SegmentAssignment = {
      id: row.id,
      userId: row.user_id,
      userName: user?.name ?? '—',
      userEmail: user?.email ?? '',
      restaurantRole: row.restaurant_role,
    };
    const list = map.get(row.segment_id) ?? [];
    list.push(item);
    map.set(row.segment_id, list);
  }

  return map;
}

function assignmentsToIds(assignments: SegmentAssignment[]): string[] {
  return assignments.map((a) => a.userId);
}

export async function getDateRoster(
  restaurantId: string,
  date: string,
  client?: DbClient
): Promise<DateRoster> {
  const db = client ?? supabase;
  const schedule = await getWeeklySchedule(restaurantId, db);
  const dayOfWeek = dateToDayOfWeek(date);
  const day = schedule.days.find((d) => d.hours.dayOfWeek === dayOfWeek);
  const hours = day?.hours ?? defaultDayHours(dayOfWeek);
  const segments = day?.segments ?? [];

  const [{ data: savedMeta }, dateAssignmentMap, templateAssignmentMap] = await Promise.all([
    db
      .from('shift_daily_roster')
      .select('roster_date')
      .eq('restaurant_id', restaurantId)
      .eq('roster_date', date)
      .maybeSingle(),
    loadDateAssignmentsForSegments(
      restaurantId,
      date,
      segments.map((s) => s.id),
      db
    ),
    loadSegmentAssignments(
      segments.map((s) => s.id),
      db
    ),
  ]);

  const hasSavedRoster = !!savedMeta;

  return {
    date,
    dayOfWeek,
    dayLabel: DAY_LABELS[dayOfWeek],
    isClosed: hours.isClosed,
    hasSavedRoster,
    segments: segments.map((seg) => {
      const resolved = hasSavedRoster
        ? dateAssignmentMap.get(seg.id) ?? []
        : templateAssignmentMap.get(seg.id) ?? [];

      return {
        segmentId: seg.id,
        label: seg.label,
        startsAt: seg.startsAt,
        endsAt: seg.endsAt,
        assigneeIds: assignmentsToIds(resolved),
        assignments: resolved,
        hasSavedRoster,
      };
    }),
  };
}

async function replaceDateSegmentAssignments(
  restaurantId: string,
  rosterDate: string,
  segmentId: string,
  assigneeIds: string[],
  client: DbClient
): Promise<void> {
  const eligible = await getEligibleShiftStaff(restaurantId, client);
  const eligibleMap = new Map(eligible.map((e) => [e.userId, e.role]));
  const uniqueIds = Array.from(new Set(assigneeIds));

  for (const userId of uniqueIds) {
    if (!eligibleMap.has(userId)) {
      throw new Error('Jedan ili više odabranih korisnika nije dostupan za smjenu.');
    }
  }

  const { error: delErr } = await client
    .from('shift_date_assignments')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('roster_date', rosterDate)
    .eq('segment_id', segmentId);
  if (delErr) throw delErr;

  if (uniqueIds.length === 0) return;

  const rows: InsertDto<'shift_date_assignments'>[] = uniqueIds.map((userId) => ({
    restaurant_id: restaurantId,
    roster_date: rosterDate,
    segment_id: segmentId,
    user_id: userId,
    restaurant_role: eligibleMap.get(userId)! as InsertDto<'shift_date_assignments'>['restaurant_role'],
  }));

  const { error: insErr } = await client.from('shift_date_assignments').insert(rows);
  if (insErr) throw insErr;
}

export async function saveDateRoster(
  restaurantId: string,
  input: SaveDateRosterInput,
  client?: DbClient
): Promise<DateRoster> {
  const db = client ?? supabase;

  for (const seg of input.segments) {
    await replaceDateSegmentAssignments(
      restaurantId,
      input.date,
      seg.segmentId,
      seg.assigneeIds,
      db
    );
  }

  const { error: metaErr } = await db.from('shift_daily_roster').upsert(
    {
      restaurant_id: restaurantId,
      roster_date: input.date,
      saved_at: new Date().toISOString(),
    },
    { onConflict: 'restaurant_id,roster_date' }
  );
  if (metaErr) throw metaErr;

  return getDateRoster(restaurantId, input.date, db);
}

export async function getRosterHistory(
  restaurantId: string,
  from: string,
  to: string,
  client?: DbClient
): Promise<RosterHistoryEntry[]> {
  const db = client ?? supabase;
  const schedule = await getWeeklySchedule(restaurantId, db);

  const { data: savedDays, error } = await db
    .from('shift_daily_roster')
    .select('roster_date')
    .eq('restaurant_id', restaurantId)
    .gte('roster_date', from)
    .lte('roster_date', to)
    .order('roster_date', { ascending: false });
  if (error) throw error;

  const entries: RosterHistoryEntry[] = [];

  for (const row of savedDays ?? []) {
    const date = row.roster_date;
    const dayOfWeek = dateToDayOfWeek(date);
    const day = schedule.days.find((d) => d.hours.dayOfWeek === dayOfWeek);
    const segments = day?.segments ?? [];

    const dateAssignmentMap = await loadDateAssignmentsForSegments(
      restaurantId,
      date,
      segments.map((s) => s.id),
      db
    );

    entries.push({
      date,
      dayLabel: DAY_LABELS[dayOfWeek],
      segments: segments.map((seg) => ({
        segmentId: seg.id,
        label: seg.label,
        startsAt: seg.startsAt,
        endsAt: seg.endsAt,
        staffNames: (dateAssignmentMap.get(seg.id) ?? []).map((a) => a.userName),
      })),
    });
  }

  return entries;
}

export async function getSegmentById(
  segmentId: string,
  client?: DbClient
): Promise<DayShiftSegment | null> {
  const db = client ?? supabase;
  const { data, error } = await db
    .from('day_shift_segments')
    .select('*')
    .eq('id', segmentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const assignmentMap = await loadSegmentAssignments([data.id], db);
  return {
    id: data.id,
    dayOfWeek: data.day_of_week as DayOfWeek,
    label: data.label,
    startsAt: timeToInput(data.starts_at),
    endsAt: timeToInput(data.ends_at),
    sortOrder: data.sort_order,
    assignments: assignmentMap.get(data.id) ?? [],
  };
}

export async function buildSegmentSummary(
  restaurantId: string,
  date: string,
  segmentId: string,
  client?: DbClient
): Promise<ShiftSummary | null> {
  const db = client ?? supabase;
  const segment = await getSegmentById(segmentId, db);
  if (!segment || segment.dayOfWeek !== dateToDayOfWeek(date)) {
    throw new Error('Odabrani datum ne odgovara danu ove smjene.');
  }

  const dateAssignmentMap = await loadDateAssignmentsForSegments(
    restaurantId,
    date,
    [segmentId],
    db
  );
  const { data: savedMeta } = await db
    .from('shift_daily_roster')
    .select('roster_date')
    .eq('restaurant_id', restaurantId)
    .eq('roster_date', date)
    .maybeSingle();

  const rosterAssignments = savedMeta
    ? dateAssignmentMap.get(segmentId) ?? []
    : segment.assignments;

  const segmentForSummary: DayShiftSegment = {
    ...segment,
    assignments: rosterAssignments,
  };

  const from = combineDateAndTime(date, segment.startsAt);
  const to = combineDateAndTime(date, segment.endsAt);
  const dayLabel = DAY_LABELS[segment.dayOfWeek];

  const [{ data: tabs, error: tabsErr }, { data: orders, error: ordersErr }] = await Promise.all([
    db
      .from('table_tabs')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'closed')
      .gte('closed_at', from)
      .lte('closed_at', to)
      .order('closed_at', { ascending: true }),
    db
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', from)
      .lte('created_at', to)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: true }),
  ]);

  if (tabsErr) throw tabsErr;
  if (ordersErr) throw ordersErr;

  const closedTabRows = tabs ?? [];
  const tabIds = closedTabRows.map((t) => t.id);

  const tabItems: Tables<'tab_items'>[] = [];
  if (tabIds.length > 0) {
    const { data: items, error: itemsErr } = await db
      .from('tab_items')
      .select('*')
      .in('tab_id', tabIds)
      .order('created_at', { ascending: true });
    if (itemsErr) throw itemsErr;
    tabItems.push(...(items ?? []));
  }

  const itemsByTab = new Map<string, Tables<'tab_items'>[]>();
  for (const item of tabItems) {
    const list = itemsByTab.get(item.tab_id) ?? [];
    list.push(item);
    itemsByTab.set(item.tab_id, list);
  }

  const tableIds = Array.from(new Set(closedTabRows.map((t) => t.table_id)));
  const waiterIds = Array.from(new Set(closedTabRows.map((t) => t.waiter_id)));

  const [{ data: tables }, { data: waiters }] = await Promise.all([
    tableIds.length
      ? db.from('restaurant_tables').select('id, label').in('id', tableIds)
      : Promise.resolve({ data: [] as { id: string; label: string }[] }),
    waiterIds.length
      ? db.from('users').select('id, name').in('id', waiterIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const tableMap = new Map((tables ?? []).map((t) => [t.id, t.label]));
  const waiterMap = new Map((waiters ?? []).map((w) => [w.id, w.name]));

  const closedTabs: ShiftSummaryClosedTab[] = closedTabRows.map((tab) => ({
    id: tab.id,
    tableLabel: tableMap.get(tab.table_id) ?? 'Stol',
    waiterId: tab.waiter_id,
    waiterName: waiterMap.get(tab.waiter_id) ?? '—',
    total: Number(tab.total),
    paymentMethod: tab.payment_method,
    openedAt: tab.created_at,
    closedAt: tab.closed_at,
    items: (itemsByTab.get(tab.id) ?? []).map(
      (item): ShiftSummaryItemLine => ({
        name: item.product_name,
        quantity: Number(item.quantity),
        lineTotal: Number(item.total_price),
      })
    ),
  }));

  const qrOrders: ShiftSummaryQrOrder[] = (orders ?? []).map((order) => {
    const rawItems = Array.isArray(order.items) ? order.items : [];
    const items: ShiftSummaryItemLine[] = rawItems.map((item) => {
      const row = item as { name?: string; quantity?: number; price?: number };
      const qty = Number(row.quantity ?? 1);
      const price = Number(row.price ?? 0);
      return {
        name: row.name ?? 'Stavka',
        quantity: qty,
        lineTotal: price * qty,
      };
    });
    return {
      id: order.id,
      tableNumber: order.table_number,
      total: Number(order.total),
      status: order.status,
      paymentMethod: order.payment_method,
      createdAt: order.created_at,
      itemCount: order.item_count,
      items,
    };
  });

  let cashTotal = 0;
  let cardTotal = 0;
  let itemsSold = 0;
  let tabRevenue = 0;
  let qrRevenue = 0;

  const productCounts = new Map<string, { quantity: number; revenue: number }>();
  const waiterStats = new Map<
    string,
    {
      waiterName: string;
      closedTabs: number;
      revenue: number;
      itemsSold: number;
      tables: Set<string>;
      cashTotal: number;
      cardTotal: number;
    }
  >();
  const tableStats = new Map<
    string,
    { closedTabs: number; revenue: number; waiters: Set<string> }
  >();

  for (const tab of closedTabs) {
    tabRevenue += tab.total;
    itemsSold += tab.items.reduce((s, i) => s + i.quantity, 0);
    if (tab.paymentMethod === 'card') cardTotal += tab.total;
    else cashTotal += tab.total;

    for (const item of tab.items) {
      const prev = productCounts.get(item.name) ?? { quantity: 0, revenue: 0 };
      productCounts.set(item.name, {
        quantity: prev.quantity + item.quantity,
        revenue: prev.revenue + item.lineTotal,
      });
    }

    const w = waiterStats.get(tab.waiterId) ?? {
      waiterName: tab.waiterName,
      closedTabs: 0,
      revenue: 0,
      itemsSold: 0,
      tables: new Set<string>(),
      cashTotal: 0,
      cardTotal: 0,
    };
    w.closedTabs += 1;
    w.revenue += tab.total;
    w.itemsSold += tab.items.reduce((s, i) => s + i.quantity, 0);
    w.tables.add(tab.tableLabel);
    if (tab.paymentMethod === 'card') w.cardTotal += tab.total;
    else w.cashTotal += tab.total;
    waiterStats.set(tab.waiterId, w);

    const t = tableStats.get(tab.tableLabel) ?? {
      closedTabs: 0,
      revenue: 0,
      waiters: new Set<string>(),
    };
    t.closedTabs += 1;
    t.revenue += tab.total;
    t.waiters.add(tab.waiterName);
    tableStats.set(tab.tableLabel, t);
  }

  for (const order of qrOrders) {
    qrRevenue += order.total;
    itemsSold += order.items.reduce((s, i) => s + i.quantity, 0);
    if (order.paymentMethod === 'card') cardTotal += order.total;
    else cashTotal += order.total;

    for (const item of order.items) {
      const prev = productCounts.get(item.name) ?? { quantity: 0, revenue: 0 };
      productCounts.set(item.name, {
        quantity: prev.quantity + item.quantity,
        revenue: prev.revenue + item.lineTotal,
      });
    }
  }

  const byWaiter = Array.from(waiterStats.entries())
    .map(([waiterId, stats]) => ({
      waiterId,
      waiterName: stats.waiterName,
      closedTabs: stats.closedTabs,
      revenue: stats.revenue,
      itemsSold: stats.itemsSold,
      tables: Array.from(stats.tables).sort(),
      cashTotal: stats.cashTotal,
      cardTotal: stats.cardTotal,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const byTable = Array.from(tableStats.entries())
    .map(([tableLabel, stats]) => ({
      tableLabel,
      closedTabs: stats.closedTabs,
      revenue: stats.revenue,
      waiters: Array.from(stats.waiters).sort(),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const topProducts = Array.from(productCounts.entries())
    .map(([name, stats]) => ({ name, quantity: stats.quantity, revenue: stats.revenue }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 15);

  return {
    date,
    dayLabel,
    segment: segmentForSummary,
    window: { from, to },
    totals: {
      revenue: tabRevenue + qrRevenue,
      closedTabsCount: closedTabs.length,
      qrOrdersCount: qrOrders.length,
      itemsSold,
      cashTotal,
      cardTotal,
    },
    byWaiter,
    byTable,
    topProducts,
    closedTabs,
    qrOrders,
  };
}
