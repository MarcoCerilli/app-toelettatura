import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { addRecall, getRecalls } from "@/lib/server-store";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  return NextResponse.json({ recalls: getRecalls() });
}

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      pet?: unknown;
      owner?: unknown;
      phone?: unknown;
      due?: unknown;
    };
    const pet = typeof body.pet === "string" ? body.pet.trim() : "";
    const owner = typeof body.owner === "string" ? body.owner.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const due = typeof body.due === "string" ? body.due.trim() : "Manto a 7 settimane";

    if (!pet || !owner) {
      return NextResponse.json({ error: "Nome cane e proprietario obbligatori." }, { status: 400 });
    }

    const recall = addRecall({
      pet,
      owner,
      phone: phone || "+39 347 000 0000",
      due: due || "Manto a 7 settimane",
    });

    return NextResponse.json({ recall }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Dati non validi." }, { status: 400 });
  }
}
