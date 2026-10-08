"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import BottomBar from "@/components/BottomBar";

const MONTHS = [
  "GENNAIO","FEBBRAIO","MARZO","APRILE","MAGGIO","GIUGNO",
  "LUGLIO","AGOSTO","SETTEMBRE","OTTOBRE","NOVEMBRE","DICEMBRE"
];

const WEEK = ["LUN","MAR","MER","GIO","VEN","SAB","DOM"];

export default function Agenda() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  type Appointment = { id: string; date: string; time: string; description: string };
  const [showModal, setShowModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [selectedHour, setSelectedHour] = useState(8);
  const [selectedMinute, setSelectedMinute] = useState(0);

  const [description, setDescription] = useState("");

  const currentDay =
    today.getFullYear() === year && today.getMonth() === month
      ? today.getDate()
      : null;

  const { cells } = useMemo(() => {
    const first = new Date(year, month, 1);
    const days = new Date(year, month + 1, 0).getDate();

    const start = (first.getDay() + 6) % 7;

    const grid: (number | null)[] = [];
    for (let i = 0; i < start; i++) grid.push(null);
    for (let d = 1; d <= days; d++) grid.push(d);
    while (grid.length % 7 !== 0) grid.push(null);

    return { cells: grid };
  }, [month, year]);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const dateKey = (y: number, m: number, d: number) =>
    y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");

  function appointmentDateTime(
    y: number,
    m: number,
    d: number,
    hour: number,
    minute: number
  ) {
    return new Date(y, m, d, hour, minute, 0).toISOString();
  }

  function mapAppointment(row: any): Appointment {
    const dateTime = new Date(String(row.data_ora));
    return {
      id: String(row.id ?? ""),
      date: dateKey(dateTime.getFullYear(), dateTime.getMonth(), dateTime.getDate()),
      time:
        String(dateTime.getHours()).padStart(2, "0") +
        ":" +
        String(dateTime.getMinutes()).padStart(2, "0"),
      description: String(row.descrizione ?? row.titolo ?? ""),
    };
  }

  useEffect(() => {
    void loadAppointments();
  }, []);

  async function loadAppointments() {
    const current = new Date();
    const cutoff = new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate() - 7,
      0,
      0,
      0
    );

    const cleanup = await supabase
      .from("appointments")
      .delete()
      .lt("data_ora", cutoff.toISOString());

    if (cleanup.error) {
      console.error("Errore pulizia appuntamenti:", cleanup.error);
    }

    const { data, error } = await supabase
      .from("appointments")
      .select("id, vehicle_id, titolo, descrizione, data_ora")
      .order("data_ora", { ascending: true });

    if (error) {
      console.error("Errore caricamento appuntamenti:", error);
      return;
    }

    setAppointments((data ?? []).map(mapAppointment));
  }


  function openNewAppointment(day: number, hour: number) {
    setEditingAppointment(null);
    setSelectedDay(day);
    setSelectedHour(hour);
    setSelectedMinute(0);
    setDescription("");
    setShowModal(true);
  }

  function openEditAppointment(app: Appointment) {
    const [hour, minute] = app.time.slice(0, 5).split(":").map(Number);
    const [appYear, appMonth, appDay] = app.date.split("-").map(Number);

    setEditingAppointment(app);
    setYear(appYear);
    setMonth(appMonth - 1);
    setSelectedDay(appDay);
    setSelectedHour(hour);
    setSelectedMinute(minute);
    setDescription(app.description);
    setShowModal(true);
  }

  function closeModal() {
    if (saving || deleting) return;
    setShowModal(false);
    setEditingAppointment(null);
    setDescription("");
  }

  async function saveAppointment() {
    if (selectedDay === null || !description.trim()) {
      alert("Inserisci la descrizione dell'appuntamento.");
      return;
    }

    setSaving(true);

    const dataOra = appointmentDateTime(
      year,
      month,
      selectedDay,
      selectedHour,
      selectedMinute
    );

    if (editingAppointment) {
      const { data, error } = await supabase
        .from("appointments")
        .update({
          titolo: description.trim(),
          descrizione: description.trim(),
          data_ora: dataOra,
        })
        .eq("id", editingAppointment.id)
        .select("id, vehicle_id, titolo, descrizione, data_ora")
        .single();

      if (error) {
        console.error("Errore modifica appuntamento:", error);
        alert("Impossibile modificare l'appuntamento.");
        setSaving(false);
        return;
      }

      const updatedAppointment = mapAppointment(data);

      setAppointments((current) =>
        current
          .map((appointment) =>
            appointment.id === editingAppointment.id
              ? updatedAppointment
              : appointment
          )
          .sort(
            (a, b) =>
              a.date.localeCompare(b.date) || a.time.localeCompare(b.time)
          )
      );
    } else {
      const { data, error } = await supabase
        .from("appointments")
        .insert({
          id: crypto.randomUUID(),
          titolo: description.trim(),
          descrizione: description.trim(),
          data_ora: dataOra,
        })
        .select("id, vehicle_id, titolo, descrizione, data_ora")
        .single();

      if (error) {
        console.error("Errore salvataggio appuntamento:", error);
        alert("Impossibile salvare l'appuntamento.");
        setSaving(false);
        return;
      }

      setAppointments((current) =>
        [...current, mapAppointment(data)].sort(
          (a, b) =>
            a.date.localeCompare(b.date) || a.time.localeCompare(b.time)
        )
      );
    }

    setDescription("");
    setShowModal(false);
    setEditingAppointment(null);
    setSaving(false);
  }

  async function deleteAppointment() {
    if (!editingAppointment) return;

    if (!window.confirm("Eliminare definitivamente questo appuntamento?")) return;

    setDeleting(true);

    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("id", editingAppointment.id);

    if (error) {
      console.error("Errore eliminazione appuntamento:", error);
      alert("Impossibile eliminare l'appuntamento.");
      setDeleting(false);
      return;
    }

    setAppointments((current) =>
      current.filter((appointment) => appointment.id !== editingAppointment.id)
    );
    setShowModal(false);
    setEditingAppointment(null);
    setDescription("");
    setDeleting(false);
  }

  function previousMonth() {
    setSelectedDay(null);

    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    setSelectedDay(null);

    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  return (
    <main
      style={{
        maxWidth: 430,
        margin: "0 auto",
        minHeight: "100vh",
        background: "#F3F4F6",
        paddingBottom: 110,
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
          AGENDA
        </h1>
      </div>

      {/* TITOLO MESE */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 22px",
        }}
      >
        <button
          onClick={previousMonth}
          style={arrowStyle}
        >
          ‹
        </button>

        <div
          style={{
            fontSize: 20,
            fontWeight: 900,
            color: "#111827",
            textAlign: "center",
          }}
        >
          {MONTHS[month]} {year}
        </div>

        <button
          onClick={nextMonth}
          style={arrowStyle}
        >
          ›
        </button>
      </div>

      {/* CALENDARIO */}
      <div style={{ padding: "22px 18px 0" }}>
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: 26,
            padding: 14,
            boxShadow: "0 4px 14px rgba(15,23,42,.08)",
          }}
        >
          {/* Giorni settimana */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7,1fr)",
              marginBottom: 10,
            }}
          >
            {WEEK.map((w) => (
              <div
                key={w}
                style={{
                  textAlign: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#64748B",
                  paddingBottom: 8,
                }}
              >
                {w}
              </div>
            ))}
          </div>

          {/* Celle */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7,1fr)",
              gap: 8,
            }}
          >
            {cells.map((day, i) => {
              const active = selectedDay === day;
              const isToday = currentDay === day;

              return (
                <button
                  key={i}
                  disabled={!day}
                  onClick={() => day && setSelectedDay(day)}
                  style={{
                    aspectRatio: "1",
                    border: "none",
                    borderRadius: 16,
                    background:
                    day == null
                      ? "transparent"
                      : active
                      ? "#D4AF37"      // selezionato
                      : isToday
                      ? "#DCEFE4"      // oggi
                      : "#F8FAFC",
                    color: active ? "#08142F" : "#111827",
                    fontSize: 18,
                    fontWeight: 800,
                    cursor: day ? "pointer" : "default",
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* AGENDA DEL GIORNO */}
      {selectedDay && (
        <div style={{ padding: "24px 18px 0" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 900,
                color: "#111827",
              }}
            >
              {selectedDay} {MONTHS[month]}
            </h2>

            <button
              onClick={() => setSelectedDay(null)}
              style={{
                border: "none",
                background: "transparent",
                color: "#64748B",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Chiudi
            </button>
          </div>

          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 24,
              overflow: "hidden",
              boxShadow: "0 4px 14px rgba(15,23,42,.08)",
            }}
          >
            {Array.from({ length: 24 }).map((_, hour) => {
              const apps = appointments.filter(
                (a) =>
                  a.date === dateKey(year, month, selectedDay) &&
                  Number(a.time.slice(0, 2)) === hour
              );

              return (
                <div
                  key={hour}
                  style={{
                    width: "100%",
                    minHeight: 64,
                    borderBottom: hour !== 23 ? "1px solid #E5E7EB" : "none",
                    background: "#FFFFFF",
                    display: "flex",
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openNewAppointment(selectedDay, hour);
                    }}
                    style={{
                      width: 72,
                      minHeight: 64,
                      border: "none",
                      background: "#FFFFFF",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "flex-start",
                      padding: "10px 0 0",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#64748B",
                      cursor: "pointer",
                    }}
                  >
                    {String(hour).padStart(2, "0")}:00
                  </button>

                  <div
                    style={{
                      flex: 1,
                      borderLeft: "1px solid #E5E7EB",
                      position: "relative",
                    }}
                  >
                    {apps.map((app) => (
                      <button
                        key={app.id}
                        onClick={() => openEditAppointment(app)}
                        style={{
                          width: "100%",
                          minHeight: 52,
                          border: "none",
                          borderRadius: 14,
                          background: "#D4AF37",
                          padding: "8px 12px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
                          alignItems: "flex-start",
                          textAlign: "left",
                          cursor: "pointer",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 800,
                            color: "#111827",
                          }}
                        >
                          {app.time.slice(0, 5)}
                        </span>

                        <span
                          style={{
                            fontSize: 12,
                            color: "#1F2937",
                          }}
                        >
                          {app.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.35)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 2000,
          }}
          onClick={closeModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 430,
              background: "#F8FAFC",
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: 22,
            }}
          >
            <div
              style={{
                width: 48,
                height: 5,
                borderRadius: 99,
                background: "#D1D5DB",
                margin: "0 auto 18px",
              }}
            />

            <h2
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 900,
                color: "#111827",
              }}
            >
              {editingAppointment ? "MODIFICA APPUNTAMENTO" : "NUOVO APPUNTAMENTO"}
            </h2>
            {editingAppointment && (
              <button
                onClick={() => void deleteAppointment()}
                disabled={deleting || saving}
                aria-label="Elimina appuntamento"
                title="Elimina appuntamento"
                style={{
                  width: 42,
                  height: 42,
                  flexShrink: 0,
                  border: "none",
                  borderRadius: 13,
                  background: "#FEE2E2",
                  color: "#B91C1C",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: deleting || saving ? "default" : "pointer",
                }}
              >
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
              </button>
            )}

            <p
              style={{
                marginTop: 6,
                color: "#64748B",
                fontWeight: 600,
              }}
            >
              {selectedDay} {MONTHS[month]} {year}
            </p>

            {/* ORARIO */}
<div style={{ marginTop: 22 }}>
  <div
    style={{
      marginBottom: 10,
      fontSize: 13,
      fontWeight: 700,
      color: "#475569",
    }}
  >
    Orario
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 36px 1fr",
        gap: 12,
        alignItems: "center",
      }}
    >
      {/* ORE */}
      <select
        value={selectedHour}
        onChange={(e) => setSelectedHour(Number(e.target.value))}
        style={{
          height: 54,
          borderRadius: 16,
          border: "1px solid #E5E7EB",
          background: "#FFFFFF",
          fontSize: 22,
          fontWeight: 800,
          textAlign: "center",
          color: "#111827",
        }}
      >
        {Array.from({ length: 24 }).map((_, h) => (
          <option key={h} value={h}>
            {String(h).padStart(2, "0")}
          </option>
        ))}
      </select>

      <div
        style={{
          textAlign: "center",
          fontSize: 28,
          fontWeight: 800,
          color: "#64748B",
        }}
      >
        :
      </div>

      {/* MINUTI */}
      <select
        value={selectedMinute}
        onChange={(e) => setSelectedMinute(Number(e.target.value))}
        style={{
          height: 54,
          borderRadius: 16,
          border: "1px solid #E5E7EB",
          background: "#FFFFFF",
          fontSize: 22,
          fontWeight: 800,
          textAlign: "center",
          color: "#111827",
        }}
      >
        {[0, 15, 30, 45].map((m) => (
          <option key={m} value={m}>
            {String(m).padStart(2, "0")}
          </option>
        ))}
      </select>
    </div>
  </div>

            {/* DESCRIZIONE */}
            <div style={{ marginTop: 18 }}>
              <div
                style={{
                  marginBottom: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#475569",
                }}
              >
                Descrizione
              </div>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Es. Tagliando Golf di Mario Rossi"
                style={{
                  width: "100%",
                  height: 120,
                  borderRadius: 16,
                  border: "1px solid #E5E7EB",
                  padding: 14,
                  resize: "none",
                  fontSize: 15,
                  fontFamily: "inherit",
                  background: "#FFFFFF",
                  color: "#111827",
                }}
              />
            </div>

            {/* SALVA */}
            <button
              onClick={() => void saveAppointment()}
              disabled={saving}
              style={{
                marginTop: 24,
                width: "100%",
                height: 56,
                border: "none",
                borderRadius: 18,
                background: "#D4AF37",
                color: "#08142F",
                fontSize: 17,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              SALVA
            </button>
          </div>
        </div>
      )}

      <BottomBar />
    </main>
  );
}

const arrowStyle: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 14,
  border: "none",
  background: "#FFFFFF",
  color: "#111827",
  fontSize: 28,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(0,0,0,.08)",
};