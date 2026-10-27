"use client";
import { useEffect, useRef, useState } from "react";

type DialogItem = { id: number; message: string; kind: "alert" | "confirm"; resolve?: (value: boolean) => void };
declare global { interface Window { goldencarConfirm?: (message: string) => Promise<boolean>; } }

export default function AppDialogs() {
  const [dialogs, setDialogs] = useState<DialogItem[]>([]);
  const nextId = useRef(0);
  const originalAlert = useRef<typeof window.alert | null>(null);
  const closeDialog = (id: number, result = false) => {
    setDialogs((items) => {
      const target = items.find((item) => item.id === id);
      if (target?.kind === "confirm") target.resolve?.(result);
      return items.filter((item) => item.id !== id);
    });
  };
  useEffect(() => {
    originalAlert.current = window.alert;
    window.alert = (message?: unknown) => {
      const id = ++nextId.current;
      setDialogs((items) => [...items, { id, kind: "alert", message: message == null ? "" : String(message) }]);
    };
    window.goldencarConfirm = (message: string) => new Promise<boolean>((resolve) => {
      const id = ++nextId.current;
      setDialogs((items) => [...items, { id, kind: "confirm", message: String(message), resolve }]);
    });
    return () => {
      if (originalAlert.current) window.alert = originalAlert.current;
      delete window.goldencarConfirm;
    };
  }, []);
  useEffect(() => {
    if (!dialogs.length) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDialog(dialogs[dialogs.length - 1].id, false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialogs]);
  if (!dialogs.length) return null;
  const current = dialogs[0];
  return <div className="gc-dialog-backdrop" role="presentation"><section className="gc-dialog" role={current.kind === "confirm" ? "alertdialog" : "dialog"} aria-modal="true" aria-labelledby="gc-dialog-title" aria-describedby="gc-dialog-message"><div className="gc-dialog-icon" aria-hidden="true">{current.kind === "confirm" ? "?" : "i"}</div><h2 id="gc-dialog-title">{current.kind === "confirm" ? "Conferma operazione" : "Goldencar"}</h2><p id="gc-dialog-message">{current.message}</p><div className="gc-dialog-actions">{current.kind === "confirm" && <button className="gc-dialog-cancel" type="button" onClick={() => closeDialog(current.id, false)}>Annulla</button>}<button type="button" autoFocus onClick={() => closeDialog(current.id, current.kind === "confirm")}>{current.kind === "confirm" ? "Conferma" : "Ho capito"}</button></div></section></div>;
}