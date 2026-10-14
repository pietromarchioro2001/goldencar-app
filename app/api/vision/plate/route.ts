import { NextResponse } from "next/server";

export const runtime = "nodejs";

const VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

function normalize(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/O/g, "0")
    .replace(/I/g, "1")
    .replace(/L/g, "1");
}

function findPlate(text: string) {
  const source = text.toUpperCase().replace(/[^A-Z0-9]/g, " ");
  const compact = source.replace(/\s+/g, " ").trim();
  const tokens = compact.split(/\s+/).filter(Boolean);

  // Cerca direttamente un token del formato italiano:
  // AA123AA
  for (const token of tokens) {
    const value = normalize(token);

    if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(value)) {
      return value;
    }
  }

  // Secondo tentativo:
  // cerca 7 caratteri consecutivi anche se Vision ha inserito
  // spazi o altri caratteri tra le lettere/numeri.
  for (let i = 0; i <= compact.length - 7; i++) {
    const value = normalize(compact.slice(i, i + 7));

    if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(value)) {
      return value;
    }
  }

  return "";
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GOOGLE_VISION_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "GOOGLE_VISION_API_KEY non configurata.",
        },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error: "Manca la foto della targa.",
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const content = buffer.toString("base64");

    const response = await fetch(
      `${VISION_URL}?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content,
              },

              features: [
                {
                  type: "TEXT_DETECTION",
                },
                {
                  type: "DOCUMENT_TEXT_DETECTION",
                },
              ],

              imageContext: {
                languageHints: ["it"],
              },
            },
          ],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
          `Google Vision ha restituito HTTP ${response.status}`
      );
    }

    const result = data?.responses?.[0];

    if (result?.error) {
      throw new Error(
        result.error.message || "Errore Google Vision."
      );
    }

    const text = String(
      result?.fullTextAnnotation?.text ||
        result?.textAnnotations?.[0]?.description ||
        ""
    );

    const plate = findPlate(text);

    return NextResponse.json({
      plate,
      text,
    });
  } catch (error) {
    console.error("PLATE OCR ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Errore durante la lettura della targa.",
      },
      { status: 500 }
    );
  }
}