import fs from "node:fs";
import path from "node:path";
import { GroomingBooking, GroomingBookingStatus, priceFor, stationFor } from "./grooming-bookings";

export interface SalonService {
  id: string;
  title: string;
  desc: string;
  durationMin: number;
  basePrice: number;
  photo: string;
  station: "Vasca" | "Tosatura" | "Finishing";
}

export interface RecallItem {
  id: string;
  pet: string;
  owner: string;
  phone: string;
  due: string;
  status: "Da scrivere" | "Inviato WhatsApp";
  lastSentAt?: string;
}

export const PET_QUICK_TAGS = [
  "Nodi",
  "Paura phon",
  "Cucciolo",
  "Sensibile",
  "Mordace",
] as const;

export interface BookingRecord extends GroomingBooking {
  source?: "sito" | "bot" | "admin";
  notes?: string;
  createdAt?: string;
  dateIso?: string;
  startTime?: string;
  durationMin?: number;
  petTags?: string[];
}

function isoDateOffset(offsetDays: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nextWeekdayIso(targetDow: number): string {
  // targetDow: 0=Sun..6=Sat
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const diff = (targetDow - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function inferScheduleFromText(timeStr: string): { dateIso: string; startTime: string } {
  const lower = timeStr.toLowerCase();
  const matchTime = lower.match(/(\d{1,2}):(\d{2})/);
  const startTime = matchTime
    ? `${matchTime[1].padStart(2, "0")}:${matchTime[2]}`
    : "10:00";

  if (lower.includes("domani")) {
    return { dateIso: isoDateOffset(1), startTime };
  }
  if (lower.includes("luned")) return { dateIso: nextWeekdayIso(1), startTime };
  if (lower.includes("marted")) return { dateIso: nextWeekdayIso(2), startTime };
  if (lower.includes("mercoled")) return { dateIso: nextWeekdayIso(3), startTime };
  if (lower.includes("gioved")) return { dateIso: nextWeekdayIso(4), startTime };
  if (lower.includes("venerd")) return { dateIso: nextWeekdayIso(5), startTime };
  if (lower.includes("sabat")) return { dateIso: nextWeekdayIso(6), startTime };
  return { dateIso: isoDateOffset(0), startTime };
}

interface SalonDatabase {
  bookings: BookingRecord[];
  recalls: RecallItem[];
  services: SalonService[];
}

const DEFAULT_SERVICES: SalonService[] = [
  {
    id: "bagno",
    title: "Bagno e asciugatura",
    desc: "Lavaggio con prodotti delicati, asciugatura silenziosa e spazzolatura. Ideale per manti che non vanno tosati.",
    durationMin: 50,
    basePrice: 38,
    photo: "/images/bagno.jpg",
    station: "Vasca",
  },
  {
    id: "tosatura",
    title: "Tosatura completa",
    desc: "Bagno, taglio a forbice o macchinetta secondo lo standard di razza o la lunghezza concordata.",
    durationMin: 100,
    basePrice: 65,
    photo: "/images/tosatura.jpg",
    station: "Tosatura",
  },
  {
    id: "stripping",
    title: "Stripping",
    desc: "Lavorazione a mano per terrier, bassotti e manti ruvidi su postazione dedicata per mantenere il pelo sano.",
    durationMin: 120,
    basePrice: 80,
    photo: "/images/stripping.jpg",
    station: "Tosatura",
  },
  {
    id: "unghie",
    title: "Unghie, orecchie e igiene",
    desc: "Intervento rapido tra un taglio e l'altro: taglio unghie, pulizia padiglione auricolare e ritocco igienico.",
    durationMin: 25,
    basePrice: 22,
    photo: "/images/unghie.jpg",
    station: "Finishing",
  },
];

function buildDefaultBookings(): BookingRecord[] {
  const today = isoDateOffset(0);
  const tomorrow = isoDateOffset(1);
  const dayAfter = isoDateOffset(2);
  const yesterday = isoDateOffset(-1);

  return [
    {
      id: "T-1",
      pet: "Lola (Maltese)",
      size: "Piccola",
      owner: "Chiara Neri",
      phone: "+39 333 441 2201",
      service: "Bagno e asciugatura",
      station: "Vasca",
      time: "09:00–09:50",
      dateIso: today,
      startTime: "09:00",
      durationMin: 50,
      price: 38,
      status: "Confermato WhatsApp",
      source: "sito",
      petTags: ["Paura phon"],
    },
    {
      id: "T-2",
      pet: "Teo (Barboncino)",
      size: "Media",
      owner: "Marco Sala",
      phone: "+39 347 220 1188",
      service: "Tosatura completa",
      station: "Tosatura",
      time: "09:30–11:10",
      dateIso: today,
      startTime: "09:30",
      durationMin: 100,
      price: 65,
      status: "In salone",
      source: "bot",
      petTags: ["Nodi"],
    },
    {
      id: "T-3",
      pet: "Iris (Jack Russell)",
      size: "Piccola",
      owner: "Sara Vitali",
      phone: "+39 349 100 8822",
      service: "Stripping",
      station: "Tosatura",
      time: "11:30–13:30",
      dateIso: today,
      startTime: "11:30",
      durationMin: 120,
      price: 80,
      status: "In arrivo",
      source: "sito",
    },
    {
      id: "T-4",
      pet: "Otto (Labrador)",
      size: "Grande",
      owner: "Luca Greco",
      phone: "+39 338 765 0091",
      service: "Bagno e asciugatura",
      station: "Vasca",
      time: "15:00–16:10",
      dateIso: today,
      startTime: "15:00",
      durationMin: 70,
      price: 48,
      status: "Confermato WhatsApp",
      source: "admin",
    },
    {
      id: "T-5",
      pet: "Nina (Barboncino toy)",
      size: "Piccola",
      owner: "Elena Costa",
      phone: "+39 340 221 7744",
      service: "Unghie, orecchie e igiene",
      station: "Finishing",
      time: "11:15–11:45",
      dateIso: today,
      startTime: "11:15",
      durationMin: 30,
      price: 22,
      status: "Confermato WhatsApp",
      source: "admin",
      petTags: ["Cucciolo"],
    },
    {
      id: "T-6",
      pet: "Milo (Golden Retriever)",
      size: "Grande",
      owner: "Paolo Conti",
      phone: "+39 345 812 3309",
      service: "Tosatura completa",
      station: "Tosatura",
      time: "10:00–11:40",
      dateIso: tomorrow,
      startTime: "10:00",
      durationMin: 100,
      price: 75,
      status: "Confermato WhatsApp",
      source: "bot",
      petTags: ["Nodi"],
    },
    {
      id: "T-7",
      pet: "Chloé (Spitz)",
      size: "Piccola",
      owner: "Marta Rinaldi",
      phone: "+39 339 774 5120",
      service: "Bagno e asciugatura",
      station: "Vasca",
      time: "14:30–15:20",
      dateIso: tomorrow,
      startTime: "14:30",
      durationMin: 50,
      price: 34,
      status: "Confermato WhatsApp",
      source: "sito",
      petTags: ["Sensibile"],
    },
    {
      id: "T-8",
      pet: "Rocky (Westie)",
      size: "Piccola",
      owner: "Andrea Villa",
      phone: "+39 342 661 9082",
      service: "Stripping",
      station: "Tosatura",
      time: "09:30–11:30",
      dateIso: dayAfter,
      startTime: "09:30",
      durationMin: 120,
      price: 76,
      status: "Confermato WhatsApp",
      source: "admin",
    },
    {
      id: "T-9",
      pet: "Mia (Cocker)",
      size: "Media",
      owner: "Silvia Ferri",
      phone: "+39 334 990 1245",
      service: "Tosatura completa",
      station: "Tosatura",
      time: "10:30–12:10",
      dateIso: yesterday,
      startTime: "10:30",
      durationMin: 100,
      price: 65,
      status: "Completato",
      source: "sito",
    },
  ];
}

const DEFAULT_RECALLS: RecallItem[] = [
  { id: "R-1", pet: "Birba (Volpino)", owner: "Giulia Fontana", phone: "+39 335 900 1122", due: "Manto a 7 settimane", status: "Da scrivere" },
  { id: "R-2", pet: "Ciro (Barboncino)", owner: "Davide Riva", phone: "+39 348 333 2210", due: "Manto a 8 settimane", status: "Da scrivere" },
  { id: "R-3", pet: "Peggy (Westie)", owner: "Anna Berri", phone: "+39 331 556 7788", due: "Stripping in scadenza", status: "Da scrivere" },
];

export const AVAILABLE_SLOTS = [
  "Oggi ore 15:00",
  "Domani ore 10:30",
  "Giovedì ore 11:00",
  "Sabato ore 09:00 (ultimo posto)",
] as const;

function getSeedData(): SalonDatabase {
  return {
    bookings: buildDefaultBookings(),
    recalls: structuredClone(DEFAULT_RECALLS),
    services: structuredClone(DEFAULT_SERVICES),
  };
}

const DATA_DIR = path.resolve(process.cwd(), ".data");
const DB_FILE = path.resolve(DATA_DIR, "salon-db.json");

const globalForStore = globalThis as unknown as {
  __casamantoDb?: SalonDatabase;
};

function ensureSafeDbPath(): boolean {
  return DB_FILE.startsWith(DATA_DIR + path.sep);
}

function readDb(): SalonDatabase {
  if (globalForStore.__casamantoDb) {
    return globalForStore.__casamantoDb;
  }

  if (ensureSafeDbPath()) {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf8");
        const parsed = JSON.parse(raw) as SalonDatabase;
        if (parsed && Array.isArray(parsed.bookings) && Array.isArray(parsed.recalls) && Array.isArray(parsed.services)) {
          globalForStore.__casamantoDb = parsed;
          return parsed;
        }
      }
    } catch {
      // Fall back to in-memory seed if disk read fails
    }
  }

  const seeded = getSeedData();
  globalForStore.__casamantoDb = seeded;
  persistDb(seeded);
  return seeded;
}

function persistDb(db: SalonDatabase) {
  globalForStore.__casamantoDb = db;
  if (!ensureSafeDbPath()) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
  } catch {
    // Keep operating from globalForStore.__casamantoDb if filesystem is read-only
  }
}

export function priceForServiceAndSize(serviceTitle: string, size: string, services?: SalonService[]): number {
  const list = services || readDb().services;
  const matched = list.find((s) => s.title === serviceTitle);
  const base = matched ? matched.basePrice : priceFor(serviceTitle);
  if (size === "Grande") return base + 10;
  if (size === "Piccola") return Math.max(18, base - 4);
  return base;
}

export function getServices(): SalonService[] {
  return readDb().services;
}

export function updateService(
  id: string,
  patch: Partial<Pick<SalonService, "basePrice" | "durationMin" | "desc">>
): SalonService | null {
  const db = readDb();
  const idx = db.services.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  const current = db.services[idx];
  const updated: SalonService = {
    ...current,
    basePrice: typeof patch.basePrice === "number" && patch.basePrice > 0 ? Math.round(patch.basePrice) : current.basePrice,
    durationMin: typeof patch.durationMin === "number" && patch.durationMin >= 10 ? Math.round(patch.durationMin) : current.durationMin,
    desc: typeof patch.desc === "string" && patch.desc.trim() ? patch.desc.trim().slice(0, 240) : current.desc,
  };
  db.services[idx] = updated;
  persistDb(db);
  return updated;
}

export function getBookings(): BookingRecord[] {
  return readDb().bookings;
}

export function addBooking(input: {
  pet: string;
  size: "Piccola" | "Media" | "Grande";
  owner: string;
  phone: string;
  service: string;
  time: string;
  station?: "Vasca" | "Tosatura" | "Finishing";
  dateIso?: string;
  startTime?: string;
  durationMin?: number;
  petTags?: string[];
  source?: "sito" | "bot" | "admin";
  notes?: string;
}): BookingRecord {
  const db = readDb();
  const matchedService = db.services.find((s) => s.title === input.service);
  const station = input.station || (matchedService ? matchedService.station : stationFor(input.service));
  const price = priceForServiceAndSize(input.service, input.size, db.services);
  const inferred = inferScheduleFromText(input.time);
  const durationMin = input.durationMin || matchedService?.durationMin || 60;
  const allowedTags = new Set<string>(PET_QUICK_TAGS);
  const petTags = Array.isArray(input.petTags)
    ? input.petTags.filter((t) => allowedTags.has(t)).slice(0, 5)
    : undefined;

  const record: BookingRecord = {
    id: `T-${Date.now().toString().slice(-4)}`,
    pet: input.pet,
    size: input.size,
    owner: input.owner,
    phone: input.phone,
    service: input.service,
    station,
    time: input.time,
    dateIso: input.dateIso && /^\d{4}-\d{2}-\d{2}$/.test(input.dateIso) ? input.dateIso : inferred.dateIso,
    startTime: input.startTime && /^\d{2}:\d{2}$/.test(input.startTime) ? input.startTime : inferred.startTime,
    durationMin,
    petTags: petTags && petTags.length > 0 ? petTags : undefined,
    price,
    status: "Confermato WhatsApp",
    source: input.source || "sito",
    notes: input.notes,
    createdAt: new Date().toISOString(),
  };

  db.bookings = [record, ...db.bookings];
  persistDb(db);
  return record;
}

export function updateBooking(
  id: string,
  patch: Partial<
    Pick<BookingRecord, "status" | "station" | "notes" | "time" | "dateIso" | "startTime" | "petTags">
  >
): BookingRecord | null {
  const db = readDb();
  const idx = db.bookings.findIndex((b) => b.id === id);
  if (idx === -1) return null;

  const allowedStatuses: GroomingBookingStatus[] = [
    "Confermato WhatsApp",
    "In arrivo",
    "In salone",
    "Completato",
    "Richiamo manto",
  ];
  const allowedStations: GroomingBooking["station"][] = ["Vasca", "Tosatura", "Finishing"];
  const allowedTags = new Set<string>(PET_QUICK_TAGS);

  const current = db.bookings[idx];
  const updated: BookingRecord = {
    ...current,
    status: patch.status && allowedStatuses.includes(patch.status) ? patch.status : current.status,
    station: patch.station && allowedStations.includes(patch.station) ? patch.station : current.station,
    notes: typeof patch.notes === "string" ? patch.notes.slice(0, 200) : current.notes,
    time: typeof patch.time === "string" && patch.time.trim() ? patch.time.trim().slice(0, 60) : current.time,
    dateIso:
      typeof patch.dateIso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(patch.dateIso)
        ? patch.dateIso
        : current.dateIso,
    startTime:
      typeof patch.startTime === "string" && /^\d{2}:\d{2}$/.test(patch.startTime)
        ? patch.startTime
        : current.startTime,
    petTags: Array.isArray(patch.petTags)
      ? patch.petTags.filter((t) => allowedTags.has(t)).slice(0, 5)
      : current.petTags,
  };
  db.bookings[idx] = updated;
  persistDb(db);
  return updated;
}

export function deleteBooking(id: string): boolean {
  const db = readDb();
  const next = db.bookings.filter((b) => b.id !== id);
  if (next.length === db.bookings.length) return false;
  db.bookings = next;
  persistDb(db);
  return true;
}

export function getRecalls(): RecallItem[] {
  return readDb().recalls;
}

export function markRecallSent(id: string): RecallItem | null {
  const db = readDb();
  const idx = db.recalls.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  db.recalls[idx] = {
    ...db.recalls[idx],
    status: "Inviato WhatsApp",
    lastSentAt: new Date().toISOString(),
  };
  persistDb(db);
  return db.recalls[idx];
}

export function addRecall(input: {
  pet: string;
  owner: string;
  phone: string;
  due: string;
}): RecallItem {
  const db = readDb();
  const item: RecallItem = {
    id: `R-${Date.now().toString().slice(-4)}`,
    pet: input.pet.slice(0, 60),
    owner: input.owner.slice(0, 60),
    phone: input.phone.slice(0, 30),
    due: input.due.slice(0, 60),
    status: "Da scrivere",
  };
  db.recalls = [item, ...db.recalls];
  persistDb(db);
  return item;
}

function timeToMinutes(hhmm: string): number {
  const m = hhmm.match(/(\d{1,2}):(\d{2})/);
  if (!m) return 10 * 60;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function hasStationConflict(params: {
  dateIso: string;
  startTime: string;
  durationMin: number;
  station: "Vasca" | "Tosatura" | "Finishing";
  excludeId?: string;
}): BookingRecord | null {
  const db = readDb();
  const startA = timeToMinutes(params.startTime);
  const endA = startA + Math.max(20, params.durationMin);

  for (const b of db.bookings) {
    if (params.excludeId && b.id === params.excludeId) continue;
    if (b.station !== params.station) continue;
    const bSchedule = b.dateIso && b.startTime
      ? { dateIso: b.dateIso, startTime: b.startTime }
      : inferScheduleFromText(b.time);
    if (bSchedule.dateIso !== params.dateIso) continue;

    const startB = timeToMinutes(bSchedule.startTime);
    const endB = startB + Math.max(20, b.durationMin || 60);
    if (startA < endB && endA > startB) {
      return b;
    }
  }
  return null;
}

const WEEKDAY_LABELS_IT = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
const CANDIDATE_HOURS = ["09:00", "10:30", "11:30", "14:30", "15:00", "16:30"] as const;

export interface FreeSlotOption {
  slot: string;
  dateIso: string;
  startTime: string;
  station: "Vasca" | "Tosatura" | "Finishing";
  available: boolean;
}

export function getAvailableSlotsForService(serviceTitle?: string, limit = 4): FreeSlotOption[] {
  const db = readDb();
  const matched = serviceTitle
    ? db.services.find((s) => s.title === serviceTitle)
    : db.services[1] || db.services[0];
  const station = matched ? matched.station : stationFor(serviceTitle || "Tosatura completa");
  const durationMin = matched ? matched.durationMin : 60;

  const results: FreeSlotOption[] = [];
  for (let offset = 0; offset <= 7 && results.length < limit; offset++) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    if (d.getDay() === 0) continue; // Domenica chiuso

    const dateIso = isoDateOffset(offset);
    const dayLabel =
      offset === 0 ? "Oggi" : offset === 1 ? "Domani" : WEEKDAY_LABELS_IT[d.getDay()];

    for (const startTime of CANDIDATE_HOURS) {
      if (results.length >= limit) break;
      const startMin = timeToMinutes(startTime);
      if (startMin + durationMin > 19 * 60) continue; // Chiusura 19:00
      const conflict = hasStationConflict({ dateIso, startTime, durationMin, station });
      if (!conflict) {
        results.push({
          slot: `${dayLabel} ore ${startTime}`,
          dateIso,
          startTime,
          station,
          available: true,
        });
      }
    }
  }

  return results;
}

export function getPublicSlotAvailability(serviceTitle?: string) {
  return getAvailableSlotsForService(serviceTitle, 4);
}

export function resetSalonStore(): SalonDatabase {
  const seeded = getSeedData();
  persistDb(seeded);
  return seeded;
}
