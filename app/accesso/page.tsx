"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AccessoPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/device", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }), cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.ok) { setError(result.error || "Accesso non riuscito."); return; }
      const next = params.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/home");
      router.refresh();
    } catch { setError("Connessione non disponibile. Riprova."); }
    finally { setLoading(false); }
  }

  return <main className="min-h-screen flex items-center justify-center bg-slate-950 px-5 py-10 text-white"><form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-7 shadow-2xl"><div className="mb-6 flex items-center gap-3"><img src="/logo.png" alt="Goldencar" className="h-12 w-12 rounded-xl object-contain"/><div><h1 className="text-xl font-bold tracking-wide">GOLDENCAR</h1><p className="text-sm text-slate-400">Autorizza questo dispositivo</p></div></div><label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-200">Password iniziale</label><input id="password" type="password" autoComplete="current-password" required autoFocus value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-base outline-none focus:border-emerald-500" placeholder="Inserisci la password"/>{error && <p role="alert" className="mt-3 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">{error}</p>}<button type="submit" disabled={loading || !password} className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white disabled:opacity-50">{loading ? "Verifica in corso…" : "Autorizza dispositivo"}</button><p className="mt-4 text-xs leading-5 text-slate-400">L'accesso resta attivo su questo browser per 30 giorni.</p></form></main>;
}
