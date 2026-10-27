import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isDeviceRequestAuthorized } from "@/lib/device-auth";
import { getVapidPublicKey } from "@/lib/push-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function db() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configurazione server Supabase mancante.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(request: Request) {
  if (!(await isDeviceRequestAuthorized(request))) return NextResponse.json({ ok: false, error: "Accesso non autorizzato." }, { status: 401 });
  const publicKey = getVapidPublicKey();
  if (!publicKey) return NextResponse.json({ ok: false, error: "Notifiche non configurate sul server." }, { status: 503 });
  return NextResponse.json({ ok: true, publicKey }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!(await isDeviceRequestAuthorized(request))) return NextResponse.json({ ok: false, error: "Accesso non autorizzato." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const subscription = body?.subscription;
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || endpoint.length > 4096 ||
      typeof p256dh !== "string" || p256dh.length > 512 || typeof auth !== "string" || auth.length > 512) {
    return NextResponse.json({ ok: false, error: "Iscrizione alle notifiche non valida." }, { status: 400 });
  }
  try {
    const { error } = await db().from("push_subscriptions").upsert(
      { endpoint, p256dh, auth, device_label: typeof body.deviceLabel === "string" ? body.deviceLabel.slice(0, 120) : null },
      { onConflict: "endpoint" }
    );
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Push subscribe:", error);
    return NextResponse.json({ ok: false, error: "Non è stato possibile salvare l'iscrizione." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isDeviceRequestAuthorized(request))) return NextResponse.json({ ok: false, error: "Accesso non autorizzato." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const endpoint = body?.endpoint;
  if (typeof endpoint !== "string" || endpoint.length > 4096) return NextResponse.json({ ok: false, error: "Endpoint non valido." }, { status: 400 });
  try {
    const { error } = await db().from("push_subscriptions").delete().eq("endpoint", endpoint);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Push unsubscribe:", error);
    return NextResponse.json({ ok: false, error: "Non è stato possibile disattivare le notifiche." }, { status: 500 });
  }
}
