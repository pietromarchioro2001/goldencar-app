"use client";

import { useEffect, useMemo, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import SchedaLavoroPDF, { type SchedaLavoroPDFData } from "@/app/pdf/SchedaLavoroPDF";
import BottomBar from "@/components/BottomBar";

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
};

function PaperclipIcon() {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true"><path d="M8.5 12.5 14.9 6.1a3.54 3.54 0 0 1 5 5L11 20a5 5 0 0 1-7.07-7.07l8.84-8.84a2.5 2.5 0 0 1 3.54 3.54L7.5 16.44a1.5 1.5 0 0 1-2.12-2.12l7.78-7.78" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function SearchIcon() {
  return <svg viewBox="0 0 24 24" width="21" height="21" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.9" /><path d="m16 16 4.2 4.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>;
}
function formatDate(value: string) {
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

export default function LavoriPage() {
  const [lavori, setLavori] = useState<Lavoro[]>([]);
  const [ricerca, setRicerca] = useState("");
  const [pdfLoading, setPdfLoading] = useState<number | null>(null);

  const caricaLavori = () => {
    const conclusi: Lavoro[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("goldencar_job_")) continue;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as Lavoro;
        if (parsed?.status === "CONCLUSO") conclusi.push(parsed);
      } catch {}
    }
    conclusi.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      if (dateA !== dateB) return dateB - dateA;
      return Number(b.jobNumber || 0) - Number(a.jobNumber || 0);
    });
    setLavori(conclusi);
  };

  useEffect(() => {
    caricaLavori();
    const refresh = () => caricaLavori();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const lavoriFiltrati = useMemo(() => {
    const query = ricerca.trim().toLowerCase();
    if (!query) return lavori;
    return lavori.filter((lavoro) => [lavoro.veicolo, lavoro.targa, lavoro.nomeCliente].some((value) => String(value || "").toLowerCase().includes(query)));
  }, [lavori, ricerca]);

  const apriPdf = async (lavoro: Lavoro) => {
    if (pdfLoading === lavoro.jobNumber) return;
    setPdfLoading(lavoro.jobNumber);
    try {
      const blob = await pdf(<SchedaLavoroPDF lavoro={toPdfData(lavoro)} />).toBlob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      console.error("Errore apertura PDF scheda:", error);
      alert("Non è stato possibile aprire il PDF della scheda.");
    } finally {
      setPdfLoading(null);
    }
  };

  return <>
    <main className="app" style={{ minHeight: "100vh", paddingBottom: 120 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "28px 22px 18px" }}>
        <div style={{ width: 74, height: 74, borderRadius: 22, background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,.08)", fontSize: 13, fontWeight: 700, color: "#9CA3AF", flexShrink: 0 }}>LOGO</div>
        <h1 style={{ fontSize: 31, fontWeight: 800, color: "#041E49", letterSpacing: "-0.7px", margin: "3px 0 0" }}>LAVORI</h1>
      </div>

      <div style={{ margin: "0 22px 20px", position: "relative" }}>
        <input value={ricerca} onChange={(e) => setRicerca(e.target.value)} placeholder="Cerca veicolo, targa o cliente" style={{ width: "100%", height: 52, boxSizing: "border-box", border: "1px solid #E2E8F0", borderRadius: 17, background: "#FFFFFF", padding: "0 16px 0 48px", fontSize: 15, fontWeight: 500, color: "#111827", outline: "none", boxShadow: "0 3px 10px rgba(15,23,42,.05)" }} />
        <div style={{ position: "absolute", left: 15, top: 15, color: "#64748B", pointerEvents: "none" }}><SearchIcon /></div>
      </div>

      <section style={{ margin: "0 18px" }}>
        {lavoriFiltrati.length === 0 ? <div style={{ background: "#FFFFFF", borderRadius: 22, padding: "34px 22px", textAlign: "center", boxShadow: "0 4px 14px rgba(15,23,42,.07)", color: "#64748B" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#041E49", marginBottom: 6 }}>{ricerca.trim() ? "Nessun lavoro trovato" : "Nessun lavoro concluso"}</div>
          <div style={{ fontSize: 13, lineHeight: 1.45 }}>{ricerca.trim() ? "Prova a cercare per veicolo, targa o cliente." : "I lavori conclusi verranno mostrati qui."}</div>
        </div> : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {lavoriFiltrati.map((lavoro) => {
            const tipo = lavoro.types?.filter(Boolean).join(" · ") || "Intervento";
            return <div key={`${lavoro.jobNumber}-${lavoro.createdAt}`} style={{ background: "#FFFFFF", borderRadius: 20, minHeight: 88, padding: "13px 14px", display: "flex", alignItems: "center", gap: 13, boxShadow: "0 4px 14px rgba(15,23,42,.07)", boxSizing: "border-box" }}>
              <button type="button" onClick={() => apriPdf(lavoro)} disabled={pdfLoading === lavoro.jobNumber} aria-label={`Apri PDF scheda ${formatJobNumber(lavoro.jobNumber)}`} style={{ width: 48, height: 48, borderRadius: 15, border: "none", background: "#EEF3F8", color: "#041E49", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: pdfLoading === lavoro.jobNumber ? "wait" : "pointer", opacity: pdfLoading === lavoro.jobNumber ? 0.55 : 1 }}><PaperclipIcon /></button>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ minWidth: 0, fontSize: 16, fontWeight: 800, color: "#041E49", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tipo}</div>
                  <div style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: "#64748B" }}>{formatDate(lavoro.createdAt)}</div>
                </div>
                <div style={{ marginTop: 5, fontSize: 14, fontWeight: 700, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lavoro.nomeCliente || "Cliente non indicato"}</div>
                <div style={{ marginTop: 3, display: "flex", alignItems: "center", gap: 7, minWidth: 0, fontSize: 12, fontWeight: 600, color: "#64748B" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lavoro.veicolo || "Veicolo non indicato"}</span>
                  <span style={{ color: "#CBD5E1" }}>•</span>
                  <span style={{ flexShrink: 0, fontWeight: 800, letterSpacing: ".3px" }}>{lavoro.targa || "—"}</span>
                </div>
              </div>
              <div style={{ flexShrink: 0, alignSelf: "flex-start", marginTop: 2, fontSize: 11, fontWeight: 800, color: "#94A3B8" }}>#{formatJobNumber(lavoro.jobNumber)}</div>
            </div>;
          })}
        </div>}
      </section>
    </main>
    <BottomBar />
  </>;
}
