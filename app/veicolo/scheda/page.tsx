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
  jobId?: string;
  vehicleId?: string;

  jobNumber: number;

  createdAt: string;

  kilometers: string;

  types: string[];

  problems: string[];

  products: { name: string; details: string; quantity?: string; orderRequested?: boolean; category?: "TAGLIANDO" | "MANUTENZIONE" }[];

  works: string[];

  labor: string;

  notes: string;

  invoiceNumber: string;

  paymentAmount: string;

  paymentStatus: "DA_PAGARE" | "PAGATO";
  media: MediaAttachment[];

  status: "IN_LAVORAZIONE" | "DA_DOCUMENTARE" | "CONCLUSO";

  pdfUrl?: string;
  pdfR2Key?: string;

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



function jobIdToNumber(id: string): number {
  const match = String(id || "").match(/^(\d{2})-(\d{3})$/);
  return match ? Number(match[1]) * 1000 + Number(match[2]) : 0;
}

function normalizeJobStatus(value: unknown): JobDraft["status"] {
  const stato = String(value || "").toUpperCase();
  if (stato === "CONCLUSO" || stato === "CHIUSO") return "CONCLUSO";
  if (stato === "DA_DOCUMENTARE") return "DA_DOCUMENTARE";
  return "IN_LAVORAZIONE";
}

function parseJobDetails(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, any>;
  try { const parsed = JSON.parse(String(value)); return parsed && typeof parsed === "object" ? parsed : {}; } catch { return {}; }
}

function rowToJobDraft(row: any): JobDraft {
  const details = parseJobDetails(row?.dettagli);
  let products: JobDraft["products"] = Array.isArray(details.products) ? details.products : [];
  if (!products.length && row?.prodotti_utilizzati) {
    try { const parsed = JSON.parse(String(row.prodotti_utilizzati)); products = Array.isArray(parsed) ? parsed : []; } catch {}
  }
  return {
    jobId: String(row.id), vehicleId: String(row.vehicle_id || ""), jobNumber: Number(details.jobNumber) || jobIdToNumber(String(row.id)),
    createdAt: row.created_at || new Date().toISOString(),
    nomeCliente: details.nomeCliente || "", indirizzo: details.indirizzo || "", telefono: details.telefono || "", codiceFiscale: details.codiceFiscale || "",
    veicolo: details.veicolo || "", targa: details.targa || "", kilometers: row.chilometri == null ? "" : String(row.chilometri),
    types: Array.isArray(details.types) ? details.types : (row.tipo ? String(row.tipo).split(" · ").filter(Boolean) : []),
    problems: row.problemi ? String(row.problemi).split("\n").filter(Boolean) : [""], products,
    works: row.lavori ? String(row.lavori).split("\n").filter(Boolean) : [""], labor: row.manodopera == null ? "" : String(row.manodopera), notes: row.note == null ? "" : String(row.note),
    invoiceNumber: row.fattura == null ? "" : String(row.fattura), paymentAmount: row.payment_amount == null ? "" : String(row.payment_amount),
    paymentStatus: row.payment_status === "PAGATO" ? "PAGATO" : "DA_PAGARE", media: Array.isArray(details.media) ? details.media : [],
    status: normalizeJobStatus(row.stato), pdfUrl: details.pdfUrl || "", pdfR2Key: details.pdfR2Key || "",
    tagliando: details.tagliando || { oil:false, oilType:"", oilQuantity:"", oilFilter:false, airFilter:false, cabinFilter:false, fuelFilter:false, sparkPlugs:false, other:"" },
    freni: details.freni || { frontPads:false, rearPads:false, frontDiscs:false, rearDiscs:false, brakeFluid:false, calipers:false, other:"" },
    pneumatici: details.pneumatici || { mounting:false, removal:false, replacement:false, rotation:false, balancing:false, repair:false, season:"", quantity:"4", storage:false, description:"" },
  };
}

function emptyDraft(vehicle: VeicoloScheda & { vehicleId?: string }, jobNumber = 0): JobDraft {

  return {

    ...vehicle,

    jobNumber,

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
  const [saving, setSaving] = useState(false);
  const [saveConfirmed, setSaveConfirmed] = useState(false);
  const [tagliandoCatalog, setTagliandoCatalog] = useState<string[]>([]);
  const [manutenzioneCatalog, setManutenzioneCatalog] = useState<string[]>([]);

  const [recording, setRecording] = useState<string | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);



  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // In sviluppo Next/React può eseguire due volte gli effect di inizializzazione
  // (Strict Mode). Senza questo guard, una scheda esistente viene prima caricata
  // e subito dopo sovrascritta da una nuova scheda vuota.
  const initializedRef = useRef(false);
  const productOrderKey = (name: string) => name.trim().toLowerCase();

  useEffect(() => {
    let active = true;
    fetch("/api/product-catalog?category=TAGLIANDO", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((result) => { if (active && result?.ok && Array.isArray(result.products)) setTagliandoCatalog(result.products.map((item: { name: string }) => item.name)); })
      .catch((error) => console.warn("Catalogo prodotti tagliando non disponibile:", error));
    fetch("/api/product-catalog?category=MANUTENZIONE", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((result) => { if (active && result?.ok && Array.isArray(result.products)) setManutenzioneCatalog(result.products.map((item: { name: string }) => item.name)); })
      .catch((error) => console.warn("Catalogo prodotti manutenzione non disponibile:", error));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const init = async () => {
      try {
        const existingJobId = sessionStorage.getItem("goldencar_apri_scheda");

        if (existingJobId) {
          const response = await fetch("/api/jobs?id=" + encodeURIComponent(existingJobId), { cache: "no-store" });
          const result = await response.json();
          if (response.ok && result?.ok && result?.job) {
            const normalized = rowToJobDraft(result.job);
            setDraft(normalized); setSaved(true);
            loadMediaBlobs(normalized.media.map((item) => item.id)).then((urls) => {
              const nextUrls: Record<string, string> = {}; urls.forEach((url, id) => { nextUrls[id] = url; }); setMediaUrls(nextUrls);
            }).catch((loadError) => console.error("Errore caricamento media:", loadError));
            sessionStorage.removeItem("goldencar_apri_scheda"); sessionStorage.removeItem("goldencar_nuova_scheda_job_number");
            return;
          }
          const rawJob = localStorage.getItem(`goldencar_job_${existingJobId}`);
          if (rawJob) {
            const parsed = JSON.parse(rawJob) as Partial<JobDraft>;
            const normalized = { ...parsed, works: Array.isArray(parsed.works) ? parsed.works : parsed.works ? [parsed.works] : [""], media: Array.isArray(parsed.media) ? parsed.media : [] } as JobDraft;
            setDraft(normalized); setSaved(true);
            loadMediaBlobs(normalized.media.map((item) => item.id)).then((urls) => {
              const nextUrls: Record<string, string> = {}; urls.forEach((url, id) => { nextUrls[id] = url; }); setMediaUrls(nextUrls);
            }).catch((loadError) => console.error("Errore caricamento media:", loadError));
            sessionStorage.removeItem("goldencar_apri_scheda"); sessionStorage.removeItem("goldencar_nuova_scheda_job_number");
            return;
          }

          // Se l’ID non esiste né in Supabase né nell’archivio locale, non
          // trasformare un’apertura di scheda esistente in una nuova scheda vuota.
          sessionStorage.removeItem("goldencar_apri_scheda");
          throw new Error("Scheda di lavoro non trovata. Torna alla cronologia del veicolo e riaprila.");
        }

        let vehicle: VeicoloScheda & { vehicleId?: string } = { ...defaultVehicle };
        const rawVehicle = sessionStorage.getItem("goldencar_nuova_scheda");
        if (rawVehicle) { vehicle = { ...vehicle, ...JSON.parse(rawVehicle) }; sessionStorage.removeItem("goldencar_nuova_scheda"); }
        if (!vehicle.vehicleId) throw new Error("ID del veicolo non disponibile. Torna al profilo del veicolo e riprova.");

        // Il progressivo viene calcolato sul database, non solo sul browser:
        // le schede già salvate in Supabase devono essere considerate anche su un dispositivo nuovo.
        let serverJobNumber = 0;
        try {
          const numberResponse = await fetch("/api/jobs?nextNumber=1", { cache: "no-store" });
          const numberResult = await numberResponse.json();
          if (numberResponse.ok && numberResult?.ok && Number(numberResult.nextJobNumber) > 0) {
            serverJobNumber = Number(numberResult.nextJobNumber);
          }
        } catch (numberError) {
          console.warn("Impossibile recuperare il progressivo dal database:", numberError);
        }

        // Aprire "Nuovo lavoro" crea solo una bozza locale.
        // La riga in Supabase viene creata esclusivamente dal pulsante SALVA.
        const draft = emptyDraft(vehicle, serverJobNumber || createOrReuseNewJobNumber());
        if (serverJobNumber) {
          sessionStorage.setItem("goldencar_nuova_scheda_job_number", String(serverJobNumber));
          const year = Math.floor(serverJobNumber / 1000);
          localStorage.setItem(`goldencar_next_job_number_${year}`, String((serverJobNumber % 1000) + 1));
        }
        setDraft(draft);
        setSaved(false);
      } catch (error) {
        console.error("Errore apertura scheda:", error);
        alert(error instanceof Error ? error.message : "Impossibile aprire la scheda di lavoro.");
        router.back();
      }
    };
    void init();
  }, [router]);



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



  const addProduct = (category: "TAGLIANDO" | "MANUTENZIONE" = "MANUTENZIONE") => {

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
                category,
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
    // La scheda è già collegata al veicolo tramite Supabase: non dobbiamo
    // più cercare l'ID nella vecchia cache localStorage.
    return draft?.vehicleId || "";
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

  const generateAndOpenPdf = async (lavoro: JobDraft) => {
    try {
      if (!lavoro.jobId || !lavoro.vehicleId) {
        throw new Error("La scheda non è collegata correttamente al veicolo.");
      }

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
        status: lavoro.status === "DA_DOCUMENTARE" ? "IN_LAVORAZIONE" : lavoro.status,
      };

      const blob = await pdf(<SchedaLavoroPDF lavoro={pdfData} />).toBlob();

      // Un PDF appartiene a un singolo lavoro: viene salvato con la chiave
      // del lavoro, così Supabase deve conservare solo il riferimento al file.
      const pdfR2Key = "veicoli/" + lavoro.vehicleId + "/schede/" + lavoro.jobId + ".pdf";
      await uploadFileToR2(pdfR2Key, blob, "application/pdf");

      const currentDetails = {
        nomeCliente: lavoro.nomeCliente,
        indirizzo: lavoro.indirizzo,
        telefono: lavoro.telefono,
        codiceFiscale: lavoro.codiceFiscale,
        veicolo: lavoro.veicolo,
        targa: lavoro.targa,
        types: lavoro.types,
        products: lavoro.products,
        media: lavoro.media,
        tagliando: lavoro.tagliando,
        freni: lavoro.freni,
        pneumatici: lavoro.pneumatici,
        pdfUrl: "",
        pdfR2Key,
      };

      const response = await fetch("/api/jobs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: lavoro.jobId, dettagli: currentDetails }) });
      const result = await response.json();
      if (!response.ok || !result?.ok) throw new Error("PDF salvato su R2, ma non è stato possibile collegarlo alla scheda: " + (result?.error || "Errore sconosciuto."));

      const next = { ...lavoro, pdfR2Key, pdfUrl: "" };
      setDraft(next);

      const downloadUrl = await getR2DownloadUrl(pdfR2Key);
      window.open(downloadUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Errore generazione/salvataggio PDF:", error);
      alert(error instanceof Error ? error.message : "Non è stato possibile generare il PDF della scheda.");
    }
  };

  const syncOrderForJob = async (savedDraft: JobDraft) => {
    if (!savedDraft.jobId || !savedDraft.vehicleId) return;

    const productsToOrder = savedDraft.products
      .filter((product) => product.orderRequested && product.name.trim())
      .map((product) => ({
        name: product.name.trim(),
        quantity: product.quantity || "1",
        details: product.details.trim(),
      }));

    const response = await fetch("/api/orders?jobId=" + encodeURIComponent(savedDraft.jobId), { cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result?.ok) throw new Error("La scheda è stata salvata, ma non è stato possibile aggiornare l'ordine: " + (result?.error || "Errore sconosciuto."));
    const existingOrders = Array.isArray(result.orders) ? result.orders : [];

    const existing = existingOrders?.[0];

    // Nessun prodotto selezionato: rimuove l'ordine collegato alla scheda.
    if (productsToOrder.length === 0) {
      if (existingOrders?.length) {
        const response = await fetch("/api/orders", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: savedDraft.jobId }) });
        const result = await response.json();
        if (!response.ok && response.status !== 404 || (!result?.ok && response.status !== 404)) {
          throw new Error("La scheda è stata salvata, ma non è stato possibile rimuovere l'ordine: " + (result?.error || "Errore sconosciuto."));
        }
      }
      return;
    }

    const orderValues = {
      job_id: savedDraft.jobId,
      vehicle_id: savedDraft.vehicleId,
      cliente: savedDraft.nomeCliente,
      telefono: savedDraft.telefono,
      veicolo: savedDraft.veicolo,
      targa: savedDraft.targa,
      prodotti: productsToOrder,
      stato: "DA_INVIARE",
    };

    if (existing) {
      // Aggiorna l'ordine esistente senza duplicarlo e conserva l'eventuale fornitore assegnato.
      const response = await fetch("/api/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: existing.id, jobId: savedDraft.jobId, vehicleId: savedDraft.vehicleId, cliente: savedDraft.nomeCliente, telefono: savedDraft.telefono, veicolo: savedDraft.veicolo, targa: savedDraft.targa, prodotti: productsToOrder, stato: existing.stato || "DA_INVIARE" }) });
      const result = await response.json();
      if (!response.ok || !result?.ok) throw new Error("La scheda è stata salvata, ma non è stato possibile aggiornare l'ordine: " + (result?.error || "Errore sconosciuto."));

      // Se esistono duplicati creati dal vecchio flusso, ne mantiene uno solo.
      if ((existingOrders?.length || 0) > 1) {
        const duplicateIds = existingOrders!.slice(1).map((order: any) => String(order.id));
        for (const duplicateId of duplicateIds) {
          const response = await fetch("/api/orders", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: duplicateId }) });
          if (!response.ok) console.error("Errore rimozione ordine duplicato:", await response.text());
        }
      }
    } else {
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "ordine-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8), vehicleId: savedDraft.vehicleId, jobId: savedDraft.jobId, cliente: savedDraft.nomeCliente, telefono: savedDraft.telefono, veicolo: savedDraft.veicolo, targa: savedDraft.targa, prodotti: productsToOrder }) });
      const result = await response.json();
      if (!response.ok || !result?.ok) throw new Error("La scheda è stata salvata, ma non è stato possibile creare l'ordine: " + (result?.error || "Errore sconosciuto."));
    }
  };

  const saveDraft = async (action: "save" | "conclude" | "document" = "save"): Promise<JobDraft | null> => {
    if (saving) return null;
    if (!draft) {
      alert("Scheda non ancora caricata. Attendi un momento e riprova.");
      return null;
    }

    if (action === "conclude" || action === "document") {
      const confirmed = window.confirm(
        action === "conclude"
          ? "Confermi che il lavoro è terminato e deve passare alla fase di documentazione? La scheda resterà modificabile."
          : "Confermi la documentazione definitiva? La scheda verrà bloccata e verrà generato il PDF."
      );
      if (!confirmed) return null;
    }

    if (action === "document") {
      const missing: string[] = [];
      if (!draft.kilometers.trim()) missing.push("chilometri");
      if (!draft.labor.trim()) missing.push("manodopera");
      if (!draft.invoiceNumber.trim()) missing.push("numero di fattura");
      if (missing.length) {
        alert(`Prima di documentare il lavoro devi inserire: ${missing.join(", ")}.`);
        return null;
      }
    }

    setSaving(true);
    try {
    const next = { ...draft, status: action === "document" ? "CONCLUSO" : action === "conclude" ? "DA_DOCUMENTARE" : draft.status === "DA_DOCUMENTARE" ? "DA_DOCUMENTARE" : "IN_LAVORAZIONE" } as JobDraft;
    const fixedTagliandoNames = ["Olio motore", "Filtro olio", "Filtro aria", "Filtro abitacolo", "Filtro carburante", "Candele", "Liquido refrigerante", "Lavavetri"];
    const newCatalogNames = Array.from(new Set(next.products.filter((item) => item.category === "TAGLIANDO" && item.name.trim()).map((item) => item.name.trim())))
      .filter((name) => !fixedTagliandoNames.some((item) => productOrderKey(item) === productOrderKey(name)) && !tagliandoCatalog.some((item) => productOrderKey(item) === productOrderKey(name)));
    let catalogSaveFailed = false;
    for (const name of newCatalogNames) {
      try {
        const catalogResponse = await fetch("/api/product-catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: "TAGLIANDO", name }) });
        const catalogResult = await catalogResponse.json().catch(() => null);
        if (!catalogResponse.ok || !catalogResult?.ok) catalogSaveFailed = true;
        else setTagliandoCatalog((previous) => previous.some((item) => productOrderKey(item) === productOrderKey(name)) ? previous : [...previous, name]);
      } catch { catalogSaveFailed = true; }
    }
    const newMaintenanceNames = Array.from(new Set(next.products.filter((item) => item.category === "MANUTENZIONE" && item.name.trim()).map((item) => item.name.trim())))
      .filter((name) => !manutenzioneCatalog.some((item) => productOrderKey(item) === productOrderKey(name)));
    for (const name of newMaintenanceNames) {
      try {
        const catalogResponse = await fetch("/api/product-catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: "MANUTENZIONE", name }) });
        const catalogResult = await catalogResponse.json().catch(() => null);
        if (!catalogResponse.ok || !catalogResult?.ok) catalogSaveFailed = true;
        else setManutenzioneCatalog((previous) => previous.some((item) => productOrderKey(item) === productOrderKey(name)) ? previous : [...previous, name]);
      } catch { catalogSaveFailed = true; }
    }
    if (!next.vehicleId) {
      alert("La scheda non è collegata correttamente al veicolo. Torna al profilo e riaprila.");
      return null;
    }

    const details = {
      jobNumber: next.jobNumber,
      nomeCliente: next.nomeCliente, indirizzo: next.indirizzo, telefono: next.telefono, codiceFiscale: next.codiceFiscale,
      veicolo: next.veicolo, targa: next.targa, types: next.types, products: next.products, media: next.media,
      tagliando: next.tagliando, freni: next.freni, pneumatici: next.pneumatici,
      pdfUrl: next.pdfUrl || "", pdfR2Key: next.pdfR2Key || "",
    };
    const parsedPayment = next.paymentAmount.trim() ? Number(next.paymentAmount.replace(",", ".")) : null;
    const values = {
      vehicle_id: next.vehicleId,
      titolo: next.types?.[0] || "Intervento",
      tipo: next.types?.join(" · ") || null,
      problemi: next.problems.filter(Boolean).join("\n"),
      lavori: next.works.filter(Boolean).join("\n"),
      prodotti_utilizzati: JSON.stringify(next.products),
      chilometri: next.kilometers.trim() || null,
      manodopera: next.labor.trim() || null,
      note: next.notes.trim() || null,
      fattura: next.invoiceNumber.trim() || null,
      stato: action === "document" ? "CONCLUSO" : action === "conclude" ? "DA_DOCUMENTARE" : next.status === "DA_DOCUMENTARE" ? "DA_DOCUMENTARE" : "APERTO",
      closed_at: action === "document" ? new Date().toISOString() : null,
      payment_amount: Number.isFinite(parsedPayment as number) ? parsedPayment : null,
      payment_status: next.paymentAmount.trim() ? next.paymentStatus : null,
      dettagli: details,
    };

    const response = await fetch("/api/jobs", {
      method: next.jobId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next.jobId ? { ...values, id: next.jobId } : values),
    });
    const result = await response.json();
    if (!response.ok || !result?.ok || !result?.job) {
      console.error("Errore salvataggio scheda:", result);
      alert(`Impossibile salvare la scheda: ${result?.error || "errore sconosciuto"}`);
      return null;
    }
    const data = result.job;

    const savedDraft = rowToJobDraft(data);
    sessionStorage.removeItem("goldencar_nuova_scheda_job_number");
    setDraft(savedDraft);
    setSaved(true);
    setSaveConfirmed(true);
    window.setTimeout(() => setSaveConfirmed(false), 1200);
    if (catalogSaveFailed) alert("La scheda è stata salvata, ma non è stato possibile aggiornare il catalogo condiviso dei prodotti. Verifica che la migrazione product_catalog sia stata applicata.");
    try {
      await syncOrderForJob(savedDraft);
    } catch (orderError) {
      console.error("Errore sincronizzazione ordine:", orderError);
      alert(orderError instanceof Error ? orderError.message : "La scheda è stata salvata, ma l'ordine non è stato aggiornato.");
    }
    if (action === "document") {
      await generateAndOpenPdf(savedDraft);
      const refreshed = await fetch("/api/jobs?id=" + encodeURIComponent(savedDraft.jobId || ""), { cache: "no-store" });
      const refreshedResult = await refreshed.json().catch(() => null);
      if (refreshed.ok && refreshedResult?.ok && refreshedResult?.job) setDraft(rowToJobDraft(refreshedResult.job));
    }
    return savedDraft;
    } catch (error) {
      console.error("Errore salvataggio scheda:", error);
      alert(error instanceof Error ? `Salvataggio non riuscito: ${error.message}` : "Salvataggio non riuscito per un errore imprevisto.");
      return null;
    } finally {
      setSaving(false);
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
      // Rimuovi il PDF prima di modificare i dati del lavoro.
      if (draft.jobId && draft.pdfR2Key) {
        const response = await fetch("/api/r2/file", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: draft.pdfR2Key }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.ok) {
          throw new Error(result?.error || "Impossibile rimuovere il PDF da Cloudflare R2. Nessun altro dato è stato modificato.");
        }
      }

      if (draft.jobId) {
        const orderResponse = await fetch("/api/orders", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId: draft.jobId }) });
        const orderResult = await orderResponse.json().catch(() => null);
        if (!orderResponse.ok && orderResponse.status !== 404) throw new Error("PDF rimosso, ma gli ordini collegati non sono stati rimossi: " + (orderResult?.error || "errore sconosciuto"));
        const jobResponse = await fetch("/api/jobs", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: draft.jobId }) });
        const jobResult = await jobResponse.json().catch(() => null);
        if (!jobResponse.ok || !jobResult?.ok) throw new Error("PDF e ordini collegati rimossi, ma la scheda è ancora presente: " + (jobResult?.error || "errore sconosciuto"));
      } else {
        localStorage.removeItem(`goldencar_job_${draft.jobNumber}`);
      }

      await deleteMediaBlobs(draft.media.map((item) => item.id));

      const rawManual = localStorage.getItem("goldencar_pagamenti_manuali");
      if (rawManual) {
        try {
          const manualPayments = JSON.parse(rawManual);
          if (Array.isArray(manualPayments)) {
            localStorage.setItem(
              "goldencar_pagamenti_manuali",
              JSON.stringify(manualPayments.filter(
                (item: { jobNumber?: number }) => item.jobNumber !== draft.jobNumber
              ))
            );
          }
        } catch {
          // Lascia invariato l'archivio locale se non è leggibile.
        }
      }

      setDeleteConfirmOpen(false);
      window.location.href = "/veicolo";
    } catch (error) {
      console.error("Errore durante la rimozione della scheda:", error);
      alert(error instanceof Error ? "Operazione incompleta: " + error.message : "Impossibile completare l'operazione.");
    }
  };

  const openInvoicing = async () => {
    // Apri subito una finestra per evitare il blocco popup; salva prima di navigare.
    const invoiceWindow = window.open("about:blank", "_blank");
    const savedDraft = await saveDraft("save");
    if (!invoiceWindow) {
      alert("Consenti i popup per aprire il sito di fatturazione.");
      return;
    }
    if (!savedDraft) {
      invoiceWindow.close();
      return;
    }
    invoiceWindow.location.href = "https://metropolis.seac.it/login";
  };



  const openPdf = async () => {
    if (!draft) return;

    try {
      if (draft.pdfR2Key) {
        const downloadUrl = await getR2DownloadUrl(draft.pdfR2Key);
        window.open(downloadUrl, "_blank", "noopener,noreferrer");
        return;
      }

      if (draft.pdfUrl) {
        window.open(draft.pdfUrl, "_blank", "noopener,noreferrer");
        return;
      }

      alert("Questa scheda non ha ancora un PDF archiviato su R2.");
    } catch (error) {
      console.error("Errore apertura PDF R2:", error);
      alert(error instanceof Error ? error.message : "Non è stato possibile aprire il PDF.");
    }
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
                lineHeight: 1.05,
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
                width: 30,
                height: 30,
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

              marginTop: -2,

              fontSize: 14,

              lineHeight: 1.1,

              fontWeight: 700,

            }}

          >

            {draft.targa}

          </div>



          <div
            className="job-customer-summary"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 0,
              marginTop: 16,
              padding: "4px 6px",
              borderRadius: 14,
              background: "#F8FAFC",
            }}
          >
            {[
              ["Nome", draft.nomeCliente, <CustomerPersonIcon key="customer-person-icon" />],
              ["Telefono", draft.telefono, <CustomerPhoneIcon key="customer-phone-icon" />],
              ["Indirizzo", draft.indirizzo, <CustomerPinIcon key="customer-pin-icon" />],
              ["Cod. Fiscale", draft.codiceFiscale, <CustomerDocumentIcon key="customer-document-icon" />],
            ].map(([label, value, icon], index) => (
              <div
                key={String(label)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "18px 68px minmax(0, 1fr)",
                  alignItems: "center",
                  gap: 4,
                  minHeight: 42,
                  padding: "7px 0",
                  borderBottom: index === 3 ? 0 : "1px solid #E2E8F0",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", color: "#475569" }}>{icon}</span>
                <span style={{ fontSize: 10, color: "#64748B", fontWeight: 500 }}>{String(label)}</span>
                <span style={{ fontSize: String(label) === "Indirizzo" ? 10 : 12, lineHeight: 1.2, color: "#111827", fontWeight: 600, overflowWrap: "anywhere", wordBreak: "normal", whiteSpace: String(label) === "Indirizzo" ? "nowrap" : "normal", letterSpacing: "-0.2px", fontFamily: "Arial, Helvetica, sans-serif" }}>{String(value || "—")}</span>
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

              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",

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

                    padding: "12px 5px",

                    minHeight: 94,

                    display: "flex",

                    flexDirection: "column",

                    alignItems: "center",

                    justifyContent: "center",

                    gap: 7,

                    fontSize: 11,

                    lineHeight: 1.2,

                    fontWeight: 800,

                    color: "#111827",

                  }}

                >

                  <WorkTypeIcon type={type} />

                  <span>{type}</span>

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

                  products={Array.from(new Set([
                    "Olio motore", "Filtro olio", "Filtro aria", "Filtro abitacolo",
                    "Filtro carburante", "Candele", "Liquido refrigerante", "Lavavetri",
                    ...tagliandoCatalog,
                  ]))}

                  draft={draft}

                  setDraft={setDraft}

                  updateProduct={updateProduct}

                  addProduct={() => addProduct("TAGLIANDO")}

                  markUnsaved={() => setSaved(false)}
                  category="TAGLIANDO"
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

                  addProduct={() => addProduct("MANUTENZIONE")}

                  markUnsaved={() => setSaved(false)}
                  category="MANUTENZIONE"
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
                      ...manutenzioneCatalog,

                    ]}

                    draft={draft}

                    setDraft={setDraft}

                    updateProduct={updateProduct}

                    addProduct={() => addProduct("MANUTENZIONE")}

                    markUnsaved={() => setSaved(false)}
                    category="MANUTENZIONE"
                    searchOnly
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

        ) : draft.status === "DA_DOCUMENTARE" ? (

          <div style={{ padding: "0 18px" }}>
            <button
              type="button"
              onClick={() => { void saveDraft("document"); }}
              disabled={saving}
              style={{
                width: "100%",
                height: 46,
                border: 0,
                borderRadius: 14,
                background: "#15803D",
                color: "#FFFFFF",
                fontSize: 14,
                fontWeight: 900,
                boxShadow: "0 4px 14px rgba(21,128,61,.18)",
                opacity: saving ? 0.65 : 1,
              }}
            >
              {saving ? "DOCUMENTAZIONE..." : "DOCUMENTA"}
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

              onClick={() => saveDraft("conclude")}

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

              onClick={() => { void saveDraft("save"); }}
              disabled={saving}
              aria-label="Salva scheda di lavoro"

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

              {saving ? "SALVATAGGIO..." : saveConfirmed ? "✓ SALVATO" : "SALVA"}

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
    <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 128 128" fill="currentColor" aria-hidden="true">
      <path d="M 49 1 C 47.34 1 46 2.34 46 4 C 46 5.66 47.34 7 49 7 L 79 7 C 80.66 7 82 5.66 82 4 C 82 2.34 80.66 1 79 1 L 49 1 z M 24 15 C 16.83 15 11 20.83 11 28 C 11 35.17 16.83 41 24 41 L 101 41 L 101 104 C 101 113.37 93.37 121 84 121 L 44 121 C 34.63 121 27 113.37 27 104 L 27 52 C 27 50.34 25.66 49 24 49 C 22.34 49 21 50.34 21 52 L 21 104 C 21 116.68 31.32 127 44 127 L 84 127 C 96.68 127 107 116.68 107 104 L 107 40.640625 C 112.72 39.280625 117 34.14 117 28 C 117 20.83 111.17 15 104 15 L 24 15 z M 24 21 L 104 21 C 107.86 21 111 24.14 111 28 C 111 31.86 107.86 35 104 35 L 24 35 C 20.14 35 17 31.86 17 28 C 17 24.14 20.14 21 24 21 z M 50 55 C 48.34 55 47 56.34 47 58 L 47 104 C 47 105.66 48.34 107 50 107 C 51.66 107 53 105.66 53 104 L 53 58 C 53 56.34 51.66 55 50 55 z M 78 55 C 76.34 55 75 56.34 75 58 L 75 104 C 75 105.66 76.34 107 78 107 C 79.66 107 81 105.66 81 104 L 81 58 C 81 56.34 79.66 55 78 55 z" />
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



function WorkTypeIcon({ type }: { type: string }) {
  const common = { width: 28, height: 28, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  switch (type) {
    case "TAGLIANDO":
      return <svg {...common}><path d="M3 8h11l3 3h4v4h-2M3 8v7h2m3 0h6m-8-7V5h5l2 3"/><circle cx="7" cy="15.5" r="1.8"/><circle cx="17" cy="15.5" r="1.8"/></svg>;
    case "FRENI":
      return <svg {...common}><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/><path d="M17.5 5.5 20 4v6h-2"/></svg>;
    case "PNEUMATICI":
      return <svg {...common}><ellipse cx="12" cy="12" rx="7" ry="10"/><ellipse cx="12" cy="12" rx="3" ry="6"/><path d="M5.5 7h3m7 0h3M5 12h3m8 0h3M5.5 17h3m7 0h3"/></svg>;
    case "MANUTENZIONE":
      return <svg {...common}><path d="M14.5 6.5a4 4 0 0 0-5.2 5.2l-5.7 5.7a1.8 1.8 0 0 0 2.5 2.5l5.7-5.7a4 4 0 0 0 5.2-5.2l-2.4 2.4-2.5-2.5 2.4-2.4Z"/><path d="m15 15 4.5 4.5m-1-6 2-2"/></svg>;
    case "CENTRALINA":
      return <svg {...common}><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2.5v3M12 2.5v3M15 2.5v3M9 18v3.5M12 18v3.5M15 18v3.5M2.5 9h3M2.5 12h3M2.5 15h3M18 9h3.5M18 12h3.5M18 15h3.5"/></svg>;
    default:
      return <svg {...common}><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>;
  }
}

function SectionTitle({ title }: { title: string }) {
  const iconColor = "#475569";
  const icon = (() => {
    switch (title.toUpperCase()) {
      case "CHILOMETRI":
        return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3.5 17a8.5 8.5 0 1 1 17 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="m12 13 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="13" r="1.4" fill="currentColor"/></svg>;
      case "TIPO DI LAVORO":
        return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14.2 6.2a4.5 4.5 0 0 0-5.8 5.7L3.2 17a2 2 0 0 0 2.8 2.8l5.1-5.2a4.5 4.5 0 0 0 5.7-5.8l-2.7 2.7-3.1-3.1 3.2-2.2Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="m14.8 14.8 4.5 4.5M17.5 13.5l3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
      case "TAGLIANDO":
        return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 8h11l3 3h4v4h-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 8v7h2m3 0h6m-8-7V5h5l2 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="7" cy="15.5" r="1.8" stroke="currentColor" strokeWidth="1.8"/><circle cx="17" cy="15.5" r="1.8" stroke="currentColor" strokeWidth="1.8"/></svg>;
      case "FRENI":
        return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="1" fill="currentColor"/><path d="M17.5 5.5 20 4v6h-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
      case "PNEUMATICI":
        return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><ellipse cx="12" cy="12" rx="7" ry="10" stroke="currentColor" strokeWidth="1.8"/><ellipse cx="12" cy="12" rx="3" ry="6" stroke="currentColor" strokeWidth="1.8"/><path d="M5.5 7h3m7 0h3M5 12h3m8 0h3M5.5 17h3m7 0h3" stroke="currentColor" strokeWidth="1.5"/></svg>;
      case "MANUTENZIONE":
        return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14.5 6.5a4 4 0 0 0-5.2 5.2l-5.7 5.7a1.8 1.8 0 0 0 2.5 2.5l5.7-5.7a4 4 0 0 0 5.2-5.2l-2.4 2.4-2.5-2.5 2.4-2.4Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="m15 15 4.5 4.5m-1-6 2-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
      case "CENTRALINA":
        return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M9 2.5v3M12 2.5v3M15 2.5v3M9 18v3.5M12 18v3.5M15 18v3.5M2.5 9h3M2.5 12h3M2.5 15h3M18 9h3.5M18 12h3.5M18 15h3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
      default:
        return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/></svg>;
    }
  })();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, fontWeight: 800, color: "#111827", textTransform: "uppercase", marginBottom: 10 }}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", color: iconColor, flexShrink: 0 }}>{icon}</span>
      {title}
    </div>
  );
}

function CustomerPersonIcon() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="7.5" r="3.5" stroke="currentColor" strokeWidth="2"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
}
function CustomerPhoneIcon() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6.5 3.5h3l1.5 4-2 1.5a15 15 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function CustomerPinIcon() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" fill="currentColor"/><circle cx="12" cy="10" r="2.5" fill="#FFFFFF"/></svg>;
}
function CustomerDocumentIcon() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 2.5h8l4 4V21H6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M14 2.5v5h4M9 12h6M9 16h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
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
  category,
  searchOnly = false,

}: {

  products: string[];
  category: "TAGLIANDO" | "MANUTENZIONE";
  searchOnly?: boolean;

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

  const [searchTerm, setSearchTerm] = useState("");
  const [recentNames, setRecentNames] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("goldencar_recent_products_" + category);
      const parsed = saved ? JSON.parse(saved) : [];
      if (Array.isArray(parsed)) setRecentNames(parsed.filter((name): name is string => typeof name === "string"));
    } catch {
      setRecentNames([]);
    }
  }, [category]);

  const uniqueProducts = Array.from(new Set(products.map((name) => name.trim()).filter(Boolean)));
  const selectedNames = draft.products
    .filter((product) => (product.category || "MANUTENZIONE") === category)
    .map((product) => product.name);
  const visibleProducts = searchOnly
    ? searchTerm.trim()
      // In PRODOTTI/RICAMBI la ricerca mostra temporaneamente i risultati da poter selezionare.
      ? uniqueProducts.filter((name) => name.toLocaleLowerCase("it").includes(searchTerm.trim().toLocaleLowerCase("it")))
      // Quando il campo è vuoto, mostra esclusivamente i prodotti selezionati.
      : uniqueProducts.filter((name) => selectedNames.includes(name))
    : uniqueProducts;

  const rememberProduct = (name: string) => {
    const next = [name, ...recentNames.filter((item) => item !== name)].slice(0, 10);
    setRecentNames(next);
    try {
      localStorage.setItem("goldencar_recent_products_" + category, JSON.stringify(next));
    } catch {}
  };

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





      <input
        type="search"
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        placeholder="Cerca prodotto..."
        aria-label="Cerca prodotto nel catalogo"
        style={{ display: "block", padding: "12px 14px", border: "1px solid #CBD5E1", borderRadius: 12, background: "#FFFFFF", color: "#111827", fontSize: 14, marginBottom: 10, width: "100%", boxSizing: "border-box", outlineColor: "#D4AF37" }}
      />

      {visibleProducts.length === 0 ? (
        <div style={{ padding: "10px 0", color: "#64748B", fontSize: 13 }}>Nessun prodotto trovato.</div>
      ) : visibleProducts.map((name) => {

        const index = draft.products.findIndex(

          (product) => product.name === name && (product.category || "MANUTENZIONE") === category

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
                  ? "minmax(0,1fr) 48px minmax(0,0.8fr) 34px"
                  : "minmax(0,1fr) 48px minmax(0,0.8fr)",

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
                    rememberProduct(name);
                    if (searchOnly) setSearchTerm("");

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
                                category,
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

                                (item) => !(item.name === name && (item.category || "MANUTENZIONE") === category)

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

                  placeholder="Note"

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

          (product) => !products.includes(product.name) && (product.category ?? "RICAMBI") === category && product.name.trim()

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