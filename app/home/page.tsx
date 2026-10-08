"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BottomBar from "@/components/BottomBar";
import { supabase } from "@/lib/supabase";
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
  status?: "IN_LAVORAZIONE" | "CONCLUSO";
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
};
type ClienteRicerca = {
  clientKey: string;
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
};
type VeicoloSalvato = {
  id?: string;
  cliente1?: { nome?: string; indirizzo?: string; telefono?: string; cf?: string; nascita?: string };
  cliente2?: { nome?: string; indirizzo?: string; telefono?: string; cf?: string; nascita?: string } | null;
  veicolo?: { veicolo?: string; motore?: string; targa?: string; immatricolazione?: string; revisione?: string };
};
const TEST_VEHICLE: VeicoloSalvato = {
  id: "test-gt015bf",
  cliente1: {
    nome: "Mario Rossi",
    indirizzo: "Via Roma 12, Fondo (TN)",
    telefono: "3471234567",
    cf: "RSSMRA80C14L378Z",
    nascita: "1980-03-14",
  },
  cliente2: null,
  veicolo: {
    veicolo: "Volkswagen Golf",
    motore: "1968",
    targa: "GT015BF",
    immatricolazione: "2020-05-12",
    revisione: "2026-05-12",
  },
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
  const [nuovoClienteNome, setNuovoClienteNome] = useState("");
  const [nuovoClienteTelefono, setNuovoClienteTelefono] = useState("");
  const [nuovoPagamentoDescrizione, setNuovoPagamentoDescrizione] = useState("");
  const [nuovoPagamentoImporto, setNuovoPagamentoImporto] = useState("");
  const [pagamentoInCorso, setPagamentoInCorso] = useState<{
    clientKey: string;
    paymentId: string;
    descrizione: string;
    residuo: number;
    manuale: boolean;
  } | null>(null);
  const [importoPagamento, setImportoPagamento] = useState("");
  const [ordini, setOrdini] = useState<Ordine[]>([]);
  const [modal, setModal] = useState<ModalType>(null);
  const [listening, setListening] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [checkInError, setCheckInError] = useState("");
  const checkInVideoRef = useRef<HTMLVideoElement>(null);
  const checkInStreamRef = useRef<MediaStream | null>(null);
  const ensureTestVehicle = () => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("goldencar_vehicles");
      const vehicles: VeicoloSalvato[] = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(vehicles)) return;
      const exists = vehicles.some(
        (vehicle) => normalizePlate(vehicle?.veicolo?.targa || "") === "GT015BF"
      );
      if (!exists) {
        localStorage.setItem(
          "goldencar_vehicles",
          JSON.stringify([...vehicles, TEST_VEHICLE])
        );
      }
    } catch {
      localStorage.setItem("goldencar_vehicles", JSON.stringify([TEST_VEHICLE]));
    }
  };
  useEffect(() => {
    ensureTestVehicle();
    caricaDati();
    const refresh = () => caricaDati();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
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
      const { data: vehicle, error: vehicleError } = await supabase
        .from("vehicles")
        .select("id, veicolo, motore, targa, immatricolazione, revisione")
        .ilike("targa", normalized)
        .maybeSingle();

      if (vehicleError) throw new Error(vehicleError.message);

      stopCheckInCamera();

      if (vehicle) {
        const { data: relations } = await supabase
          .from("vehicle_clients")
          .select("client_id, ruolo")
          .eq("vehicle_id", vehicle.id)
          .order("ruolo", { ascending: true });

        const primaryRelation =
          (relations ?? []).find((item: any) => item.ruolo === "PRINCIPALE") ??
          (relations ?? [])[0];

        let cliente: any = null;
        if (primaryRelation?.client_id) {
          const { data: client } = await supabase
            .from("clients")
            .select("nome, indirizzo, telefono, codice_fiscale, data_nascita")
            .eq("id", primaryRelation.client_id)
            .maybeSingle();
          cliente = client;
        }

        sessionStorage.setItem(
          "goldencar_nuova_scheda",
          JSON.stringify({
            vehicleId: String(vehicle.id),
            nomeCliente: String(cliente?.nome ?? "").trim(),
            indirizzo: cliente?.indirizzo || "",
            telefono: cliente?.telefono || "",
            codiceFiscale: cliente?.codice_fiscale || "",
            veicolo: vehicle.veicolo || "",
            targa: normalized,
          })
        );
        router.push("/veicolo/scheda");
        return;
      }

      sessionStorage.setItem("goldencar_checkin_targa", normalized);
      router.push("/veicolo/profilo");
    } catch (error) {
      console.error("CHECK-IN ricerca veicolo Supabase error:", error);
      stopCheckInCamera();
      setCheckInError(
        error instanceof Error
          ? `Errore durante la ricerca del veicolo: ${error.message}`
          : "Errore durante la ricerca del veicolo."
      );
    }
  };

  const caricaDati = async () => {
    if (typeof window === "undefined") return;
    /* =========================
       LAVORI
       Anche la Home usa Supabase per le schede lavoro.
    ========================= */
    const { data: jobRows, error: jobsError } = await supabase
      .from("jobs")
      .select("id, vehicle_id, titolo, tipo, chilometri, manodopera, note, fattura, stato, created_at, closed_at, payment_amount, payment_paid_amount, payment_status, dettagli")
      .order("created_at", { ascending: false });

    let lavoriPerSolleciti: Lavoro[] = lavori;

    if (jobsError) {
      console.error("Errore caricamento lavori Home:", jobsError);
      setLavori([]);
      lavoriPerSolleciti = [];
    } else {
      const vehicleIds = (jobRows ?? [])
        .map((row: any) => row.vehicle_id)
        .filter(Boolean)
        .map(String);

      const [{ data: vehicleRows }, { data: relationRows }, { data: clientRows }] =
        await Promise.all([
          vehicleIds.length
            ? supabase.from("vehicles").select("id, veicolo, targa").in("id", vehicleIds)
            : Promise.resolve({ data: [] as any[] }),
          vehicleIds.length
            ? supabase.from("vehicle_clients").select("vehicle_id, client_id, ruolo").in("vehicle_id", vehicleIds)
            : Promise.resolve({ data: [] as any[] }),
          supabase.from("clients").select("id, nome, telefono"),
        ]);

      const vehiclesById = new Map(
        (vehicleRows ?? []).map((row: any) => [String(row.id), row])
      );
      const clientsById = new Map(
        (clientRows ?? []).map((row: any) => [String(row.id), row])
      );
      setClientiAnagrafica(
        (clientRows ?? [])
          .map((row: any) => {
            const nomeCliente = String(row?.nome ?? "").trim();
            if (!nomeCliente) return null;
            return {
              clientKey: makeClientKey(nomeCliente, row?.telefono),
              nomeCliente,
              telefono: String(row?.telefono ?? "").trim(),
            };
          })
          .filter(Boolean) as ClienteRicerca[]
      );

      const primaryClientByVehicle = new Map<string, any>();

      for (const relation of relationRows ?? []) {
        const vehicleId = String(relation.vehicle_id);
        if (
          relation.ruolo === "PRINCIPALE" ||
          !primaryClientByVehicle.has(vehicleId)
        ) {
          primaryClientByVehicle.set(vehicleId, clientsById.get(String(relation.client_id)));
        }
      }

      const lavoriCaricati: Lavoro[] = (jobRows ?? []).map((row: any) => {
        const vehicle = vehiclesById.get(String(row.vehicle_id));
        const client = primaryClientByVehicle.get(String(row.vehicle_id));
        const nomeCliente = String(client?.nome ?? "").trim();

        const dettagli = row.dettagli && typeof row.dettagli === "object"
          ? row.dettagli
          : {};

        const jobNumberRaw = String(row.id ?? "");
        const jobNumber = jobNumberRaw;

        return {
          jobNumber,
          createdAt: String(row.created_at ?? ""),
          nomeCliente: nomeCliente || "Cliente",
          veicolo: String(vehicle?.veicolo ?? ""),
          targa: String(vehicle?.targa ?? ""),
          telefono: String(client?.telefono ?? ""),
          paymentAmount: row.payment_amount != null ? String(row.payment_amount) : "",
          paymentPaidAmount: row.payment_paid_amount != null ? String(row.payment_paid_amount) : "0",
          paymentStatus:
            row.payment_status === "PAGATO"
              ? "PAGATO"
              : row.payment_status === "PARZIALE"
                ? "PARZIALE"
                : "DA_PAGARE",
          types: Array.isArray(dettagli.types)
            ? dettagli.types
            : row.tipo
              ? [String(row.tipo)]
              : [],
          works: Array.isArray(dettagli.works)
            ? dettagli.works
            : String(row.lavori ?? ""),
          status:
            String(row.stato ?? "").toUpperCase() === "CONCLUSO"
              ? "CONCLUSO"
              : "IN_LAVORAZIONE",
          pdfUrl: String(dettagli.pdfUrl ?? ""),
        };
      });

      setLavori(lavoriCaricati);
      lavoriPerSolleciti = lavoriCaricati;
    }
    /* =       PAGAMENTI / SOLLECITI
    ========================= */
    const { data: paymentRows, error: paymentsError } = await supabase
      .from("payments")
      .select("id, client_id, vehicle_id, description, amount, paid_amount, status, created_at")
      .in("status", ["DA_PAGARE", "PARZIALE"])
      .order("created_at", { ascending: false });

    if (paymentsError) {
      console.error("Errore caricamento pagamenti Home:", paymentsError);
      setPagamentiManuali([]);
      setSolleciti(aggregaSolleciti(lavoriPerSolleciti, []));
    } else {
      const clientIds = Array.from(new Set((paymentRows ?? []).map((row: any) => row.client_id).filter(Boolean).map(String)));
      const vehicleIds = Array.from(new Set((paymentRows ?? []).map((row: any) => row.vehicle_id).filter(Boolean).map(String)));
      const [{ data: paymentClients }, { data: paymentVehicles }] = await Promise.all([
        clientIds.length ? supabase.from("clients").select("id, nome, telefono").in("id", clientIds) : Promise.resolve({data: [] as any[]}),
        vehicleIds.length ? supabase.from("vehicles").select("id, targa").in("id", vehicleIds) : Promise.resolve({data: [] as any[]}),
      ]);
      const clientsById = new Map((paymentClients ?? []).map((row:any)=>[String(row.id),row]));
      const vehiclesById = new Map((paymentVehicles ?? []).map((row:any)=>[String(row.id),row]));
      const manuali: PagamentoManuale[] = (paymentRows ?? []).map((row:any)=>{
        const client=clientsById.get(String(row.client_id));
        const vehicle=vehiclesById.get(String(row.vehicle_id));
        const nomeCliente=String(client?.nome ?? "").trim() || "Cliente";
        const stato = row.status === "PAGATO" ? "PAGATO" : row.status === "PARZIALE" ? "PARZIALE" : "DA_PAGARE";
        return {id:String(row.id),clientKey:makeClientKey(nomeCliente,client?.telefono),nomeCliente,telefono:String(client?.telefono??""),targa:String(vehicle?.targa??""),descrizione:String(row.description??""),importo:String(row.amount??""),paidAmount:String(row.paid_amount??"0"),stato,createdAt:String(row.created_at??"")};
      });
      setPagamentiManuali(manuali);
      setSolleciti(aggregaSolleciti(lavoriPerSolleciti, manuali));
    }

    /* =========================
       AGENDA
       La Home usa la stessa sorgente Supabase della pagina Agenda.
    ========================= */
    const { data: appointmentRows, error: appointmentsError } = await supabase
      .from("appointments")
      .select("id, vehicle_id, titolo, descrizione, data_ora")
      .order("data_ora", { ascending: true });

    if (appointmentsError) {
      console.error("Errore caricamento appuntamenti Home:", appointmentsError);
      setAppuntamenti([]);
    } else {
      setAppuntamenti(
        (appointmentRows ?? []).map((row: any) => {
          const dateTime = new Date(String(row.data_ora ?? ""));
          return {
            id: String(row.id ?? ""),
            date: Number.isNaN(dateTime.getTime()) ? "" : dateTime.toISOString().slice(0, 10),
            time: Number.isNaN(dateTime.getTime())
              ? ""
              : dateTime.toLocaleTimeString("it-IT", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                }),
            description: String(row.descrizione ?? row.titolo ?? ""),
          };
        })
      );
    }

    /* =========================
       REVISIONI
       La Home usa la stessa sorgente Supabase della pagina Revisioni.
    ========================= */
    const { data: revisionRows, error: revisionsError } = await supabase
      .from("vehicles")
      .select("id, veicolo, targa, revisione")
      .not("revisione", "is", null);

    if (revisionsError) {
      console.error("Errore caricamento revisioni Home:", revisionsError);
      setRevisioni([]);
    } else {
      const revisionVehicleIds = (revisionRows ?? []).map((row: any) => String(row.id));
      const [{ data: revisionRelations }, { data: revisionClients }] = await Promise.all([
        revisionVehicleIds.length
          ? supabase.from("vehicle_clients").select("vehicle_id, client_id, ruolo").in("vehicle_id", revisionVehicleIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("clients").select("id, nome, telefono"),
      ]);

      const revisionClientsById = new Map(
        (revisionClients ?? []).map((row: any) => [String(row.id), row])
      );
      const revisionPrimaryByVehicle = new Map<string, any>();

      for (const relation of revisionRelations ?? []) {
        const vehicleId = String(relation.vehicle_id);
        if (relation.ruolo === "PRINCIPALE" || !revisionPrimaryByVehicle.has(vehicleId)) {
          revisionPrimaryByVehicle.set(
            vehicleId,
            revisionClientsById.get(String(relation.client_id))
          );
        }
      }

      setRevisioni(
        (revisionRows ?? []).map((row: any) => {
          const client = revisionPrimaryByVehicle.get(String(row.id));
          const nomeCliente = [client?.nome, client?.cognome].filter(Boolean).join(" ").trim();

          return {
            id: `revisione-${row.id}`,
            nomeCliente,
            cliente: nomeCliente,
            telefono: String(client?.telefono ?? ""),
            veicolo: String(row.veicolo ?? ""),
            targa: String(row.targa ?? ""),
            revisione: String(row.revisione ?? ""),
            scadenza: String(row.revisione ?? ""),
          };
        })
      );
    }

/* =========================
       ORDINI
       Gli ordini sono gestiti da Supabase, quindi la Home
       deve leggere la stessa sorgente usata dalla pagina ORDINI.
    ========================= */
    const { data: orderRows, error: ordersError } = await supabase
      .from("orders")
      .select("id, numero, cliente, veicolo, prodotti")
      .order("created_at", { ascending: false });

    if (ordersError) {
      console.error("Errore caricamento ordini Home:", ordersError);
      setOrdini([]);
    } else {
      setOrdini(
        (orderRows ?? []).map((row: any) => {
          const prodotti = Array.isArray(row.prodotti) ? row.prodotti : [];
          const descrizione = prodotti
            .map((product: any) => {
              const nome = String(product?.name ?? "").trim();
              if (!nome) return "";
              const quantita = String(product?.quantity ?? "1").trim() || "1";
              const dettagli = String(product?.details ?? "").trim();
              return `${quantita} × ${nome}${dettagli ? ` — ${dettagli}` : ""}`;
            })
            .filter(Boolean)
            .join(" · ");

          return {
            id: String(row.id ?? ""),
            numero: String(row.numero ?? ""),
            cliente: String(row.cliente ?? ""),
            veicolo: String(row.veicolo ?? ""),
            descrizione,
            stato: "DA EVADERE",
          };
        })
      );
    }
  };
  const lavoriAttivi = useMemo(
    () =>
      lavori.filter(
        (lavoro) =>
          lavoro.status === "IN_LAVORAZIONE"
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
      const data = new Date(raw);
      if (Number.isNaN(data.getTime())) {
        return false;
      }
      data.setHours(0, 0, 0, 0);
      return data < oggi;
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
    const messaggio = encodeURIComponent(
      `Ciao ${nome}, ti ricordiamo che la revisione del veicolo ${revisione.veicolo || ""} targato ${revisione.targa || ""} è scaduta. Contattaci per fissare un appuntamento.`
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
  const aggiornaStatiPagamento = async (
    clientKey: string,
    paymentId?: string,
    pagaTutto = false,
    importoDaPagare?: number
  ) => {
    const targetJobs = lavori.filter((l) => {
      const key = makeClientKey(l.nomeCliente || "Cliente", l.telefono);
      return key === clientKey && l.paymentStatus !== "PAGATO" &&
        (pagaTutto || String(l.jobNumber) === String(paymentId));
    });
    const targetManuali = pagamentiManuali.filter((p) =>
      p.clientKey === clientKey && p.stato !== "PAGATO" &&
      (pagaTutto || p.id === paymentId)
    );

    try {
      if (pagaTutto) {
        for (const lavoro of targetJobs) {
          const { error } = await supabase.from("jobs").update({
            payment_status: "PAGATO",
            payment_paid_amount: parseImporto(lavoro.paymentAmount),
          }).eq("id", String(lavoro.jobNumber));
          if (error) throw error;
        }
        for (const pagamento of targetManuali) {
          const { error } = await supabase.from("payments").update({
            status: "PAGATO",
            paid_amount: parseImporto(pagamento.importo),
            paid_at: new Date().toISOString(),
          }).eq("id", pagamento.id);
          if (error) throw error;
        }
      } else {
        const amount = Math.max(0, Number(importoDaPagare || 0));
        if (amount <= 0) throw new Error("Inserisci un importo valido.");

        if (targetJobs.length) {
          const lavoro = targetJobs[0];
          const totale = parseImporto(lavoro.paymentAmount);
          const giaPagato = parseImporto(lavoro.paymentPaidAmount);
          const residuo = Math.max(0, totale - giaPagato);
          if (amount > residuo + 0.001) throw new Error("L'importo supera il residuo da pagare.");
          const nuovoPagato = Math.min(totale, giaPagato + amount);
          const { error } = await supabase.from("jobs").update({
            payment_paid_amount: nuovoPagato,
            payment_status: nuovoPagato >= totale - 0.001 ? "PAGATO" : "PARZIALE",
          }).eq("id", String(lavoro.jobNumber));
          if (error) throw error;
        } else if (targetManuali.length) {
          const pagamento = targetManuali[0];
          const totale = parseImporto(pagamento.importo);
          const giaPagato = parseImporto(pagamento.paidAmount);
          const residuo = Math.max(0, totale - giaPagato);
          if (amount > residuo + 0.001) throw new Error("L'importo supera il residuo da pagare.");
          const nuovoPagato = Math.min(totale, giaPagato + amount);
          const { error } = await supabase.from("payments").update({
            paid_amount: nuovoPagato,
            status: nuovoPagato >= totale - 0.001 ? "PAGATO" : "PARZIALE",
            paid_at: nuovoPagato >= totale - 0.001 ? new Date().toISOString() : null,
          }).eq("id", pagamento.id);
          if (error) throw error;
        }
      }

      await caricaDati();
      setPagamentoInCorso(null);
      setImportoPagamento("");
      setDettaglioSollecito(null);
    } catch (error) {
      console.error("Errore aggiornamento pagamento:", error);
      alert(error instanceof Error ? error.message : "Errore durante l'aggiornamento del pagamento.");
    }
  };
  const pagaTuttoCliente = (sollecito: Sollecito) => {
    aggiornaStatiPagamento(
      sollecito.clientKey || makeClientKey(sollecito.nomeCliente || "", sollecito.telefono),
      undefined,
      true
    );
  };

  const apriPagamentoParziale = (pagamento: PagamentoDettaglio) => {
    setImportoPagamento("");
    setPagamentoInCorso({
      clientKey: pagamento.clientKey,
      paymentId: pagamento.id,
      descrizione: pagamento.descrizione,
      residuo: pagamento.importo,
      manuale: Boolean(pagamento.manuale),
    });
  };

  const confermaPagamentoParziale = () => {
    if (!pagamentoInCorso) return;
    const amount = parseImporto(importoPagamento);
    if (amount <= 0) {
      alert("Inserisci un importo valido.");
      return;
    }
    if (amount > pagamentoInCorso.residuo + 0.001) {
      alert("L'importo supera il residuo da pagare.");
      return;
    }
    void aggiornaStatiPagamento(
      pagamentoInCorso.clientKey,
      pagamentoInCorso.paymentId,
      false,
      amount
    );
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
      [cliente.nomeCliente, cliente.telefono, cliente.targa || ""].some(value => value.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [clienteQuery, clientiDisponibili]);
  const apriNuovoPagamento = () => {
    setClienteQuery("");
    setClienteSelezionatoPagamento(null);
    setNuovoClienteNome("");
    setNuovoClienteTelefono("");
    setNuovoPagamentoDescrizione("");
    setNuovoPagamentoImporto("");
    setNuovoPagamentoAperto(true);
  };
  const salvaNuovoPagamento = async () => {
    const nome=(clienteSelezionatoPagamento?.nomeCliente||nuovoClienteNome).trim();
    const telefono=(clienteSelezionatoPagamento?.telefono||nuovoClienteTelefono).trim();
    const importo=parseImporto(nuovoPagamentoImporto);
    const descrizione=nuovoPagamentoDescrizione.trim();
    if(!nome){alert("Inserisci o seleziona un cliente.");return;}
    if(importo<=0){alert("Inserisci un importo valido.");return;}
    if(!descrizione){alert("Inserisci la descrizione del piccolo lavoro.");return;}
    try {
      const parts=nome.split(/\s+/).filter(Boolean);
      const nomeParte=parts.shift()||nome;
      const cognome=parts.join(" ");
      const normalizedPhone=telefono.replace(/\D/g,"");
      const {data: clients,error: lookupError}=await supabase.from("clients").select("id,nome,telefono").ilike("nome",nomeParte).limit(50);
      if(lookupError) throw lookupError;
      const existing=(clients??[]).find((client:any)=>{
        const full=String(client.nome ?? "").trim().toLowerCase();
        return full===nome.toLowerCase() || (normalizedPhone && String(client.telefono??"").replace(/\D/g,"")===normalizedPhone);
      });
      let clientId=existing?.id ? String(existing.id) : "";
      if(!clientId){
        const {data:created,error}=await supabase.from("clients").insert({nome:nome,telefono:telefono||null}).select("id").single();
        if(error) throw error;
        clientId=String(created.id);
      }
      const {error:paymentError}=await supabase.from("payments").insert({id:crypto.randomUUID(),client_id:clientId,description:descrizione,amount:importo,paid_amount:0,status:"DA_PAGARE"});
      if(paymentError) throw paymentError;
      setNuovoPagamentoAperto(false); setClienteSelezionatoPagamento(null); setClienteQuery("");
      setNuovoClienteNome(""); setNuovoClienteTelefono(""); setNuovoPagamentoDescrizione(""); setNuovoPagamentoImporto("");
      await caricaDati();
    } catch(error) {
      console.error("Errore salvataggio nuovo pagamento:",error);
      alert(error instanceof Error ? error.message : "Errore durante il salvataggio del pagamento.");
    }
  };

  const aggiungiAppuntamentoVocale =
    () => {
      const Recognition = (
        window as Window & {
          SpeechRecognition?: any;
          webkitSpeechRecognition?: any;
        }
      ).SpeechRecognition ||
      (
        window as Window & {
          SpeechRecognition?: any;
          webkitSpeechRecognition?: any;
        }
      ).webkitSpeechRecognition;
      if (!Recognition) {
        alert(
          "La dettatura vocale non è disponibile in questo browser."
        );
        return;
      }
      if (listening) return;
      const recognition =
        new Recognition();
      recognition.lang = "it-IT";
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.onresult = (
        event: any
      ) => {
        const testo =
          event.results?.[0]?.[0]
            ?.transcript || "";
        if (!testo.trim()) return;
        sessionStorage.setItem("goldencar_agenda_descrizione", testo.trim());
        router.push("/agenda");
      };
      recognition.onerror = () => {
        setListening(false);
      };
      recognition.onend = () => {
        setListening(false);
      };
      setListening(true);
      recognition.start();
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
            value={lavoriAttivi.length}
            color="#111827"
            icon={<IconLavori />}
            onClick={() =>
              setModal("lavori")
            }
          />
          <StatCard
            title="REVISIONI"
            value={revisioniScadute.length}
            color="#D4AF37"
            icon={<IconRevisioni />}
            onClick={() =>
              setModal("revisioni")
            }
          />
          <StatCard
            title="AGENDA"
            value={appuntamentiOggi.length}
            color="#2563EB"
            icon={<IconAgenda />}
            onClick={() =>
              setModal("agenda")
            }
          />
          <StatCard
            title="SOLLECITI"
            value={solleciti.length}
            color="#EA580C"
            icon={<IconAlert />}
            onClick={() =>
              setModal("solleciti")
            }
          />
          <StatCard
            title="ORDINI"
            value={ordini.length}
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
                "https://www.google.com/",
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
      {/* =========================
          MODAL LAVORI
      ========================= */}
      {modal === "lavori" && (
        <Modal
          title="LAVORI ATTIVI"
          onClose={() =>
            setModal(null)
          }
          topRight={
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/lavori"
                )
              }
              style={modalLinkStyle}
            >
              LISTA LAVORI
            </button>
          }
        >
          {lavoriAttivi.length === 0 ? (
            <EmptyState text="Nessun lavoro in lavorazione." />
          ) : (
            lavoriAttivi.map(
              (lavoro) => (
                <LavoroRow
                  key={lavoro.jobNumber}
                  lavoro={lavoro}
                  onClick={() =>
                    apriLavoro(lavoro)
                  }
                />
              )
            )
          )}
        </Modal>
      )}
      {/* =========================
          MODAL REVISIONI
      ========================= */}
      {modal === "revisioni" && (
        <Modal
          title="REVISIONI SCADUTE"
          onClose={() =>
            setModal(null)
          }
          topRight={
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/revisioni"
                )
              }
              style={modalLinkStyle}
            >
              REVISIONI
            </button>
          }
        >
          {revisioniScadute.length ===
          0 ? (
            <EmptyState text="Nessuna revisione scaduta." />
          ) : (
            revisioniScadute.map(
              (revisione, index) => (
                <RevisionRow
                  key={
                    revisione.id ||
                    index
                  }
                  revisione={revisione}
                  onWhatsApp={() =>
                    avvisaRevisione(
                      revisione
                    )
                  }
                />
              )
            )
          )}
        </Modal>
      )}
      {/* =========================
          MODAL AGENDA
      ========================= */}
      {modal === "agenda" && (
        <Modal
          title="APPUNTAMENTI DI OGGI"
          onClose={() =>
            setModal(null)
          }
          topRight={
            <button
              type="button"
              onClick={() =>
                router.push("/agenda")
              }
              style={modalLinkStyle}
            >
              AGENDA
            </button>
          }
        >
          {appuntamentiOggi.length ===
          0 ? (
            <EmptyState text="Nessun appuntamento oggi." />
          ) : (
            appuntamentiOggi.map(
              (
                appuntamento,
                index
              ) => (
                <AppointmentRow
                  key={
                    appuntamento.id ||
                    index
                  }
                  appuntamento={
                    appuntamento
                  }
                />
              )
            )
          )}
          <button
            type="button"
            onClick={
              aggiungiAppuntamentoVocale
            }
            style={{
              width: 52,
              height: 52,
              margin:
                "14px auto 0",
              border: "none",
              borderRadius: 17,
              background:
                listening
                  ? "#FEE2E2"
                  : "#D4AF37",
              color: "#111827",
              display: "flex",
              alignItems: "center",
              justifyContent:
                "center",
              cursor: "pointer",
            }}
            aria-label="Aggiungi appuntamento vocalmente"
          >
            {listening ? (
              <MicIcon active />
            ) : (
              <PlusIcon />
            )}
          </button>
        </Modal>
      )}
      {/* =========================
          MODAL SOLLECITI
      ========================= */}
      {modal === "solleciti" && (
        <Modal
          title="SOLLECITI"
          onClose={() => setModal(null)}
        >
          {solleciti.length === 0 ? (
            <EmptyState text="Nessun sollecito in corso." />
          ) : (
            solleciti.map((sollecito) => (
              <SollecitoRow
                key={sollecito.clientKey || sollecito.nomeCliente}
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
            style={{
              width: 52,
              height: 52,
              margin: "6px auto 0",
              border: "none",
              borderRadius: 17,
              background: "#D4AF37",
              color: "#111827",
              fontSize: 28,
              fontWeight: 500,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(0,0,0,.10)",
            }}
          >
            +
          </button>
        </Modal>
      )}
      {dettaglioSollecito && (
        <Modal
          title={dettaglioSollecito.nomeCliente || "PAGAMENTI"}
          onClose={() => setDettaglioSollecito(null)}
        >
          {pagamentiCliente(dettaglioSollecito).map((pagamento) => (
            <div
              key={pagamento.id}
              onClick={() => {
                if (pagamento.manuale || pagamento.jobNumber == null) return;
                const lavoro = lavori.find(
                  (item) => item.jobNumber === pagamento.jobNumber
                );
                if (!lavoro) return;
                setDettaglioSollecito(null);
                apriLavoro(lavoro);
              }}
              style={{
                background: "#FFFFFF",
                borderRadius: 17,
                padding: 13,
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor:
                  pagamento.manuale || pagamento.jobNumber == null
                    ? "default"
                    : "pointer",
              }}
            >
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  apriPagamentoParziale(pagamento);
                }}
                aria-label="Registra un pagamento"
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
                <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>
                  {pagamento.descrizione}
                </div>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>
                  {pagamento.manuale ? "Piccolo lavoro" : `Scheda #${pagamento.jobNumber}`}
                </div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 900, color: "#111827", whiteSpace: "nowrap" }}>
                {formatEuro(pagamento.importo)}
              </div>
            </div>
          ))}
          <div
            style={{
              marginTop: 4,
              padding: "12px 4px 2px",
              borderTop: "1px solid #E2E8F0",
              display: "flex",
              justifyContent: "space-between",
              fontSize: 16,
              fontWeight: 900,
            }}
          >
            <span>TOTALE DA PAGARE</span>
            <span>{formatEuro(pagamentiCliente(dettaglioSollecito).reduce((sum, item) => sum + item.importo, 0))}</span>
          </div>
        </Modal>
      )}
      {pagamentoInCorso && (
        <Modal
          title="REGISTRA PAGAMENTO"
          onClose={() => {
            setPagamentoInCorso(null);
            setImportoPagamento("");
          }}
        >
          <div style={{ background: "#FFFFFF", borderRadius: 16, padding: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>
              {pagamentoInCorso.descrizione}
            </div>
            <div style={{ fontSize: 12, color: "#64748B", marginTop: 5 }}>
              Residuo da pagare: {formatEuro(pagamentoInCorso.residuo)}
            </div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#64748B", marginTop: 4, marginBottom: 6 }}>
            IMPORTO PAGATO
          </div>
          <input
            value={importoPagamento}
            onChange={(e) => setImportoPagamento(e.target.value)}
            inputMode="decimal"
            autoFocus
            placeholder={formatEuro(pagamentoInCorso.residuo)}
            style={{ width: "100%", boxSizing: "border-box", border: "1px solid #E5E7EB", borderRadius: 14, padding: "13px 14px", fontSize: 17, background: "#FFFFFF" }}
          />
          <button
            type="button"
            onClick={confermaPagamentoParziale}
            style={{ width: "100%", height: 50, border: 0, borderRadius: 16, background: "#D4AF37", color: "#111827", fontWeight: 900, marginTop: 12 }}
          >
            CONFERMA
          </button>
        </Modal>
      )}
      {nuovoPagamentoAperto && (
        <Modal title="NUOVO PAGAMENTO" onClose={() => setNuovoPagamentoAperto(false)}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#64748B", marginBottom: 6 }}>CLIENTE</div>
          {clienteSelezionatoPagamento ? (
            <div
              style={{ background: "#FFFFFF", borderRadius: 14, padding: 13, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 900 }}>{clienteSelezionatoPagamento.nomeCliente}</div>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>{clienteSelezionatoPagamento.telefono || "Nessun telefono"}{clienteSelezionatoPagamento.targa ? ` · ${clienteSelezionatoPagamento.targa}` : ""}</div>
              </div>
              <button type="button" onClick={() => setClienteSelezionatoPagamento(null)} style={{ border: 0, background: "transparent", color: "#64748B", fontSize: 18 }}>×</button>
            </div>
          ) : (
            <>
              <input
                value={clienteQuery}
                onChange={(e) => setClienteQuery(e.target.value)}
                placeholder="Nome, targa o telefono"
                style={{ width: "100%", boxSizing: "border-box", border: "1px solid #E5E7EB", borderRadius: 14, padding: "13px 14px", fontSize: 15, background: "#FFFFFF" }}
              />
              {clienteQuery.trim() && clientiFiltrati.length > 0 && (
                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
                  {clientiFiltrati.map((cliente) => (
                    <button key={cliente.clientKey} type="button" onClick={() => { setClienteSelezionatoPagamento(cliente); setClienteQuery(""); }} style={{ border: 0, background: "#FFFFFF", borderRadius: 12, padding: 11, textAlign: "left", cursor: "pointer" }}>
                      <div style={{ fontWeight: 800 }}>{cliente.nomeCliente}</div>
                      <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{cliente.telefono || ""}{cliente.targa ? ` · ${cliente.targa}` : ""}</div>
                    </button>
                  ))}
                </div>
              )}
              {clienteQuery.trim() && clientiFiltrati.length === 0 && (
                <div style={{ marginTop: 8, padding: 12, borderRadius: 14, background: "#FFFFFF", color: "#64748B", fontSize: 13 }}>
                  Nessun cliente trovato. Compila qui sotto per creare il nuovo profilo.
                </div>
              )}
            </>
          )}
          {!clienteSelezionatoPagamento && (
            <>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#64748B", marginTop: 12, marginBottom: 6 }}>NUOVO CLIENTE</div>
              <input value={nuovoClienteNome} onChange={(e) => setNuovoClienteNome(e.target.value)} placeholder="Nome e cognome" style={{ width: "100%", boxSizing: "border-box", border: "1px solid #E5E7EB", borderRadius: 14, padding: "13px 14px", fontSize: 15, background: "#FFFFFF" }} />
              <input value={nuovoClienteTelefono} onChange={(e) => setNuovoClienteTelefono(e.target.value)} placeholder="Telefono" style={{ width: "100%", boxSizing: "border-box", border: "1px solid #E5E7EB", borderRadius: 14, padding: "13px 14px", fontSize: 15, background: "#FFFFFF", marginTop: 8 }} />
            </>
          )}
          <div style={{ fontSize: 12, fontWeight: 800, color: "#64748B", marginTop: 14, marginBottom: 6 }}>DESCRIZIONE</div>
          <input value={nuovoPagamentoDescrizione} onChange={(e) => setNuovoPagamentoDescrizione(e.target.value)} placeholder="Es. Cambio lampadina" style={{ width: "100%", boxSizing: "border-box", border: "1px solid #E5E7EB", borderRadius: 14, padding: "13px 14px", fontSize: 15, background: "#FFFFFF" }} />
          <div style={{ fontSize: 12, fontWeight: 800, color: "#64748B", marginTop: 14, marginBottom: 6 }}>IMPORTO</div>
          <input value={nuovoPagamentoImporto} onChange={(e) => setNuovoPagamentoImporto(e.target.value)} inputMode="decimal" placeholder="€ 0,00" style={{ width: "100%", boxSizing: "border-box", border: "1px solid #E5E7EB", borderRadius: 14, padding: "13px 14px", fontSize: 16, background: "#FFFFFF" }} />
          <button type="button" onClick={salvaNuovoPagamento} style={{ width: "100%", height: 50, border: 0, borderRadius: 16, background: "#D4AF37", color: "#111827", fontWeight: 900, marginTop: 16 }}>SALVA</button>
        </Modal>
      )}
      {checkInOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 20000, background: "#000", display: "flex", justifyContent: "center" }}>
          <div style={{ position: "relative", width: "100%", maxWidth: 430, height: "100%", overflow: "hidden", background: "#000" }}>
            <video ref={checkInVideoRef} autoPlay muted playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.42)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", top: 18, left: 18, right: 18, display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 2 }}>
              <div style={{ padding: "9px 12px", borderRadius: 14, background: "rgba(0,0,0,.62)", color: "#FFF", fontSize: 12, fontWeight: 900 }}>CHECK-IN · TARGA</div>
              <button type="button" onClick={stopCheckInCamera} style={{ width: 42, height: 42, border: 0, borderRadius: 14, background: "rgba(255,255,255,.94)", color: "#111827", fontSize: 24, fontWeight: 700 }}>×</button>
            </div>
            <div style={{ position: "absolute", left: "8%", right: "8%", top: "50%", transform: "translateY(-50%)", height: 78, border: "3px solid #D4AF37", borderRadius: 16, boxShadow: "0 0 0 9999px rgba(0,0,0,.46)", zIndex: 2, pointerEvents: "none" }}>
              <div style={{ position: "absolute", left: "50%", top: -38, transform: "translateX(-50%)", whiteSpace: "nowrap", padding: "8px 12px", borderRadius: 12, background: "rgba(0,0,0,.65)", color: "#FFF", fontSize: 12, fontWeight: 800 }}>Inquadra qui la targa</div>
            </div>
            {checkInError && <div style={{ position: "absolute", left: 18, right: 18, bottom: 122, zIndex: 4, padding: "11px 13px", borderRadius: 14, background: "rgba(127,29,29,.92)", color: "#FFF", fontSize: 13, fontWeight: 800, textAlign: "center" }}>{checkInError}</div>}
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 28, zIndex: 4, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div style={{ color: "#FFF", fontSize: 12, fontWeight: 700, textAlign: "center" }}>Tieni la targa dentro il riquadro</div>
              <button type="button" onClick={() => void captureCheckInPlate()} disabled={checkInBusy} aria-label="Scatta foto targa" style={{ width: 78, height: 78, borderRadius: "50%", border: "5px solid rgba(255,255,255,.78)", background: checkInBusy ? "#D1D5DB" : "#FFF", boxShadow: "0 8px 24px rgba(0,0,0,.35)", cursor: checkInBusy ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 58, height: 58, borderRadius: "50%", background: "#D4AF37" }} />
              </button>
            </div>
          </div>
        </div>
      )}
      {modal === "ordini" && (
        <Modal
          title="ORDINI"
          onClose={() =>
            setModal(null)
          }
          topRight={
            <button
              type="button"
              onClick={() =>
                router.push("/ordini")
              }
              style={modalLinkStyle}
            >
              LISTA ORDINI
            </button>
          }
        >
          {ordini.length === 0 ? (
            <EmptyState text="Nessun ordine presente." />
          ) : (
            ordini.map(
              (ordine, index) => (
                <OrderRow
                  key={
                    ordine.id ||
                    ordine.numero ||
                    index
                  }
                  ordine={ordine}
                />
              )
            )
          )}
          <button
            type="button"
            onClick={() => {
              sessionStorage.removeItem("goldencar_nuovo_ordine");
              sessionStorage.setItem("goldencar_nuovo_ordine", "1");
              router.push("/ordini");
            }}
            style={{
              width: 52,
              height: 52,
              margin: "14px auto 0",
              border: "none",
              borderRadius: 17,
              background: "#D4AF37",
              color: "#111827",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            aria-label="Nuovo ordine"
          >
            <PlusIcon />
          </button>
        </Modal>
      )}
    </>
  );
}
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

function EmptyState({ text }: { text: string }) {
  return <div style={{ background: "#FFFFFF", borderRadius: 17, padding: "22px 14px", textAlign: "center", color: "#64748B", fontSize: 13, fontWeight: 700 }}>{text}</div>;
}
function OrderRow({ ordine }: { ordine: Ordine }) {
  return <div style={{ background: "#FFFFFF", borderRadius: 17, padding: 13, display: "flex", alignItems: "center", gap: 12 }}><div style={{ width: 42, height: 42, borderRadius: 13, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconOrdini /></div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>{ordine.numero ? `ORDINE ${ordine.numero}` : "ORDINE"}</div><div style={{ fontSize: 13, color: "#64748B", marginTop: 3 }}>{ordine.cliente || "Cliente"}{ordine.veicolo ? ` · ${ordine.veicolo}` : ""}</div>{ordine.descrizione && <div style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>{ordine.descrizione}</div>}</div><div style={{ fontSize: 11, fontWeight: 800, color: "#64748B" }}>{ordine.stato || ""}</div></div>;
}

/* =====================================================
   STAT CARD
\===================================================== */
function StatCard({
  title,
  value,
  color,
  icon,
  onClick,
}: {
  title: string;
  value: string | number;
  color: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <div
      style={{
        position: "relative",
      }}
    >
      <button
        type="button"
        onClick={onClick}
        style={{
          width: "100%",
          height: 140,
          border: "none",
          borderRadius: 24,
          background: "#FFFFFF",
          padding: 14,
          paddingTop: 16,
          textAlign: "left",
          boxShadow:
            "0 4px 14px rgba(15,23,42,.08)",
          display: "flex",
          flexDirection:
            "column",
          justifyContent:
            "space-between",
          cursor: "pointer",
        }}
      >
        {icon}
        <div>
          <div
            style={{
              fontSize: 13,
              color: "#6B7280",
              marginBottom: 4,
              fontWeight: 700,
            }}
          >
            {title}
          </div>
          {value !== "web" ? (
            <div
              style={{
                fontSize: 40,
                fontWeight: 900,
                lineHeight: 1,
                color,
              }}
            >
              {value}
            </div>
          ) : (
            <GlobeIcon />
          )}
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
          SCHEDA #{lavoro.jobNumber}
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
      <div
        style={{
          background: "#FFF1C2",
          color: "#92400E",
          borderRadius: 999,
          padding:
            "6px 9px",
          fontSize: 10,
          fontWeight: 900,
          whiteSpace:
            "nowrap",
        }}
      >
        IN LAVORAZIONE
      </div>
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