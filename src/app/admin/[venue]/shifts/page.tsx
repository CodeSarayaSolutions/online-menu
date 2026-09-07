"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarClock,
  Plus,
  X,
  Clock,
  FileText,
  Download,
  Trash2,
  Banknote,
  CreditCard,
  ShoppingBag,
  LayoutGrid,
  User,
  RefreshCw,
  Save,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  History,
  Settings2,
} from "lucide-react";
import clsx from "clsx";
import type {
  DateRoster,
  DayOfWeek,
  EligibleShiftStaff,
  RosterHistoryEntry,
  SaveDateRosterInput,
  SaveDayScheduleInput,
  ShiftSummary,
  WeeklyShiftSchedule,
} from "@/types/shift";
import { DAY_LABELS, DAY_LABELS_SHORT } from "@/types/shift";
import { restaurantRoleLabel } from "@/lib/permissions";
import {
  buildSegmentsFromChangeTimes,
  previewSegmentsFromChangeTimes,
  segmentsToChangeTimes,
  validateChangeTimes,
} from "@/lib/shift-segments";
import {
  formatDateLong,
  formatDateMedium,
  formatDateTime,
  formatWeekRange,
} from "@/lib/date-format";

type RosterSegmentDraft = {
  segmentId: string;
  label: string;
  startsAt: string;
  endsAt: string;
  assigneeIds: Set<string>;
};

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoFromDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + n);
  return isoFromDate(d);
}

function getMondayOfWeek(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return isoFromDate(d);
}

function getWeekDates(weekStartMonday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStartMonday, i));
}

function jsDayToIsoDay(dateStr: string): DayOfWeek {
  const d = new Date(`${dateStr}T12:00:00`);
  const js = d.getDay();
  return (js === 0 ? 7 : js) as DayOfWeek;
}

function exportSummaryCsv(summary: ShiftSummary, venueSlug: string) {
  const seg = summary.segment;
  const lines = [
    "Datum,Dan,Smjena,Od,Do,Ukupno KM,Kartice KM,Gotovina KM,Konobarske kartice,QR narudzbe,Stavki",
    `${summary.date},${summary.dayLabel},"${seg.label}",${summary.window.from},${summary.window.to},${summary.totals.revenue.toFixed(2)},${summary.totals.cardTotal.toFixed(2)},${summary.totals.cashTotal.toFixed(2)},${summary.totals.closedTabsCount},${summary.totals.qrOrdersCount},${summary.totals.itemsSold}`,
    "",
    "Po konobaru,Konobarske kartice,Prihod KM,Stavki,Stolovi",
    ...summary.byWaiter.map(
      (w) =>
        `"${w.waiterName}",${w.closedTabs},${w.revenue.toFixed(2)},${w.itemsSold},"${w.tables.join("; ")}"`
    ),
    "",
    "Po stolu,Kartice,Prihod KM,Konobari",
    ...summary.byTable.map(
      (t) =>
        `"${t.tableLabel}",${t.closedTabs},${t.revenue.toFixed(2)},"${t.waiters.join("; ")}"`
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `smjena-${venueSlug}-${summary.date}-${seg.id.slice(0, 8)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function rosterToDrafts(roster: DateRoster): RosterSegmentDraft[] {
  return roster.segments.map((s) => ({
    segmentId: s.segmentId,
    label: s.label,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    assigneeIds: new Set(s.assigneeIds),
  }));
}

export default function ShiftsPage() {
  const params = useParams();
  const venueSlug = typeof params.venue === "string" ? params.venue : "";

  const [schedule, setSchedule] = useState<WeeklyShiftSchedule | null>(null);
  const [eligibleStaff, setEligibleStaff] = useState<EligibleShiftStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [weekStart, setWeekStart] = useState(() => getMondayOfWeek(todayIso()));
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  const [roster, setRoster] = useState<DateRoster | null>(null);
  const [rosterDraft, setRosterDraft] = useState<RosterSegmentDraft[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterBusy, setRosterBusy] = useState(false);
  const [rosterSaved, setRosterSaved] = useState(false);

  const [history, setHistory] = useState<RosterHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDay, setSettingsDay] = useState<DayOfWeek>(jsDayToIsoDay(todayIso()));
  const [opensAt, setOpensAt] = useState("07:00");
  const [closesAt, setClosesAt] = useState("23:00");
  const [isClosed, setIsClosed] = useState(false);
  const [shiftChangeTimes, setShiftChangeTimes] = useState<string[]>(["15:00"]);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [summarySegmentId, setSummarySegmentId] = useState("");
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const loadSchedule = useCallback(async () => {
    if (!venueSlug) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/shifts/schedule?restaurantId=${encodeURIComponent(venueSlug)}`,
        { credentials: "include" }
      );
      const data = (await res.json().catch(() => null)) as {
        schedule?: WeeklyShiftSchedule;
        eligibleStaff?: EligibleShiftStaff[];
        error?: string;
      } | null;
      if (!res.ok) throw new Error(data?.error ?? "Učitavanje rasporeda nije uspjelo");
      setSchedule(data?.schedule ?? null);
      setEligibleStaff(data?.eligibleStaff ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Učitavanje rasporeda nije uspjelo");
    } finally {
      setLoading(false);
    }
  }, [venueSlug]);

  const loadRoster = useCallback(async () => {
    if (!venueSlug || !selectedDate) return;
    setRosterLoading(true);
    try {
      const res = await fetch(
        `/api/shifts/roster?restaurantId=${encodeURIComponent(venueSlug)}&date=${encodeURIComponent(selectedDate)}`,
        { credentials: "include" }
      );
      const data = (await res.json().catch(() => null)) as {
        roster?: DateRoster;
        error?: string;
      } | null;
      if (!res.ok) throw new Error(data?.error ?? "Učitavanje smjene nije uspjelo");
      const next = data?.roster ?? null;
      setRoster(next);
      setRosterDraft(next ? rosterToDrafts(next) : []);
      setSummarySegmentId(next?.segments[0]?.segmentId ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Učitavanje smjene nije uspjelo");
    } finally {
      setRosterLoading(false);
    }
  }, [venueSlug, selectedDate]);

  const loadHistory = useCallback(async () => {
    if (!venueSlug) return;
    setHistoryLoading(true);
    try {
      const to = todayIso();
      const from = addDays(to, -90);
      const res = await fetch(
        `/api/shifts/history?restaurantId=${encodeURIComponent(venueSlug)}&from=${from}&to=${to}`,
        { credentials: "include" }
      );
      const data = (await res.json().catch(() => null)) as {
        history?: RosterHistoryEntry[];
        error?: string;
      } | null;
      if (!res.ok) throw new Error(data?.error ?? "Učitavanje historije nije uspjelo");
      setHistory(data?.history ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Učitavanje historije nije uspjelo");
    } finally {
      setHistoryLoading(false);
    }
  }, [venueSlug]);

  useEffect(() => {
    void loadSchedule();
    void loadHistory();
  }, [loadSchedule, loadHistory]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  const settingsDayData = useMemo(
    () => schedule?.days.find((d) => d.hours.dayOfWeek === settingsDay),
    [schedule, settingsDay]
  );

  useEffect(() => {
    if (!settingsDayData) return;
    setOpensAt(settingsDayData.hours.opensAt);
    setClosesAt(settingsDayData.hours.closesAt);
    setIsClosed(settingsDayData.hours.isClosed);
    const changes = segmentsToChangeTimes(settingsDayData.segments);
    if (settingsDayData.segments.length === 0) {
      setShiftChangeTimes(["15:00"]);
    } else if (changes.length === 0) {
      setShiftChangeTimes([]);
    } else {
      setShiftChangeTimes(changes);
    }
  }, [settingsDay, settingsDayData]);

  const segmentPreview = useMemo(
    () => previewSegmentsFromChangeTimes(opensAt, closesAt, shiftChangeTimes),
    [opensAt, closesAt, shiftChangeTimes]
  );

  const savedDatesInWeek = useMemo(() => {
    const set = new Set<string>();
    for (const entry of history) {
      if (weekDates.includes(entry.date)) set.add(entry.date);
    }
    if (roster?.hasSavedRoster && weekDates.includes(selectedDate)) {
      set.add(selectedDate);
    }
    return set;
  }, [history, weekDates, roster, selectedDate]);

  const toggleRosterAssignee = (index: number, userId: string) => {
    setRosterDraft((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        const next = new Set(s.assigneeIds);
        if (next.has(userId)) next.delete(userId);
        else next.add(userId);
        return { ...s, assigneeIds: next };
      })
    );
  };

  const saveRoster = async () => {
    if (!venueSlug || !selectedDate) return;
    setRosterBusy(true);
    setError("");
    setRosterSaved(false);
    try {
      const payload: SaveDateRosterInput = {
        date: selectedDate,
        segments: rosterDraft.map((s) => ({
          segmentId: s.segmentId,
          assigneeIds: Array.from(s.assigneeIds),
        })),
      };
      const res = await fetch("/api/shifts/roster", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: venueSlug, roster: payload }),
      });
      const data = (await res.json().catch(() => null)) as {
        roster?: DateRoster;
        error?: string;
      } | null;
      if (!res.ok) throw new Error(data?.error ?? "Spremanje smjene nije uspjelo");
      setRoster(data?.roster ?? null);
      if (data?.roster) setRosterDraft(rosterToDrafts(data.roster));
      setRosterSaved(true);
      setTimeout(() => setRosterSaved(false), 2000);
      void loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Spremanje smjene nije uspjelo");
    } finally {
      setRosterBusy(false);
    }
  };

  const updateChangeTime = (index: number, value: string) => {
    setShiftChangeTimes((prev) => prev.map((t, i) => (i === index ? value : t)));
  };

  const addChangeTime = () => {
    setShiftChangeTimes((prev) => [...prev, closesAt]);
  };

  const removeChangeTime = (index: number) => {
    setShiftChangeTimes((prev) => prev.filter((_, i) => i !== index));
  };

  const saveSettingsDay = async () => {
    if (!venueSlug) return;
    const changeError = validateChangeTimes(opensAt, closesAt, shiftChangeTimes);
    if (!isClosed && changeError) {
      setError(changeError);
      return;
    }
    setSettingsBusy(true);
    setError("");
    setSettingsSaved(false);
    try {
      const segments = isClosed
        ? []
        : buildSegmentsFromChangeTimes(
            opensAt,
            closesAt,
            shiftChangeTimes,
            settingsDayData?.segments ?? []
          );
      const payload: SaveDayScheduleInput = {
        dayOfWeek: settingsDay,
        opensAt,
        closesAt,
        isClosed,
        segments,
      };
      const res = await fetch("/api/shifts/schedule", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: venueSlug, day: payload }),
      });
      const data = (await res.json().catch(() => null)) as {
        schedule?: WeeklyShiftSchedule;
        error?: string;
      } | null;
      if (!res.ok) throw new Error(data?.error ?? "Spremanje postavki nije uspjelo");
      setSchedule(data?.schedule ?? null);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
      void loadRoster();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Spremanje postavki nije uspjelo");
    } finally {
      setSettingsBusy(false);
    }
  };

  const openSummary = async (segmentId?: string) => {
    const segId = segmentId ?? summarySegmentId;
    if (!venueSlug || !segId || !selectedDate) return;
    setSummaryLoading(true);
    setSummary(null);
    setError("");
    try {
      const params = new URLSearchParams({
        restaurantId: venueSlug,
        date: selectedDate,
        segmentId: segId,
      });
      const res = await fetch(`/api/shifts/summary?${params}`, { credentials: "include" });
      const data = (await res.json().catch(() => null)) as {
        summary?: ShiftSummary;
        error?: string;
      } | null;
      if (!res.ok) throw new Error(data?.error ?? "Sažetak nije učitan");
      setSummary(data?.summary ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sažetak nije učitan");
    } finally {
      setSummaryLoading(false);
    }
  };

  const goToWeek = (offset: number) => {
    const nextStart = addDays(weekStart, offset * 7);
    setWeekStart(nextStart);
    const dates = getWeekDates(nextStart);
    if (!dates.includes(selectedDate)) {
      setSelectedDate(dates[0]);
    }
  };

  const isSelectedPast = selectedDate < todayIso();

  return (
    <div className="p-5 lg:p-8 max-w-[1100px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-dark adm-text tracking-tight flex items-center gap-2">
            <CalendarClock size={28} className="text-primary" />
            Smjene
          </h1>
          <p className="text-sm text-muted adm-text-muted mt-1">
            Planirajte smjene po datumu — radno vrijeme i granice smjena postavite jednom u dnu stranice
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void loadSchedule();
            void loadRoster();
            void loadHistory();
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold border adm-border text-muted adm-text-muted hover:adm-text transition self-start"
        >
          <RefreshCw size={14} />
          Osvježi
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-100">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Week navigator */}
          <section className="adm-surface adm-border border rounded-2xl p-5 shadow-soft mb-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <button
                type="button"
                onClick={() => goToWeek(-1)}
                className="p-2 rounded-xl border adm-border hover:adm-bg transition"
                aria-label="Prethodna sedmica"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="text-center">
                <p className="text-[13px] font-bold text-dark adm-text">
                  {formatWeekRange(weekStart, addDays(weekStart, 6))}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const mon = getMondayOfWeek(todayIso());
                    setWeekStart(mon);
                    setSelectedDate(todayIso());
                  }}
                  className="text-[11px] text-primary font-semibold mt-0.5 hover:underline"
                >
                  Danas
                </button>
              </div>
              <button
                type="button"
                onClick={() => goToWeek(1)}
                className="p-2 rounded-xl border adm-border hover:adm-bg transition"
                aria-label="Sljedeća sedmica"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {weekDates.map((date) => {
                const dow = jsDayToIsoDay(date);
                const isSelected = date === selectedDate;
                const isToday = date === todayIso();
                const hasSaved = savedDatesInWeek.has(date);
                const dayData = schedule?.days.find((d) => d.hours.dayOfWeek === dow);
                const closed = dayData?.hours.isClosed ?? false;

                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => setSelectedDate(date)}
                    className={clsx(
                      "relative flex flex-col items-center py-2.5 sm:py-3 rounded-xl border transition text-center",
                      isSelected
                        ? "bg-primary text-white border-primary shadow-glow"
                        : closed
                          ? "adm-bg adm-border opacity-60"
                          : "adm-surface adm-border hover:border-primary/30"
                    )}
                  >
                    <span
                      className={clsx(
                        "text-[10px] sm:text-[11px] font-bold uppercase",
                        isSelected ? "text-white/90" : "text-muted adm-text-muted"
                      )}
                    >
                      {DAY_LABELS_SHORT[dow]}
                    </span>
                    <span className="text-sm sm:text-base font-extrabold mt-0.5">
                      {formatDateMedium(date)}
                    </span>
                    {isToday && !isSelected && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                    {hasSaved && (
                      <span
                        className={clsx(
                          "absolute bottom-1 w-1 h-1 rounded-full",
                          isSelected ? "bg-white" : "bg-emerald-500"
                        )}
                      />
                    )}
                    {closed && (
                      <span className="text-[9px] mt-0.5 opacity-70">Zatv.</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Date roster — main workflow */}
          <motion.section
            key={selectedDate}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="adm-surface adm-border border rounded-2xl p-5 shadow-soft mb-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-[15px] font-extrabold text-dark adm-text capitalize">
                  {formatDateLong(selectedDate)}
                </h2>
                <p className="text-[12px] text-muted adm-text-muted mt-0.5">
                  {roster?.hasSavedRoster
                    ? "Sačuvan raspored osoblja za ovaj datum"
                    : isSelectedPast
                      ? "Nema sačuvanog rasporeda za ovaj datum"
                      : "Dodijelite osoblje po smjenama — promjene sačuvajte prije početka smjene"}
                </p>
              </div>
              {roster?.hasSavedRoster && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                  Sačuvano
                </span>
              )}
            </div>

            {rosterLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : roster?.isClosed ? (
              <p className="text-sm text-muted adm-text-muted italic py-6 text-center">
                Restoran je zatvoren ovog dana prema sedmičnim postavkama.
              </p>
            ) : rosterDraft.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted adm-text-muted mb-3">
                  Nema definisanih smjena za {DAY_LABELS[jsDayToIsoDay(selectedDate)].toLowerCase()}.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSettingsDay(jsDayToIsoDay(selectedDate));
                    setSettingsOpen(true);
                  }}
                  className="text-[13px] font-bold text-primary hover:underline"
                >
                  Postavite smjene u postavkama ↓
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {rosterDraft.map((seg, index) => (
                  <div key={seg.segmentId} className="rounded-xl border adm-border p-4 adm-bg">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div>
                        <p className="font-bold text-dark adm-text">{seg.label}</p>
                        <p className="text-[12px] text-muted adm-text-muted flex items-center gap-1">
                          <Clock size={12} />
                          {seg.startsAt} – {seg.endsAt}
                        </p>
                      </div>
                      {isSelectedPast && (
                        <button
                          type="button"
                          onClick={() => void openSummary(seg.segmentId)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-primary border border-primary/20 hover:bg-primary/5"
                        >
                          <FileText size={12} />
                          Sažetak
                        </button>
                      )}
                    </div>

                    {eligibleStaff.length === 0 ? (
                      <p className="text-[12px] text-muted adm-text-muted italic">
                        Nema dostupnog osoblja.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {eligibleStaff.map((member) => {
                          const selected = seg.assigneeIds.has(member.userId);
                          return (
                            <button
                              key={member.userId}
                              type="button"
                              onClick={() => toggleRosterAssignee(index, member.userId)}
                              className={clsx(
                                "text-[11px] font-semibold px-2.5 py-1 rounded-full border transition",
                                selected
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "adm-border text-muted adm-text-muted hover:adm-text"
                              )}
                            >
                              {member.name} · {restaurantRoleLabel(member.role)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  disabled={rosterBusy}
                  onClick={() => void saveRoster()}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-primary to-amber-500 disabled:opacity-50"
                >
                  {rosterBusy ? (
                    "Spremanje…"
                  ) : rosterSaved ? (
                    <>
                      <Check size={16} /> Sačuvano
                    </>
                  ) : (
                    <>
                      <Save size={16} /> Sačuvaj raspored za {formatDateMedium(selectedDate)}
                    </>
                  )}
                </button>
              </div>
            )}
          </motion.section>

          {/* History */}
          <section className="adm-surface adm-border border rounded-2xl p-5 shadow-soft mb-6">
            <div className="flex items-center gap-2 mb-4">
              <History size={18} className="text-primary" />
              <h2 className="text-[15px] font-extrabold text-dark adm-text">Historija smjena</h2>
            </div>
            <p className="text-[12px] text-muted adm-text-muted mb-4">
              Ko je radio u kojoj smjeni — posljednjih 90 dana
            </p>

            {historyLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted adm-text-muted italic text-center py-6">
                Još nema sačuvanih rasporeda.
              </p>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto">
                {history.map((entry) => (
                  <button
                    key={entry.date}
                    type="button"
                    onClick={() => {
                      setWeekStart(getMondayOfWeek(entry.date));
                      setSelectedDate(entry.date);
                    }}
                    className="w-full text-left rounded-xl border adm-border p-3 hover:border-primary/30 transition"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="font-bold text-dark adm-text text-sm capitalize">
                        {entry.dayLabel}, {formatDateMedium(entry.date)}
                      </p>
                      <span className="text-[10px] text-muted adm-text-muted">{entry.date}</span>
                    </div>
                    <div className="space-y-1.5">
                      {entry.segments.map((seg) => (
                        <div key={seg.segmentId} className="flex flex-wrap gap-x-2 text-[12px]">
                          <span className="font-semibold text-dark adm-text shrink-0">
                            {seg.label} ({seg.startsAt}–{seg.endsAt}):
                          </span>
                          <span className="text-muted adm-text-muted">
                            {seg.staffNames.length > 0
                              ? seg.staffNames.join(", ")
                              : "— niko dodijeljen"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Settings — bottom, collapsed */}
          <section className="adm-surface adm-border border rounded-2xl shadow-soft overflow-hidden">
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:adm-bg transition"
            >
              <div className="flex items-center gap-2">
                <Settings2 size={18} className="text-muted adm-text-muted" />
                <div>
                  <h2 className="text-[15px] font-extrabold text-dark adm-text">
                    Postavke smjena
                  </h2>
                  <p className="text-[12px] text-muted adm-text-muted">
                    Radno vrijeme i granice smjena po danu u sedmici — rijetko se mijenja
                  </p>
                </div>
              </div>
              {settingsOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>

            <AnimatePresence initial={false}>
              {settingsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 border-t adm-border pt-4">
                    <div className="flex gap-1.5 overflow-x-auto pb-3 mb-4">
                      {([1, 2, 3, 4, 5, 6, 7] as DayOfWeek[]).map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setSettingsDay(day)}
                          className={clsx(
                            "px-3 py-1.5 rounded-xl text-[12px] font-bold shrink-0 transition",
                            settingsDay === day
                              ? "bg-primary/10 text-primary border border-primary/20"
                              : "adm-border border text-muted adm-text-muted hover:adm-text"
                          )}
                        >
                          {DAY_LABELS_SHORT[day]}
                        </button>
                      ))}
                    </div>

                    <h3 className="text-sm font-extrabold text-dark adm-text mb-3">
                      {DAY_LABELS[settingsDay]}
                    </h3>

                    <label className="flex items-center gap-2 mb-4 text-sm">
                      <input
                        type="checkbox"
                        checked={isClosed}
                        onChange={(e) => setIsClosed(e.target.checked)}
                        className="rounded"
                      />
                      <span className="font-medium text-dark adm-text">
                        Restoran zatvoren ovog dana
                      </span>
                    </label>

                    {!isClosed && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                          <div>
                            <label className="text-[11px] font-bold text-muted adm-text-muted uppercase">
                              Otvara
                            </label>
                            <input
                              type="time"
                              value={opensAt}
                              onChange={(e) => setOpensAt(e.target.value)}
                              className="mt-1 w-full px-3 py-2.5 rounded-xl border adm-border bg-transparent text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-muted adm-text-muted uppercase">
                              Zatvara
                            </label>
                            <input
                              type="time"
                              value={closesAt}
                              onChange={(e) => setClosesAt(e.target.value)}
                              className="mt-1 w-full px-3 py-2.5 rounded-xl border adm-border bg-transparent text-sm"
                            />
                          </div>
                        </div>

                        <div className="mb-4">
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <div>
                              <p className="text-[12px] font-bold text-dark adm-text">
                                Vrijeme promjene smjene
                              </p>
                              <p className="text-[11px] text-muted adm-text-muted mt-0.5">
                                Npr. 15:00 znači prva smjena do 15:00, druga od 15:00 do zatvaranja
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={addChangeTime}
                              disabled={shiftChangeTimes.length === 0}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-primary border border-primary/20 shrink-0 disabled:opacity-40"
                            >
                              <Plus size={12} />
                              Još jedna
                            </button>
                          </div>

                          <div className="space-y-2 mb-4">
                            {shiftChangeTimes.length === 0 ? (
                              <div className="rounded-xl border adm-border p-4 adm-bg text-center">
                                <p className="text-[12px] text-muted adm-text-muted mb-2">
                                  Cjelodnevna smjena — bez promjene unutar dana
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setShiftChangeTimes(["15:00"])}
                                  className="text-[12px] font-bold text-primary hover:underline"
                                >
                                  Dodaj vrijeme promjene smjene
                                </button>
                              </div>
                            ) : (
                              shiftChangeTimes.map((time, index) => (
                                <div
                                  key={`change-${index}`}
                                  className="flex items-center gap-2 rounded-xl border adm-border p-3 adm-bg"
                                >
                                  <span className="text-[12px] font-semibold text-muted adm-text-muted shrink-0">
                                    Promjena {index + 1}
                                  </span>
                                  <input
                                    type="time"
                                    value={time}
                                    onChange={(e) => updateChangeTime(index, e.target.value)}
                                    className="flex-1 px-3 py-2 rounded-lg border adm-border bg-transparent text-sm"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeChangeTime(index)}
                                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                                    title="Ukloni"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>

                          {segmentPreview.length > 0 && (
                            <div className="rounded-xl border adm-border p-3 adm-bg space-y-1.5">
                              <p className="text-[11px] font-bold text-muted adm-text-muted uppercase mb-2">
                                Rezultat ({segmentPreview.length}{" "}
                                {segmentPreview.length === 1 ? "smjena" : "smjene"})
                              </p>
                              {segmentPreview.map((seg) => (
                                <p key={`${seg.label}-${seg.startsAt}`} className="text-[13px] text-dark adm-text">
                                  <span className="font-bold">{seg.label}:</span>{" "}
                                  {seg.startsAt} – {seg.endsAt}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    <button
                      type="button"
                      disabled={settingsBusy}
                      onClick={() => void saveSettingsDay()}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-primary to-amber-500 disabled:opacity-50"
                    >
                      {settingsBusy ? (
                        "Spremanje…"
                      ) : settingsSaved ? (
                        <>
                          <Check size={16} /> Sačuvano
                        </>
                      ) : (
                        <>
                          <Save size={16} /> Sačuvaj {DAY_LABELS_SHORT[settingsDay]}
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </>
      )}

      {/* Summary modal */}
      <AnimatePresence>
        {(summaryLoading || summary) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => !summaryLoading && setSummary(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="adm-surface adm-border border rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-elevated"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 adm-header border-b adm-border px-6 py-4 flex items-center justify-between z-10">
                <div>
                  <h2 className="text-lg font-extrabold text-dark adm-text">Sažetak smjene</h2>
                  {summary && (
                    <p className="text-[11px] text-muted adm-text-muted mt-0.5">
                      {summary.dayLabel}, {summary.date} · {summary.segment.label} (
                      {summary.segment.startsAt}–{summary.segment.endsAt})
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {summary && (
                    <button
                      type="button"
                      onClick={() => exportSummaryCsv(summary, venueSlug)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-semibold text-primary border border-primary/20"
                    >
                      <Download size={12} /> CSV
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSummary(null)}
                    className="p-2 rounded-xl hover:bg-[var(--adm-surface-2)]"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {summaryLoading ? (
                <div className="flex justify-center py-16">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : summary ? (
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: "Ukupno", value: `${summary.totals.revenue.toFixed(2)} KM`, icon: ShoppingBag },
                      { label: "Konob. kartice", value: String(summary.totals.closedTabsCount), icon: LayoutGrid },
                      { label: "QR narudžbe", value: String(summary.totals.qrOrdersCount), icon: FileText },
                      { label: "Stavki", value: String(summary.totals.itemsSold), icon: User },
                      { label: "Gotovina", value: `${summary.totals.cashTotal.toFixed(2)} KM`, icon: Banknote },
                      { label: "Kartica", value: `${summary.totals.cardTotal.toFixed(2)} KM`, icon: CreditCard },
                    ].map((stat) => (
                      <div key={stat.label} className="p-3 rounded-xl adm-bg">
                        <stat.icon size={14} className="text-primary mb-1" />
                        <p className="text-base font-extrabold text-dark adm-text">{stat.value}</p>
                        <p className="text-[10px] text-muted adm-text-muted">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {summary.segment.assignments.length > 0 && (
                    <div>
                      <h3 className="text-sm font-extrabold text-dark adm-text mb-2">Dodijeljeno osoblje</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {summary.segment.assignments.map((a) => (
                          <span
                            key={a.id}
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-full adm-surface-2 border adm-border"
                          >
                            {a.userName} · {restaurantRoleLabel(a.restaurantRole)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-[11px] text-muted adm-text-muted flex items-center gap-1">
                    <Clock size={12} />
                    {formatDateTime(summary.window.from)} — {formatDateTime(summary.window.to)}
                  </p>

                  {summary.byWaiter.length > 0 && (
                    <div>
                      <h3 className="text-sm font-extrabold text-dark adm-text mb-2">Po konobaru</h3>
                      <div className="space-y-2">
                        {summary.byWaiter.map((w) => (
                          <div key={w.waiterId} className="p-3 rounded-xl adm-bg flex justify-between gap-2">
                            <div>
                              <p className="font-bold text-dark adm-text">{w.waiterName}</p>
                              <p className="text-[11px] text-muted adm-text-muted">
                                {w.closedTabs} kartica · {w.itemsSold} stavki
                              </p>
                            </div>
                            <p className="font-extrabold text-primary">{w.revenue.toFixed(2)} KM</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {summary.byTable.length > 0 && (
                    <div>
                      <h3 className="text-sm font-extrabold text-dark adm-text mb-2">Po stolu</h3>
                      <div className="space-y-2">
                        {summary.byTable.map((t) => (
                          <div key={t.tableLabel} className="p-3 rounded-xl adm-bg flex justify-between">
                            <div>
                              <p className="font-bold text-dark adm-text">{t.tableLabel}</p>
                              <p className="text-[11px] text-muted adm-text-muted">{t.waiters.join(", ")}</p>
                            </div>
                            <p className="font-extrabold">{t.revenue.toFixed(2)} KM</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {summary.closedTabs.length > 0 && (
                    <div>
                      <h3 className="text-sm font-extrabold text-dark adm-text mb-2">Konobarske kartice</h3>
                      <div className="space-y-3">
                        {summary.closedTabs.map((tab) => (
                          <div key={tab.id} className="p-3 rounded-xl border adm-border">
                            <div className="flex justify-between mb-2">
                              <p className="font-bold text-dark adm-text">
                                {tab.tableLabel} · {tab.waiterName}
                              </p>
                              <p className="font-extrabold text-purple-700">{tab.total.toFixed(2)} KM</p>
                            </div>
                            {tab.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-[12px] text-muted adm-text-muted">
                                <span>
                                  {item.quantity > 1 ? `${item.quantity}× ` : ""}
                                  {item.name}
                                </span>
                                <span>{item.lineTotal.toFixed(2)} KM</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {summary.qrOrders.length > 0 && (
                    <div>
                      <h3 className="text-sm font-extrabold text-dark adm-text mb-2">QR narudžbe</h3>
                      <div className="space-y-3">
                        {summary.qrOrders.map((order) => (
                          <div key={order.id} className="p-3 rounded-xl border adm-border">
                            <div className="flex justify-between mb-2">
                              <p className="font-bold text-dark adm-text">Stol {order.tableNumber}</p>
                              <p className="font-extrabold text-primary">{order.total.toFixed(2)} KM</p>
                            </div>
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-[12px] text-muted adm-text-muted">
                                <span>
                                  {item.quantity > 1 ? `${item.quantity}× ` : ""}
                                  {item.name}
                                </span>
                                <span>{item.lineTotal.toFixed(2)} KM</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
