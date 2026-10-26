import { sendPushOnce } from "@/lib/push-notifications";
import { isDeviceRequestAuthorized } from "@/lib/device-auth";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function db(){const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("Configurazione server Supabase mancante.");return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}
const validId=(x:unknown)=>typeof x==="string"&&x.length>0&&x.length<=128&&/^[a-zA-Z0-9_-]+$/.test(x);
const fail=(e:unknown)=>{const config=e instanceof Error&&e.message==="Configurazione server Supabase mancante.";if(!config)console.error("Jobs API:",e);return NextResponse.json({ok:false,error:config?"Configurazione server Supabase mancante.":"Errore durante l'operazione sulla scheda lavoro."},{status:config?503:500});};
const JOB_FIELDS = [
  "vehicle_id", "titolo", "tipo", "problemi", "lavori", "prodotti_utilizzati",
  "chilometri", "manodopera", "note", "fattura", "stato", "closed_at",
  "payment_amount", "payment_paid_amount", "payment_status", "dettagli",
] as const;

function validValues(b: any) {
  if (!validId(b.vehicle_id)) return false;
  if (b.dettagli != null && (!b.dettagli || typeof b.dettagli !== "object" || Array.isArray(b.dettagli))) return false;
  for (const k of ["titolo", "tipo", "problemi", "lavori", "prodotti_utilizzati", "chilometri", "manodopera", "note", "fattura", "stato"])
    if (b[k] != null && typeof b[k] !== "string") return false;
  if (b.closed_at != null && (typeof b.closed_at !== "string" || !Number.isFinite(Date.parse(b.closed_at)))) return false;
  for (const k of ["payment_amount", "payment_paid_amount"])
    if (b[k] != null && (typeof b[k] !== "number" || !Number.isFinite(b[k]) || b[k] < 0 || b[k] > 10000000)) return false;
  if (b.payment_status != null && !["DA_PAGARE", "PARZIALE", "PAGATO"].includes(b.payment_status)) return false;
  return true;
}

// Never forward arbitrary request properties to a service-role database client.
function pickJobFields(body: Record<string, unknown>) {
  const values: Record<string, unknown> = {};
  for (const field of JOB_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) values[field] = body[field];
  }
  return values;
}
export async function GET(request:Request){if(!(await isDeviceRequestAuthorized(request)))return NextResponse.json({ok:false,error:"Accesso non autorizzato."},{status:401});const url=new URL(request.url);const id=url.searchParams.get("id");try{const client=db();if(url.searchParams.get("nextNumber")==="1"){const {data,error}=await client.from("jobs").select("dettagli,created_at").order("created_at",{ascending:false}).limit(2000);if(error)throw error;const year=new Date().getFullYear()%100;let maxSequence=0;for(const row of data||[]){let details:Record<string,unknown>={};try{details=typeof row.dettagli==="string"?JSON.parse(row.dettagli):row.dettagli||{};}catch{}const n=Number(details.jobNumber||0);if(n>=1000&&Math.floor(n/1000)===year)maxSequence=Math.max(maxSequence,n%1000);else if(n>0&&n<1000&&new Date(row.created_at).getFullYear()%100===year)maxSequence=Math.max(maxSequence,n);}return NextResponse.json({ok:true,nextJobNumber:year*1000+maxSequence+1},{headers:{"Cache-Control":"no-store"}});}if(!id||!validId(id))return NextResponse.json({ok:false,error:"ID scheda non valido."},{status:400});const {data,error}=await client.from("jobs").select("*").eq("id",id).maybeSingle();if(error)throw error;if(!data)return NextResponse.json({ok:false,error:"Scheda lavoro non trovata."},{status:404});return NextResponse.json({ok:true,job:data},{headers:{"Cache-Control":"no-store"}});}catch(e){return fail(e);}}
export async function POST(request:Request){if(!(await isDeviceRequestAuthorized(request)))return NextResponse.json({ok:false,error:"Accesso non autorizzato."},{status:401});const b=await request.json().catch(()=>null);if(!b||typeof b!=="object"||Array.isArray(b)||!validValues(b))return NextResponse.json({ok:false,error:"Dati scheda non validi."},{status:400});try{const client=db();const vehicle=await client.from("vehicles").select("id").eq("id",b.vehicle_id).maybeSingle();if(vehicle.error)throw vehicle.error;if(!vehicle.data)return NextResponse.json({ok:false,error:"Veicolo non trovato."},{status:404});const {data,error}=await client.from("jobs").insert({ ...(validId(b.id) ? { id: b.id } : {}), ...pickJobFields(b) }).select("*").single();if(error)throw error;return NextResponse.json({ok:true,job:data},{status:201});}catch(e){return fail(e);}}
export async function PATCH(request:Request){if(!(await isDeviceRequestAuthorized(request)))return NextResponse.json({ok:false,error:"Accesso non autorizzato."},{status:401});const b=await request.json().catch(()=>null);if(!b||typeof b!=="object"||Array.isArray(b)||!validId(b.id)||(!b.vehicle_id&&(!b.dettagli||typeof b.dettagli!=="object"||Array.isArray(b.dettagli)))||(b.vehicle_id&&!validValues(b)))return NextResponse.json({ok:false,error:"Dati scheda non validi."},{status:400});try{const client=db();if(b.vehicle_id){const vehicle=await client.from("vehicles").select("id").eq("id",b.vehicle_id).maybeSingle();if(vehicle.error)throw vehicle.error;if(!vehicle.data)return NextResponse.json({ok:false,error:"Veicolo non trovato."},{status:404});}const {id,...values}=b;const safeValues=pickJobFields(values);if(!Object.keys(safeValues).length)return NextResponse.json({ok:false,error:"Nessuna modifica valida."},{status:400});const {data:previous,error:previousError}=await client.from("jobs").select("stato,titolo,tipo,dettagli,vehicle_id").eq("id",id).maybeSingle();if(previousError)throw previousError;const {data,error}=await client.from("jobs").update(safeValues).eq("id",id).select("*").maybeSingle();if(error)throw error;if(!data)return NextResponse.json({ok:false,error:"Scheda lavoro non trovata."},{status:404});const newStatus=String(data.stato||"").toUpperCase();const oldStatus=String(previous?.stato||"").toUpperCase();if(newStatus==="DA_DOCUMENTARE"&&oldStatus!=="DA_DOCUMENTARE"){let details:Record<string,any>={};try{details=typeof data.dettagli==="string"?JSON.parse(data.dettagli):data.dettagli||{};}catch{}const vehicleResult=await client.from("vehicles").select("targa,marca,modello").eq("id",data.vehicle_id).maybeSingle();const vehicle=vehicleResult.data as any;const vehicleName=[vehicle?.marca,vehicle?.modello].filter(Boolean).join(" ")||"veicolo";const jobType=String(data.tipo||details.tipoLavoro||details.tipo||data.titolo||"Scheda di lavoro");await sendPushOnce("job-document:"+String(data.id)+":"+Date.now(),{title:"GOLDENCAR · Da documentare",body:jobType+" · "+vehicleName+(vehicle?.targa?" · "+vehicle.targa:""),url:"/veicolo/scheda?jobId="+encodeURIComponent(String(data.id)),tag:"job-document-"+String(data.id)}).catch(error=>console.error("Notifica scheda da documentare:",error));}return NextResponse.json({ok:true,job:data});}catch(e){return fail(e);}}
export async function DELETE(request:Request){if(!(await isDeviceRequestAuthorized(request)))return NextResponse.json({ok:false,error:"Accesso non autorizzato."},{status:401});const b=await request.json().catch(()=>null);if(!b||typeof b!=="object"||Array.isArray(b)||!validId(b.id))return NextResponse.json({ok:false,error:"ID scheda non valido."},{status:400});try{const client=db();const {data,error}=await client.from("jobs").delete().eq("id",b.id).select("id").maybeSingle();if(error)throw error;if(!data)return NextResponse.json({ok:false,error:"Scheda lavoro non trovata."},{status:404});return NextResponse.json({ok:true});}catch(e){return fail(e);}}
