"use client";

import { useEffect, useMemo, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { supabase } from "@/lib/supabase";
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
  jobId?: string;
  pdfR2Key?: string;
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

  const caricaLavori = async () => {
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .in("stato", ["CONCLUSO", "CHIUSO"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Errore caricamento lavori Supabase:", error);
      setLavori([]);
      return;
    }

    const conclusi: Lavoro[] = (data || []).map((row: any) => {
      let details: any = {};
      try {
        details = row.dettagli && typeof row.dettagli === "object"
          ? row.dettagli
          : JSON.parse(String(row.dettagli || "{}"));
      } catch {}

      const idMatch = String(row.id || "").match(/^(\d{2})-(\d{3})$/);
      const jobNumber = idMatch
        ? Number(idMatch[1]) * 1000 + Number(idMatch[2])
        : 0;

      let products: any[] = Array.isArray(details.products) ? details.products : [];
      if (!products.length && row.prodotti_utilizzati) {
        try {
          const parsed = JSON.parse(String(row.prodotti_utilizzati));
          if (Array.isArray(parsed)) products = parsed;
        } catch {}
      }

      return {
        jobId: String(row.id),
        nomeCliente: details.nomeCliente || "",
        indirizzo: details.indirizzo || "",
        telefono: details.telefono || "",
        codiceFiscale: details.codiceFiscale || "",
        veicolo: details.veicolo || "",
        targa: details.targa || "",
        kilometers: row.chilometri == null ? "" : String(row.chilometri),
        jobNumber,
        createdAt: row.created_at || "",
        labor: row.manodopera == null ? "" : String(row.manodopera),
        workType: Array.isArray(details.types)
          ? details.types.join(" · ")
          : row.tipo || "",
        problems: row.problemi ? String(row.problemi).split("\n").filter(Boolean) : [],
        works: row.lavori ? String(row.lavori).split("\n").filter(Boolean) : [],
        notes: row.note || "",
        invoiceNumber: row.fattura || "",
        products,
        status: "CONCLUSO",
        pdfR2Key: details.pdfR2Key || "",
      } as Lavoro;
    });

    setLavori(conclusi);
  };

  useEffect(() => {
    void caricaLavori();
    const refresh = () => { void caricaLavori(); };
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
      if (lavoro.pdfR2Key) {
        const response = await fetch("/api/r2/file?key=" + encodeURIComponent(lavoro.pdfR2Key));
        const data = await response.json();
        if (!response.ok || !data?.ok || !data?.downloadUrl) {
          throw new Error(data?.error || "PDF non disponibile su R2.");
        }
        window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
        return;
      }

      // Compatibilità con le vecchie schede concluse prima dell'archivio R2.
      const blob = await pdf(<SchedaLavoroPDF lavoro={toPdfData(lavoro)} />).toBlob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      console.error("Errore apertura PDF scheda:", error);
      alert(error instanceof Error ? error.message : "Non è stato possibile aprire il PDF della scheda.");
    } finally {
      setPdfLoading(null);
    }
  };

  return <>
    <main className="app" style={{ minHeight: "100vh", paddingBottom: 120 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "28px 22px 18px" }}>
        <div style={{ width: 74, height: 74, borderRadius: 22, background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,.08)", fontSize: 13, fontWeight: 700, color: "#9CA3AF", flexShrink: 0 }}><img src="/logo.png" alt="Goldencar" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "inherit" }} /></div>
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
