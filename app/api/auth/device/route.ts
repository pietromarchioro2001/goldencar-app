import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
const COOKIE = "goldencar_device";
const DAYS = 30;

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}
function equal(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function POST(request: Request) {
  const passwordExpected = process.env.GOLDENCAR_DEVICE_PASSWORD;
  const secret = process.env.GOLDENCAR_SESSION_SECRET;
  if (!passwordExpected || passwordExpected.length < 12 || !secret || secret.length < 32) {
    return NextResponse.json({ ok: false, error: "Configurazione accesso mancante." }, { status: 503 });
  }
  const body = await request.json().catch(() => ({}));
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password || !equal(password, passwordExpected)) {
    return NextResponse.json({ ok: false, error: "Password non corretta." }, { status: 401 });
  }
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
