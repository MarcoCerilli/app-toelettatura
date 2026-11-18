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

export interface BookingRecord extends GroomingBooking {
  source?: "sito" | "bot" | "admin";
  notes?: string;
  createdAt?: string;
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

const DEFAULT_BOOKINGS: BookingRecord[] = [
  {
    id: "T-1",
    pet: "Lola (Maltese)",
    size: "Piccola",
    owner: "Chiara Neri",
    phone: "+39 333 441 2201",
    service: "Bagno e asciugatura",
    station: "Vasca",
    time: "09:00–09:50",
    price: 38,
    status: "Confermato WhatsApp",
    source: "sito",
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
    price: 65,
    status: "Confermato WhatsApp",
    source: "bot",
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
    service: "Finishing e fiocco",
    station: "Finishing",
    time: "11:15–11:45",
    price: 25,
    status: "Confermato WhatsApp",
    source: "admin",
  },
];

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
    bookings: structuredClone(DEFAULT_BOOKINGS),
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
  source?: "sito" | "bot" | "admin";
  notes?: string;
}): BookingRecord {
  const db = readDb();
  const matchedService = db.services.find((s) => s.title === input.service);
  const station = matchedService ? matchedService.station : stationFor(input.service);
  const price = priceForServiceAndSize(input.service, input.size, db.services);

  const record: BookingRecord = {
    id: `T-${Date.now().toString().slice(-4)}`,
    pet: input.pet,
    size: input.size,
    owner: input.owner,
    phone: input.phone,
    service: input.service,
    station,
    time: input.time,
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
  patch: Partial<Pick<BookingRecord, "status" | "station" | "notes" | "time">>
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

  const current = db.bookings[idx];
  const updated: BookingRecord = {
    ...current,
    status: patch.status && allowedStatuses.includes(patch.status) ? patch.status : current.status,
    station: patch.station && allowedStations.includes(patch.station) ? patch.station : current.station,
    notes: typeof patch.notes === "string" ? patch.notes.slice(0, 200) : current.notes,
    time: typeof patch.time === "string" && patch.time.trim() ? patch.time.trim().slice(0, 60) : current.time,
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

export function getPublicSlotAvailability() {
  const bookings = readDb().bookings;
  return AVAILABLE_SLOTS.map((slot) => {
    const count = bookings.filter((b) => b.time === slot).length;
    return {
      slot,
      bookedCount: count,
      available: count < 3,
    };
  });
}

export function resetSalonStore(): SalonDatabase {
  const seeded = getSeedData();
  persistDb(seeded);
  return seeded;
}
