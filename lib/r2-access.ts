import { createClient } from "@supabase/supabase-js";

type R2Operation = "upload" | "read" | "delete";

function db() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configurazione server Supabase mancante.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function parseJobDetails(value: unknown): Record<string, any> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, any>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function keyParts(key: string) {
  const match = /^veicoli\/([a-zA-Z0-9_-]{1,128})\/(.+)$/.exec(key);
  return match ? { vehicleId: match[1], relative: match[2] } : null;
}

/**
 * Authorize R2 access against persisted vehicle/document/job relationships.
 * Uploads are allowed only in known key formats; reads and deletes require an
 * exact stored reference so a device cannot enumerate or delete arbitrary keys.
 */
export async function isR2KeyAuthorized(key: string, operation: R2Operation): Promise<boolean> {
  // The sales-ad namespace has a separate workflow/schema not yet migrated to
  // record-aware authorization. Preserve it for compatibility; it remains a
  // production blocker and must be migrated before the database lockdown.
  if (key.startsWith("annunci/")) return true;

  const parts = keyParts(key);
  if (!parts) return false;

  const client = db();
  const { vehicleId, relative } = parts;

  if (operation === "upload") {
    if (relative === "libretto-cliente.jpg" || relative === "libretto-veicolo.jpg") {
      const { data: vehicle, error: vehicleError } = await client
        .from("vehicles").select("id").eq("id", vehicleId).maybeSingle();
      if (vehicleError) throw vehicleError;
      if (!vehicle) return true; // New profile: files upload before the vehicle row is saved.

      const { data, error } = await client
        .from("vehicle_documents").select("r2_key")
        .eq("vehicle_id", vehicleId).eq("r2_key", key).maybeSingle();
      if (error) throw error;
      return Boolean(data);
    }

    const { data: vehicle, error: vehicleError } = await client
      .from("vehicles").select("id").eq("id", vehicleId).maybeSingle();
    if (vehicleError) throw vehicleError;
    if (!vehicle) return false;

    if (relative.startsWith("media/")) {
      const { data, error } = await client
        .from("vehicle_media").select("id").eq("r2_key", key).maybeSingle();
      if (error) throw error;
      return !data;
    }

    if (/^media-[a-zA-Z0-9._ -]{1,700}$/.test(relative)) {
      // Job media may be uploaded while the user is still editing a draft.
      // Reads/deletes below still require an exact persisted reference.
      return true;
    }

    const pdfMatch = /^schede\/([a-zA-Z0-9_-]{1,128})\.pdf$/.exec(relative);
    if (pdfMatch) {
      const { data, error } = await client
        .from("jobs").select("id").eq("id", pdfMatch[1]).eq("vehicle_id", vehicleId).maybeSingle();
      if (error) throw error;
      return Boolean(data);
    }

    return false;
  }

  const { data: vehicleMedia, error: mediaError } = await client
    .from("vehicle_media").select("id").eq("r2_key", key).maybeSingle();
  if (mediaError) throw mediaError;
  if (vehicleMedia) return true;

  const { data: vehicleDocument, error: documentError } = await client
    .from("vehicle_documents").select("id").eq("vehicle_id", vehicleId).eq("r2_key", key).maybeSingle();
  if (documentError) throw documentError;
  if (vehicleDocument) return true;

  const { data: jobs, error: jobsError } = await client
    .from("jobs").select("dettagli").eq("vehicle_id", vehicleId);
  if (jobsError) throw jobsError;
  return (jobs ?? []).some((job: any) => {
    const details = parseJobDetails(job.dettagli);
    if (details.pdfR2Key === key) return true;
    return Array.isArray(details.media) && details.media.some((item: any) => item?.r2Key === key);
  });
}
