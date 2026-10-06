import { NextResponse } from "next/server";
import {
  createDownloadUrl,
  createUploadUrl,
  deleteR2Object,
} from "@/lib/r2-presigned";

export const runtime = "nodejs";

function cleanKey(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/^\/+/, "") : "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const key = cleanKey(body?.key);
    const contentType =
      typeof body?.contentType === "string" && body.contentType.trim()
        ? body.contentType.trim()
        : "application/octet-stream";

    if (!key) {
      return NextResponse.json(
        { ok: false, error: "Chiave R2 mancante." },
        { status: 400 }
      );
    }

    if (contentType.length > 200 || contentType.includes("\r") || contentType.includes("\n")) {
      return NextResponse.json(
        { ok: false, error: "Content-Type non valido." },
        { status: 400 }
      );
    }

    const uploadUrl = await createUploadUrl(key, contentType);

    return NextResponse.json({
      ok: true,
      uploadUrl,
      key,
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
  try {
    const { searchParams } = new URL(request.url);
    const key = cleanKey(searchParams.get("key"));

    if (!key) {
      return NextResponse.json(
        { ok: false, error: "Chiave R2 mancante." },
        { status: 400 }
      );
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
  try {
    const body = await request.json();
    const key = cleanKey(body?.key);

    if (!key) {
      return NextResponse.json(
        { ok: false, error: "Chiave R2 mancante." },
        { status: 400 }
      );
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
