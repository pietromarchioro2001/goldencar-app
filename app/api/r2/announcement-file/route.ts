import { isDeviceRequestAuthorized } from "@/lib/device-auth";
import { createUploadUrl, deleteR2Object } from "@/lib/r2-presigned";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// The sales screen currently persists listing metadata in this browser's
// localStorage/IndexedDB, so there is no server-side record to authorize against.
// Keep this endpoint isolated from generic R2 access and fail closed on every
// key outside the one documented photo-key format. This is NOT record ownership;
// migrate listings to server-side records before Production.
function validAnnouncementPhotoKey(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 1024) return false;
  return /^annunci\/[a-zA-Z0-9_-]{1,128}\/foto-[a-zA-Z0-9_-]{1,128}-[a-zA-Z0-9._-]{1,200}$/.test(value);
}

export async function POST(request: Request) {
  if (!(await isDeviceRequestAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "Accesso non autorizzato." }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => null);
    if (!body || !validAnnouncementPhotoKey(body.key)) {
      return NextResponse.json({ ok: false, error: "Chiave foto annuncio non valida." }, { status: 400 });
    }
    const contentType = typeof body.contentType === "string" && body.contentType.trim()
      ? body.contentType.trim()
      : "image/jpeg";
    if (contentType.length > 200 || /[\r\n]/.test(contentType) || !contentType.toLowerCase().startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "Tipo immagine non valido." }, { status: 400 });
    }
    const uploadUrl = await createUploadUrl(body.key, contentType);
    return NextResponse.json({ ok: true, uploadUrl, key: body.key });
  } catch (error) {
    console.error("Announcement photo upload URL error:", error);
    return NextResponse.json({ ok: false, error: "Impossibile preparare il caricamento della foto." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isDeviceRequestAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "Accesso non autorizzato." }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => null);
    if (!body || !validAnnouncementPhotoKey(body.key)) {
      return NextResponse.json({ ok: false, error: "Chiave foto annuncio non valida." }, { status: 400 });
    }
    await deleteR2Object(body.key);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Announcement photo deletion error:", error);
    return NextResponse.json({ ok: false, error: "Impossibile eliminare la foto dell'annuncio." }, { status: 400 });
  }
}
