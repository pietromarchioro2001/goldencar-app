"use client";
import { useEffect, useRef, useState } from "react";
type AlertItem = { id: number; message: string };
export default function AppDialogs() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const nextId = useRef(0);
  const originalAlert = useRef<typeof window.alert | null>(null);
  useEffect(() => {
    originalAlert.current = window.alert;
    window.alert = (message?: unknown) => {
      const id = ++nextId.current;
      setAlerts((items) => [...items, { id, message: message == null ? "" : String(message) }]);
    };
    return () => { if (originalAlert.current) window.alert = originalAlert.current; };
  }, []);
  const closeAlert = (id: number) => setAlerts((items) => items.filter((item) => item.id !== id));
  useEffect(() => {
    if (!alerts.length) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") closeAlert(alerts[alerts.length - 1].id); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [alerts]);
  if (!alerts.length) return null;
  const current = alerts[0];
  return <div className="gc-dialog-backdrop" role="presentation"><section className="gc-dialog" role="alertdialog" aria-modal="true" aria-labelledby="gc-dialog-title" aria-describedby="gc-dialog-message"><div className="gc-dialog-icon" aria-hidden="true">i</div><h2 id="gc-dialog-title">Goldencar</h2><p id="gc-dialog-message">{current.message}</p><div className="gc-dialog-actions"><button type="button" autoFocus onClick={() => closeAlert(current.id)}>Ho capito</button></div></section></div>;
}