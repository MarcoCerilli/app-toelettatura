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
    <div className="min-h-screen bg-[#f6efe6] text-stone-800 flex flex-col justify-center px-4 py-10">
      <div className="max-w-md w-full mx-auto space-y-5">
        <div className="flex items-center justify-between text-xs">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-stone-600 hover:text-amber-950 font-bold transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Torna al sito cliente
          </Link>
          <span className="inline-flex items-center gap-1 text-amber-800 font-bold">
            <ShieldCheck className="w-3.5 h-3.5" /> Area Riservata
          </span>
        </div>

        <div className="bg-white border border-amber-200/80 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-900 text-amber-50 flex items-center justify-center shrink-0 shadow-xs">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-black text-lg text-stone-900 leading-tight">
                {SALON_CONFIG.salonName}
              </h1>
              <p className="text-xs text-stone-500">
                Accesso staff · Agenda, postazioni e listino
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="admin-email" className="block text-xs font-bold text-stone-700">
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
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#fbf7f1] border border-amber-200 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="admin-password" className="block text-xs font-bold text-stone-700">
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
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#fbf7f1] border border-amber-200 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
            </div>

            {error && (
              <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-2xl bg-amber-800 hover:bg-amber-900 text-white text-sm font-black inline-flex items-center justify-center gap-2 transition shadow-sm disabled:opacity-60"
            >
              <Lock className="w-4 h-4" />
              {loading ? "Verifica in corso..." : "Accedi al Gestionale"}
            </button>
          </form>

          {demoMode && (
            <div className="pt-4 border-t border-amber-100 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] text-stone-500">
                <span className="inline-flex items-center gap-1 font-bold text-amber-800">
                  <Sparkles className="w-3.5 h-3.5" /> Modalità Test attiva
                </span>
                <span>Sessione protetta</span>
              </div>
              <button
                type="button"
                onClick={fillDemoCredentials}
                className="w-full py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 text-xs font-bold inline-flex items-center justify-center gap-1.5 border border-amber-200 transition"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-800" /> Compila credenziali di test
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
