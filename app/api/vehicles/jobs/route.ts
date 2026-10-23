import { isDeviceRequestAuthorized } from "@/lib/device-auth";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isDeviceRequestAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "Accesso non autorizzato." }, { status: 401 });
  }

  const vehicleId = new URL(request.url).searchParams.get("vehicleId")?.trim() || "";
  if (!vehicleId || vehicleId.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(vehicleId)) {
    return NextResponse.json({ ok: false, error: "ID veicolo non valido." }, { status: 400 });
  }

  try {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Configurazione server Supabase mancante.");
    const { data, error } = await createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }).from("jobs").select("*").eq("vehicle_id", vehicleId).order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ ok: true, jobs: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const configurationError = error instanceof Error && error.message === "Configurazione server Supabase mancante.";
    if (!configurationError) console.error("Errore GET /api/vehicles/jobs:", error);
    return NextResponse.json({
      ok: false,
      error: configurationError ? "Configurazione server Supabase mancante." : "Errore caricamento lavori.",
    }, { status: configurationError ? 503 : 500 });
  }
}
