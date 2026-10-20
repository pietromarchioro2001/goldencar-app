"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { pdf } from "@react-pdf/renderer";
import SchedaLavoroPDF, { type SchedaLavoroPDFData } from "@/app/pdf/SchedaLavoroPDF";
import BottomBar from "@/components/BottomBar";

type ApiCacheEntry = { value: any; savedAt: number };
const apiCache = new Map<string, ApiCacheEntry>();
const apiRequests = new Map<string, Promise<any>>();

async function fetchJsonCached(url: string): Promise<any> {
  const now = Date.now();
  const cached = apiCache.get(url);
  if (cached && now - cached.savedAt < 4000) return cached.value;
  const pending = apiRequests.get(url);
  if (pending) return pending;

  const request = (async () => {
    try {
      const response = await fetch(url, { cache: "no-store" });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        if (response.status === 401 || response.status === 403 || !cached || Date.now() - cached.savedAt > 30000) {
          throw new Error(result?.error || `Richiesta fallita (${response.status})`);
        }
        return cached.value;
      }
      apiCache.set(url, { value: result, savedAt: Date.now() });
      return result;
    } catch (error) {
      if (cached && Date.now() - cached.savedAt <= 30000) return cached.value;
      throw error;
    } finally {
      apiRequests.delete(url);
    }
  })();
  apiRequests.set(url, request);
  return request;
}

type Product = { name: string; details: string; quantity?: string; orderRequested?: boolean };
type Lavoro = {
  jobNumber: number;
  createdAt: string;
  nomeCliente: string;
  telefono?: string;
  indirizzo?: string;
  codiceFiscale?: string;
  veicolo: string;
  targa: string;
  kilometers: string;
  types?: string[];
  problems?: string[];
  products?: Product[];
  works?: string[] | string;
  labor: string;
  notes: string;
  invoiceNumber: string;
  paymentAmount?: string;
  paymentStatus?: "DA_PAGARE" | "PAGATO";
  status: "IN_LAVORAZIONE" | "CONCLUSO";
  jobId?: string;
  pdfR2Key?: string;
};


type Revisione = {
  id?: string;
  vehicleId?: string;
  nomeCliente?: string;
  cliente?: string;
  veicolo?: string;
  targa?: string;
  revisione?: string;
  scadenza?: string;
  telefono?: string;
};

function formatJobDate(value: string) {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}
function formatJobNumber(value: number | string) {
  const raw = String(value ?? "").trim();
  if (/^\d{2}-\d{3}$/.test(raw)) return raw;
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return raw || "—";
  const year = new Date().getFullYear().toString().slice(-2);
  return `${year}-${String(numeric).padStart(3, "0")}`;
}
function normalizeWorks(works: string[] | string | undefined) {
  return Array.isArray(works) ? works.filter(Boolean).join("\n") : String(works || "");
}
function toPdfData(lavoro: Lavoro): SchedaLavoroPDFData {
  return {
    nomeCliente: lavoro.nomeCliente || "",
    indirizzo: lavoro.indirizzo || "",
    telefono: lavoro.telefono || "",
    codiceFiscale: lavoro.codiceFiscale || "",
    veicolo: lavoro.veicolo || "",
    targa: lavoro.targa || "",
    kilometers: lavoro.kilometers || "",
    jobNumber: Number(lavoro.jobNumber) || 0,
    createdAt: lavoro.createdAt || "",
    labor: lavoro.labor || "",
    workType: lavoro.types?.join(" · ") || "",
    problems: lavoro.problems || [],
    works: normalizeWorks(lavoro.works),
    notes: lavoro.notes || "",
    invoiceNumber: lavoro.invoiceNumber || "",
    products: lavoro.products || [],
    status: lavoro.status,
  };
}

function paperclipIcon() { return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true"><path d="M8.5 12.5 14.9 6.1a3.54 3.54 0 0 1 5 5L11 20a5 5 0 0 1-7.07-7.07l8.84-8.84a2.5 2.5 0 0 1 3.54 3.54L7.5 16.44a1.5 1.5 0 0 1-2.12-2.12l7.78-7.78" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function parseDateOnly(value: string) {
  const match = String(value || "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: string) {
  if (!value) return "—";
  const date = parseDateOnly(value);
  if (!date) return value;
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function toDateInput(value: string) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function getRevisionDate(revisione: Revisione) {
  return revisione.scadenza || revisione.revisione || "";
}

function normalizeRevisioni(items: Revisione[]) {
  return items.map((item, index) => ({
    ...item,
    id:
      item.id ||
      `revisione-${index}-${item.targa || "auto"}-${item.scadenza || item.revisione || ""}`,
  }));
}

function daysFromToday(value: string) {
  if (!value) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = parseDateOnly(value);
  if (!date) return null;
  date.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 86400000);
}

function calendarIcon(color = "#D4AF37") {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
        stroke={color}
        strokeWidth="2"
      />
      <path d="M8 3V7M16 3V7M3 10H21" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function whatsappIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20.5 11.6A8.5 8.5 0 0 1 8.1 19.2L3.5 20.5l1.3-4.5A8.5 8.5 0 1 1 20.5 11.6Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.6 8.2c.2-.5.5-.5.8-.5h.5c.2 0 .4.1.5.4l.7 1.7c.1.2 0 .5-.1.7l-.5.6c.6 1.1 1.5 2 2.6 2.6l.6-.5c.2-.2.5-.2.7-.1l1.7.7c.3.1.4.3.4.5v.5c0 .3 0 .6-.5.8-.5.2-1.1.3-1.7.1-1.1-.3-2.5-1.2-3.7-2.4-1.2-1.2-2.1-2.6-2.4-3.7-.2-.6-.1-1.2.1-1.7Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function RevisioniPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"REVISIONI" | "LAVORI">("REVISIONI");
  const [lavori, setLavori] = useState<Lavoro[]>([]);
  const [pdfLoading, setPdfLoading] = useState<number | null>(null);
  const [revisioni, setRevisioni] = useState<Revisione[]>([]);
  const [ricerca, setRicerca] = useState("");
  const [revisioneDaAggiornare, setRevisioneDaAggiornare] = useState<Revisione | null>(null);
  const [nuovaData, setNuovaData] = useState("");

  const caricaDatiProtetti = async () => {
    try {
      const result = await fetchJsonCached("/api/revisioni");
      if (!result?.ok) throw new Error(result?.error || "Errore caricamento revisioni e lavori.");

      const rows = Array.isArray(result.vehicles) ? result.vehicles : [];
      const clients = Array.isArray(result.clients) ? result.clients : [];
      const relations = Array.isArray(result.relations) ? result.relations : [];
      const clientsById = new Map(clients.map((client: any) => [String(client.id), client]));
      const primaryByVehicle = new Map<string, any>();
      for (const relation of relations) {
        const vehicleId = String(relation.vehicle_id);
        if (relation.ruolo === "PRINCIPALE" || !primaryByVehicle.has(vehicleId)) {
          primaryByVehicle.set(vehicleId, clientsById.get(String(relation.client_id)));
        }
      }
      const items: Revisione[] = rows.map((vehicle: any) => {
        const client = primaryByVehicle.get(String(vehicle.id)) || clientsById.get(String(vehicle.client_id ?? ""));
        const nomeCliente = String(client?.nome ?? "").trim();
        return {
          id: `revisione-${vehicle.id}`,
          vehicleId: String(vehicle.id),
          nomeCliente,
          cliente: nomeCliente,
          telefono: String(client?.telefono ?? ""),
          veicolo: String(vehicle.veicolo ?? ""),
          targa: String(vehicle.targa ?? ""),
          revisione: String(vehicle.revisione ?? ""),
          scadenza: String(vehicle.revisione ?? ""),
        };
      });
      setRevisioni(normalizeRevisioni(items));

      const conclusi: Lavoro[] = result.jobs.map((row: any) => {
        let details: any = {};
        try { details = row.dettagli && typeof row.dettagli === "object" ? row.dettagli : JSON.parse(String(row.dettagli || "{}")); } catch {}
        const idMatch = String(row.id || "").match(/^([0-9]{2})-([0-9]{3})$/);
        const jobNumber = idMatch ? Number(idMatch[1]) * 1000 + Number(idMatch[2]) : 0;
        let products: Product[] = Array.isArray(details.products) ? details.products : [];
        if (!products.length && row.prodotti_utilizzati) { try { const parsed = JSON.parse(String(row.prodotti_utilizzati)); if (Array.isArray(parsed)) products = parsed; } catch {} }
        return { jobId: String(row.id), nomeCliente: details.nomeCliente || "", indirizzo: details.indirizzo || "", telefono: details.telefono || "", codiceFiscale: details.codiceFiscale || "", veicolo: details.veicolo || "", targa: details.targa || "", kilometers: row.chilometri == null ? "" : String(row.chilometri), jobNumber, createdAt: row.created_at || "", labor: row.manodopera == null ? "" : String(row.manodopera), types: Array.isArray(details.types) ? details.types : row.tipo ? [String(row.tipo)] : [], problems: row.problemi ? String(row.problemi).split("\n").filter(Boolean) : [], works: row.lavori ? String(row.lavori).split("\n").filter(Boolean) : [], notes: row.note || "", invoiceNumber: row.fattura || "", products, status: "CONCLUSO", pdfR2Key: details.pdfR2Key || "" } as Lavoro;
      });
      setLavori(conclusi);
    } catch (error) {
      // Mantieni le liste già mostrate se la rete/API ha un errore temporaneo.
      console.error("Errore caricamento revisioni/lavori:", error);
    }
  };
  const apriPdf = async (lavoro: Lavoro) => {
    if (pdfLoading === lavoro.jobNumber) return;
    setPdfLoading(lavoro.jobNumber);
    try {
      if (lavoro.pdfR2Key) { const response = await fetch("/api/r2/file?key=" + encodeURIComponent(lavoro.pdfR2Key)); const data = await response.json(); if (!response.ok || !data?.ok || !data?.downloadUrl) throw new Error(data?.error || "PDF non disponibile su R2."); window.open(data.downloadUrl, "_blank", "noopener,noreferrer"); return; }
      const blob = await pdf(<SchedaLavoroPDF lavoro={toPdfData(lavoro)} />).toBlob(); const url = URL.createObjectURL(blob); window.open(url, "_blank", "noopener,noreferrer"); window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) { console.error("Errore apertura PDF scheda:", error); alert(error instanceof Error ? error.message : "Non è stato possibile aprire il PDF della scheda."); } finally { setPdfLoading(null); }
  };
  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    setTab(requestedTab === "lavori" ? "LAVORI" : "REVISIONI");
    void caricaDatiProtetti();
    const refresh = () => { void caricaDatiProtetti(); };
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener("focus", refresh); };
  }, []);

  const revisioniFiltrate = useMemo(() => {
    const query = ricerca.trim().toLowerCase();

    return [...revisioni]
      .filter((item) => {
        if (!query) return true;
        return [
          item.nomeCliente,
          item.cliente,
          item.targa,
          item.telefono,
          item.veicolo,
        ].some((value) =>
          String(value || "").toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const dateA = new Date(getRevisionDate(a)).getTime();
        const dateB = new Date(getRevisionDate(b)).getTime();
        if (Number.isNaN(dateA)) return 1;
        if (Number.isNaN(dateB)) return -1;
        return dateA - dateB;
      });
  }, [revisioni, ricerca]);

  const lavoriFiltrati = useMemo(() => {
    const query = ricerca.trim().toLowerCase();
    if (!query) return lavori;
    return lavori.filter((lavoro) => [lavoro.veicolo, lavoro.targa, lavoro.nomeCliente].some((value) => String(value || "").toLowerCase().includes(query)));
  }, [lavori, ricerca]);

  const aggiornaData = async () => {
    if (!revisioneDaAggiornare || !nuovaData) return;
    if (!revisioneDaAggiornare.vehicleId) {
      alert("Veicolo non collegato al database.");
      return;
    }

    const response = await fetch("/api/revisioni", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: revisioneDaAggiornare.vehicleId, revisione: nuovaData }) });
    const result = await response.json();
    if (!response.ok || !result?.ok) {
      console.error("Errore aggiornamento revisione:", result);
      alert("Non è stato possibile aggiornare la revisione: " + (result?.error || "Errore sconosciuto."));
      return;
    }

    setRevisioni((current) => current.map((item) =>
      item.id === revisioneDaAggiornare.id
        ? { ...item, scadenza: nuovaData, revisione: nuovaData }
        : item
    ));
    setRevisioneDaAggiornare(null);
    setNuovaData("");
  };

  const ricorda = (revisione: Revisione) => {
    const telefonoRaw = String(revisione.telefono || "").trim();
    let telefono = telefonoRaw.replace(/\D/g, "");
    if (telefono.startsWith("00")) telefono = telefono.slice(2);
    if (!telefono.startsWith("39") && /^3\d{8,9}$/.test(telefono)) {
      telefono = "39" + telefono;
    }
    if (!telefono) {
      alert("Questo cliente non ha un numero di telefono.");
      return;
    }

    const nome = revisione.nomeCliente || revisione.cliente || "cliente";
    const veicolo = revisione.veicolo || "il tuo veicolo";
    const targa = revisione.targa ? ` targato ${revisione.targa}` : "";
    const data = getRevisionDate(revisione);
    const giorni = daysFromToday(data);

    if (!data) {
      alert("Questo veicolo non ha una data di revisione valida.");
      return;
    }

    const testo =
      giorni !== null && giorni < 0
        ? "Ciao " + nome + ", ti ricordiamo che la revisione di " + veicolo + targa + " è scaduta il " + formatDate(data) + ". Ti invitiamo a contattarci per aggiornarla e fissare un appuntamento."
        : "Ciao " + nome + ", ti ricordiamo che la revisione di " + veicolo + targa + " scadrà il " + formatDate(data) + ". Ti invitiamo a contattarci per aggiornarla e fissare un appuntamento.";

    window.open(
      `https://wa.me/${telefono}?text=${encodeURIComponent(testo)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <main
      className="app"
      style={{
        minHeight: "100vh",
        paddingBottom: 120,
      }}
    >
      {/* HEADER */}
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
          ATTIVITÀ
        </h1>
      </div>
  
      {/* RICERCA */}
      <div
        style={{
          margin: "0 22px 18px",
          background: "#FFFFFF",
          borderRadius: 18,
          padding: "13px 15px",
          boxShadow: "0 4px 14px rgba(15,23,42,.07)",
        }}
      >
        <input
          value={ricerca}
          onChange={(event) => setRicerca(event.target.value)}
          placeholder="Cerca veicolo, targa o cliente..."
          style={{
            width: "100%",
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 15,
            color: "#111827",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, margin: "0 22px 18px", padding: 5, borderRadius: 15, background: "#E9EDF3" }}>
        {(["LAVORI", "REVISIONI"] as const).map((nomeTab) => <button key={nomeTab} type="button" onClick={() => setTab(nomeTab)} style={{ flex: 1, border: "none", borderRadius: 11, padding: "12px 8px", background: tab === nomeTab ? "#FFFFFF" : "transparent", color: tab === nomeTab ? "#041E49" : "#64748B", boxShadow: tab === nomeTab ? "0 2px 7px rgba(15,23,42,.08)" : "none", fontSize: 13, fontWeight: 900, cursor: "pointer" }}>{nomeTab}</button>)}
      </div>
      {tab === "LAVORI" ? (
        <section style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          {lavoriFiltrati.length === 0 ? <div style={{ background: "#FFFFFF", borderRadius: 20, padding: 24, textAlign: "center", color: "#64748B", fontSize: 14 }}>{ricerca.trim() ? "Nessun lavoro trovato." : "Nessun lavoro concluso."}</div> : lavoriFiltrati.map((lavoro) => (
            <div key={lavoro.jobId || String(lavoro.jobNumber)} onClick={() => { sessionStorage.setItem("goldencar_apri_scheda", String(lavoro.jobId || formatJobNumber(lavoro.jobNumber))); router.push("/veicolo/scheda"); }} style={{ background: "#FFFFFF", borderRadius: 20, minHeight: 88, padding: "13px 14px", display: "flex", alignItems: "center", gap: 13, boxShadow: "0 4px 14px rgba(15,23,42,.07)", boxSizing: "border-box", cursor: "pointer" }}>
              <button type="button" onClick={(event) => { event.stopPropagation(); void apriPdf(lavoro); }} disabled={pdfLoading === lavoro.jobNumber} aria-label={"Apri PDF scheda " + formatJobNumber(lavoro.jobNumber)} style={{ width: 48, height: 48, borderRadius: 15, border: "none", background: "#EEF3F8", color: "#041E49", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: pdfLoading === lavoro.jobNumber ? "wait" : "pointer", opacity: pdfLoading === lavoro.jobNumber ? 0.55 : 1 }}>{pdfLoading === lavoro.jobNumber ? "…" : paperclipIcon()}</button>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}><div style={{ minWidth: 0, fontSize: 16, fontWeight: 800, color: "#041E49", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lavoro.types?.filter(Boolean).join(" · ") || "Intervento"}</div><div style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: "#64748B" }}>{formatJobDate(lavoro.createdAt)}</div></div>
                <div style={{ marginTop: 5, fontSize: 14, fontWeight: 700, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lavoro.nomeCliente || "Cliente non indicato"}</div>
                <div style={{ marginTop: 3, display: "flex", alignItems: "center", gap: 7, minWidth: 0, fontSize: 12, fontWeight: 600, color: "#64748B" }}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lavoro.veicolo || "Veicolo non indicato"}</span><span style={{ color: "#CBD5E1" }}>•</span><span style={{ flexShrink: 0, fontWeight: 800, letterSpacing: ".3px" }}>{lavoro.targa || "—"}</span></div>
              </div>
              <div style={{ flexShrink: 0, alignSelf: "flex-start", marginTop: 2, fontSize: 11, fontWeight: 800, color: "#94A3B8" }}>#{formatJobNumber(lavoro.jobNumber)}</div>
            </div>
          ))}
        </section>
      ) : (
        <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          {revisioniFiltrate.length === 0 ? <div style={{ background: "#FFFFFF", borderRadius: 20, padding: 24, textAlign: "center", color: "#64748B", fontSize: 14 }}>Nessuna revisione trovata.</div> : revisioniFiltrate.map((revisione) => {
            const giorni = daysFromToday(getRevisionDate(revisione)); const scaduta = giorni !== null && giorni < 0; const entro30 = giorni !== null && giorni >= 0 && giorni <= 30;
            const background = scaduta ? "#FEE2E2" : entro30 ? "#FFF8DB" : "#FFFFFF"; const dataColor = scaduta ? "#DC2626" : entro30 ? "#A16207" : "#111827";
            return <div key={revisione.id} style={{ background, borderRadius: 19, padding: 13, display: "flex", alignItems: "center", gap: 10, boxShadow: "0 3px 10px rgba(15,23,42,.05)" }}>
              <button type="button" onClick={() => { setRevisioneDaAggiornare(revisione); setNuovaData(toDateInput(getRevisionDate(revisione))); }} aria-label="Aggiorna data revisione" style={{ width: 44, height: 44, flex: "0 0 44px", border: "none", borderRadius: 13, background: scaduta ? "#FEE2E2" : "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>{calendarIcon(scaduta ? "#DC2626" : entro30 ? "#D4AF37" : "#2563EB")}</button>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 15, fontWeight: 900, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{revisione.nomeCliente || revisione.cliente || "Cliente"}</div><div style={{ marginTop: 3, fontSize: 13, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{revisione.veicolo || "Veicolo"} · {revisione.targa || "—"}</div></div>
              <div style={{ minWidth: 76, textAlign: "right" }}><div style={{ fontSize: 14, fontWeight: 900, color: dataColor }}>{formatDate(getRevisionDate(revisione))}</div></div>
              <button type="button" onClick={() => ricorda(revisione)} style={{ border: "none", borderRadius: 12, background: "#16A34A", color: "#FFFFFF", padding: "9px 10px", fontSize: 10, fontWeight: 900, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>{whatsappIcon()} RICORDA</button>
            </div>;
          })}
        </div>
      )}
      {revisioneDaAggiornare && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,.42)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setRevisioneDaAggiornare(null)}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 420,
              background: "#FFFFFF",
              borderRadius: 24,
              padding: 22,
              boxShadow: "0 18px 50px rgba(15,23,42,.22)",
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 900,
                color: "#111827",
              }}
            >
              AGGIORNA REVISIONE
            </div>

            <div
              style={{
                marginTop: 8,
                fontSize: 14,
                color: "#64748B",
              }}
            >
              {revisioneDaAggiornare.nomeCliente ||
                revisioneDaAggiornare.cliente ||
                "Cliente"}{" "}
              · {revisioneDaAggiornare.targa || "—"}
            </div>

            <label
              style={{
                display: "block",
                marginTop: 20,
                fontSize: 13,
                fontWeight: 800,
                color: "#111827",
              }}
            >
              NUOVA DATA
            </label>

            <input
              type="date"
              value={nuovaData}
              onChange={(event) => setNuovaData(event.target.value)}
              style={{
                width: "100%",
                marginTop: 8,
                border: "1px solid #E5E7EB",
                borderRadius: 14,
                padding: "13px 14px",
                fontSize: 16,
                color: "#111827",
                background: "#FFFFFF",
                outline: "none",
              }}
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginTop: 16,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setRevisioneDaAggiornare(null);
                  setNuovaData("");
                }}
                style={{
                  border: "1px solid #E5E7EB",
                  borderRadius: 14,
                  background: "#FFFFFF",
                  padding: 13,
                  fontWeight: 800,
                  color: "#64748B",
                  cursor: "pointer",
                }}
              >
                ANNULLA
              </button>

              <button
                type="button"
                onClick={aggiornaData}
                disabled={!nuovaData}
                style={{
                  border: "none",
                  borderRadius: 14,
                  background: nuovaData ? "#D4AF37" : "#E5E7EB",
                  padding: 13,
                  fontWeight: 900,
                  color: "#111827",
                  cursor: nuovaData ? "pointer" : "default",
                }}
              >
                SALVA DATA
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomBar />
    </main>
  );
}
