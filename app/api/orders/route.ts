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
  if (!(await isDeviceRequestAuthorized(request))) return NextResponse.json({ ok: false, error: "Accesso non autorizzato." }, { status: 401 });
  try {
    const client = db();
    const [orders, suppliers, vehicles, clients, relations] = await Promise.all([
      client.from("orders").select("*").order("created_at", { ascending: false }),
      client.from("suppliers").select("*").order("nome", { ascending: true }),
      client.from("vehicles").select("id, client_id, veicolo, motore, targa, immatricolazione, revisione"),
      client.from("clients").select("*"),
      client.from("vehicle_clients").select("vehicle_id, client_id, ruolo"),
    ]);
    for (const result of [orders, suppliers, vehicles, clients, relations]) if (result.error) throw result.error;
    return NextResponse.json({
      ok: true,
      orders: orders.data ?? [],
      suppliers: suppliers.data ?? [],
      vehicles: vehicles.data ?? [],
      clients: clients.data ?? [],
      relations: relations.data ?? [],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const config = error instanceof Error && error.message === "Configurazione server Supabase mancante.";
    if (!config) console.error("Orders API error:", error);
    return NextResponse.json({ ok: false, error: config ? "Configurazione server Supabase mancante." : "Errore caricamento ordini e dati collegati." }, { status: config ? 503 : 500 });
  }
}
