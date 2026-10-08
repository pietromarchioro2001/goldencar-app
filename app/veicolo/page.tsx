"use client";



import { useEffect, useState, type ReactNode, type CSSProperties } from "react";



import { useRouter } from "next/navigation";



import BottomBar from "@/components/BottomBar";
import { supabase } from "@/lib/supabase";



type ClienteData = {



  nome: string; cognome: string; luogoNascita: string; provinciaNascita: string;



  indirizzo: string; telefono: string; nascita: string; cf: string;



};



type ClienteSelezionato = 1 | 2;

type ProfiloVeicolo = {
  id: string;
  cliente1: ClienteData;
  cliente1Id?: string;
  cliente2: ClienteData | null;
  cliente2Id?: string;
  veicolo: {
    veicolo: string;
    motore: string;
    targa: string;
    immatricolazione: string;
    revisione: string;
  };
};



type MediaAttachment = {



  id: string;



  name: string;



  type: string;



  size: number;



  createdAt: string;
  source?: "job" | "vehicle";
  r2Key?: string;
};



type LavoroSalvato = {



  jobNumber: number;



  createdAt: string;



  nomeCliente?: string;



  indirizzo?: string;



  telefono?: string;



  codiceFiscale?: string;



  veicolo?: string;



  targa?: string;



  kilometers?: string;



  types?: string[];



  works?: string;



  status?: "IN_LAVORAZIONE" | "CONCLUSO";



  invoiceNumber?: string;



  pdfUrl?: string;
  pdfR2Key?: string;



  media?: MediaAttachment[];



};



const MEDIA_DB_NAME = "goldencar_media";



const MEDIA_STORE_NAME = "files";



function openMediaDb(): Promise<IDBDatabase> {



  return new Promise((resolve, reject) => {



    const request = indexedDB.open(MEDIA_DB_NAME, 1);



    request.onupgradeneeded = () => {



      const db = request.result;



      if (!db.objectStoreNames.contains(MEDIA_STORE_NAME)) {



        db.createObjectStore(MEDIA_STORE_NAME);



      }



    };



    request.onsuccess = () => resolve(request.result);



    request.onerror = () => reject(request.error);



  });



}



async function loadMediaBlob(id: string): Promise<Blob | null> {



  const db = await openMediaDb();



  return new Promise((resolve) => {



    const tx = db.transaction(MEDIA_STORE_NAME, "readonly");



    const request = tx.objectStore(MEDIA_STORE_NAME).get(id);



    request.onsuccess = () => {



      const blob = request.result as Blob | undefined;



      db.close();



      resolve(blob || null);



    };



    request.onerror = () => {



      db.close();



      resolve(null);



    };



  });



}



async function deleteMediaBlob(id: string) {



  const db = await openMediaDb();



  await new Promise<void>((resolve, reject) => {



    const tx = db.transaction(MEDIA_STORE_NAME, "readwrite");



    tx.objectStore(MEDIA_STORE_NAME).delete(id);



    tx.oncomplete = () => resolve();



    tx.onerror = () => reject(tx.error);



  });



  db.close();



}



export default function Veicolo() {



  const router = useRouter();



  const [ricerca, setRicerca] = useState("");
  const [veicoloSelezionato, setVeicoloSelezionato] = useState(false);



  const [lavori, setLavori] = useState<LavoroSalvato[]>([]);



  const [dataRevisione, setDataRevisione] = useState("");



  const [mediaAperto, setMediaAperto] = useState(false);



  const [mediaCaricamento, setMediaCaricamento] = useState(false);



  const [mediaItems, setMediaItems] = useState<Array<MediaAttachment & {



    jobNumber: number;



    jobDate: string;



    jobType: string;



    url?: string;



  }>>([]);



  const [mediaVisualizzato, setMediaVisualizzato] = useState<



    (MediaAttachment & {



      jobNumber: number;



      jobDate: string;



      jobType: string;



      url?: string;



    }) | null



  >(null);



  const [profiloVeicolo, setProfiloVeicolo] =
    useState<ProfiloVeicolo | null>(null);

  const [profiliArchivio, setProfiliArchivio] =
    useState<ProfiloVeicolo[]>([]);

  const [modificaProfilo, setModificaProfilo] = useState(false);
  const [salvataggioProfilo, setSalvataggioProfilo] = useState(false);
  const [profiloEdit, setProfiloEdit] = useState<ProfiloVeicolo | null>(null);

  const clienteVuoto: ClienteData = {
    nome: "",
    cognome: "",
    luogoNascita: "",
    provinciaNascita: "",
    indirizzo: "",
    telefono: "",
    nascita: "",
    cf: "",
  };

  const cliente1Profilo = profiloVeicolo?.cliente1 ?? clienteVuoto;
  const cliente2Profilo = profiloVeicolo?.cliente2 ?? null;

  const veicoloProfilo = profiloVeicolo?.veicolo ?? {
    veicolo: "",
    motore: "",
    targa: "",
    immatricolazione: "",
    revisione: "",
  };

  const [clienteSelezionato, setClienteSelezionato] = useState<ClienteSelezionato>(1);



  const [menuClientiAperto, setMenuClientiAperto] = useState(false);



  const clienteVisualizzato =
    clienteSelezionato === 1
      ? cliente1Profilo
      : cliente2Profilo ?? cliente1Profilo;



  const hasCliente2Profilo = Boolean(cliente2Profilo?.nome?.trim());



  const indirizzoMaps = clienteVisualizzato.indirizzo



    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clienteVisualizzato.indirizzo)}`



    : undefined;



  const whatsappHref = clienteVisualizzato.telefono
    ? (() => {
        let numero = clienteVisualizzato.telefono.replace(/\D/g, "");
        if (numero.startsWith("00")) numero = numero.slice(2);
        if (!numero.startsWith("39")) numero = "39" + numero.replace(/^0+/, "");
        return numero.length >= 10 ? `https://wa.me/${numero}` : undefined;
      })()
    : undefined;

  const aggiornaLavori = async () => {
    if (typeof window === "undefined") return;
    if (!profiloVeicolo?.id) { setLavori([]); return; }

    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("vehicle_id", profiloVeicolo.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Errore caricamento lavori Supabase:", error);
      setLavori([]);
      return;
    }

    const risultati: LavoroSalvato[] = (data || []).map((row: any) => {
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

      return {
        jobId: String(row.id),
        vehicleId: String(row.vehicle_id || ""),
        jobNumber,
        createdAt: row.created_at || new Date().toISOString(),
        nomeCliente: details.nomeCliente || "",
        indirizzo: details.indirizzo || "",
        telefono: details.telefono || "",
        codiceFiscale: details.codiceFiscale || "",
        veicolo: details.veicolo || veicoloProfilo.veicolo,
        targa: details.targa || veicoloProfilo.targa,
        kilometers: row.chilometri == null ? "" : String(row.chilometri),
        types: Array.isArray(details.types)
          ? details.types
          : row.tipo ? String(row.tipo).split(" · ").filter(Boolean) : [],
        works: row.lavori || "",
        status: String(row.stato || "").toUpperCase() === "CONCLUSO" ||
          String(row.stato || "").toUpperCase() === "CHIUSO"
          ? "CONCLUSO" : "IN_LAVORAZIONE",
        invoiceNumber: row.fattura || "",
        pdfUrl: details.pdfUrl || "",
        pdfR2Key: details.pdfR2Key || "",
        media: Array.isArray(details.media) ? details.media : [],
      };
    });

    setLavori(risultati);
  };

  useEffect(() => {
    void aggiornaLavori();
    const onStorage = () => { void aggiornaLavori(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onStorage);
    };
  }, [profiloVeicolo?.id, veicoloProfilo.targa]);

  const aggiornaRevisione = () => {
    // La revisione del veicolo ora arriva direttamente dall'archivio Supabase.
    // Manteniamo il dato locale solo come fallback per le vecchie revisioni.
    if (veicoloProfilo.revisione.trim()) {
      setDataRevisione(veicoloProfilo.revisione.trim());
      return;
    }

    if (typeof window === "undefined") return;

    const targaVeicolo = veicoloProfilo.targa.trim().toUpperCase();

    try {
      const raw = localStorage.getItem("goldencar_revisions");
      const revisioni = raw ? JSON.parse(raw) : [];

      if (!Array.isArray(revisioni)) {
        setDataRevisione("");
        return;
      }

      const revisione = revisioni.find(
        (item: any) =>
          String(item?.targa || "").trim().toUpperCase() === targaVeicolo
      );

      setDataRevisione(
        String(revisione?.scadenza || revisione?.revisione || "")
      );
    } catch {
      setDataRevisione("");
    }
  };

  useEffect(() => {



    aggiornaRevisione();



    const onRevisioniChange = () => aggiornaRevisione();



    window.addEventListener("storage", onRevisioniChange);



    window.addEventListener("focus", onRevisioniChange);



    return () => {



      window.removeEventListener("storage", onRevisioniChange);



      window.removeEventListener("focus", onRevisioniChange);



    };



  }, [veicoloProfilo.targa]);



  const valorNormalizzato = (value: string) =>
    value.replace(/[^a-z0-9]/gi, "").toLowerCase();

  const normalizzaCliente = (item: any): ClienteData => ({
    nome: String(item?.nome ?? ""),
    cognome: String(item?.cognome ?? ""),
    luogoNascita: String(item?.luogo_nascita ?? item?.luogoNascita ?? ""),
    provinciaNascita: String(item?.provincia_nascita ?? item?.provinciaNascita ?? ""),
    indirizzo: String(item?.indirizzo ?? ""),
    telefono: String(item?.telefono ?? ""),
    nascita: String(item?.nascita ?? item?.data_nascita ?? ""),
    cf: String(item?.cf ?? item?.codice_fiscale ?? ""),
  });

  const caricaProfiliSupabase = async () => {
    try {
      // Carichiamo prima i veicoli: la ricerca deve funzionare anche se
      // una delle tabelle collegate ha un problema di RLS.
      const { data: vehicles, error: vehiclesError } = await supabase
        .from("vehicles")
        .select("id, client_id, veicolo, motore, targa, immatricolazione, revisione");

      if (vehiclesError) {
        console.error("Errore Supabase vehicles:", vehiclesError);
        throw vehiclesError;
      }

      // Clienti e relazioni vengono caricati separatamente.
      // Se una delle due query fallisce, manteniamo comunque i veicoli.
      const { data: clients, error: clientsError } = await supabase
        .from("clients")
        .select("*");

      if (clientsError) {
        console.error("Errore Supabase clients:", clientsError);
      }

      const clientsById = new Map(
        (clients ?? []).map((client: any) => [String(client.id), client])
      );

      const { data: relations, error: relationsError } = await supabase
        .from("vehicle_clients")
        .select("vehicle_id, client_id, ruolo");

      if (relationsError) {
        console.error("Errore Supabase vehicle_clients:", relationsError);
      }

      const relationsByVehicle = new Map<string, any[]>();

      for (const relation of relations ?? []) {
        const key = String(relation.vehicle_id);
        const list = relationsByVehicle.get(key) ?? [];
        list.push(relation);
        relationsByVehicle.set(key, list);
      }

      const mapped: ProfiloVeicolo[] = (vehicles ?? []).map((vehicle: any) => {
        const relationsForVehicle =
          relationsByVehicle.get(String(vehicle.id)) ?? [];

        const primaryRelation =
          relationsForVehicle.find(
            (item) => item.ruolo === "PRINCIPALE"
          ) ?? relationsForVehicle[0];

        const primaryClientId =
          primaryRelation?.client_id ?? vehicle.client_id ?? null;

        const secondRelation = relationsForVehicle.find(
          (item) =>
            item.ruolo === "SECONDO" &&
            String(item.client_id) !== String(primaryClientId)
        );

        return {
          id: String(vehicle.id),

          cliente1: normalizzaCliente(
            clientsById.get(String(primaryClientId))
          ),
          cliente1Id: primaryClientId ? String(primaryClientId) : undefined,

          cliente2: secondRelation
            ? normalizzaCliente(
                clientsById.get(String(secondRelation.client_id))
              )
            : null,
          cliente2Id: secondRelation?.client_id
            ? String(secondRelation.client_id)
            : undefined,

          veicolo: {
            veicolo: String(vehicle.veicolo ?? ""),
            motore: String(vehicle.motore ?? ""),
            targa: String(vehicle.targa ?? ""),
            immatricolazione: String(vehicle.immatricolazione ?? ""),
            revisione: String(vehicle.revisione ?? ""),
          },
        };
      });

      console.log(
        "GOLDENCAR Supabase: veicoli caricati:",
        mapped.length
      );

      setProfiliArchivio(mapped);
      return mapped;
    } catch (error) {
      console.error("Errore caricamento veicoli da Supabase:", error);
      setProfiliArchivio([]);
      return [];
    }
  };

  useEffect(() => {
    void caricaProfiliSupabase();
  }, []);

  const trovaProfili = (query: string): ProfiloVeicolo[] => {
    if (typeof window === "undefined") return [];

    const valore = query.trim().toLowerCase();
    if (!valore) return [];

    // La ricerca dell'archivio principale usa esclusivamente Supabase.
    // Non usiamo più localStorage come fallback, così eventuali problemi
    // di connessione non mostrano dati vecchi o non presenti nel database.
    const vehicles = profiliArchivio;

    const queryNormalizzata = valorNormalizzato(valore);

    return vehicles.filter((item: any) => {
      const cliente1 = item?.cliente1 ?? {};
      const cliente2 = item?.cliente2 ?? null;
      const veicolo = item?.veicolo ?? {};

      const valoriRicerca = [
        veicolo.targa,
        veicolo.veicolo,
        veicolo.motore,
        cliente1.nome,
        cliente1.cognome,
        cliente2?.nome,
        cliente2?.cognome,
      ];

      return valoriRicerca
        .filter(Boolean)
        .map((value) => String(value).toLowerCase())
        .some((value) =>
          value.includes(valore) ||
          valorNormalizzato(value).includes(queryNormalizzata)
        );
    }) as ProfiloVeicolo[];
  };

  const trovaProfilo = (query: string): ProfiloVeicolo | null =>
    trovaProfili(query)[0] ?? null;

  useEffect(() => {
    if (profiliArchivio.length === 0) return;

    const salvata = sessionStorage.getItem("goldencar_veicolo_ricerca");
    if (!salvata) return;

    const trovato = trovaProfilo(salvata);

    if (trovato) {
      setRicerca(salvata);
      setProfiloVeicolo(trovato);
      setVeicoloSelezionato(true);
      setClienteSelezionato(1);
    } else {
      sessionStorage.removeItem("goldencar_veicolo_ricerca");
    }
  }, [profiliArchivio]);

  const ricercaNormalizzata = ricerca.trim().toLowerCase();

  const risultatiRicerca = ricercaNormalizzata
    ? trovaProfili(ricercaNormalizzata)
    : [];

  const iniziaModificaProfilo = () => {
    if (!profiloVeicolo) return;
    setProfiloEdit(JSON.parse(JSON.stringify(profiloVeicolo)) as ProfiloVeicolo);
    setModificaProfilo(true);
    setMenuClientiAperto(false);
  };

  const annullaModificaProfilo = () => {
    setProfiloEdit(profiloVeicolo ? JSON.parse(JSON.stringify(profiloVeicolo)) as ProfiloVeicolo : null);
    setModificaProfilo(false);
  };

  const aggiornaClienteEdit = (cliente: 1 | 2, field: keyof ClienteData, value: string) => {
    setProfiloEdit((previous) => {
      if (!previous) return previous;
      const key = cliente === 1 ? "cliente1" : "cliente2";
      const current = previous[key] ?? { ...clienteVuoto };
      return { ...previous, [key]: { ...current, [field]: value } };
    });
  };

  const aggiornaVeicoloEdit = (field: keyof ProfiloVeicolo["veicolo"], value: string) => {
    setProfiloEdit((previous) =>
      previous ? { ...previous, veicolo: { ...previous.veicolo, [field]: value } } : previous
    );
  };

  const salvaModificaProfilo = async () => {
    if (!profiloVeicolo || !profiloEdit) return;
    if (!profiloEdit.cliente1Id) {
      alert("Il Cliente 1 non è collegato correttamente al profilo.");
      return;
    }

    setSalvataggioProfilo(true);
    try {
      const cliente1 = profiloEdit.cliente1;
      const cliente2 = profiloEdit.cliente2;

      const { error: client1Error } = await supabase.from("clients").update({
        nome: [cliente1.nome.trim(), cliente1.cognome.trim()].filter(Boolean).join(" "),
        indirizzo: cliente1.indirizzo.trim(),
        telefono: cliente1.telefono.trim(),
        data_nascita: cliente1.nascita.trim() || null,
        codice_fiscale: cliente1.cf.trim().toUpperCase(),
      }).eq("id", profiloEdit.cliente1Id);

      if (client1Error) throw new Error("Salvataggio Cliente 1 fallito: " + client1Error.message);

      if (cliente2 && profiloEdit.cliente2Id) {
        const { error: client2Error } = await supabase.from("clients").update({
          nome: [cliente2.nome.trim(), cliente2.cognome.trim()].filter(Boolean).join(" "),
          indirizzo: cliente2.indirizzo.trim(),
          telefono: cliente2.telefono.trim(),
          data_nascita: cliente2.nascita.trim() || null,
          codice_fiscale: cliente2.cf.trim().toUpperCase(),
        }).eq("id", profiloEdit.cliente2Id);

        if (client2Error) throw new Error("Salvataggio Cliente 2 fallito: " + client2Error.message);
      }

      const { error: vehicleError } = await supabase.from("vehicles").update({
        veicolo: profiloEdit.veicolo.veicolo.trim(),
        motore: profiloEdit.veicolo.motore.trim(),
        targa: profiloEdit.veicolo.targa.trim().toUpperCase(),
        immatricolazione: profiloEdit.veicolo.immatricolazione.trim() || null,
        revisione: profiloEdit.veicolo.revisione.trim() || null,
      }).eq("id", profiloEdit.id);

      if (vehicleError) throw new Error("Salvataggio veicolo fallito: " + vehicleError.message);

      const aggiornato = JSON.parse(JSON.stringify(profiloEdit)) as ProfiloVeicolo;
      setProfiloVeicolo(aggiornato);
      setProfiliArchivio((previous) => previous.map((item) => item.id === aggiornato.id ? aggiornato : item));
      setModificaProfilo(false);
      setProfiloEdit(null);
      alert("Profilo aggiornato correttamente.");
    } catch (error) {
      console.error("Errore modifica profilo:", error);
      alert(error instanceof Error ? error.message : "Non è stato possibile salvare le modifiche.");
    } finally {
      setSalvataggioProfilo(false);
    }
  };

  const mostraProfilo =
    veicoloSelezionato &&
    ricercaNormalizzata.length > 0 &&
    Boolean(profiloVeicolo);

  const gestisciRicerca = (value: string) => {
    setRicerca(value);

    const query = value.trim();

    if (!query) {
      sessionStorage.removeItem("goldencar_veicolo_ricerca");
      setVeicoloSelezionato(false);
      setProfiloVeicolo(null);
      return;
    }

    setVeicoloSelezionato(false);
    setProfiloVeicolo(null);
    sessionStorage.removeItem("goldencar_veicolo_ricerca");
  };

  const selezionaVeicolo = (profilo: ProfiloVeicolo) => {
    const targa = profilo.veicolo.targa.trim().toUpperCase();

    setProfiloVeicolo(profilo);
    setVeicoloSelezionato(true);
    setClienteSelezionato(1);
    setMenuClientiAperto(false);
    setRicerca(targa);
    sessionStorage.setItem("goldencar_veicolo_ricerca", targa);
  };

  const azioni = [



    { titolo: "Nuovo lavoro", coloreIcona: "#E7F8EC", coloreTesto: "#15803D", icon: <DocGreen /> },



    { titolo: "Nuovo ordine", coloreIcona: "#FFF4D6", coloreTesto: "#A16207", icon: <CubeGold /> },



    { titolo: "Media", coloreIcona: "#EEF1F5", coloreTesto: "#475569", icon: <PhotoGray /> },



  ];



  const cronologia = lavori.map((lavoro) => {



    const data = lavoro.createdAt



      ? new Intl.DateTimeFormat("it-IT", {



          day: "2-digit",



          month: "2-digit",



          year: "numeric",



        }).format(new Date(lavoro.createdAt))



      : "—";



    const tipo =



      lavoro.types?.length ? lavoro.types.join(" · ") : "Intervento";

    const concluso = lavoro.status === "CONCLUSO";



    return {



      ...lavoro,



      data,



      titolo: tipo,



      tipo,



      stato: concluso ? "Concluso" : "In lavorazione",



      statoBg: concluso ? "#DCFCE7" : "#FFF1C2",



      statoColor: concluso ? "#15803D" : "#92400E",



      pdfUrl: lavoro.pdfUrl || "",



    };



  });



  const veicoloAperto = lavori.some((lavoro) => lavoro.status === "IN_LAVORAZIONE");



  const apriNuovoLavoro = () => {



    if (veicoloAperto) {



      const lavoroAperto = lavori.find((lavoro) => lavoro.status === "IN_LAVORAZIONE");



      alert(`Questo veicolo ha già un lavoro in lavorazione${lavoroAperto?.jobNumber ? ` (scheda #${lavoroAperto.jobNumber})` : ""}.`);



      return;



    }



    sessionStorage.setItem("goldencar_nuova_scheda", JSON.stringify({



      nomeCliente: clienteVisualizzato.nome, indirizzo: clienteVisualizzato.indirizzo, telefono: clienteVisualizzato.telefono,



      codiceFiscale: clienteVisualizzato.cf, veicolo: veicoloProfilo.veicolo, targa: veicoloProfilo.targa,



    }));



    router.push("/veicolo/scheda");



  };



  const apriNuovoOrdine = () => {

    sessionStorage.setItem(

      "goldencar_nuovo_ordine",

      JSON.stringify({
        nomeCliente: clienteVisualizzato.nome + (clienteVisualizzato.cognome ? " " + clienteVisualizzato.cognome : ""),
        telefono: clienteVisualizzato.telefono,
        veicolo: veicoloProfilo.veicolo,
        targa: veicoloProfilo.targa,
        vehicleId: profiloVeicolo?.id,
      })

    );

    router.push("/ordini");

  };



  const chiudiMedia = () => {



    mediaItems.forEach((item) => {



      if (item.url) URL.revokeObjectURL(item.url);



    });



    setMediaVisualizzato(null);



    setMediaItems([]);



    setMediaAperto(false);



  };



  const aggiungiMediaVeicolo = async (files: File[]) => {
    if (!profiloVeicolo?.id || files.length === 0) return;
    setMediaCaricamento(true);
    try {
      for (const file of files) {
        if (file.size > 50 * 1024 * 1024) throw new Error('Il file supera il limite di 50 MB.');
        const safeName = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_');
        const id = crypto.randomUUID();
        const key = 'veicoli/' + profiloVeicolo.id + '/media/' + Date.now() + '-' + id + '-' + safeName;
        const response = await fetch('/api/r2/file', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, contentType: file.type || 'application/octet-stream' }) });
        const data = await response.json();
        if (!response.ok || !data?.ok || !data?.uploadUrl) throw new Error(data?.error || 'Impossibile preparare il caricamento.');
        const upload = await fetch(data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
        if (!upload.ok) throw new Error('Caricamento di ' + file.name + ' fallito.');
        const { error } = await supabase.from('vehicle_media').insert({ id, vehicle_id: profiloVeicolo.id, name: file.name, mime_type: file.type || 'application/octet-stream', size: file.size, r2_key: key });
        if (error) {
          await fetch('/api/r2/file', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) }).catch(() => undefined);
          throw error;
        }
      }
      await apriMedia();
    } catch (error) {
      console.error('Errore caricamento media veicolo:', error);
      alert(error instanceof Error ? error.message : 'Non è stato possibile aggiungere i file.');
    } finally {
      setMediaCaricamento(false);
    }
  };

  const apriMedia = async () => {
    setMediaAperto(true);
    setMediaCaricamento(true);
    setMediaVisualizzato(null);
    try {
      const { data: vehicleMedia, error: vehicleError } = await supabase.from('vehicle_media').select('id, name, mime_type, size, r2_key, created_at').eq('vehicle_id', profiloVeicolo?.id || '').order('created_at', { ascending: false });
      if (vehicleError) throw vehicleError;
      const vehicleItems = await Promise.all((vehicleMedia ?? []).map(async (item: any) => {
        let url: string | undefined;
        try {
          const response = await fetch('/api/r2/file?key=' + encodeURIComponent(String(item.r2_key)));
          const data = await response.json();
          if (response.ok && data?.downloadUrl) url = data.downloadUrl;
        } catch {}
        return { id: String(item.id), name: String(item.name || 'File'), type: String(item.mime_type || 'application/octet-stream'), size: Number(item.size || 0), createdAt: String(item.created_at || ''), source: 'vehicle' as const, r2Key: String(item.r2_key || ''), jobNumber: 0, jobDate: String(item.created_at || ''), jobType: 'Documenti veicolo', url };
      }));
      const jobItems = lavori.flatMap((lavoro) => (lavoro.media || []).map((media) => ({ ...media, source: 'job' as const, jobNumber: lavoro.jobNumber, jobDate: lavoro.createdAt, jobType: lavoro.types?.join(' · ') || lavoro.works?.trim() || 'Lavoro' })));
      const loadedJobs = await Promise.all(jobItems.map(async (item) => { const blob = await loadMediaBlob(item.id); return { ...item, url: blob ? URL.createObjectURL(blob) : undefined }; }));
      setMediaItems([...vehicleItems, ...loadedJobs]);
    } catch (error) {
      console.error('Errore caricamento media veicolo:', error);
      setMediaItems([]);
    } finally {
      setMediaCaricamento(false);
    }
  };
  const eliminaMedia = async (
    item: MediaAttachment & { jobNumber: number; jobDate: string; jobType: string; url?: string }
  ) => {
    const conferma = window.confirm('Eliminare "' + item.name + '"?');
    if (!conferma) return;
    try {
      if (item.source === 'vehicle') {
        if (item.r2Key) {
          await fetch('/api/r2/file', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: item.r2Key }) });
        }
        const { error } = await supabase.from('vehicle_media').delete().eq('id', item.id);
        if (error) throw error;
      } else {
        const key = 'goldencar_job_' + item.jobNumber;
        const raw = localStorage.getItem(key);
        if (raw) {
          const lavoro = JSON.parse(raw) as LavoroSalvato;
          lavoro.media = (lavoro.media || []).filter((media) => media.id !== item.id);
          localStorage.setItem(key, JSON.stringify(lavoro));
        }
        await deleteMediaBlob(item.id);
      }
      if (item.url) URL.revokeObjectURL(item.url);
      setMediaItems((current) => current.filter((media) => media.id !== item.id));
      setMediaVisualizzato(null);
      void aggiornaLavori();
    } catch (error) {
      console.error('Errore eliminazione media:', error);
      alert('Non è stato possibile eliminare il file.');
    }
  };
  const scaricaMedia = (item: MediaAttachment & { url?: string }) => {



    if (!item.url) return;



    const link = document.createElement("a");



    link.href = item.url;



    link.download = item.name;



    document.body.appendChild(link);



    link.click();



    link.remove();



  };



  const formatDataCompleta = (value: string) => {
    if (!value) return "—";
    const raw = String(value).trim();
    let date: Date;

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const [year, month, day] = raw.split("-").map(Number);
      date = new Date(year, month - 1, day);
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      const [day, month, year] = raw.split("/").map(Number);
      date = new Date(year, month - 1, day);
    } else {
      date = new Date(raw);
    }

    if (Number.isNaN(date.getTime())) return raw;
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit", month: "2-digit", year: "numeric",
    }).format(date);
  };

  const valoreDataInput = (value: string) => {
    if (!value) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      const [day, month, year] = value.split("/");
      return `${year}-${month}-${day}`;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };

  const formatMediaDate = (value: string) => {
    if (!value) return "Data non disponibile";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Data non disponibile";
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  };



  const isImageMedia = (item: MediaAttachment) => item.type.startsWith("image/");



  const mediaGroups = Array.from(
    mediaItems.reduce((groups, item) => {
      const dateKey = item.createdAt && !Number.isNaN(new Date(item.createdAt).getTime())
        ? new Date(item.createdAt).toISOString().slice(0, 10)
        : "senza-data";
      const existing = groups.get(dateKey);
      if (existing) existing.items.push(item);
      else groups.set(dateKey, { dateKey, date: item.createdAt, items: [item] });
      return groups;
    }, new Map<string, { dateKey: string; date: string; items: typeof mediaItems }>())
  ).sort((a, b) => {
    if (a[0] === "senza-data") return 1;
    if (b[0] === "senza-data") return -1;
    return b[0].localeCompare(a[0]);
  });

  const estensioneMedia = (item: MediaAttachment) => {
    const parts = item.name.split(".");
    return parts.length > 1 ? parts.pop()?.toUpperCase() || "FILE" : "FILE";
  };

  const isVideoMedia = (item: MediaAttachment) => item.type.startsWith("video/");

  const apriMediaInNuovaFinestra = (
    item: MediaAttachment & {
      jobNumber?: number;
      jobDate?: string;
      jobType?: string;
      url?: string;
    }
  ) => {
    if (item.source === "vehicle" && item.r2Key) {
      const viewerUrl =
        "/veicolo/media?key=" +
        encodeURIComponent(item.r2Key) +
        "&name=" +
        encodeURIComponent(item.name) +
        "&type=" +
        encodeURIComponent(item.type);

      window.open(viewerUrl, "_blank", "noopener,noreferrer");
      return;
    }

    if (!item.url) {
      alert("File non disponibile.");
      return;
    }

    setMediaVisualizzato({
      ...item,
      jobNumber: item.jobNumber ?? 0,
      jobDate: item.jobDate ?? item.createdAt,
      jobType: item.jobType ?? "Media veicolo",
    });
  };

  return (



    <>



      <main className="app">



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



          VEICOLO



        </h1>



      </div>

      {/* =========================



          RICERCA



      ========================= */}



      <div



        style={{



          display: "flex",



          gap: 12,



          padding: "0 18px",



        }}



      >



        <div



          style={{



            flex: 1,



            height: 52,



            borderRadius: 18,



            background: "#FFFFFF",



            display: "flex",



            alignItems: "center",



            padding: "0 16px",



            boxShadow: "0 4px 12px rgba(0,0,0,.08)",



          }}



        >



          <SearchIcon />



          <input



            value={ricerca}



            onChange={(e) => gestisciRicerca(e.target.value)}



            placeholder="Targa, cliente o veicolo"



            style={{



              border: "none",



              outline: "none",



              marginLeft: 10,



              width: "100%",



              fontSize: 15,



              background: "transparent",



              color: "#111827",



            }}



          />



        </div>

        <button
          type="button"
          onClick={() => router.push("/veicolo/profilo")}



          aria-label="Nuovo profilo"



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



            flexShrink: 0,



          }}



        >



          <PlusIcon />



        </button>



      </div>



      {/* =========================
          RISULTATI RICERCA
      ========================= */}

      {ricercaNormalizzata.length > 0 && !mostraProfilo && (
        <div
          style={{
            position: "relative",
            zIndex: 30,
            margin: "8px 18px 0",
            borderRadius: 18,
            background: "#FFFFFF",
            boxShadow: "0 8px 24px rgba(15,23,42,.14)",
            overflow: "hidden",
            border: "1px solid #E5E7EB",
          }}
        >
          {risultatiRicerca.length > 0 ? (
            risultatiRicerca.map((profilo, index) => {
              const cliente1 = [profilo.cliente1.nome, profilo.cliente1.cognome]
                .filter(Boolean)
                .join(" ");
              const cliente2 = profilo.cliente2
                ? [profilo.cliente2.nome, profilo.cliente2.cognome]
                    .filter(Boolean)
                    .join(" ")
                : "";
              const clienti = [cliente1, cliente2].filter(Boolean).join(" · ");

              return (
                <button
                  key={profilo.id}
                  type="button"
                  onClick={() => selezionaVeicolo(profilo)}
                  style={{
                    width: "100%",
                    border: "none",
                    borderBottom:
                      index < risultatiRicerca.length - 1
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
                          fontWeight: 850,
                          color: "#111827",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {clienti || "Cliente non indicato"}
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 13,
                          color: "#64748B",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {profilo.veicolo.veicolo || "Veicolo non indicato"}
                      </div>
                    </div>

                    <div
                      style={{
                        flexShrink: 0,
                        padding: "7px 9px",
                        borderRadius: 9,
                        background: "#F8F5E8",
                        color: "#8A6A00",
                        fontSize: 12,
                        fontWeight: 900,
                        letterSpacing: ".04em",
                      }}
                    >
                      {profilo.veicolo.targa || "—"}
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div
              style={{
                padding: "15px 16px",
                color: "#6B7280",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              Nessun veicolo trovato
            </div>
          )}
        </div>
      )}

      {mostraProfilo ? (
        <>
          {/* =========================



              PROFILO VEICOLO



          ========================= */}



          <div
            style={{
              margin: "22px 18px 0",
              background: "#FFFFFF",
              borderRadius: 26,
              padding: 18,
              boxShadow: "0 4px 14px rgba(15,23,42,.08)",
              position: "relative",
            }}
          >
            <button
              type="button"
              onClick={modificaProfilo ? annullaModificaProfilo : iniziaModificaProfilo}
              aria-label={modificaProfilo ? "Annulla modifica profilo" : "Modifica profilo"}
              style={{
                position: "absolute", top: 14, right: 14, width: 38, height: 38,
                border: "none", borderRadius: 12, background: "#EEF3F8", color: "#041E49",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}
            >
              {modificaProfilo ? <CloseIcon /> : <PencilIcon />}
            </button>

            <div style={{ display: "flex", gap: 16, alignItems: "center", paddingRight: 46 }}>
              <div style={{
                width: 72, height: 72, borderRadius: 18, background: "#F3F4F6",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <CarIcon />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {modificaProfilo && profiloEdit ? (
                  <>
                    <input value={profiloEdit.veicolo.veicolo} onChange={(e) => aggiornaVeicoloEdit("veicolo", e.target.value)}
                      placeholder="Descrizione veicolo" style={editInputStyle} />
                    <input value={profiloEdit.veicolo.targa} onChange={(e) => aggiornaVeicoloEdit("targa", e.target.value.toUpperCase())}
                      placeholder="Targa" style={{ ...editInputStyle, marginTop: 6, fontSize: 16 }} />
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      {profiloEdit.cliente1.cognome.trim() ? (
                        <>
                          <input value={profiloEdit.cliente1.nome} onChange={(e) => aggiornaClienteEdit(1, "nome", e.target.value)}
                            placeholder="Nome" style={{ ...editInputStyle, fontSize: 15 }} />
                          <input value={profiloEdit.cliente1.cognome} onChange={(e) => aggiornaClienteEdit(1, "cognome", e.target.value)}
                            placeholder="Cognome" style={{ ...editInputStyle, fontSize: 15 }} />
                        </>
                      ) : (
                        <input value={profiloEdit.cliente1.nome} onChange={(e) => aggiornaClienteEdit(1, "nome", e.target.value)}
                          placeholder="Nome e cognome" style={{ ...editInputStyle, fontSize: 15 }} />
                      )}
                    </div>
                    {profiloEdit.cliente2 && (
                      <>
                        <div style={{ marginTop: 10, fontSize: 11, fontWeight: 800, color: "#64748B" }}>SECONDO CLIENTE</div>
                        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                          {profiloEdit.cliente2.cognome.trim() ? (
                            <>
                              <input value={profiloEdit.cliente2.nome} onChange={(e) => aggiornaClienteEdit(2, "nome", e.target.value)}
                                placeholder="Nome" style={{ ...editInputStyle, fontSize: 15 }} />
                              <input value={profiloEdit.cliente2.cognome} onChange={(e) => aggiornaClienteEdit(2, "cognome", e.target.value)}
                                placeholder="Cognome" style={{ ...editInputStyle, fontSize: 15 }} />
                            </>
                          ) : (
                            <input value={profiloEdit.cliente2.nome} onChange={(e) => aggiornaClienteEdit(2, "nome", e.target.value)}
                              placeholder="Nome e cognome" style={{ ...editInputStyle, fontSize: 15 }} />
                          )}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, paddingRight: 50 }}>
                      <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0 }}>
                        {veicoloProfilo.veicolo || "Nessun veicolo"}
                      </h2>
                      {veicoloAperto && (
                        <div style={{
                          marginLeft: "auto", background: "#22C55E", color: "#FFFFFF", fontSize: 12,
                          fontWeight: 700, padding: "6px 12px", borderRadius: 999, whiteSpace: "nowrap",
                        }}>APERTO</div>
                      )}
                    </div>
                    <div style={{ color: "#6B7280", marginTop: 4, fontSize: 16 }}>
                      {veicoloProfilo.targa || "Nessuna targa"}
                    </div>
                    <div style={{ marginTop: 6, position: "relative" }}>
                      {hasCliente2Profilo ? (
                        <>
                          <button type="button" onClick={() => setMenuClientiAperto((prev) => !prev)} style={{
                            border: "none", background: "transparent", padding: 0, display: "inline-flex",
                            alignItems: "center", gap: 5, fontWeight: 600, color: "#374151", fontSize: 15, cursor: "pointer",
                          }}>
                            {clienteVisualizzato.nome} {clienteVisualizzato.cognome}
                            <ChevronDownIcon open={menuClientiAperto} />
                          </button>
                          {menuClientiAperto && (
                            <div style={{
                              position: "absolute", top: 28, left: 0, minWidth: 180, background: "#FFFFFF",
                              borderRadius: 14, boxShadow: "0 10px 24px rgba(0,0,0,.14)", overflow: "hidden",
                              zIndex: 20, border: "1px solid #E5E7EB",
                            }}>
                              <ClientChoice nome={cliente1Profilo.nome} active={clienteSelezionato === 1} onClick={() => { setClienteSelezionato(1); setMenuClientiAperto(false); }} />
                              <ClientChoice nome={cliente2Profilo?.nome ?? ""} active={clienteSelezionato === 2} onClick={() => { setClienteSelezionato(2); setMenuClientiAperto(false); }} />
                            </div>
                          )}
                        </>
                      ) : (
                        <div style={{ fontWeight: 600, color: "#374151", fontSize: 15 }}>
                          {clienteVisualizzato.nome} {clienteVisualizzato.cognome}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {modificaProfilo && profiloEdit && (
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button type="button" onClick={annullaModificaProfilo} style={{
                  flex: 1, height: 44, border: "1px solid #E5E7EB", borderRadius: 13,
                  background: "#FFFFFF", color: "#475569", fontWeight: 800, cursor: "pointer",
                }}>ANNULLA</button>
                <button type="button" onClick={() => void salvaModificaProfilo()} disabled={salvataggioProfilo} style={{
                  flex: 1, height: 44, border: "none", borderRadius: 13, background: "#041E49",
                  color: "#FFFFFF", fontWeight: 800, cursor: salvataggioProfilo ? "wait" : "pointer",
                  opacity: salvataggioProfilo ? .65 : 1,
                }}>{salvataggioProfilo ? "SALVATAGGIO..." : "SALVA MODIFICHE"}</button>
              </div>
            )}
          </div>

          {/* =========================



              DATI VEICOLO / CLIENTE



          ========================= */}



          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              padding: "18px",
            }}
          >
            <InfoCard
              icon={<RevisionIcon />}
              label="Revisione"
              value={modificaProfilo && profiloEdit ? (
                <input
                  type="date"
                  value={valoreDataInput(profiloEdit.veicolo.revisione)}
                  onChange={(e) => aggiornaVeicoloEdit("revisione", e.target.value)}
                  style={cardEditInputStyle}
                />
              ) : (
                dataRevisione ? (() => {
                  const data = new Date(dataRevisione);
                  if (Number.isNaN(data.getTime())) return dataRevisione;
                  return formatDataCompleta(dataRevisione);
                })() : "—"
              )}
              iconColor="#2563EB"
              valueFontSize={16}
            />
            <InfoCard
              icon={<KeyIcon />}
              label="Immatric."
              value={modificaProfilo && profiloEdit ? (
                <input
                  type="date"
                  value={valoreDataInput(profiloEdit.veicolo.immatricolazione)}
                  onChange={(e) => aggiornaVeicoloEdit("immatricolazione", e.target.value)}
                  style={cardEditInputStyle}
                />
              ) : formatDataCompleta(veicoloProfilo.immatricolazione)}
              iconColor="#2563EB"
              valueFontSize={16}
            />
            <InfoCard
              icon={<LocationIcon />}
              label="Indirizzo"
              value={modificaProfilo && profiloEdit ? (
                <input value={(clienteSelezionato === 2 && profiloEdit.cliente2 ? profiloEdit.cliente2 : profiloEdit.cliente1).indirizzo}
                  onChange={(e) => aggiornaClienteEdit(clienteSelezionato, "indirizzo", e.target.value)}
                  placeholder="Indirizzo" style={cardEditInputStyle} />
              ) : (clienteVisualizzato.indirizzo || "—")}
              iconColor="#374151"
              href={modificaProfilo ? undefined : indirizzoMaps}
              valueFontSize={14}
            />
            <InfoCard
              icon={<PhoneIcon />}
              label="Telefono"
              value={modificaProfilo && profiloEdit ? (
                <input type="tel" value={(clienteSelezionato === 2 && profiloEdit.cliente2 ? profiloEdit.cliente2 : profiloEdit.cliente1).telefono}
                  onChange={(e) => aggiornaClienteEdit(clienteSelezionato, "telefono", e.target.value)}
                  placeholder="Telefono" style={cardEditInputStyle} />
              ) : (clienteVisualizzato.telefono || "—")}
              iconColor="#16A34A"
              href={modificaProfilo ? undefined : whatsappHref}
              valueFontSize={16}
            />
            <InfoCard
              icon={<PersonIcon />}
              label="Nascita"
              value={modificaProfilo && profiloEdit ? (
                <input value={(clienteSelezionato === 2 && profiloEdit.cliente2 ? profiloEdit.cliente2 : profiloEdit.cliente1).nascita}
                  onChange={(e) => aggiornaClienteEdit(clienteSelezionato, "nascita", e.target.value)}
                  placeholder="Data di nascita" style={cardEditInputStyle} />
              ) : (clienteVisualizzato.nascita || "—")}
              iconColor="#7C3AED"
              valueFontSize={16}
            />
            <InfoCard
              icon={<CardIcon />}
              label="Cod. Fiscale"
              value={modificaProfilo && profiloEdit ? (
                <input value={(clienteSelezionato === 2 && profiloEdit.cliente2 ? profiloEdit.cliente2 : profiloEdit.cliente1).cf}
                  onChange={(e) => aggiornaClienteEdit(clienteSelezionato, "cf", e.target.value.toUpperCase())}
                  placeholder="Codice fiscale" style={cardEditInputStyle} />
              ) : (clienteVisualizzato.cf || "—")}
              iconColor="#64748B"
              valueFontSize={13}
            />
          </div>

          {/* =========================



              AZIONI RAPIDE



          ========================= */}



          <div



            style={{



              padding: "0 18px",



            }}



          >



            <h3



              style={{



                fontSize: 22,



                fontWeight: 800,



                color: "#111827",



                margin: "12px 0 14px",



              }}



            >



              Azioni rapide



            </h3>



            <div



              style={{



                display: "grid",



                gridTemplateColumns: "1fr 1fr 1fr",



                gap: 12,



              }}



            >



              {azioni.map((azione) => (



                <button



                  key={azione.titolo}



                  type="button"



                  onClick={



                    azione.titolo === "Nuovo lavoro"



                      ? apriNuovoLavoro



                      : azione.titolo === "Nuovo ordine"



                        ? apriNuovoOrdine



                        : azione.titolo === "Media"



                          ? apriMedia



                          : undefined



                  }



                  style={{



                    height: 96,



                    border: "none",



                    borderRadius: 20,



                    background: "#FFFFFF",



                    boxShadow: "0 4px 12px rgba(0,0,0,.08)",



                    display: "flex",



                    flexDirection: "column",



                    justifyContent: "center",



                    alignItems: "center",



                    cursor: "pointer",



                    padding: 8,



                  }}



                >



                  <div



                    style={{



                      width: 46,



                      height: 46,



                      borderRadius: 14,



                      background: azione.coloreIcona,



                      display: "flex",



                      justifyContent: "center",



                      alignItems: "center",



                      marginBottom: 8,



                    }}



                  >



                    {azione.icon}



                  </div>



                  <span



                    style={{



                      fontSize: 13,



                      fontWeight: 700,



                      color: azione.coloreTesto,



                      textAlign: "center",



                    }}



                  >



                    {azione.titolo}



                  </span>



                </button>



                ))}



            </div>



          </div>



          {/* =========================



              CRONOLOGIA



          ========================= */}



          <div



            style={{



              padding: "24px 18px 110px",



            }}



          >



            <h3



              style={{



                fontSize: 22,



                fontWeight: 800,



                color: "#111827",



                margin: "0 0 14px",



              }}



            >



              Cronologia interventi



            </h3>



            <div



              style={{



                display: "flex",



                flexDirection: "column",



                gap: 10,



              }}



            >



              {cronologia.length === 0 ? (



                <div



                  style={{



                    background: "#FFFFFF",



                    borderRadius: 18,



                    padding: "18px 16px",



                    boxShadow: "0 3px 10px rgba(0,0,0,.06)",



                    color: "#64748B",



                    fontSize: 14,



                    fontWeight: 600,



                    textAlign: "center",



                  }}



                >



                  Nessun lavoro registrato per questo veicolo.



                </div>



              ) : (



                cronologia.map((intervento) => (

                  <div

                    key={`${intervento.data}-${intervento.titolo}`}

                    role="button"

                    tabIndex={0}

                    onClick={() => {

                      sessionStorage.setItem(

                        "goldencar_apri_scheda",

                        String(intervento.jobNumber)

                      );

                      router.push("/veicolo/scheda");

                    }}

                    onKeyDown={(e) => {

                      if (e.key === "Enter" || e.key === " ") {

                        e.preventDefault();

                        sessionStorage.setItem(

                          "goldencar_apri_scheda",

                          String(intervento.jobNumber)

                        );

                        router.push("/veicolo/scheda");

                      }

                    }}

                    style={{

                      width: "100%",

                      border: "none",

                      background: "#FFFFFF",

                      borderRadius: 18,

                      padding: 14,

                      boxShadow: "0 3px 10px rgba(0,0,0,.06)",

                      display: "flex",

                      alignItems: "center",

                      gap: 12,

                      textAlign: "left",

                      cursor: "pointer",

                    }}

                  >

                    {intervento.stato === "Concluso" ? (

                      <button

                        type="button"

                        onClick={(e) => {

                          e.stopPropagation();

                          if (intervento.pdfR2Key) {
                            const pdfR2Key = intervento.pdfR2Key;
                            void (async () => {
                              try {
                                const response = await fetch("/api/r2/file?key=" + encodeURIComponent(pdfR2Key));
                                const data = await response.json();
                                if (!response.ok || !data?.ok || !data?.downloadUrl) throw new Error(data?.error || "PDF non disponibile.");
                                window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
                              } catch (error) {
                                console.error("Errore apertura PDF R2:", error);
                                alert(error instanceof Error ? error.message : "Non è stato possibile aprire il PDF.");
                              }
                            })();
                          } else if (intervento.pdfUrl) {
                            window.open(intervento.pdfUrl, "_blank", "noopener,noreferrer");
                          }

                        }}

                        disabled={!intervento.pdfR2Key && !intervento.pdfUrl}

                        aria-label="Apri PDF del lavoro"

                        style={{

                          width: 40,

                          height: 40,

                          border: "none",

                          borderRadius: 12,

                          background: "#F3F4F6",

                          display: "flex",

                          alignItems: "center",

                          justifyContent: "center",

                          flexShrink: 0,

                          cursor: (intervento.pdfR2Key || intervento.pdfUrl) ? "pointer" : "default",

                          padding: 0,

                          opacity: (intervento.pdfR2Key || intervento.pdfUrl) ? 1 : 0.7,

                        }}

                      >

                        <PaperclipIcon />

                      </button>

                    ) : (

                      <div

                        style={{

                          width: 40,

                          height: 40,

                          borderRadius: 12,

                          background: "#F3F4F6",

                          display: "flex",

                          alignItems: "center",

                          justifyContent: "center",

                          flexShrink: 0,

                        }}

                      >

                        <WrenchIcon />

                      </div>

                    )}

                    <div

                      style={{

                        flex: 1,

                        minWidth: 0,

                      }}

                    >

                      <div

                        style={{

                          fontWeight: 800,

                          fontSize: 15,

                          color: "#111827",

                          marginBottom: 3,

                        }}

                      >

                        {intervento.tipo}

                      </div>

                      <div

                        style={{

                          fontSize: 12,

                          color: "#64748B",

                        }}

                      >

                        {intervento.data}

                      </div>

                    </div>

                    <div

                      style={{

                        background: intervento.statoBg,

                        color: intervento.statoColor,

                        padding: "7px 10px",

                        borderRadius: 999,

                        fontSize: 11,

                        fontWeight: 700,

                        whiteSpace: "nowrap",

                        flexShrink: 0,

                      }}

                    >

                      {intervento.stato}

                    </div>

                  </div>

              )))}



            </div>



          </div>



        </>



      ) : null}



      {mediaAperto && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(15,23,42,.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 620,
              maxHeight: "92vh",
              overflow: "auto",
              background: "#F8FAFC",
              borderRadius: 26,
              boxShadow: "0 20px 60px rgba(15,23,42,.25)",
              padding: 18,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#111827" }}>MEDIA</div>
                <div style={{ fontSize: 13, color: "#64748B", marginTop: 3 }}>
                  Foto, video e documenti del veicolo
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <input
                  id="goldencar-vehicle-media-input"
                  type="file"
                  multiple
                  accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.currentTarget.value = "";
                    if (files.length) void aggiungiMediaVeicolo(files);
                  }}
                />
                <label
                  htmlFor="goldencar-vehicle-media-input"
                  title="Aggiungi foto, video o documento"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: "#D4AF37",
                    color: "#111827",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 25,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  +
                </label>
                <button
                  type="button"
                  onClick={chiudiMedia}
                  aria-label="Chiudi media"
                  style={{
                    width: 40,
                    height: 40,
                    border: "none",
                    borderRadius: 12,
                    background: "#E5E7EB",
                    color: "#374151",
                    fontSize: 22,
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            {mediaCaricamento ? (
              <div style={{ background: "#FFFFFF", borderRadius: 18, padding: 36, textAlign: "center", color: "#64748B", fontWeight: 700 }}>
                Caricamento media...
              </div>
            ) : mediaItems.length === 0 ? (
              <div style={{ background: "#FFFFFF", borderRadius: 18, padding: 36, textAlign: "center", color: "#64748B", fontWeight: 600 }}>
                Nessuna foto, video o documento collegato a questo veicolo.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {mediaGroups.map(([dateKey, group]) => (
                  <section key={dateKey}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                      <div style={{ fontSize: 15, fontWeight: 900, color: "#111827" }}>
                        {group.date ? formatMediaDate(group.date) : "Data non disponibile"}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748B" }}>
                        {group.items.length} {group.items.length === 1 ? "elemento" : "elementi"}
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 9 }}>
                      {group.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => apriMediaInNuovaFinestra(item)}
                          title={item.name}
                          style={{
                            border: "none",
                            padding: 0,
                            background: "#FFFFFF",
                            borderRadius: 15,
                            overflow: "hidden",
                            minWidth: 0,
                            cursor: "pointer",
                            boxShadow: "0 3px 10px rgba(0,0,0,.07)",
                          }}
                        >
                          {item.url && isImageMedia(item) ? (
                            <img
                              src={item.url}
                              alt={item.name}
                              style={{ display: "block", width: "100%", aspectRatio: "1 / 1", objectFit: "cover" }}
                            />
                          ) : item.url && isVideoMedia(item) ? (
                            <video
                              src={item.url}
                              muted
                              playsInline
                              preload="metadata"
                              style={{ display: "block", width: "100%", aspectRatio: "1 / 1", objectFit: "cover", background: "#E2E8F0" }}
                            />
                          ) : (
                            <div
                              style={{
                                aspectRatio: "1 / 1",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: 8,
                                color: "#475569",
                                background: "#EEF1F5",
                              }}
                            >
                              <div style={{ fontSize: 28 }}>▤</div>
                              <div
                                style={{
                                  marginTop: 7,
                                  fontSize: 10,
                                  fontWeight: 800,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  width: "100%",
                                }}
                              >
                                {estensioneMedia(item)}
                              </div>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {mediaVisualizzato && (



        <div



          role="dialog"



          aria-modal="true"



          style={{



            position: "fixed", inset: 0, zIndex: 120, background: "rgba(0,0,0,.88)",



            display: "flex", flexDirection: "column",



          }}



        >



          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", color: "#FFFFFF" }}>



            <div style={{ minWidth: 0 }}>



              <div style={{



                fontSize: 14, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis",



                whiteSpace: "nowrap", maxWidth: 260,



              }}>



                {mediaVisualizzato.name}



              </div>



              <div style={{ fontSize: 11, opacity: 0.7 }}>



                Scheda #{mediaVisualizzato.jobNumber} · {formatMediaDate(mediaVisualizzato.createdAt)}



              </div>



            </div>



            <button



              type="button"



              onClick={() => setMediaVisualizzato(null)}



              style={{



                width: 40, height: 40, border: "none", borderRadius: 12,



                background: "rgba(255,255,255,.12)", color: "#FFFFFF", fontSize: 22, cursor: "pointer",



              }}



            >



              ×



            </button>



          </div>



          <div style={{



            flex: 1, minHeight: 0, display: "flex", alignItems: "center",



            justifyContent: "center", padding: 16, overflow: "auto",



          }}>



            {mediaVisualizzato.url && isImageMedia(mediaVisualizzato) ? (



              <img



                src={mediaVisualizzato.url}



                alt={mediaVisualizzato.name}



                style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 10 }}



              />



            ) : mediaVisualizzato.url && mediaVisualizzato.type === "application/pdf" ? (



              <iframe



                src={mediaVisualizzato.url}



                title={mediaVisualizzato.name}



                style={{ width: "100%", height: "70vh", border: "none", borderRadius: 10, background: "#FFFFFF" }}



              />



            ) : (



              <div style={{ background: "#FFFFFF", borderRadius: 20, padding: 28, textAlign: "center", color: "#111827", maxWidth: 360 }}>



                <div style={{ fontSize: 48 }}>▤</div>



                <div style={{ marginTop: 12, fontWeight: 800, wordBreak: "break-word" }}>



                  {mediaVisualizzato.name}



                </div>



                <div style={{ marginTop: 7, fontSize: 13, color: "#64748B" }}>



                  Questo tipo di documento non può essere visualizzato direttamente qui.



                </div>



              </div>



            )}



          </div>



          <div style={{ display: "flex", gap: 10, padding: "12px 16px 20px" }}>



            <button



              type="button"



              onClick={() => scaricaMedia(mediaVisualizzato)}



              disabled={!mediaVisualizzato.url}



              style={{



                flex: 1, height: 48, border: "none", borderRadius: 15,



                background: "#FFFFFF", color: "#111827", fontWeight: 900,



                cursor: mediaVisualizzato.url ? "pointer" : "default",



                opacity: mediaVisualizzato.url ? 1 : 0.55,



              }}



            >



              SCARICA



            </button>



            <button



              type="button"



              onClick={() => eliminaMedia(mediaVisualizzato)}



              style={{



                flex: 1, height: 48, border: "none", borderRadius: 15,



                background: "#DC2626", color: "#FFFFFF", fontWeight: 900, cursor: "pointer",



              }}



            >



              ELIMINA



            </button>



          </div>



        </div>



      )}



      <BottomBar />



    </main>



    </>



  );



}



const editInputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #CBD5E1",
  borderRadius: 10,
  background: "#F8FAFC",
  padding: "7px 9px",
  fontSize: 19,
  fontWeight: 800,
  color: "#111827",
  outline: "none",
};

const cardEditInputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #CBD5E1",
  borderRadius: 9,
  background: "#F8FAFC",
  padding: "7px 8px",
  fontSize: 14,
  fontWeight: 700,
  color: "#111827",
  outline: "none",
};

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0 0-3L17.5 5.5a2.12 2.12 0 0 0-3 0L4 16v4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m13.5 6.5 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function InfoCard({



  icon,



  label,



  value,



  iconColor,



  href,

  valueFontSize,



}: {



  icon: ReactNode;



  label: string;



  value: ReactNode;



  iconColor: string;



  href?: string;

  valueFontSize?: number;



}) {



  const content = (



    <>



      <div



        style={{



          display: "flex",



          alignItems: "center",



          gap: 8,



          marginBottom: 8,



        }}



      >



        {icon}



        <div



          style={{



            fontSize: 12,



            color: "#6B7280",



          }}



        >



          {label}



        </div>



      </div>



      <div



        style={{



          fontWeight: 700,



          fontSize: valueFontSize ?? 14,



          color: "#111827",



          lineHeight: 1.2,



          wordBreak: "break-word",



        }}



      >



        {value}



      </div>



    </>



  );



  const style = {



    background: "#FFFFFF",




    borderRadius: 18,



    padding: 14,



    boxShadow: "0 3px 10px rgba(0,0,0,.06)",



    minHeight: 84,



    textDecoration: "none",



    color: "inherit",



    cursor: href ? "pointer" : "default",



    display: "block",



  } as const;



  if (href) {



    return (



      <a href={href} style={style}>



        {content}



      </a>



    );



  }



  return <div style={style}>{content}</div>;



}



function ClientChoice({



  nome,



  active,



  onClick,



}: {



  nome: string;



  active: boolean;



  onClick: () => void;



}) {



  return (



    <button



      type="button"



      onClick={onClick}



      style={{



        width: "100%",



        border: "none",



        borderBottom: "1px solid #E5E7EB",



        background: active ? "#F7F4E8" : "#FFFFFF",



        color: active ? "#111827" : "#374151",



        padding: "12px 14px",



        textAlign: "left",



        fontSize: 13,



        fontWeight: active ? 800 : 600,



        cursor: "pointer",



      }}



    >



      {nome}



    </button>



  );



}



const SearchIcon = () => (



  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">



    <circle



      cx="11"



      cy="11"



      r="7"



      stroke="#6B7280"



      strokeWidth="2"



    />



    <path



      d="M20 20L17 17"



      stroke="#6B7280"



      strokeWidth="2"



      strokeLinecap="round"



    />



  </svg>



);



const PlusIcon = () => (



  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">



    <path



      d="M12 5V19M5 12H19"



      stroke="#111827"



      strokeWidth="2.5"



      strokeLinecap="round"



    />



  </svg>



);



const SmallPlusIcon = () => (



  <svg width="19" height="19" viewBox="0 0 24 24" fill="none">



    <path



      d="M12 5V19M5 12H19"



      stroke="#111827"



      strokeWidth="2.4"



      strokeLinecap="round"



    />



  </svg>



);



const MinusIcon = () => (



  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">



    <path



      d="M5 12H19"



      stroke="#FFFFFF"



      strokeWidth="2.4"



      strokeLinecap="round"



    />



  </svg>



);



const ChevronDownIcon = ({ open }: { open: boolean }) => (



  <svg



    width="14"



    height="14"



    viewBox="0 0 24 24"



    fill="none"



    style={{



      transform: open ? "rotate(180deg)" : "rotate(0deg)",



      transition: "transform .15s ease",



    }}



  >



    <path



      d="M6 9L12 15L18 9"



      stroke="#6B7280"



      strokeWidth="2"



      strokeLinecap="round"



      strokeLinejoin="round"



    />



  </svg>



);



const CarIcon = () => (



  <svg width="42" height="42" viewBox="0 0 24 24" fill="none">



    <g



      stroke="#111827"



      strokeWidth="1.8"



      strokeLinecap="round"



      strokeLinejoin="round"



    >



      <path d="M2 9L4 10L5.3 6.2C5.8 4.8 6.3 4 8.3 4H15.7C17.7 4 18.2 4.8 18.7 6.2L20 10L22 9" />



      <path d="M6.8 10H17.2C20 10 22 11.4 22 14.8V17.5C22 18.9 20.9 20 19.5 20H19C17.9 20 17 19.1 17 18C17 17.7 16.8 17.5 16.5 17.5H7.5C7.2 17.5 7 17.7 7 18C7 19.1 6.1 20 5 20H4.5C3.1 20 2 18.9 2 17.5V14.8C2 11.4 4 10 6.8 10Z" />



    </g>



  </svg>



);



const RevisionIcon = () => (



  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">



    <g stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">



      <path d="M6 6L10.5 10.5" />



      <path d="M6 6H3L2 3L3 2L6 3V6Z" />



      <path d="M19.259 2.74101L16.6314 5.36863C16.2354 5.76465 16.0373 5.96265 15.9632 6.19098C15.8979 6.39183 15.8979 6.60817 15.9632 6.80902C16.0373 7.03735 16.2354 7.23535 16.6314 7.63137L16.8686 7.86863C17.2646 8.26465 17.4627 8.46265 17.691 8.53684C17.8918 8.6021 18.1082 8.6021 18.309 8.53684C18.5373 8.46265 18.7354 8.26465 19.1314 7.86863L21.5893 5.41072C21.854 6.05488 22 6.76039 22 7.5C22 10.5376 19.5376 13 16.5 13C16.1338 13 15.7759 12.9642 15.4298 12.8959C14.9436 12.8001 14.7005 12.7521 14.5532 12.7668C14.3965 12.7824 14.3193 12.8059 14.1805 12.8802C14.0499 12.9501 13.919 13.081 13.657 13.343L6.5 20.5C5.67157 21.3284 4.32843 21.3284 3.5 20.5C2.67157 19.6716 2.67157 18.3284 3.5 17.5L10.657 10.343C10.919 10.081 11.0499 9.95005 11.2332 9.44681C11.2479 9.29945 11.1999 9.05638 11.1041 8.57024C11.0358 8.22406 11 7.86621 11 7.5C11 4.46243 13.4624 2 16.5 2C17.5055 2 18.448 2.26982 19.259 2.74101Z" />



      <path d="M12.0001 14.9999L17.5 20.4999C18.3284 21.3283 19.6716 21.3283 20.5 20.4999C21.3284 19.6715 21.3284 18.3283 20.5 17.4999L15.9753 12.9753C15.655 12.945 15.3427 12.8872 15.0408 12.8043C14.6517 12.6975 14.2249 12.7751 13.9397 13.0603L12.0001 14.9999Z" />



    </g>



  </svg>



);



const KeyIcon = () => (



  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 512 512" style={{ color: "#2563EB" }}>



    <title>car-key</title>



    <path fill="currentColor" d="M285.628 42.475c-39.602 0-73 28.513-73 65c0 18.43 8.528 34.82 22.066 46.533l8.473-16.67c-7.876-8.202-12.54-18.667-12.54-29.863c0-25.37 23.91-47 55-47s55 21.63 55 47c0 17.403-11.253 33.046-28.356 41.154l-7.482 21.556a79 79 0 0 0 5.613-1.58l9.158 16.013c-10.326 7.263-20.32 16.266-31.034 27.472l81.35 179.392c50.265 2.318 98.764-24.335 123.754-68.01L385.8 158.635c-20.166 4.027-36.39 9.054-50.875 16.598l-8.09-14.144c19.057-11.615 31.793-31.09 31.793-53.613c0-36.487-33.398-65-73-65zm-122.666 5.947c-2.66.03-5.454.47-8.152 1.348c-6.17 2.004-11.39 6.134-13.66 10.59l-.288.57l-64.904 92.297c-2.135 4.452-2.382 10.947-.457 16.97c1.97 6.157 6.045 11.305 10.202 13.422l143.682 73.16c4.072 2.075 10.59 2.405 16.648.427c5.945-1.94 10.996-5.885 13.403-10.492l25.36-74.26l.15.004l6.327-18.23c-.086.008-.175.01-.26.018l4.905-14.365l.29-.568c2.27-4.456 2.54-11.12.55-17.282s-6.1-11.355-10.434-13.562l-32.078-16.333c-6.543 8.178-8.55 19.868-.346 30.87l2.11 3.532l10.288 5.4l-8.256 16.214l-.146-.07l-8.118 15.97l.135.065l-6.303 12.376l-101.59-51.728l18.606-36.538l4.082-8.02l30.854 15.712c1.556-9.81 4.922-19.248 10.335-28.404L172.103 50.31c-2.514-1.28-5.72-1.925-9.14-1.888zm217.928 131.38l24.082 43.82l-71.864 39.49l-19.748-35.93l-4.334-7.887zm-7.106 24.444L333.472 226.4l6.742 12.27l40.312-22.154zM114.5 218.482l-20.87 40.993l69.508 35.392l20.873-40.992zm297.214 17.41l24.08 43.817l-71.863 39.49l-19.745-35.93l-4.334-7.887l71.864-39.492zm-7.106 24.442l-40.314 22.154l6.744 12.27l40.313-22.154zM99.72 282.774h-.002L18.372 442.53l6.123 18.83l77.264-151.737l16.038 8.168l-77.262 151.735l22.375-7.275l12.968-4.217l-6.986-21.556l21.496-6.97L83.392 408l21.52-6.998l-5.37-16.504l41.17-80.852l-40.992-20.873z" />



  </svg>



);



const LocationIcon = () => (



  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" style={{ color: "#374151" }}>



    <title>location</title>



    <path fill="currentColor" d="M19 9A7 7 0 1 0 5 9c0 1.387.409 2.677 1.105 3.765h-.008L12 22l5.903-9.235h-.007A6.97 6.97 0 0 0 19 9m-7 3a3 3 0 1 1 0-6a3 3 0 0 1 0 6" />



  </svg>



);



const PersonIcon = () => (



  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">



    <circle cx="12" cy="8" r="4" stroke="#374151" strokeWidth="2" />



    <path d="M4 21C4.8 16.8 7.5 14.5 12 14.5C16.5 14.5 19.2 16.8 20 21" stroke="#374151" strokeWidth="2" strokeLinecap="round" />



  </svg>



);



const PhoneIcon = () => (



  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">



    <path



      d="M6.6 3.5L8.8 3C9.4 2.9 9.9 3.2 10.1 3.7L11.1 6.2C11.3 6.7 11.2 7.2 10.8 7.6L9.3 9.1C10.2 11 11.8 12.7 13.7 13.6L15.2 12.1C15.6 11.7 16.1 11.6 16.6 11.8L19.1 12.8C19.6 13 19.9 13.5 19.8 14.1L19.3 16.3C19.2 16.8 18.8 17.2 18.4 17.4C17.5 17.8 16.6 18 15.7 18C10.3 18 6 13.7 6 8.3C6 7.4 6.2 6.5 6.6 5.6C6.8 5.2 6.2 3.5 6.6 3.5Z"



      stroke="#16A34A"



      strokeWidth="1.8"



      strokeLinecap="round"



      strokeLinejoin="round"



    />



  </svg>



);



const CardIcon = () => (



  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">



    <rect



      x="3"



      y="5"



      width="18"



      height="14"



      rx="2"



      stroke="#64748B"



      strokeWidth="2"



    />



    <path



      d="M3 9H21"



      stroke="#64748B"



      strokeWidth="2"



    />



    <path



      d="M7 14H11"



      stroke="#64748B"



      strokeWidth="2"



      strokeLinecap="round"



    />



  </svg>



);



const PaperclipIcon = () => (



  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">



    <path



      d="M8.5 12.5L14.7 6.3C16.1 4.9 18.3 4.9 19.7 6.3C21.1 7.7 21.1 9.9 19.7 11.3L11 20C8.8 22.2 5.2 22.2 3 20C0.8 17.8 0.8 14.2 3 12L10.4 4.6C12.1 2.9 14.9 2.9 16.6 4.6C18.3 6.3 18.3 9.1 16.6 10.8L9.8 17.6C8.8 18.6 7.2 18.6 6.2 17.6C5.2 16.6 5.2 15 6.2 14L12.5 7.7"



      stroke="#374151"



      strokeWidth="1.8"



      strokeLinecap="round"



      strokeLinejoin="round"



    />



  </svg>



);



const WrenchIcon = () => (



  <svg



    width="22"



    height="22"



    viewBox="0 0 24 24"



    fill="none"



    xmlns="http://www.w3.org/2000/svg"



    aria-hidden="true"



  >



    <g



      stroke="#D4AF37"



      strokeWidth="2"



      strokeLinecap="round"



      strokeLinejoin="round"



    >



      <path d="M6 6L10.5 10.5" />



      <path d="M6 6H3L2 3L3 2L6 3V6Z" />



      <path d="M19.259 2.74101L16.6314 5.36863C16.2354 5.76465 16.0373 5.96265 15.9632 6.19098C15.8979 6.39183 15.8979 6.60817 15.9632 6.80902C16.0373 7.03735 16.2354 7.23535 16.6314 7.63137L16.8686 7.86863C17.2646 8.26465 17.4627 8.46265 17.691 8.53684C17.8918 8.6021 18.1082 8.6021 18.309 8.53684C18.5373 8.46265 18.7354 8.26465 19.1314 7.86863L21.5893 5.41072C21.854 6.05488 22 6.76039 22 7.5C22 10.5376 19.5376 13 16.5 13C16.1338 13 15.7759 12.9642 15.4298 12.8959C14.9436 12.8001 14.7005 12.7521 14.5532 12.7668C14.3965 12.7824 14.3193 12.8059 14.1805 12.8802C14.0499 12.9501 13.919 13.081 13.657 13.343L6.5 20.5C5.67157 21.3284 4.32843 21.3284 3.5 20.5C2.67157 19.6716 2.67157 18.3284 3.5 17.5L10.657 10.343C10.919 10.081 11.0499 9.95005 11.1198 9.81949C11.1941 9.68068 11.2176 9.60347 11.2332 9.44681C11.2479 9.29945 11.1999 9.05638 11.1041 8.57024C11.0358 8.22406 11 7.86621 11 7.5C11 4.46243 13.4624 2 16.5 2C17.5055 2 18.448 2.26982 19.259 2.74101Z" />



      <path d="M12.0001 14.9999L17.5 20.4999C18.3284 21.3283 19.6716 21.3283 20.5 20.4999C21.3284 19.6715 21.3284 18.3283 20.5 17.4999L15.9753 12.9753C15.655 12.945 15.3427 12.8872 15.0408 12.8043C14.6517 12.6975 14.2249 12.7751 13.9397 13.0603L12.0001 14.9999Z" />



    </g>



  </svg>



);



const CameraScanIcon = () => (



  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">



    <g



      stroke="#8A6A00"



      strokeWidth="1.8"



      strokeLinecap="round"



      strokeLinejoin="round"



    >



      <path d="M7 4H5C4.4 4 4 4.4 4 5V7" />



      <path d="M17 4H19C19.6 4 20 4.4 20 5V7" />



      <path d="M7 20H5C4.4 20 4 19.6 4 19V17" />



      <path d="M17 20H19C19.6 20 20 19.6 20 19V17" />



      <rect x="7" y="7" width="10" height="10" rx="2" />



      <path d="M12 10V14M10 12H14" />



    </g>



  </svg>



);



const DocGreen = () => (



  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">



    <path



      d="M7 3H15L18 6V21H6V3H7Z"



      stroke="#15803D"



      strokeWidth="2"



    />



    <path



      d="M9 11H15M9 15H13"



      stroke="#15803D"



      strokeWidth="2"



      strokeLinecap="round"



    />



  </svg>



);



const CubeGold = () => (



  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">



    <path



      d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z"



      stroke="#B7791F"



      strokeWidth="2"



    />



    <path



      d="M8 6L16 10M12 12V21"



      stroke="#B7791F"



      strokeWidth="2"



    />



  </svg>



);



const PhotoGray = () => (



  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">



    <rect



      x="3"



      y="5"



      width="18"



      height="14"



      rx="2"



      stroke="#475569"



      strokeWidth="2"



    />



    <circle



      cx="9"



      cy="10"



      r="1.5"



      fill="#475569"



    />



    <path



      d="M5 17L10 12L14 15L17 12L19 14.5"



      stroke="#475569"



      strokeWidth="2"



      strokeLinecap="round"



      strokeLinejoin="round"



    />



  </svg>



);