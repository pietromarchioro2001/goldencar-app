"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import BottomBar from "@/components/BottomBar";

type ClienteData = {
  nome: string; cognome: string; luogoNascita: string; provinciaNascita: string;
  indirizzo: string; telefono: string; nascita: string; cf: string;
};
type VeicoloData = { veicolo: string; motore: string; targa: string; immatricolazione: string; revisione: string; };
type FormData = ClienteData & VeicoloData;
type ClienteSelezionato = 1 | 2;
type VisionWord = { text: string; x: number; y: number; width: number; height: number };

export default function NuovoProfiloPage() {
  const router = useRouter();
  const open = true;
  const setOpen = (value: boolean) => {
    if (!value) router.back();
  };

  // Nuovo profilo

  const [showCliente2, setShowCliente2] = useState(false);

  const fileInputFallbackRef = useRef<HTMLInputElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const capturedClientFileRef = useRef<File | null>(null);
  const [fileCliente, setFileCliente] = useState<File | null>(null);
  const [fileVeicolo, setFileVeicolo] = useState<File | null>(null);

  const [analisiInCorso, setAnalisiInCorso] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrErrore, setOcrErrore] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStep, setCameraStep] = useState<1 | 2>(1);
  const [fotoCliente, setFotoCliente] = useState("");
  const [fotoVeicolo, setFotoVeicolo] = useState("");
  const [statoScansioneCliente, setStatoScansioneCliente] =
    useState<"idle" | "analisi" | "ok" | "errore">("idle");
  const [statoScansioneVeicolo, setStatoScansioneVeicolo] =
    useState<"idle" | "analisi" | "ok" | "errore">("idle");



  const [form, setForm] = useState<FormData>({

    nome: "",
    cognome: "",
    luogoNascita: "",
    provinciaNascita: "",
    indirizzo: "",
    telefono: "",
    nascita: "",
    cf: "",

    veicolo: "",

    motore: "",

    targa: "",

    immatricolazione: "",

    revisione: "",

  });



  const [cliente2, setCliente2] = useState<ClienteData>({

    nome: "",
    cognome: "",
    luogoNascita: "",
    provinciaNascita: "",
    indirizzo: "",
    telefono: "",
    nascita: "",
    cf: "",

  });

  useEffect(() => {
    try {
      const plate = sessionStorage.getItem("goldencar_checkin_targa");
      if (plate) {
        setForm((prev) => ({ ...prev, targa: plate.toUpperCase() }));
      }
    } catch {
      // sessionStorage non disponibile: nessun precompilamento.
    }
  }, []);



  const update = (campo: keyof FormData, valore: string) => {
    setForm((prev) => ({ ...prev, [campo]: valore }));
  };

  const updateCliente2 = (campo: keyof ClienteData, valore: string) => {
    setCliente2((prev) => ({ ...prev, [campo]: valore }));
  };

  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraOpen(false);
  };

  const apriScanner = async () => {
    if (analisiInCorso) return;

    setOcrErrore("");
    setOcrProgress(0);
    setFotoCliente("");
    setFotoVeicolo("");
    setFileCliente(null);
    setFileVeicolo(null);
    setStatoScansioneCliente("idle");
    setStatoScansioneVeicolo("idle");
    capturedClientFileRef.current = null;
    setCameraStep(1);

    if (!navigator.mediaDevices?.getUserMedia) {
      setOcrErrore("La fotocamera interna non è disponibile su questo dispositivo. Usa la galleria.");
      fileInputFallbackRef.current?.click();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      cameraStreamRef.current = stream;
      setCameraOpen(true);
    } catch (error) {
      console.error("Errore accesso fotocamera:", error);
      setOcrErrore("Non posso accedere alla fotocamera. Puoi usare la galleria.");
    }
  };

  const creaRitaglioOcr = async (file: File, x: number, y: number, width: number, height: number, nome: string): Promise<File> => {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Impossibile preparare il ritaglio OCR."));
        image.src = url;
      });

      const sx = Math.max(0, Math.floor(img.naturalWidth * x));
      const sy = Math.max(0, Math.floor(img.naturalHeight * y));
      const sw = Math.max(1, Math.min(img.naturalWidth - sx, Math.floor(img.naturalWidth * width)));
      const sh = Math.max(1, Math.min(img.naturalHeight - sy, Math.floor(img.naturalHeight * height)));

      // Ingrandiamo il ritaglio: il campo B è piccolo e nella zona alta del primo foglio.
      const scale = 3.5;
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(5000, Math.max(1200, Math.round(sw * scale)));
      canvas.height = Math.min(5000, Math.max(900, Math.round(sh * scale)));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Impossibile preparare il ritaglio OCR.");

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.98)
      );
      if (!blob) throw new Error("Impossibile creare il ritaglio OCR.");
      return new File([blob], nome, { type: "image/jpeg" });
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const runCombinedScan = async (clientFile: File, vehicleFile: File) => {
    setAnalisiInCorso(true);
    setOcrProgress(0);
    setOcrErrore("");
    setStatoScansioneCliente("analisi");
    setStatoScansioneVeicolo("analisi");

    try {
      const data = new FormData();

      // OCR principale delle DUE pagine.
      // Per essere davvero flessibili non assumiamo che la pagina anagrafica
      // sia sempre la prima: alcuni libretti/ordini di acquisizione possono
      // arrivare invertiti. Per questo prepariamo una piccola vista B per
      // ENTRAMBE le foto e poi, dopo l'OCR, associamo quella corretta alla
      // pagina che Vision riconosce come anagrafica.
      const clientTop = await creaRitaglioOcr(
        clientFile,
        0, 0, 1, 0.52,
        "libretto-pagina1-top.jpg"
      );
      const clientTopRight = await creaRitaglioOcr(
        clientFile,
        0.42, 0, 0.58, 0.70,
        "libretto-pagina1-top-right.jpg"
      );
      const photo1B = await creaRitaglioOcr(
        clientFile,
        0.00, 0.08, 0.72, 0.46,
        "libretto-pagina1-B.jpg"
      );
      const photo2B = await creaRitaglioOcr(
        vehicleFile,
        0.00, 0.08, 0.72, 0.46,
        "libretto-pagina2-B.jpg"
      );

      data.append("photo1", clientFile);
      data.append("photo1Top", clientTop);
      data.append("photo1TopRight", clientTopRight);
      data.append("photo1B", photo1B);
      data.append("photo2", vehicleFile);
      data.append("photo2B", photo2B);

      setOcrProgress(10);

      const response = await fetch("/api/vision", {
        method: "POST",
        body: data,
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          payload?.error || `OCR Vision ha restituito HTTP ${response.status}.`
        );
      }

      setOcrProgress(35);

      const photo1Text = String(payload?.photo1Text || payload?.clientText || "");
      const photo2Text = String(payload?.photo2Text || payload?.vehicleText || "");
      const photo1Words = Array.isArray(payload?.photo1Words)
        ? (payload.photo1Words as VisionWord[])
        : Array.isArray(payload?.clientWords)
          ? (payload.clientWords as VisionWord[])
          : [];
      const photo2Words = Array.isArray(payload?.photo2Words)
        ? (payload.photo2Words as VisionWord[])
        : Array.isArray(payload?.vehicleWords)
          ? (payload.vehicleWords as VisionWord[])
          : [];
      const photo1BText = String(payload?.photo1BText || payload?.clientBText || "");
      const photo2BText = String(payload?.photo2BText || "");
      const photo1BWords = Array.isArray(payload?.photo1BWords)
        ? (payload.photo1BWords as VisionWord[])
        : Array.isArray(payload?.clientBWords)
          ? (payload.clientBWords as VisionWord[])
          : [];
      const photo2BWords = Array.isArray(payload?.photo2BWords)
        ? (payload.photo2BWords as VisionWord[])
        : [];

      // NON assumiamo più che la prima foto sia sempre la pagina anagrafica.
      // Libretti diversi/rotazioni/camera possono arrivare invertiti.
      // Classifichiamo le due pagine in base ai codici realmente presenti.
      const clientScore = (text: string) => {
        const t = normalizeOcrText(text);
        return (t.match(/C\s*\.?\s*2\s*\.?\s*[123]/gi)?.length || 0) * 8
          + (t.match(/NAT[O0]\s+IL/gi)?.length || 0) * 6
          + (t.match(/COMPR/gi)?.length || 0) * 4
          + (t.match(/CODICE\s+FISCALE|CODICE|FISCALE/gi)?.length || 0) * 2;
      };
      const vehicleScore = (text: string) => {
        const t = normalizeOcrText(text);
        return (t.match(/D\s*\.?\s*[123]/gi)?.length || 0) * 7
          + (t.match(/P\s*\.?\s*[13]/gi)?.length || 0) * 5
          + (t.match(/\(\s*A\s*\)|^A\s+/gim)?.length || 0) * 2
          + (t.match(/\(\s*I\s*\)|^I\s+/gim)?.length || 0) * 2
          + (t.match(/J\.1|J\.2|K\b/gi)?.length || 0) * 2
          + (t.match(/F\.1|F\.2|N\.2|N\.3/gi)?.length || 0);
      };

      const clientIsPhoto1 = clientScore(photo1Text) >= clientScore(photo2Text);
      const clientText = clientIsPhoto1 ? photo1Text : photo2Text;
      const vehicleText = clientIsPhoto1 ? photo2Text : photo1Text;
      const clientWords = clientIsPhoto1 ? photo1Words : photo2Words;
      const vehicleWords = clientIsPhoto1 ? photo2Words : photo1Words;
      const clientBText = clientIsPhoto1 ? photo1BText : photo2BText;
      const clientBWords = clientIsPhoto1 ? photo1BWords : photo2BWords;

      const risultatoCliente = parseVisionClientPanel(
        clientText,
        clientWords,
        clientBText,
        clientBWords
      );
      const risultatoVeicolo = parseVisionVehiclePanel(vehicleText);

      validateVisionResult(
        risultatoCliente.cliente1,
        risultatoCliente.cliente2,
        risultatoVeicolo.veicolo
      );

      setForm((prev) => ({
        ...prev,
        nome: risultatoCliente.cliente1.nome || prev.nome,
        cognome: risultatoCliente.cliente1.cognome || prev.cognome,
        luogoNascita:
          risultatoCliente.cliente1.luogoNascita || prev.luogoNascita,
        provinciaNascita:
          risultatoCliente.cliente1.provinciaNascita || prev.provinciaNascita,
        indirizzo: risultatoCliente.cliente1.indirizzo || prev.indirizzo,
        nascita: risultatoCliente.cliente1.nascita || prev.nascita,
        cf: risultatoCliente.cliente1.cf || prev.cf,
        immatricolazione:
          risultatoCliente.immatricolazione || prev.immatricolazione,
        veicolo: risultatoVeicolo.veicolo.veicolo || prev.veicolo,
        motore: risultatoVeicolo.veicolo.motore || prev.motore,
        targa: risultatoVeicolo.veicolo.targa || prev.targa,
      }));

      setOcrProgress(60);

      if (risultatoCliente.cliente2) {
        setCliente2(risultatoCliente.cliente2);
        setShowCliente2(true);
      } else {
        setCliente2({
          nome: "",
          cognome: "",
          luogoNascita: "",
          provinciaNascita: "",
          indirizzo: "",
          telefono: "",
          nascita: "",
                cf: "",
        });
        setShowCliente2(false);
      }

      setStatoScansioneCliente("ok");
      setOcrProgress(82);
      setStatoScansioneVeicolo("ok");
      setOcrProgress(100);
    } catch (error) {
      console.error("Errore scansione Vision:", error);
      setStatoScansioneCliente("errore");
      setStatoScansioneVeicolo("errore");
      setOcrErrore(
        error instanceof Error
          ? error.message
          : "Non sono riuscito a leggere il libretto."
      );
      throw error;
    } finally {
      setAnalisiInCorso(false);
    }
  };

  const scattaFotoScanner = async () => {
    if (!cameraVideoRef.current || analisiInCorso) return;

    const video = cameraVideoRef.current;
    if (!video.videoWidth || !video.videoHeight) {
      setOcrErrore("La fotocamera non è ancora pronta. Attendi un secondo e riprova.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      setOcrErrore("Impossibile acquisire la foto.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.96)
    );

    if (!blob) {
      setOcrErrore("Impossibile creare la foto.");
      return;
    }

    const file = new File(
      [blob],
      cameraStep === 1 ? "libretto-cliente.jpg" : "libretto-veicolo.jpg",
      { type: "image/jpeg" }
    );

    const preview = URL.createObjectURL(blob);

    if (cameraStep === 1) {
      capturedClientFileRef.current = file;
      setFileCliente(file);
      setFotoCliente(preview);
      setStatoScansioneCliente("analisi");
      setCameraStep(2);
      return;
    }

    setFotoVeicolo(preview);
    setStatoScansioneVeicolo("analisi");
    stopCamera();

    const clientFile = capturedClientFileRef.current;
    if (!clientFile) {
      setOcrErrore("Manca la prima foto del libretto. Riparti dalla scansione.");
      setStatoScansioneCliente("errore");
      setStatoScansioneVeicolo("errore");
      return;
    }

    try {
      setFileVeicolo(file);
      await runCombinedScan(clientFile, file);
    } catch {
      // L'errore è già mostrato nell'interfaccia.
    }
  };

  const handleFallbackScanFile = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files || []);
  
    if (files.length === 0) return;
  
    // L'utente deve scegliere esattamente 2 foto
    if (files.length !== 2) {
      setOcrErrore(
        "Seleziona esattamente 2 foto del libretto: una del riquadro cliente e una del riquadro veicolo."
      );
      event.target.value = "";
      return;
    }
  
    const [clientFile, vehicleFile] = files;

    setFileCliente(clientFile);
    setFileVeicolo(vehicleFile);
  
    const clientPreview = URL.createObjectURL(clientFile);
    const vehiclePreview = URL.createObjectURL(vehicleFile);
  
    setFotoCliente(clientPreview);
    setFotoVeicolo(vehiclePreview);
  
    setStatoScansioneCliente("analisi");
    setStatoScansioneVeicolo("analisi");
    setOcrErrore("");
    setOcrProgress(0);
  
    event.target.value = "";
  
    try {
      await runCombinedScan(clientFile, vehicleFile);
    } catch {
      // L'errore è già mostrato nell'interfaccia.
    }
  };

  const handleSave = async () => {
  const cf1 = form.cf.trim().toUpperCase();

  if (!cf1) {
    alert(
      "Il codice fiscale del Cliente 1 non è stato letto dal libretto. Ripeti la scansione."
    );
    return;
  }

  const cliente1DaSalvare: ClienteData = {
    ...form,
    cf: cf1,
  };

  const hasCliente2DaSalvare =
    showCliente2 && Boolean(cliente2.nome.trim());

  let cliente2DaSalvare: ClienteData | null = null;

  if (hasCliente2DaSalvare) {
    const cf2 = cliente2.cf.trim().toUpperCase();

    if (!cf2) {
      alert(
        "Il codice fiscale del Cliente 2 non è stato letto dal libretto. Ripeti la scansione."
      );
      return;
    }

    cliente2DaSalvare = {
      ...cliente2,
      cf: cf2,
    };
  }

  /*
   * Prima di creare l'ID controlliamo se la targa esiste già.
   * In questo modo lo stesso veicolo mantiene SEMPRE la stessa
   * cartella su R2 anche se il profilo viene salvato di nuovo.
   */
  const raw = localStorage.getItem("goldencar_vehicles");
  const vehicles = raw ? JSON.parse(raw) : [];
  const list = Array.isArray(vehicles) ? vehicles : [];

  const normalizedPlate = form.targa
    .trim()
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase();

  const existingIndex = list.findIndex(
    (item: any) =>
      String(item?.veicolo?.targa || "")
        .replace(/[^A-Z0-9]/gi, "")
        .toUpperCase() === normalizedPlate
  );

  const existingVehicleId =
    existingIndex >= 0 && typeof list[existingIndex]?.id === "string"
      ? list[existingIndex].id
      : null;

  const veicoloId =
    existingVehicleId ||
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `vehicle-${Date.now()}`);

  const nuovoProfilo = {
    id: veicoloId,

    cliente1: cliente1DaSalvare,

    cliente2: cliente2DaSalvare,

    veicolo: {
      veicolo: form.veicolo,
      motore: form.motore,
      targa: form.targa.trim().toUpperCase(),
      immatricolazione: form.immatricolazione,
      revisione: form.revisione,
    },

    libretto: {
      cliente: null as string | null,
      veicolo: null as string | null,
    },
  };

  try {
    /*
     * ==========================================
     * UPLOAD LIBRETTO SU CLOUDFLARE R2
     * ==========================================
     */

    const fotoLibretto = [
      {
        file: fileCliente,
        key: `veicoli/${veicoloId}/libretto-cliente.jpg`,
        tipo: "cliente" as const,
      },
      {
        file: fileVeicolo,
        key: `veicoli/${veicoloId}/libretto-veicolo.jpg`,
        tipo: "veicolo" as const,
      },
    ];

    for (const foto of fotoLibretto) {
      if (!foto.file) {
        throw new Error(
          "Manca una delle due foto del libretto. Ripeti la scansione."
        );
      }

      /*
       * Chiediamo al backend un URL temporaneo
       * per caricare direttamente il file su R2.
       */
      const presignResponse = await fetch("/api/r2/file", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: foto.key,
          contentType: foto.file.type || "image/jpeg",
        }),
      });

      const presignData = await presignResponse.json();

      if (!presignResponse.ok || !presignData.ok) {
        throw new Error(
          presignData.error ||
            "Non riesco a preparare il caricamento del libretto."
        );
      }

      /*
       * Upload diretto browser → Cloudflare R2.
       * Le credenziali R2 NON vengono mai esposte al browser.
       */
      const uploadResponse = await fetch(
        presignData.uploadUrl,
        {
          method: "PUT",
          headers: {
            "Content-Type": foto.file.type || "image/jpeg",
          },
          body: foto.file,
        }
      );

      if (!uploadResponse.ok) {
        throw new Error(
          `Upload del libretto fallito (${uploadResponse.status}).`
        );
      }

      if (foto.tipo === "cliente") {
        nuovoProfilo.libretto.cliente = foto.key;
      } else {
        nuovoProfilo.libretto.veicolo = foto.key;
      }
    }

    /*
     * ==========================================
     * SALVATAGGIO PROFILO
     * ==========================================
     */

    if (existingIndex >= 0) {
      list[existingIndex] = {
        ...list[existingIndex],
        ...nuovoProfilo,
      };
    } else {
      list.push(nuovoProfilo);
    }

    localStorage.setItem(
      "goldencar_vehicles",
      JSON.stringify(list)
    );
  } catch (error) {
    console.error(
      "Errore salvataggio veicolo/libretto:",
      error
    );

    alert(
      error instanceof Error
        ? error.message
        : "Non riesco a salvare il profilo del veicolo."
    );

    return;
  }

  /*
   * ==========================================
   * CHECK-IN
   * ==========================================
   */

  let fromCheckIn = false;

  try {
    fromCheckIn = Boolean(
      sessionStorage.getItem("goldencar_checkin_targa")
    );

    sessionStorage.removeItem("goldencar_checkin_targa");
  } catch {
    // Nessun handoff CHECK-IN.
  }

  if (fromCheckIn) {
    sessionStorage.setItem(
      "goldencar_nuova_scheda",
      JSON.stringify({
        nomeCliente: cliente1DaSalvare.nome,
        indirizzo: cliente1DaSalvare.indirizzo,
        telefono: cliente1DaSalvare.telefono,
        codiceFiscale: cliente1DaSalvare.cf,
        veicolo: form.veicolo,
        targa: nuovoProfilo.veicolo.targa,
      })
    );

    router.push("/veicolo/scheda");
    return;
  }

  setOpen(false);
};


  return (
    <>
      {/* =========================

          POPUP NUOVO PROFILO

      ========================= */}



        <div

          style={{

            position: "fixed",

            inset: 0,

            background: "rgba(0,0,0,.45)",

            display: "flex",

            justifyContent: "center",

            alignItems: "flex-end",

            zIndex: 9999,

          }}

          onClick={(event) => {

            if (event.target === event.currentTarget) {

              setOpen(false);

            }

          }}

        >

          <div
            className="scrollbar-hide"

            style={{

              width: "100%",

              maxWidth: 430,

              maxHeight: "90vh",

              overflowY: "auto",

              background: "#F5F7FA",

              borderTopLeftRadius: 30,

              borderTopRightRadius: 30,

              padding: "24px 18px 34px",

            }}

          >

            {/* TITOLO */}



            <div

              style={{

                display: "flex",

                alignItems: "center",

                justifyContent: "space-between",

                gap: 12,

              }}

            >

              <h2

                style={{

                  fontSize: 26,

                  fontWeight: 900,

                  color: "#111827",

                  margin: 0,

                }}

              >

                NUOVO PROFILO

              </h2>



              <button

                type="button"

                onClick={() => setOpen(false)}

                aria-label="Chiudi"

                style={{

                  width: 40,

                  height: 40,

                  border: "none",

                  borderRadius: 12,

                  background: "#FFFFFF",

                  color: "#111827",

                  fontSize: 26,

                  cursor: "pointer",

                  display: "flex",

                  alignItems: "center",

                  justifyContent: "center",

                }}

              >

                ×

              </button>

            </div>



            {/* =========================
                SCANSIONE GUIDATA
            ========================= */}

            <Section title="SCANSIONA" />

            <input
              ref={fileInputFallbackRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFallbackScanFile}
              style={{ display: "none" }}
            />

            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "stretch",
              }}
            >
              {/* SCANSIONA LIBRETTO */}
              <button
                type="button"
                onClick={apriScanner}
                disabled={analisiInCorso}
                style={{
                  position: "relative",
                  flex: 1,
                  minWidth: 0,
                  height: 188,
                  border: `2px dashed ${
                    analisiInCorso
                      ? "#D4AF37"
                      : statoScansioneCliente === "ok" &&
                          statoScansioneVeicolo === "ok"
                        ? "#22C55E"
                        : statoScansioneCliente === "errore" ||
                            statoScansioneVeicolo === "errore"
                          ? "#EF4444"
                          : "#D4AF37"
                  }`,
                  borderRadius: 24,
                  background:
                    statoScansioneCliente === "ok" &&
                    statoScansioneVeicolo === "ok"
                      ? "#F1FBF4"
                      : statoScansioneCliente === "errore" ||
                          statoScansioneVeicolo === "errore"
                        ? "#FFF1F2"
                        : "#FFFDF4",
                  overflow: "hidden",
                  cursor: analisiInCorso ? "wait" : "pointer",
                  padding: 0,
                }}
              >
                {(fotoCliente || fotoVeicolo) && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      gap: 4,
                      opacity: 0.16,
                    }}
                  >
                    {fotoCliente && (
                      <img
                        src={fotoCliente}
                        alt="Prima foto del libretto"
                        style={{
                          width: "50%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    )}

                    {fotoVeicolo && (
                      <img
                        src={fotoVeicolo}
                        alt="Seconda foto del libretto"
                        style={{
                          width: "50%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    )}
                  </div>
                )}

                <div
                  style={{
                    position: "relative",
                    zIndex: 1,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 12,
                  }}
                >
                  {analisiInCorso ? (
                    <>
                      <ScanSpinner />

                      <div
                        style={{
                          marginTop: 10,
                          fontSize: 16,
                          fontWeight: 900,
                          color: "#111827",
                        }}
                      >
                        Analisi del libretto...
                      </div>

                      <div
                        style={{
                          marginTop: 5,
                          fontSize: 13,
                          fontWeight: 800,
                          color: "#64748B",
                        }}
                      >
                        {ocrProgress}%
                      </div>
                    </>
                  ) : statoScansioneCliente === "ok" &&
                    statoScansioneVeicolo === "ok" ? (
                    <>
                      <CheckCircleIcon color="#15803D" />

                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 17,
                          fontWeight: 900,
                          color: "#111827",
                        }}
                      >
                        Libretto analizzato
                      </div>

                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 13,
                          fontWeight: 800,
                          color: "#15803D",
                        }}
                      >
                        ✓ 2 foto acquisite
                      </div>
                    </>
                  ) : statoScansioneCliente === "errore" ||
                    statoScansioneVeicolo === "errore" ? (
                    <>
                      <CameraScanIcon />

                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 16,
                          fontWeight: 900,
                          color: "#B91C1C",
                        }}
                      >
                        Riprova scansione
                      </div>

                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#64748B",
                        }}
                      >
                        Foto non riconosciute
                      </div>
                    </>
                  ) : (
                    <>
                      <CameraScanIcon />

                      <div
                        style={{
                          marginTop: 9,
                          fontSize: 18,
                          fontWeight: 900,
                          color: "#111827",
                        }}
                      >
                        Scansiona libretto
                      </div>

                      <div
                        style={{
                          marginTop: 5,
                          fontSize: 13,
                          fontWeight: 800,
                          color: "#A16207",
                        }}
                      >
                        2 foto guidate · automatiche
                      </div>
                    </>
                  )}
                </div>
              </button>

              {/* CARICA FOTO */}
              <button
                type="button"
                onClick={() => fileInputFallbackRef.current?.click()}
                disabled={analisiInCorso}
                aria-label="Carica due foto del libretto"
                style={{
                  width: 82,
                  height: 188,
                  border: "1px solid #D8DEE7",
                  borderRadius: 22,
                  background: "#FFFFFF",
                  color: "#475569",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  cursor: analisiInCorso ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 12px rgba(0,0,0,.05)",
                  padding: 8,
                  flexShrink: 0,
                }}
              >
                <UploadIcon />

                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 900,
                    letterSpacing: "0.02em",
                  }}
                >
                  CARICA
                </span>
              </button>
            </div>

            {ocrErrore && !analisiInCorso && (
              <div
                style={{
                  marginTop: 10,
                  padding: "10px 12px",
                  borderRadius: 14,
                  background: "#FFF1F2",
                  color: "#B91C1C",
                  fontSize: 12,
                  lineHeight: 1.4,
                }}
              >
                {ocrErrore}
              </div>
            )}

            {/* DATI CLIENTE 1 */}



            <Section title="DATI CLIENTE 1" />



            <Field

              label="Nome cliente"

              value={form.nome}

              onChange={(value) => update("nome", value)}

            />



            <Field

              label="Indirizzo"

              value={form.indirizzo}

              onChange={(value) => update("indirizzo", value)}

            />



            <Field

              label="Telefono"

              value={form.telefono}

              onChange={(value) => update("telefono", value)}

            />



            <Field

              label="Data di nascita"

              type="date"

              value={form.nascita}

              onChange={(value) => update("nascita", value)}

            />



            <Field

              label="Codice fiscale"

              value={form.cf}

              onChange={() => undefined}

              readOnly

            />



            {/* DATI CLIENTE 2 */}



            <div

              style={{

                display: "flex",

                alignItems: "center",

                justifyContent: "space-between",

                marginTop: 22,

                marginBottom: showCliente2 ? 10 : 0,

              }}

            >

              <div

                style={{

                  fontSize: 13,

                  fontWeight: 800,

                  color: "#6B7280",

                  letterSpacing: ".08em",

                }}

              >

                DATI CLIENTE 2

              </div>



              <button

                type="button"

                onClick={() => setShowCliente2((prev) => !prev)}

                aria-label={

                  showCliente2

                    ? "Chiudi dati cliente 2"

                    : "Aggiungi cliente 2"

                }

                style={{

                  width: 34,

                  height: 34,

                  border: "none",

                  borderRadius: 11,

                  background: showCliente2 ? "#111827" : "#D4AF37",

                  display: "flex",

                  alignItems: "center",

                  justifyContent: "center",

                  cursor: "pointer",

                  flexShrink: 0,

                }}

              >

                {showCliente2 ? <MinusIcon /> : <SmallPlusIcon />}

              </button>

            </div>



            {showCliente2 && (

              <div

                style={{

                  paddingTop: 2,

                }}

              >

                <Field

                  label="Nome cliente"

                  value={cliente2.nome}

                  onChange={(value) => updateCliente2("nome", value)}

                />



                <Field

                  label="Indirizzo"

                  value={cliente2.indirizzo}

                  onChange={(value) => updateCliente2("indirizzo", value)}

                />



                <Field

                  label="Telefono"

                  value={cliente2.telefono}

                  onChange={(value) => updateCliente2("telefono", value)}

                />



                <Field

                  label="Data di nascita"

                  type="date"

                  value={cliente2.nascita}

                  onChange={(value) => updateCliente2("nascita", value)}

                />



                <Field

                  label="Codice fiscale"

                  value={cliente2.cf}

                  onChange={() => undefined}

                  readOnly

                />

              </div>

            )}



            {/* DATI VEICOLO */}



            <Section title="DATI VEICOLO" />



            <Field

              label="Veicolo"

              value={form.veicolo}

              onChange={(value) => update("veicolo", value)}

            />



            <Field

              label="Motore"

              value={form.motore}

              onChange={(value) => update("motore", value)}

            />



            <Field

              label="Targa"

              value={form.targa}

              onChange={(value) => update("targa", value)}

            />



            <Field

              label="Immatricolazione"

              type="date"

              value={form.immatricolazione}

              onChange={(value) => update("immatricolazione", value)}

            />



            <Field

              label="Scadenza revisione"

              type="date"

              value={form.revisione}

              onChange={(value) => update("revisione", value)}

            />



            {/* SALVA */}



            <button

              type="button"

              onClick={handleSave}

              style={{

                width: "100%",

                height: 58,

                marginTop: 24,

                border: "none",

                borderRadius: 18,

                background: "#D4AF37",

                color: "#111827",

                fontSize: 18,

                fontWeight: 900,

                cursor: "pointer",

                boxShadow: "0 6px 16px rgba(0,0,0,.10)",

              }}

            >

              SALVA

            </button>

          </div>

        </div>


      {cameraOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 12000,
            background: "#000",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 430,
              height: "100%",
              overflow: "hidden",
              background: "#000",
            }}
          >
            <video
              ref={cameraVideoRef}
              autoPlay
              muted
              playsInline
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />

            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(to bottom, rgba(0,0,0,.48), transparent 22%, transparent 74%, rgba(0,0,0,.68))",
                pointerEvents: "none",
              }}
            />

            <div
              style={{
                position: "absolute",
                top: 18,
                left: 18,
                right: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                zIndex: 2,
              }}
            >
              <div
                style={{
                  padding: "9px 12px",
                  borderRadius: 14,
                  background: "rgba(0,0,0,.55)",
                  color: "#FFF",
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: ".04em",
                }}
              >
                PASSO {cameraStep}/2 · {cameraStep === 1 ? "DATI CLIENTE" : "DATI VEICOLO"}
              </div>

              <button
                type="button"
                onClick={stopCamera}
                aria-label="Chiudi fotocamera"
                style={{
                  width: 42,
                  height: 42,
                  border: "none",
                  borderRadius: 14,
                  background: "rgba(255,255,255,.92)",
                  color: "#111827",
                  fontSize: 24,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                position: "absolute",
                top: "24%",
                left: "7%",
                width: "86%",
                height: "39%",
                border: "2px solid #FFFFFF",
                borderRadius: 24,
                boxShadow: "0 0 0 9999px rgba(0,0,0,.48)",
                zIndex: 2,
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 12,
                  left: 12,
                  right: 12,
                  padding: "10px 12px",
                  borderRadius: 14,
                  background: "rgba(0,0,0,.56)",
                  color: "#FFF",
                  textAlign: "center",
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                {cameraStep === 1
                  ? "Inquadra il riquadro in alto a sinistra del libretto"
                  : "Inquadra il riquadro in alto a destra del libretto"}
              </div>
            </div>

            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 24,
                zIndex: 3,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  color: "#FFF",
                  fontSize: 12,
                  fontWeight: 700,
                  opacity: 0.9,
                  textAlign: "center",
                  padding: "0 24px",
                }}
              >
                Tieni il libretto fermo e assicurati che il riquadro sia completamente visibile.
              </div>

              <button
                type="button"
                onClick={() => void scattaFotoScanner()}
                aria-label="Scatta foto"
                style={{
                  width: 78,
                  height: 78,
                  borderRadius: "50%",
                  border: "5px solid rgba(255,255,255,.72)",
                  background: "#FFFFFF",
                  boxShadow: "0 8px 24px rgba(0,0,0,.35)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: "50%",
                    background: "#D4AF37",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <CameraSmallIcon />
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomBar />
    </>
  );
}

type ParsedLibretto = {
  cliente1: ClienteData;
  cliente2: ClienteData | null;
  veicolo: VeicoloData;
};

/* =========================================================
   OCR ROBUSTO LIBRETTO
   - Non dipende da una singola formattazione di Vision.
   - Prima usa le etichette ufficiali del libretto.
   - Se Vision spezza etichetta/valore su più righe, ricompone il campo.
   - I fallback sono conservativi: preferiscono il contesto del campo
     invece di prendere la prima stringa plausibile trovata nella foto.
========================================================= */

function normalizeOcrLine(value: string): string {
  return value
    .toUpperCase()
    .replace(/[|¦]/g, " ")
    .replace(/[“”"«»]/g, "")
    .replace(/[{}[\]<>]/g, " ")
    .replace(/[\t ]+/g, " ")
    .trim();
}

function normalizeOcrText(value: string): string {
  return value
    .replace(/\r/g, "\n")
    .replace(/\u00A0/g, " ")
    .split("\n")
    .map(normalizeOcrLine)
    .filter(Boolean)
    .join("\n");
}

function cleanFieldValue(value: string): string {
  return normalizeOcrLine(value)
    .replace(/^[\s:;.,)\]}\-–—]+/, "")
    .replace(/[\s]+/g, " ")
    .trim();
}

function cleanPersonPart(value: string): string {
  const cleaned = cleanFieldValue(value)
    // Vision a volte restituisce l'etichetta racchiusa tra parentesi:
    // "(C.2.1) MARCHIORO". La rimuoviamo prima di pulire il nome.
    .replace(/^[^A-Z0-9À-ÖØ-Þ]*(?:C\s*\.?\s*2\s*\.?\s*[123]|COMPR)\s*[):.\-]?\s*/i, "")
    .replace(/[^A-ZÀ-ÖØ-Þ' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned
    .split(" ")
    .filter((word) => word.length >= 2)
    .slice(0, 5)
    .join(" ");
}

function cleanAddress(value: string): string {
  return cleanFieldValue(value)
    // Rimuove sia "C.2.3 VIA..." sia "(C.2.3) VIA...".
    .replace(/^[^A-Z0-9À-ÖØ-Þ]*(?:C\s*\.?\s*2\s*\.?\s*3|COMPR)\s*[):.\-]?\s*/i, "")
    .replace(/[^A-ZÀ-ÖØ-Þ0-9'./() -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toInputDate(value: string): string {
  const match = value.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
  if (!match) return "";
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function isDate(value: string): boolean {
  return /\b\d{2}[./-]\d{2}[./-]\d{4}\b/.test(value);
}

function extractDate(value: string): string {
  const match = value.match(/\b\d{2}[./-]\d{2}[./-]\d{4}\b/);
  return match ? toInputDate(match[0]) : "";
}

function isVehicleFieldLabel(line: string): boolean {
  // IMPORTANTE: il codice deve essere una vera etichetta isolata.
  // Prima "SARNONICO (TN)" veniva erroneamente interpretato come campo S
  // perché la regex accettava qualsiasi parola che iniziasse con S.
  return /^(?:\s*[()]?\s*(?:A|B|E|F|G|H|J|K|L|M|N|O|Q|R|S|T|U|V|W|X|Y|Z)\s*[):.\-]?\s+|\s*[()]?\s*D\s*[.:]?\s*(?:2|3)\s*[):.\-]?\s+|\s*[()]?\s*P\s*[.:]?\s*[13]\s*[):.\-]?\s+)/i.test(line);
}

function isClientFieldLabel(line: string): boolean {
  return /^[^A-Z0-9À-ÖØ-Þ]*(?:C\s*\.?\s*2\s*\.?\s*[123]|COMPR|NAT[O0]\s+IL)\b/i.test(line);
}

function fieldRegex(label: "A" | "B" | "D3" | "P1" | "P3" | "C21" | "C22" | "C23" | "COMPR") {
  // Il delimitatore prima dell'etichetta può essere spazio, parentesi, due punti, ecc.
  // Questo è fondamentale per output Vision del tipo "(C.2.1) MARCHIORO".
  switch (label) {
    case "A": return /(?:^|[^A-Z0-9])\(?\s*A\s*\)?\s*[.:\-]?\s*/i;
    case "B": return /(?:^|[^A-Z0-9])\(?\s*B\s*\)?\s*[.:\-]?\s*/i;
    // Vision può trasformare D.3 in D3, D 3, D-3, 0.3 oppure O.3.
    // O/0 sono accettati SOLO per questa etichetta e il valore viene poi
    // validato come nome modello, evitando falsi positivi.
    case "D3": return /(?:^|[^A-Z0-9])\(?\s*[DO0]\s*[.:\-]?\s*3\s*\)?\s*[.:\-]?\s*/i;
    case "P1": return /(?:^|[^A-Z0-9])P\s*\.?\s*1\s*[):.\-]?\s*/i;
    case "P3": return /(?:^|[^A-Z0-9])P\s*\.?\s*3\s*[):.\-]?\s*/i;
    case "C21": return /(?:^|[^A-Z0-9])C\s*\.?\s*2\s*\.?\s*1\s*[):.\-]?\s*/i;
    case "C22": return /(?:^|[^A-Z0-9])C\s*\.?\s*2\s*\.?\s*2\s*[):.\-]?\s*/i;
    case "C23": return /(?:^|[^A-Z0-9])C\s*\.?\s*2\s*\.?\s*3\s*[):.\-]?\s*/i;
    case "COMPR": return /(?:^|[^A-Z0-9])COMPR\s*[):.\-]?\s*/i;
  }
}

function valueAfterLabelFromLines(
  lines: string[],
  pattern: RegExp,
  options: { maxNextLines?: number; stop?: (line: string) => boolean } = {}
): string {
  const maxNextLines = options.maxNextLines ?? 4;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(pattern);
    if (!match) continue;

    let inline = cleanFieldValue(line.slice((match.index ?? 0) + match[0].length));
    // Se Vision mette più campi sulla stessa riga, fermiamoci al prossimo campo.
    inline = inline.split(/(?=C\s*\.?\s*2\s*\.?\s*[123]\b|COMPR\b|NAT[O0]\s+IL\b|(?:A|B|D\s*\.?\s*3|P\s*\.?\s*[13])\b)/i)[0].trim();
    if (inline) return inline;

    for (let j = i + 1; j < Math.min(lines.length, i + 1 + maxNextLines); j++) {
      const candidate = cleanFieldValue(lines[j]);
      if (!candidate) continue;
      if (options.stop?.(candidate)) break;
      return candidate;
    }
  }

  return "";
}

function collectAfterLabel(
  lines: string[],
  pattern: RegExp,
  maxNextLines = 4,
  stop?: (line: string) => boolean
): string[] {
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(pattern);
    if (!match) continue;

    const values: string[] = [];
    const inline = cleanFieldValue(lines[i].slice((match.index ?? 0) + match[0].length));
    if (inline) values.push(inline);

    for (let j = i + 1; j < Math.min(lines.length, i + 1 + maxNextLines); j++) {
      const candidate = cleanFieldValue(lines[j]);
      if (!candidate) continue;
      if (stop?.(candidate)) break;
      values.push(candidate);
      if (values.length >= maxNextLines) break;
    }
    return values;
  }
  return [];
}

function extractBirthPlaceFromNatoText(text: string): {
  luogoNascita: string;
  provinciaNascita: string;
} {
  const lines = normalizeOcrText(text).split("\n").filter(Boolean);
  const nato = lines.findIndex((line) => /NAT[O0]\s+IL/i.test(line));
  if (nato < 0) return { luogoNascita: "", provinciaNascita: "" };

  for (let i = nato + 1; i < Math.min(lines.length, nato + 6); i++) {
    const match = lines[i].match(/^A\s+(.+?)\s*\(([A-Z]{2})\)\s*$/i);
    if (match) {
      return { luogoNascita: match[1].trim(), provinciaNascita: match[2].toUpperCase() };
    }
    const parenthesized = lines[i].match(/^(.+?)\s*\(([A-Z]{2})\)\s*$/i);
    if (parenthesized && !/^[A-Z]{2,3}$/.test(parenthesized[1].trim())) {
      return { luogoNascita: parenthesized[1].trim(), provinciaNascita: parenthesized[2].toUpperCase() };
    }
  }

  return { luogoNascita: "", provinciaNascita: "" };
}

function extractDateFromNatoText(text: string): string {
  const match = normalizeOcrText(text).match(/NAT[O0]\s+IL[^0-9]*(\d{2}[./-]\d{2}[./-]\d{4})/i);
  return match ? toInputDate(match[1]) : "";
}

function normalizeCfCandidate(value: string): string {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (compact.length < 16) return "";

  for (let start = 0; start <= compact.length - 16; start++) {
    const chars = compact.slice(start, start + 16).split("");
    const digitMap: Record<string, string> = { O: "0", I: "1", L: "1", Z: "2", S: "5", G: "6", B: "8" };
    const letterMap: Record<string, string> = { "0": "O", "1": "I", "2": "Z", "5": "S", "6": "G", "8": "B" };

    for (const i of [6, 7, 9, 10, 12, 13, 14]) {
      if (!/\d/.test(chars[i])) chars[i] = digitMap[chars[i]] || chars[i];
    }
    for (const i of [0, 1, 2, 3, 4, 5, 8, 11, 15]) {
      if (!/[A-Z]/.test(chars[i])) chars[i] = letterMap[chars[i]] || chars[i];
    }

    const cf = chars.join("");
    if (/^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(cf)) return cf;
  }
  return "";
}

function extractCfFromText(text: string): string {
  const normalized = normalizeOcrText(text);
  const exact = normalized.match(/[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]/i);
  if (exact) return exact[0].toUpperCase();
  return normalizeCfCandidate(normalized);
}

function extractNatoData(text: string): Array<{ nascita: string; cf: string }> {
  const normalized = normalizeOcrText(text);
  const lines = normalized.split("\n").filter(Boolean);
  const result: Array<{ nascita: string; cf: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    if (!/NAT[O0]\s+IL/i.test(lines[i])) continue;
    const local = lines.slice(i, i + 6).join(" ");
    result.push({
      nascita: extractDateFromNatoText(local),
      cf: extractCfFromText(local),
    });
  }

  return result;
}

function addressLineScore(line: string): number {
  const value = normalizeOcrLine(line);
  if (!/(?:^|\s)(?:VIA|VIALE|PIAZZA|PIAZZALE|STRADA|CORSO|LARGO|BORGO|VICOLO)\b/i.test(value)) return -1;
  let score = 10;
  if (/\d/.test(value)) score += 5;
  if (/\b\d{5}\b/.test(value)) score += 3;
  if (/\([A-Z]{2}\)/.test(value)) score += 4;
  return score;
}

function extractAddressCandidates(lines: string[]): string[] {
  const candidates: string[] = [];
  const addressStart = /^(?:VIA|VIALE|PIAZZA|PIAZZALE|STRADA|CORSO|LARGO|BORGO|VICOLO)\b/i;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = cleanAddress(rawLine);
    const score = addressLineScore(line);
    if (score < 0) continue;

    const pieces = [line];
    for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
      const next = lines[j];
      if (isClientFieldLabel(next) || isVehicleFieldLabel(next)) break;
      if (/^NAT[O0]\s+IL/i.test(next)) break;
      if (addressStart.test(next) && pieces.length > 1) break;
      if (/^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(next)) break;
      pieces.push(next);
      if (/\([A-Z]{2}\)/.test(next) || /\b\d{5}\b/.test(next)) break;
    }

    const address = cleanAddress(pieces.join(" "));
    if (address) candidates.push(address);
  }

  return candidates;
}

function extractClientAddressFromBlock(block: string[], preferLast = false): string {
  const normalized = block.map(normalizeOcrLine).filter(Boolean);

  // C.2.3 è la fonte primaria. Vision può restituire:
  // "(C.2.3) VIA CASTELLO MORI 7" + "SARNONICO (TN)" su riga separata.
  const c23Index = normalized.findIndex((line) => fieldRegex("C23").test(line));
  if (c23Index >= 0) {
    const values = collectAfterLabel(
      normalized.slice(c23Index),
      fieldRegex("C23"),
      5,
      (line) => isClientFieldLabel(line) || isVehicleFieldLabel(line) || /NAT[O0]\s+IL/i.test(line)
    );

    // Se il primo pezzo è già "VIA ...", includiamo anche il comune/provincia
    // sulla riga successiva. Non fermiamoci al primo valore inline.
    const address = cleanAddress(values.join(" "));
    if (address && addressLineScore(address) >= 0) return address;
  }

  const candidates = extractAddressCandidates(normalized);
  if (!candidates.length) return "";
  return preferLast ? candidates[candidates.length - 1] : candidates[0];
}

function extractClientNameFromBlock(block: string[], secondClient = false): { nome: string; cognome: string } {
  const lines = block.map(normalizeOcrLine).filter(Boolean);

  if (secondClient) {
    const comprIndex = lines.findIndex((line) => /\bCOMPR\b/i.test(line));
    if (comprIndex >= 0) {
      const afterCompr = cleanPersonPart(
        lines[comprIndex].replace(/.*?\bCOMPR\b\s*[):.\-]?\s*/i, "")
      );
      const inlineWords = afterCompr.split(" ").filter(Boolean);

      // Caso: COMPR MARCHIORO
      let cognome = inlineWords.length ? inlineWords[inlineWords.length - 1] : "";
      let nome = inlineWords.length > 1 ? inlineWords.slice(0, -1).join(" ") : "";

      // Caso reale frequente: COMPR MARCHIORO / PIETRO sulla riga sotto.
      if (!nome && cognome) {
        for (let i = comprIndex + 1; i < Math.min(lines.length, comprIndex + 4); i++) {
          const candidate = cleanPersonPart(lines[i]);
          if (!candidate) continue;
          if (isClientFieldLabel(candidate) || isVehicleFieldLabel(candidate)) break;
          if (/NAT[O0]\s+IL/i.test(candidate) || addressLineScore(candidate) >= 0) break;
          nome = candidate.split(" ").slice(0, 3).join(" ");
          break;
        }
      }

      return { nome, cognome };
    }
  }

  const c21 = valueAfterLabelFromLines(lines, fieldRegex("C21"), {
    maxNextLines: 2,
    stop: (line) => /C\s*\.?\s*2\s*\.?\s*[123]/i.test(line),
  });
  const c22 = valueAfterLabelFromLines(lines, fieldRegex("C22"), {
    maxNextLines: 2,
    stop: (line) => /C\s*\.?\s*2\s*\.?\s*[123]/i.test(line),
  });

  let cognome = cleanPersonPart(c21);
  let nome = cleanPersonPart(c22);

  // Se C.2.2 è perso, il nome è spesso immediatamente sotto C.2.1.
  if (!nome) {
    const c21Index = lines.findIndex((line) => /C\s*\.?\s*2\s*\.?\s*1/i.test(line));
    if (c21Index >= 0) {
      for (let i = c21Index + 1; i < Math.min(lines.length, c21Index + 4); i++) {
        const candidate = cleanPersonPart(lines[i]);
        if (!candidate) continue;
        if (/C\s*\.?\s*2\s*\.?\s*[123]/i.test(lines[i])) continue;
        if (addressLineScore(lines[i]) >= 0 || /NAT[O0]\s+IL/i.test(lines[i])) break;
        if (candidate !== cognome) {
          nome = candidate;
          break;
        }
      }
    }
  }

  // Fallback strutturale: MAI prendere una generica riga maiuscola del documento.
  // Su libretti diversi righe come J.1/J.2 possono essere "IMPOSTA PERSONE-USO PROPRIO"
  // e non devono finire nel nome cliente. Se C.2.1/C.2.2 non sono riconosciuti,
  // cerchiamo solo nella finestra immediatamente precedente a NATO IL.
  if (!cognome || !nome) {
    const natoIndex = lines.findIndex((line) => /NAT[O0]\s+IL/i.test(line));
    if (natoIndex > 0) {
      const candidates = lines
        .slice(Math.max(0, natoIndex - 5), natoIndex)
        .filter((line) =>
          /^[A-ZÀ-ÖØ-Þ' -]{2,45}$/.test(line) &&
          !/^(?:C|COMPR|NAT|VIA|VIALE|PIAZZA|PIAZZALE|STRADA|CORSO|LARGO|BORGO|VICOLO)\b/i.test(line) &&
          !/^(?:IMPOSTA|PERSONE|USO|PROPRIO|AUTOVETTURA|TRASPORTO|MERCI|RIMORCHIO)\b/i.test(line) &&
          !/^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(line)
        )
        .map(cleanPersonPart)
        .filter(Boolean);
      if (!cognome && candidates.length) cognome = candidates[candidates.length - 1];
      if (!nome && candidates.length >= 2) {
        const different = candidates.find((x) => x !== cognome);
        if (different) nome = different;
      }
    }
  }

  return { nome, cognome };
}

function extractClientBlock(lines: string[], startIndex: number, endIndex: number, secondClient = false): ClienteData {
  const block = lines.slice(startIndex, endIndex);
  const text = block.join("\n");
  const names = extractClientNameFromBlock(block, secondClient);
  const natoData = extractNatoData(text)[0] || { nascita: "", cf: "" };
  const birthPlace = extractBirthPlaceFromNatoText(text);

  return {
    nome: [names.nome, names.cognome].filter(Boolean).join(" ").trim(),
    cognome: names.cognome,
    luogoNascita: birthPlace.luogoNascita,
    provinciaNascita: birthPlace.provinciaNascita,
    indirizzo: extractClientAddressFromBlock(block, secondClient),
    telefono: "",
    nascita: natoData.nascita,
    cf: natoData.cf || extractCfFromText(text),
  };
}

function extractPlateFromCandidate(value: string): string {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (compact.length < 7) return "";

  const digitMap: Record<string, string> = { O: "0", Q: "0", D: "0", I: "1", L: "1", Z: "2", S: "5", G: "6", B: "8" };
  const letterMap: Record<string, string> = { "0": "O", "1": "I", "2": "Z", "5": "S", "6": "G", "8": "B" };

  for (let start = 0; start <= compact.length - 7; start++) {
    const chars = compact.slice(start, start + 7).split("");
    for (const i of [2, 3, 4]) if (!/\d/.test(chars[i])) chars[i] = digitMap[chars[i]] || chars[i];
    for (const i of [0, 1, 5, 6]) if (!/[A-Z]/.test(chars[i])) chars[i] = letterMap[chars[i]] || chars[i];
    const plate = chars.join("");
    if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(plate)) return plate;
  }
  return "";
}

function findItalianPlate(text: string): string {
  const lines = normalizeOcrText(text).split("\n").filter(Boolean);

  // La targa va presa SOLO dal campo A. Non cerchiamo più una targa
  // "ovunque" nel testo perché CF, numeri e altri codici possono produrre
  // una falsa sequenza di 7 caratteri.
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(fieldRegex("A"));
    if (!match) continue;

    const inline = extractPlateFromCandidate(
      lines[i].slice((match.index ?? 0) + match[0].length)
    );
    if (inline) return inline;

    for (let j = i + 1; j < Math.min(lines.length, i + 3); j++) {
      const candidateLine = lines[j];
      if (isVehicleFieldLabel(candidateLine)) break;
      const candidate = extractPlateFromCandidate(candidateLine);
      if (candidate) return candidate;
    }
  }

  return "";
}

function cleanVehicleModel(value: string): string {
  return cleanFieldValue(value)
    .replace(/^[()\[\]{}:;,.\-]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeVehicleModel(value: string): boolean {
  const v = cleanVehicleModel(value);
  if (!v || v.length < 3 || v.length > 60) return false;
  if (/^\d/.test(v)) return false;
  if (/^(?:A|B|E|F|G|H|I|J|K|L|M|N|O|P|Q|R|S|T|U|V|W|X|Y|Z)(?:\s|$)/i.test(v) && v.length <= 4) return false;
  if (/\b(?:GASOL|BENZINA|DIESEL|ELETTR|GPL|METANO|IBRIDO)\b/i.test(v)) return false;
  return /[A-ZÀ-ÖØ-Þ]/i.test(v);
}

function findD3Value(text: string): string {
  const lines = normalizeOcrText(text).split("\n").filter(Boolean);

  // 1. Etichetta D.3 / D3 / D 3 / D-3. Accettiamo anche O.3 e 0.3
  // come errore OCR, ma solo se il valore risultante sembra un modello.
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(fieldRegex("D3"));
    if (!match) continue;

    const inline = cleanVehicleModel(
      lines[i].slice((match.index ?? 0) + match[0].length)
    );
    if (looksLikeVehicleModel(inline)) return inline;

    for (let j = i + 1; j < Math.min(lines.length, i + 5); j++) {
      const candidate = cleanVehicleModel(lines[j]);
      if (!candidate) continue;
      if (isVehicleFieldLabel(lines[j])) break;
      if (/^\(?[A-Z0-9]\)?\s*[.:\-]/.test(candidate) && candidate.length < 8) break;
      if (looksLikeVehicleModel(candidate)) return candidate;
    }
  }

  // 2. Fallback strutturale: D.3 è nella zona D.2 -> D.3 -> E.
  // Cerchiamo una o due righe dopo D.2 senza mai saltare oltre E.
  const d2Index = lines.findIndex((line) =>
    /^(?:\s*[()]?\s*D\s*[.:\-]?\s*2\s*[):.\-]?\s+)/i.test(line)
  );
  const eIndex = lines.findIndex((line) =>
    /^(?:\s*[()]?\s*E\s*[):.\-]?\s+)/i.test(line)
  );

  if (d2Index >= 0) {
    const end = eIndex > d2Index ? eIndex : Math.min(lines.length, d2Index + 8);
    for (let i = d2Index + 1; i < end; i++) {
      const candidate = cleanVehicleModel(lines[i]);
      if (looksLikeVehicleModel(candidate)) return candidate;
    }
  }

  return "";
}

function findP1Value(text: string): string {
  const lines = normalizeOcrText(text).split("\n").filter(Boolean);
  const pattern = fieldRegex("P1");
  const number = /\b\d{3,5}(?:[.,]\d{1,2})?\b/;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(pattern);
    if (!match) continue;
    const inline = lines[i].slice((match.index ?? 0) + match[0].length).match(number);
    if (inline?.[0]) return inline[0];
    for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
      if (isVehicleFieldLabel(lines[j])) break;
      const found = lines[j].match(number);
      if (found?.[0]) return found[0];
    }
  }
  return "";
}

function findP3Value(text: string): string {
  const normalized = normalizeOcrText(text);
  const lines = normalized.split("\n").filter(Boolean);
  const pattern = fieldRegex("P3");
  const fuel = /\b(GASOL|BENZINA|DIESEL|ELETTR|IBRIDO|GPL|METANO)\b/i;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(pattern);
    if (!match) continue;
    const inline = lines[i].slice((match.index ?? 0) + match[0].length).match(fuel);
    if (inline?.[1]) return inline[1].toUpperCase();
    for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
      if (isVehicleFieldLabel(lines[j])) break;
      const found = lines[j].match(fuel);
      if (found?.[1]) return found[1].toUpperCase();
    }
  }

  // Fallback controllato: il carburante è una categoria chiusa.
  return normalized.match(fuel)?.[1]?.toUpperCase() || "";
}

function findDateInDedicatedBRegion(text: string, words: VisionWord[] = []): string {
  // Il campo B è la PRIMA immatricolazione e, nei libretti italiani,
  // compare nella prima foto. Questo OCR è dedicato a quella zona.
  // Prima proviamo il pattern più affidabile: (B) + data sulla stessa riga.
  const normalized = normalizeOcrText(text);
  const date = /(\d{2})\s*[./-]\s*(\d{2})\s*[./-]\s*(\d{4})/;
  const lines = normalized.split("\n").filter(Boolean);

  const bSameLine = /(?:^|[^A-Z0-9])\(?\s*(?:B|8|O|0)\s*\)?\s*[.:\-)]?\s*/i;
  for (const line of lines) {
    const label = line.match(bSameLine);
    if (!label) continue;
    const rest = line.slice((label.index ?? 0) + label[0].length);
    const m = rest.match(date);
    if (m) return `${m[1]}.${m[2]}.${m[3]}`;
  }

  // Caso OCR: B su una riga e data sulla successiva.
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*\(?\s*(?:B|8|O|0)\s*\)?\s*[.:\-)]?\s*$/i.test(lines[i])) continue;
    for (let j = i + 1; j <= Math.min(lines.length - 1, i + 3); j++) {
      const m = lines[j].match(date);
      if (m) return `${m[1]}.${m[2]}.${m[3]}`;
    }
  }

  // Caso OCR molto sporco: etichetta e data sono nella stessa stringa,
  // ma con testo/interpunzione fra loro.
  const compact = normalized.replace(/\s+/g, " ");
  const loose = compact.match(/(?:^|[^A-Z0-9])(?:B|8|O|0)[^\n]{0,45}?(\d{2})\s*[./-]\s*(\d{2})\s*[./-]\s*(\d{4})/i);
  if (loose) return `${loose[1]}.${loose[2]}.${loose[3]}`;

  // Ultimo fallback del ritaglio: se la B è stata completamente persa,
  // questo testo proviene già SOLO dalla zona B. Prendiamo una data valida,
  // ma soltanto da questo ritaglio, mai dalla seconda foto.
  const allDates: Array<{ value: string; year: number }> = [];
  let m: RegExpExecArray | null;
  const globalDate = /(\d{2})\s*[./-]\s*(\d{2})\s*[./-]\s*(\d{4})/g;
  while ((m = globalDate.exec(normalized))) {
    const day = Number(m[1]), month = Number(m[2]), year = Number(m[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1950 && year <= new Date().getFullYear() + 1) {
      allDates.push({ value: `${m[1]}.${m[2]}.${m[3]}`, year });
    }
  }
  if (allDates.length) {
    // In questa zona una singola data è quasi certamente B. Se ce ne sono
    // più di una, privilegiamo quella più vicina alla parte alta del ritaglio
    // tramite le coordinate, quando disponibili.
    if (words.length) {
      const dateWords = words.filter(w => /\d{2}[./-]\d{2}[./-]\d{4}/.test(w.text || ""));
      if (dateWords.length) {
        const topDate = [...dateWords].sort((a,b) => a.y - b.y)[0].text;
        const dm = topDate.match(date);
        if (dm) return `${dm[1]}.${dm[2]}.${dm[3]}`;
      }
    }
    return allDates.sort((a,b) => b.year - a.year)[0].value;
  }

  return "";
}

function findBDateFromVisionWords(words: VisionWord[]): string {
  if (!Array.isArray(words) || words.length === 0) return "";

  const clean = (v: string) => String(v || "").toUpperCase().replace(/[^A-Z0-9./-]/g, "");
  const dateRe = /^(\d{2})[./-](\d{2})[./-](\d{4})$/;
  const dateLooseRe = /^(\d{2})[./-]?(\d{2})[./-]?(\d{4})$/;

  const normalized = words
    .filter((w) => w && Number.isFinite(w.x) && Number.isFinite(w.y))
    .map((w) => ({
      ...w,
      t: clean(w.text),
      cx: w.x + w.width / 2,
      cy: w.y + w.height / 2,
    }))
    .filter((w) => w.t);

  if (!normalized.length) return "";

  // Le coordinate sono normalizzate rispetto all'immagine originale.
  // Il campo B è nella parte alta del primo foglio. Cerchiamo quindi
  // l'etichetta B (anche quando Vision la legge come 8/O/0) solo nella
  // fascia alta e preferiamo un valore che abbia una data immediatamente
  // a destra sulla stessa riga.
  const top = normalized.filter((w) => w.cy <= 0.48);
  const bCandidates = top.filter((w) =>
    /^(?:B|8|O|0)[.:)\-]?$/.test(w.t)
  );

  const dateCandidates: Array<{ value: string; x: number; y: number; score: number }> = [];

  // 1) Una singola word contiene già la data.
  for (const w of top) {
    const m = w.t.match(dateRe) || w.t.match(dateLooseRe);
    if (m) {
      dateCandidates.push({
        value: `${m[1]}.${m[2]}.${m[3]}`,
        x: w.cx,
        y: w.cy,
        score: 0,
      });
    }
  }

  // 2) Vision può spezzare la data in 28 / 03 / 2024 o 28 . 03 . 2024.
  // Costruiamo combinazioni tra parole vicine sulla stessa riga.
  for (let i = 0; i < top.length; i++) {
    for (let j = i + 1; j < Math.min(top.length, i + 7); j++) {
      const a = top[i];
      const b = top[j];
      if (Math.abs(a.cy - b.cy) > Math.max(a.height, b.height) * 1.8) continue;
      const gap = b.x - (a.x + a.width);
      if (gap > Math.max(a.height, b.height) * 4) break;

      const parts = [a.t, b.t];
      for (let k = j + 1; k < Math.min(top.length, j + 3); k++) {
        const c = top[k];
        if (Math.abs(a.cy - c.cy) > Math.max(a.height, c.height) * 1.8) break;
        if (c.x - (b.x + b.width) > Math.max(a.height, c.height) * 4) break;
        parts.push(c.t);
        const joined = parts.join("");
        const m = joined.match(/(\d{2})[./-]?(\d{2})[./-]?(\d{4})/);
        if (m) {
          dateCandidates.push({
            value: `${m[1]}.${m[2]}.${m[3]}`,
            x: (a.cx + c.cx) / 2,
            y: (a.cy + c.cy) / 2,
            score: 0,
          });
        }
      }
    }
  }

  if (!dateCandidates.length) return "";

  // Punteggio geometrico: la data B è normalmente a destra della B e
  // praticamente sulla stessa riga. Penalizziamo date sotto/sopra e quelle
  // troppo lontane. In caso di B letta come 8/O/0 funziona allo stesso modo.
  for (const d of dateCandidates) {
    let best = Infinity;
    for (const b of bCandidates) {
      const dx = d.x - b.cx;
      const dy = Math.abs(d.y - b.cy);
      const horizontalPenalty = dx >= -0.04 ? Math.abs(dx) : Math.abs(dx) + 0.35;
      const verticalPenalty = dy * 4;
      const upperPenalty = d.y > 0.42 ? 0.35 : 0;
      const score = horizontalPenalty + verticalPenalty + upperPenalty;
      if (score < best) best = score;
    }
    d.score = best;
  }

  // Se abbiamo trovato la B, usa la data geometricamente più vicina.
  if (bCandidates.length) {
    const viable = dateCandidates
      .filter((d) => d.score < 0.8)
      .sort((a, b) => a.score - b.score);
    if (viable.length) return viable[0].value;
  }

  // Ultimo fallback molto controllato: una data nella fascia alta/destra.
  // Non usiamo mai le date della parte bassa della prima foto.
  const upperRight = dateCandidates
    .filter((d) => d.y <= 0.35 && d.x >= 0.35)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  return upperRight[0]?.value || "";
}

function findBDate(text: string): string {
  const normalized = normalizeOcrText(text);
  const lines = normalized.split("\n").filter(Boolean);
  const date = /\b(\d{2})\s*[./-]\s*(\d{2})\s*[./-]\s*(\d{4})\b/;
  const dateValue = (m: RegExpMatchArray) => `${m[1]}.${m[2]}.${m[3]}`;

  // ================================================================
  // CAMPO B — PRIMA IMMATRICOLAZIONE
  //
  // Sul libretto italiano B si trova nella prima foto, PRIMA di C.2.1.
  // Questa relazione strutturale è molto più affidabile del tentativo di
  // indovinare la data in base all'anno o alla sua posizione nel testo OCR.
  // ================================================================

  // 1) Caso ideale: B e data sulla stessa riga.
  // Accettiamo gli errori OCR più comuni sulla lettera B: 8/O/0.
  const sameLine = /(?:^|\n)\s*\(?\s*[B8O0]\s*\)?\s*[.:\-)]?\s*[^\n]{0,35}?(\d{2})\s*[./-]\s*(\d{2})\s*[./-]\s*(\d{4})/im;
  const direct = normalized.match(sameLine);
  if (direct) return `${direct[1]}.${direct[2]}.${direct[3]}`;

  // 2) Caso Vision: B è su una riga e la data su quella successiva.
  const bOnly = /^\s*\(?\s*[B8O0]\s*\)?\s*[.:\-)]?\s*$/i;
  for (let i = 0; i < lines.length; i++) {
    if (!bOnly.test(lines[i])) continue;
    for (let j = i + 1; j <= Math.min(lines.length - 1, i + 3); j++) {
      const m = lines[j].match(date);
      if (m) return dateValue(m);
    }
  }

  // 3) Metodo strutturale del libretto: B è SEMPRE prima di C.2.1.
  // Prendiamo l'ultima data presente prima di C.2.1. In un libretto
  // standard questa è la data di prima immatricolazione, mentre le date di
  // nascita e gli altri dati vengono dopo C.2.1.
  const c21Match = normalized.search(/\(?\s*C\s*\.?\s*2\s*\.?\s*1\s*\)?/i);
  if (c21Match > 0) {
    const beforeC21 = normalized.slice(0, c21Match);
    const matches = [...beforeC21.matchAll(/(\d{2})\s*[./-]\s*(\d{2})\s*[./-]\s*(\d{4})/g)];
    if (matches.length) {
      const m = matches[matches.length - 1];
      const day = Number(m[1]);
      const month = Number(m[2]);
      const year = Number(m[3]);
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1950 && year <= new Date().getFullYear() + 1) {
        return `${m[1]}.${m[2]}.${m[3]}`;
      }
    }
  }

  // 4) Fallback: cerca B + data anche se Vision ha inserito testo OCR
  // spurio fra l'etichetta e la data.
  const compact = normalized.replace(/\s+/g, " ");
  const loose = compact.match(/(?:^|[^A-Z0-9])[B8O0][^\n]{0,60}?(\d{2})\s*[./-]\s*(\d{2})\s*[./-]\s*(\d{4})/i);
  if (loose) return `${loose[1]}.${loose[2]}.${loose[3]}`;

  // 5) Ultimo fallback: il ritaglio B è dedicato alla parte alta del primo
  // foglio. Se contiene una sola data, è B. Questa funzione viene usata sul
  // testo del ritaglio, NON sul testo della seconda foto.
  const allDates = [...normalized.matchAll(/(\d{2})\s*[./-]\s*(\d{2})\s*[./-]\s*(\d{4})/g)];
  if (allDates.length === 1) {
    const m = allDates[0];
    return `${m[1]}.${m[2]}.${m[3]}`;
  }

  return "";
}

function findExplicitBDate(text: string): string {
  const normalized = normalizeOcrText(text);
  // Pattern specifico ai libretti: (B) 26.08.2019. Non usa date generiche.
  const patterns = [
    /(?:^|\n)\s*\(?\s*B\s*\)?\s*[.:\-)]?\s*(\d{2})\s*[./-]\s*(\d{2})\s*[./-]\s*(\d{4})/im,
    /(?:^|\n)\s*\(?\s*[80O]\s*\)?\s*[.:\-)]?\s*(\d{2})\s*[./-]\s*(\d{2})\s*[./-]\s*(\d{4})/im,
  ];
  for (const re of patterns) {
    const m = normalized.match(re);
    if (m) return `${m[1]}.${m[2]}.${m[3]}`;
  }
  return "";
}

function parseVisionClientPanel(
  text: string,
  words: VisionWord[] = [],
  bRegionText: string = "",
  bRegionWords: VisionWord[] = []
): {
  cliente1: ClienteData;
  cliente2: ClienteData | null;
  immatricolazione: string;
} {
  const normalized = normalizeOcrText(text);
  const lines = normalized.split("\n").filter(Boolean);
  const comprIndex = lines.findIndex((line) => /\bCOMPR\b/i.test(line));

  const cliente1 = extractClientBlock(lines, 0, comprIndex >= 0 ? comprIndex : lines.length, false);
  let cliente2: ClienteData | null = null;

  if (comprIndex >= 0) {
    const second = extractClientBlock(lines, comprIndex, lines.length, true);
    if (second.nome || second.nascita || second.cf || second.indirizzo) cliente2 = second;
  }

  // La data di prima immatricolazione (campo B) appartiene alla prima
  // foto/pannello. NON usare una data generica della seconda foto: lì può
  // comparire il campo I (o altri campi data) e non deve diventare B.
  // Per l'immatricolazione diamo priorità ASSOLUTA al ritaglio OCR dedicato
  // al campo B della prima foto. È separato dal testo generale proprio per
  // evitare che date come quella di nascita o il campo I vengano confuse con B.
  const explicitB = findExplicitBDate(normalized);
  const immatricolazioneRaw =
    explicitB ||
    findDateInDedicatedBRegion(bRegionText, bRegionWords) ||
    findBDateFromVisionWords(words) ||
    findBDate(normalized);

  // Il form usa <input type="date">: deve ricevere YYYY-MM-DD, non DD.MM.YYYY.
  const immatricolazione = immatricolazioneRaw
    ? toInputDate(immatricolazioneRaw)
    : "";

  return { cliente1, cliente2, immatricolazione };
}

function parseVisionVehiclePanel(text: string): { veicolo: VeicoloData } {
  const normalized = normalizeOcrText(text);
  const targa = findItalianPlate(normalized);
  const veicolo = findD3Value(normalized);
  const p1 = findP1Value(normalized);
  const p3 = findP3Value(normalized);
  const bDate = findBDate(normalized);

  const cilindrata = p1.replace(/[,]/g, ".").replace(/\.0+$/, "");
  const motore = cilindrata && p3
    ? `${cilindrata}cc ${p3}`
    : cilindrata
      ? `${cilindrata}cc`
      : p3;

  return {
    veicolo: {
      veicolo,
      motore,
      targa,
      immatricolazione: bDate ? toInputDate(bDate) : "",
      revisione: "",
    },
  };
}

function validateVisionResult(
  cliente1: ClienteData,
  cliente2: ClienteData | null,
  veicolo: VeicoloData
): void {
  // La validazione non deve più scartare un'intera scansione per un singolo
  // campo che Vision ha perso. Segnaliamo solo ciò che manca davvero.
  const missing: string[] = [];
  if (!cliente1.nome.trim()) missing.push("Cliente 1: nome");
  if (!cliente1.cf.trim()) missing.push("Cliente 1: codice fiscale");
  if (!cliente1.nascita.trim()) missing.push("Cliente 1: data di nascita");
  if (!cliente1.indirizzo.trim()) missing.push("Cliente 1: indirizzo");
  if (cliente2) {
    if (!cliente2.nome.trim()) missing.push("Cliente 2: nome");
    if (!cliente2.cf.trim()) missing.push("Cliente 2: codice fiscale");
    if (!cliente2.nascita.trim()) missing.push("Cliente 2: data di nascita");
    if (!cliente2.indirizzo.trim()) missing.push("Cliente 2: indirizzo");
  }
  if (!veicolo.veicolo.trim()) missing.push("Veicolo: D.3");
  if (!veicolo.motore.trim()) missing.push("Veicolo: P.1/P.3");
  if (!veicolo.targa.trim()) missing.push("Veicolo: targa A");
  if (!veicolo.immatricolazione.trim()) missing.push("Veicolo: immatricolazione B");

  // Se mancano dati, non lanciamo un'eccezione: i valori letti correttamente
  // devono comunque arrivare nel form. L'avviso viene mostrato senza bloccare.
  if (missing.length) {
    console.warn("OCR Vision: campi non riconosciuti", missing);
  }
}

function UploadIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 16V4" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
      <path d="M7.5 8.5L12 4L16.5 8.5" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 14.5V18C5 19.1 5.9 20 7 20H17C18.1 20 19 19.1 19 18V14.5" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* =========================================================
   COMPONENTI
========================================================= */




function ScanTile({
  number,
  title,
  photo,
  status,
  progress,
  onClick,
  accent,
  background,
}: {
  number: string;
  title: string;
  photo: string;
  status: "idle" | "analisi" | "ok" | "errore";
  progress: number;
  onClick: () => void;
  accent: string;
  background: string;
}) {
  const tileAccent =
    status === "ok" ? "#22C55E" : status === "errore" ? "#EF4444" : accent;
  const tileBackground =
    status === "ok" ? "#F1FBF4" : status === "errore" ? "#FFF1F2" : background;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: "relative",
        height: 178,
        border: `2px dashed ${tileAccent}`,
        borderRadius: 22,
        background: tileBackground,
        overflow: "hidden",
        cursor: status === "analisi" ? "wait" : "pointer",
        padding: 0,
      }}
    >
      {photo && (
        <img
          src={photo}
          alt={`Foto scansione ${number}`}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.16,
          }}
        />
      )}

      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          width: 28,
          height: 28,
          borderRadius: 10,
          background: status === "ok" ? "#DCFCE7" : `${tileAccent}33`,
          color: status === "ok" ? "#15803D" : "#111827",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 900,
          fontSize: 14,
        }}
      >
        {number}
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 12,
        }}
      >
        {status === "ok" ? (
          <>
            <CheckCircleIcon color="#15803D" />
            <div style={{ marginTop: 7, fontSize: 15, fontWeight: 900, color: "#111827" }}>
              {title}
            </div>
            <div style={{ marginTop: 4, fontSize: 13, fontWeight: 800, color: "#15803D" }}>
              ✓ Analizzato
            </div>
          </>
        ) : status === "analisi" ? (
          <>
            <ScanSpinner />
            <div style={{ marginTop: 8, fontSize: 14, fontWeight: 800, color: "#111827" }}>
              Analisi...
            </div>
            <div style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: "#64748B" }}>
              {progress}%
            </div>
          </>
        ) : status === "errore" ? (
          <>
            <CameraScanIcon />
            <div style={{ marginTop: 7, fontSize: 14, fontWeight: 900, color: "#B91C1C" }}>
              Riprova
            </div>
            <div style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: "#64748B" }}>
              Foto non riconosciuta
            </div>
          </>
        ) : (
          <>
            <CameraScanIcon />
            <div style={{ marginTop: 8, fontSize: 15, fontWeight: 900, color: "#111827" }}>
              {title}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 13,
                fontWeight: 800,
                color: tileAccent,
              }}
            >
              + Foto
            </div>
          </>
        )}
      </div>
    </button>
  );
}

function InfoCard({

  icon,

  label,

  value,

  iconColor,

  href,

}: {

  icon: ReactNode;

  label: string;

  value: string;

  iconColor: string;

  href?: string;

}) {

  const content = (

    <>

      <div

        style={{

          display: "flex",

          alignItems: "center",

          gap: 8,

          marginBottom: 8,

        }}

      >

        {icon}



        <div

          style={{

            fontSize: 12,

            color: "#6B7280",

          }}

        >

          {label}

        </div>

      </div>



      <div

        style={{

          fontWeight: 700,

          fontSize: 15,

          color: "#111827",

          lineHeight: 1.2,

          wordBreak: "break-word",

        }}

      >

        {value}

      </div>

    </>

  );



  const style = {

    background: "#FFFFFF",

    borderRadius: 18,

    padding: 14,

    boxShadow: "0 3px 10px rgba(0,0,0,.06)",

    minHeight: 84,

    textDecoration: "none",

    color: "inherit",

    cursor: href ? "pointer" : "default",

    display: "block",

  } as const;



  if (href) {

    return (

      <a href={href} style={style}>

        {content}

      </a>

    );

  }



  return <div style={style}>{content}</div>;

}



function ClientChoice({

  nome,

  active,

  onClick,

}: {

  nome: string;

  active: boolean;

  onClick: () => void;

}) {

  return (

    <button

      type="button"

      onClick={onClick}

      style={{

        width: "100%",

        border: "none",

        borderBottom: "1px solid #E5E7EB",

        background: active ? "#F7F4E8" : "#FFFFFF",

        color: active ? "#111827" : "#374151",

        padding: "12px 14px",

        textAlign: "left",

        fontSize: 13,

        fontWeight: active ? 800 : 600,

        cursor: "pointer",

      }}

    >

      {nome}

    </button>

  );

}



function Section({ title }: { title: string }) {

  return (

    <div

      style={{

        marginTop: 22,

        marginBottom: 10,

        fontSize: 13,

        fontWeight: 800,

        color: "#6B7280",

        letterSpacing: ".08em",

      }}

    >

      {title}

    </div>

  );

}




function Field({

  label,

  value,

  onChange,

  type = "text",

  readOnly = false,

}: {

  label: string;

  value: string;

  onChange: (value: string) => void;

  type?: string;

  readOnly?: boolean;

}) {

  return (

    <div style={{ marginBottom: 12 }}>

      <div

        style={{

          fontSize: 13,

          color: "#6B7280",

          marginBottom: 6,

        }}

      >

        {label}

      </div>



      <input

        type={type}

        value={value}

        onChange={(e) => onChange(e.target.value)}

        readOnly={readOnly}
        style={{

          width: "100%",

          height: 48,

          borderRadius: 14,

          border: "1px solid #E5E7EB",

          padding: "0 14px",

          fontSize: 15,

          background: "#FFFFFF",

          color: "#111827",

          outline: "none",

        }}

      />

    </div>

  );

}



/* =========================================================

   ICONE

\========================================================= */



const CheckCircleIcon = ({ color }: { color: string }) => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" fill="#DCFCE7" />
    <path d="M8 12.2L10.5 14.7L16 9.3" stroke={color} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ScanSpinner = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="8.5" stroke="#CBD5E1" strokeWidth="2" />
    <path d="M12 3.5A8.5 8.5 0 0 1 20.5 12" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

function CameraSmallIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M7.5 7.5L8.7 5.5H15.3L16.5 7.5H19C20.1 7.5 21 8.4 21 9.5V17.5C21 18.6 20.1 19.5 19 19.5H5C3.9 19.5 3 18.6 3 17.5V9.5C3 8.4 3.9 7.5 5 7.5H7.5Z" stroke="#111827" strokeWidth="1.8" strokeLinejoin="round"/>
      <circle cx="12" cy="13.5" r="3.2" stroke="#111827" strokeWidth="1.8"/>
    </svg>
  );
}

const SearchIcon = () => (

  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">

    <circle

      cx="11"

      cy="11"

      r="7"

      stroke="#6B7280"

      strokeWidth="2"

    />

    <path

      d="M20 20L17 17"

      stroke="#6B7280"

      strokeWidth="2"

      strokeLinecap="round"

    />

  </svg>

);



const PlusIcon = () => (

  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">

    <path

      d="M12 5V19M5 12H19"

      stroke="#111827"

      strokeWidth="2.5"

      strokeLinecap="round"

    />

  </svg>

);



const SmallPlusIcon = () => (

  <svg width="19" height="19" viewBox="0 0 24 24" fill="none">

    <path

      d="M12 5V19M5 12H19"

      stroke="#111827"

      strokeWidth="2.4"

      strokeLinecap="round"

    />

  </svg>

);



const MinusIcon = () => (

  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">

    <path

      d="M5 12H19"

      stroke="#FFFFFF"

      strokeWidth="2.4"

      strokeLinecap="round"

    />

  </svg>

);



const ChevronDownIcon = ({ open }: { open: boolean }) => (

  <svg

    width="14"

    height="14"

    viewBox="0 0 24 24"

    fill="none"

    style={{

      transform: open ? "rotate(180deg)" : "rotate(0deg)",

      transition: "transform .15s ease",

    }}

  >

    <path

      d="M6 9L12 15L18 9"

      stroke="#6B7280"

      strokeWidth="2"

      strokeLinecap="round"

      strokeLinejoin="round"

    />

  </svg>

);



const CarIcon = () => (

  <svg width="42" height="42" viewBox="0 0 24 24" fill="none">

    <g

      stroke="#111827"

      strokeWidth="1.8"

      strokeLinecap="round"

      strokeLinejoin="round"

    >

      <path d="M2 9L4 10L5.3 6.2C5.8 4.8 6.3 4 8.3 4H15.7C17.7 4 18.2 4.8 18.7 6.2L20 10L22 9" />

      <path d="M6.8 10H17.2C20 10 22 11.4 22 14.8V17.5C22 18.9 20.9 20 19.5 20H19C17.9 20 17 19.1 17 18C17 17.7 16.8 17.5 16.5 17.5H7.5C7.2 17.5 7 17.7 7 18C7 19.1 6.1 20 5 20H4.5C3.1 20 2 18.9 2 17.5V14.8C2 11.4 4 10 6.8 10Z" />

    </g>

  </svg>

);



const CalendarIcon = () => (

  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">

    <rect

      x="3"

      y="5"

      width="18"

      height="16"

      rx="3"

      stroke="#2563EB"

      strokeWidth="2"

    />

    <path

      d="M8 3V7M16 3V7M3 10H21"

      stroke="#2563EB"

      strokeWidth="2"

      strokeLinecap="round"

    />

  </svg>

);



const PersonIcon = () => (

  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">

    <circle

      cx="12"

      cy="8"

      r="4"

      stroke="#374151"

      strokeWidth="2"

    />

    <path

      d="M4 21C4.8 16.8 7.5 14.5 12 14.5C16.5 14.5 19.2 16.8 20 21"

      stroke="#374151"

      strokeWidth="2"

      strokeLinecap="round"

    />

  </svg>

);



const PhoneIcon = () => (

  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">

    <path

      d="M6.6 3.5L8.8 3C9.4 2.9 9.9 3.2 10.1 3.7L11.1 6.2C11.3 6.7 11.2 7.2 10.8 7.6L9.3 9.1C10.2 11 11.8 12.7 13.7 13.6L15.2 12.1C15.6 11.7 16.1 11.6 16.6 11.8L19.1 12.8C19.6 13 19.9 13.5 19.8 14.1L19.3 16.3C19.2 16.8 18.8 17.2 18.4 17.4C17.5 17.8 16.6 18 15.7 18C10.3 18 6 13.7 6 8.3C6 7.4 6.2 6.5 6.6 5.6C6.8 5.2 6.2 3.5 6.6 3.5Z"

      stroke="#16A34A"

      strokeWidth="1.8"

      strokeLinecap="round"

      strokeLinejoin="round"

    />

  </svg>

);



const CardIcon = () => (

  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">

    <rect

      x="3"

      y="5"

      width="18"

      height="14"

      rx="2"

      stroke="#64748B"

      strokeWidth="2"

    />

    <path

      d="M3 9H21"

      stroke="#64748B"

      strokeWidth="2"

    />

    <path

      d="M7 14H11"

      stroke="#64748B"

      strokeWidth="2"

      strokeLinecap="round"

    />

  </svg>

);



const PaperclipIcon = () => (

  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">

    <path

      d="M8.5 12.5L14.7 6.3C16.1 4.9 18.3 4.9 19.7 6.3C21.1 7.7 21.1 9.9 19.7 11.3L11 20C8.8 22.2 5.2 22.2 3 20C0.8 17.8 0.8 14.2 3 12L10.4 4.6C12.1 2.9 14.9 2.9 16.6 4.6C18.3 6.3 18.3 9.1 16.6 10.8L9.8 17.6C8.8 18.6 7.2 18.6 6.2 17.6C5.2 16.6 5.2 15 6.2 14L12.5 7.7"

      stroke="#374151"

      strokeWidth="1.8"

      strokeLinecap="round"

      strokeLinejoin="round"

    />

  </svg>

);



const CameraScanIcon = () => (

  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">

    <g

      stroke="#8A6A00"

      strokeWidth="1.8"

      strokeLinecap="round"

      strokeLinejoin="round"

    >

      <path d="M7 4H5C4.4 4 4 4.4 4 5V7" />

      <path d="M17 4H19C19.6 4 20 4.4 20 5V7" />

      <path d="M7 20H5C4.4 20 4 19.6 4 19V17" />

      <path d="M17 20H19C19.6 20 20 19.6 20 19V17" />

      <rect x="7" y="7" width="10" height="10" rx="2" />

      <path d="M12 10V14M10 12H14" />

    </g>

  </svg>

);



const DocGreen = () => (

  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">

    <path

      d="M7 3H15L18 6V21H6V3H7Z"

      stroke="#15803D"

      strokeWidth="2"

    />

    <path

      d="M9 11H15M9 15H13"

      stroke="#15803D"

      strokeWidth="2"

      strokeLinecap="round"

    />

  </svg>

);



const CubeGold = () => (

  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">

    <path

      d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z"

      stroke="#B7791F"

      strokeWidth="2"

    />

    <path

      d="M8 6L16 10M12 12V21"

      stroke="#B7791F"

      strokeWidth="2"

    />

  </svg>

);



const PhotoGray = () => (

  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">

    <rect

      x="3"

      y="5"

      width="18"

      height="14"

      rx="2"

      stroke="#475569"

      strokeWidth="2"

    />

    <circle

      cx="9"

      cy="10"

      r="1.5"

      fill="#475569"

    />

    <path

      d="M5 17L10 12L14 15L17 12L19 14.5"

      stroke="#475569"

      strokeWidth="2"

      strokeLinecap="round"

      strokeLinejoin="round"

    />

  </svg>

);
