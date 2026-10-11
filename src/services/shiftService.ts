import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Database, Json, Tables } from '@/types/supabase';
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
  const { data: venue, error: venueError } = await db.from('restaurants').select('kitchen_enabled').eq('id',restaurantId).single();
  if (venueError) throw venueError;

  return (data ?? [])
    .filter((row) => ASSIGNABLE_ROLES.has(row.role as RestaurantRole) && (row.role !== "kitchen" || venue.kitchen_enabled))
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

/** All writes execute in a single checked database transaction. */
export async function saveDaySchedule(restaurantId: string, input: SaveDayScheduleInput, actorId: string, client: DbClient): Promise<WeeklyShiftSchedule> {
  const { error } = await client.rpc('hos_shift_save', { p_actor: actorId, p_venue: restaurantId, p_action: 'schedule', p_data: input as unknown as Json });
  if (error) throw error;
  return getWeeklySchedule(restaurantId, client);
}
export async function getDateRoster(restaurantId: string, date: string, client: DbClient): Promise<DateRoster> {
  const { data, error } = await client.rpc('hos_roster', { p_venue: restaurantId, p_date: date });
  if (error) throw error;
  return data as unknown as DateRoster;
}
export async function saveDateRoster(restaurantId: string, input: SaveDateRosterInput, actorId: string, client: DbClient): Promise<DateRoster> {
  const { data, error } = await client.rpc('hos_shift_save', { p_actor: actorId, p_venue: restaurantId, p_action: 'roster', p_data: input as unknown as Json });
  if (error) throw error;
  return data as unknown as DateRoster;
}
export async function getRosterHistory(restaurantId: string, from: string, to: string, client: DbClient): Promise<RosterHistoryEntry[]> {
  const result: RosterHistoryEntry[] = [];
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await client.from('roster_snapshots').select('roster_date,segments').eq('restaurant_id',restaurantId).gte('roster_date',from).lte('roster_date',to).order('roster_date',{ascending:false}).range(offset,offset+199);
    if (error) throw error;
    for (const row of data ?? []) result.push({ date: row.roster_date, dayLabel: DAY_LABELS[dateToDayOfWeek(row.roster_date)], segments: (row.segments as unknown as DateRoster['segments']).map(s => ({segmentId:s.segmentId,label:s.label,startsAt:s.startsAt,endsAt:s.endsAt,staffNames:s.assignments.map(a=>a.userName)})) });
    if (!data || data.length < 200) return result;
  }
}
export async function buildSegmentSummary(restaurantId:string,date:string,segmentId:string,actorId:string,client:DbClient):Promise<ShiftSummary>{
 const {data,error}=await client.rpc('hos_shift_summary',{p_actor:actorId,p_venue:restaurantId,p_date:date,p_segment:segmentId});
 if(error)throw error;
 return data as unknown as ShiftSummary;
}
