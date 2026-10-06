import { NextResponse } from "next/server";
import {
  r2PutObject,
  r2GetObject,
  r2DeleteObject,
} from "@/lib/r2";

export const runtime = "nodejs";

const TEST_KEY = "__test__/goldencar-r2-test.txt";
const TEST_CONTENT = "Goldencar R2 test OK";

export async function GET() {
  try {
    // 1. SCRITTURA
    const putResponse = await r2PutObject(
      TEST_KEY,
      Buffer.from(TEST_CONTENT, "utf-8"),
      "text/plain; charset=utf-8"
    );

    if (!putResponse.ok) {
      const details = await putResponse.text().catch(() => "");

      return NextResponse.json(
        {
          ok: false,
          step: "PUT",
          error: `R2 ha restituito HTTP ${putResponse.status}.`,
          details: details || undefined,
        },
        { status: 502 }
      );
    }

    // 2. LETTURA
    const getResponse = await r2GetObject(TEST_KEY);

    if (!getResponse.ok) {
      const details = await getResponse.text().catch(() => "");

      return NextResponse.json(
        {
          ok: false,
          step: "GET",
          error: `R2 ha restituito HTTP ${getResponse.status}.`,
          details: details || undefined,
        },
        { status: 502 }
      );
    }

    const content = await getResponse.text();

    if (content !== TEST_CONTENT) {
      return NextResponse.json(
        {
          ok: false,
          step: "VERIFY",
          error: "Il contenuto letto da R2 non corrisponde a quello scritto.",
        },
        { status: 502 }
      );
    }

    // 3. CANCELLAZIONE
    const deleteResponse = await r2DeleteObject(TEST_KEY);

    if (!deleteResponse.ok) {
      const details = await deleteResponse.text().catch(() => "");

      return NextResponse.json(
        {
          ok: false,
          step: "DELETE",
          error: `R2 ha restituito HTTP ${deleteResponse.status}.`,
          details: details || undefined,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Test completo R2 riuscito.",
      steps: {
        put: "OK",
        get: "OK",
        verify: "OK",
        delete: "OK",
      },
    });
  } catch (error) {
    console.error("R2 WRITE TEST ERROR:", error);

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