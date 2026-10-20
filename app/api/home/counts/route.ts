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

export async function GET(request: Request) {
  if (!(await isDeviceRequestAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "Accesso non autorizzato." }, { status: 401 });
  }

  const url = new URL(request.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const until = url.searchParams.get("until");
  if (!start || !end || !until || !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
    return NextResponse.json({ ok: false, error: "Intervallo date non valido." }, { status: 400 });
  }

  try {
    const client = db();
    const [jobs, appointments, revisions, orders] = await Promise.all([
      client.from("jobs").select("id", { count: "exact", head: true }).in("stato", ["APERTO", "IN_LAVORAZIONE"]),
      client.from("appointments").select("id", { count: "exact", head: true }).gte("data_ora", start).lt("data_ora", end),
      client.from("vehicles").select("id", { count: "exact", head: true }).not("revisione", "is", null).lte("revisione", until),
      client.from("orders").select("id", { count: "exact", head: true }),
    ]);
    for (const result of [jobs, appointments, revisions, orders]) if (result.error) throw result.error;

    return NextResponse.json({
      ok: true,
      counts: {
        lavori: jobs.count ?? 0,
        agenda: appointments.count ?? 0,
        revisioni: revisions.count ?? 0,
        ordini: orders.count ?? 0,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const config = error instanceof Error && error.message === "Configurazione server Supabase mancante.";
    if (!config) console.error("Home counts API:", error);
    return NextResponse.json({
      ok: false,
      error: config ? "Configurazione server Supabase mancante." : "Errore caricamento conteggi Home.",
    }, { status: config ? 503 : 500 });
  }
}
