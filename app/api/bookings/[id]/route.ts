import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { deleteBooking, updateBooking } from "@/lib/server-store";
import { GroomingBooking, GroomingBookingStatus } from "@/lib/grooming-bookings";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id || id.length > 32) {
    return NextResponse.json({ error: "ID non valido" }, { status: 400 });
  }

  try {
    const body = (await req.json()) as {
      status?: GroomingBookingStatus;
      station?: GroomingBooking["station"];
      notes?: string;
      time?: string;
      dateIso?: string;
      startTime?: string;
      petTags?: string[];
    };
    const updated = updateBooking(id, {
      status: body.status,
      station: body.station,
      notes: body.notes,
      time: body.time,
      dateIso: body.dateIso,
      startTime: body.startTime,
      petTags: body.petTags,
    });
    if (!updated) {
      return NextResponse.json({ error: "Appuntamento non trovato" }, { status: 404 });
    }
    return NextResponse.json({ booking: updated });
  } catch {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { id } = await context.params;
  const removed = deleteBooking(id);
  if (!removed) {
    return NextResponse.json({ error: "Appuntamento non trovato" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
