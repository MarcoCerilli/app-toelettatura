import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getPublicSlotAvailability, getServices, updateService } from "@/lib/server-store";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const serviceParam = searchParams.get("service") || undefined;
  return NextResponse.json({
    services: getServices(),
    slots: getPublicSlotAvailability(serviceParam),
  });
}

export async function PATCH(req: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      id?: unknown;
      basePrice?: unknown;
      durationMin?: unknown;
      desc?: unknown;
    };
    if (typeof body.id !== "string" || !body.id.trim()) {
      return NextResponse.json({ error: "ID servizio mancante" }, { status: 400 });
    }

    const updated = updateService(body.id.trim(), {
      basePrice: typeof body.basePrice === "number" ? body.basePrice : undefined,
      durationMin: typeof body.durationMin === "number" ? body.durationMin : undefined,
      desc: typeof body.desc === "string" ? body.desc : undefined,
    });

    if (!updated) {
      return NextResponse.json({ error: "Servizio non trovato" }, { status: 404 });
    }

    return NextResponse.json({ service: updated });
  } catch {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }
}
