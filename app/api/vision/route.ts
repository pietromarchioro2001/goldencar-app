import { NextResponse } from "next/server";

export const runtime = "nodejs";

const VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

async function fileToBase64(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return buffer.toString("base64");
}

async function analyzeImage(file: File, apiKey: string) {
  const content = await fileToBase64(file);

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
    console.error("GOOGLE VISION ERROR:", data);

    throw new Error(
      data?.error?.message ||
        `Google Vision ha restituito HTTP ${response.status}`
    );
  }

  const result = data?.responses?.[0];

  if (result?.error) {
    throw new Error(
      result.error.message || "Errore restituito da Google Vision."
    );
  }

  const text = String(result?.fullTextAnnotation?.text || "");
  const textAnnotations = Array.isArray(result?.textAnnotations) ? result.textAnnotations : [];
  const rawWords = textAnnotations.slice(1).map((item: any) => {
    const vertices = item?.boundingPoly?.vertices || [];
    const xs = vertices.map((v: any) => Number(v?.x || 0));
    const ys = vertices.map((v: any) => Number(v?.y || 0));
    const minX = xs.length ? Math.min(...xs) : 0;
    const maxX = xs.length ? Math.max(...xs) : minX;
    const minY = ys.length ? Math.min(...ys) : 0;
    const maxY = ys.length ? Math.max(...ys) : minY;
    return {
      text: String(item?.description || ""),
      x: minX,
      y: minY,
      width: Math.max(0, maxX - minX),
      height: Math.max(0, maxY - minY),
    };
  }).filter((w: any) => w.text);

  // Le coordinate di Vision sono in pixel. Le normalizziamo a 0..1 così il
  // client può ragionare sulla posizione nella pagina indipendentemente dalla
  // risoluzione della foto.
  const imageWidth = Math.max(1, ...rawWords.map((w: any) => w.x + w.width));
  const imageHeight = Math.max(1, ...rawWords.map((w: any) => w.y + w.height));
  const words = rawWords.map((w: any) => ({
    ...w,
    x: w.x / imageWidth,
    y: w.y / imageHeight,
    width: w.width / imageWidth,
    height: w.height / imageHeight,
  }));

  return { text, words };
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

    const photo1 = formData.get("photo1");
    const photo1Top = formData.get("photo1Top");
    const photo1TopRight = formData.get("photo1TopRight");
    const photo1B = formData.get("photo1B");
    const photo2 = formData.get("photo2");
    const photo2B = formData.get("photo2B");

    if (!(photo1 instanceof File) || !(photo2 instanceof File)) {
      return NextResponse.json(
        {
          error: "Servono entrambe le foto del libretto.",
        },
        { status: 400 }
      );
    }

    const [clientResult, vehicleResult] = await Promise.all([
      analyzeImage(photo1, apiKey),
      analyzeImage(photo2, apiKey),
    ]);

    const clientTextBase = clientResult.text;
    const vehicleText = vehicleResult.text;

    // La prima foto contiene anche il campo B (prima immatricolazione).
    // Su alcuni libretti il testo è troppo piccolo perché DOCUMENT_TEXT_DETECTION
    // lo riporti nel fullText principale. Se disponibili, OCRizziamo due ritagli
    // della fascia alta e li aggiungiamo al testo della prima foto.
    // OCR dei ritagli: B viene analizzata separatamente e NON viene mescolata
    // al testo generale. Questo evita che le date di nascita o altri campi
    // vengano confuse con la prima immatricolazione.
    const [topResult, topRightResult, bRegionResult1, bRegionResult2] = await Promise.all([
      photo1Top instanceof File ? analyzeImage(photo1Top, apiKey) : { text: "", words: [] },
      photo1TopRight instanceof File ? analyzeImage(photo1TopRight, apiKey) : { text: "", words: [] },
      photo1B instanceof File ? analyzeImage(photo1B, apiKey) : { text: "", words: [] },
      photo2B instanceof File ? analyzeImage(photo2B, apiKey) : { text: "", words: [] },
    ]);

    const clientText = [clientTextBase, topResult.text, topRightResult.text]
      .filter(Boolean)
      .join("\n\n--- OCR RITAGLIO ---\n\n");

    return NextResponse.json({
      // Manteniamo separati i due OCR originali: il client può capire quale
      // foto è la pagina anagrafica e quale è quella tecnica. Questo rende
      // l'analisi robusta anche se le due foto arrivano invertite o il layout
      // del libretto cambia.
      photo1Text: clientResult.text,
      photo1Words: clientResult.words,
      photo2Text: vehicleResult.text,
      photo2Words: vehicleResult.words,

      // Compatibilità con le versioni precedenti.
      clientText,
      vehicleText,
      clientWords: clientResult.words,
      vehicleWords: vehicleResult.words,

      // Risultato SEPARATO del ritaglio B.
      clientBText: bRegionResult1.text,
      clientBWords: bRegionResult1.words,
      photo1BText: bRegionResult1.text,
      photo1BWords: bRegionResult1.words,
      photo2BText: bRegionResult2.text,
      photo2BWords: bRegionResult2.words,
      registrationText: bRegionResult1.text,
    });
  } catch (error) {
    console.error("OCR VISION ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Errore inatteso durante OCR Vision.",
      },
      { status: 500 }
    );
  }
}