import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushOnce } from "@/lib/push-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Non autorizzato." }, { status: 401 });
  }
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ ok: false, error: "Configurazione database mancante." }, { status: 503 });
  try {
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: vehicles, error } = await client.from("vehicles").select("id,revisione,targa").not("revisione", "is", null);
    if (error) throw error;
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    let notifications = 0;
    for (const vehicle of vehicles || []) {
      const dateText = String(vehicle.revisione || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) continue;
      const due = new Date(dateText + "T00:00:00Z");
      const days = Math.round((due.getTime() - today.getTime()) / 86400000);
      if (![30, 7, 1, 0].includes(days)) continue;
      const plate = String(vehicle.targa || "").trim();
      const body = days === 0 ? `Revisione in scadenza oggi` : days === 1 ? `Revisione in scadenza domani` : `Revisione tra ${days} giorni`;
      const result = await sendPushOnce(
        `revision:${vehicle.id}:${dateText}:${days}`,
        { title: "GOLDENCAR · Revisioni", body: plate ? `${body} · ${plate}` : body, url: "/revisioni?tab=revisioni", tag: `revision-${vehicle.id}-${days}` }
      );
      if ("sent" in result) notifications += result.sent;
    }
    return NextResponse.json({ ok: true, checked: (vehicles || []).length, notifications });
  } catch (error) {
    console.error("Revision reminders:", error);
    return NextResponse.json({ ok: false, error: "Errore promemoria revisioni." }, { status: 503 });
  }
}
