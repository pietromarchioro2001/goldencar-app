"use client";



import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import BottomBar from "@/components/BottomBar";
import { supabase } from "@/lib/supabase";



type ProdottoOrdine = {

  name: string;

  quantity?: string;

  details?: string;

};



type Ordine = {

  id: string;

  numero: string;

  createdAt: string;

  jobId?: string;

  vehicleId?: string;

  cliente?: string;

  telefono?: string;

  targa?: string;

  veicolo?: string;

  prodotti: ProdottoOrdine[];

  supplierId?: string;

  supplierName?: string;

  supplierPhone?: string;

};



type Fornitore = {

  id: string;

  nome: string;

  whatsapp: string;

};



type Veicolo = {

  id?: string;

  cliente1?: {
    nome?: string;
    cognome?: string;
    telefono?: string;
    cf?: string;
  };

  veicolo?: { veicolo?: string; targa?: string };

};



type ContextOrdine = {

  nomeCliente?: string;

  telefono?: string;

  vehicleId?: string;

  jobId?: string;

  veicolo?: string;

  targa?: string;

};



export default function OrdiniPage() {

  const [ordini, setOrdini] = useState<Ordine[]>([]);

  const [fornitori, setFornitori] = useState<Fornitore[]>([]);

  const [veicoli, setVeicoli] = useState<Veicolo[]>([]);

  const [nuovoAperto, setNuovoAperto] = useState(false);

  const [rubricaAperta, setRubricaAperta] = useState(false);

  const [context, setContext] = useState<ContextOrdine | null>(null);

  const [veicoloSelezionato, setVeicoloSelezionato] = useState<Veicolo | null>(null);
  const [ricercaVeicolo, setRicercaVeicolo] = useState("");

  const [descrizione, setDescrizione] = useState("");

  const [fornitoreId, setFornitoreId] = useState("");

  const [nuovoFornitore, setNuovoFornitore] = useState("");

  const [nuovoWhatsApp, setNuovoWhatsApp] = useState("");

  const [listening, setListening] = useState(false);

  const recognitionRef = useRef<{ stop: () => void } | null>(null);



  useEffect(() => {

    void carica();

    const rawContext = sessionStorage.getItem("goldencar_nuovo_ordine");

    if (rawContext === "1") {
      sessionStorage.removeItem("goldencar_nuovo_ordine");
      setContext(null);
      setVeicoloSelezionato(null);
      setNuovoAperto(true);
    } else if (rawContext) {
      try {
        setContext(JSON.parse(rawContext));
      } catch {
        setContext(null);
      }
      sessionStorage.removeItem("goldencar_nuovo_ordine");
      setNuovoAperto(true);
    }

  }, []);



  useEffect(() => {
    if (!context?.vehicleId || veicoloSelezionato || veicoli.length === 0) return;

    const vehicle = veicoli.find(
      (item) => String(item.id) === String(context.vehicleId)
    );

    if (vehicle) {
      setVeicoloSelezionato(vehicle);
    }
  }, [context, veicoli, veicoloSelezionato]);

  const apriDaHome = () => {
    if (sessionStorage.getItem("goldencar_nuovo_ordine") === "1") {
      sessionStorage.removeItem("goldencar_nuovo_ordine");
      sessionStorage.removeItem("goldencar_nuovo_ordine");
      setContext(null);
      setVeicoloSelezionato(null);
      setNuovoAperto(true);
    }
    if (sessionStorage.getItem("goldencar_rubrica_fornitori") === "1") {
      sessionStorage.removeItem("goldencar_rubrica_fornitori");
      setRubricaAperta(true);
    }
  };

  const valorNormalizzatoOrdini = (value: string) =>
    value.replace(/[^a-z0-9]/gi, "").toLowerCase();

  const carica = async () => {
    try {
      const [
        { data: orderRows, error: ordersError },
        { data: supplierRows, error: suppliersError },
        { data: vehicles, error: vehiclesError },
      ] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("suppliers").select("*").order("nome", { ascending: true }),
        supabase.from("vehicles").select("id, client_id, veicolo, motore, targa, immatricolazione, revisione"),
      ]);

      if (ordersError) throw new Error("Caricamento ordini fallito: " + ordersError.message);
      if (suppliersError) throw new Error("Caricamento fornitori fallito: " + suppliersError.message);
      if (vehiclesError) throw new Error("Caricamento veicoli fallito: " + vehiclesError.message);

      const { data: clients, error: clientsError } = await supabase
        .from("clients")
        .select("*");

      if (clientsError) console.error("Errore Supabase clients:", clientsError);

      const { data: relations, error: relationsError } = await supabase
        .from("vehicle_clients")
        .select("vehicle_id, client_id, ruolo");

      if (relationsError) console.error("Errore Supabase vehicle_clients:", relationsError);

      const clientsById = new Map(
        (clients ?? []).map((client: any) => [String(client.id), client])
      );
      const relationsByVehicle = new Map<string, any[]>();

      for (const relation of relations ?? []) {
        const key = String(relation.vehicle_id);
        const list = relationsByVehicle.get(key) ?? [];
        list.push(relation);
        relationsByVehicle.set(key, list);
      }

      const normalizzaClienteOrdine = (item: any) => ({
        nome: String(item?.nome ?? ""),
        cognome: String(item?.cognome ?? ""),
        telefono: String(item?.telefono ?? ""),
        cf: String(item?.codice_fiscale ?? ""),
      });

      setVeicoli((vehicles ?? []).map((vehicle: any) => {
        const relationsForVehicle = relationsByVehicle.get(String(vehicle.id)) ?? [];
        const primaryRelation =
          relationsForVehicle.find((item) => item.ruolo === "PRINCIPALE") ??
          relationsForVehicle[0];
        const primaryClientId =
          primaryRelation?.client_id ?? vehicle.client_id ?? null;
        const secondRelation = relationsForVehicle.find(
          (item) =>
            item.ruolo === "SECONDO" &&
            String(item.client_id) !== String(primaryClientId)
        );

        return {
          id: String(vehicle.id),
          cliente1: normalizzaClienteOrdine(clientsById.get(String(primaryClientId))),
          cliente2: secondRelation
            ? normalizzaClienteOrdine(clientsById.get(String(secondRelation.client_id)))
            : null,
          veicolo: {
            veicolo: String(vehicle.veicolo ?? ""),
            motore: String(vehicle.motore ?? ""),
            targa: String(vehicle.targa ?? ""),
            immatricolazione: String(vehicle.immatricolazione ?? ""),
            revisione: String(vehicle.revisione ?? ""),
          },
        };
      }));

      setFornitori((supplierRows ?? []).map((row: any) => ({
        id: String(row.id),
        nome: String(row.nome ?? ""),
        whatsapp: String(row.whatsapp ?? ""),
      })));

      setOrdini((orderRows ?? []).map((row: any) => {
        const supplier = suppliersById.get(String(row.supplier_id));
        return {
          id: String(row.id),
          numero: String(row.numero ?? ""),
          createdAt: String(row.created_at ?? ""),
          jobId: row.job_id ? String(row.job_id) : undefined,
          vehicleId: row.vehicle_id ? String(row.vehicle_id) : undefined,
          cliente: String(row.cliente ?? ""),
          telefono: String(row.telefono ?? ""),
          targa: String(row.targa ?? ""),
          veicolo: String(row.veicolo ?? ""),
          prodotti: Array.isArray(row.prodotti) ? row.prodotti : [],
          supplierId: row.supplier_id ? String(row.supplier_id) : undefined,
          supplierName: supplier?.nome ? String(supplier.nome) : undefined,
          supplierPhone: supplier?.whatsapp ? String(supplier.whatsapp) : undefined,
        };
      }));
    } catch (error) {
      console.error("Errore caricamento Ordini:", error);
      setOrdini([]);
      setFornitori([]);
      setVeicoli([]);
    }
  };

  const resetNuovo = () => {

    setNuovoAperto(false);

    setContext(null);

    setVeicoloSelezionato(null);

    setDescrizione("");

    setFornitoreId("");

  };



  const apriNuovo = () => {

    setContext(null);

    setVeicoloSelezionato(null);

    setDescrizione("");

    setFornitoreId("");

    setNuovoAperto(true);

  };



  const cliente = context?.nomeCliente || veicoloSelezionato?.cliente1?.nome || "";

  const telefono = context?.telefono || veicoloSelezionato?.cliente1?.telefono || "";

  const veicolo = context?.veicolo || veicoloSelezionato?.veicolo?.veicolo || "";

  const targa = context?.targa || veicoloSelezionato?.veicolo?.targa || "";



  const avviaDettatura = () => {

    if (listening) {

      recognitionRef.current?.stop();

      setListening(false);

      return;

    }



    const Recognition = (

      window as Window & {

        SpeechRecognition?: new () => any;

        webkitSpeechRecognition?: new () => any;

      }

    ).SpeechRecognition ||

      (

        window as Window & {

          webkitSpeechRecognition?: new () => any;

        }

      ).webkitSpeechRecognition;



    if (!Recognition) {

      alert("La dettatura vocale non è disponibile in questo browser.");

      return;

    }



    const recognition = new Recognition();

    recognition.lang = "it-IT";

    recognition.interimResults = false;

    recognition.continuous = false;



    recognition.onresult = (event) => {

      const transcript = event.results[0]?.[0]?.transcript?.trim() || "";

      if (transcript) {

        setDescrizione((current) =>

          current ? `${current} ${transcript}` : transcript

        );

      }

    };

    recognition.onerror = () => setListening(false);

    recognition.onend = () => setListening(false);



    recognitionRef.current = recognition;

    setListening(true);

    recognition.start();

  };



  const creaOrdine = async () => {
    if (!descrizione.trim()) {
      alert("Inserisci cosa devo ordinare.");
      return;
    }

    const selectedVehicleId = context?.vehicleId || veicoloSelezionato?.id || null;
    if (!selectedVehicleId || !veicolo || !targa) {
      alert("Seleziona prima il veicolo.");
      return;
    }

    if (!fornitoreId) {
      alert("Seleziona prima un fornitore.");
      return;
    }

    const supplier = fornitori.find((item) => item.id === fornitoreId);
    if (!supplier?.whatsapp) {
      alert("Il fornitore selezionato non ha un numero WhatsApp.");
      return;
    }

    const prodotti = [{ name: descrizione.trim(), quantity: "1", details: "" }];
    const id = "ordine-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

    const { data, error } = await supabase.from("orders").insert({
      id,
      job_id: context?.jobId || null,
      vehicle_id: selectedVehicleId,
      supplier_id: supplier.id,
      cliente,
      telefono,
      veicolo,
      targa,
      prodotti,
    }).select("*").single();

    if (error) {
      console.error("Errore creazione ordine:", error);
      alert("Non è stato possibile creare l'ordine: " + error.message);
      return;
    }

    const ordine: Ordine = {
      id: String(data.id),
      numero: String(data.numero ?? ""),
      createdAt: String(data.created_at ?? new Date().toISOString()),
      jobId: data.job_id ? String(data.job_id) : undefined,
      vehicleId: data.vehicle_id ? String(data.vehicle_id) : undefined,
      cliente,
      telefono,
      veicolo,
      targa,
      prodotti,
      supplierId: supplier.id,
      supplierName: supplier.nome,
      supplierPhone: supplier.whatsapp,
    };

    setOrdini((current) => [ordine, ...current]);

    const numero = supplier.whatsapp.replace(/\D/g, "");
    const messaggio = "Ciao, per la targa " + targa + " e il veicolo " + veicolo +
      " mi servirebbe: " + descrizione.trim();

    window.open("https://wa.me/" + numero + "?text=" + encodeURIComponent(messaggio), "_blank", "noopener,noreferrer");
    resetNuovo();
  };

  const aggiungiFornitore = async () => {
    if (!nuovoFornitore.trim() || !nuovoWhatsApp.trim()) {
      alert("Inserisci nome e numero WhatsApp.");
      return;
    }

    const fornitore: Fornitore = {
      id: `fornitore-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      nome: nuovoFornitore.trim(),
      whatsapp: nuovoWhatsApp.replace(/[^\d+]/g, ""),
    };

    const { error } = await supabase.from("suppliers").insert(fornitore);
    if (error) {
      console.error("Errore salvataggio fornitore:", error);
      alert("Non è stato possibile salvare il fornitore: " + error.message);
      return;
    }

    setFornitori((current) => [...current, fornitore].sort((a, b) => a.nome.localeCompare(b.nome)));
    setNuovoFornitore("");
    setNuovoWhatsApp("");
  };

  const assegnaFornitore = async (ordineId: string, id: string) => {
    const supplier = fornitori.find((item) => item.id === id);
    if (!supplier) return;

    const { error } = await supabase.from("orders").update({
      supplier_id: supplier.id,
    }).eq("id", ordineId);

    if (error) {
      console.error("Errore assegnazione fornitore:", error);
      alert("Non è stato possibile assegnare il fornitore: " + error.message);
      return;
    }

    setOrdini((current) => current.map((ordine) =>
      ordine.id === ordineId
        ? { ...ordine, supplierId: supplier.id, supplierName: supplier.nome, supplierPhone: supplier.whatsapp }
        : ordine
    ));
  };

  const inviaWhatsApp = (ordine: Ordine) => {

    if (!ordine.supplierPhone) {

      alert("Seleziona prima un fornitore.");

      return;

    }



    const prodotti = ordine.prodotti

      .map((product) => {

        const dettagli = product.details ? ` — ${product.details}` : "";

        return `${product.quantity || "1"} × ${product.name}${dettagli}`;

      })

      .join("\n");



    const messaggio = `Ciao, per ${ordine.veicolo || "il veicolo"}${ordine.targa ? ` ${ordine.targa}` : ""} mi servono:\n${prodotti}`;

    const numero = ordine.supplierPhone.replace(/\D/g, "");

    window.open(

      `https://wa.me/${numero}?text=${encodeURIComponent(messaggio)}`,

      "_blank",

      "noopener,noreferrer"

    );

  };



  const ordiniOrdinati = useMemo(

    () =>

      [...ordini].sort(

        (a, b) =>

          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()

      ),

    [ordini]

  );



  return (

    <main

      className="app"

      style={{

        minHeight: "100vh",

        paddingBottom: 90,

        background: "#F3F4F6",

      }}

    >

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "28px 22px 18px",
        }}
      >
        <div
          style={{
            width: 74,
            height: 74,
            borderRadius: 22,
            background: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,.08)",
            fontSize: 13,
            fontWeight: 700,
            color: "#9CA3AF",
            flexShrink: 0,
          }}
        >
          LOGO
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
          ORDINI
        </h1>
      </div>

      <div
        style={{
          padding: "0 22px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#6B7280",
          }}
        >
          {ordini.length} {ordini.length === 1 ? "ordine" : "ordini"}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setRubricaAperta(true)}
            style={smallActionStyle}
          >
            RUBRICA
          </button>

          <button
            type="button"
            onClick={apriNuovo}
            style={{
              width: 52,
              height: 52,
              border: "none",
              borderRadius: 18,
              background: "#D4AF37",
              boxShadow: "0 4px 12px rgba(0,0,0,.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#041E49",
              fontSize: 28,
              lineHeight: 1,
            }}
            aria-label="Nuovo ordine"
          >
            +
          </button>
        </div>
      </div>

      <section style={{ padding: "8px 18px 20px" }}>

        {ordiniOrdinati.length === 0 ? (

          <div style={emptyStyle}>

            <div style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>

              Nessun ordine

            </div>

            <div style={{ marginTop: 5, color: "#64748B", fontSize: 13 }}>

              Gli ordini creati dalle schede lavoro compariranno qui.

            </div>

          </div>

        ) : (

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

            {ordiniOrdinati.map((ordine) => (

              <div key={ordine.id} style={cardStyle}>

                <div

                  style={{

                    display: "flex",

                    justifyContent: "space-between",

                    alignItems: "flex-start",

                    gap: 10,

                  }}

                >

                  <div style={{ minWidth: 0 }}>

                    <div

                      style={{

                        fontSize: 12,

                        fontWeight: 900,

                        color: "#A16207",

                        letterSpacing: "0.04em",

                      }}

                    >

                      ORDINE {ordine.numero}

                    </div>

                    <div

                      style={{

                        marginTop: 4,

                        fontSize: 16,

                        fontWeight: 900,

                        color: "#111827",

                      }}

                    >

                      {ordine.veicolo || "Veicolo"}

                    </div>

                    <div

                      style={{

                        marginTop: 2,

                        fontSize: 13,

                        color: "#64748B",

                        fontWeight: 700,

                      }}

                    >

                      {ordine.targa || "—"} · {ordine.cliente || "Cliente"}

                    </div>

                  </div>

                  {ordine.jobId && (

                    <div

                      style={{

                        padding: "6px 8px",

                        borderRadius: 10,

                        background: "#F1F5F9",

                        color: "#64748B",

                        fontSize: 11,

                        fontWeight: 900,

                        whiteSpace: "nowrap",

                      }}

                    >

                      SCHEDA #{ordine.jobId}

                    </div>

                  )}

                </div>



                <div

                  style={{

                    marginTop: 13,

                    padding: "11px 12px",

                    borderRadius: 14,

                    background: "#F8FAFC",

                    display: "flex",

                    flexDirection: "column",

                    gap: 5,

                  }}

                >

                  {ordine.prodotti.map((product, index) => (

                    <div

                      key={`${ordine.id}-${index}`}

                      style={{

                        fontSize: 13,

                        color: "#334155",

                        fontWeight: 700,

                      }}

                    >

                      <strong>{product.quantity || "1"} ×</strong>{" "}

                      {product.name}

                      {product.details ? ` — ${product.details}` : ""}

                    </div>

                  ))}

                </div>



                <div

                  style={{

                    display: "grid",

                    gridTemplateColumns: "minmax(0,1fr) auto",

                    gap: 8,

                    marginTop: 11,

                  }}

                >

                  <select

                    value={ordine.supplierId || ""}

                    onChange={(event) =>

                      assegnaFornitore(ordine.id, event.target.value)

                    }

                    style={{

                      width: "100%",

                      minWidth: 0,

                      border: "1px solid #E5E7EB",

                      borderRadius: 13,

                      padding: "11px 10px",

                      background: "#FFFFFF",

                      color: "#334155",

                      fontSize: 13,

                      fontWeight: 700,

                      outline: "none",

                    }}

                  >

                    <option value="">Seleziona fornitore</option>

                    {fornitori.map((fornitore) => (

                      <option key={fornitore.id} value={fornitore.id}>

                        {fornitore.nome}

                      </option>

                    ))}

                  </select>



                  <button

                    type="button"

                    onClick={() => inviaWhatsApp(ordine)}

                    style={{

                      border: 0,

                      borderRadius: 13,

                      padding: "0 13px",

                      background: "#16A34A",

                      color: "#FFFFFF",

                      fontSize: 11,

                      fontWeight: 900,

                    }}

                  >

                    WHATSAPP

                  </button>

                </div>

              </div>

            ))}

          </div>

        )}

      </section>



      {nuovoAperto && (

        <Overlay title="NUOVO ORDINE" onClose={resetNuovo}>

          {context ? (

            <div style={linkedVehicleStyle}>

              <div style={{ fontSize: 11, fontWeight: 900, color: "#A16207" }}>

                VEICOLO COLLEGATO

              </div>

              <div style={{ marginTop: 5, fontSize: 16, fontWeight: 900 }}>

                {veicolo || "Veicolo"}

              </div>

              <div style={{ marginTop: 2, fontSize: 13, color: "#64748B" }}>

                {targa || "—"} · {cliente || "Cliente"}

              </div>

            </div>

          ) : (

            <>

              <div style={labelStyle}>CERCA VEICOLO</div>

              <div style={{ position: "relative" }}>
                <input
                  value={ricercaVeicolo}
                  onChange={(event) => setRicercaVeicolo(event.target.value)}
                  placeholder="Targa, cliente o telefono"
                  style={inputStyle}
                  autoFocus
                />

                {ricercaVeicolo.trim() && !veicoloSelezionato && (
                  <div
                    style={{
                      position: "relative",
                      zIndex: 20,
                      marginTop: 8,
                      borderRadius: 18,
                      background: "#FFFFFF",
                      boxShadow: "0 8px 24px rgba(15,23,42,.14)",
                      overflow: "hidden",
                      border: "1px solid #E5E7EB",
                      maxHeight: 230,
                      overflowY: "auto",
                    }}
                  >
                    {veicoli
                      .filter((item) => {
                        const valore = ricercaVeicolo.trim().toLowerCase();
                        if (!valore) return false;

                        const queryNormalizzata = valorNormalizzatoOrdini(valore);

                        const valoriRicerca = [
                          item.veicolo?.targa,
                          item.veicolo?.veicolo,
                          item.veicolo?.motore,
                          item.cliente1?.nome,
                          item.cliente1?.cognome,
                          item.cliente1?.telefono,
                          item.cliente1?.cf,
                          item.cliente2?.nome,
                          item.cliente2?.cognome,
                          item.cliente2?.telefono,
                          item.cliente2?.cf,
                        ]
                          .filter(Boolean)
                          .map((value) => String(value).toLowerCase());

                        return valoriRicerca.some(
                          (value) =>
                            value.includes(valore) ||
                            valorNormalizzatoOrdini(value).includes(queryNormalizzata)
                        );
                      })
                      .slice(0, 20)
                      .map((item, index, risultati) => (
                        <button
                          key={String(item.id || index)}
                          type="button"
                          onClick={() => {
                            setVeicoloSelezionato(item);
                            setRicercaVeicolo("");
                          }}
                          style={{
                            width: "100%",
                            border: "none",
                            borderBottom:
                              index < risultati.length - 1
                                ? "1px solid #E5E7EB"
                                : "none",
                            background: "#FFFFFF",
                            padding: "13px 15px",
                            textAlign: "left",
                            cursor: "pointer",
                          }}
                        >
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr auto",
                              gap: 12,
                              alignItems: "center",
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 14,
                                  fontWeight: 900,
                                  color: "#111827",
                                }}
                              >
                                {item.veicolo?.veicolo || "Veicolo"}
                              </div>
                              <div
                                style={{
                                  marginTop: 3,
                                  fontSize: 12,
                                  color: "#64748B",
                                }}
                              >
                                {item.veicolo?.targa || "—"} ·{" "}
                                {item.cliente1?.nome || "Cliente"}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}

                    {veicoli.filter((item) => {
                      const valore = ricercaVeicolo.trim().toLowerCase();
                      if (!valore) return false;

                      const queryNormalizzata = valorNormalizzatoOrdini(valore);

                      const valoriRicerca = [
                        item.veicolo?.targa,
                        item.veicolo?.veicolo,
                        item.veicolo?.motore,
                        item.cliente1?.nome,
                        item.cliente1?.cognome,
                        item.cliente1?.telefono,
                        item.cliente1?.cf,
                        item.cliente2?.nome,
                        item.cliente2?.cognome,
                        item.cliente2?.telefono,
                        item.cliente2?.cf,
                      ]
                        .filter(Boolean)
                        .map((value) => String(value).toLowerCase());

                      return valoriRicerca.some(
                        (value) =>
                          value.includes(valore) ||
                          valorNormalizzatoOrdini(value).includes(queryNormalizzata)
                      );
                    }).length === 0 && (
                      <div
                        style={{
                          padding: "16px 15px",
                          fontSize: 13,
                          color: "#64748B",
                          fontWeight: 700,
                        }}
                      >
                        Nessun veicolo trovato.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {veicoloSelezionato && (
                <div style={{ ...linkedVehicleStyle, marginTop: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 900 }}>
                        {veicoloSelezionato.veicolo?.veicolo || "Veicolo"}
                      </div>
                      <div style={{ marginTop: 3, fontSize: 13, color: "#64748B" }}>
                        {veicoloSelezionato.veicolo?.targa || "—"} · {veicoloSelezionato.cliente1?.nome || "Cliente"}
                      </div>
                    </div>
                    <button type="button" onClick={() => setVeicoloSelezionato(null)}
                      style={{ border: 0, background: "transparent", color: "#64748B", fontSize: 12, fontWeight: 900, cursor: "pointer" }}>
                      CAMBIA
                    </button>
                  </div>
                </div>
              )}

            </>

          )}



          <div style={labelStyle}>COSA DEVO ORDINARE?</div>

          <div style={{ position: "relative" }}>

            <textarea

              value={descrizione}

              onChange={(event) => setDescrizione(event.target.value)}

              placeholder="Es. Pastiglie anteriori Brembo + dischi anteriori"

              rows={4}

              style={{

                ...inputStyle,

                fontFamily: "Arial, sans-serif",
                fontSize: 16,
                resize: "vertical",
                paddingRight: 52,
              }}

            />

            <button

              type="button"

              onClick={avviaDettatura}

              title="Dettatura vocale"

              style={{

                position: "absolute",

                right: 9,

                bottom: 9,

                width: 36,

                height: 36,

                border: 0,

                borderRadius: 11,

                background: listening ? "#FEE2E2" : "#F1F5F9",

                color: listening ? "#DC2626" : "#111827",

                display: "flex",

                alignItems: "center",

                justifyContent: "center",

              }}

            >

              <MicIcon active={listening} />

            </button>

          </div>



          <div style={labelStyle}>FORNITORE</div>

          <select

            value={fornitoreId}

            onChange={(event) => setFornitoreId(event.target.value)}

            style={inputStyle}

          >

            <option value="">Seleziona fornitore</option>

            {fornitori.map((fornitore) => (

              <option key={fornitore.id} value={fornitore.id}>

                {fornitore.nome}

              </option>

            ))}

          </select>



          <button type="button" onClick={creaOrdine} style={saveButtonStyle}>INVIA</button>

        </Overlay>

      )}



      {rubricaAperta && (

        <Overlay title="RUBRICA FORNITORI" onClose={() => setRubricaAperta(false)}>

          {fornitori.length > 0 && (

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

              {fornitori.map((fornitore) => (

                <div key={fornitore.id} style={supplierRowStyle}>

                  <div style={{ minWidth: 0 }}>

                    <div style={{ fontWeight: 900, color: "#111827" }}>

                      {fornitore.nome}

                    </div>

                    <div style={{ marginTop: 2, fontSize: 12, color: "#64748B" }}>

                      {fornitore.whatsapp}

                    </div>

                  </div>

                  <button

                    type="button"

                    onClick={() =>

                      window.open(

                        `https://wa.me/${fornitore.whatsapp.replace(/\D/g, "")}`,

                        "_blank",

                        "noopener,noreferrer"

                      )

                    }

                    style={{

                      border: 0,

                      borderRadius: 11,

                      padding: "9px 10px",

                      background: "#16A34A",

                      color: "#FFFFFF",

                      fontSize: 10,

                      fontWeight: 900,

                    }}

                  >

                    WHATSAPP

                  </button>

                </div>

              ))}

            </div>

          )}



          {fornitori.length === 0 && (

            <div style={{ ...emptyStyle, marginBottom: 12 }}>

              Nessun fornitore in rubrica.

            </div>

          )}



          <div style={labelStyle}>NUOVO FORNITORE</div>

          <input

            value={nuovoFornitore}

            onChange={(event) => setNuovoFornitore(event.target.value)}

            placeholder="Nome fornitore"

            style={inputStyle}

          />

          <input

            value={nuovoWhatsApp}

            onChange={(event) => setNuovoWhatsApp(event.target.value)}

            placeholder="Numero WhatsApp"

            inputMode="tel"

            style={{ ...inputStyle, marginTop: 8 }}

          />

          <button type="button" onClick={aggiungiFornitore} style={saveButtonStyle}>

            AGGIUNGI FORNITORE

          </button>

        </Overlay>

      )}



      <BottomBar />

    </main>

  );

}



const inputStyle: CSSProperties = {

  width: "100%",

  boxSizing: "border-box",

  border: "1px solid #E5E7EB",

  borderRadius: 14,

  padding: "13px 14px",

  fontSize: 15,

  background: "#FFFFFF",

  color: "#111827",

  outline: "none",

};



const labelStyle: CSSProperties = {

  fontSize: 11,

  fontWeight: 900,

  color: "#64748B",

  marginTop: 14,

  marginBottom: 6,

  letterSpacing: "0.04em",

};



const saveButtonStyle: CSSProperties = {

  width: "100%",

  height: 50,

  border: 0,

  borderRadius: 16,

  background: "#D4AF37",

  color: "#111827",

  fontWeight: 900,

  marginTop: 16,

};



const smallActionStyle: CSSProperties = {

  height: 44,

  border: 0,

  borderRadius: 14,

  background: "#FFFFFF",

  color: "#475569",

  fontSize: 10,

  fontWeight: 900,

  padding: "0 13px",

  boxShadow: "0 3px 12px rgba(15,23,42,.06)",

};



const cardStyle: CSSProperties = {

  background: "#FFFFFF",

  borderRadius: 22,

  padding: 15,

  boxShadow: "0 4px 14px rgba(15,23,42,.07)",

};



const emptyStyle: CSSProperties = {

  background: "#FFFFFF",

  borderRadius: 20,

  padding: "24px 16px",

  textAlign: "center",

  color: "#64748B",

  fontSize: 13,

  fontWeight: 700,

};



const linkedVehicleStyle: CSSProperties = {

  background: "#FFF8DB",

  border: "1px solid #E8D17A",

  borderRadius: 16,

  padding: 13,

};



const supplierRowStyle: CSSProperties = {

  background: "#FFFFFF",

  border: "1px solid #E5E7EB",

  borderRadius: 15,

  padding: 12,

  display: "flex",

  alignItems: "center",

  justifyContent: "space-between",

  gap: 10,

};



function Overlay({

  title,

  children,

  onClose,

}: {

  title: string;

  children: React.ReactNode;

  onClose: () => void;

}) {

  return (

    <div

      onClick={onClose}

      style={{

        position: "fixed",

        inset: 0,

        zIndex: 1000,

        background: "rgba(15,23,42,.45)",

        display: "flex",

        alignItems: "center",

        justifyContent: "center",

        padding: 18,

      }}

    >

      <div

        onClick={(event) => event.stopPropagation()}

        style={{

          width: "100%",

          maxWidth: 520,

          maxHeight: "86vh",

          overflowY: "auto",

          background: "#F3F4F6",

          borderRadius: 26,

          padding: "20px 16px 22px",

          boxSizing: "border-box",

        }}

      >

        <div

          style={{

            display: "flex",

            alignItems: "center",

            justifyContent: "space-between",

            gap: 10,

            marginBottom: 15,

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

          <button

            type="button"

            onClick={onClose}

            style={{

              width: 34,

              height: 34,

              border: 0,

              borderRadius: 11,

              background: "#E5E7EB",

              color: "#111827",

              fontSize: 20,

            }}

          >

            ×

          </button>

        </div>

        {children}

      </div>

    </div>

  );

}



function MicIcon({ active = false }: { active?: boolean }) {

  return (

    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">

      <rect

        x="8"

        y="3"

        width="8"

        height="12"

        rx="4"

        stroke={active ? "#DC2626" : "#111827"}

        strokeWidth="2"

      />

      <path

        d="M5 11A7 7 0 0 0 19 11M12 18V21M9 21H15"

        stroke={active ? "#DC2626" : "#111827"}

        strokeWidth="2"

        strokeLinecap="round"

      />

    </svg>

  );

}
