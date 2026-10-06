"use client";



import {

  useEffect,

  useMemo,

  useRef,

  useState,

  type CSSProperties,

  type Dispatch,

  type SetStateAction,

} from "react";

import { useRouter } from "next/navigation";

import BottomBar from "@/components/BottomBar";
import { pdf } from "@react-pdf/renderer";
import SchedaLavoroPDF, {
  type SchedaLavoroPDFData,
} from "@/app/pdf/SchedaLavoroPDF";



type VeicoloScheda = {

  nomeCliente: string;

  indirizzo: string;

  telefono: string;

  codiceFiscale: string;

  veicolo: string;

  targa: string;

};



type MediaAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
  r2Key?: string;
};

const MEDIA_DB_NAME = "goldencar_media";
const MEDIA_STORE_NAME = "files";

function openMediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(MEDIA_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MEDIA_STORE_NAME)) db.createObjectStore(MEDIA_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveMediaBlob(id: string, file: File) {
  const db = await openMediaDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE_NAME, "readwrite");
    tx.objectStore(MEDIA_STORE_NAME).put(file, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function loadMediaBlobs(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const db = await openMediaDb();
  const result = new Map<string, string>();
  await Promise.all(ids.map((id) => new Promise<void>((resolve) => {
    const tx = db.transaction(MEDIA_STORE_NAME, "readonly");
    const request = tx.objectStore(MEDIA_STORE_NAME).get(id);
    request.onsuccess = () => {
      const file = request.result as Blob | undefined;
      if (file) result.set(id, URL.createObjectURL(file));
      resolve();
    };
    request.onerror = () => resolve();
  })));
  db.close();
  return result;
}

type JobDraft = VeicoloScheda & {

  jobNumber: number;

  createdAt: string;

  kilometers: string;

  types: string[];

  problems: string[];

  products: { name: string; details: string; quantity?: string; orderRequested?: boolean }[];

  works: string[];

  labor: string;

  notes: string;

  invoiceNumber: string;

  paymentAmount: string;

  paymentStatus: "DA_PAGARE" | "PAGATO";
  media: MediaAttachment[];

  status: "IN_LAVORAZIONE" | "CONCLUSO";

  pdfUrl?: string;

  tagliando: {

    oil: boolean;

    oilType: string;

    oilQuantity: string;

    oilFilter: boolean;

    airFilter: boolean;

    cabinFilter: boolean;

    fuelFilter: boolean;

    sparkPlugs: boolean;

    other: string;

  };

  freni: {

    frontPads: boolean;

    rearPads: boolean;

    frontDiscs: boolean;

    rearDiscs: boolean;

    brakeFluid: boolean;

    calipers: boolean;

    other: string;

  };

  pneumatici: {

    mounting: boolean;

    removal: boolean;

    replacement: boolean;

    rotation: boolean;

    balancing: boolean;

    repair: boolean;

    season: string;

    quantity: string;

    storage: boolean;

    description: string;

  };

};



type SpeechRecognitionInstance = {

  lang: string;

  interimResults: boolean;

  continuous: boolean;

  onresult:

    | ((

        event: {

          results: {

            [index: number]: {

              [index: number]: { transcript: string };

            };

          };

        }

      ) => void)

    | null;

  onerror: (() => void) | null;

  onend: (() => void) | null;

  start: () => void;

  stop: () => void;

};



type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;



declare global {

  interface Window {

    SpeechRecognition?: SpeechRecognitionConstructor;

    webkitSpeechRecognition?: SpeechRecognitionConstructor;

  }

}



const TIPI = [

  "TAGLIANDO",

  "FRENI",

  "PNEUMATICI",

  "MANUTENZIONE",

  "CENTRALINA",

  "ALTRO",

];



const defaultVehicle: VeicoloScheda = {

  nomeCliente: "Mario Rossi",

  indirizzo: "Via Roma 12",

  telefono: "3471234567",

  codiceFiscale: "RSSMRA80C14L378Z",

  veicolo: "Fiat Panda",

  targa: "AB123CD",

};



function currentJobYear() {
  return new Date().getFullYear() % 100;
}

function formatJobNumber(jobNumber: number) {
  // Compatibilità con le vecchie schede numerate semplicemente 1, 2, 3...
  if (jobNumber < 1000) {
    return `${currentJobYear()}-${String(jobNumber).padStart(3, "0")}`;
  }

  const year = Math.floor(jobNumber / 1000);
  const sequence = jobNumber % 1000;

  return `${String(year).padStart(2, "0")}-${String(sequence).padStart(3, "0")}`;
}

function nextJobNumber() {
  const year = currentJobYear();
  const key = `goldencar_next_job_number_${year}`;

  const stored = Number(localStorage.getItem(key) || "0");

  // Se la numerazione annuale non esiste ancora, recuperiamo il massimo
  // delle vecchie schede per evitare duplicati.
  let nextSequence = stored > 0 ? stored : 1;

  if (!stored) {
    for (let index = 0; index < localStorage.length; index += 1) {
      const storageKey = localStorage.key(index);
      if (!storageKey?.startsWith("goldencar_job_")) continue;

      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) continue;

        const parsed = JSON.parse(raw) as { jobNumber?: number };
        const number = Number(parsed.jobNumber || 0);

        if (number >= 1000) {
          const jobYear = Math.floor(number / 1000);
          const sequence = number % 1000;
          if (jobYear === year) {
            nextSequence = Math.max(nextSequence, sequence + 1);
          }
        } else if (year === currentJobYear()) {
          // Vecchie schede del 2026, ad esempio 4 -> 26-004.
          nextSequence = Math.max(nextSequence, number + 1);
        }
      } catch {
        // Ignora eventuali record non validi.
      }
    }
  }

  localStorage.setItem(key, String(nextSequence + 1));

  // Il numero interno conserva anno + progressivo:
  // 26001 = 26-001, 27001 = 27-001, ecc.
  return year * 1000 + nextSequence;
}

function createOrReuseNewJobNumber() {
  const sessionKey = "goldencar_nuova_scheda_job_number";

  const existing = Number(sessionStorage.getItem(sessionKey) || "0");

  if (existing > 0) return existing;

  const next = nextJobNumber();

  sessionStorage.setItem(sessionKey, String(next));

  return next;
}



function emptyDraft(vehicle: VeicoloScheda): JobDraft {

  return {

    ...vehicle,

    jobNumber: createOrReuseNewJobNumber(),

    createdAt: new Date().toISOString(),

    kilometers: "",

    types: [],

    problems: [""],

    products: [],

    works: [""],

    labor: "",

    notes: "",

    invoiceNumber: "",

    paymentAmount: "",

    paymentStatus: "DA_PAGARE",

    media: [],

    status: "IN_LAVORAZIONE",

    tagliando: {

      oil: false,

      oilType: "",

      oilQuantity: "",

      oilFilter: false,

      airFilter: false,

      cabinFilter: false,

      fuelFilter: false,

      sparkPlugs: false,

      other: "",

    },

    freni: {

      frontPads: false,

      rearPads: false,

      frontDiscs: false,

      rearDiscs: false,

      brakeFluid: false,

      calipers: false,

      other: "",

    },

    pneumatici: {

      mounting: false,

      removal: false,

      replacement: false,

      rotation: false,

      balancing: false,

      repair: false,

      season: "",

      quantity: "4",

      storage: false,

      description: "",

    },

  };

}



export default function SchedaLavoroPage() {

  const router = useRouter();



  const [draft, setDraft] = useState<JobDraft | null>(null);

  const [saved, setSaved] = useState(false);

  const [recording, setRecording] = useState<string | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);



  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // In sviluppo Next/React può eseguire due volte gli effect di inizializzazione
  // (Strict Mode). Senza questo guard, una scheda esistente viene prima caricata
  // e subito dopo sovrascritta da una nuova scheda vuota.
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    try {

      const existingJobNumber = sessionStorage.getItem(

        "goldencar_apri_scheda"

      );



      if (existingJobNumber) {

        const rawJob = localStorage.getItem(

          `goldencar_job_${existingJobNumber}`

        );



        if (rawJob) {

          const parsed = JSON.parse(rawJob) as Partial<JobDraft>;
          const normalized = {
            ...parsed,
            works: Array.isArray(parsed.works)
              ? parsed.works
              : parsed.works
                ? [parsed.works]
                : [""],
            media: Array.isArray(parsed.media) ? parsed.media : [],
          } as JobDraft;

          setDraft(normalized);
          setSaved(true);

          loadMediaBlobs(normalized.media.map((item) => item.id))
            .then((urls) => {
              const nextUrls: Record<string, string> = {};
              urls.forEach((url, id) => { nextUrls[id] = url; });
              setMediaUrls(nextUrls);
            })
            .catch((error) => console.error("Errore caricamento media:", error));

          sessionStorage.removeItem("goldencar_apri_scheda");
          sessionStorage.removeItem("goldencar_nuova_scheda_job_number");

          return;

        }



        sessionStorage.removeItem("goldencar_apri_scheda");
        sessionStorage.removeItem("goldencar_nuova_scheda_job_number");

      }



      let vehicle = defaultVehicle;



      const rawVehicle = sessionStorage.getItem("goldencar_nuova_scheda");



      if (rawVehicle) {

        vehicle = {

          ...defaultVehicle,

          ...JSON.parse(rawVehicle),

        };



        sessionStorage.removeItem("goldencar_nuova_scheda");

      }



      setDraft(emptyDraft(vehicle));

    } catch (error) {

      console.error("Errore apertura scheda:", error);

      setDraft(emptyDraft(defaultVehicle));

    }

  }, []);



  const dateLabel = useMemo(() => {

    if (!draft) return "";



    return new Intl.DateTimeFormat("it-IT", {

      day: "2-digit",

      month: "2-digit",

      year: "numeric",

    }).format(new Date(draft.createdAt));

  }, [draft]);



  const updateDraft = (field: keyof JobDraft, value: string) => {

    setDraft((previous) =>

      previous

        ? ({

            ...previous,

            [field]: value,

          } as JobDraft)

        : previous

    );



    setSaved(false);

  };



  const toggleType = (type: string) => {

    setDraft((previous) => {

      if (!previous) return previous;



      const exists = previous.types.includes(type);



      return {

        ...previous,

        types: exists

          ? previous.types.filter((item) => item !== type)

          : [...previous.types, type],

      };

    });



    setSaved(false);

  };



  const updateNested = <

    K extends "tagliando" | "freni" | "pneumatici"

  >(

    section: K,

    field: keyof JobDraft[K],

    value: string | boolean

  ) => {

    setDraft((previous) =>

      previous

        ? {

            ...previous,

            [section]: {

              ...previous[section],

              [field]: value,

            },

          }

        : previous

    );



    setSaved(false);

  };



  const updateProblem = (index: number, value: string) => {

    setDraft((previous) => {

      if (!previous) return previous;



      const problems = [...previous.problems];



      problems[index] = value;



      return {

        ...previous,

        problems,

      };

    });



    setSaved(false);

  };



  const addProblem = () => {

    setDraft((previous) =>

      previous

        ? {

            ...previous,

            problems: [...previous.problems, ""],

          }

        : previous

    );

  };


  const updateWork = (index: number, value: string) => {
    setDraft((previous) => {
      if (!previous) return previous;
      const works = [...previous.works];
      works[index] = value;
      return { ...previous, works };
    });
    setSaved(false);
  };

  const addWork = () => {
    setDraft((previous) =>
      previous
        ? { ...previous, works: [...previous.works, ""] }
        : previous
    );
    setSaved(false);
  };



  const addProduct = () => {

    setDraft((previous) =>

      previous

        ? {

            ...previous,

            products: [

              ...previous.products,

              {

                name: "",

                details: "",

                quantity: "1",

              },

            ],

          }

        : previous

    );

  };



  const updateProduct = (

    index: number,

    field: "name" | "details" | "quantity",

    value: string

  ) => {

    setDraft((previous) => {

      if (!previous) return previous;



      const products = [...previous.products];



      products[index] = {

        ...products[index],

        [field]: value,

      };



      return {

        ...previous,

        products,

      };

    });



    setSaved(false);

  };



  const startVoice = (

    field: "problems" | "works" | "notes"

  ) => {

    if (recording) {

      recognitionRef.current?.stop();

      setRecording(null);

      return;

    }



    const Recognition =

      window.SpeechRecognition ||

      window.webkitSpeechRecognition;



    if (!Recognition) {

      alert(

        "La dettatura vocale non è disponibile in questo browser."

      );

      return;

    }



    const recognition = new Recognition();



    recognition.lang = "it-IT";

    recognition.interimResults = false;

    recognition.continuous = false;



    recognition.onresult = (event) => {

      const transcript =

        event.results[0]?.[0]?.transcript?.trim() || "";



      if (!transcript) return;



      setDraft((previous) => {

        if (!previous) return previous;



        if (field === "problems") {

          return {

            ...previous,

            problems: [

              ...previous.problems.filter(Boolean),

              transcript,

            ],

          };

        }



        if (field === "works") {

          return {

            ...previous,

            works: [

              ...previous.works.filter(Boolean),

              transcript,

            ],

          };

        }



        return {

          ...previous,

          [field]: previous[field]

            ? `${previous[field]} ${transcript}`

            : transcript,

        };

      });



      setSaved(false);

    };



    recognition.onerror = () => setRecording(null);

    recognition.onend = () => setRecording(null);



    recognitionRef.current = recognition;



    setRecording(field);



    recognition.start();

  };



  const getVehicleIdByPlate = (plate: string) => {
    try {
      const raw = localStorage.getItem("goldencar_vehicles");
      const vehicles = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(vehicles)) return "";
      const normalized = plate.replace(/[^A-Z0-9]/gi, "").toUpperCase();
      const found = vehicles.find(
        (item: any) =>
          String(item?.veicolo?.targa || "")
            .replace(/[^A-Z0-9]/gi, "")
            .toUpperCase() === normalized
      );
      return typeof found?.id === "string" ? found.id : "";
    } catch {
      return "";
    }
  };

  const uploadFileToR2 = async (key: string, file: Blob, contentType: string) => {
    const response = await fetch("/api/r2/file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, contentType }),
    });
    const data = await response.json();
    if (!response.ok || !data?.ok || !data?.uploadUrl) {
      throw new Error(data?.error || "Impossibile preparare l'upload R2.");
    }
    const upload = await fetch(data.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file,
    });
    if (!upload.ok) throw new Error("Upload del file su R2 non riuscito.");
  };

  const getR2DownloadUrl = async (key: string) => {
    const response = await fetch("/api/r2/file?key=" + encodeURIComponent(key));
    const data = await response.json();
    if (!response.ok || !data?.ok || !data?.downloadUrl) {
      throw new Error(data?.error || "Impossibile preparare il download R2.");
    }
    return data.downloadUrl as string;
  };

  const handleMediaFiles = async (files: FileList | null) => {
    if (!files || !files.length || !draft) return;
    const vehicleId = getVehicleIdByPlate(draft.targa);
    if (!vehicleId) {
      alert("Non è stato trovato l'ID del veicolo. Il file non può essere archiviato.");
      return;
    }
    const added: MediaAttachment[] = [];
    const nextUrls: Record<string, string> = {};
    try {
      for (const file of Array.from(files)) {
        const id =
          draft.jobNumber + "-" + Date.now() + "-" +
          Math.random().toString(36).slice(2, 9);
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const r2Key = "veicoli/" + vehicleId + "/media-" + id + "-" + safeName;
        const meta: MediaAttachment = {
          id,
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          createdAt: new Date().toISOString(),
          r2Key,
        };
        await uploadFileToR2(r2Key, file, meta.type);
        await saveMediaBlob(id, file);
        added.push(meta);
        nextUrls[id] = URL.createObjectURL(file);
      }
      setDraft((previous) =>
        previous ? { ...previous, media: [...previous.media, ...added] } : previous
      );
      setMediaUrls((previous) => ({ ...previous, ...nextUrls }));
      setSaved(false);
    } catch (error) {
      console.error("Errore upload media R2:", error);
      alert(error instanceof Error ? error.message : "Non è stato possibile archiviare il file.");
    } finally {
      if (mediaInputRef.current) mediaInputRef.current.value = "";
    }
  };

  const salvaOrdineProdotti = (lavoro: JobDraft) => {
    const daOrdinare = lavoro.products.filter(
      (product) => product.orderRequested && product.name.trim()
    );
    if (!daOrdinare.length) return;

    type OrdineSalvato = {
      id: string;
      numero: string;
      createdAt: string;
      jobNumber: number;
      cliente?: string;
      telefono?: string;
      targa?: string;
      veicolo?: string;
      prodotti: { name: string; quantity?: string; details: string }[];
      supplierId?: string;
      supplierName?: string;
      supplierPhone?: string;
    };

    let ordini: OrdineSalvato[] = [];
    try {
      const raw = localStorage.getItem("goldencar_orders");
      const parsed = raw ? JSON.parse(raw) : [];
      ordini = Array.isArray(parsed) ? parsed : [];
    } catch {
      ordini = [];
    }

    const existing = ordini.find((ordine) => ordine.jobNumber === lavoro.jobNumber);
    const nuoviProdotti = daOrdinare.map((product) => ({
      name: product.name.trim(),
      quantity: product.quantity || "1",
      details: product.details.trim(),
    }));

    if (existing) {
      const merged = [...(existing.prodotti || [])];
      for (const product of nuoviProdotti) {
        const index = merged.findIndex(
          (item) => item.name.toLowerCase() === product.name.toLowerCase()
        );
        if (index >= 0) merged[index] = product;
        else merged.push(product);
      }
      existing.prodotti = merged;
      existing.cliente = lavoro.nomeCliente;
      existing.telefono = lavoro.telefono;
      existing.targa = lavoro.targa;
      existing.veicolo = lavoro.veicolo;
    } else {
      const nextNumber =
        ordini.reduce((max, ordine) => {
          const n = Number(String(ordine.numero || "").replace(/\D/g, ""));
          return Number.isFinite(n) ? Math.max(max, n) : max;
        }, 0) + 1;

      ordini.unshift({
        id: `ordine-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        numero: String(nextNumber).padStart(3, "0"),
        createdAt: new Date().toISOString(),
        jobNumber: lavoro.jobNumber,
        cliente: lavoro.nomeCliente,
        telefono: lavoro.telefono,
        targa: lavoro.targa,
        veicolo: lavoro.veicolo,
        prodotti: nuoviProdotti,
      });
    }

    localStorage.setItem("goldencar_orders", JSON.stringify(ordini));
  };

  const generateAndOpenPdf = async (lavoro: JobDraft) => {
    try {
      const pdfData: SchedaLavoroPDFData = {
        nomeCliente: lavoro.nomeCliente,
        indirizzo: lavoro.indirizzo,
        telefono: lavoro.telefono,
        codiceFiscale: lavoro.codiceFiscale,
  
        veicolo: lavoro.veicolo,
        targa: lavoro.targa,
        kilometers: lavoro.kilometers,
  
        jobNumber: lavoro.jobNumber,
        createdAt: lavoro.createdAt,
        labor: lavoro.labor,
        workType: lavoro.types?.join(" · ") || "",
  
        problems: lavoro.problems,
  
        works: lavoro.works.filter(Boolean).join("\n"),
  
        products: lavoro.products,
  
        notes: lavoro.notes,
  
        invoiceNumber: lavoro.invoiceNumber,
  
        status: lavoro.status,
      };
  
      const blob = await pdf(
        <SchedaLavoroPDF lavoro={pdfData} />
      ).toBlob();
  
      const url = URL.createObjectURL(blob);
  
      window.open(url, "_blank", "noopener,noreferrer");
  
    } catch (error) {
      console.error("Errore generazione PDF:", error);
  
      alert(
        "Non è stato possibile generare il PDF della scheda."
      );
    }
  };

  const saveDraft = async (conclude = false) => {
    if (!draft) return;
  
    if (conclude) {
      const missing: string[] = [];

      if (!draft.kilometers.trim()) missing.push("chilometri");
      if (!draft.labor.trim()) missing.push("manodopera");
      if (!draft.invoiceNumber.trim()) missing.push("numero di fattura");

      if (missing.length) {
        alert(
          `Prima di concludere il lavoro devi inserire: ${missing.join(", ")}.`
        );
        return;
      }

      const confirmed = window.confirm(
        "Sei sicuro di voler concludere questo lavoro?\n\nUna volta concluso, la scheda verrà considerata definitiva."
      );
  
      if (!confirmed) return;
    }
  
    const next = {
      ...draft,
      status: conclude
        ? "CONCLUSO"
        : "IN_LAVORAZIONE",
    } as JobDraft;
  
    localStorage.setItem(
      `goldencar_job_${draft.jobNumber}`,
      JSON.stringify(next)
    );
  
    salvaOrdineProdotti(next);
  
    sessionStorage.removeItem(
      "goldencar_nuova_scheda_job_number"
    );
  
    setDraft(next);
    setSaved(true);
  
    if (conclude) {
      await generateAndOpenPdf(next);
    }
  };




  const deleteMediaBlobs = async (ids: string[]) => {
    if (!ids.length) return;
    const db = await openMediaDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE_NAME, "readwrite");
      const store = tx.objectStore(MEDIA_STORE_NAME);
      ids.forEach((id) => store.delete(id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  };

  const deleteCurrentJob = async () => {
    if (!draft) return;

    try {
      localStorage.removeItem(`goldencar_job_${draft.jobNumber}`);
      await deleteMediaBlobs(draft.media.map((item) => item.id));

      const rawManual = localStorage.getItem("goldencar_pagamenti_manuali");
      if (rawManual) {
        try {
          const manualPayments = JSON.parse(rawManual);
          if (Array.isArray(manualPayments)) {
            localStorage.setItem(
              "goldencar_pagamenti_manuali",
              JSON.stringify(
                manualPayments.filter(
                  (item: { jobNumber?: number }) =>
                    item.jobNumber !== draft.jobNumber
                )
              )
            );
          }
        } catch {
          // Leave the store untouched if it is malformed.
        }
      }

      setDeleteConfirmOpen(false);
      // Ricarica la pagina Veicolo dopo l'eliminazione, così la cronologia
      // viene riletta dal localStorage anche in StackBlitz.
      window.location.href = "/veicolo";
    } catch (error) {
      console.error("Errore eliminazione scheda:", error);
      alert("Non è stato possibile eliminare completamente la scheda.");
    }
  };

  const openInvoicing = () => {

    saveDraft(false);



    alert(

      "Qui collegheremo il sito di fatturazione che utilizzi. Per ora la scheda viene salvata prima di uscire."

    );

  };



  const openPdf = () => {

    if (!draft) return;



    if (draft.pdfUrl) {

      window.open(

        draft.pdfUrl,

        "_blank",

        "noopener,noreferrer"

      );

      return;

    }



    alert(

      "Il PDF verrà collegato qui quando implementeremo la generazione dell'archivio."

    );

  };



  if (!draft) {

    return (

      <main className="app">

        <div

          style={{

            padding: 30,

            textAlign: "center",

          }}

        >

          Caricamento scheda...

        </div>



        <BottomBar />

      </main>

    );

  }



  const inputStyle: CSSProperties = {

    width: "100%",

    border: "1px solid #E5E7EB",

    borderRadius: 14,

    padding: "13px 14px",

    fontSize: 15,

    fontWeight: 400,

    color: "#111827",

    background: "#FFFFFF",

    outline: "none",

  };



  const sectionStyle: CSSProperties = {

    background: "#FFFFFF",

    borderRadius: 22,

    padding: 18,

    boxShadow: "0 4px 14px rgba(15,23,42,.07)",

  };

  const isReadOnly = draft.status === "CONCLUSO";



  return (

    <>

      <main

        className="app"

        style={{

          paddingBottom: 150,

        }}

      >

        <div

          style={{

            padding: "22px 18px 18px",

          }}

        >

          <button

            type="button"

            onClick={() => router.back()}

            aria-label="Indietro"

            style={{

              width: 42,

              height: 42,

              border: 0,

              borderRadius: 13,

              background: "#FFFFFF",

              display: "grid",

              placeItems: "center",

              cursor: "pointer",

              padding: 0,

            }}

          >

            <svg

              width="21"

              height="21"

              viewBox="0 0 24 24"

              fill="none"

              stroke="currentColor"

              strokeWidth="2"

              strokeLinecap="round"

              strokeLinejoin="round"

              style={{ color: "#041E49" }}

            >

              <path d="m15 18-6-6 6-6" />

            </svg>

          </button>



          <div

            style={{

              display: "flex",

              alignItems: "center",

              justifyContent: "space-between",

              gap: 10,

              marginTop: 24,

            }}

          >

            <h1

              style={{

                margin: 0,

                fontSize: 24,

                lineHeight: 1,

                fontWeight: 900,

                letterSpacing: "-.04em",

                color: "#111827",

                whiteSpace: "nowrap",

              }}

            >

              SCHEDA LAVORO

            </h1>



            <span

              style={{

                fontSize: 8,

                lineHeight: 1,

                fontWeight: 800,

                color:

                  draft.status === "CONCLUSO"

                    ? "#15803D"

                    : "#A16207",

                background:

                  draft.status === "CONCLUSO"

                    ? "#DCFCE7"

                    : "#FFF1C2",

                padding: "6px 8px",

                borderRadius: 999,

                whiteSpace: "nowrap",

              }}

            >

              {draft.status === "CONCLUSO"

                ? "CONCLUSO"

                : "IN LAVORAZIONE"}

            </span>

          </div>



          <div

            style={{

              color: "#64748B",

              fontSize: 13,

              fontWeight: 700,

              marginTop: 7,

            }}

          >

            SCHEDA {formatJobNumber(draft.jobNumber)} · {dateLabel}

          </div>

        </div>



        <section

          style={{

            ...sectionStyle,

            margin: "0 18px 14px",

          }}

        >



          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div
              style={{
                fontSize: 21,
                fontWeight: 900,
                color: "#111827",
              }}
            >
              {draft.veicolo}
            </div>

            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              aria-label="Elimina scheda lavoro"
              style={{
                width: 40,
                height: 40,
                border: 0,
                borderRadius: 12,
                background: "#FEE2E2",
                color: "#DC2626",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <TrashIcon />
            </button>
          </div>



          <div

            style={{

              color: "#475569",

              marginTop: 4,

              fontSize: 16,

              fontWeight: 700,

            }}

          >

            {draft.targa}

          </div>



          <div

            style={{

              display: "grid",

              gridTemplateColumns: "1fr 1fr",

              gap: 12,

              marginTop: 16,

            }}

          >

            {[

              ["NOME CLIENTE", draft.nomeCliente],

              ["TELEFONO", draft.telefono],

              ["INDIRIZZO", draft.indirizzo],

              ["CODICE FISCALE", draft.codiceFiscale],

            ].map(([label, value]) => (

              <div

                key={label}

                style={{

                  background: "#F8FAFC",

                  borderRadius: 14,

                  padding: 11,

                }}

              >

                <div

                  style={{

                    fontSize: 11,

                    color: "#64748B",

                    fontWeight: 700,

                  }}

                >

                  {label}

                </div>



                <div

                  style={{

                    fontSize: 14,

                    color: "#111827",

                    fontWeight: 700,

                    marginTop: 3,

                    wordBreak: "break-word",

                  }}

                >

                  {value || "—"}

                </div>

              </div>

            ))}

          </div>

        </section>

        <fieldset
          disabled={isReadOnly}
          style={{
            border: 0,
            padding: 0,
            margin: 0,
            minWidth: 0,
          }}
        >

        <section

          style={{

            ...sectionStyle,

            margin: "0 18px 14px",

          }}

        >

          <SectionTitle title="CHILOMETRI" />



          <input

            value={draft.kilometers}

            onChange={(e) =>

              updateDraft("kilometers", e.target.value)

            }

            inputMode="numeric"

            placeholder="Inserisci i km"

            style={inputStyle}

          />

        </section>



        <section

          style={{

            ...sectionStyle,

            margin: "0 18px 14px",

          }}

        >

          <SectionTitle title="TIPO DI LAVORO" />



          <div

            style={{

              display: "grid",

              gridTemplateColumns: "1fr 1fr",

              gap: 9,

            }}

          >

            {TIPI.map((type) => {

              const active = draft.types.includes(type);



              return (

                <button

                  key={type}

                  type="button"

                  onClick={() => toggleType(type)}

                  style={{

                    border: active

                      ? "2px solid #D4AF37"

                      : "1px solid #E5E7EB",

                    background: active

                      ? "#FFF8DB"

                      : "#FFFFFF",

                    borderRadius: 14,

                    padding: "12px 10px",

                    fontSize: 13,

                    fontWeight: 800,

                    color: "#111827",

                  }}

                >

                  {active ? "✓ " : ""}

                  {type}

                </button>

              );

            })}

          </div>

        </section>



        {draft.types.length > 0 && (

          <>

            {draft.types.includes("TAGLIANDO") && (

              <section

                style={{

                  ...sectionStyle,

                  margin: "0 18px 14px",

                }}

              >

                <SectionTitle title="TAGLIANDO" />



                <ProductChecklist

                  products={[

                    "Olio motore",

                    "Filtro olio",

                    "Filtro aria",

                    "Filtro abitacolo",

                    "Filtro carburante",

                    "Candele",

                    "Liquido refrigerante",

                    "Lavavetri",

                  ]}

                  draft={draft}

                  setDraft={setDraft}

                  updateProduct={updateProduct}

                  addProduct={addProduct}

                  markUnsaved={() => setSaved(false)}

                />

              </section>

            )}



            {draft.types.includes("FRENI") && (

              <section

                style={{

                  ...sectionStyle,

                  margin: "0 18px 14px",

                }}

              >

                <SectionTitle title="FRENI" />



                <ProductChecklist

                  products={[

                    "Pastiglie anteriori",

                    "Pastiglie posteriori",

                    "Dischi anteriori",

                    "Dischi posteriori",

                    "Liquido freni",

                    "Pinze",

                  ]}

                  draft={draft}

                  setDraft={setDraft}

                  updateProduct={updateProduct}

                  addProduct={addProduct}

                  markUnsaved={() => setSaved(false)}

                />

              </section>

            )}



            {draft.types.includes("PNEUMATICI") && (

              <section

                style={{

                  ...sectionStyle,

                  margin: "0 18px 14px",

                }}

              >

                <SectionTitle title="PNEUMATICI" />



                <div

                  style={{

                    display: "grid",

                    gridTemplateColumns: "1fr 1fr",

                    gap: 8,

                  }}

                >

                  {[

                    ["Montaggio", "mounting"],

                    ["Smontaggio", "removal"],

                    ["Sostituzione", "replacement"],

                    ["Inversione", "rotation"],

                    ["Equilibratura", "balancing"],

                    ["Riparazione", "repair"],

                  ].map(([label, key]) => (

                    <CheckRow

                      key={key}

                      label={label}

                      checked={

                        draft.pneumatici[

                          key as keyof typeof draft.pneumatici

                        ] as boolean

                      }

                      onChange={(value) =>

                        updateNested(

                          "pneumatici",

                          key as keyof typeof draft.pneumatici,

                          value

                        )

                      }

                      compact

                    />

                  ))}

                </div>



                <div

                  style={{

                    display: "grid",

                    gridTemplateColumns: "1fr 100px",

                    gap: 8,

                    marginTop: 10,

                  }}

                >

                  <select

                    value={draft.pneumatici.season}

                    onChange={(e) =>

                      updateNested(

                        "pneumatici",

                        "season",

                        e.target.value

                      )

                    }

                    style={inputStyle}

                  >

                    <option value="">Stagione</option>

                    <option>Estivi</option>

                    <option>Invernali</option>

                    <option>4 stagioni</option>

                  </select>



                  <input

                    value={draft.pneumatici.quantity}

                    onChange={(e) =>

                      updateNested(

                        "pneumatici",

                        "quantity",

                        e.target.value

                      )

                    }

                    inputMode="numeric"

                    placeholder="Qtà"

                    style={inputStyle}

                  />

                </div>



                <CheckRow

                  label="Deposito pneumatici"

                  checked={draft.pneumatici.storage}

                  onChange={(value) =>

                    updateNested(

                      "pneumatici",

                      "storage",

                      value

                    )

                  }

                />



                <input

                  value={draft.pneumatici.description}

                  onChange={(e) =>

                    updateNested(

                      "pneumatici",

                      "description",

                      e.target.value

                    )

                  }

                  placeholder="Dimensione / descrizione"

                  style={{

                    ...inputStyle,

                    marginTop: 8,

                  }}

                />

              </section>

            )}



            {draft.types.includes("MANUTENZIONE") && (

              <>

                <section

                  style={{

                    ...sectionStyle,

                    margin: "0 18px 14px",

                  }}

                >

                  <FieldHeader

                    title="PROBLEMI RISCONTRATI"

                    recording={recording === "problems"}

                    onVoice={() =>

                      startVoice("problems")

                    }

                  />



                  {draft.problems.map(

                    (problem, index) => (

                      <div

                        key={index}

                        style={{

                          display: "flex",

                          gap: 8,

                          alignItems: "center",

                          marginTop: 8,

                        }}

                      >

                        <span

                          style={{

                            color: "#D4AF37",

                            fontWeight: 900,

                          }}

                        >

                          •

                        </span>



                        <input

                          value={problem}

                          onChange={(e) =>

                            updateProblem(

                              index,

                              e.target.value

                            )

                          }

                          placeholder="Problema riscontrato"

                          style={inputStyle}

                        />

                      </div>

                    )

                  )}



                  <button

                    type="button"

                    onClick={addProblem}

                    style={addButtonStyle}

                  >

                    + AGGIUNGI PROBLEMA

                  </button>

                </section>



                <section

                  style={{

                    ...sectionStyle,

                    margin: "0 18px 14px",

                  }}

                >

                  <SectionTitle title="PRODOTTI / RICAMBI" />



                  <ProductChecklist

                    products={[

                      "Olio motore",

                      "Filtro olio",

                      "Filtro aria",

                      "Filtro abitacolo",

                      "Filtro carburante",

                      "Candele",

                      "Pastiglie freni",

                      "Dischi freno",

                      "Liquido freni",

                      "Liquido refrigerante",

                      "Lavavetri",

                      "Batteria",

                      "Lampadine",

                      "Spazzole tergicristallo",

                      "Pneumatici",

                    ]}

                    draft={draft}

                    setDraft={setDraft}

                    updateProduct={updateProduct}

                    addProduct={addProduct}

                    markUnsaved={() => setSaved(false)}

                  />

                </section>



                <section

                  style={{

                    ...sectionStyle,

                    margin: "0 18px 14px",

                  }}

                >

                  <FieldHeader

                    title="LAVORI EFFETTUATI"

                    recording={recording === "works"}

                    onVoice={() =>

                      startVoice("works")

                    }

                  />



                  {draft.works.map((work, index) => (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        marginTop: 8,
                      }}
                    >
                      <span style={{ color: "#D4AF37", fontWeight: 900 }}>•</span>
                      <input
                        value={work}
                        onChange={(e) => updateWork(index, e.target.value)}
                        placeholder="Lavoro effettuato"
                        style={inputStyle}
                      />
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addWork}
                    style={addButtonStyle}
                  >
                    + AGGIUNGI LAVORO
                  </button>

                </section>

              </>

            )}



            {draft.types.includes("CENTRALINA") && (

              <section

                style={{

                  ...sectionStyle,

                  margin: "0 18px 14px",

                }}

              >

                <SectionTitle title="CENTRALINA" />

                {draft.works.map((work, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      marginTop: 8,
                    }}
                  >
                    <span style={{ color: "#D4AF37", fontWeight: 900 }}>•</span>
                    <input
                      value={work}
                      onChange={(e) => updateWork(index, e.target.value)}
                      placeholder="Lavoro effettuato"
                      style={inputStyle}
                    />
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addWork}
                  style={addButtonStyle}
                >
                  + AGGIUNGI LAVORO
                </button>

              </section>

            )}



            {draft.types.includes("ALTRO") && (

              <section

                style={{

                  ...sectionStyle,

                  margin: "0 18px 14px",

                }}

              >

                <SectionTitle title="ALTRO" />



                  {draft.works.map((work, index) => (
                    <div
                      key={index}
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        marginTop: 8,
                      }}
                    >
                      <span style={{ color: "#D4AF37", fontWeight: 900 }}>•</span>
                      <input
                        value={work}
                        onChange={(e) => updateWork(index, e.target.value)}
                        placeholder="Lavoro effettuato"
                        style={inputStyle}
                      />
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addWork}
                    style={addButtonStyle}
                  >
                    + AGGIUNGI LAVORO
                  </button>

              </section>

            )}



            {(draft.types.includes("TAGLIANDO") ||

              draft.types.includes("FRENI") ||

              draft.types.includes("PNEUMATICI") ||

              draft.types.includes("MANUTENZIONE") ||

              draft.types.includes("CENTRALINA") ||

              draft.types.includes("ALTRO")) && (

              <section

                style={{

                  ...sectionStyle,

                  margin: "0 18px 14px",

                }}

              >

                <SectionTitle title="MANODOPERA" />



                <input

                  value={draft.labor}

                  onChange={(e) =>

                    updateDraft(

                      "labor",

                      e.target.value

                    )

                  }

                  placeholder="Ore / importo / descrizione"

                  style={inputStyle}

                />

              </section>

            )}



            <section

              style={{

                ...sectionStyle,

                margin: "0 18px 14px",

              }}

            >

              <FieldHeader

                title="NOTE"

                recording={recording === "notes"}

                onVoice={() =>

                  startVoice("notes")

                }

              />



              <textarea

                value={draft.notes}

                onChange={(e) =>

                  updateDraft(

                    "notes",

                    e.target.value

                  )

                }

                placeholder="Note aggiuntive..."

                style={{

                  ...inputStyle,

                  minHeight: 100,

                  resize: "vertical",

                  marginTop: 8,

                }}

              />

            </section>



            <section

              style={{

                ...sectionStyle,

                margin: "0 18px 14px",

              }}

            >

              <SectionTitle title="FATTURAZIONE" />



              <div

                style={{

                  display: "grid",

                  gridTemplateColumns: "1fr auto",

                  gap: 8,

                }}

              >

                <input

                  value={draft.invoiceNumber}

                  onChange={(e) =>

                    updateDraft(

                      "invoiceNumber",

                      e.target.value

                    )

                  }

                  placeholder="Numero fattura"

                  style={inputStyle}

                />



                <button

                  type="button"

                  onClick={openInvoicing}

                  style={{

                    border: 0,

                    borderRadius: 14,

                    padding: "0 14px",

                    background: "#111827",

                    color: "#FFFFFF",

                    fontWeight: 800,

                    display: "flex",

                    alignItems: "center",

                    justifyContent: "center",

                  }}

                >

                  <GlobeIcon />

                </button>

              </div>



              <div

                style={{

                  fontSize: 12,

                  color: "#94A3B8",

                  marginTop: 7,

                }}

              >

                Il pulsante apre il sito di fatturazione

                in una nuova scheda. La scheda viene

                salvata prima dell'apertura.

              </div>

            </section>

                  <section style={{ ...sectionStyle, margin: "0 18px 14px" }}>
                        <SectionTitle title="MEDIA" />
                        <input
                          ref={mediaInputRef}
                          type="file"
                          multiple
                          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                          onChange={(e) => handleMediaFiles(e.target.files)}
                          style={{ display: "none" }}
                        />
                        <button
                          type="button"
                          onClick={() => mediaInputRef.current?.click()}
                          style={{ width: "100%", minHeight: 92, border: "1.5px dashed #CBD5E1", borderRadius: 16, background: "#F8FAFC", color: "#64748B", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7, cursor: "pointer" }}
                        >
                          <span style={{ fontSize: 28, lineHeight: 1 }}>＋</span>
                          <span style={{ fontSize: 13, fontWeight: 800 }}>AGGIUNGI FOTO O DOCUMENTI</span>
                        </button>
                        {draft.media.length > 0 && (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 9, marginTop: 10 }}>
                            {draft.media.map((item) => {
                              const url = mediaUrls[item.id];
                              const isImage = item.type.startsWith("image/");
                              return (
                                <button key={item.id} type="button" onClick={() => url && window.open(url, "_blank", "noopener,noreferrer")} style={{ border: 0, padding: 0, background: "#F8FAFC", borderRadius: 12, overflow: "hidden", minHeight: 82, cursor: url ? "pointer" : "default" }}>
                                  {isImage && url ? (
                                    <img src={url} alt={item.name} style={{ width: "100%", height: 82, objectFit: "cover", display: "block" }} />
                                  ) : (
                                    <div style={{ padding: 10, height: 82, boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5 }}>
                                      <div style={{ fontSize: 24 }}>▣</div>
                                      <div style={{ width: "100%", fontSize: 10, fontWeight: 800, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </section>

                      <section style={{ ...sectionStyle, margin: "0 18px 14px" }}>
                        <SectionTitle title="PAGAMENTO" />

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            saved && draft.paymentAmount.trim()
                              ? "1fr auto"
                              : "1fr",
                          gap: 8,
                        }}
                      >

                        <input
                          value={draft.paymentAmount}
                          onChange={(e) =>
                            updateDraft(
                              "paymentAmount",
                              e.target.value
                            )
                          }
                          inputMode="decimal"
                          placeholder="Importo da pagare"
                          style={inputStyle}
                        />

                        {saved && draft.paymentAmount.trim() && (
                          <div
                            style={{
                              minWidth: 92,
                              minHeight: 34,
                              borderRadius: 10,
                              padding: "0 10px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background:
                                draft.paymentStatus === "PAGATO"
                                  ? "#DCFCE7"
                                  : "#FFF1C2",
                              color:
                                draft.paymentStatus === "PAGATO"
                                  ? "#15803D"
                                  : "#A16207",
                              fontSize: 10,
                              fontWeight: 900,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {draft.paymentStatus === "PAGATO"
                              ? "PAGATO"
                              : "DA PAGARE"}
                          </div>
                        )}

                      </div>
                    </section>

          </>

        )}






        </fieldset>

        {draft.status === "CONCLUSO" ? (

          <div

            style={{

              padding: "0 18px",

            }}

          >

            <button

              type="button"

              onClick={openPdf}

              style={{

                width: "100%",

                height: 46,

                border: 0,

                borderRadius: 14,

                background: "#111827",

                color: "#FFFFFF",

                fontSize: 14,

                fontWeight: 900,

                boxShadow:

                  "0 4px 14px rgba(15,23,42,.10)",

              }}

            >

              APRI PDF DEL LAVORO

            </button>

          </div>

        ) : (

          <div

            style={{

              padding: "0 18px",

              display: "flex",

              alignItems: "center",

              justifyContent: "space-between",

              gap: 12,

            }}

          >

            <button

              type="button"

              onClick={() => saveDraft(true)}

              style={{

                height: 42,

                padding: "0 16px",

                border: 0,

                borderRadius: 13,

                background: "#15803D",

                color: "#FFFFFF",

                fontSize: 13,

                fontWeight: 800,

                boxShadow:

                  "0 4px 12px rgba(21,128,61,.18)",

              }}

            >

              CONCLUDI

            </button>



            <button

              type="button"

              onClick={() => saveDraft(false)}

              style={{

                height: 42,

                padding: "0 18px",

                border: 0,

                borderRadius: 13,

                background: "#FFFFFF",

                color: "#111827",

                fontSize: 13,

                fontWeight: 800,

                boxShadow:

                  "0 4px 14px rgba(15,23,42,.08)",

              }}

            >

              {saved ? "✓ SALVATO" : "SALVA"}

            </button>

          </div>

        )}

        {deleteConfirmOpen && (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              background: "rgba(15,23,42,.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 18,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 420,
                background: "#FFFFFF",
                borderRadius: 22,
                padding: 22,
                boxShadow: "0 18px 50px rgba(15,23,42,.20)",
              }}
            >
              <div style={{ fontSize: 19, fontWeight: 900, color: "#111827" }}>
                ELIMINARE SCHEDA LAVORO?
              </div>

              <div
                style={{
                  marginTop: 9,
                  fontSize: 14,
                  lineHeight: 1.45,
                  color: "#64748B",
                }}
              >
                Stai per eliminare definitivamente la scheda {formatJobNumber(draft.jobNumber)}.
                Verranno eliminati anche i media e i dati di pagamento collegati.
                <br />
                <strong style={{ color: "#111827" }}>
                  Questa operazione non può essere annullata.
                </strong>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 9,
                  marginTop: 20,
                }}
              >
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(false)}
                  style={{
                    height: 42,
                    padding: "0 16px",
                    border: 0,
                    borderRadius: 13,
                    background: "#F1F5F9",
                    color: "#334155",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  ANNULLA
                </button>

                <button
                  type="button"
                  onClick={deleteCurrentJob}
                  style={{
                    height: 42,
                    padding: "0 16px",
                    border: 0,
                    borderRadius: 13,
                    background: "#DC2626",
                    color: "#FFFFFF",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  ELIMINA
                </button>
              </div>
            </div>
          </div>
        )}

      </main>



      <BottomBar />

    </>

  );

}



const addButtonStyle: CSSProperties = {

  border: 0,

  background: "transparent",

  color: "#A16207",

  fontWeight: 800,

  fontSize: 13,

  padding: "8px 0",

};



function TrashIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 7h14"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M9 7V4.5h6V7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 7.5 8.4 19h7.2l.9-11.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.5 10.5v5.5M13.5 10.5v5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GlobeIcon() {

  return (

    <svg

      width="20"

      height="20"

      viewBox="0 0 24 24"

      fill="none"

      aria-hidden="true"

    >

      <circle

        cx="12"

        cy="12"

        r="9"

        stroke="currentColor"

        strokeWidth="2"

      />

      <path

        d="M3 12h18M12 3c2.2 2.4 3.3 5.4 3.3 9s-1.1 6.6-3.3 9c-2.2-2.4-3.3-5.4-3.3-9S9.8 5.4 12 3Z"

        stroke="currentColor"

        strokeWidth="2"

        strokeLinecap="round"

      />

    </svg>

  );

}



function SectionTitle({

  title,

}: {

  title: string;

}) {

  return (

    <div

      style={{

        fontSize: 15,

        fontWeight: 800,

        color: "#111827",

        textTransform: "uppercase",

        marginBottom: 8,

      }}

    >

      {title}

    </div>

  );

}



function MicIcon() {

  return (

    <svg

      width="20"

      height="20"

      viewBox="0 0 24 24"

      fill="none"

      aria-hidden="true"

    >

      <rect

        x="8"

        y="3"

        width="8"

        height="12"

        rx="4"

        stroke="currentColor"

        strokeWidth="2"

      />

      <path

        d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"

        stroke="currentColor"

        strokeWidth="2"

        strokeLinecap="round"

      />

    </svg>

  );

}



function PackageIcon({ active = false }: { active?: boolean }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z" stroke={active ? "#A16207" : "currentColor"} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M4.5 8.5 12 13l7.5-4.5M12 13v7" stroke={active ? "#A16207" : "currentColor"} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function ProductChecklist({

  products,

  draft,

  setDraft,

  updateProduct,

  addProduct,

  markUnsaved,

}: {

  products: string[];

  draft: JobDraft;

  setDraft: Dispatch<

    SetStateAction<JobDraft | null>

  >;

  updateProduct: (

    index: number,

    field: "name" | "details" | "quantity",

    value: string

  ) => void;

  addProduct: () => void;

  markUnsaved: () => void;

}) {

  const toggleOrderRequested = (index: number) => {
    setDraft((previous) => {
      if (!previous) return previous;
      const products = [...previous.products];
      products[index] = {
        ...products[index],
        orderRequested: !products[index].orderRequested,
      };
      return { ...previous, products };
    });
    markUnsaved();
  };

  return (

    <>

      <div

        style={{

          fontSize: 12,

          color: "#94A3B8",

          marginBottom: 8,

        }}

      >

        Seleziona ciò che hai utilizzato. Per ogni

        prodotto puoi indicare quantità, marca, codice

        o altri dettagli.

      </div>



      {products.map((name) => {

        const index = draft.products.findIndex(

          (product) => product.name === name

        );



        const selected = index >= 0;



        const product = selected

          ? draft.products[index]

          : undefined;



        return (

          <div

            key={name}

            style={{

              display: "grid",

              gridTemplateColumns:

                selected
                  ? "minmax(0,1fr) 62px minmax(0,1fr) 34px"
                  : "minmax(0,1fr) 62px minmax(0,1fr)",

              gap: 7,

              alignItems: "center",

              padding: "5px 0",

            }}

          >

            <label

              style={{

                display: "flex",

                alignItems: "center",

                gap: 8,

                fontSize: 14,

                fontWeight: 700,

                color: "#334155",

                minWidth: 0,

              }}

            >

              <input

                type="checkbox"

                checked={selected}

                onChange={(e) => {

                  if (e.target.checked) {

                    setDraft((previous) =>

                      previous

                        ? {

                            ...previous,

                            products: [

                              ...previous.products,

                              {

                                name,

                                details: "",

                                quantity: "1",

                              },

                            ],

                          }

                        : previous

                    );

                  } else {

                    setDraft((previous) =>

                      previous

                        ? {

                            ...previous,

                            products:

                              previous.products.filter(

                                (item) =>

                                  item.name !== name

                              ),

                          }

                        : previous

                    );

                  }

                }}

                style={{

                  width: 20,

                  height: 20,

                  accentColor: "#D4AF37",

                  flexShrink: 0,

                }}

              />



              <span

                style={{

                  overflow: "hidden",

                  textOverflow: "ellipsis",

                }}

              >

                {name}

              </span>

            </label>



            {selected ? (

              <>

                <input

                  value={product?.quantity ?? "1"}

                  onChange={(e) =>

                    updateProduct(

                      index,

                      "quantity",

                      e.target.value

                    )

                  }

                  inputMode="numeric"

                  placeholder="Qtà"

                  style={{

                    width: "100%",

                    border:

                      "1px solid #E5E7EB",

                    borderRadius: 14,

                    padding: "11px 8px",

                    fontSize: 16,

                    color: "#111827",

                    background: "#FFFFFF",

                    outline: "none",

                    textAlign: "center",

                  }}

                />



                <input

                  value={product?.details ?? ""}

                  onChange={(e) =>

                    updateProduct(

                      index,

                      "details",

                      e.target.value

                    )

                  }

                  placeholder="Marca, codice..."

                  style={{

                    width: "100%",

                    border:

                      "1px solid #E5E7EB",

                    borderRadius: 14,

                    padding: "11px 10px",

                    fontSize: 16,

                    color: "#111827",

                    background: "#FFFFFF",

                    outline: "none",

                  }}

                />

                <button
                  type="button"
                  onClick={() => toggleOrderRequested(index)}
                  title={product?.orderRequested ? "Ordine già richiesto" : "Aggiungi all'ordine"}
                  aria-label={product?.orderRequested ? "Ordine già richiesto" : "Aggiungi all'ordine"}
                  style={{
                    width: 34,
                    height: 34,
                    border: product?.orderRequested ? "1px solid #D4AF37" : "1px solid #E5E7EB",
                    borderRadius: 10,
                    background: product?.orderRequested ? "#FFF8DB" : "#FFFFFF",
                    color: product?.orderRequested ? "#A16207" : "#64748B",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  <PackageIcon active={Boolean(product?.orderRequested)} />
                </button>

              </>

            ) : (

              <>

                <div />

                <div />

              </>

            )}

          </div>

        );

      })}



      <button

        type="button"

        onClick={addProduct}

        style={addButtonStyle}

      >

        + ALTRO PRODOTTO

      </button>



      {draft.products

        .filter(

          (product) => !products.includes(product.name)

        )

        .map((product) => {

          const index = draft.products.findIndex(

            (item) => item === product

          );



          return (

            <div

              key={index}

              style={{

                display: "grid",

                gridTemplateColumns:

                  "minmax(0,1fr) 62px minmax(0,1fr) 34px",

                gap: 7,

                marginTop: 8,

              }}

            >

              <input

                value={product.name}

                onChange={(e) =>

                  updateProduct(

                    index,

                    "name",

                    e.target.value

                  )

                }

                placeholder="Prodotto / ricambio"

                style={{

                  width: "100%",

                  border:

                    "1px solid #E5E7EB",

                  borderRadius: 14,

                  padding: "13px 14px",

                  fontSize: 16,

                  color: "#111827",

                  background: "#FFFFFF",

                  outline: "none",

                }}

              />



              <input

                value={product.quantity ?? "1"}

                onChange={(e) =>

                  updateProduct(

                    index,

                    "quantity",

                    e.target.value

                  )

                }

                inputMode="numeric"

                placeholder="Qtà"

                style={{

                  width: "100%",

                  border:

                    "1px solid #E5E7EB",

                  borderRadius: 14,

                  padding: "13px 8px",

                  fontSize: 16,

                  color: "#111827",

                  background: "#FFFFFF",

                  outline: "none",

                  textAlign: "center",

                }}

              />



              <input

                value={product.details}

                onChange={(e) =>

                  updateProduct(

                    index,

                    "details",

                    e.target.value

                  )

                }

                placeholder="Marca, codice..."

                style={{

                  width: "100%",

                  border:

                    "1px solid #E5E7EB",

                  borderRadius: 14,

                  padding: "13px 10px",

                  fontSize: 16,

                  color: "#111827",

                  background: "#FFFFFF",

                  outline: "none",

                }}

              />

              <button
                type="button"
                onClick={() => toggleOrderRequested(index)}
                title={product.orderRequested ? "Ordine già richiesto" : "Aggiungi all'ordine"}
                aria-label={product.orderRequested ? "Ordine già richiesto" : "Aggiungi all'ordine"}
                style={{
                  width: 34,
                  height: 34,
                  border: product.orderRequested ? "1px solid #D4AF37" : "1px solid #E5E7EB",
                  borderRadius: 10,
                  background: product.orderRequested ? "#FFF8DB" : "#FFFFFF",
                  color: product.orderRequested ? "#A16207" : "#64748B",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <PackageIcon active={Boolean(product.orderRequested)} />
              </button>

            </div>

          );

        })}

    </>

  );

}



function FieldHeader({

  title,

  recording,

  onVoice,

}: {

  title: string;

  recording: boolean;

  onVoice: () => void;

}) {

  return (

    <div

      style={{

        display: "flex",

        alignItems: "center",

        justifyContent: "space-between",

        gap: 10,

      }}

    >

      <div

        style={{

          fontSize: 14,

          fontWeight: 800,

          color: "#111827",

          textTransform: "uppercase",

        }}

      >

        {title}

      </div>



      <button

        type="button"

        onClick={onVoice}

        aria-label={`Dettatura ${title}`}

        style={{

          width: 38,

          height: 38,

          border: 0,

          borderRadius: 12,

          background: recording

            ? "#FEE2E2"

            : "#EEF1F5",

          color: recording

            ? "#DC2626"

            : "#475569",

          display: "flex",

          alignItems: "center",

          justifyContent: "center",

        }}

      >

        <MicIcon />

      </button>

    </div>

  );

}



function CheckRow({

  label,

  checked,

  onChange,

  compact = false,

}: {

  label: string;

  checked: boolean;

  onChange: (value: boolean) => void;

  compact?: boolean;

}) {

  return (

    <label

      style={{

        display: "flex",

        alignItems: "center",

        gap: 10,

        padding: compact

          ? "7px 0"

          : "9px 0",

        fontSize: 14,

        fontWeight: 700,

        color: "#334155",

      }}

    >

      <input

        type="checkbox"

        checked={checked}

        onChange={(e) =>

          onChange(e.target.checked)

        }

        style={{

          width: 20,

          height: 20,

          accentColor: "#D4AF37",

        }}

      />



      {label}

    </label>

  );

}