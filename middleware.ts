import { NextRequest, NextResponse } from "next/server";

const COOKIE = "goldencar_device";
const DAYS = 30;

async function signature(payload: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const result = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  let binary = "";
  for (const byte of result) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function validSession(token: string | undefined, secret: string) {
  if (!token) return false;
  const separator = token.indexOf(".");
  if (separator <= 0) return false;
  const payload = token.slice(0, separator);
  const supplied = token.slice(separator + 1);
  if (!/^\d{10}$/.test(payload) || !supplied) return false;
  const expires = Number(payload);
  const now = Math.floor(Date.now() / 1000);
  if (expires <= now || expires > now + DAYS * 86400 + 60) return false;
  const expected = await signature(payload, secret);
  if (expected.length !== supplied.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  return difference === 0;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/api/auth/device") return NextResponse.next();

  const secret = process.env.GOLDENCAR_SESSION_SECRET;
  const authenticated = Boolean(secret && secret.length >= 32 && await validSession(request.cookies.get(COOKIE)?.value, secret));

  if (pathname === "/accesso") {
    if (authenticated) {
      const home = request.nextUrl.clone();
      home.pathname = "/home";
      home.search = "";
      return NextResponse.redirect(home);
    }
    return NextResponse.next();
  }

  if (authenticated) {
    // A real browser reload/full-page open should always land on Home.
    // Next.js client-side navigations are RSC requests and are left untouched.
    const isDocumentNavigation =
      request.headers.get("sec-fetch-mode") === "navigate" &&
      (request.headers.get("accept") || "").includes("text/html");
    if (pathname !== "/home" && isDocumentNavigation) {
      const home = request.nextUrl.clone();
      home.pathname = "/home";
      home.search = "";
      return NextResponse.redirect(home);
    }
    return NextResponse.next();
  }

  // API endpoints are always checked, even if a path happens to end with a file extension.
  if (pathname.startsWith("/api/")) return NextResponse.json({ ok: false, error: "Accesso non autorizzato." }, { status: 401 });

  // Public framework and PWA assets must load before the access screen can render.
  if (pathname.startsWith("/_next/") || pathname === "/favicon.ico" || pathname === "/logo.png" || pathname === "/manifest.json" || pathname === "/sw.js" || pathname.startsWith("/icons/") || /\.[a-zA-Z0-9]{2,8}$/.test(pathname)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/accesso";
  url.search = "";
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
