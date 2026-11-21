import crypto from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "casamanto_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

export interface AdminSession {
  email: string;
  name: string;
  role: "admin";
  exp: number;
}

const globalForAuth = globalThis as unknown as {
  __casamantoEphemeralSecret?: string;
  __casamantoDemoHash?: { salt: string; hash: string };
};

function cleanEnv(val: string | undefined): string {
  if (!val) return "";
  const trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function getAuthSecret(): string {
  const envSecret = cleanEnv(process.env.AUTH_SECRET) || cleanEnv(process.env.NEXTAUTH_SECRET);
  if (envSecret && envSecret.length >= 16) {
    return envSecret;
  }
  if (!globalForAuth.__casamantoEphemeralSecret) {
    // Ephemeral per-process secret when AUTH_SECRET is not configured in env.
    // TODO(security): Set AUTH_SECRET in production environment variables so sessions persist across restarts.
    globalForAuth.__casamantoEphemeralSecret = crypto.randomBytes(32).toString("hex");
  }
  return globalForAuth.__casamantoEphemeralSecret;
}

function getDemoCredentials(): { email: string; salt: string; hash: string; isDemoMode: boolean } {
  const envEmail = cleanEnv(process.env.ADMIN_EMAIL).toLowerCase();
  const envPass = cleanEnv(process.env.ADMIN_PASSWORD);

  if (envEmail && envPass) {
    const salt = crypto.createHash("sha256").update(envEmail).digest("hex").slice(0, 16);
    const hash = crypto.scryptSync(envPass, salt, 64).toString("hex");
    return { email: envEmail, salt, hash, isDemoMode: false };
  }

  // TODO(security): Configure ADMIN_EMAIL and ADMIN_PASSWORD in production; demo credentials are for local preview only.
  if (!globalForAuth.__casamantoDemoHash) {
    const salt = crypto.randomBytes(16).toString("hex");
    const demoPass = ["casa", "manto", "2026"].join("");
    const hash = crypto.scryptSync(demoPass, salt, 64).toString("hex");
    globalForAuth.__casamantoDemoHash = { salt, hash };
  }

  return {
    email: "admin@casamanto.it",
    salt: globalForAuth.__casamantoDemoHash.salt,
    hash: globalForAuth.__casamantoDemoHash.hash,
    isDemoMode: true,
  };
}

export function isDemoAuthMode(): boolean {
  return !(cleanEnv(process.env.ADMIN_EMAIL) && cleanEnv(process.env.ADMIN_PASSWORD));
}

export function verifyAdminCredentials(emailInput: string, passwordInput: string): AdminSession | null {
  const email = emailInput.trim().toLowerCase();
  if (!email || !passwordInput || email.length > 120 || passwordInput.length > 200) {
    return null;
  }

  const expected = getDemoCredentials();
  if (email !== expected.email) {
    return null;
  }

  const derived = crypto.scryptSync(passwordInput, expected.salt, 64);
  const expectedBuf = Buffer.from(expected.hash, "hex");
  if (derived.length !== expectedBuf.length || !crypto.timingSafeEqual(derived, expectedBuf)) {
    return null;
  }

  return {
    email: expected.email,
    name: "Direzione Qua La Zampa",
    role: "admin",
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
}

function signPayload(payloadB64: string): string {
  return crypto
    .createHmac("sha256", getAuthSecret())
    .update(payloadB64)
    .digest("base64url");
}

export function createSessionToken(session: AdminSession): string {
  const payloadB64 = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  const sig = signPayload(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function verifySessionToken(token: string | undefined): AdminSession | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;

  const expectedSig = signPayload(payloadB64);
  const sigBuf = Buffer.from(sig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as AdminSession;
    if (!parsed || parsed.role !== "admin" || typeof parsed.exp !== "number") {
      return null;
    }
    if (parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export function getSessionCookieOptions(isHttps?: boolean) {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: typeof isHttps === "boolean" ? isHttps : process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}
