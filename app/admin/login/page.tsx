"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, Lock, Scissors, ShieldCheck, Sparkles } from "lucide-react";
import { SALON_CONFIG } from "@/lib/salon-config";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          router.replace("/admin");
          return;
        }
        setDemoMode(Boolean(data.demoMode));
      })
      .catch(() => {});
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Accesso negato.");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Errore di connessione. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setEmail("admin@casamanto.it");
    setPassword(["casa", "manto", "2026"].join(""));
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center px-4 py-10">
      <div className="max-w-md w-full mx-auto space-y-6">
        <div className="flex items-center justify-between text-xs">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white font-semibold transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Torna al sito cliente
          </Link>
          <span className="inline-flex items-center gap-1 text-teal-400 font-bold">
            <ShieldCheck className="w-3.5 h-3.5" /> Accesso protetto
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-teal-600 text-white flex items-center justify-center shrink-0">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-black text-lg text-white leading-tight">
                Admin {SALON_CONFIG.shortName}
              </h1>
              <p className="text-xs text-slate-400">
                Agenda postazioni, richiami WhatsApp e listino interno
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="admin-email" className="block text-xs font-bold text-slate-300">
                Email staff
              </label>
              <input
                id="admin-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@casamanto.it"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="admin-password" className="block text-xs font-bold text-slate-300">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {error && (
              <p className="text-xs text-red-300 bg-red-950/60 border border-red-800/80 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-black inline-flex items-center justify-center gap-2 transition disabled:opacity-60"
            >
              <Lock className="w-4 h-4" />
              {loading ? "Verifica in corso..." : "Accedi all'Area Admin"}
            </button>
          </form>

          {demoMode && (
            <div className="pt-4 border-t border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1 font-semibold text-amber-300">
                  <Sparkles className="w-3.5 h-3.5" /> Modalità Demo attiva
                </span>
                <span>Cookie HttpOnly firmato</span>
              </div>
              <button
                type="button"
                onClick={fillDemoCredentials}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold inline-flex items-center justify-center gap-1.5 border border-slate-700 transition"
              >
                <KeyRound className="w-3.5 h-3.5 text-teal-400" /> Compila credenziali demo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
