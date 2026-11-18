import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { markRecallSent } from "@/lib/server-store";

export async function PATCH(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const { id } = await context.params;
  const updated = markRecallSent(id);
  if (!updated) {
    return NextResponse.json({ error: "Richiamo non trovato" }, { status: 404 });
  }
  return NextResponse.json({ recall: updated });
}
