import { isDeviceRequestAuthorized } from "@/lib/device-auth";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function db(){const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("Configurazione server Supabase mancante.");return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}
export async function POST(request:Request){
 if(!(await isDeviceRequestAuthorized(request)))return NextResponse.json({ok:false,error:"Accesso non autorizzato."},{status:401});
 const body=await request.json().catch(()=>null);const plate=body&&typeof body==="object"&&!Array.isArray(body)&&typeof body.plate==="string"?body.plate.trim().toUpperCase():"";
 if(!/^[A-Z]{2}[0-9]{3}[A-Z]{2}$/.test(plate))return NextResponse.json({ok:false,error:"Targa non valida."},{status:400});
 try{
  const client=db();
  const {data:vehicle,error:vehicleError}=await client.from("vehicles").select("id,veicolo,motore,targa,immatricolazione,revisione").ilike("targa",plate).maybeSingle();
  if(vehicleError)throw vehicleError;
  if(!vehicle)return NextResponse.json({ok:true,found:false});
  const {error:updateError}=await client.from("vehicles").update({stato:"APERTO",ultima_apertura:new Date().toISOString()}).eq("id",vehicle.id);
  if(updateError)throw updateError;
  const {data:relations,error:relationsError}=await client.from("vehicle_clients").select("client_id,ruolo").eq("vehicle_id",vehicle.id).order("ruolo",{ascending:true});
  if(relationsError)throw relationsError;
  const primary=(relations??[]).find((item:any)=>item.ruolo==="PRINCIPALE")||(relations??[])[0];
  let clientData:any=null;
  if(primary?.client_id){const result=await client.from("clients").select("nome,indirizzo,telefono,codice_fiscale,data_nascita").eq("id",primary.client_id).maybeSingle();if(result.error)throw result.error;clientData=result.data;}
  return NextResponse.json({ok:true,found:true,vehicle,client:clientData},{headers:{"Cache-Control":"no-store"}});
 }catch(error){const config=error instanceof Error&&error.message==="Configurazione server Supabase mancante.";if(!config)console.error("Check-in API:",error);return NextResponse.json({ok:false,error:config?"Configurazione server Supabase mancante.":"Errore durante la ricerca del veicolo."},{status:config?503:500});}
}
