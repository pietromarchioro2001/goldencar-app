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
  try {
    const client = db();
    const [vehicles, clients, jobs] = await Promise.all([
      client.from("vehicles").select("id, client_id, veicolo, targa, revisione").not("revisione", "is", null),
      client.from("clients").select("id, nome, telefono"),
      client.from("jobs").select("*").in("stato", ["CONCLUSO", "CHIUSO"]).order("created_at", { ascending: false }),
    ]);
    if (vehicles.error) throw vehicles.error;
    if (clients.error) throw clients.error;
    if (jobs.error) throw jobs.error;
    const vehicleIds = (vehicles.data ?? []).map((row: any) => String(row.id));
    let relations: any[] = [];
    if (vehicleIds.length) {
      const result = await client.from("vehicle_clients").select("vehicle_id, client_id, ruolo").in("vehicle_id", vehicleIds);
      if (result.error) throw result.error;
      relations = result.data ?? [];
    }
    return NextResponse.json({
      ok: true,
      vehicles: vehicles.data ?? [],
      clients: clients.data ?? [],
      relations,
      jobs: jobs.data ?? [],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const config = error instanceof Error && error.message === "Configurazione server Supabase mancante.";
    if (!config) console.error("Revisions API error:", error);
    return NextResponse.json({ ok: false, error: config ? "Configurazione server Supabase mancante." : "Errore caricamento revisioni e lavori." }, { status: config ? 503 : 500 });
  }
}
