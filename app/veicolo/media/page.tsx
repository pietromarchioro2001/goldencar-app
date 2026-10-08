"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function VehicleMediaViewer() {
  const params = useSearchParams();
  const key = params.get("key") || "";
  const name = params.get("name") || "File";
  const type = params.get("type") || "application/octet-stream";
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!key) {
      setError("File non valido.");
      return;
    }

    let active = true;
    fetch("/api/r2/file?key=" + encodeURIComponent(key))
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data?.downloadUrl) {
          throw new Error(data?.error || "Impossibile aprire il file.");
        }
        if (active) setUrl(data.downloadUrl);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Impossibile aprire il file.");
      });

    return () => {
      active = false;
    };
  }, [key]);

  const scarica = () => {
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const isImage = type.startsWith("image/");
  const isVideo = type.startsWith("video/");

  return (
    <main style={{
      minHeight: "100vh",
      background: "#111827",
      color: "#FFFFFF",
      display: "flex",
      flexDirection: "column",
    }}>
      <header style={{
        minHeight: 68,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        boxSizing: "border-box",
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 15,
            fontWeight: 800,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {name}
          </div>
          <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>
            Goldencar · Media veicolo
          </div>
        </div>

        <button
          type="button"
          onClick={scarica}
          disabled={!url}
          style={{
            flexShrink: 0,
            height: 42,
            padding: "0 16px",
            border: "none",
            borderRadius: 12,
            background: "#D4AF37",
            color: "#111827",
            fontWeight: 900,
            cursor: url ? "pointer" : "default",
            opacity: url ? 1 : 0.5,
          }}
        >
          SCARICA
        </button>
      </header>

      <div style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        boxSizing: "border-box",
      }}>
        {error ? (
          <div style={{
            background: "#FFFFFF",
            color: "#111827",
            borderRadius: 18,
            padding: 28,
            textAlign: "center",
            maxWidth: 360,
          }}>
            {error}
          </div>
        ) : !url ? (
          <div style={{ opacity: 0.7 }}>Caricamento...</div>
        ) : isImage ? (
          <img
            src={url}
            alt={name}
            style={{ maxWidth: "100%", maxHeight: "82vh", objectFit: "contain", borderRadius: 12 }}
          />
        ) : isVideo ? (
          <video
            src={url}
            controls
            playsInline
            style={{ maxWidth: "100%", maxHeight: "82vh", borderRadius: 12 }}
          />
        ) : type === "application/pdf" ? (
          <iframe
            src={url}
            title={name}
            style={{ width: "100%", height: "82vh", border: "none", borderRadius: 12, background: "#FFFFFF" }}
          />
        ) : (
          <div style={{
            background: "#FFFFFF",
            color: "#111827",
            borderRadius: 18,
            padding: 32,
            textAlign: "center",
            maxWidth: 380,
          }}>
            <div style={{ fontSize: 52 }}>▤</div>
            <div style={{ marginTop: 10, fontWeight: 900, wordBreak: "break-word" }}>
              {name}
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: "#64748B" }}>
              Questo documento non può essere visualizzato direttamente nel browser.
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
