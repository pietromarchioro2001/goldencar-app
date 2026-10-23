import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Non autorizzato." }, { status: 401 });
  }

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Keep-alive: configurazione server Supabase mancante.");
    return NextResponse.json({ ok: false, error: "Configurazione database mancante." }, { status: 503 });
  }

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Una lettura reale e non distruttiva genera attività sul database.
    const { error } = await supabase.from("clients").select("id").limit(1);
    if (error) throw error;

    return NextResponse.json(
      { ok: true, database: "reachable", checkedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Keep-alive database check failed:", error);
    return NextResponse.json({ ok: false, error: "Database non raggiungibile." }, { status: 503 });
  }
}
