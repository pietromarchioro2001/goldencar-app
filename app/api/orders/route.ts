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


function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function textField(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function validId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(value);
}
async function authorized(request: Request) {
  return await isDeviceRequestAuthorized(request);
}
async function getDbOrResponse() {
  try { return { client: db(), response: null as ReturnType<typeof NextResponse.json> | null }; }
  catch (error) {
    const message = error instanceof Error ? error.message : "";
    return { client: null, response: NextResponse.json({ ok: false, error: message || "Configurazione server Supabase mancante." }, { status: 503 }) };
  }
}

export async function POST(request: Request) {
  if (!(await authorized(request))) return NextResponse.json({ ok: false, error: "Accesso non autorizzato." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!isRecord(body)) return NextResponse.json({ ok: false, error: "Corpo della richiesta non valido." }, { status: 400 });
  const id = textField(body.id, 128), vehicleId = textField(body.vehicleId, 128);
  const supplierId = textField(body.supplierId, 128), jobId = textField(body.jobId, 128);
  const description = textField(body.description, 1000);
  const clientName = textField(body.cliente, 200), phone = textField(body.telefono, 60);
  const vehicleName = textField(body.veicolo, 160), plate = textField(body.targa, 24).toUpperCase();
  if (!validId(id) || !validId(vehicleId) || !validId(supplierId) || (jobId && !validId(jobId)) || !description) {
    return NextResponse.json({ ok: false, error: "Dati dell'ordine incompleti o non validi." }, { status: 400 });
  }
  const {client,response}=await getDbOrResponse(); if(response) return response;
  try {
    const [vehicle,supplier]=await Promise.all([
      client!.from("vehicles").select("id").eq("id",vehicleId).maybeSingle(),
      client!.from("suppliers").select("id").eq("id",supplierId).maybeSingle()
    ]);
    if(vehicle.error) throw vehicle.error; if(supplier.error) throw supplier.error;
    if(!vehicle.data) return NextResponse.json({ok:false,error:"Veicolo non trovato."},{status:404});
    if(!supplier.data) return NextResponse.json({ok:false,error:"Fornitore non trovato."},{status:404});
    if(jobId){const job=await client!.from("jobs").select("id").eq("id",jobId).maybeSingle();if(job.error)throw job.error;if(!job.data)return NextResponse.json({ok:false,error:"Scheda lavoro non trovata."},{status:404});}
    const {data,error}=await client!.from("orders").insert({
      id, numero:textField(body.numero,80) || String(Date.now()), job_id:jobId || null, vehicle_id:vehicleId, supplier_id:supplierId,
      cliente:clientName, telefono:phone, targa:plate, veicolo:vehicleName, prodotti:[{name:description,quantity:"1"}], stato:"DA_INVIARE"
    }).select("*").single();
    if(error)throw error;
    return NextResponse.json({ok:true,order:data},{status:201});
  } catch(error) {
    console.error("POST /api/orders:",error);
    return NextResponse.json({ok:false,error:"Errore creazione ordine."},{status:500});
  }
}

export async function PATCH(request: Request) {
  if (!(await authorized(request))) return NextResponse.json({ ok: false, error: "Accesso non autorizzato." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!isRecord(body) || !validId(body.id)) return NextResponse.json({ ok: false, error: "ID ordine non valido." }, { status: 400 });
  const {client,response}=await getDbOrResponse(); if(response) return response;
  const update: Record<string, unknown> = {};
  if (body.stato !== undefined) {
    const state=textField(body.stato,40);
    if(!["DA_INVIARE","INVIATO","ORDINATO","RICEVUTO","COMPLETATO","ANNULLATO"].includes(state)) return NextResponse.json({ok:false,error:"Stato ordine non valido."},{status:400});
    update.stato=state;
  }
  if (body.description !== undefined) {
    const description=textField(body.description,1000);
    if(!description)return NextResponse.json({ok:false,error:"Descrizione non valida."},{status:400});
    update.prodotti=[{name:description,quantity:"1"}];
  }
  if (body.supplierId !== undefined) {
    if(!validId(body.supplierId))return NextResponse.json({ok:false,error:"Fornitore non valido."},{status:400});
    const {data,error}=await client!.from("suppliers").select("id").eq("id",body.supplierId).maybeSingle();
    if(error)throw error;if(!data)return NextResponse.json({ok:false,error:"Fornitore non trovato."},{status:404});
    update.supplier_id=body.supplierId;
  }
  if (!Object.keys(update).length) return NextResponse.json({ok:false,error:"Nessuna modifica valida."},{status:400});
  try {
    const {data,error}=await client!.from("orders").update(update).eq("id",body.id).select("*").maybeSingle();
    if(error)throw error;if(!data)return NextResponse.json({ok:false,error:"Ordine non trovato."},{status:404});
    return NextResponse.json({ok:true,order:data});
  } catch(error) {console.error("PATCH /api/orders:",error);return NextResponse.json({ok:false,error:"Errore aggiornamento ordine."},{status:500});}
}

export async function DELETE(request: Request) {
  if (!(await authorized(request))) return NextResponse.json({ ok: false, error: "Accesso non autorizzato." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!isRecord(body) || !validId(body.id)) return NextResponse.json({ ok: false, error: "ID ordine non valido." }, { status: 400 });
  const {client,response}=await getDbOrResponse(); if(response) return response;
  try {
    const {data,error}=await client!.from("orders").delete().eq("id",body.id).select("id").maybeSingle();
    if(error)throw error;if(!data)return NextResponse.json({ok:false,error:"Ordine non trovato."},{status:404});
    return NextResponse.json({ok:true});
  } catch(error) {console.error("DELETE /api/orders:",error);return NextResponse.json({ok:false,error:"Errore eliminazione ordine."},{status:500});}
}

export async function PUT(request: Request) {
  if (!(await authorized(request))) return NextResponse.json({ ok: false, error: "Accesso non autorizzato." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!isRecord(body) || !validId(body.id)) return NextResponse.json({ok:false,error:"ID fornitore non valido."},{status:400});
  const nome=textField(body.nome,160), whatsapp=textField(body.whatsapp,60);
  if(!nome)return NextResponse.json({ok:false,error:"Inserisci il nome del fornitore."},{status:400});
  const {client,response}=await getDbOrResponse(); if(response) return response;
  try {
    if(body.action==="delete") {
      const {data,error}=await client!.from("suppliers").delete().eq("id",body.id).select("id").maybeSingle();
      if(error)throw error;if(!data)return NextResponse.json({ok:false,error:"Fornitore non trovato."},{status:404});
      return NextResponse.json({ok:true});
    }
    const {data,error}=await client!.from("suppliers").upsert({id:body.id,nome,whatsapp},{onConflict:"id"}).select("id,nome,whatsapp").single();
    if(error)throw error;
    return NextResponse.json({ok:true,supplier:data});
  } catch(error) {console.error("PUT /api/orders supplier:",error);return NextResponse.json({ok:false,error:"Errore salvataggio fornitore."},{status:500});}
}
