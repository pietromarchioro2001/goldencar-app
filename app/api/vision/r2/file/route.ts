import { NextResponse } from "next/server";
import {
  createDownloadUrl,
  createUploadUrl,
  deleteR2Object,
} from "@/lib/r2-presigned";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const key =
      typeof body.key === "string" ? body.key : "";

    const contentType =
      typeof body.contentType === "string"
        ? body.contentType
        : "application/octet-stream";

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
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key") || "";

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

    const key =
      typeof body.key === "string" ? body.key : "";

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