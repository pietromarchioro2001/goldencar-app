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

export async function PATCH(request: Request) {
  if (!(await isDeviceRequestAuthorized(request))) return NextResponse.json({ok:false,error:"Accesso non autorizzato."},{status:401});
  const body=await request.json().catch(()=>null);
  const id=body&&typeof body==="object"&&!Array.isArray(body)?body.id:null;
  const date=body&&typeof body==="object"&&!Array.isArray(body)?body.revisione:null;
  if(typeof id!=="string"||!id||id.length>128||!/^[a-zA-Z0-9_-]+$/.test(id)||typeof date!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)||Number.isNaN(Date.parse(date+"T00:00:00Z"))) return NextResponse.json({ok:false,error:"Veicolo o data revisione non validi."},{status:400});
  try { const {data,error}=await db().from("vehicles").update({revisione:date}).eq("id",id).select("id,revisione").maybeSingle(); if(error)throw error; if(!data)return NextResponse.json({ok:false,error:"Veicolo non trovato."},{status:404}); return NextResponse.json({ok:true,vehicle:data}); }
  catch(error){const config=error instanceof Error&&error.message==="Configurazione server Supabase mancante.";if(!config)console.error("PATCH /api/revisioni:",error);return NextResponse.json({ok:false,error:config?"Configurazione server Supabase mancante.":"Errore aggiornamento revisione."},{status:config?503:500});}
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
