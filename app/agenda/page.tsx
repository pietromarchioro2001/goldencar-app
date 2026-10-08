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
  const [showModal, setShowModal] = useState(false);
  const [selectedHour, setSelectedHour] = useState(8);
  const [selectedMinute, setSelectedMinute] = useState(0);

  const [description, setDescription] = useState("");
  const today = new Date();

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

  type Appointment = { id: string; date: string; time: string; description: string };
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [saving, setSaving] = useState(false);

  const dateKey = (y: number, m: number, d: number) =>
    y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");

  useEffect(() => {
    void loadAppointments();
  }, []);

  async function loadAppointments() {
    const current = new Date();
    const cutoff = new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7);
    const cutoffKey = dateKey(cutoff.getFullYear(), cutoff.getMonth(), cutoff.getDate());

    const cleanup = await supabase.from("appointments").delete().lt("date", cutoffKey);
    if (cleanup.error) console.error("Errore pulizia appuntamenti:", cleanup.error);

    const { data, error } = await supabase
      .from("appointments")
      .select("id, date, time, description")
      .order("date", { ascending: true })
      .order("time", { ascending: true });

    if (error) {
      console.error("Errore caricamento appuntamenti:", error);
      return;
    }
    setAppointments((data || []) as Appointment[]);
  }

  async function saveAppointment() {
    if (selectedDay === null || !description.trim()) {
      alert("Inserisci la descrizione dell'appuntamento.");
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from("appointments")
      .insert({
        id: crypto.randomUUID(),
        date: dateKey(year, month, selectedDay),
        time: String(selectedHour).padStart(2, "0") + ":" + String(selectedMinute).padStart(2, "0") + ":00",
        description: description.trim(),
      })
      .select("id, date, time, description")
      .single();

    if (error) {
      console.error("Errore salvataggio appuntamento:", error);
      alert("Impossibile salvare l'appuntamento.");
      setSaving(false);
      return;
    }

    setAppointments((current) =>
      [...current, data as Appointment].sort(
        (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)
      )
    );
    setDescription("");
    setShowModal(false);
    setSaving(false);
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
                <button
                  key={hour}
                  onClick={() => {
                    setSelectedHour(hour);
                    setSelectedMinute(0);
                    setDescription("");
                    setShowModal(true);
                  }}
                  style={{
                    width: "100%",
                    height: 64,
                    border: "none",
                    borderBottom:
                      hour !== 23 ? "1px solid #E5E7EB" : "none",
                    background: "#FFFFFF",
                    display: "flex",
                    padding: 0,
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: 72,
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "flex-start",
                      paddingTop: 10,
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#64748B",
                    }}
                  >
                    {String(hour).padStart(2, "0")}:00
                  </div>

                  <div
                    style={{
                      flex: 1,
                      borderLeft: "1px solid #E5E7EB",
                      position: "relative",
                    }}
                  >
                    {apps.map((app) => (
                      <div
                        style={{
                          position: "absolute",
                          left: 8,
                          right: 8,
                          top: 6,
                          bottom: 6,
                          borderRadius: 14,
                          background: "#D4AF37",
                          padding: "8px 12px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
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
                      </div>
                    ))}
                  </div>
                </button>
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
            zIndex: 1000,
          }}
          onClick={() => setShowModal(false)}
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
              NUOVO APPUNTAMENTO
            </h2>

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