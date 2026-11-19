import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import {
  addBooking,
  AVAILABLE_SLOTS,
  getBookings,
  getServices,
  hasStationConflict,
  inferScheduleFromText,
} from "@/lib/server-store";

const ALLOWED_SIZES = ["Piccola", "Media", "Grande"] as const;

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  return NextResponse.json({ bookings: getBookings() });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      pet?: unknown;
      size?: unknown;
      owner?: unknown;
      phone?: unknown;
      service?: unknown;
      time?: unknown;
      station?: unknown;
      dateIso?: unknown;
      startTime?: unknown;
      petTags?: unknown;
      source?: unknown;
      notes?: unknown;
    };

    const sizeRaw = typeof body.size === "string" ? body.size : "Media";
    const size = (ALLOWED_SIZES as readonly string[]).includes(sizeRaw)
      ? (sizeRaw as (typeof ALLOWED_SIZES)[number])
      : "Media";

    const services = getServices();
    const serviceRaw = typeof body.service === "string" ? body.service.trim() : "";
    const matchedService = services.find((s) => s.title === serviceRaw) || services[1] || services[0];

    const timeRaw = typeof body.time === "string" ? body.time.trim() : "";
    const time =
      (AVAILABLE_SLOTS as readonly string[]).includes(timeRaw) || (timeRaw.length > 0 && timeRaw.length <= 50)
        ? timeRaw
        : AVAILABLE_SLOTS[0];

    const petRaw = typeof body.pet === "string" ? body.pet.trim().slice(0, 60) : "";
    const pet = petRaw || "Teo (Barboncino)";

    const phoneRaw = typeof body.phone === "string" ? body.phone.trim().slice(0, 30) : "";
    if (phoneRaw && !/^[+0-9\s()-]{6,30}$/.test(phoneRaw)) {
      return NextResponse.json({ error: "Numero di telefono non valido." }, { status: 400 });
    }
    const phone = phoneRaw || "+39 347 220 1188";

    const ownerRaw = typeof body.owner === "string" ? body.owner.trim().slice(0, 60) : "";
    const source = body.source === "bot" || body.source === "admin" ? body.source : "sito";

    if (source === "admin") {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
      }
    }

    const owner =
      ownerRaw ||
      (source === "bot" ? "Prenotazione Bot AI" : source === "admin" ? "Inserita da banco" : "Prenotazione dal sito");

    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 200) : undefined;
    const station =
      body.station === "Vasca" || body.station === "Tosatura" || body.station === "Finishing"
        ? body.station
        : undefined;
    const dateIso =
      typeof body.dateIso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.dateIso)
        ? body.dateIso
        : undefined;
    const startTime =
      typeof body.startTime === "string" && /^\d{2}:\d{2}$/.test(body.startTime)
        ? body.startTime
        : undefined;
    const petTags = Array.isArray(body.petTags)
      ? body.petTags.filter((t): t is string => typeof t === "string")
      : undefined;

    const targetStation = station || matchedService.station;
    const inferred = inferScheduleFromText(time);
    const resolvedDateIso = dateIso || inferred.dateIso;
    const resolvedStartTime = startTime || inferred.startTime;

    const conflict = hasStationConflict({
      dateIso: resolvedDateIso,
      startTime: resolvedStartTime,
      durationMin: matchedService.durationMin,
      station: targetStation,
    });

    if (conflict) {
      return NextResponse.json(
        {
          error: `La postazione ${targetStation} è già occupata alle ${resolvedStartTime} (${conflict.pet}). Scegli un altro orario disponibile.`,
        },
        { status: 409 }
      );
    }

    const booking = addBooking({
      pet,
      size,
      owner,
      phone,
      service: matchedService.title,
      time,
      station: targetStation,
      dateIso: resolvedDateIso,
      startTime: resolvedStartTime,
      petTags,
      source,
      notes,
    });

    return NextResponse.json({ booking }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Impossibile registrare la prenotazione." }, { status: 400 });
  }
}
