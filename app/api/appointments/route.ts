import { isDeviceRequestAuthorized } from "@/lib/device-auth";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIELDS = "id, vehicle_id, titolo, descrizione, data_ora";

function db() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configurazione server Supabase mancante.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Accesso non autorizzato." }, { status: 401 });
}
function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}
function serverConfigError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "Configurazione server Supabase mancante.") {
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
  console.error("Appointments API error:", error);
  return NextResponse.json({ ok: false, error: "Errore durante l'operazione sugli appuntamenti." }, { status: 500 });
}

export async function GET(request: Request) {
  if (!(await isDeviceRequestAuthorized(request))) return unauthorized();
  try {
    const { data, error } = await db().from("appointments").select(FIELDS).order("data_ora", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ ok: true, appointments: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return serverConfigError(error);
  }
}

export async function POST(request: Request) {
  if (!(await isDeviceRequestAuthorized(request))) return unauthorized();
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return badRequest("Corpo della richiesta non valido.");
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const dateTime = typeof body.dateTime === "string" ? body.dateTime : "";
    const id = typeof body.id === "string" && body.id.length <= 100 ? body.id : "";
    if (!description || description.length > 1000) return badRequest("La descrizione è obbligatoria e deve avere massimo 1000 caratteri.");
    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) return badRequest("ID appuntamento non valido.");
    if (!dateTime || !Number.isFinite(Date.parse(dateTime))) return badRequest("Data e ora non valide.");
    const { data, error } = await db().from("appointments").insert({
      id,
      titolo: description,
      descrizione: description,
      data_ora: new Date(dateTime).toISOString(),
    }).select(FIELDS).single();
    if (error) throw error;
    return NextResponse.json({ ok: true, appointment: data }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return serverConfigError(error);
  }
}

export async function PATCH(request: Request) {
  if (!(await isDeviceRequestAuthorized(request))) return unauthorized();
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return badRequest("Corpo della richiesta non valido.");
    const id = typeof body.id === "string" ? body.id : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const dateTime = typeof body.dateTime === "string" ? body.dateTime : "";
    if (!id || id.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(id)) return badRequest("ID appuntamento non valido.");
    if (!description || description.length > 1000) return badRequest("La descrizione è obbligatoria e deve avere massimo 1000 caratteri.");
    if (!dateTime || !Number.isFinite(Date.parse(dateTime))) return badRequest("Data e ora non valide.");
    const { data, error } = await db().from("appointments").update({
      titolo: description,
      descrizione: description,
      data_ora: new Date(dateTime).toISOString(),
    }).eq("id", id).select(FIELDS).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ ok: false, error: "Appuntamento non trovato." }, { status: 404 });
    return NextResponse.json({ ok: true, appointment: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return serverConfigError(error);
  }
}

export async function DELETE(request: Request) {
  if (!(await isDeviceRequestAuthorized(request))) return unauthorized();
  try {
    const body = await request.json().catch(() => null);
    const id = body && typeof body === "object" && !Array.isArray(body) && typeof body.id === "string" ? body.id : "";
    if (!id || id.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(id)) return badRequest("ID appuntamento non valido.");
    const { data, error } = await db().from("appointments").delete().eq("id", id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ ok: false, error: "Appuntamento non trovato." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverConfigError(error);
  }
}
