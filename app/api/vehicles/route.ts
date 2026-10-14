import { isDeviceRequestAuthorized } from "@/lib/device-auth";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RawClient = Record<string, unknown>;
type RawVehicle = Record<string, unknown>;

function supabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Configurazione server Supabase mancante.");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

function mapClient(client: RawClient | null) {
  if (!client) return null;

  return {
    id: text(client.id),
    nome: text(client.nome),
    cognome: text(client.cognome),
    luogoNascita: text(client.luogo_nascita ?? client.luogoNascita),
    provinciaNascita: text(client.provincia_nascita ?? client.provinciaNascita),
    indirizzo: text(client.indirizzo),
    telefono: text(client.telefono),
    nascita: text(client.data_nascita ?? client.nascita),
    cf: text(client.codice_fiscale ?? client.cf),
  };
}

function mapVehicle(vehicle: RawVehicle, clientsById: Map<string, RawClient>) {
  const primary = vehicle.client_id
    ? clientsById.get(text(vehicle.client_id)) ?? null
    : null;

  return {
    id: text(vehicle.id),
    cliente1: mapClient(primary),
    cliente2: null,
    veicolo: {
      veicolo: text(vehicle.veicolo),
      motore: text(vehicle.motore),
      targa: text(vehicle.targa).toUpperCase(),
      immatricolazione: text(vehicle.immatricolazione),
      revisione: text(vehicle.revisione),
    },
  };
}

export async function GET(request: Request) {
  if (!(await isDeviceRequestAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "Accesso non autorizzato." }, { status: 401 });
  }
  try {
    const db = supabase();

    const [vehiclesResult, clientsResult, relationsResult] = await Promise.all([
      db.from("vehicles").select("*"),
      db.from("clients").select("*"),
      db.from("vehicle_clients").select("vehicle_id, client_id, ruolo"),
    ]);

    if (vehiclesResult.error) throw vehiclesResult.error;
    if (clientsResult.error) throw clientsResult.error;

    const clients = (clientsResult.data ?? []) as RawClient[];
    const clientsById = new Map(clients.map((client) => [text(client.id), client]));

    const relations = relationsResult.error ? [] : relationsResult.data ?? [];

    const profiles = (vehiclesResult.data ?? []).map((vehicle) => {
      const profile = mapVehicle(vehicle as RawVehicle, clientsById);
      const vehicleRelations = relations.filter(
        (relation) => text(relation.vehicle_id) === profile.id
      );

      const primaryRelation =
        vehicleRelations.find((relation) => relation.ruolo === "PRINCIPALE") ??
        vehicleRelations[0];

      const secondaryRelation = vehicleRelations.find(
        (relation) => relation.ruolo === "SECONDO"
      );

      const primaryClient =
        primaryRelation?.client_id
          ? clientsById.get(text(primaryRelation.client_id)) ?? null
          : null;

      const secondaryClient =
        secondaryRelation?.client_id
          ? clientsById.get(text(secondaryRelation.client_id)) ?? null
          : null;

      return {
        ...profile,
        cliente1: mapClient(primaryClient) ?? profile.cliente1,
        cliente2: mapClient(secondaryClient),
      };
    });

    return NextResponse.json({
      ok: true,
      profiles,
      count: profiles.length,
    });
  } catch (error) {
    console.error("Errore GET /api/vehicles:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error && error.message === "Configurazione server Supabase mancante."
            ? error.message
            : "Errore caricamento veicoli.",
      },
      { status: 500 }
    );
  }
}


export async function PATCH(request: Request) {
  if (!(await isDeviceRequestAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "Accesso non autorizzato." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: "Corpo della richiesta non valido." }, { status: 400 });
    }

    const vehicleId = typeof body.vehicleId === "string" ? body.vehicleId.trim() : "";
    const client1Id = typeof body.client1Id === "string" ? body.client1Id.trim() : "";
    const client2Id = typeof body.client2Id === "string" ? body.client2Id.trim() : "";
    const client1 = body.client1 && typeof body.client1 === "object" && !Array.isArray(body.client1) ? body.client1 : null;
    const client2 = body.client2 && typeof body.client2 === "object" && !Array.isArray(body.client2) ? body.client2 : null;
    const vehicle = body.vehicle && typeof body.vehicle === "object" && !Array.isArray(body.vehicle) ? body.vehicle : null;

    const validId = (id: string) => Boolean(id && id.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(id));
    const clean = (value: unknown, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";
    if (!validId(vehicleId) || !validId(client1Id) || !client1 || !vehicle) {
      return NextResponse.json({ ok: false, error: "Dati del profilo incompleti o non validi." }, { status: 400 });
    }
    if (client2Id && !validId(client2Id)) {
      return NextResponse.json({ ok: false, error: "ID Cliente 2 non valido." }, { status: 400 });
    }

    const db = supabase();
    const clientFields = (value: Record<string, unknown>) => ({
      nome: [clean(value.nome, 120), clean(value.cognome, 120)].filter(Boolean).join(" "),
      indirizzo: clean(value.indirizzo, 300),
      telefono: clean(value.telefono, 60),
      data_nascita: clean(value.nascita, 30) || null,
      codice_fiscale: clean(value.cf, 32).toUpperCase(),
    });

    const { data: existingVehicle, error: vehicleCheckError } = await db.from("vehicles").select("id").eq("id", vehicleId).maybeSingle();
    if (vehicleCheckError) throw vehicleCheckError;
    if (!existingVehicle) return NextResponse.json({ ok: false, error: "Veicolo non trovato." }, { status: 404 });

    const { data: existingClient, error: clientCheckError } = await db.from("clients").select("id").eq("id", client1Id).maybeSingle();
    if (clientCheckError) throw clientCheckError;
    if (!existingClient) return NextResponse.json({ ok: false, error: "Cliente 1 non trovato." }, { status: 404 });

    const { error: client1Error } = await db.from("clients").update(clientFields(client1)).eq("id", client1Id);
    if (client1Error) throw client1Error;

    if (client2 && client2Id) {
      const { data: existingClient2, error: client2CheckError } = await db.from("clients").select("id").eq("id", client2Id).maybeSingle();
      if (client2CheckError) throw client2CheckError;
      if (!existingClient2) return NextResponse.json({ ok: false, error: "Cliente 2 non trovato." }, { status: 404 });
      const { error: client2Error } = await db.from("clients").update(clientFields(client2)).eq("id", client2Id);
      if (client2Error) throw client2Error;
    }

    const { error: updateVehicleError } = await db.from("vehicles").update({
      veicolo: clean(vehicle.veicolo, 160),
      motore: clean(vehicle.motore, 160),
      targa: clean(vehicle.targa, 24).toUpperCase(),
      immatricolazione: clean(vehicle.immatricolazione, 30) || null,
      revisione: clean(vehicle.revisione, 30) || null,
    }).eq("id", vehicleId);
    if (updateVehicleError) throw updateVehicleError;
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Configurazione server Supabase mancante.") {
      return NextResponse.json({ ok: false, error: message }, { status: 503 });
    }
    console.error("Errore PATCH /api/vehicles:", error);
    return NextResponse.json({ ok: false, error: "Errore salvataggio profilo veicolo." }, { status: 500 });
  }
}
