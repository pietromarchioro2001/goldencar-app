import { isDeviceRequestAuthorized } from "@/lib/device-auth";
import { createUploadUrl, deleteR2Object } from "@/lib/r2-presigned";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Sales listing metadata remains browser-local by design for this security pass.
// Per-listing ownership is intentionally out of scope: this endpoint limits access
// to the annunci/ photo-key format, requires the device session, and allows only
// raster image types. Keep it isolated from generic vehicle/document R2 access.
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
    const allowedImageTypes = new Set([
      "image/jpeg", "image/png", "image/webp", "image/avif",
      "image/gif", "image/bmp", "image/heic", "image/heif",
    ]);
    if (contentType.length > 200 || /[\r\n]/.test(contentType) || !allowedImageTypes.has(contentType.toLowerCase())) {
      return NextResponse.json({ ok: false, error: "Formato immagine non consentito." }, { status: 400 });
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
