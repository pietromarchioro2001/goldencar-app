import { isDeviceRequestAuthorized } from "@/lib/device-auth";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Category = "TAGLIANDO" | "FRENI" | "RICAMBI";
const categories = new Set<Category>(["TAGLIANDO", "FRENI", "RICAMBI"]);

function db() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configurazione server Supabase mancante.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function fail(error: unknown) {
  const config = error instanceof Error && error.message === "Configurazione server Supabase mancante.";
  if (!config) console.error("Product catalog API:", error);
  return NextResponse.json({ ok: false, error: config ? error.message : "Errore durante l'accesso al catalogo prodotti." }, { status: config ? 503 : 500 });
}

export async function GET(request: Request) {
  if (!(await isDeviceRequestAuthorized(request))) return NextResponse.json({ ok: false, error: "Accesso non autorizzato." }, { status: 401 });
  const category = new URL(request.url).searchParams.get("category") || "TAGLIANDO";
  if (!categories.has(category as Category)) return NextResponse.json({ ok: false, error: "Categoria non valida." }, { status: 400 });
  try {
    const { data, error } = await db().from("product_catalog").select("id, category, name").eq("category", category).eq("active", true).order("name", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ ok: true, products: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return fail(error); }
}

export async function POST(request: Request) {
  if (!(await isDeviceRequestAuthorized(request))) return NextResponse.json({ ok: false, error: "Accesso non autorizzato." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const category = body?.category;
  const name = typeof body?.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  if (!categories.has(category as Category) || !name || name.length > 120) return NextResponse.json({ ok: false, error: "Nome prodotto o categoria non validi." }, { status: 400 });
  try {
    const client = db();
    const { data, error } = await client.from("product_catalog").upsert(
      { category, name, active: true },
      { onConflict: "category,normalized_name", ignoreDuplicates: true }
    ).select("id, category, name").maybeSingle();
    if (error) throw error;
    if (data) return NextResponse.json({ ok: true, product: data }, { status: 201 });
    const existing = await client.from("product_catalog").select("id, category, name").eq("category", category).eq("normalized_name", name.toLowerCase()).maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) throw new Error("Il prodotto non è stato salvato nel catalogo.");
    if (!existing.data.name || existing.data.name !== name) {
      const updated = await client.from("product_catalog").update({ active: true }).eq("id", existing.data.id).select("id, category, name").single();
      if (updated.error) throw updated.error;
      return NextResponse.json({ ok: true, product: updated.data }, { status: 200 });
    }
    return NextResponse.json({ ok: true, product: existing.data }, { status: 200 });
  } catch (error) { return fail(error); }
}
