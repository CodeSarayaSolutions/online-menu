import type { RestaurantRole } from '@/types/auth';

/** 1 = Monday … 7 = Sunday */
export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const DAY_LABELS: Record<DayOfWeek, string> = {
  1: 'Ponedjeljak',
  2: 'Utorak',
  3: 'Srijeda',
  4: 'Četvrtak',
  5: 'Petak',
  6: 'Subota',
  7: 'Nedjelja',
};

export const DAY_LABELS_SHORT: Record<DayOfWeek, string> = {
  1: 'Pon',
  2: 'Uto',
  3: 'Sri',
  4: 'Čet',
  5: 'Pet',
  6: 'Sub',
  7: 'Ned',
};

export type DayHours = {
  dayOfWeek: DayOfWeek;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
};

export type SegmentAssignment = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  restaurantRole: Exclude<RestaurantRole, 'owner'>;
};

export type DayShiftSegment = {
  id: string;
  dayOfWeek: DayOfWeek;
  label: string;
  startsAt: string;
  endsAt: string;
  sortOrder: number;
  assignments: SegmentAssignment[];
};

export type WeeklyShiftSchedule = {
  restaurantId: string;
  days: Array<{
    hours: DayHours;
    segments: DayShiftSegment[];
  }>;
};

export type EligibleShiftStaff = {
  userId: string;
  name: string;
  email: string;
  role: RestaurantRole;
};

export type ShiftSummaryItemLine = {
  name: string;
  quantity: number;
  lineTotal: number;
};

export type ShiftSummaryClosedTab = {
  id: string;
  tableLabel: string;
  waiterId: string;
  waiterName: string;
  total: number;
  paymentMethod: string | null;
  openedAt: string;
  closedAt: string | null;
  items: ShiftSummaryItemLine[];
};

export type ShiftSummaryQrOrder = {
  id: string;
  tableNumber: string;
  total: number;
  status: string;
  paymentMethod: string;
  createdAt: string;
  itemCount: number;
  items: ShiftSummaryItemLine[];
};

export type ShiftSummaryWaiterBreakdown = {
  waiterId: string;
  waiterName: string;
  closedTabs: number;
  revenue: number;
  itemsSold: number;
  tables: string[];
  cashTotal: number;
  cardTotal: number;
};

export type ShiftSummaryTableBreakdown = {
  tableLabel: string;
  closedTabs: number;
  revenue: number;
  waiters: string[];
};

export type ShiftSummaryProductBreakdown = {
  name: string;
  quantity: number;
  revenue: number;
};

export type ShiftSummary = {
  date: string;
  dayLabel: string;
  segment: DayShiftSegment;
  window: { from: string; to: string };
  totals: {
    revenue: number;
    closedTabsCount: number;
    qrOrdersCount: number;
    itemsSold: number;
    cashTotal: number;
    cardTotal: number;
  };
  byWaiter: ShiftSummaryWaiterBreakdown[];
  byTable: ShiftSummaryTableBreakdown[];
  topProducts: ShiftSummaryProductBreakdown[];
  closedTabs: ShiftSummaryClosedTab[];
  qrOrders: ShiftSummaryQrOrder[];
};

export type SaveDayScheduleInput = {
  dayOfWeek: DayOfWeek;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
  segments: Array<{
    id?: string;
    label?: string;
    startsAt: string;
    endsAt: string;
  }>;
};

export type DateRosterSegment = {
  segmentId: string;
  label: string;
  startsAt: string;
  endsAt: string;
  assigneeIds: string[];
  assignments: SegmentAssignment[];
  hasSavedRoster: boolean;
};

export type DateRoster = {
  date: string;
  dayOfWeek: DayOfWeek;
  dayLabel: string;
  isClosed: boolean;
  hasSavedRoster: boolean;
  segments: DateRosterSegment[];
};

export type SaveDateRosterInput = {
  date: string;
  segments: Array<{ segmentId: string; assigneeIds: string[] }>;
};

export type RosterHistoryEntry = {
  date: string;
  dayLabel: string;
  segments: Array<{
    segmentId: string;
    label: string;
    startsAt: string;
    endsAt: string;
    staffNames: string[];
  }>;
};
