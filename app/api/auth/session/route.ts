import { NextResponse } from "next/server";
import { getAdminSession, isDemoAuthMode } from "@/lib/auth";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({
      authenticated: false,
      demoMode: isDemoAuthMode(),
    });
  }
  return NextResponse.json({
    authenticated: true,
    demoMode: isDemoAuthMode(),
    user: {
      email: session.email,
      name: session.name,
      role: session.role,
    },
  });
}
