import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
const COOKIE = "goldencar_device";
const DAYS = 30;

// Best-effort per-instance throttling. This is defense-in-depth only: serverless
// instances do not share memory, so production-grade global throttling needs a
// shared store or an edge/WAF rule.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attemptsByIp = new Map<string, { count: number; resetAt: number }>();

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}
function equal(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function clientIp(request: Request) {
  // Use a single proxy-provided address rather than trusting arbitrary forwarded
  // lists. Vercel sets x-forwarded-for; deployments should keep this endpoint
  // behind a trusted proxy.
  const forwarded = request.headers.get("x-forwarded-for");
  const candidate = forwarded?.split(",")[0]?.trim();
  return candidate && candidate.length <= 80 ? candidate : "unknown";
}
function isRateLimited(ip: string, now: number) {
  // Bound memory usage if requests arrive with many distinct source addresses.
  if (attemptsByIp.size > 5000) {
    for (const [key, value] of attemptsByIp) {
      if (value.resetAt <= now) attemptsByIp.delete(key);
    }
    if (attemptsByIp.size > 5000) attemptsByIp.clear();
  }

  const current = attemptsByIp.get(ip);
  if (!current || current.resetAt <= now) {
    attemptsByIp.set(ip, { count: 0, resetAt: now + WINDOW_MS });
    return false;
  }
  return current.count >= MAX_ATTEMPTS;
}
function recordFailure(ip: string, now: number) {
  const current = attemptsByIp.get(ip);
  if (!current || current.resetAt <= now) {
    attemptsByIp.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  current.count += 1;
}
function clearFailures(ip: string) {
  attemptsByIp.delete(ip);
}

export async function POST(request: Request) {
  const now = Date.now();
  const ip = clientIp(request);
  if (isRateLimited(ip, now)) {
    return NextResponse.json(
      { ok: false, error: "Troppi tentativi. Riprova tra qualche minuto." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(WINDOW_MS / 1000)) } }
    );
  }

  const passwordExpected = process.env.GOLDENCAR_DEVICE_PASSWORD;
  const secret = process.env.GOLDENCAR_SESSION_SECRET;
  if (!passwordExpected || passwordExpected.length < 12 || !secret || secret.length < 32) {
    return NextResponse.json({ ok: false, error: "Configurazione accesso mancante." }, { status: 503 });
  }

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > 4096) {
    return NextResponse.json({ ok: false, error: "Richiesta troppo grande." }, { status: 413 });
  }

  const body = await request.json().catch(() => ({}));
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password || password.length > 1024 || !equal(password, passwordExpected)) {
    recordFailure(ip, now);
    return NextResponse.json({ ok: false, error: "Password non corretta." }, { status: 401 });
  }

  clearFailures(ip);
  const expiresAt = Math.floor(Date.now() / 1000) + DAYS * 86400;
  const payload = String(expiresAt);
  const response = NextResponse.json({ ok: true, expiresAt });
  response.cookies.set(COOKIE, payload + "." + sign(payload, secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: new Date(expiresAt * 1000),
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}
