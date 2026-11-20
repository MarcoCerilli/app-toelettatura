"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { SALON_CONFIG } from "@/lib/salon-config";
import type { GroomingBookingStatus } from "@/lib/grooming-bookings";
import type { BookingRecord } from "@/lib/server-store";

type Station = "Vasca" | "Tosatura" | "Finishing";

const STATIONS: Station[] = ["Vasca", "Tosatura", "Finishing"];
const STATUS_ORDER: GroomingBookingStatus[] = [
  "Confermato WhatsApp",
  "In arrivo",
  "In salone",
  "Completato",
];
const QUICK_TAGS = ["Nodi", "Paura phon", "Cucciolo", "Sensibile", "Mordace"] as const;

const START_HOUR = 9;
const END_HOUR = 19; // 09:00 .. 19:00
const HOUR_HEIGHT = 78; // px per hour (tablet touch-friendly)
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

const DAY_NAMES_SHORT = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const MONTH_NAMES_SHORT = [
  "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
  "Lug", "Ago", "Set", "Ott", "Nov", "Dic",
];

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  const dow = d.getDay(); // 0=Sun..6=Sat
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

function parseStartMinutes(booking: BookingRecord): number {
  const src = booking.startTime || booking.time || "10:00";
  const match = src.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 10 * 60;
  const h = Math.min(END_HOUR - 1, Math.max(START_HOUR, Number(match[1])));
  const m = Math.min(59, Math.max(0, Number(match[2])));
  return h * 60 + m;
}

function resolveDateIso(booking: BookingRecord): string {
  if (booking.dateIso && /^\d{4}-\d{2}-\d{2}$/.test(booking.dateIso)) {
    return booking.dateIso;
  }
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  if (booking.time.toLowerCase().includes("domani")) {
    return toIsoDate(addDays(today, 1));
  }
  return toIsoDate(today);
}

function cardStyleForService(service: string) {
  const s = service.toLowerCase();
  if (s.includes("stripping")) {
    return "bg-violet-100/95 border-l-4 border-violet-500 text-violet-950 hover:bg-violet-100";
  }
  if (s.includes("tosatura")) {
    return "bg-amber-100/95 border-l-4 border-amber-500 text-amber-950 hover:bg-amber-100";
  }
  if (s.includes("unghie") || s.includes("finishing")) {
    return "bg-emerald-100/95 border-l-4 border-emerald-500 text-emerald-950 hover:bg-emerald-100";
  }
  return "bg-sky-100/95 border-l-4 border-sky-500 text-sky-950 hover:bg-sky-100";
}

function cleanPhoneForWa(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("3")) return `39${digits}`;
  return digits;
}

interface PositionedEvent {
  booking: BookingRecord;
  startMin: number;
  endMin: number;
  colIndex: number;
  colCount: number;
}

function layoutColumnEvents(items: BookingRecord[]): PositionedEvent[] {
  const sorted = items
    .map((booking) => {
      const startMin = parseStartMinutes(booking);
      const duration = Math.max(30, booking.durationMin || 60);
      return { booking, startMin, endMin: startMin + duration };
    })
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  // Assign columns greedily for overlapping events
  const activeCols: number[] = [];
  const placed: Array<{ booking: BookingRecord; startMin: number; endMin: number; colIndex: number }> = [];

  for (const ev of sorted) {
    let col = activeCols.findIndex((endTime) => endTime <= ev.startMin);
    if (col === -1) {
      col = activeCols.length;
      activeCols.push(ev.endMin);
    } else {
      activeCols[col] = ev.endMin;
    }
    placed.push({ ...ev, colIndex: col });
  }

  return placed.map((ev) => {
    const overlapping = placed.filter(
      (other) => other.startMin < ev.endMin && other.endMin > ev.startMin
    );
    const maxCol = overlapping.reduce((m, o) => Math.max(m, o.colIndex), 0);
    return {
      ...ev,
      colCount: Math.max(1, maxCol + 1),
    };
  });
}

interface AdminCalendarGridProps {
  bookings: BookingRecord[];
  onQuickBook: (prefill: { dateIso: string; startTime: string; station?: Station }) => void;
  onUpdateBooking: (
    id: string,
    patch: Partial<
      Pick<BookingRecord, "status" | "station" | "notes" | "petTags" | "dateIso" | "startTime" | "time">
    >,
    feedback?: string
  ) => Promise<void>;
  onDeleteBooking: (id: string, pet: string) => Promise<void>;
}

export function AdminCalendarGrid({
  bookings,
  onQuickBook,
  onUpdateBooking,
  onDeleteBooking,
}: AdminCalendarGridProps) {
  const todayIso = useMemo(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return toIsoDate(d);
  }, []);

  const [anchorDate, setAnchorDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  });
  const [desktopMode, setDesktopMode] = useState<"week" | "day">("week");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteEdit, setNoteEdit] = useState("");
  const [dateEdit, setDateEdit] = useState("");
  const [timeEdit, setTimeEdit] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selectedBooking = useMemo(
    () => bookings.find((b) => b.id === selectedId) || null,
    [bookings, selectedId]
  );

  const weekStart = useMemo(() => startOfWeekMonday(anchorDate), [anchorDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)), // Lun..Sab
    [weekStart]
  );
  const activeDayIso = toIsoDate(anchorDate);

  const headerRangeLabel = useMemo(() => {
    if (desktopMode === "day") {
      return `${DAY_NAMES_SHORT[anchorDate.getDay()]} ${anchorDate.getDate()} ${MONTH_NAMES_SHORT[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`;
    }
    const end = addDays(weekStart, 5);
    return `${weekStart.getDate()} ${MONTH_NAMES_SHORT[weekStart.getMonth()]} – ${end.getDate()} ${MONTH_NAMES_SHORT[end.getMonth()]} ${end.getFullYear()}`;
  }, [anchorDate, desktopMode, weekStart]);

  const openDetail = (booking: BookingRecord) => {
    setSelectedId(booking.id);
    setNoteEdit(booking.notes || "");
    setDateEdit(resolveDateIso(booking));
    setTimeEdit(booking.startTime || "10:00");
    setConfirmDelete(false);
  };

  const toggleTag = async (booking: BookingRecord, tag: string) => {
    const current = booking.petTags || [];
    const next = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];
    await onUpdateBooking(booking.id, { petTags: next }, `Tag aggiornati per ${booking.pet}`);
  };

  const dayBookingsForMobile = useMemo(
    () =>
      bookings
        .filter((b) => resolveDateIso(b) === activeDayIso)
        .sort((a, b) => parseStartMinutes(a) - parseStartMinutes(b)),
    [bookings, activeDayIso]
  );

  const totalGridHeight = HOURS.length * HOUR_HEIGHT;

  return (
    <div className="space-y-4">
      {/* Calendar Top Controls */}
      <div className="bg-white rounded-2xl border border-amber-200/80 p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between md:justify-start gap-2">
          <button
            type="button"
            onClick={() => {
              const d = new Date();
              d.setHours(12, 0, 0, 0);
              setAnchorDate(d);
            }}
            className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-bold transition"
          >
            Oggi
          </button>

          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                setAnchorDate((d) => addDays(d, desktopMode === "week" ? -7 : -1))
              }
              className="p-1.5 rounded-xl border border-amber-200 hover:bg-amber-50 text-stone-700"
              aria-label="Periodo precedente"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs sm:text-sm font-black text-stone-900 min-w-[140px] text-center">
              {headerRangeLabel}
            </span>
            <button
              type="button"
              onClick={() =>
                setAnchorDate((d) => addDays(d, desktopMode === "week" ? 7 : 1))
              }
              className="p-1.5 rounded-xl border border-amber-200 hover:bg-amber-50 text-stone-700"
              aria-label="Periodo successivo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between md:justify-end gap-2">
          {/* Legend */}
          <div className="hidden xl:flex items-center gap-3 text-[11px] font-semibold text-stone-600 mr-2">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-sky-500" /> Bagno
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" /> Tosatura
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-violet-500" /> Stripping
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" /> Igiene/Finishing
            </span>
          </div>

          {/* Desktop Mode Switcher */}
          <div className="hidden md:inline-flex rounded-xl bg-[#fbf7f1] p-0.5 border border-amber-200/80">
            <button
              type="button"
              onClick={() => setDesktopMode("week")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                desktopMode === "week"
                  ? "bg-amber-800 text-white shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              Settimana (Lun–Sab)
            </button>
            <button
              type="button"
              onClick={() => setDesktopMode("day")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                desktopMode === "day"
                  ? "bg-amber-800 text-white shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              Giorno (3 Postazioni)
            </button>
          </div>
        </div>
      </div>

      {/* DESKTOP / TABLET TIME-GRID (stile MyPetLab / TheFork) */}
      <div className="hidden md:block bg-white rounded-2xl border border-amber-200/80 overflow-hidden shadow-xs">
        {/* Column Headers */}
        <div
          className={`grid border-b border-amber-200/80 bg-[#fbf7f1] ${
            desktopMode === "week"
              ? "grid-cols-[64px_repeat(6,minmax(0,1fr))]"
              : "grid-cols-[64px_repeat(3,minmax(0,1fr))]"
          }`}
        >
          <div className="p-2.5 text-[10px] font-bold uppercase tracking-wider text-stone-400 text-center border-r border-amber-200/70">
            Ora
          </div>

          {desktopMode === "week"
            ? weekDays.map((day) => {
                const iso = toIsoDate(day);
                const isToday = iso === todayIso;
                const count = bookings.filter((b) => resolveDateIso(b) === iso).length;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => {
                      setAnchorDate(day);
                      setDesktopMode("day");
                    }}
                    className={`p-2.5 text-center border-r last:border-r-0 border-amber-200/70 hover:bg-amber-50/80 transition ${
                      isToday ? "bg-amber-100/60" : ""
                    }`}
                    title="Clicca per aprire le 3 postazioni di questo giorno"
                  >
                    <p className="text-[11px] font-bold uppercase text-stone-500">
                      {DAY_NAMES_SHORT[day.getDay()]}
                    </p>
                    <div className="mt-0.5 inline-flex items-center gap-1.5">
                      <span
                        className={`w-7 h-7 rounded-full inline-flex items-center justify-center text-sm font-black ${
                          isToday ? "bg-amber-800 text-white" : "text-stone-900"
                        }`}
                      >
                        {day.getDate()}
                      </span>
                      {count > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-200/80 text-amber-950">
                          {count}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            : STATIONS.map((st) => {
                const count = bookings.filter(
                  (b) => resolveDateIso(b) === activeDayIso && b.station === st
                ).length;
                return (
                  <div
                    key={st}
                    className="p-3 text-center border-r last:border-r-0 border-amber-200/70"
                  >
                    <p className="font-black text-sm text-stone-900">Postazione {st}</p>
                    <p className="text-[11px] text-stone-500">{count} appuntamenti</p>
                  </div>
                );
              })}
        </div>

        {/* Grid Body */}
        <div
          className={`grid relative ${
            desktopMode === "week"
              ? "grid-cols-[64px_repeat(6,minmax(0,1fr))]"
              : "grid-cols-[64px_repeat(3,minmax(0,1fr))]"
          }`}
        >
          {/* Time Labels Column */}
          <div className="border-r border-amber-200/70 bg-[#fbf7f1]/70">
            {HOURS.map((hour) => (
              <div
                key={hour}
                style={{ height: `${HOUR_HEIGHT}px` }}
                className="border-b border-amber-100/80 pr-2 pt-1 text-right text-[11px] font-bold text-stone-400"
              >
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* Day or Station Columns */}
          {(desktopMode === "week"
            ? weekDays.map((day) => ({
                key: toIsoDate(day),
                dateIso: toIsoDate(day),
                station: undefined as Station | undefined,
                items: bookings.filter((b) => resolveDateIso(b) === toIsoDate(day)),
              }))
            : STATIONS.map((st) => ({
                key: st,
                dateIso: activeDayIso,
                station: st,
                items: bookings.filter(
                  (b) => resolveDateIso(b) === activeDayIso && b.station === st
                ),
              }))
          ).map((col) => {
            const laidOut = layoutColumnEvents(col.items);
            return (
              <div
                key={col.key}
                style={{ height: `${totalGridHeight}px` }}
                className="relative border-r last:border-r-0 border-amber-200/70"
              >
                {/* Clickable Empty Hour Slots */}
                {HOURS.map((hour) => {
                  const slotTime = `${String(hour).padStart(2, "0")}:00`;
                  return (
                    <button
                      key={hour}
                      type="button"
                      onClick={() =>
                        onQuickBook({
                          dateIso: col.dateIso,
                          startTime: slotTime,
                          station: col.station,
                        })
                      }
                      style={{ height: `${HOUR_HEIGHT}px` }}
                      className="w-full block border-b border-amber-100/80 hover:bg-amber-50/70 active:bg-amber-100/70 touch-manipulation transition group relative text-left"
                      title={`Prenota alle ${slotTime}`}
                    >
                      <span className="opacity-30 group-hover:opacity-100 absolute right-1.5 top-1 text-[10px] font-bold text-amber-800 inline-flex items-center gap-0.5 pointer-events-none">
                        <Plus className="w-3 h-3" /> {slotTime}
                      </span>
                    </button>
                  );
                })}

                {/* Positioned Color-Coded Appointment Cards */}
                {laidOut.map(({ booking, startMin, endMin, colIndex, colCount }) => {
                  const topPx = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                  const heightPx = Math.max(
                    48,
                    ((endMin - startMin) / 60) * HOUR_HEIGHT - 4
                  );
                  const widthPct = 100 / colCount;
                  const leftPct = colIndex * widthPct;

                  return (
                    <button
                      key={booking.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail(booking);
                      }}
                      style={{
                        top: `${topPx + 2}px`,
                        height: `${heightPx}px`,
                        left: `calc(${leftPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                      }}
                      className={`absolute z-10 rounded-xl px-2.5 py-1.5 text-left shadow-xs overflow-hidden transition cursor-pointer touch-manipulation active:scale-[0.99] ${cardStyleForService(
                        booking.service
                      )}`}
                    >
                      <div className="flex items-center justify-between gap-1 leading-tight">
                        <span className="text-[11px] font-black truncate">
                          {booking.startTime || booking.time.slice(0, 5)} {booking.pet}
                        </span>
                        {booking.source === "bot" && (
                          <Bot className="w-3.5 h-3.5 shrink-0 opacity-80" />
                        )}
                      </div>
                      <p className="text-[10px] opacity-85 truncate mt-0.5">
                        {booking.service} · {booking.station}
                      </p>
                      {heightPx >= 64 && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/75">
                            {booking.status}
                          </span>
                          {(booking.petTags || []).slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* MOBILE SINGLE-COLUMN TIMELINE (ZERO HORIZONTAL SCROLL) */}
      <div className="md:hidden space-y-2.5">
        <div className="bg-white rounded-2xl border border-amber-200/80 px-3 py-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setAnchorDate((d) => addDays(d, -1))}
            className="p-1.5 rounded-lg bg-amber-50 text-amber-900"
            aria-label="Giorno precedente"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-black text-stone-900">
            {DAY_NAMES_SHORT[anchorDate.getDay()]} {anchorDate.getDate()}{" "}
            {MONTH_NAMES_SHORT[anchorDate.getMonth()]} · {dayBookingsForMobile.length} appunt.
          </span>
          <button
            type="button"
            onClick={() => setAnchorDate((d) => addDays(d, 1))}
            className="p-1.5 rounded-lg bg-amber-50 text-amber-900"
            aria-label="Giorno successivo"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-amber-200/80 divide-y divide-amber-100 overflow-hidden">
          {HOURS.map((hour) => {
            const slotTime = `${String(hour).padStart(2, "0")}:00`;
            const hourItems = dayBookingsForMobile.filter((b) => {
              const startH = Math.floor(parseStartMinutes(b) / 60);
              return startH === hour;
            });

            return (
              <div key={hour} className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-stone-500">{slotTime}</span>
                  <button
                    type="button"
                    onClick={() =>
                      onQuickBook({ dateIso: activeDayIso, startTime: slotTime })
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-lg"
                  >
                    <Plus className="w-3 h-3" /> Prenota qui
                  </button>
                </div>

                {hourItems.length > 0 && (
                  <div className="space-y-2">
                    {hourItems.map((booking) => (
                      <button
                        key={booking.id}
                        type="button"
                        onClick={() => openDetail(booking)}
                        className={`w-full rounded-xl p-3 text-left shadow-xs space-y-1 ${cardStyleForService(
                          booking.service
                        )}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-xs">
                            {booking.startTime || booking.time} · {booking.pet}
                          </span>
                          <span className="font-black text-xs">{booking.price} €</span>
                        </div>
                        <p className="text-[11px] opacity-85">
                          {booking.service} · {booking.station} · {booking.size}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/80">
                            {booking.status}
                          </span>
                          {booking.source === "bot" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-violet-600 text-white">
                              <Bot className="w-3 h-3" /> Bot AI
                            </span>
                          )}
                          {(booking.petTags || []).map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-600 text-white"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* APPOINTMENT DETAIL & QUICK-EDIT MODAL */}
      {selectedBooking && (
        <div
          className="fixed inset-0 z-50 bg-amber-950/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl border border-amber-200/80 p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                  {selectedBooking.id} · {resolveDateIso(selectedBooking)} ·{" "}
                  {selectedBooking.startTime || selectedBooking.time}
                </p>
                <h3 className="font-black text-lg text-stone-900">{selectedBooking.pet}</h3>
                <p className="text-xs text-stone-600">
                  {selectedBooking.service} ({selectedBooking.size}) ·{" "}
                  <strong className="text-amber-900">{selectedBooking.price} €</strong>
                </p>
                <p className="text-xs text-stone-500 mt-0.5">
                  {selectedBooking.owner} · {selectedBooking.phone}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="p-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900"
                aria-label="Chiudi dettaglio"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Status selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                Stato appuntamento
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {STATUS_ORDER.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() =>
                      onUpdateBooking(
                        selectedBooking.id,
                        { status: st },
                        `${selectedBooking.pet}: stato → "${st}"`
                      )
                    }
                    className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition ${
                      selectedBooking.status === st
                        ? "bg-amber-800 text-white border-amber-800 shadow-xs"
                        : "bg-[#fbf7f1] text-stone-700 border-amber-200/70 hover:bg-amber-50"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Station selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                Postazione assegnata
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {STATIONS.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() =>
                      onUpdateBooking(
                        selectedBooking.id,
                        { station: st },
                        `${selectedBooking.pet} → Postazione ${st}`
                      )
                    }
                    className={`min-h-[44px] py-2 rounded-xl text-xs font-bold border transition touch-manipulation ${
                      selectedBooking.station === st
                        ? "bg-amber-950 text-amber-50 border-amber-950 shadow-xs"
                        : "bg-[#fbf7f1] text-stone-700 border-amber-200/70 hover:bg-amber-50"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Reschedule Date & Time (Touch-friendly) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                Sposta data e orario
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                <input
                  type="date"
                  value={dateEdit}
                  onChange={(e) => setDateEdit(e.target.value)}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-[#fbf7f1] border border-amber-200 text-base sm:text-xs font-semibold text-stone-900"
                />
                <input
                  type="time"
                  value={timeEdit}
                  onChange={(e) => setTimeEdit(e.target.value)}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-[#fbf7f1] border border-amber-200 text-base sm:text-xs font-semibold text-stone-900"
                />
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBooking(
                      selectedBooking.id,
                      {
                        dateIso: dateEdit,
                        startTime: timeEdit,
                        time: `${dateEdit} ore ${timeEdit}`,
                      },
                      `${selectedBooking.pet} spostato al ${dateEdit} ore ${timeEdit}`
                    )
                  }
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold touch-manipulation transition"
                >
                  Sposta
                </button>
              </div>
            </div>

            {/* Pet Quick-Tags (Alert nodi / comportamento) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500 inline-flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Alert Pet & Mantello
              </label>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_TAGS.map((tag) => {
                  const active = (selectedBooking.petTags || []).includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(selectedBooking, tag)}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold border transition ${
                        active
                          ? "bg-rose-600 text-white border-rose-600"
                          : "bg-[#fbf7f1] text-stone-700 border-amber-200/80 hover:bg-amber-50"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Internal Notes */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                Note interne staff
              </label>
              <div className="flex gap-2">
                <input
                  value={noteEdit}
                  onChange={(e) => setNoteEdit(e.target.value)}
                  placeholder="Es. Shampoo lenitivo, nodi dietro orecchie..."
                  className="flex-1 px-3 py-2 rounded-xl bg-[#fbf7f1] border border-amber-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
                <button
                  type="button"
                  onClick={() =>
                    onUpdateBooking(
                      selectedBooking.id,
                      { notes: noteEdit.trim() },
                      "Nota interna salvata"
                    )
                  }
                  className="px-3.5 py-2 rounded-xl bg-amber-950 hover:bg-amber-900 text-amber-50 text-xs font-bold transition"
                >
                  Salva
                </button>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-3 border-t border-amber-100 flex flex-wrap items-center justify-between gap-2">
              <a
                href={`https://wa.me/${cleanPhoneForWa(
                  selectedBooking.phone
                )}?text=${encodeURIComponent(
                  `Ciao! Ti scriviamo da ${SALON_CONFIG.salonName} per l'appuntamento di ${selectedBooking.pet} (${selectedBooking.service}, ${selectedBooking.startTime || selectedBooking.time}).`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
              >
                <MessageSquare className="w-3.5 h-3.5" /> Scrivi su WhatsApp
              </a>

              {confirmDelete ? (
                <div className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={async () => {
                      await onDeleteBooking(selectedBooking.id, selectedBooking.pet);
                      setSelectedId(null);
                    }}
                    className="px-3 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold"
                  >
                    Conferma elimina
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2.5 py-2 rounded-xl bg-amber-50 text-stone-700 text-xs font-bold"
                  >
                    Annulla
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-bold transition"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Elimina
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
