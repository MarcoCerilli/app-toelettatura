import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { resetSalonStore } from "@/lib/server-store";

export async function POST() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  const data = resetSalonStore();
  return NextResponse.json({
    ok: true,
    bookings: data.bookings,
    recalls: data.recalls,
    services: data.services,
  });
}
