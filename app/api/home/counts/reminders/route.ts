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

function parseImporto(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const normalized = raw.replace(/€/g, "").replace(/\s/g, "").replace(/\.(?=\d{3}(?:,|$))/g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function clientKey(nome: unknown, telefono: unknown) {
  return String(nome ?? "").trim().toLowerCase() + "|" + String(telefono ?? "").replace(/\D/g, "");
}

export async function GET(request: Request) {
  if (!(await isDeviceRequestAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "Accesso non autorizzato." }, { status: 401 });
  }

  try {
    const client = db();
    const [jobs, payments, relations, clients] = await Promise.all([
      client.from("jobs").select("vehicle_id,payment_amount,payment_paid_amount,payment_status").not("payment_amount", "is", null),
      client.from("payments").select("client_id,vehicle_id,nome_cliente,amount,paid_amount,status").is("job_id", null).in("status", ["DA_PAGARE", "PARZIALE"]),
      client.from("vehicle_clients").select("vehicle_id,client_id,ruolo"),
      client.from("clients").select("id,nome,telefono"),
    ]);
    for (const result of [jobs, payments, relations, clients]) if (result.error) throw result.error;

    const clientsById = new Map<string, { nome: string; telefono: string }>(
      (clients.data ?? []).map((row: any) => [String(row.id), {
        nome: String(row.nome ?? "").trim() || "Cliente",
        telefono: String(row.telefono ?? ""),
      }])
    );
    const primaryClientByVehicle = new Map<string, string>();
    for (const relation of relations.data ?? []) {
      const vehicleId = String(relation.vehicle_id);
      if (relation.ruolo === "PRINCIPALE" || !primaryClientByVehicle.has(vehicleId)) {
        primaryClientByVehicle.set(vehicleId, String(relation.client_id));
      }
    }

    const balances = new Map<string, number>();
    const addBalance = (name: string, phone: string, amount: number) => {
      if (amount <= 0) return;
      const key = clientKey(name || "Cliente", phone);
      balances.set(key, (balances.get(key) ?? 0) + amount);
    };

    for (const job of jobs.data ?? []) {
      if (String(job.payment_status ?? "").toUpperCase() === "PAGATO") continue;
      const remaining = Math.max(0, parseImporto(job.payment_amount) - parseImporto(job.payment_paid_amount));
      if (remaining <= 0) continue;
      const clientId = primaryClientByVehicle.get(String(job.vehicle_id ?? ""));
      const person = clientId ? clientsById.get(clientId) : undefined;
      addBalance(person?.nome || "Cliente", person?.telefono || "", remaining);
    }

    for (const payment of payments.data ?? []) {
      if (String(payment.status ?? "").toUpperCase() === "PAGATO") continue;
      const remaining = Math.max(0, parseImporto(payment.amount) - parseImporto(payment.paid_amount));
      if (remaining <= 0) continue;
      const person = payment.client_id ? clientsById.get(String(payment.client_id)) : undefined;
      addBalance(person?.nome || String(payment.nome_cliente ?? "").trim() || "Cliente", person?.telefono || "", remaining);
    }

    return NextResponse.json({
      ok: true,
      count: Array.from(balances.values()).filter((balance) => balance > 0).length,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const config = error instanceof Error && error.message === "Configurazione server Supabase mancante.";
    if (!config) console.error("Home reminder count API:", error);
    return NextResponse.json({
      ok: false,
      error: config ? "Configurazione server Supabase mancante." : "Errore caricamento conteggio solleciti.",
    }, { status: config ? 503 : 500 });
  }
}
