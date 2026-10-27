import { isDeviceRequestAuthorized } from "@/lib/device-auth";
import { isR2KeyAuthorized } from "@/lib/r2-access";
import { NextResponse } from "next/server";
import {
  createDownloadUrl,
  createUploadUrl,
  deleteR2Object,
} from "@/lib/r2-presigned";

export const runtime = "nodejs";

function cleanKey(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/^[/]+/, "") : "";
}
function validContentType(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 200 && !value.includes("\r") && !value.includes("\n");
}

export async function POST(request: Request) {
  if (!(await isDeviceRequestAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "Accesso non autorizzato." }, { status: 401 });
  }
  try {
    const body = await request.json();

    const key = cleanKey(body?.key);

    const contentType = body?.contentType == null ? "application/octet-stream" : body.contentType;
    if (!key || !validContentType(contentType)) return NextResponse.json({ ok: false, error: "Chiave R2 o Content-Type non valido." }, { status: 400 });

    if (!(await isR2KeyAuthorized(key, "upload"))) {
      return NextResponse.json({ ok: false, error: "La chiave non è autorizzata per questo file." }, { status: 403 });
    }
    const uploadUrl = await createUploadUrl(key, contentType);

    return NextResponse.json({
      ok: true,
      uploadUrl,
      key: key.trim().replace(/^\/+/, ""),
    });
  } catch (error) {
    console.error("R2 UPLOAD URL ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore nella generazione dell'URL di upload.",
      },
      { status: 400 }
    );
  }
}

export async function GET(request: Request) {
  if (!(await isDeviceRequestAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "Accesso non autorizzato." }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const key = cleanKey(searchParams.get("key"));
    if (!key) return NextResponse.json({ ok: false, error: "Chiave R2 mancante." }, { status: 400 });

    if (!(await isR2KeyAuthorized(key, "read"))) {
      return NextResponse.json({ ok: false, error: "File non associato a un record autorizzato." }, { status: 403 });
    }
    const downloadUrl = await createDownloadUrl(key);

    return NextResponse.json({
      ok: true,
      downloadUrl,
    });
  } catch (error) {
    console.error("R2 DOWNLOAD URL ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore nella generazione dell'URL di download.",
      },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  if (!(await isDeviceRequestAuthorized(request))) {
    return NextResponse.json({ ok: false, error: "Accesso non autorizzato." }, { status: 401 });
  }
  try {
    const body = await request.json();

    const key = cleanKey(body?.key);
    if (!key) return NextResponse.json({ ok: false, error: "Chiave R2 mancante." }, { status: 400 });

    if (!(await isR2KeyAuthorized(key, "delete"))) {
      return NextResponse.json({ ok: false, error: "Eliminazione non autorizzata per questo file." }, { status: 403 });
    }
    await deleteR2Object(key);

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error("R2 DELETE ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore durante l'eliminazione del file.",
      },
      { status: 400 }
    );
  }
}