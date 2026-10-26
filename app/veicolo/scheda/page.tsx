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
                <span style={{ fontSize: 10, lineHeight: 1.2, color: "#111827", fontWeight: 600, overflowWrap: "anywhere", wordBreak: "normal", whiteSpace: String(label) === "Indirizzo" ? "nowrap" : "normal", letterSpacing: "-0.2px", fontFamily: "Arial, Helvetica, sans-serif" }}>{String(value || "—")}</span>
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

                    fontSize: 10,

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
  const common = { width: 28, height: 28, fill: "currentColor", "aria-hidden": true as const };
  switch (type) {
    case "TAGLIANDO":
      return <svg {...common} viewBox="0 0 512 512"><g transform="translate(1 1)"><path d="M447,312.514V41.667c0-14.507-11.093-25.6-25.6-25.6H310.467C310.467,6.68,302.787-1,293.4-1H173.933c-9.387,0-17.067,7.68-17.067,17.067H45.933c-14.507,0-25.6,11.093-25.6,25.6V485.4c0,14.507,11.093,25.6,25.6,25.6h332.8c61.44,0,110.933-49.493,110.933-110.933C489.667,364.413,472.997,332.785,447,312.514z M421.4,33.133c5.12,0,8.533,3.413,8.533,8.533v259.897c-5.438-2.822-11.143-5.206-17.067-7.109V67.267c0-9.387-7.68-17.067-17.067-17.067h-85.333V33.133H421.4z M267.859,403.539c.005.169.013.338.019.506.717,20.51,6.948,39.573,17.271,55.755H71.533V67.267h85.333c0,9.387,7.68,17.067,17.067,17.067H293.4c9.387,0,17.067-7.68,17.067-17.067H395.8v223.163c-1.191-.183-2.39-.341-3.594-.486-.084-.01-.169-.019-.253-.029-.941-.111-1.885-.21-2.833-.297-.239-.022-.477-.043-.716-.063-.803-.069-1.608-.129-2.416-.18-.294-.019-.589-.039-.883-.056-.782-.044-1.566-.077-2.352-.105-.287-.01-.573-.024-.86-.032-1.05-.029-2.102-.047-3.159-.047-61.44,0-110.933,49.493-110.933,110.933C267.8,401.229,267.824,402.385,267.859,403.539z M173.933,16.067H293.4V24.6v34.133v8.533H173.933v-8.533V24.6V16.067z M45.933,493.933c-5.12,0-8.533-3.413-8.533-8.533V41.667c0-5.12,3.413-8.533,8.533-8.533h110.933V50.2H71.533c-9.387,0-17.067,7.68-17.067,17.067V459.8c0,9.387,7.68,17.067,17.067,17.067H298.56c6.227,6.5,13.242,12.237,20.893,17.067H45.933z M378.733,493.933c-27.118,0-51.453-11.353-68.548-29.585-.343-.704-.808-1.371-1.425-1.988-14.389-15.988-22.786-36.469-23.79-57.935-.002-.053-.004-.105-.006-.158-.063-1.397-.097-2.797-.097-4.201 0-52.053,41.813-93.867,93.867-93.867 1.099,0,2.194.025,3.287.063.1.003.199.008.299.011.247.009.494.023.741.034.727.033,1.452.076,2.176.125.659.047,1.319.095,1.978.159.092.008.184.018.275.027 4.761.479,9.523,1.407,14.284,2.995.995.332,1.991.399,2.986.265 8.963,2.593,17.641,6.553,25.939,11.896 25.3,16.77,41.901,45.496,41.901,78.292 0,52.053-41.813,93.867-93.867,93.867z"/><path d="M435.053,351.427c-4.267-3.413-9.387-2.56-11.947,1.707L375.32,421.4l-33.28-27.307c-3.413-3.413-9.387-2.56-11.947.853-3.413,3.413-2.56,9.387.853,11.947l40.96,33.28c.853.853,3.413,1.707,5.12,1.707 0,0,.853,0,.853.853 2.56,0,4.267-1.707,5.973-3.413l52.907-75.947C440.173,359.107,439.32,353.987,435.053,351.427z"/><path d="M301.933,280.6c15.829,0,29.232-10.921,33.046-25.6h13.034c12.8,0,22.187-9.387,23.04-22.187v-33.28c0-12.8-10.24-22.187-22.187-22.187h-18.176l-33.024-46.08c-5.12-7.68-13.653-11.947-23.04-11.947h-36.925c-1.169-.55-2.525-.853-4.035-.853s-2.865.304-4.035.853h-36.925c-9.387,0-17.92,4.267-23.04,11.947l-33.024,46.08H119.32c-12.8,0-22.187,10.24-22.187,22.187v33.28c0,12.8,9.387,22.187,22.187,22.187h13.034c3.814,14.679,17.216,25.6,33.046,25.6 15.829,0,29.232-10.921,33.046-25.6h70.442C272.702,269.679,286.104,280.6,301.933,280.6z M301.933,263.533c-9.387,0-17.067-7.68-17.067-17.067s7.68-17.067,17.067-17.067S319,237.08,319,246.467 311.32,263.533,301.933,263.533z M283.16,139.8l26.7,37.547H242.2v-41.813h31.573C278.04,135.533,281.453,137.24,283.16,139.8z M182.467,139.8c2.56-2.56,5.973-4.267,9.387-4.267h33.28v41.813h-68.532L182.467,139.8z M165.4,263.533c-9.387,0-17.067-7.68-17.067-17.067s7.68-17.067,17.067-17.067c9.387,0,17.067,7.68,17.067,17.067S174.787,263.533,165.4,263.533z M166.253,212.333c-.156,0-.309.008-.464.01-.13-.001-.258-.01-.389-.01-15.83,0-29.232,10.921-33.046,25.6H119.32c-2.56,0-5.12-2.56-5.12-5.12v-33.28c0-2.56,2.56-5.12,5.12-5.12h16.642c1.132.538,2.405.853,3.838.853h187.733c1.433,0,2.706-.315,3.838-.853h17.495c2.56,0,5.12,2.56,5.12,5.12v33.28c0,2.56-2.56,5.12-5.12,5.12h-13.653c-4.267-14.507-15.36-25.6-31.573-25.6-.311,0-.62.012-.929.02-.259-.006-.517-.02-.778-.02-15.83,0-29.232,10.921-33.046,25.6h-69.354C195.267,223.427,182.467,212.333,166.253,212.333z"/><path d="M233.667,323.267h-128c-5.12,0-8.533,3.413-8.533,8.533 0,5.12,3.413,8.533,8.533,8.533h128c5.12,0,8.533-3.413,8.533-8.533C242.2,326.68,238.787,323.267,233.667,323.267z"/><path d="M233.667,365.933h-128c-5.12,0-8.533,3.413-8.533,8.533s3.413,8.533,8.533,8.533h128c5.12,0,8.533-3.413,8.533-8.533S238.787,365.933,233.667,365.933z"/><path d="M233.667,408.6h-128c-5.12,0-8.533,3.413-8.533,8.533s3.413,8.533,8.533,8.533h128c5.12,0,8.533-3.413,8.533-8.533S238.787,408.6,233.667,408.6z"/></g></svg>;
    case "FRENI":
      return <svg {...common} viewBox="0 0 512.009 512.009"><g><path d="M277.337,256.007c11.776,0,21.333-9.557,21.333-21.333s-9.557-21.333-21.333-21.333-21.333,9.557-21.333,21.333 9.557,21.333,21.333,21.333z"/><path d="M277.337,298.674c-11.776,0-21.333,9.557-21.333,21.333s9.557,21.333,21.333,21.333 21.333-9.557 21.333-21.333-9.557-21.333-21.333-21.333z"/><path d="M277.337,149.34c-70.683,0-128,57.317-128,128s57.317,128 128,128 128-57.317 128-128-57.317-128-128-128zm0,213.334c-47.119,0-85.333-38.214-85.333-85.333s38.214-85.333 85.333-85.333 85.333,38.214 85.333,85.333-38.214,85.333-85.333,85.333z"/><path d="M307.08,44.344V33.679c0-19.406-16.295-34.56-35.517-33.64C124.746,7.211 7.202,124.762 .054,271.554c-.98,19.189 14.2,35.512 33.617,35.512h10.664c14.711,115.872 113.645,204.943 232.869,204.943 129.674,0 234.795-105.128 234.795-234.816 0-119.226-89.049-218.147-204.919-232.849zM264.405,43.281v42.914c-5.207.546-10.35,1.299-15.427,2.23-60.921,11.163-111.992,49.574-140.217,102.267-11.965,22.334-19.826,47.232-22.597,73.707H43.296C53.479,146.906 146.943,53.453 264.405,43.281zM277.205,469.342c-95.683,0-175.418-70.121-189.795-162.261h7.075c12.207,0 23.097-6.537 28.984-16.465 2.605-4.383 4.237-9.426 4.564-14.865 1.85-30.291 12.134-58.188 28.543-81.408 22.705-32.124 57.14-55.289 97.251-63.412 7.144-1.445 14.467-2.413 21.935-2.87 4.989-.3 9.65-1.697 13.773-3.941 .072-.039.141-.082.212-.122 .383-.212.764-.427 1.137-.654 .252-.153.497-.317.745-.476 .188-.121.38-.237.565-.361 .316-.212.623-.435.931-.658 .111-.081.227-.156.337-.238 .316-.235.623-.48.93-.725 .097-.077.197-.15.293-.229 .258-.211.506-.431.757-.649 .139-.121.283-.237.42-.36 .147-.132.286-.27.43-.405 6.661-6.195 10.787-15.058 10.787-24.742v-7.085c92.143,14.361 162.253,94.086 162.253,189.778 0 106.13-86.019 192.155-192.128 192.155z"/><path d="M234.67,256.007c-11.776,0-21.333,9.557-21.333,21.333s9.557,21.333 21.333,21.333 21.333-9.557 21.333-21.333-9.557-21.333-21.333-21.333z"/><path d="M320.004,256.007c-11.776,0-21.333,9.557-21.333,21.333s9.557,21.333 21.333,21.333 21.333-9.557 21.333-21.333-9.557-21.333-21.333-21.333z"/></g></svg>;
    case "PNEUMATICI":
      return <svg {...common} viewBox="0 0 24 24"><path d="M21 12C21 17.5228 18.9853 22 16.5 22M16.5 2C18.3453 2 19.9312 4.46819 20.6256 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M3 12C3 6.47715 5.01472 2 7.5 2C9.98528 2 12 6.47715 12 12C12 17.5228 9.98528 22 7.5 22C5.65471 22 4.06884 19.5318 3.37444 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M7.5 22C9.98528 22 12 17.5228 12 12C12 6.47715 9.98528 2 7.5 2" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M9 12C9 15.3137 8.32843 18 7.5 18C6.67157 18 6 15.3137 6 12C6 8.68629 6.67157 6 7.5 6C8.32843 6 9 8.68629 9 12Z" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M7.5 2L16.5 2M7.5 22L16.5 22M9 12H8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
    case "MANUTENZIONE":
      return <svg {...common} viewBox="0 0 16 16"><path d="M12.28592,11.7143,6.49472,5.92372a2.50375,2.50375,0,0,0,.16958-.7544,2.14905,2.14905,0,0,0-.09474-.81438,2.11972,2.11972,0,0,0-.54871-.90431,2.32771,2.32771,0,0,0-1.76079-.68447H4.21515a2.104,2.104,0,0,0-.71829.15488L4.59925,4.02518l.31921.31976.24445.24481a1.864,1.864,0,0,1-.21948.85435,1.04314,1.04314,0,0,1-.11475.14488,1.64822,1.64822,0,0,1-1.00259.33474L2.609,4.70468,2.16005,4.255a2.07386,2.07386,0,0,0-.13469.54457l-.015.10493a2.33671,2.33671,0,0,0,.38407,1.51882,2.50928,2.50928,0,0,0,.29431.35975A2.20549,2.20549,0,0,0,4.265,7.43257a2.45325,2.45325,0,0,0,.89789-.17485L9.95648,12.054l1.20212,1.19909H11.827l.66343-.6645v-.6695Zm-6.53561-2.806,1.3662,1.3662L4.12892,13.2621H3.20558l-.45037-.45038V11.8959ZM14,5.90569,12.19094,7.71475,10.89232,6.49869,9.5111,7.87992,8.1449,6.51372,9.51861,5.13249,7.89717,3.5111l.68312-.7732,2.252.45042Z"/></svg>;
    case "CENTRALINA":
      return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2.5v3M12 2.5v3M15 2.5v3M9 18v3.5M12 18v3.5M15 18v3.5M2.5 9h3M2.5 12h3M2.5 15h3M18 9h3.5M18 12h3.5M18 15h3.5"/></svg>;
    case "MANODOPERA":
      return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V12L14.5 14.5"/><path d="M2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C22 4.92893 22 7.28595 22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12Z"/></svg>;
    case "NOTE":
      return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 8.25V18C20 21 18.21 22 16 22H8C5.79 22 4 21 4 18V8.25C4 5 5.79 4.25 8 4.25C8 4.87 8.24997 5.43 8.65997 5.84C9.06997 6.25 9.63 6.5 10.25 6.5H13.75C14.99 6.5 16 5.49 16 4.25C18.21 4.25 20 5 20 8.25Z"/><path d="M16 4.25C16 5.49 14.99 6.5 13.75 6.5H10.25C9.63 6.5 9.06997 6.25 8.65997 5.84C8.24997 5.43 8 4.87 8 4.25C8 3.01 9.01 2 10.25 2H13.75C14.37 2 14.93 2.25 15.34 2.66C15.75 3.07 16 3.63 16 4.25Z"/><path d="M8 13H12M8 17H16"/></svg>;
    case "FATTURA":
    case "FATTURAZIONE":
      return <svg {...common} viewBox="0 0 24 24"><path d="M15 8a1 1 0 0 1-1 1H6a1 1 0 0 1 0-2h8a1 1 0 0 1 1 1Zm-1 3H6a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2Zm-4 4H6a1 1 0 0 0 0 2h4a1 1 0 0 0 0-2Zm13-3v8a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V4a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v7h3a1 1 0 0 1 1 1ZM17 4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h13Zm4 9h-2v8h1a1 1 0 0 0 1-1Z"/></svg>;
    case "MEDIA":
      return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14.2639 15.9376L12.5958 14.2835C11.7909 13.4852 11.3884 13.0861 10.9266 12.9402C10.5204 12.8119 10.0838 12.8166 9.68048 12.9537C9.22188 13.1096 8.82814 13.5173 8.04068 14.3327L4.04409 18.2802M14.2639 15.9376L14.6053 15.5991C15.4112 14.7999 15.8141 14.4003 16.2765 14.2544C16.6831 14.1262 17.12 14.1312 17.5236 14.2688C17.9824 14.4252 18.3761 14.834 19.1634 15.6515L20 16.4936M14.2639 15.9376L18.275 19.9566M18.275 19.9566C17.9176 20.0001 17.4543 20.0001 16.8 20.0001H7.2C6.07989 20.0001 5.51984 20.0001 5.09202 19.7821C4.71569 19.5904 4.40973 19.2844 4.21799 18.9081C4.12796 18.7314 4.07512 18.5322 4.04409 18.2802M18.275 19.9566C18.5293 19.9257 18.7301 19.8728 18.908 19.7821C19.2843 19.5904 19.5903 19.2844 19.782 18.9081C20 18.4803 20 17.9202 20 16.8001V16.4936M12.5 4L7.2 4.00011C6.07989 4.00011 5.51984 4.00011 5.09202 4.21809C4.71569 4.40984 4.40973 4.7158 4.21799 5.09213C4 5.51995 4 6.08 4 7.20011V16.8001C4 17.4576 4 17.9222 4.04409 18.2802M20 11.5V16.4936M14 10.0002L16.0249 9.59516C16.2015 9.55984 16.2898 9.54219 16.3721 9.5099C16.4452 9.48124 16.5146 9.44407 16.579 9.39917C16.6515 9.34859 16.7152 9.28492 16.8425 9.1576L21 5.00015C21.5522 4.44787 21.5522 3.55244 21 3.00015C20.4477 2.44787 19.5522 2.44787 19 3.00015L14.8425 7.1576C14.7152 7.28492 14.6515 7.34859 14.6009 7.42112C14.556 7.4855 14.5189 7.55494 14.4902 7.62801C14.4579 7.71033 14.4403 7.79862 14.4049 7.97518L14 10.0002Z"/></svg>;
    case "PAGAMENTO":
      return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 14C2 10.2288 2 8.34315 3.17157 7.17157C4.34315 6 6.22876 6 10 6H14C17.7712 6 19.6569 6 20.8284 7.17157C22 8.34315 22 10.2288 22 14C22 17.7712 22 19.6569 20.8284 20.8284C19.6569 22 17.7712 22 14 22H10C6.22876 22 4.34315 22 3.17157 20.8284C2 19.6569 2 17.7712 2 14Z"/><path d="M16 6C16 4.11438 16 3.17157 15.4142 2.58579C14.8284 2 13.8856 2 12 2C10.1144 2 9.17157 2 8.58579 2.58579C8 3.17157 8 4.11438 8 6"/><path d="M12 17.3333C13.1046 17.3333 14 16.5871 14 15.6667C14 14.7462 13.1046 14 12 14C10.8954 14 10 13.2538 10 12.3333C10 11.4129 10.8954 10.6667 12 10.6667M12 17.3333C10.8954 17.3333 10 16.5871 10 15.6667M12 17.3333V18M12 10V10.6667M12 10.6667C13.1046 10.6667 14 11.4129 14 12.3333"/></svg>;
    case "PROBLEMI RISCONTRATI":
      return <svg {...common} viewBox="0 0 24 24" aria-hidden="true"><path d="M1.225 21.225A1.678 1.678 0 0 0 2.707 22H22.28a1.68 1.68 0 0 0 1.484-.775 1.608 1.608 0 0 0 .003-1.656L13.995 1.827a1.745 1.745 0 0 0-2.969 0l-9.8 17.742a1.603 1.603 0 0 0 0 1.656zm.859-1.143l9.82-17.773A.71.71 0 0 1 12.508 2a.73.73 0 0 1 .629.342l9.751 17.708a.626.626 0 0 1 .017.662.725.725 0 0 1-.626.288H2.708a.723.723 0 0 1-.623-.286.605.605 0 0 1-.001-.632zM13 15h-1V8h1zm-1.5 2.5a1 1 0 1 1 1 1 1.002 1.002 0 0 1-1-1z"/></svg>;
    case "PRODOTTI/RICAMBI":
      return <svg {...common} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true"><path d="M44 14L24 4L4 14V34L24 44L44 34V14Z"/><path d="M4 14L24 24M24 44V24M44 14L24 24M34 9L14 19"/></svg>;
    case "LAVORI EFFETTUATI":
      return <svg {...common} viewBox="0 0 287.403 287.403" aria-hidden="true"><g><path d="M197.095,253.646H30V33.757h167.095v12.214l29.767-29.767c-1.214-7.066-7.355-12.447-14.767-12.447H15c-8.284,0-15,6.716-15,15v249.89c0,8.284,6.716,15,15,15h197.095c8.284,0,15-6.716,15-15V159.041l-30,7.533V253.646z"/><path d="M140.161,73.802c-5.169-6.474-14.605-7.533-21.081-2.366L84.964,98.667L74.647,88.352c-5.857-5.857-15.355-5.857-21.213,0c-5.858,5.857-5.858,15.355,0,21.213l19.799,19.799c2.912,2.912,6.753,4.394,10.61,4.394c3.296,0,6.604-1.081,9.354-3.276l44.598-35.598C144.27,89.715,145.329,80.276,140.161,73.802z"/><path d="M119.08,168.366l-34.116,27.232l-10.316-10.316c-5.857-5.859-15.355-5.857-21.213,0s-5.858,15.354,0,21.213l19.799,19.8c2.912,2.912,6.752,4.394,10.61,4.394c3.296,0,6.604-1.082,9.354-3.276l44.598-35.599c6.475-5.169,7.534-14.606,2.366-21.081C134.992,164.259,125.556,163.199,119.08,168.366z"/><path d="M276.798,12.959c-2.587,0-5.224,.96-7.37,3.105l-71.389,71.39c-3.502,3.501-5.988,7.887-7.194,12.69l-7.66,30.506c-.358,1.424-.235,2.96,.497,4.232c1.021,1.774,2.857,2.765,4.756,2.765,.444,0,.891-.054,1.332-.165l30.704-7.71c4.803-1.206,9.189-3.692,12.69-7.194l43.493-43.493c6.881-6.881,10.747-16.214,10.747-25.946V23.51c0-6.347-5.193-10.551-10.605-10.551z"/></g></svg>;
    default:
      return <svg {...common} viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>;
  }
}

function SectionTitle({ title }: { title: string }) {
  const iconColor = "#475569";
  const icon = (() => {
    switch (title.toUpperCase()) {
      case "CHILOMETRI":
        return <svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 4a.5.5 0 0 1 .5.5V6a.5.5 0 0 1-1 0V4.5A.5.5 0 0 1 8 4zM3.732 5.732a.5.5 0 0 1 .707 0l.915.914a.5.5 0 1 1-.708.708l-.914-.915a.5.5 0 0 1 0-.707zM2 10a.5.5 0 0 1 .5-.5h1.586a.5.5 0 0 1 0 1H2.5A.5.5 0 0 1 2 10zm9.5 0a.5.5 0 0 1 .5-.5h1.5a.5.5 0 0 1 0 1H12a.5.5 0 0 1-.5-.5zm.754-4.246a.389.389 0 0 0-.527-.02L7.547 9.31a.91.91 0 1 0 1.302 1.258l3.434-4.297a.389.389 0 0 0-.029-.518z"/><path fillRule="evenodd" d="M0 10a8 8 0 1 1 15.547 2.661c-.442 1.253-1.845 1.602-2.932 1.25C11.309 13.488 9.475 13 8 13c-1.474 0-3.31.488-4.615.911-1.087.352-2.49.003-2.932-1.25A7.988 7.988 0 0 1 0 10zm8-7a7 7 0 0 0-6.603 9.329c.203.575.923.876 1.68.63C4.397 12.533 6.358 12 8 12s3.604.532 4.923.96c.757.245 1.477-.056 1.68-.631A7 7 0 0 0 8 3z"/></svg>;
      case "TIPO DI LAVORO":
        return <svg width="24" height="24" viewBox="0 0 15 15" fill="currentColor" aria-hidden="true"><path d="M12.6,8.7,11.5,6.5a1.05,1.05,0,0,0-.9-.5H4.4a1.05,1.05,0,0,0-.9.5L2.4,8.7,1.16,9.852a.5.5,0,0,0-.16.367V14.5a.5.5,0,0,0,.5.5h2c.2,0,.5-.2.5-.4V14h7v.5c0,.2.2.5.4.5h2.1a.5.5,0,0,0,.5-.5V10.219a.5.5,0,0,0-.16-.367ZM4.5,7h6l1,2h-8ZM5,11.6c0,.2-.3.4-.5.4H2.4c-.2,0-.4-.3-.4-.5V10.4c.1-.3.3-.5.6-.4l2,.4c.2,0,.4.3.4.5Zm8-.1c0,.2-.2.5-.4.5H10.5c-.2,0-.5-.2-.5-.4v-.7c0-.2.2-.5.4-.5l2-.4c.3-.1.5.1.6.4ZM14,2V3a1.009,1.009,0,0,1-1.017,1H5.348A2.549,2.549,0,0,1,1,3.5H3.5v-2H1A2.549,2.549,0,0,1,5.348,1h7.635A1.009,1.009,0,0,1,14,2Z"/></svg>;
      case "TAGLIANDO":
        return <WorkTypeIcon type="TAGLIANDO" />;
      case "FRENI":
        return <WorkTypeIcon type="FRENI" />;
      case "PNEUMATICI":
        return <WorkTypeIcon type="PNEUMATICI" />;
      case "MANUTENZIONE":
        return <WorkTypeIcon type="MANUTENZIONE" />;
      case "CENTRALINA":
        return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M9 2.5v3M12 2.5v3M15 2.5v3M9 18v3.5M12 18v3.5M15 18v3.5M2.5 9h3M2.5 12h3M2.5 15h3M18 9h3.5M18 12h3.5M18 15h3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
      case "MANODOPERA":
      case "NOTE":
      case "PROBLEMI RISCONTRATI":
      case "PRODOTTI/RICAMBI":
      case "LAVORI EFFETTUATI":
      case "FATTURA":
      case "FATTURAZIONE":
      case "MEDIA":
      case "PAGAMENTO":
        return <WorkTypeIcon type={title.toUpperCase()} />;
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

      <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
        {title.toUpperCase() === "NOTE" && <WorkTypeIcon type="NOTE" />}
        <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", textTransform: "uppercase" }}>
          {title}
        </div>
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