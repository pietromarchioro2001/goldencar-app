import { isDeviceRequestAuthorized } from "@/lib/device-auth";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function db() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configurazione server Supabase mancante.");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
const validId=(x:unknown)=>typeof x==="string"&&x.length>0&&x.length<=128&&/^[a-zA-Z0-9_-]+$/.test(x);
export async function PATCH(request:Request) {
  if(!(await isDeviceRequestAuthorized(request))) return NextResponse.json({ok:false,error:"Accesso non autorizzato."},{status:401});
  const body=await request.json().catch(()=>null);
  if(!body||typeof body!=="object"||Array.isArray(body)||!validId(body.id)) return NextResponse.json({ok:false,error:"ID scheda non valido."},{status:400});
  const status=body.paymentStatus;
  const paid=body.paymentPaidAmount;
  if(status!=="PAGATO"||typeof paid!=="number"||!Number.isFinite(paid)||paid<0||paid>10000000) return NextResponse.json({ok:false,error:"Dati pagamento non validi."},{status:400});
  try {
    const client=db();
    const {data,error}=await client.from("jobs").update({payment_status:status,payment_paid_amount:paid}).eq("id",body.id).select("id").maybeSingle();
    if(error) throw error;
    if(!data) return NextResponse.json({ok:false,error:"Scheda lavoro non trovata."},{status:404});
    return NextResponse.json({ok:true});
  } catch(error) {
    const config=error instanceof Error&&error.message==="Configurazione server Supabase mancante.";
    if(!config) console.error("PATCH /api/jobs/payment:",error);
    return NextResponse.json({ok:false,error:config?"Configurazione server Supabase mancante.":"Errore aggiornamento pagamento della scheda."},{status:config?503:500});
  }
}
