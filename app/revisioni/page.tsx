"use client";

import { useEffect, useMemo, useState } from "react";
import BottomBar from "@/components/BottomBar";
import { supabase } from "@/lib/supabase";

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

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function toDateInput(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86400000);
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
  const [revisioni, setRevisioni] = useState<Revisione[]>([]);
  const [ricerca, setRicerca] = useState("");
  const [revisioneDaAggiornare, setRevisioneDaAggiornare] = useState<Revisione | null>(null);
  const [nuovaData, setNuovaData] = useState("");

  const caricaRevisioni = async () => {
    const { data: vehicles, error: vehiclesError } = await supabase
      .from("vehicles")
      .select("id, veicolo, targa, revisione")
      .not("revisione", "is", null);

    if (vehiclesError) {
      console.error("Errore caricamento revisioni:", vehiclesError);
      setRevisioni([]);
      return;
    }

    const rows = vehicles ?? [];
    const vehicleIds = rows.map((row: any) => String(row.id));

    const [{ data: relations }, { data: clients }] = await Promise.all([
      vehicleIds.length
        ? supabase.from("vehicle_clients").select("vehicle_id, client_id, ruolo").in("vehicle_id", vehicleIds)
        : Promise.resolve({ data: [] as any[] }),
      supabase.from("clients").select("id, nome, cognome, telefono"),
    ]);

    const clientsById = new Map((clients ?? []).map((client: any) => [String(client.id), client]));
    const primaryByVehicle = new Map<string, any>();
    for (const relation of relations ?? []) {
      const vehicleId = String(relation.vehicle_id);
      if (relation.ruolo === "PRINCIPALE" || !primaryByVehicle.has(vehicleId)) {
        primaryByVehicle.set(vehicleId, clientsById.get(String(relation.client_id)));
      }
    }

    const items: Revisione[] = rows.map((vehicle: any) => {
      const client = primaryByVehicle.get(String(vehicle.id));
      const nomeCliente = [client?.nome, client?.cognome].filter(Boolean).join(" ");
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
  };

  useEffect(() => {
    void caricaRevisioni();
    const refresh = () => {
      void caricaRevisioni();
    };
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
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

  const aggiornaData = async () => {
    if (!revisioneDaAggiornare || !nuovaData) return;
    if (!revisioneDaAggiornare.vehicleId) {
      alert("Veicolo non collegato al database.");
      return;
    }

    const { error } = await supabase
      .from("vehicles")
      .update({ revisione: nuovaData })
      .eq("id", revisioneDaAggiornare.vehicleId);

    if (error) {
      console.error("Errore aggiornamento revisione:", error);
      alert("Non è stato possibile aggiornare la revisione: " + error.message);
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
    const telefono = String(revisione.telefono || "").replace(/\D/g, "");
    if (!telefono) {
      alert("Questo cliente non ha un numero di telefono.");
      return;
    }

    const nome = revisione.nomeCliente || revisione.cliente || "cliente";
    const veicolo = revisione.veicolo || "il tuo veicolo";
    const targa = revisione.targa ? ` targato ${revisione.targa}` : "";
    const data = getRevisionDate(revisione);
    const giorni = daysFromToday(data);

    const testo =
      giorni !== null && giorni < 0
        ? `Ciao ${nome}, ti ricordiamo che la revisione di ${veicolo}${targa} è scaduta il ${formatDate(data)}. Contattaci per fissare un appuntamento.`
        : `Ciao ${nome}, ti ricordiamo che la revisione di ${veicolo}${targa} è prevista per il ${formatDate(data)}. Contattaci per fissare un appuntamento.`;

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
          REVISIONI
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
          placeholder="Cerca targa, cliente o telefono..."
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

      <div
        style={{
          padding: "0 18px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {revisioniFiltrate.length === 0 ? (
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 20,
              padding: 24,
              textAlign: "center",
              color: "#64748B",
              fontSize: 14,
            }}
          >
            Nessuna revisione trovata.
          </div>
        ) : (
          revisioniFiltrate.map((revisione) => {
            const giorni = daysFromToday(getRevisionDate(revisione));
            const scaduta = giorni !== null && giorni < 0;
            const entro30 = giorni !== null && giorni >= 0 && giorni <= 30;

            const background = scaduta
              ? "#FEE2E2"
              : entro30
                ? "#FFF8DB"
                : "#FFFFFF";

            const dataColor = scaduta
              ? "#DC2626"
              : entro30
                ? "#A16207"
                : "#111827";

            return (
              <div
                key={revisione.id}
                style={{
                  background,
                  borderRadius: 19,
                  padding: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  boxShadow: "0 3px 10px rgba(15,23,42,.05)",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setRevisioneDaAggiornare(revisione);
                    setNuovaData(toDateInput(getRevisionDate(revisione)));
                  }}
                  aria-label="Aggiorna data revisione"
                  style={{
                    width: 44,
                    height: 44,
                    flex: "0 0 44px",
                    border: "none",
                    borderRadius: 13,
                    background: scaduta ? "#FEE2E2" : "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  {calendarIcon(scaduta ? "#DC2626" : entro30 ? "#D4AF37" : "#2563EB")}
                </button>

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
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {revisione.nomeCliente || revisione.cliente || "Cliente"}
                  </div>
                  <div
                    style={{
                      marginTop: 3,
                      fontSize: 13,
                      color: "#64748B",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {revisione.veicolo || "Veicolo"} · {revisione.targa || "—"}
                  </div>
                </div>

                <div
                  style={{
                    minWidth: 76,
                    textAlign: "right",
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 900,
                      color: dataColor,
                    }}
                  >
                    {formatDate(getRevisionDate(revisione))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => ricorda(revisione)}
                  style={{
                    border: "none",
                    borderRadius: 12,
                    background: "#16A34A",
                    color: "#FFFFFF",
                    padding: "9px 10px",
                    fontSize: 10,
                    fontWeight: 900,
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    cursor: "pointer",
                  }}
                >
                  {whatsappIcon()}
                  RICORDA
                </button>
              </div>
            );
          })
        )}
      </div>

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
