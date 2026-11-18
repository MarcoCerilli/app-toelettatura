import { NextResponse } from "next/server";
import {
  createSessionToken,
  getSessionCookieOptions,
  verifyAdminCredentials,
} from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: unknown; password?: unknown };
    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";

    const session = verifyAdminCredentials(email, password);
    if (!session) {
      return NextResponse.json(
        { error: "Credenziali non valide. Controlla email e password." },
        { status: 401 }
      );
    }

    const token = createSessionToken(session);
    const response = NextResponse.json({
      authenticated: true,
      user: { email: session.email, name: session.name, role: session.role },
    });

    response.cookies.set({
      ...getSessionCookieOptions(),
      value: token,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Richiesta non valida." },
      { status: 400 }
    );
  }
}
