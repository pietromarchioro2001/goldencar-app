"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BottomBar from "@/components/BottomBar";
import { fetchJsonCached, invalidateApiCache } from "@/lib/client-api-cache";


type Lavoro = {
  jobNumber: number | string;
  createdAt: string;
  nomeCliente?: string;
  veicolo?: string;
  targa?: string;
  telefono?: string;
  paymentAmount?: string;
  paymentPaidAmount?: string;
  paymentStatus?: "DA_PAGARE" | "PARZIALE" | "PAGATO";
  types?: string[];
  works?: string[] | string;
  status?: "IN_LAVORAZIONE" | "DA_DOCUMENTARE" | "CONCLUSO";
  pdfUrl?: string;
};
type Appuntamento = {
  id?: string;
  date?: string;
  data?: string;
  time?: string;
  ora?: string;
  title?: string;
  descrizione?: string;
  description?: string;
};
type Revisione = {
  id?: string;
  nomeCliente?: string;
  cliente?: string;
  veicolo?: string;
  targa?: string;
  revisione?: string;
  scadenza?: string;
  telefono?: string;
};
type Sollecito = {
  id?: string;
  nomeCliente?: string;
  cliente?: string;
  telefono?: string;
  clientKey?: string;
  importo?: string;
};
type PagamentoManuale = {
  id: string;
  clientKey: string;
  nomeCliente: string;
  telefono?: string;
  targa?: string;
  descrizione: string;
  importo: string;
  paidAmount: string;
  stato: "DA_PAGARE" | "PARZIALE" | "PAGATO";
  createdAt: string;
};
type PagamentoDettaglio = {
  id: string;
  clientKey: string;
  nomeCliente: string;
  telefono?: string;
  descrizione: string;
  importo: number;
  stato: "DA_PAGARE" | "PARZIALE" | "PAGATO";
  jobNumber?: number | string;
  totale?: number;
  pagato?: number;
  manuale?: boolean;
  data?: string;
};
type ClienteRicerca = {
  clientKey: string;
  clientId?: string;
  nomeCliente: string;
  telefono: string;
  targa?: string;
};
type Ordine = {
  id?: string;
  numero?: string;
  cliente?: string;
  veicolo?: string;
  descrizione?: string;
  stato?: string;
  vehicleId?: string;
  supplierId?: string;
};
type VeicoloSalvato = {
  id?: string;
  cliente1?: { nome?: string; indirizzo?: string; telefono?: string; cf?: string; nascita?: string };
  cliente2?: { nome?: string; indirizzo?: string; telefono?: string; cf?: string; nascita?: string } | null;
  veicolo?: { veicolo?: string; motore?: string; targa?: string; immatricolazione?: string; revisione?: string };
};
function normalizePlate(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/O/g, "0")
    .replace(/I/g, "1")
    .replace(/L/g, "1");
}
function plateCandidates(text: string) {
  const raw = text.toUpperCase().replace(/[^A-Z0-9]/g, " ");
  const compact = raw.replace(/\s+/g, " ");
  const candidates = new Set<string>();
  const tokens = compact.split(/\s+/).filter(Boolean);
  tokens.forEach((token) => {
    const normalized = normalizePlate(token);
    if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(normalized)) candidates.add(normalized);
  });
  for (let i = 0; i < compact.length - 6; i++) {
    const chunk = normalizePlate(compact.slice(i, i + 7));
    if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(chunk)) candidates.add(chunk);
  }
  return [...candidates];
}
type ModalType =
  | "lavori"
  | "revisioni"
  | "agenda"
  | "solleciti"
  | "ordini"
  | null;
function parseImporto(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const normalized = raw
    .replace(/€/g, "")
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:,|$))/g, "")
    .replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}
function formatEuro(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}
function makeClientKey(nome: string, telefono?: string) {
  return `${nome.trim().toLowerCase()}|${(telefono || "").replace(/\D/g, "")}`;
}
function aggregaSolleciti(lavori: Lavoro[], manuali: PagamentoManuale[]): Sollecito[] {
  const map = new Map<string, Sollecito>();
  const add = (item: { clientKey: string; nomeCliente: string; telefono?: string; amount: number }) => {
    if (item.amount <= 0) return;
    const current = map.get(item.clientKey);
    if (current) current.importo = String(parseImporto(current.importo) + item.amount);
    else map.set(item.clientKey, {
      clientKey: item.clientKey,
      nomeCliente: item.nomeCliente,
      telefono: item.telefono || "",
      importo: String(item.amount),
    });
  };

  for (const lavoro of lavori) {
    if (lavoro.paymentStatus === "PAGATO") continue;
    const totale = parseImporto(lavoro.paymentAmount);
    const pagato = parseImporto(lavoro.paymentPaidAmount);
    const residuo = Math.max(0, totale - pagato);
    if (residuo <= 0) continue;
    const nome = lavoro.nomeCliente || "Cliente";
    add({ clientKey: makeClientKey(nome, lavoro.telefono), nomeCliente: nome, telefono: lavoro.telefono, amount: residuo });
  }

  for (const pagamento of manuali) {
    if (pagamento.stato === "PAGATO") continue;
    const totale = parseImporto(pagamento.importo);
    const pagato = parseImporto(pagamento.paidAmount);
    const residuo = Math.max(0, totale - pagato);
    if (residuo <= 0) continue;
    add({ clientKey: pagamento.clientKey, nomeCliente: pagamento.nomeCliente, telefono: pagamento.telefono, amount: residuo });
  }

  return Array.from(map.values()).sort((a,b) => (a.nomeCliente || "").localeCompare(b.nomeCliente || "", "it"));
}
export default function Home() {
  const router = useRouter();
  const [lavori, setLavori] = useState<Lavoro[]>([]);
  const [appuntamenti, setAppuntamenti] = useState<Appuntamento[]>([]);
  const [revisioni, setRevisioni] = useState<Revisione[]>([]);
  const [solleciti, setSolleciti] = useState<Sollecito[]>([]);
  const [pagamentiManuali, setPagamentiManuali] = useState<PagamentoManuale[]>([]);
  const [clientiAnagrafica, setClientiAnagrafica] = useState<ClienteRicerca[]>([]);
  const [dettaglioSollecito, setDettaglioSollecito] = useState<Sollecito | null>(null);
  const [nuovoPagamentoAperto, setNuovoPagamentoAperto] = useState(false);
  const [clienteQuery, setClienteQuery] = useState("");
  const [clienteSelezionatoPagamento, setClienteSelezionatoPagamento] = useState<ClienteRicerca | null>(null);
  const [inserimentoNomeLibero, setInserimentoNomeLibero] = useState(false);
  const [nuovoClienteNome, setNuovoClienteNome] = useState("");
  const [nuovoClienteTelefono, setNuovoClienteTelefono] = useState("");
  const [nuovoPagamentoDescrizione, setNuovoPagamentoDescrizione] = useState("");
  const [nuovoPagamentoImporto, setNuovoPagamentoImporto] = useState("");
  const [ordini, setOrdini] = useState<Ordine[]>([]);
  const [conteggiRapidi, setConteggiRapidi] = useState<{ lavori: number; agenda: number; revisioni: number; ordini: number } | null>(null);
  const [sollecitiRapido, setSollecitiRapido] = useState<number | null>(null);
  const [modal, setModal] = useState<ModalType>(null);
  const [listening, setListening] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [checkInError, setCheckInError] = useState("");
  const [agendaVoiceOpen, setAgendaVoiceOpen] = useState(false);
  const [agendaDraft, setAgendaDraft] = useState({ date: "", time: "", description: "" });
  const [agendaVoiceText, setAgendaVoiceText] = useState("");
  const [ordineAperto, setOrdineAperto] = useState<Ordine | null>(null);
  const [nuovoOrdineAperto, setNuovoOrdineAperto] = useState(false);
  const [ordineDescrizione, setOrdineDescrizione] = useState("");
  const [ordineVeicoloId, setOrdineVeicoloId] = useState("");
  const [ordineFornitoreId, setOrdineFornitoreId] = useState("");
  const [fornitori, setFornitori] = useState<{id:string;nome:string;whatsapp:string}[]>([]);
  const [veicoliOrdini, setVeicoliOrdini] = useState<any[]>([]);
  const [ordineListening, setOrdineListening] = useState(false);
  const [rubricaFornitoreAperta, setRubricaFornitoreAperta] = useState(false);
  const [fornitoreEditId, setFornitoreEditId] = useState("");
  const [fornitoreEditNome, setFornitoreEditNome] = useState("");
  const [fornitoreEditWhatsapp, setFornitoreEditWhatsapp] = useState("");
  const [nuovoFornitoreMode, setNuovoFornitoreMode] = useState(false);
  const checkInVideoRef = useRef<HTMLVideoElement>(null);
  const checkInStreamRef = useRef<MediaStream | null>(null);
  const conteggiRequestRef = useRef(0);

  const caricaConteggiRapidi = async () => {
    // I conteggi devono leggere lo stato appena scritto, non la cache breve della Home.
    invalidateApiCache("/api/home/counts");
    const requestId = ++conteggiRequestRef.current;
    const oggi = new Date();
    const inizio = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
    const fine = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() + 1);
    const fineRevisioni = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() + 30);
    const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const params = new URLSearchParams({
      start: inizio.toISOString(),
      end: fine.toISOString(),
      until: dateKey(fineRevisioni),
    });

    // Conteggi essenziali indipendenti dal caricamento delle liste complete.
    void fetchJsonCached("/api/home/counts?" + params.toString())
      .then((result) => {
        if (requestId !== conteggiRequestRef.current) return;
        if (result?.ok && result.counts) setConteggiRapidi(result.counts);
      })
      .catch((error) => console.error("Errore conteggi rapidi Home:", error));

    // La risposta viene condivisa tra navigazioni ravvicinate e richieste simultanee.
    void fetchJsonCached("/api/home/counts/reminders")
      .then((result) => {
        if (requestId !== conteggiRequestRef.current) return;
        if (result?.ok) setSollecitiRapido(Number(result.count) || 0);
      })
      .catch((error) => console.error("Errore conteggio solleciti Home:", error));
  };

  useEffect(() => {
    void caricaDati(false);
    void caricaConteggiRapidi();
    const rawOrderContext = sessionStorage.getItem("goldencar_nuovo_ordine");
    if (rawOrderContext) {
      try {
        const orderContext = JSON.parse(rawOrderContext) as { vehicleId?: string; nomeCliente?: string; telefono?: string; veicolo?: string; targa?: string };
        if (orderContext.vehicleId) setOrdineVeicoloId(String(orderContext.vehicleId));
        if (orderContext.nomeCliente || orderContext.veicolo || orderContext.targa) {
          setOrdineDescrizione("");
        }
        setOrdineFornitoreId("");
        setModal("ordini");
        setNuovoOrdineAperto(true);
      } catch (error) {
        console.error("Contesto nuovo ordine non valido:", error);
      } finally {
        sessionStorage.removeItem("goldencar_nuovo_ordine");
      }
    }
    const refresh = () => {
      invalidateApiCache("/api/home");
      void caricaDati(false);
      void caricaConteggiRapidi();
    };
    // Allinea le altre postazioni senza richiedere un aggiornamento manuale:
    // conteggi ogni 5 s, dati completi ogni 10 s.
    const countsTimer = window.setInterval(() => { void caricaConteggiRapidi(); }, 5000);
    const dataTimer = window.setInterval(() => {
      invalidateApiCache("/api/home");
      void caricaDati(false);
    }, 10000);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(countsTimer);
      window.clearInterval(dataTimer);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => {
    if (!checkInOpen || !checkInVideoRef.current || !checkInStreamRef.current) return;
    checkInVideoRef.current.srcObject = checkInStreamRef.current;
    void checkInVideoRef.current.play().catch(() => undefined);
  }, [checkInOpen]);
  useEffect(() => {
    return () => {
      checkInStreamRef.current?.getTracks().forEach((track) => track.stop());
      checkInStreamRef.current = null;
    };
  }, []);
  const stopCheckInCamera = () => {
    checkInStreamRef.current?.getTracks().forEach((track) => track.stop());
    checkInStreamRef.current = null;
    setCheckInOpen(false);
    setCheckInBusy(false);
  };
  const openCheckInCamera = async () => {
    if (checkInBusy) return;
    setCheckInError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCheckInError("La fotocamera non è disponibile su questo dispositivo.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      checkInStreamRef.current = stream;
      setCheckInOpen(true);
    } catch (error) {
      console.error("CHECK-IN camera error:", error);
      setCheckInError("Non posso accedere alla fotocamera. Controlla i permessi del browser.");
    }
  };
  const startCheckIn = () => {
    void openCheckInCamera();
  };
  const apriCheckIn = startCheckIn;
  const captureCheckInPlate = async () => {
    const video = checkInVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight || checkInBusy) return;
    setCheckInBusy(true);
    setCheckInError("");
    try {
      const canvas = document.createElement("canvas");
      // Il riquadro guida è centrale: ritagliamo solo la fascia in cui l'utente
      // deve inquadrare la targa, riducendo molto il rumore dell'OCR.
      const cropWidth = Math.round(video.videoWidth * 0.82);
      const cropHeight = Math.round(video.videoHeight * 0.22);
      const sx = Math.round((video.videoWidth - cropWidth) / 2);
      const sy = Math.round((video.videoHeight - cropHeight) / 2);
      canvas.width = Math.max(1200, cropWidth * 2);
      canvas.height = Math.max(300, cropHeight * 2);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Impossibile acquisire la foto.");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(video, sx, sy, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.98)
      );
      if (!blob) throw new Error("Impossibile creare la foto della targa.");
      const file = new File([blob], "check-in-targa.jpg", { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/vision/plate", { method: "POST", body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Errore durante la lettura della targa.");
      const plate = normalizePlate(String(data?.plate || ""));
      if (!/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(plate)) {
        const fallback = plateCandidates(String(data?.text || ""))[0] || "";
        if (!fallback) throw new Error("Targa non riconosciuta. Avvicinati e riprova.");
        await handleRecognizedPlate(fallback);
      } else {
        await handleRecognizedPlate(plate);
      }
    } catch (error) {
      console.error("CHECK-IN OCR error:", error);
      setCheckInError(error instanceof Error ? error.message : "Non sono riuscito a leggere la targa.");
      setCheckInBusy(false);
    }
  };
  const handleRecognizedPlate = async (plate: string) => {
    const normalized = normalizePlate(plate);
    try {
      const response = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plate: normalized }),
      });
      const result = await response.json();
      if (!response.ok || !result?.ok) throw new Error(result?.error || "Errore durante la ricerca del veicolo.");
      if (result.found && result.vehicle) {
        const vehicle = result.vehicle;
        const cliente = result.client || null;
        stopCheckInCamera();
        sessionStorage.setItem("goldencar_nuova_scheda", JSON.stringify({
          vehicleId: String(vehicle.id),
          nomeCliente: String(cliente?.nome ?? "").trim(),
          indirizzo: cliente?.indirizzo || "",
          telefono: cliente?.telefono || "",
          codiceFiscale: cliente?.codice_fiscale || "",
          veicolo: vehicle.veicolo || "",
          targa: normalized,
        }));
        router.push("/veicolo/scheda");
        return;
      }
      sessionStorage.setItem("goldencar_checkin_targa", normalized);
      router.push("/veicolo/profilo");
    } catch (error) {
      console.error("CHECK-IN ricerca veicolo error:", error);
      stopCheckInCamera();
      setCheckInError(error instanceof Error ? `Errore durante la ricerca del veicolo: ${error.message}` : "Errore durante la ricerca del veicolo.");
    }
  };

  const caricaDati = async (aggiornaConteggi = true) => {
    if (typeof window === "undefined") return;
    let result: any;
    try {
      result = await fetchJsonCached("/api/home");
    } catch (error) {
      // Mantieni l'ultimo stato valido: un errore temporaneo non deve svuotare le card.
      console.error("Errore caricamento dati Home:", error);
      return;
    }
    if (!result?.ok) {
      console.error("Errore caricamento dati Home:", result?.error || "Risposta non valida");
      return;
    }
    const jobRows = Array.isArray(result.jobs) ? result.jobs : [];
    const paymentRows = Array.isArray(result.payments) ? result.payments : [];
    const appointmentRows = Array.isArray(result.appointments) ? result.appointments : [];
    const revisionRows = Array.isArray(result.vehicles) ? result.vehicles.filter((row: any) => row.revisione != null) : [];
    const relationRows = Array.isArray(result.relations) ? result.relations : [];
    const clientRows = Array.isArray(result.clients) ? result.clients : [];
    const vehicleRows = Array.isArray(result.vehicles) ? result.vehicles : [];
    const orderRows = Array.isArray(result.orders) ? result.orders : [];
    const supplierRows = Array.isArray(result.suppliers) ? result.suppliers : [];
    let lavoriPerSolleciti: Lavoro[] = lavori;
    const vehicleIds = jobRows.map((row: any) => row.vehicle_id).filter(Boolean).map(String);
    const vehiclesForJobs = new Map<string, any>(vehicleRows.filter((row: any) => vehicleIds.includes(String(row.id))).map((row: any) => [String(row.id), row] as [string, any]));
    const clientsById = new Map<string, any>(clientRows.map((row: any) => [String(row.id), row] as [string, any]));
    setClientiAnagrafica(clientRows.map((row: any) => {
      const nomeCliente = String(row?.nome ?? "").trim();
      if (!nomeCliente) return null;
      return { clientKey: makeClientKey(nomeCliente, row?.telefono), clientId: String(row?.id ?? ""), nomeCliente, telefono: String(row?.telefono ?? "").trim() };
    }).filter(Boolean) as ClienteRicerca[]);
    const primaryClientByVehicle = new Map<string, any>();
    for (const relation of relationRows) {
      const vehicleId = String(relation.vehicle_id);
      if (relation.ruolo === "PRINCIPALE" || !primaryClientByVehicle.has(vehicleId)) primaryClientByVehicle.set(vehicleId, clientsById.get(String(relation.client_id)));
    }
    const lavoriCaricati: Lavoro[] = jobRows.map((row: any) => {
      const vehicle = vehiclesForJobs.get(String(row.vehicle_id));
      const client = primaryClientByVehicle.get(String(row.vehicle_id));
      const dettagli = row.dettagli && typeof row.dettagli === "object" ? row.dettagli : {};
      return {
        jobNumber: String(row.id ?? ""), createdAt: String(row.created_at ?? ""),
        nomeCliente: String(client?.nome ?? "").trim() || "Cliente",
        veicolo: String(vehicle?.veicolo ?? ""), targa: String(vehicle?.targa ?? ""), telefono: String(client?.telefono ?? ""),
        paymentAmount: row.payment_amount != null ? String(row.payment_amount) : "",
        paymentPaidAmount: row.payment_paid_amount != null ? String(row.payment_paid_amount) : "0",
        paymentStatus: row.payment_status === "PAGATO" ? "PAGATO" : row.payment_status === "PARZIALE" ? "PARZIALE" : "DA_PAGARE",
        types: Array.isArray(dettagli.types) ? dettagli.types : row.tipo ? [String(row.tipo)] : [],
        works: Array.isArray(dettagli.works) ? dettagli.works : String(row.lavori ?? ""),
        status: String(row.stato ?? "").toUpperCase() === "DA_DOCUMENTARE" ? "DA_DOCUMENTARE" : ["APERTO", "IN_LAVORAZIONE"].includes(String(row.stato ?? "").toUpperCase()) ? "IN_LAVORAZIONE" : "CONCLUSO",
        pdfUrl: String(dettagli.pdfUrl ?? ""),
      };
    });
    setLavori(lavoriCaricati);
    lavoriPerSolleciti = lavoriCaricati;
    const manuali: PagamentoManuale[] = paymentRows.map((row: any) => {
      const client = clientsById.get(String(row.client_id ?? ""));
      const vehicle = vehicleRows.find((item: any) => String(item.id) === String(row.vehicle_id ?? ""));
      const nomeCliente = String(client?.nome ?? row.nome_cliente ?? "").trim() || "Cliente";
      const stato = row.status === "PAGATO" ? "PAGATO" : row.status === "PARZIALE" ? "PARZIALE" : "DA_PAGARE";
      return { id: String(row.id), clientKey: makeClientKey(nomeCliente, client?.telefono), nomeCliente, telefono: String(client?.telefono ?? ""), targa: String(vehicle?.targa ?? ""), descrizione: String(row.description ?? ""), importo: String(row.amount ?? ""), paidAmount: String(row.paid_amount ?? "0"), stato, createdAt: String(row.created_at ?? "") };
    });
    setPagamentiManuali(manuali);
    setSolleciti(aggregaSolleciti(lavoriPerSolleciti, manuali));
    setAppuntamenti(appointmentRows.map((row: any) => {
      const dateTime = new Date(String(row.data_ora ?? ""));
      return { id: String(row.id ?? ""), date: Number.isNaN(dateTime.getTime()) ? "" : `${dateTime.getFullYear()}-${String(dateTime.getMonth()+1).padStart(2,"0")}-${String(dateTime.getDate()).padStart(2,"0")}`, time: Number.isNaN(dateTime.getTime()) ? "" : dateTime.toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit",hour12:false}), description: String(row.descrizione ?? row.titolo ?? "") };
    }));
    const revisionPrimaryByVehicle = new Map<string, any>();
    for (const relation of relationRows) {
      const id = String(relation.vehicle_id);
      if (relation.ruolo === "PRINCIPALE" || !revisionPrimaryByVehicle.has(id)) revisionPrimaryByVehicle.set(id, clientsById.get(String(relation.client_id)));
    }
    setRevisioni(revisionRows.map((row: any) => {
      const client = revisionPrimaryByVehicle.get(String(row.id)) || clientsById.get(String(row.client_id ?? ""));
      const nomeCliente = String(client?.nome ?? "").trim();
      return { id: `revisione-${row.id}`, nomeCliente, cliente: nomeCliente, telefono: String(client?.telefono ?? ""), veicolo: String(row.veicolo ?? ""), targa: String(row.targa ?? ""), revisione: String(row.revisione ?? "").slice(0,10), scadenza: String(row.revisione ?? "").slice(0,10) };
    }));
    setOrdini(orderRows.map((row: any) => {
      const prodotti = Array.isArray(row.prodotti) ? row.prodotti : [];
      const descrizione = prodotti.map((product: any) => { const nome=String(product?.name??"").trim(); if(!nome)return ""; const quantita=String(product?.quantity??"1").trim()||"1"; const dettagli=String(product?.details??"").trim(); return `${quantita} × ${nome}${dettagli ? ` — ${dettagli}` : ""}`; }).filter(Boolean).join(" · ");
      return { id:String(row.id??""), numero:String(row.numero??""), cliente:String(row.cliente??""), veicolo:String(row.veicolo??""), descrizione, stato:String(row.stato??"DA_INVIARE"), vehicleId:row.vehicle_id?String(row.vehicle_id):undefined, supplierId:row.supplier_id?String(row.supplier_id):undefined };
    }));
    setFornitori(supplierRows.map((row: any) => ({ id:String(row.id), nome:String(row.nome??""), whatsapp:String(row.whatsapp??"") })));
    const clientForVehicle = new Map<string, any>();
    for (const relation of relationRows) { const id=String(relation.vehicle_id); if(relation.ruolo==="PRINCIPALE"||!clientForVehicle.has(id))clientForVehicle.set(id,clientsById.get(String(relation.client_id))); }
    setVeicoliOrdini(vehicleRows.map((row: any) => ({ id:String(row.id), veicolo:String(row.veicolo??""), targa:String(row.targa??""), cliente:String(clientForVehicle.get(String(row.id))?.nome??"") })));
    if (aggiornaConteggi) void caricaConteggiRapidi();
  };
  const lavoriAttivi = useMemo(
    () =>
      lavori.filter(
        (lavoro) =>
          lavoro.status === "IN_LAVORAZIONE" || lavoro.status === "DA_DOCUMENTARE"
      ),
    [lavori]
  );
  const revisioniScadute = useMemo(() => {
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    return revisioni.filter((revisione) => {
      const raw =
        revisione.scadenza ||
        revisione.revisione;
      if (!raw) return false;
      const dataString = String(raw).slice(0, 10);
      const match = dataString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return false;
      const data = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      if (Number.isNaN(data.getTime())) return false;
      data.setHours(0, 0, 0, 0);
      const diff = Math.round((data.getTime() - oggi.getTime()) / 86400000);
      return diff <= 30;
    });
  }, [revisioni]);
  const appuntamentiOggi = useMemo(() => {
    const oggi = new Date();
    const yyyy = oggi.getFullYear();
    const mm = String(
      oggi.getMonth() + 1
    ).padStart(2, "0");
    const dd = String(
      oggi.getDate()
    ).padStart(2, "0");
    const oggiISO = `${yyyy}-${mm}-${dd}`;
    return appuntamenti
      .filter((appuntamento) => {
        const data =
          appuntamento.date ||
          appuntamento.data ||
          "";
        return (
          data === oggiISO ||
          data.includes(
            `${dd}/${mm}/${yyyy}`
          )
        );
      })
      .sort((a, b) =>
        (
          a.time ||
          a.ora ||
          ""
        ).localeCompare(
          b.time ||
          b.ora ||
          ""
        )
      );
  }, [appuntamenti]);
  const apriLavoro = (lavoro: Lavoro) => {
    sessionStorage.setItem(
      "goldencar_apri_scheda",
      String(lavoro.jobNumber)
    );
    setModal(null);
    router.push("/veicolo/scheda");
  };
  const avvisaRevisione = (
    revisione: Revisione
  ) => {
    const telefono =
      revisione.telefono || "";
    const nome =
      revisione.nomeCliente ||
      revisione.cliente ||
      "cliente";
    const rawDate = String(revisione.scadenza || revisione.revisione || "").slice(0, 10);
    const matchDate = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const dateLabel = matchDate
      ? `${matchDate[3]}/${matchDate[2]}/${matchDate[1]}`
      : rawDate;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = matchDate
      ? new Date(Number(matchDate[1]), Number(matchDate[2]) - 1, Number(matchDate[3]))
      : null;
    const expired = dueDate ? dueDate.getTime() < today.getTime() : false;
    const statusText = expired ? `è scaduta il ${dateLabel}` : `scadrà il ${dateLabel}`;
    const messaggio = encodeURIComponent(
      `Ciao ${nome}, ti ricordiamo che la revisione del veicolo ${revisione.veicolo || ""} targato ${revisione.targa || ""} ${statusText}. Contattaci per fissare un appuntamento.`
    );
    if (telefono) {
      const numero = telefono.replace(
        /\s+/g,
        ""
      );
      window.open(
        `https://wa.me/${numero}?text=${messaggio}`,
        "_blank",
        "noopener,noreferrer"
      );
    } else {
      alert(
        "Questo cliente non ha un numero di telefono."
      );
    }
  };
  const sollecita = (sollecito: Sollecito) => {
    const telefono = sollecito.telefono || "";
    const nome = sollecito.nomeCliente || "cliente";
    const importo = formatEuro(parseImporto(sollecito.importo));
    const messaggio = encodeURIComponent(
      `Ciao ${nome}, ti contattiamo per ricordarti che risulta ancora da saldare un importo di ${importo}. Grazie.`
    );
    if (!telefono) {
      alert("Questo cliente non ha un numero di telefono.");
      return;
    }
    const numero = telefono.replace(/\s+/g, "");
    window.open(
      `https://wa.me/${numero}?text=${messaggio}`,
      "_blank",
      "noopener,noreferrer"
    );
  };
  const aggiornaStatiPagamento = async (clientKey: string) => {
    const targetJobs = lavori.filter((l) =>
      makeClientKey(l.nomeCliente || "Cliente", l.telefono) === clientKey &&
      l.paymentStatus !== "PAGATO"
    );
    const targetManuali = pagamentiManuali.filter((p) => p.clientKey === clientKey && p.stato !== "PAGATO");
    const ok = window.confirm("Confermi che tutte le voci di questo cliente sono state pagate?");
    if (!ok) return;
    try {
      for (const lavoro of targetJobs) {
        const response = await fetch("/api/jobs/payment", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: String(lavoro.jobNumber), paymentStatus: "PAGATO", paymentPaidAmount: parseImporto(lavoro.paymentAmount) }) });
        const result = await response.json();
        if (!response.ok || !result?.ok) throw new Error(result?.error || "Errore aggiornamento pagamento scheda.");
      }
      for (const pagamento of targetManuali) {
        const response = await fetch("/api/payments", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: pagamento.id }) });
        const result = await response.json();
        if (!response.ok || !result?.ok) throw new Error(result?.error || "Errore eliminazione pagamento.");
      }
      await caricaDati();
      setDettaglioSollecito(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Errore durante l'aggiornamento del sollecito.");
    }
  };

  const pagaTuttoCliente = (sollecito: Sollecito) => {
    void aggiornaStatiPagamento(
      sollecito.clientKey || makeClientKey(sollecito.nomeCliente || "", sollecito.telefono)
    );
  };

  const pagaSingolo = async (pagamento: PagamentoDettaglio) => {
    const ok = window.confirm(`Confermi il pagamento di ${formatEuro(pagamento.importo)} per "${pagamento.descrizione}"?`);
    if (!ok) return;
    try {
      if (pagamento.manuale) {
        const response = await fetch("/api/payments", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: pagamento.id }) });
        const result = await response.json();
        if (!response.ok || !result?.ok) throw new Error(result?.error || "Errore eliminazione pagamento.");
      } else {
        const response = await fetch("/api/jobs/payment", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: String(pagamento.jobNumber), paymentStatus: "PAGATO", paymentPaidAmount: parseImporto(pagamento.totale ?? pagamento.importo) }) });
        const result = await response.json();
        if (!response.ok || !result?.ok) throw new Error(result?.error || "Errore aggiornamento pagamento scheda.");
      }
      await caricaDati();
      setDettaglioSollecito(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Errore durante la registrazione del pagamento.");
    }
  };

  const pagamentiCliente = (sollecito: Sollecito): PagamentoDettaglio[] => {
    const key = sollecito.clientKey || makeClientKey(sollecito.nomeCliente || "", sollecito.telefono);
    const result: PagamentoDettaglio[] = [];

    for (const lavoro of lavori) {
      const nome = lavoro.nomeCliente || "Cliente";
      if (makeClientKey(nome, lavoro.telefono) !== key || lavoro.paymentStatus === "PAGATO") continue;
      const totale = parseImporto(lavoro.paymentAmount);
      const pagato = parseImporto(lavoro.paymentPaidAmount);
      const residuo = Math.max(0, totale - pagato);
      if (residuo <= 0) continue;

      result.push({
        id: String(lavoro.jobNumber),
        clientKey: key,
        nomeCliente: nome,
        telefono: lavoro.telefono,
        descrizione: `Scheda ${lavoro.jobNumber}${(() => {
          const worksText = Array.isArray(lavoro.works)
            ? lavoro.works.filter(Boolean).join(" · ").trim()
            : String(lavoro.works || "").trim();
          return worksText ? ` · ${worksText}` : "";
        })()}`,
        importo: residuo,
        totale,
        pagato,
        stato: lavoro.paymentStatus === "PARZIALE" ? "PARZIALE" : "DA_PAGARE",
        jobNumber: lavoro.jobNumber,
        data: lavoro.createdAt,
      });
    }

    for (const pagamento of pagamentiManuali) {
      if (pagamento.clientKey !== key || pagamento.stato === "PAGATO") continue;
      const totale = parseImporto(pagamento.importo);
      const pagato = parseImporto(pagamento.paidAmount);
      const residuo = Math.max(0, totale - pagato);
      if (residuo <= 0) continue;

      result.push({
        id: pagamento.id,
        clientKey: key,
        nomeCliente: pagamento.nomeCliente,
        telefono: pagamento.telefono,
        descrizione: pagamento.descrizione,
        importo: residuo,
        totale,
        pagato,
        stato: pagamento.stato,
        manuale: true,
      });
    }
    return result;
  };

  const clientiDisponibili = useMemo<ClienteRicerca[]>(() => {
    const map = new Map<string, ClienteRicerca>();

    for (const cliente of clientiAnagrafica) {
      map.set(cliente.clientKey, cliente);
    }

    for (const lavoro of lavori) {
      const nome = String(lavoro.nomeCliente || "").trim();
      if (!nome) continue;
      const telefono = String(lavoro.telefono || "").trim();
      const key = makeClientKey(nome, telefono);
      const existing = map.get(key);

      map.set(key, {
        clientKey: key,
        clientId: existing?.clientId,
        nomeCliente: nome,
        telefono,
        targa: String(existing?.targa || lavoro.targa || "").trim(),
      });
    }

    return Array.from(map.values()).sort((a, b) =>
      a.nomeCliente.localeCompare(b.nomeCliente, "it")
    );
  }, [clientiAnagrafica, lavori]);

  const clientiFiltrati = useMemo(() => {
    const q = clienteQuery.trim().toLowerCase();
    if (!q) return clientiDisponibili.slice(0, 8);
    return clientiDisponibili.filter((cliente) =>
      [cliente.nomeCliente].some(value => value.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [clienteQuery, clientiDisponibili]);
  const apriNuovoPagamento = () => {
    setClienteQuery("");
    setClienteSelezionatoPagamento(null);
    setInserimentoNomeLibero(false);
    setNuovoClienteNome("");
    setNuovoClienteTelefono("");
    setNuovoPagamentoDescrizione("");
    setNuovoPagamentoImporto("");
    setNuovoPagamentoAperto(true);
  };
  const salvaNuovoPagamento = async () => {
    const nome = (clienteSelezionatoPagamento?.nomeCliente || nuovoClienteNome).trim();
    const importo = parseImporto(nuovoPagamentoImporto);
    const descrizione = nuovoPagamentoDescrizione.trim();
    if (!nome) { alert("Inserisci il nome del cliente."); return; }
    if (importo <= 0) { alert("Inserisci un importo valido."); return; }
    if (!descrizione) { alert("Inserisci la descrizione."); return; }
    try {
      const response = await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: crypto.randomUUID(), client_id: clienteSelezionatoPagamento?.clientId || null, nome_cliente: nome, description: descrizione, amount: importo }) });
      const result = await response.json();
      if (!response.ok || !result?.ok) throw new Error(result?.error || "Errore salvataggio sollecito.");
      setNuovoPagamentoAperto(false);
      setClienteSelezionatoPagamento(null); setClienteQuery("");
      setNuovoClienteNome(""); setNuovoClienteTelefono(""); setNuovoPagamentoDescrizione(""); setNuovoPagamentoImporto("");
      await caricaDati();
    } catch (error) {
      console.error("Errore salvataggio sollecito:", error);
      alert(error instanceof Error ? error.message : "Errore durante il salvataggio del sollecito.");
    }
  };

  const parseAgendaVoice = (text: string) => {
    const months = ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
    const weekdays = ["domenica","lunedì","martedì","mercoledì","giovedì","venerdì","sabato"];
    const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
    const year = new Date().getFullYear();
    let date = new Date(year, new Date().getMonth(), new Date().getDate());
    const dm = normalized.match(/\b(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\b/);
    const numeric = normalized.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
    const weekday = normalized.match(/\b(domenica|lunedì|lunedi|martedì|martedi|mercoledì|mercoledi|giovedì|giovedi|venerdì|venerdi|sabato)\b/);
    if (dm) date = new Date(year, months.indexOf(dm[2]), Number(dm[1]));
    else if (numeric) date = new Date(numeric[3] ? (Number(numeric[3])<100 ? 2000+Number(numeric[3]) : Number(numeric[3])) : year, Number(numeric[2])-1, Number(numeric[1]));
    const tm = normalized.match(/\b(?:alle|ore)\s+(\d{1,2})(?:[\.:](\d{1,2}))?\b/);
    if (!tm) return null;
    if (weekday && !dm && !numeric) {
      const w = weekdays.indexOf(weekday[1].replace("lunedi","lunedì").replace("martedi","martedì").replace("mercoledi","mercoledì").replace("giovedi","giovedì").replace("venerdi","venerdì"));
      const today = new Date();
      const hh0 = Number(tm[1]);
      const min0 = Number(tm[2] || 0);
      const isToday = w === today.getDay();
      const timePassed = hh0 < today.getHours() || (hh0 === today.getHours() && min0 <= today.getMinutes());
      const delta = (w - today.getDay() + 7) % 7 || (timePassed ? 7 : 0);
      date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + delta);
    }
    const hh = Number(tm[1]); const min = Number(tm[2] || 0);
    if (hh < 0 || hh > 23 || min < 0 || min > 59) return null;
    const afterTime = normalized.slice((tm.index ?? 0) + tm[0].length);
    const pm = afterTime.match(/\bper\s+(.+)$/);
    const description = pm?.[1]?.trim() || afterTime.trim().replace(/^[,;.-]+/,"");
    if (!description) return null;
    if (Number.isNaN(date.getTime())) return null;
    if (dm && (date.getMonth() !== months.indexOf(dm[2]) || date.getDate() !== Number(dm[1]))) return null;
    if (numeric && (date.getMonth() !== Number(numeric[2]) - 1 || date.getDate() !== Number(numeric[1]))) return null;
    return { date: `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`, time: `${String(hh).padStart(2,"0")}:${String(min).padStart(2,"0")}`, description };
  };
  const aggiungiAppuntamentoVocale = () => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) { alert("La dettatura vocale non è disponibile in questo browser."); return; }
    if (listening) return;
    const recognition = new Recognition();
    recognition.lang = "it-IT"; recognition.interimResults = false; recognition.continuous = false;
    recognition.onresult = (event:any) => {
      const testo = String(event.results?.[0]?.[0]?.transcript || "").trim();
      setListening(false);
      if (!testo) return;
      const parsed = parseAgendaVoice(testo);
      if (!parsed) { alert("Non ho capito data, ora o descrizione. Esempio: giovedì 10 ottobre alle 14.30 per cambio gomme Luca Martini."); return; }
      setAgendaVoiceText(testo); setAgendaDraft(parsed); setAgendaVoiceOpen(true);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    setListening(true); recognition.start();
  };
  const salvaAgendaVoice = async () => {
    if (!agendaDraft.date || !agendaDraft.time || !agendaDraft.description) return;
    const local = new Date(`${agendaDraft.date}T${agendaDraft.time}:00`);
    const response = await fetch("/api/appointments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: crypto.randomUUID(), description: agendaDraft.description, dateTime: local.toISOString() }) });
    const result = await response.json();
    if (!response.ok || !result?.ok) { alert("Non è stato possibile salvare l'appuntamento: " + (result?.error || "Errore sconosciuto.")); return; }
    setAgendaVoiceOpen(false); setAgendaVoiceText(""); await caricaDati();
  };

  const salvaNuovoOrdineHome = async () => {
    const vehicle = veicoliOrdini.find(v => v.id === ordineVeicoloId);
    const supplier = fornitori.find(s => s.id === ordineFornitoreId);
    const desc = ordineDescrizione.trim();
    if (!vehicle || !desc) { alert("Seleziona il veicolo e inserisci cosa ordinare."); return; }
    const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: crypto.randomUUID(), numero: String(Date.now()), vehicleId: vehicle.id, supplierId: supplier?.id || "", cliente: vehicle.cliente, veicolo: vehicle.veicolo, targa: vehicle.targa, prodotti: [{ name: desc, quantity: "1" }] }) });
    const result = await response.json();
    if (!response.ok || !result?.ok) { alert("Errore salvataggio ordine: " + (result?.error || "Errore sconosciuto.")); return; }
    setNuovoOrdineAperto(false); setOrdineDescrizione(""); setOrdineVeicoloId(""); setOrdineFornitoreId(""); await caricaDati();
  };
  const inviaOrdineHome = async (ordine: Ordine) => {
    // Usa il fornitore attualmente selezionato nel modale, non quello salvato
    // in precedenza sull'ordine: l'utente può averlo appena cambiato.
    const supplierId = String(ordineFornitoreId || ordine.supplierId || "").trim();
    const supplier = fornitori.find((item) => String(item.id).trim() === supplierId);
    if (!supplierId || !supplier) {
      alert("Seleziona un fornitore prima di inviare l'ordine.");
      return;
    }
    const numero = String(supplier.whatsapp || "").replace(/\D/g, "");
    if (!numero) {
      alert(`Il fornitore "${supplier.nome}" non ha un numero WhatsApp valido nella rubrica. Apri la rubrica fornitori e verifica il numero.`);
      return;
    }

    const descrizione = ordineDescrizione.trim() || ordine.descrizione || "";
    const targa = String(veicoliOrdini.find((vehicle) => String(vehicle.id) === String(ordine.vehicleId))?.targa || "").trim();
    if (!targa) {
      alert("Non trovo la targa del veicolo associato all'ordine. Verifica il veicolo prima di inviare.");
      return;
    }
    const elenco = descrizione.split(/\s·\s/).map((voce) => voce.trim()).filter(Boolean).map((voce) => "• " + voce).join("\n");
    const testo = "Buongiorno,\nMi servirebbe per la targa " + targa + ":" + (elenco ? "\n" + elenco : "");
    const whatsappWindow = window.open("about:blank", "_blank");
    if (!whatsappWindow) {
      alert("Il browser ha bloccato l'apertura di WhatsApp. Consenti i popup e riprova.");
      return;
    }
    whatsappWindow.opener = null;
    whatsappWindow.location.href = `https://wa.me/${numero}?text=${encodeURIComponent(testo)}`;

    // Aggiornamento ottimistico: la UI riflette subito l'invio, senza attendere Supabase.
    const statoPrecedente = ordine.stato;
    setOrdini((current) => current.map((item) =>
      item.id === ordine.id ? { ...item, stato: "INVIATO", supplierId, descrizione } : item
    ));
    setOrdineAperto({ ...ordine, stato: "INVIATO", supplierId, descrizione });

    const response = await fetch("/api/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ordine.id, supplierId, description: descrizione, stato: "INVIATO" }),
      cache: "no-store",
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) {
      setOrdini((current) => current.map((item) =>
        item.id === ordine.id ? { ...item, stato: statoPrecedente } : item
      ));
      setOrdineAperto({ ...ordine, stato: statoPrecedente });
      alert("WhatsApp è stato aperto, ma non ho potuto aggiornare l'ordine: " + (result?.error || "Errore sconosciuto."));
      return;
    }
    invalidateApiCache("/api/home");
    setOrdineAperto(null);
    void caricaDati(false);
    void caricaConteggiRapidi();
  };
  const salvaFornitoreHome = async () => {
    const nome = fornitoreEditNome.trim();
    const whatsapp = fornitoreEditWhatsapp.replace(/\D/g, "");
    if (!nome || !whatsapp) { alert("Inserisci nome e numero WhatsApp."); return; }
    try {
      if (fornitoreEditId) {
        const response = await fetch("/api/orders", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: fornitoreEditId, nome, whatsapp }) });
        const result = await response.json();
        if (!response.ok || !result?.ok) throw new Error(result?.error || "Errore salvataggio fornitore.");
      } else {
        const id = `fornitore-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
        const response = await fetch("/api/orders", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, nome, whatsapp }) });
        const result = await response.json();
        if (!response.ok || !result?.ok) throw new Error(result?.error || "Errore salvataggio fornitore.");
      }
      setRubricaFornitoreAperta(false);
      setFornitoreEditId(""); setFornitoreEditNome(""); setFornitoreEditWhatsapp(""); setNuovoFornitoreMode(false);
      await caricaDati();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Errore nel salvataggio del fornitore.");
    }
  };

  const aggiornaOrdineHome = async () => {
    if (!ordineAperto?.id) return;
    const supplier = fornitori.find(s=>s.id===ordineFornitoreId);
    const desc = ordineDescrizione.trim();
    if(!desc || !supplier){ alert("Inserisci descrizione e fornitore."); return; }
    const response = await fetch("/api/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: ordineAperto.id, description: desc, supplierId: supplier.id }) });
    const result = await response.json();
    if (!response.ok || !result?.ok) { alert("Errore aggiornamento ordine: " + (result?.error || "Errore sconosciuto.")); return; }
    setOrdineAperto(null); await caricaDati();
  };

  return (
    <>
      <main
        className="app"
        style={{
          paddingBottom: 140,
        }}
      >
        {/* =========================
            HEADER
        ========================= */}
        <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "28px 20px 24px" }}>
        <div style={{ width: 110, height: 90, display: "flex", alignItems: "center", justifyContent: "flex-start", flexShrink: 0 }}>
            <img src="/logo.png" alt="Goldencar" style={{ width: "110px", height: "90px", objectFit: "contain" }} />
          </div>
          <h1
            style={{
              fontSize: 31,
              fontWeight: 800,
              color: "#041E49",
              letterSpacing: "-0.7px",
              margin: "3px 0 0",
            }}
          >
            GOLDENCAR
          </h1>
        </div>
        {/* =========================
            STATISTICHE
        ========================= */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(3, 1fr)",
            gap: 14,
            padding: "0 18px",
            marginTop: 36,
          }}
        >
          <StatCard
            title="LAVORI"
            value={conteggiRapidi?.lavori ?? lavoriAttivi.length}
            color="#111827"
            icon={<IconLavori />}
            onClick={() =>
              setModal("lavori")
            }
          />
          <StatCard
            title="REVISIONI"
            value={conteggiRapidi?.revisioni ?? revisioniScadute.length}
            color="#D4AF37"
            icon={<IconRevisioni />}
            onClick={() =>
              setModal("revisioni")
            }
          />
          <StatCard
            title="AGENDA"
            value={conteggiRapidi?.agenda ?? appuntamentiOggi.length}
            color="#2563EB"
            icon={<IconAgenda />}
            onClick={() =>
              setModal("agenda")
            }
          />
          <StatCard
            title="SOLLECITI"
            value={sollecitiRapido ?? solleciti.length}
            color="#EA580C"
            icon={<IconAlert />}
            onClick={() =>
              setModal("solleciti")
            }
          />
          <StatCard
            title="ORDINI"
            value={conteggiRapidi?.ordini ?? ordini.length}
            color="#0F766E"
            icon={<IconOrdini />}
            onClick={() =>
              setModal("ordini")
            }
          />
          <StatCard
            title="FATTURE"
            value="web"
            color="#7C3AED"
            icon={<IconFatture />}
            onClick={() => {
              window.open(
                "https://metropolis.seac.it/login",
                "_blank",
                "noopener,noreferrer"
              );
            }}
          />
        </div>
        {/* =========================
            CHECK IN / OUT
        ========================= */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "0 18px",
              marginTop: 120,
            }}
          >
            <button
              type="button"
              onClick={apriCheckIn}
              style={{
                width: "calc(50% - 9px)",
                maxWidth: 300,
                height: 132,
                border: "none",
                borderRadius: 30,
                background: "#D4AF37",
                boxShadow: "0 8px 20px rgba(0,0,0,.12)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <CameraIcon />
              <span
                style={{
                  marginTop: 12,
                  fontSize: 20,
                  fontWeight: 800,
                  color: "#08142F",
                }}
              >
                CHECK-IN
              </span>
            </button>
          </div>
      </main>
      <BottomBar />
      {(checkInOpen || checkInError) && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Check-in e lettura targa"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "#050B16",
            display: "flex",
            flexDirection: "column",
            color: "#FFFFFF",
            padding: "env(safe-area-inset-top) 0 env(safe-area-inset-bottom)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: ".5px" }}>CHECK-IN</div>
              <div style={{ marginTop: 4, color: "#CBD5E1", fontSize: 13 }}>Inquadra la targa dentro il riquadro</div>
            </div>
            <button type="button" onClick={stopCheckInCamera} aria-label="Chiudi fotocamera" style={{ width: 42, height: 42, border: "1px solid #475569", borderRadius: "50%", background: "#172033", color: "#FFFFFF", fontSize: 25, cursor: "pointer" }}>×</button>
          </div>

          <div style={{ position: "relative", flex: 1, minHeight: 0, overflow: "hidden", background: "#111827", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {checkInOpen && (
              <video
                ref={checkInVideoRef}
                autoPlay
                muted
                playsInline
                onLoadedMetadata={(event) => { void event.currentTarget.play().catch((error) => { console.error("CHECK-IN video playback error:", error); setCheckInError("La fotocamera è attiva ma l'anteprima non parte. Chiudi e riprova."); }); }}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            )}
            {checkInOpen && (
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.34)", clipPath: "polygon(0 0,100% 0,100% 38%,91% 38%,91% 62%,100% 62%,100% 100%,0 100%,0 62%,9% 62%,9% 38%,0 38%)" }} />
                <div style={{ position: "relative", width: "min(82%, 620px)", aspectRatio: "4.7 / 1", maxHeight: 125, border: "3px solid #D4AF37", borderRadius: 14, boxShadow: "0 0 0 9999px rgba(0,0,0,.22)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ position: "absolute", top: -12, left: 16, right: 16, height: 3, background: "#D4AF37", borderRadius: 3 }} />
                  <span style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(5,11,22,.78)", color: "#FFFFFF", fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>TARGA</span>
                </div>
              </div>
            )}
            {!checkInOpen && checkInError && (
              <div style={{ padding: 28, textAlign: "center", maxWidth: 420 }}>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>Fotocamera non disponibile</div>
                <div style={{ color: "#FECACA", fontSize: 14, lineHeight: 1.5 }}>{checkInError}</div>
              </div>
            )}
          </div>

          <div style={{ padding: "18px 20px 24px", flexShrink: 0, background: "#050B16" }}>
            {checkInError && checkInOpen && (
              <div role="alert" style={{ marginBottom: 12, borderRadius: 12, background: "#7F1D1D", padding: 11, color: "#FEE2E2", fontSize: 13 }}>{checkInError}</div>
            )}
            <button type="button" onClick={() => { void captureCheckInPlate(); }} disabled={!checkInOpen || checkInBusy} style={{ width: "100%", minHeight: 70, border: "none", borderRadius: 18, background: checkInBusy ? "#64748B" : "#D4AF37", color: "#08142F", fontSize: 19, fontWeight: 900, letterSpacing: ".8px", cursor: checkInBusy ? "wait" : "pointer", opacity: checkInOpen ? 1 : .6 }}>
              {checkInBusy ? "LETTURA IN CORSO…" : "SCANSIONA TARGA"}
            </button>
            {checkInError && (
              <button type="button" onClick={() => { setCheckInError(""); if (!checkInOpen) void openCheckInCamera(); }} style={{ width: "100%", marginTop: 10, minHeight: 44, border: "1px solid #475569", borderRadius: 14, background: "transparent", color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>RIPROVA</button>
            )}
          </div>
        </div>
      )}
      {/* =========================
          MODAL LAVORI
      ========================= */}
      {modal === "lavori" && (
        <Modal
          title="LAVORI ATTIVI"
          onClose={() => setModal(null)}
          topRight={
            <button type="button" onClick={() => { setModal(null); router.push("/revisioni?tab=lavori"); }} style={modalLinkStyle}>
              LAVORI
            </button>
          }
        >
          {lavoriAttivi.length === 0 ? (
            <EmptyState text="Nessun lavoro in lavorazione." />
          ) : (
            lavoriAttivi.map((lavoro, index) => (
              <LavoroRow
                key={String(lavoro.jobNumber || index)}
                lavoro={lavoro}
                onClick={() => apriLavoro(lavoro)}
              />
            ))
          )}
        </Modal>
      )}

      {modal === "revisioni" && (
        <Modal
          title="REVISIONI"
          onClose={() => setModal(null)}
          topRight={
            <button type="button" onClick={() => { setModal(null); router.push("/revisioni?tab=revisioni"); }} style={modalLinkStyle}>
              REVISIONI
            </button>
          }
        >
          {revisioniScadute.length === 0 ? (
            <EmptyState text="Nessuna revisione in scadenza nei prossimi 30 giorni." />
          ) : (
            revisioniScadute.map((revisione, index) => (
              <RevisionRow
                key={String(revisione.id || index)}
                revisione={revisione}
                onWhatsApp={() => avvisaRevisione(revisione)}
              />
            ))
          )}
        </Modal>
      )}

      {modal === "agenda" && (
        <Modal
          title="APPUNTAMENTI DI OGGI"
          onClose={() => setModal(null)}
          topRight={
            <button type="button" onClick={() => { setModal(null); router.push("/agenda"); }} style={modalLinkStyle}>
              AGENDA
            </button>
          }
        >
          {appuntamentiOggi.length === 0 ? (
            <EmptyState text="Nessun appuntamento oggi." />
          ) : (
            appuntamentiOggi.map((appuntamento, index) => (
              <AppointmentRow key={String(appuntamento.id || index)} appuntamento={appuntamento} />
            ))
          )}
          <button
            type="button"
            onClick={aggiungiAppuntamentoVocale}
            style={{ width: 52, height: 52, margin: "14px auto 0", border: "none", borderRadius: 17, background: "#2563EB", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 30, fontWeight: 400 }}
            aria-label="Nuovo appuntamento vocale"
          >
            +
          </button>
        </Modal>
      )}

      {modal === "solleciti" && (
        <Modal
          title="SOLLECITI"
          onClose={() => setModal(null)}
        >
          {solleciti.length === 0 ? (
            <EmptyState text="Nessun sollecito presente." />
          ) : (
            solleciti.map((sollecito, index) => (
              <SollecitoRow
                key={String(sollecito.clientKey || sollecito.id || index)}
                sollecito={sollecito}
                onPayAll={() => pagaTuttoCliente(sollecito)}
                onDetails={() => setDettaglioSollecito(sollecito)}
                onWhatsApp={() => sollecita(sollecito)}
              />
            ))
          )}
          <button
            type="button"
            onClick={apriNuovoPagamento}
            style={{ width: 52, height: 52, margin: "14px auto 0", border: "none", borderRadius: 17, background: "#D4AF37", color: "#111827", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 30, fontWeight: 400 }}
            aria-label="Nuovo sollecito"
          >
            +
          </button>
        </Modal>
      )}

      {modal === "ordini" && (
        <Modal
          title="ORDINI"
          onClose={() => setModal(null)}
          topRight={
            <button
              type="button"
              onClick={() => { setNuovoFornitoreMode(false); setFornitoreEditId(""); setFornitoreEditNome(""); setFornitoreEditWhatsapp(""); setRubricaFornitoreAperta(true); }}
              style={modalLinkStyle}
            >
              RUBRICA
            </button>
          }
        >
          {ordini.length === 0 ? (
            <EmptyState text="Nessun ordine presente." />
          ) : (
            ordini.map((ordine, index) => (
              <OrderRow
                key={ordine.id || ordine.numero || index}
                ordine={ordine}
                onClick={() => {
                  if (ordine.stato === "INVIATO") {
                    const conferma = window.confirm("Questo ordine risulta già inviato. Vuoi eliminarlo dalla lista?");
                    if (!conferma) return;
                    void (async () => {
                      const response = await fetch("/api/orders", {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: ordine.id }),
                      });
                      const result = await response.json().catch(() => null);
                      if (!response.ok || !result?.ok) {
                        alert("Non è stato possibile eliminare l'ordine: " + (result?.error || "Errore sconosciuto."));
                        return;
                      }
                      await caricaDati();
                    })();
                    return;
                  }
                  setOrdineAperto(ordine);
                  setOrdineDescrizione(ordine.descrizione || "");
                  setOrdineFornitoreId(ordine.supplierId || "");
                }}
              />
            ))
          )}
          <button
            type="button"
            onClick={() => { setOrdineAperto(null); setOrdineDescrizione(""); setOrdineVeicoloId(""); setOrdineFornitoreId(""); setNuovoOrdineAperto(true); }}
            style={{ width: 52, height: 52, margin: "14px auto 0", border: "none", borderRadius: 17, background: "#D4AF37", color: "#111827", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 30, fontWeight: 400 }}
            aria-label="Nuovo ordine"
          >
            +
          </button>
        </Modal>
      )}

      {dettaglioSollecito && (
        <Modal
          title={dettaglioSollecito.nomeCliente || "SOLLECITO"}
          onClose={() => setDettaglioSollecito(null)}
        >
          <div style={{fontSize:13,fontWeight:800,color:"#64748B",marginBottom:2}}>DETTAGLIO DEI LAVORI</div>
          {pagamentiCliente(dettaglioSollecito).length === 0 ? (
            <EmptyState text="Nessun importo da pagare." />
          ) : (
            pagamentiCliente(dettaglioSollecito).map((pagamento) => (
              <div key={pagamento.id} style={{background:"#FFFFFF",borderRadius:17,padding:13,display:"flex",alignItems:"center",gap:10}}>
                <button
                  type="button"
                  onClick={() => void pagaSingolo(pagamento)}
                  style={{width:30,height:30,borderRadius:9,border:"2px solid #CBD5E1",background:"#FFFFFF",flexShrink:0,cursor:"pointer"}}
                  aria-label="Segna come pagato"
                />
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:900,color:"#111827"}}>{pagamento.descrizione}</div>
                  {pagamento.data && <div style={{fontSize:12,color:"#64748B",marginTop:3}}>
                    {new Date(pagamento.data).toLocaleDateString("it-IT")}
                  </div>}
                  <div style={{fontSize:16,fontWeight:900,color:"#EA580C",marginTop:3}}>{formatEuro(pagamento.importo)}</div>
                </div>
              </div>
            ))
          )}
          <div style={{display:"flex",justifyContent:"space-between",padding:"8px 4px 0",fontWeight:900,color:"#111827"}}>
            <span>TOTALE RESIDUO</span>
            <span>{formatEuro(pagamentiCliente(dettaglioSollecito).reduce((sum,p) => sum + p.importo, 0))}</span>
          </div>
          <button type="button" onClick={() => pagaTuttoCliente(dettaglioSollecito)} style={primaryButtonStyle}>SEGNA TUTTO COME PAGATO</button>
        </Modal>
      )}

      {agendaVoiceOpen && (
        <Modal title="CONFERMA APPUNTAMENTO" onClose={() => setAgendaVoiceOpen(false)}>
          <div style={{fontSize:12,color:"#64748B",marginBottom:8}}>Dettato: {agendaVoiceText}</div>
          <label style={labelStyle}>DATA</label>
          <input type="date" value={agendaDraft.date} onChange={e=>setAgendaDraft({...agendaDraft,date:e.target.value})} style={inputStyle}/>
          <label style={labelStyle}>ORA</label>
          <input type="time" value={agendaDraft.time} onChange={e=>setAgendaDraft({...agendaDraft,time:e.target.value})} style={inputStyle}/>
          <label style={labelStyle}>APPUNTAMENTO</label>
          <textarea value={agendaDraft.description} onChange={e=>setAgendaDraft({...agendaDraft,description:e.target.value})} style={{...inputStyle,minHeight:90,resize:"vertical"}}/>
          <button type="button" onClick={()=>void salvaAgendaVoice()} style={primaryButtonStyle}>SALVA APPUNTAMENTO</button>
        </Modal>
      )}
      {nuovoPagamentoAperto && (
        <Modal title="NUOVO SOLLECITO" onClose={() => setNuovoPagamentoAperto(false)}>
          <label style={labelStyle}>CERCA CLIENTE</label>
          <div style={{display:"flex",gap:8}}>
            <input value={clienteQuery} onChange={e=>setClienteQuery(e.target.value)} placeholder="Nome cliente" style={{...inputStyle,flex:1}} />
            <button type="button" onClick={()=>{setInserimentoNomeLibero(true);setClienteSelezionatoPagamento(null);setClienteQuery("");}} style={{width:48,border:0,borderRadius:14,background:"#D4AF37",fontSize:22,fontWeight:900}}>+</button>
          </div>
          {!inserimentoNomeLibero && !clienteSelezionatoPagamento && clienteQuery.trim() && clientiFiltrati.map(cliente => (
            <button key={cliente.clientKey} type="button" onClick={()=>{setClienteSelezionatoPagamento(cliente);setClienteQuery(cliente.nomeCliente);}} style={{width:"100%",textAlign:"left",border:0,borderRadius:12,padding:11,background:"#FFFFFF"}}>
              <div style={{fontWeight:900}}>{cliente.nomeCliente}</div>
            </button>
          ))}
          {clienteSelezionatoPagamento && <div style={{background:"#FFF4C2",borderRadius:12,padding:10,fontWeight:900}}>{clienteSelezionatoPagamento.nomeCliente}</div>}
          {inserimentoNomeLibero && (
            <>
              <label style={labelStyle}>NOME CLIENTE</label>
              <input value={nuovoClienteNome} onChange={e=>setNuovoClienteNome(e.target.value)} placeholder="Nome e cognome" style={inputStyle} />
            </>
          )}
          <label style={labelStyle}>DESCRIZIONE</label>
          <input value={nuovoPagamentoDescrizione} onChange={e=>setNuovoPagamentoDescrizione(e.target.value)} placeholder="Es. Tagliando" style={inputStyle} />
          <label style={labelStyle}>IMPORTO</label>
          <input value={nuovoPagamentoImporto} onChange={e=>setNuovoPagamentoImporto(e.target.value)} placeholder="0,00" inputMode="decimal" style={inputStyle} />
          <button type="button" onClick={()=>void salvaNuovoPagamento()} style={primaryButtonStyle}>SALVA SOLLECITO</button>
        </Modal>
      )}

      {nuovoOrdineAperto && (
        <Modal title="NUOVO ORDINE" onClose={() => setNuovoOrdineAperto(false)}>
          <label style={labelStyle}>VEICOLO</label>
          <select value={ordineVeicoloId} onChange={e=>setOrdineVeicoloId(e.target.value)} style={inputStyle}>
            <option value="">Seleziona veicolo</option>
            {veicoliOrdini.map(v=><option key={v.id} value={v.id}>{v.targa} — {v.veicolo} — {v.cliente}</option>)}
          </select>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginTop:12,marginBottom:6}}>
            <label style={{...labelStyle,margin:0}}>COSA ORDINARE</label>
            <button type="button" onClick={()=>{const R=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(!R){alert("Dettatura non disponibile.");return;}const r=new R();r.lang="it-IT";r.onresult=(e:any)=>{setOrdineDescrizione(String(e.results?.[0]?.[0]?.transcript||""));setOrdineListening(false)};r.onerror=()=>setOrdineListening(false);r.onend=()=>setOrdineListening(false);setOrdineListening(true);r.start();}} aria-label={ordineListening?"Ascolto in corso":"Detta descrizione ordine"} title={ordineListening?"Ascolto in corso":"Detta descrizione ordine"} style={{width:36,height:36,border:"1px solid #E2E8F0",borderRadius:11,background:ordineListening?"#FEE2E2":"#FFFFFF",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}><MicIcon active={ordineListening}/></button>
          </div>
          <textarea value={ordineDescrizione} onChange={e=>setOrdineDescrizione(e.target.value)} style={{...inputStyle,minHeight:90,resize:"vertical",marginTop:0}} placeholder="Descrizione prodotto"/>
          <label style={labelStyle}>FORNITORE</label>
          <select value={ordineFornitoreId} onChange={e=>setOrdineFornitoreId(e.target.value)} style={inputStyle}>
            <option value="">Seleziona fornitore</option>
            {fornitori.map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          <button type="button" onClick={()=>void salvaNuovoOrdineHome()} style={primaryButtonStyle}>SALVA</button>
        </Modal>
      )}
      {rubricaFornitoreAperta && (
        <Modal
          title="RUBRICA FORNITORI"
          onClose={() => {
            setRubricaFornitoreAperta(false);
            setFornitoreEditId("");
            setFornitoreEditNome("");
            setFornitoreEditWhatsapp("");
            setNuovoFornitoreMode(false);
          }}
        >
          {fornitori.length === 0 ? (
            <EmptyState text="Nessun fornitore presente." />
          ) : (
            fornitori.map((fornitore) => (
              <button
                key={fornitore.id}
                type="button"
                onClick={() => {
                  setFornitoreEditId(fornitore.id);
                  setFornitoreEditNome(fornitore.nome);
                  setFornitoreEditWhatsapp(fornitore.whatsapp);
                  setNuovoFornitoreMode(false);
                }}
                style={{
                  width: "100%",
                  border: 0,
                  borderRadius: 16,
                  background: fornitoreEditId === fornitore.id ? "#FFF4C2" : "#FFFFFF",
                  padding: "13px 14px",
                  textAlign: "left",
                  cursor: "pointer",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 900, color: "#111827" }}>
                  {fornitore.nome}
                </div>
                <div style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
                  {fornitore.whatsapp || "Nessun WhatsApp"}
                </div>
              </button>
            ))
          )}

          <button
            type="button"
            onClick={() => {
              setFornitoreEditId("");
              setFornitoreEditNome("");
              setFornitoreEditWhatsapp("");
              setNuovoFornitoreMode(true);
            }}
            style={{
              width: 52,
              height: 52,
              margin: "14px auto 4px",
              border: "none",
              borderRadius: 17,
              background: "#D4AF37",
              color: "#111827",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: 30,
              fontWeight: 400,
            }}
            aria-label="Aggiungi fornitore"
          >
            +
          </button>

          {(nuovoFornitoreMode || fornitoreEditId || fornitoreEditNome || fornitoreEditWhatsapp) && (
            <div style={{ marginTop: 8 }}>
              <label style={labelStyle}>NOME FORNITORE</label>
              <input
                value={fornitoreEditNome}
                onChange={(e) => setFornitoreEditNome(e.target.value)}
                placeholder="Nome fornitore"
                style={inputStyle}
              />

              <label style={labelStyle}>WHATSAPP</label>
              <input
                value={fornitoreEditWhatsapp}
                onChange={(e) => setFornitoreEditWhatsapp(e.target.value)}
                placeholder="Numero WhatsApp"
                inputMode="tel"
                style={inputStyle}
              />

              <button
                type="button"
                onClick={() => void salvaFornitoreHome()}
                style={primaryButtonStyle}
              >
                SALVA
              </button>
            </div>
          )}
        </Modal>
      )}

      {ordineAperto && (
        <Modal title="ORDINE" onClose={()=>setOrdineAperto(null)}>
          <div style={{fontWeight:900,color:"#041E49"}}>{ordineAperto.cliente || "Cliente"} · {ordineAperto.veicolo || ""}</div>
          <label style={labelStyle}>PRODOTTO</label>
          <textarea
            value={ordineDescrizione}
            onChange={e=>setOrdineDescrizione(e.target.value)}
            placeholder="Descrivi i prodotti da ordinare..."
            style={{...inputStyle,minHeight:90,fontFamily:"Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",fontSize:16,lineHeight:1.6,fontWeight:500,letterSpacing:"0.1px",resize:"vertical"}}
          />
          <label style={labelStyle}>FORNITORE</label>
          <select value={ordineFornitoreId} onChange={e=>setOrdineFornitoreId(e.target.value)} style={inputStyle}>
            <option value="">Seleziona fornitore</option>
            {fornitori.map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginTop:16}}>
            {ordineAperto.stato !== "INVIATO" ? (
              <button type="button" onClick={()=>void inviaOrdineHome(ordineAperto)} aria-label="Invia ordine su WhatsApp" title="WhatsApp" style={{flex:"0 0 44%",minHeight:50,border:0,borderRadius:13,background:"#25D366",color:"#FFFFFF",fontWeight:900,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center"}}><WhatsAppIcon/></button>
            ) : (
              <div style={{flex:"0 0 44%",fontSize:11,fontWeight:800,color:"#64748B",textAlign:"center"}}>ORDINE INVIATO</div>
            )}
            <button type="button" onClick={()=>void aggiornaOrdineHome()} aria-label="Salva ordine" title="Salva" style={{flex:"0 0 44%",minHeight:50,border:"1px solid #E2E8F0",borderRadius:13,background:"#FFFFFF",color:"#041E49",fontWeight:900,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center"}}><SaveIcon/></button>
          </div>
        </Modal>
      )}
    </>
  );
}
const labelStyle: React.CSSProperties = { display:"block", fontSize:12, fontWeight:800, color:"#64748B", marginTop:12, marginBottom:6 };
const inputStyle: React.CSSProperties = { width:"100%", boxSizing:"border-box", border:"1px solid #E5E7EB", borderRadius:14, padding:"13px 14px", fontSize:15, background:"#FFFFFF", color:"#111827" };
const primaryButtonStyle: React.CSSProperties = { width:"100%", minHeight:50, border:0, borderRadius:16, background:"#D4AF37", color:"#111827", fontWeight:900, marginTop:14, cursor:"pointer" };
const secondaryButtonStyle: React.CSSProperties = { width:"100%", minHeight:44, border:"1px solid #E2E8F0", borderRadius:14, background:"#FFFFFF", color:"#041E49", fontWeight:800, marginTop:8, cursor:"pointer" };
const modalLinkStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#64748B",
  fontSize: 11,
  fontWeight: 900,
  cursor: "pointer",
};

function IconLavori() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="3" width="14" height="18" rx="2" stroke="#111827" strokeWidth="2" />
      <path d="M8 8H16M8 12H13" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <g stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 6L10.5 10.5" />
        <path d="M6 6H3L2 3L3 2L6 3V6Z" />
        <path d="M19.259 2.74101L16.6314 5.36863C16.2354 5.76465 16.0373 5.96265 15.9632 6.19098C15.8979 6.39183 15.8979 6.60817 15.9632 6.80902C16.0373 7.03735 16.2354 7.23535 16.6314 7.63137L16.8686 7.86863C17.2646 8.26465 17.4627 8.46265 17.691 8.53684C17.8918 8.6021 18.1082 8.6021 18.309 8.53684C18.5373 8.46265 18.7354 8.26465 19.1314 7.86863L21.5893 5.41072C21.854 6.05488 22 6.76039 22 7.5C22 10.5376 19.5376 13 16.5 13C16.1338 13 15.7759 12.9642 15.4298 12.8959C14.9436 12.8001 14.7005 12.7521 14.5532 12.7668C14.3965 12.7824 14.3193 12.8059 14.1805 12.8802C14.0499 12.9501 13.919 13.081 13.657 13.343L6.5 20.5C5.67157 21.3284 4.32843 21.3284 3.5 20.5C2.67157 19.6716 2.67157 18.3284 3.5 17.5L10.657 10.343C10.919 10.081 11.0499 9.95005 11.2332 9.44681C11.2479 9.29945 11.1999 9.05638 11.1041 8.57024C11.0358 8.22406 11 7.86621 11 7.5C11 4.46243 13.4624 2 16.5 2C17.5055 2 18.448 2.26982 19.259 2.74101Z" />
        <path d="M12.0001 14.9999L17.5 20.4999C18.3284 21.3283 19.6716 21.3283 20.5 20.4999C21.3284 19.6715 21.3284 18.3283 20.5 17.4999L15.9753 12.9753C15.655 12.945 15.3427 12.8872 15.0408 12.8043C14.6517 12.6975 14.2249 12.7751 13.9397 13.0603L12.0001 14.9999Z" />
      </g>
    </svg>
  );
}

function IconRevisioni() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
      <g stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 6L10.5 10.5" />
        <path d="M6 6H3L2 3L3 2L6 3V6Z" />
        <path d="M19.259 2.74101L16.6314 5.36863C16.2354 5.76465 16.0373 5.96265 15.9632 6.19098C15.8979 6.39183 15.8979 6.60817 15.9632 6.80902C16.0373 7.03735 16.2354 7.23535 16.6314 7.63137L16.8686 7.86863C17.2646 8.26465 17.4627 8.46265 17.691 8.53684C17.8918 8.6021 18.1082 8.6021 18.309 8.53684C18.5373 8.46265 18.7354 8.26465 19.1314 7.86863L21.5893 5.41072C21.854 6.05488 22 6.76039 22 7.5C22 10.5376 19.5376 13 16.5 13C16.1338 13 15.7759 12.9642 15.4298 12.8959C14.9436 12.8001 14.7005 12.7521 14.5532 12.7668C14.3965 12.7824 14.3193 12.8059 14.1805 12.8802C14.0499 12.9501 13.919 13.081 13.657 13.343L6.5 20.5C5.67157 21.3284 4.32843 21.3284 3.5 20.5C2.67157 19.6716 2.67157 18.3284 3.5 17.5L10.657 10.343C10.919 10.081 11.0499 9.95005 11.2332 9.44681C11.2479 9.29945 11.1999 9.05638 11.1041 8.57024C11.0358 8.22406 11 7.86621 11 7.5C11 4.46243 13.4624 2 16.5 2C17.5055 2 18.448 2.26982 19.259 2.74101Z" />
        <path d="M12.0001 14.9999L17.5 20.4999C18.3284 21.3283 19.6716 21.3283 20.5 20.4999C21.3284 19.6715 21.3284 18.3283 20.5 17.4999L15.9753 12.9753C15.655 12.945 15.3427 12.8872 15.0408 12.8043C14.6517 12.6975 14.2249 12.7751 13.9397 13.0603L12.0001 14.9999Z" />
      </g>
    </svg>
  );
}

function IconAgenda() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="#2563EB" strokeWidth="2" />
      <path d="M8 3V7M16 3V7M3 9H13" stroke="#2563EB" strokeWidth="2" />
      <circle cx="17" cy="16" r="4" stroke="#2563EB" strokeWidth="2" />
      <path d="M17 14V16L18.5 17" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="#EA580C" strokeWidth="2" />
      <path d="M12 7V13" stroke="#EA580C" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1.3" fill="#EA580C" />
    </svg>
  );
}

function IconOrdini() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
      <path d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z" stroke="#0F766E" strokeWidth="2" />
      <path d="M8 6L16 10M12 12V21" stroke="#0F766E" strokeWidth="2" />
    </svg>
  );
}

function IconFatture() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
      <path d="M7 3H15L18 6V21H6V3H7Z" stroke="#7C3AED" strokeWidth="2" />
      <path d="M15 3V6H18M9 11H15M9 15H13" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="#7C3AED" strokeWidth="2" />
      <path d="M3 12H21M12 3C14.5 5.5 16 8.5 16 12C16 15.5 14.5 18.5 12 21C9.5 18.5 8 15.5 8 12C8 8.5 9.5 5.5 12 3Z" stroke="#7C3AED" strokeWidth="1.6" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="42" height="42" viewBox="0 0 24 24" fill="none">
      <g stroke="#08142F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 8.5C3 6.6 4.6 5 6.5 5H17.5C19.4 5 21 6.6 21 8.5V18C21 19.1 20.1 20 19 20H5C3.9 20 3 19.1 3 18V8.5Z" />
        <circle cx="12" cy="12.5" r="3.5" />
        <path d="M8 5L9.2 3.5H14.8L16 5" />
      </g>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="46" height="46" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="white" />
      <path d="M8 12.2L10.6 14.8L16.2 9.2" stroke="#08142F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 5V19M5 12H19" stroke="#111827" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function MicIcon({ active = false }: { active?: boolean }) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
      <rect x="8" y="3" width="8" height="12" rx="4" stroke={active ? "#DC2626" : "#111827"} strokeWidth="2" />
      <path d="M5 11A7 7 0 0 0 19 11M12 18V21M9 21H15" stroke={active ? "#DC2626" : "#111827"} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SaveIcon() {
  return <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path fillRule="evenodd" clipRule="evenodd" d="M18.1716 1C18.702 1 19.2107 1.21071 19.5858 1.58579L22.4142 4.41421C22.7893 4.78929 23 5.29799 23 5.82843V20C23 21.6569 21.6569 23 20 23H4C2.34315 23 1 21.6569 1 20V4C1 2.34315 2.34315 1 4 1H18.1716ZM4 3C3.44772 3 3 3.44772 3 4V20C3 20.5523 3.44772 21 4 21L5 21L5 15C5 13.3431 6.34315 12 8 12L16 12C17.6569 12 19 13.3431 19 15V21H20C20.5523 21 21 20.5523 21 20V6.82843C21 6.29799 20.7893 5.78929 20.4142 5.41421L18.5858 3.58579C18.2107 3.21071 17.702 3 17.1716 3H17V5C17 6.65685 15.6569 8 14 8H10C8.34315 8 7 6.65685 7 5V3H4ZM17 21V15C17 14.4477 16.5523 14 16 14L8 14C7.44772 14 7 14.4477 7 15L7 21L17 21ZM9 3H15V5C15 5.55228 14.5523 6 14 6H10C9.44772 6 9 5.55228 9 5V3Z" fill="currentColor"/></svg>;
}
function WhatsAppIcon() {
  return <svg width="29" height="29" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M20.52 3.48A11.82 11.82 0 0 0 12.1 0C5.56 0 .24 5.31.24 11.85c0 2.09.55 4.13 1.6 5.93L.14 24l6.37-1.67a11.9 11.9 0 0 0 5.58 1.42h.01c6.54 0 11.86-5.32 11.86-11.86 0-3.17-1.23-6.15-3.44-8.41ZM12.1 21.73a9.86 9.86 0 0 1-5.03-1.38l-.36-.21-3.78.99 1.01-3.68-.24-.38a9.82 9.82 0 0 1-1.51-5.22c0-5.47 4.45-9.92 9.92-9.92a9.86 9.86 0 0 1 7.02 2.91 9.86 9.86 0 0 1 2.9 7.02c0 5.47-4.45 9.92-9.93 9.92Z" fill="currentColor" transform="translate(0 0) scale(.96)"/>
    <path d="M17.6 14.4c-.3-.15-1.78-.88-2.06-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.96 1.18-.18.2-.35.23-.65.08-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.78-1.67-2.08-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.53-.08-.15-.67-1.61-.91-2.2-.24-.58-.49-.5-.67-.51H7.86c-.2 0-.52.07-.8.37-.28.3-1.05 1.02-1.05 2.49s1.08 2.88 1.23 3.08c.15.2 2.12 3.23 5.12 4.52.72.31 1.28.5 1.71.63.72.23 1.37.2 1.89.12.58-.09 1.78-.73 2.03-1.44.25-.71.25-1.31.17-1.44-.07-.13-.27-.2-.57-.35Z" fill="currentColor"/>
  </svg>;
}
function EmptyState({ text }: { text: string }) {
  return <div style={{ background: "#FFFFFF", borderRadius: 17, padding: "22px 14px", textAlign: "center", color: "#64748B", fontSize: 13, fontWeight: 700 }}>{text}</div>;
}
function OrderRow({ ordine, onClick }: { ordine: Ordine; onClick?:()=>void }) {
  const descrizione = (ordine.descrizione || "").replace(/\s+/g, " ").trim();
  return <div onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } }} style={{ background: ordine.stato === "INVIATO" ? "#FFF4C2" : "#FFFFFF", borderRadius: 17, padding: 13, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", minWidth: 0 }}><div style={{ width: 42, height: 42, borderRadius: 13, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconOrdini /></div><div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2, overflow: "hidden", lineHeight: 1.35 }}><div style={{ fontSize: 13, fontWeight: 900, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ordine.cliente || "Cliente"}</div><div style={{ fontSize: 12, fontWeight: 600, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ordine.veicolo || "Veicolo non indicato"}</div><div style={{ fontSize: 12, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{descrizione || "Nessun dettaglio inserito"}</div></div></div>;
}

/* =====================================================
   STAT CARD
\===================================================== */
function StatCard({ title, value, color, icon, onClick }: {
  title: string; value: string | number; color: string; icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <div style={{ position: "relative" }}>
      <button type="button" onClick={onClick} style={{ width: "100%", height: 140, border: "none", borderRadius: 24, background: "#FFFFFF", padding: 14, paddingTop: 16, textAlign: "left", boxShadow: "0 4px 14px rgba(15,23,42,.08)", display: "flex", flexDirection: "column", justifyContent: "space-between", cursor: "pointer" }}>
        {icon}
        <div>
          <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 4, fontWeight: 700 }}>
            {title}
          </div>
          {value !== "web" ? <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1, color }}>{value}</div> : <GlobeIcon /> }
        </div>
      </button>
    </div>
  );
}
/* =====================================================
   MODAL
\===================================================== */
function Modal({
  title,
  children,
  onClose,
  topRight,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  topRight?: React.ReactNode;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(15,23,42,.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        boxSizing: "border-box",
      }}
    >
      <div
        onClick={(event) =>
          event.stopPropagation()
        }
        style={{
          width: "100%",
          maxWidth: 560,
          maxHeight: "80vh",
          overflowY: "auto",
          background: "#F3F4F6",
          borderRadius: 28,
          padding: "22px 18px 24px",
          boxShadow:
            "0 20px 50px rgba(0,0,0,.25)",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 900,
              color: "#111827",
            }}
          >
            {title}
          </h2>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            {topRight}
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 34,
                height: 34,
                border: "none",
                borderRadius: 11,
                background: "#E5E7EB",
                color: "#111827",
                fontSize: 20,
                fontWeight: 700,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
/* =====================================================
   LAVORO
\===================================================== */
function LavoroRow({
  lavoro,
  onClick,
}: {
  lavoro: Lavoro;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        border: "none",
        background: "#FFFFFF",
        borderRadius: 17,
        padding: 13,
        display: "flex",
        alignItems: "center",
        gap: 12,
        textAlign: "left",
        boxShadow:
          "0 3px 10px rgba(0,0,0,.06)",
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 13,
          background: "#F3F4F6",
          display: "flex",
          alignItems: "center",
          justifyContent:
            "center",
          flexShrink: 0,
        }}
      >
        <WrenchIcon />
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: "#64748B",
            fontWeight: 700,
          }}
        >
          {lavoro.status === "DA_DOCUMENTARE" ? "LAVORO TERMINATO" : "LAVORO ATTIVO"}
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 900,
            color: "#111827",
            marginTop: 2,
          }}
        >
          {lavoro.nomeCliente ||
            "Cliente"}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "#64748B",
            marginTop: 2,
          }}
        >
          {lavoro.veicolo ||
            "Veicolo"}{" "}
          ·{" "}
          {lavoro.targa ||
            "—"}
        </div>
      </div>
      <div className="lavoro-row-status" style={{
        background: lavoro.status === "DA_DOCUMENTARE" ? "#FEF3C7" : "#FFF1C2",
        color: "#92400E",
        borderRadius: 999,
        padding: "6px 9px",
        fontSize: 10,
        fontWeight: 900,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}>
        <span className="lavoro-row-status-text">{lavoro.status === "DA_DOCUMENTARE" ? "DA DOCUMENTARE" : "IN LAVORAZIONE"}</span>
        <span className="lavoro-row-status-dot" aria-label={lavoro.status === "DA_DOCUMENTARE" ? "Da documentare" : "In lavorazione"} />
      </div>
      <style jsx>{`
        .lavoro-row-status-dot { display: none; }
        @media (max-width: 640px) {
          .lavoro-row-status {
            width: 12px;
            height: 12px;
            min-width: 12px;
            padding: 0 !important;
            border-radius: 50% !important;
            align-self: center;
            margin-left: 2px;
          }
          .lavoro-row-status-text { display: none; }
          .lavoro-row-status-dot { display: block; width: 100%; height: 100%; }
        }
      `}</style>
    </button>
  );
}
/* =====================================================
   REVISIONE
\===================================================== */
function RevisionRow({
  revisione,
  onWhatsApp,
}: {
  revisione: Revisione;
  onWhatsApp: () => void;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 17,
        padding: 13,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 900,
            color: "#111827",
          }}
        >
          {revisione.nomeCliente ||
            revisione.cliente ||
            "Cliente"}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "#64748B",
            marginTop: 3,
          }}
        >
          {revisione.veicolo ||
            "Veicolo"}{" "}
          ·{" "}
          {revisione.targa ||
            "—"}
        </div>
      </div>
      <button
        type="button"
        onClick={onWhatsApp}
        style={{
          border: "none",
          borderRadius: 12,
          background: "#16A34A",
          color: "#FFFFFF",
          padding: "9px 12px",
          fontSize: 10,
          fontWeight: 900,
          whiteSpace: "nowrap",
          cursor: "pointer",
        }}
      >
        RICORDA
      </button>
    </div>
  );
}
/* =====================================================
   APPUNTAMENTO
\===================================================== */
function AppointmentRow({
  appuntamento,
}: {
  appuntamento: Appuntamento;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 17,
        padding: 13,
        display: "flex",
        gap: 12,
      }}
    >
      <div
        style={{
          minWidth: 48,
          fontSize: 14,
          fontWeight: 900,
          color: "#2563EB",
        }}
      >
        {appuntamento.time ||
          appuntamento.ora ||
          "--:--"}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: "#111827",
        }}
      >
        {appuntamento.title ||
          appuntamento.descrizione ||
          appuntamento.description ||
          "Appuntamento"}
      </div>
    </div>
  );
}
/* =====================================================
   SOLLECITO
\===================================================== */
function SollecitoRow({
  sollecito,
  onPayAll,
  onDetails,
  onWhatsApp,
}: {
  sollecito: Sollecito;
  onPayAll: () => void;
  onDetails: () => void;
  onWhatsApp: () => void;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 17,
        padding: 13,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <button
        type="button"
        onClick={onPayAll}
        aria-label="Segna tutti i pagamenti come pagati"
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: "2px solid #CBD5E1",
          background: "#FFFFFF",
          flexShrink: 0,
          cursor: "pointer",
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: "#111827" }}>
          {sollecito.nomeCliente || "Cliente"}
        </div>
        <div style={{ fontSize: 16, fontWeight: 900, color: "#EA580C", marginTop: 3 }}>
          {formatEuro(parseImporto(sollecito.importo))}
        </div>
      </div>
      <button
        type="button"
        onClick={onWhatsApp}
        style={{
          border: "none",
          borderRadius: 12,
          background: "#EA580C",
          color: "#FFFFFF",
          padding: "9px 10px",
          fontSize: 10,
          fontWeight: 900,
          whiteSpace: "nowrap",
        }}
      >
        SOLLECITA
      </button>
      <button
        type="button"
        onClick={onDetails}
        aria-label="Mostra dettaglio pagamenti"
        style={{
          border: 0,
          background: "transparent",
          color: "#94A3B8",
          fontSize: 24,
          lineHeight: 1,
          padding: "0 2px",
          cursor: "pointer",
        }}
      >
        ›
      </button>
    </div>
  );
}
;