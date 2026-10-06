import { NextResponse } from "next/server";
import { r2Request } from "@/lib/r2";

export const runtime = "nodejs";

export async function GET() {
  try {
    const response = await r2Request("HEAD");

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      console.error("R2 TEST ERROR:", response.status, details);

      return NextResponse.json(
        {
          ok: false,
          error: `R2 ha restituito HTTP ${response.status}.`,
          details: details || undefined,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Connessione a Cloudflare R2 riuscita.",
    });
  } catch (error) {
    console.error("R2 TEST ERROR:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Errore inatteso durante il test R2.",
      },
      { status: 500 }
    );
  }
}
