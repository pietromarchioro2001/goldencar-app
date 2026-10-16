import { isDeviceRequestAuthorized } from "@/lib/device-auth";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function db() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configurazione server Supabase mancante.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
const validId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(value);
const fail = (error: unknown) => {
  const config = error instanceof Error && error.message === "Configurazione server Supabase mancante.";
  if (!config) console.error("Vehicle media API error:", error);
  return NextResponse.json({ ok: false, error: config ? "Configurazione server Supabase mancante." : "Errore durante l'operazione sui documenti del veicolo." }, { status: config ? 503 : 500 });
};

export async function GET(request: Request) {
  if (!(await isDeviceRequestAuthorized(request))) return NextResponse.json({ ok: false, error: "Accesso non autorizzato." }, { status: 401 });
  const vehicleId = new URL(request.url).searchParams.get("vehicleId") || "";
  if (!validId(vehicleId)) return NextResponse.json({ ok: false, error: "ID veicolo non valido." }, { status: 400 });
  try {
    const { data, error } = await db().from("vehicle_media").select("id, vehicle_id, name, mime_type, size, r2_key, created_at").eq("vehicle_id", vehicleId).order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ ok: true, media: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return fail(error); }
}

export async function POST(request: Request) {
  if (!(await isDeviceRequestAuthorized(request))) return NextResponse.json({ ok: false, error: "Accesso non autorizzato." }, { status: 401 });
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ ok: false, error: "Corpo della richiesta non valido." }, { status: 400 });
    const { id, vehicleId, name, mimeType, size, key } = body;
    if (!validId(id) || !validId(vehicleId) || typeof name !== "string" || !name.trim() || name.length > 255 || typeof mimeType !== "string" || mimeType.length > 150 || !Number.isSafeInteger(size) || size < 0 || size > 50 * 1024 * 1024 || typeof key !== "string" || !key.startsWith("veicoli/" + vehicleId + "/media/") || key.length > 1024) {
      return NextResponse.json({ ok: false, error: "Metadati del file non validi." }, { status: 400 });
    }
    const { data, error } = await db().from("vehicle_media").insert({ id, vehicle_id: vehicleId, name: name.trim(), mime_type: mimeType || "application/octet-stream", size, r2_key: key }).select("id, vehicle_id, name, mime_type, size, r2_key, created_at").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, media: data }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return fail(error); }
}

export async function DELETE(request: Request) {
  if (!(await isDeviceRequestAuthorized(request))) return NextResponse.json({ ok: false, error: "Accesso non autorizzato." }, { status: 401 });
  try {
    const body = await request.json().catch(() => null);
    const id = body && typeof body === "object" && !Array.isArray(body) ? body.id : null;
    if (!validId(id)) return NextResponse.json({ ok: false, error: "ID documento non valido." }, { status: 400 });
    const { data, error } = await db().from("vehicle_media").delete().eq("id", id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ ok: false, error: "Documento non trovato." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) { return fail(error); }
}
