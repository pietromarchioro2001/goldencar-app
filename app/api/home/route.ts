import { isDeviceRequestAuthorized } from "@/lib/device-auth";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function db(){const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("Configurazione server Supabase mancante.");return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}
export async function GET(request:Request){
 if(!(await isDeviceRequestAuthorized(request)))return NextResponse.json({ok:false,error:"Accesso non autorizzato."},{status:401});
 try{
 const client=db();
 const [jobs,payments,appointments,vehicles,relations,clients,orders,suppliers]=await Promise.all([
  client.from("jobs").select("id, vehicle_id, titolo, tipo, lavori, chilometri, manodopera, note, fattura, stato, created_at, closed_at, payment_amount, payment_paid_amount, payment_status, dettagli").order("created_at",{ascending:false}),
  client.from("payments").select("id, client_id, vehicle_id, job_id, nome_cliente, description, amount, paid_amount, status, created_at").is("job_id",null).in("status",["DA_PAGARE","PARZIALE"]).order("created_at",{ascending:false}),
  client.from("appointments").select("id, vehicle_id, titolo, descrizione, data_ora").order("data_ora",{ascending:true}),
  client.from("vehicles").select("id, client_id, veicolo, targa, revisione").order("targa",{ascending:true}),
  client.from("vehicle_clients").select("vehicle_id,client_id,ruolo"),
  client.from("clients").select("id,nome,telefono"),
  client.from("orders").select("id, numero, cliente, veicolo, prodotti, vehicle_id, supplier_id, stato").order("created_at",{ascending:false}),
  client.from("suppliers").select("id,nome,whatsapp").order("nome",{ascending:true})
 ]);
 for(const result of [jobs,payments,appointments,vehicles,relations,clients,orders,suppliers])if(result.error)throw result.error;
 return NextResponse.json({ok:true,jobs:jobs.data??[],payments:payments.data??[],appointments:appointments.data??[],vehicles:vehicles.data??[],relations:relations.data??[],clients:clients.data??[],orders:orders.data??[],suppliers:suppliers.data??[]},{headers:{"Cache-Control":"no-store"}});
 }catch(error){const config=error instanceof Error&&error.message==="Configurazione server Supabase mancante.";if(!config)console.error("Home data API:",error);return NextResponse.json({ok:false,error:config?"Configurazione server Supabase mancante.":"Errore caricamento dati Home."},{status:config?503:500});}
}
