import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RawClient = Record<string, unknown>;
type RawVehicle = Record<string, unknown>;

function supabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Configurazione Supabase mancante.");
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

export async function GET() {
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
          error instanceof Error
            ? error.message
            : "Errore caricamento veicoli.",
      },
      { status: 500 }
    );
  }
}
