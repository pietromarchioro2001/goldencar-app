"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AccessoPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setError(result.error || "Accesso non riuscito.");
        return;
      }
      router.replace("/home");
      router.refresh();
    } catch {
      setError("Connessione non disponibile. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  const styles = {
    main: {
      minHeight: "100vh",
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 20px",
      background: "#202124",
      color: "#f9fafb",
      fontFamily: "Inter, Arial, sans-serif",
      boxSizing: "border-box" as const,
    },
    form: {
      width: "100%",
      maxWidth: "390px",
      boxSizing: "border-box" as const,
      padding: "30px",
      borderRadius: "22px",
      border: "1px solid #3f4147",
      background: "#292b30",
      boxShadow: "0 18px 55px rgba(0,0,0,.28)",
    },
    brandRow: { display: "flex", alignItems: "center", gap: "14px", marginBottom: "28px" },
    logo: { display: "block", width: "54px", height: "54px", flex: "0 0 54px", objectFit: "contain" as const },
    title: { margin: 0, color: "#ffffff", fontSize: "22px", fontWeight: 800, letterSpacing: "1px" },
    subtitle: { margin: "5px 0 0", color: "#c2c5cc", fontSize: "14px" },
    label: { display: "block", marginBottom: "9px", color: "#f3f4f6", fontSize: "14px", fontWeight: 600 },
    input: {
      display: "block",
      width: "100%",
      height: "48px",
      boxSizing: "border-box" as const,
      border: "1px solid #555963",
      borderRadius: "11px",
      background: "#191a1e",
      color: "#ffffff",
      padding: "0 14px",
      fontSize: "16px",
      outline: "none",
    },
    button: {
      display: "block",
      width: "100%",
      minHeight: "48px",
      marginTop: "18px",
      padding: "12px 16px",
      border: 0,
      borderRadius: "11px",
      background: "#249447",
      color: "#ffffff",
      fontSize: "15px",
      fontWeight: 700,
      cursor: "pointer",
    },
    help: { margin: "17px 0 0", color: "#b7bbc4", fontSize: "12px", lineHeight: 1.5, textAlign: "center" as const },
    error: { marginTop: "13px", padding: "10px 12px", borderRadius: "9px", background: "#4c2024", color: "#fecaca", fontSize: "13px" },
  };

  return (
    <main style={styles.main}>
      <form onSubmit={submit} style={styles.form}>
        <div style={styles.brandRow}>
          <img src="/logo.png" alt="Goldencar" style={styles.logo} />
          <div>
            <h1 style={styles.title}>GOLDENCAR</h1>
            <p style={styles.subtitle}>Autorizza questo dispositivo</p>
          </div>
        </div>
        <label htmlFor="password" style={styles.label}>Password dispositivo</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Inserisci la password"
          style={styles.input}
        />
        {error && <p role="alert" style={styles.error}>{error}</p>}
        <button type="submit" disabled={loading || !password} style={{ ...styles.button, opacity: loading || !password ? 0.65 : 1 }}>
          {loading ? "Verifica in corso…" : "Autorizza dispositivo"}
        </button>
        <p style={styles.help}>L'accesso resta attivo su questo browser per 30 giorni.</p>
      </form>
    </main>
  );
}
