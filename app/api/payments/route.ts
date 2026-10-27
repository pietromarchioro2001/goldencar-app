import { isDeviceRequestAuthorized } from "@/lib/device-auth";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function db() {
  const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key) throw new Error("Configurazione server Supabase mancante.");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
const validId=(x:unknown)=>typeof x==="string"&&x.length>0&&x.length<=128&&/^[a-zA-Z0-9_-]+$/.test(x);
const str=(x:unknown,max:number)=>typeof x==="string"?x.trim().slice(0,max):"";
function fail(error:unknown){const config=error instanceof Error&&error.message==="Configurazione server Supabase mancante.";if(!config)console.error("Payments API:",error);return NextResponse.json({ok:false,error:config?"Configurazione server Supabase mancante.":"Errore operazione pagamenti."},{status:config?503:500});}
export async function POST(request:Request){
 if(!(await isDeviceRequestAuthorized(request)))return NextResponse.json({ok:false,error:"Accesso non autorizzato."},{status:401});
 const body=await request.json().catch(()=>null);
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({ok:false,error:"Corpo non valido."},{status:400});
 const id=str(body.id,128),name=str(body.nome_cliente,200),description=str(body.description,500),amount=body.amount,clientId=body.client_id==null?null:str(body.client_id,128);
 if(!validId(id)||!name||!description||typeof amount!=="number"||!Number.isFinite(amount)||amount<=0||amount>10000000||(clientId&&!validId(clientId)))return NextResponse.json({ok:false,error:"Dati pagamento non validi."},{status:400});
 try{const client=db();if(clientId){const c=await client.from("clients").select("id").eq("id",clientId).maybeSingle();if(c.error)throw c.error;if(!c.data)return NextResponse.json({ok:false,error:"Cliente non trovato."},{status:404});}
 const {data,error}=await client.from("payments").insert({id,client_id:clientId,nome_cliente:name,description,amount,paid_amount:0,status:"DA_PAGARE"}).select("id").single();if(error)throw error;return NextResponse.json({ok:true,payment:data},{status:201});}catch(e){return fail(e);}
}
export async function DELETE(request:Request){
 if(!(await isDeviceRequestAuthorized(request)))return NextResponse.json({ok:false,error:"Accesso non autorizzato."},{status:401});
 const body=await request.json().catch(()=>null);const id=body&&typeof body==="object"&&!Array.isArray(body)?body.id:null;
 if(!validId(id))return NextResponse.json({ok:false,error:"ID pagamento non valido."},{status:400});
 try{const {data,error}=await db().from("payments").delete().eq("id",id).select("id").maybeSingle();if(error)throw error;if(!data)return NextResponse.json({ok:false,error:"Pagamento non trovato."},{status:404});return NextResponse.json({ok:true});}catch(e){return fail(e);}
}
