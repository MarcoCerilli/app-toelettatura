"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bot,
  Calendar,
  CheckCircle2,
  Clock,
  Columns3,
  Dog,
  Euro,
  ExternalLink,
  Globe,
  List,
  LogOut,
  MessageSquare,
  Monitor,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Scissors,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { SALON_CONFIG } from "@/lib/salon-config";
import type { GroomingBookingStatus } from "@/lib/grooming-bookings";
import type { BookingRecord, RecallItem, SalonService } from "@/lib/server-store";

interface AdminDashboardClientProps {
  userEmail: string;
  userName: string;
}

type Station = "Vasca" | "Tosatura" | "Finishing";
type AdminTab = "agenda" | "clienti" | "richiami" | "listino" | "nuovo";

const STATIONS: Station[] = ["Vasca", "Tosatura", "Finishing"];
const STATUS_ORDER: GroomingBookingStatus[] = [
  "Confermato WhatsApp",
  "In arrivo",
  "In salone",
  "Completato",
];

function cleanPhoneForWa(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("3")) return `39${digits}`;
  return digits;
}

function sourceBadge(source?: BookingRecord["source"]) {
  if (source === "bot") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-800 border border-violet-200">
        <Bot className="w-3 h-3" /> Bot AI
      </span>
    );
  }
  if (source === "admin") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
        <Monitor className="w-3 h-3" /> Banco
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
      <Globe className="w-3 h-3" /> Sito Web
    </span>
  );
}

export function AdminDashboardClient({ userEmail, userName }: AdminDashboardClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>("agenda");
  const [agendaView, setAgendaView] = useState<"lista" | "postazioni">("lista");
  const [stationFilter, setStationFilter] = useState<"tutte" | Station>("tutte");
  const [statusFilter, setStatusFilter] = useState<"tutti" | GroomingBookingStatus>("tutti");
  const [sourceFilter, setSourceFilter] = useState<"tutti" | "bot" | "sito" | "admin">("tutti");
  const [searchQuery, setSearchQuery] = useState("");

  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [recalls, setRecalls] = useState<RecallItem[]>([]);
  const [services, setServices] = useState<SalonService[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("--:--:--");
  const [toast, setToast] = useState<string | null>(null);

  // Inline note editing & delete confirmation
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Manual booking form
  const [newPet, setNewPet] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newSize, setNewSize] = useState<"Piccola" | "Media" | "Grande">("Media");
  const [newService, setNewService] = useState("Tosatura completa");
  const [newTime, setNewTime] = useState("Oggi ore 15:00");
  const [newNotes, setNewNotes] = useState("");

  // New recall form
  const [recallPet, setRecallPet] = useState("");
  const [recallOwner, setRecallOwner] = useState("");
  const [recallPhone, setRecallPhone] = useState("");
  const [recallDue, setRecallDue] = useState("Manto a 7 settimane");

  // Service editing state
  const [editingServices, setEditingServices] = useState<
    Record<string, { price: string; duration: string; desc: string }>
  >({});

  const knownIdsRef = useRef<Set<string> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((curr) => (curr === msg ? null : curr)), 4500);
  }, []);

  const loadAll = useCallback(
    async (silent = false) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const [bRes, rRes, sRes] = await Promise.all([
          fetch("/api/bookings", { cache: "no-store" }),
          fetch("/api/recalls", { cache: "no-store" }),
          fetch("/api/services", { cache: "no-store" }),
        ]);

        if (bRes.status === 401 || rRes.status === 401) {
          router.replace("/admin/login");
          return;
        }

        const [bData, rData, sData] = await Promise.all([
          bRes.json(),
          rRes.json(),
          sRes.json(),
        ]);

        if (Array.isArray(bData.bookings)) {
          const incoming = bData.bookings as BookingRecord[];
          if (knownIdsRef.current !== null) {
            const newOnes = incoming.filter((b) => !knownIdsRef.current!.has(b.id));
            if (newOnes.length > 0) {
              const latest = newOnes[0];
              showToast(
                `Nuova prenotazione ricevuta${latest.source === "bot" ? " dal Bot AI" : ""}: ${latest.pet} (${latest.time})`
              );
            }
          }
          knownIdsRef.current = new Set(incoming.map((b) => b.id));
          setBookings(incoming);
        }

        if (Array.isArray(rData.recalls)) {
          setRecalls(rData.recalls);
        }

        if (Array.isArray(sData.services)) {
          setServices(sData.services);
          setEditingServices((prev) => {
            if (Object.keys(prev).length > 0 && silent) return prev;
            const next: Record<string, { price: string; duration: string; desc: string }> = {};
            for (const s of sData.services as SalonService[]) {
              next[s.id] = {
                price: String(s.basePrice),
                duration: String(s.durationMin),
                desc: s.desc,
              };
            }
            return next;
          });
        }

        setLastUpdated(
          new Date().toLocaleTimeString("it-IT", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        );
      } catch {
        if (!silent) showToast("Errore nel caricamento dei dati.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router, showToast]
  );

  useEffect(() => {
    loadAll(false);
  }, [loadAll]);

  // Auto-refresh every 10s & on window focus so Bot/Client bookings appear immediately
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadAll(true);
    }, 10000);
    const onFocus = () => loadAll(true);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [autoRefresh, loadAll]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  };

  const updateBookingPatch = async (
    id: string,
    patch: Partial<Pick<BookingRecord, "status" | "station" | "notes">>,
    feedback?: string
  ) => {
    const res = await fetch(`/api/bookings/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const data = await res.json();
      setBookings((prev) => prev.map((b) => (b.id === id ? data.booking : b)));
      if (feedback) showToast(feedback);
    }
  };

  const cycleStatus = (row: BookingRecord) => {
    const idx = STATUS_ORDER.indexOf(row.status);
    const nextStatus = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
    updateBookingPatch(row.id, { status: nextStatus }, `${row.pet}: stato → "${nextStatus}"`);
  };

  const removeBooking = async (id: string, pet: string) => {
    const res = await fetch(`/api/bookings/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) {
      setBookings((prev) => prev.filter((b) => b.id !== id));
      knownIdsRef.current?.delete(id);
      setConfirmDeleteId(null);
      showToast(`Appuntamento di ${pet} eliminato.`);
    }
  };

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pet: newPet.trim() || "Teo (Barboncino)",
        owner: newOwner.trim() || "Cliente al banco",
        phone: newPhone.trim() || "+39 347 220 1188",
        size: newSize,
        service: newService,
        time: newTime,
        notes: newNotes.trim() || undefined,
        source: "admin",
      }),
    });
    if (res.ok) {
      const data = await res.json();
      knownIdsRef.current?.add(data.booking.id);
      setBookings((prev) => [data.booking, ...prev]);
      setNewPet("");
      setNewOwner("");
      setNewPhone("");
      setNewNotes("");
      setTab("agenda");
      showToast(`Appuntamento per ${data.booking.pet} aggiunto in agenda.`);
    }
  };

  const handleSendRecall = async (item: RecallItem) => {
    const res = await fetch(`/api/recalls/${encodeURIComponent(item.id)}`, {
      method: "PATCH",
    });
    if (res.ok) {
      const data = await res.json();
      setRecalls((prev) => prev.map((r) => (r.id === item.id ? data.recall : r)));
      showToast(`Richiamo registrato come inviato a ${item.owner} (${item.pet}).`);
    }
  };

  const handleAddRecall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recallPet.trim() || !recallOwner.trim()) return;
    const res = await fetch("/api/recalls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pet: recallPet.trim(),
        owner: recallOwner.trim(),
        phone: recallPhone.trim() || "+39 347 000 0000",
        due: recallDue.trim() || "Manto a 7 settimane",
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setRecalls((prev) => [data.recall, ...prev]);
      setRecallPet("");
      setRecallOwner("");
      setRecallPhone("");
      showToast(`Richiamo aggiunto per ${data.recall.pet}.`);
    }
  };

  const handleSaveService = async (id: string) => {
    const draft = editingServices[id];
    if (!draft) return;
    const basePrice = Number(draft.price);
    const durationMin = Number(draft.duration);
    if (!Number.isFinite(basePrice) || basePrice <= 0 || !Number.isFinite(durationMin) || durationMin < 10) {
      showToast("Inserisci prezzo e durata validi.");
      return;
    }
    const res = await fetch("/api/services", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, basePrice, durationMin, desc: draft.desc }),
    });
    if (res.ok) {
      const data = await res.json();
      setServices((prev) => prev.map((s) => (s.id === id ? data.service : s)));
      showToast(`Listino "${data.service.title}" aggiornato anche sul sito cliente e sul Bot.`);
    }
  };

  const visibleBookings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return bookings.filter((b) => {
      if (stationFilter !== "tutte" && b.station !== stationFilter) return false;
      if (statusFilter !== "tutti" && b.status !== statusFilter) return false;
      if (sourceFilter !== "tutti" && (b.source || "sito") !== sourceFilter) return false;
      if (
        q &&
        !b.pet.toLowerCase().includes(q) &&
        !b.owner.toLowerCase().includes(q) &&
        !b.phone.toLowerCase().includes(q) &&
        !b.service.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [bookings, stationFilter, statusFilter, sourceFilter, searchQuery]);

  // Derived client directory from bookings
  const clientDirectory = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        pet: string;
        size: string;
        owner: string;
        phone: string;
        visits: number;
        totalSpent: number;
        lastService: string;
      }
    >();
    for (const b of bookings) {
      const key = `${b.pet.toLowerCase()}|${b.phone}`;
      const existing = map.get(key);
      if (existing) {
        existing.visits += 1;
        existing.totalSpent += b.price;
      } else {
        map.set(key, {
          key,
          pet: b.pet,
          size: b.size,
          owner: b.owner,
          phone: b.phone,
          visits: 1,
          totalSpent: b.price,
          lastService: b.service,
        });
      }
    }
    return Array.from(map.values());
  }, [bookings]);

  const totalRevenue = bookings.reduce((sum, b) => sum + b.price, 0);
  const completedRevenue = bookings
    .filter((b) => b.status === "Completato")
    .reduce((sum, b) => sum + b.price, 0);
  const completionPct = totalRevenue > 0 ? Math.round((completedRevenue / totalRevenue) * 100) : 0;
  const inSalonCount = bookings.filter((b) => b.status === "In salone").length;
  const botCount = bookings.filter((b) => b.source === "bot").length;
  const pendingRecalls = recalls.filter((r) => r.status === "Da scrivere").length;

  const estimatedNewPrice = useMemo(() => {
    const srv = services.find((s) => s.title === newService);
    const base = srv ? srv.basePrice : 65;
    if (newSize === "Grande") return base + 10;
    if (newSize === "Piccola") return Math.max(18, base - 4);
    return base;
  }, [services, newService, newSize]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 overflow-x-hidden">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0">
              <Scissors className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-black text-base text-slate-900 leading-none truncate">
                  Admin {SALON_CONFIG.shortName}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold">
                  <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                  {autoRefresh ? "Live" : "Manuale"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                {userName} ({userEmail}) · Aggiornato {lastUpdated}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setAutoRefresh((v) => !v)}
              className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition ${
                autoRefresh
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-white border-slate-200 text-slate-500"
              }`}
              title="Attiva o disattiva aggiornamento automatico ogni 10 secondi"
            >
              Auto 10s: {autoRefresh ? "ON" : "OFF"}
            </button>

            <button
              type="button"
              onClick={() => loadAll(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-900 text-xs font-bold transition disabled:opacity-60"
              title="Aggiorna subito agenda e richieste dal sito/bot"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>Aggiorna</span>
            </button>

            <Link
              href="/"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-bold transition"
            >
              Sito cliente <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Esci</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
        {toast && (
          <div className="rounded-2xl bg-teal-900 text-teal-50 px-4 py-3 text-xs font-semibold flex items-center justify-between gap-2 shadow-lg">
            <span className="inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300 shrink-0" /> {toast}
            </span>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1.5 shadow-xs">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Appuntamenti
              </p>
              <Calendar className="w-4 h-4 text-teal-600" />
            </div>
            <p className="text-2xl font-black text-slate-900">{bookings.length}</p>
            <p className="text-[11px] text-slate-500">
              {botCount} da Bot AI · {bookings.length - botCount} da Sito/Banco
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1.5 shadow-xs">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Incasso previsto
              </p>
              <Euro className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-black text-teal-700">{totalRevenue} €</p>
              <span className="text-[11px] font-bold text-emerald-700">
                ({completedRevenue} € chiusi)
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1.5 shadow-xs">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                In salone ora
              </p>
              <Dog className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-2xl font-black text-amber-700">{inSalonCount}</p>
            <p className="text-[11px] text-slate-500">
              Vasca {bookings.filter((b) => b.station === "Vasca").length} · Tosatura{" "}
              {bookings.filter((b) => b.station === "Tosatura").length} · Finishing{" "}
              {bookings.filter((b) => b.station === "Finishing").length}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-1.5 shadow-xs">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Richiami 6–8 sett.
              </p>
              <MessageSquare className="w-4 h-4 text-violet-600" />
            </div>
            <p className="text-2xl font-black text-slate-900">{pendingRecalls}</p>
            <p className="text-[11px] text-slate-500">
              {recalls.length - pendingRecalls} già inviati su WhatsApp
            </p>
          </div>
        </div>

        {/* Mobile Section Select */}
        <div className="md:hidden">
          <label htmlFor="admin-mobile-tab" className="sr-only">
            Sezione Admin
          </label>
          <select
            id="admin-mobile-tab"
            value={tab}
            onChange={(e) => setTab(e.target.value as AdminTab)}
            className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-slate-300 text-sm font-black text-slate-900 shadow-xs"
          >
            <option value="agenda">Agenda &amp; Postazioni ({bookings.length})</option>
            <option value="clienti">Clienti &amp; Cani ({clientDirectory.length})</option>
            <option value="richiami">Richiami manto ({pendingRecalls})</option>
            <option value="listino">Listino &amp; Servizi</option>
            <option value="nuovo">+ Nuovo appuntamento</option>
          </select>
        </div>

        {/* Desktop Navigation Tabs */}
        <div className="hidden md:flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
          <button
            type="button"
            onClick={() => setTab("agenda")}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition ${
              tab === "agenda"
                ? "bg-teal-700 text-white shadow-xs"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" /> Agenda & Postazioni
          </button>
          <button
            type="button"
            onClick={() => setTab("clienti")}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition ${
              tab === "clienti"
                ? "bg-teal-700 text-white shadow-xs"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Clienti & Cani ({clientDirectory.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("richiami")}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition ${
              tab === "richiami"
                ? "bg-teal-700 text-white shadow-xs"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" /> Richiami manto ({pendingRecalls})
          </button>
          <button
            type="button"
            onClick={() => setTab("listino")}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition ${
              tab === "listino"
                ? "bg-teal-700 text-white shadow-xs"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" /> Listino & Servizi
          </button>
          <button
            type="button"
            onClick={() => setTab("nuovo")}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition ml-auto ${
              tab === "nuovo"
                ? "bg-slate-900 text-white"
                : "bg-teal-50 border border-teal-200 text-teal-900 hover:bg-teal-100"
            }`}
          >
            <Plus className="w-3.5 h-3.5" /> Nuovo appuntamento
          </button>
        </div>

        {/* TAB 1: AGENDA & POSTAZIONI */}
        {tab === "agenda" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
                <div className="grid grid-cols-2 sm:inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setAgendaView("lista")}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                      agendaView === "lista" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                    }`}
                  >
                    <List className="w-3.5 h-3.5" /> Lista
                  </button>
                  <button
                    type="button"
                    onClick={() => setAgendaView("postazioni")}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                      agendaView === "postazioni" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                    }`}
                  >
                    <Columns3 className="w-3.5 h-3.5" /> Postazioni
                  </button>
                </div>

                {agendaView === "lista" && (
                  <select
                    value={stationFilter}
                    onChange={(e) => setStationFilter(e.target.value as "tutte" | Station)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold"
                  >
                    <option value="tutte">Tutte le postazioni</option>
                    {STATIONS.map((st) => (
                      <option key={st} value={st}>
                        Postazione {st}
                      </option>
                    ))}
                  </select>
                )}

                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as "tutti" | GroomingBookingStatus)
                  }
                  className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold"
                >
                  <option value="tutti">Tutti gli stati</option>
                  {STATUS_ORDER.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>

                <select
                  value={sourceFilter}
                  onChange={(e) =>
                    setSourceFilter(e.target.value as "tutti" | "bot" | "sito" | "admin")
                  }
                  className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold"
                >
                  <option value="tutti">Tutti i canali</option>
                  <option value="bot">Solo Bot AI</option>
                  <option value="sito">Solo Sito Web</option>
                  <option value="admin">Solo Banco</option>
                </select>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cerca cane, cliente, telefono..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {loading ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-xs text-slate-500">
                Caricamento agenda in corso...
              </div>
            ) : visibleBookings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-xs text-slate-500">
                Nessun appuntamento corrisponde ai filtri selezionati.
              </div>
            ) : agendaView === "lista" ? (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs divide-y divide-slate-100">
                {visibleBookings.map((row) => {
                  const waText = encodeURIComponent(
                    `Ciao! Ti scriviamo da ${SALON_CONFIG.salonName} per l'appuntamento di ${row.pet} (${row.service}, ${row.time}).`
                  );
                  return (
                    <div
                      key={row.id}
                      className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-slate-50/70 transition"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                            {row.id}
                          </span>
                          <span className="font-black text-sm text-slate-900">{row.pet}</span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
                            {row.size}
                          </span>
                          <select
                            value={row.station}
                            onChange={(e) =>
                              updateBookingPatch(
                                row.id,
                                { station: e.target.value as Station },
                                `${row.pet} spostato in ${e.target.value}`
                              )
                            }
                            className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 cursor-pointer"
                            title="Cambia postazione"
                          >
                            {STATIONS.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                          {sourceBadge(row.source)}
                        </div>

                        <p className="text-xs text-slate-600">
                          <strong>{row.service}</strong> · {row.time} · {row.owner} ({row.phone})
                        </p>

                        {editingNoteId === row.id ? (
                          <div className="flex items-center gap-2 pt-1 max-w-md">
                            <input
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                              placeholder="Aggiungi nota interna (es. nodi, carattere)..."
                              className="flex-1 px-2.5 py-1 rounded-lg border border-slate-300 text-xs"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                await updateBookingPatch(
                                  row.id,
                                  { notes: noteDraft.trim() },
                                  "Nota salvata"
                                );
                                setEditingNoteId(null);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-teal-700 text-white text-[11px] font-bold"
                            >
                              Salva
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingNoteId(null)}
                              className="px-2 py-1 rounded-lg text-[11px] text-slate-500 hover:bg-slate-100"
                            >
                              Annulla
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {row.notes && (
                              <span className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md">
                                Nota: {row.notes}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNoteId(row.id);
                                setNoteDraft(row.notes || "");
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-700"
                            >
                              <Pencil className="w-3 h-3" /> {row.notes ? "Modifica nota" : "Aggiungi nota"}
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <span className="font-black text-sm text-slate-900 mr-1">
                          {row.price} €
                        </span>

                        <a
                          href={`https://wa.me/${cleanPhoneForWa(row.phone)}?text=${waText}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition"
                          title="Apri chat WhatsApp con il cliente"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> WA
                        </a>

                        <button
                          type="button"
                          onClick={() => cycleStatus(row)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                            row.status === "Completato"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : row.status === "In salone"
                              ? "bg-amber-100 text-amber-900 border-amber-300"
                              : row.status === "In arrivo"
                              ? "bg-sky-50 text-sky-800 border-sky-200"
                              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                          }`}
                          title="Clicca per avanzare lo stato"
                        >
                          {row.status}
                        </button>

                        {confirmDeleteId === row.id ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => removeBooking(row.id, row.pet)}
                              className="px-2.5 py-1.5 rounded-xl bg-red-600 text-white text-[11px] font-bold"
                            >
                              Conferma
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-[11px] font-bold"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(row.id)}
                            className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                            title="Elimina appuntamento"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* VISTA POSTAZIONI KANBAN */
              <div className="grid md:grid-cols-3 gap-4">
                {STATIONS.map((st) => {
                  const colRows = visibleBookings.filter((b) => b.station === st);
                  return (
                    <div
                      key={st}
                      className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <h3 className="font-black text-sm text-slate-900">Postazione {st}</h3>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800">
                          {colRows.length}
                        </span>
                      </div>
                      <div className="space-y-2.5">
                        {colRows.length === 0 ? (
                          <p className="text-xs text-slate-400 py-4 text-center">
                            Nessun cane in questa postazione
                          </p>
                        ) : (
                          colRows.map((row) => (
                            <div
                              key={row.id}
                              className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-black text-xs text-slate-900">{row.pet}</p>
                                  <p className="text-[11px] text-slate-600">
                                    {row.service} · {row.size}
                                  </p>
                                </div>
                                <span className="font-black text-xs text-teal-800">
                                  {row.price} €
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                                <span>{row.time}</span>
                                {sourceBadge(row.source)}
                              </div>
                              <button
                                type="button"
                                onClick={() => cycleStatus(row)}
                                className="w-full py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-[11px] font-bold text-slate-800 transition"
                              >
                                {row.status} →
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CLIENTI & SCHEDE CANI */}
        {tab === "clienti" && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-black text-sm text-slate-900">
                Rubrica Clienti & Storico Cani
              </h2>
              <span className="text-xs text-slate-500">
                {clientDirectory.length} profili attivi
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {clientDirectory.map((c) => (
                <div
                  key={c.key}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-slate-900">{c.pet}</span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
                        Taglia {c.size}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      {c.owner} · <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</span> · Ultimo: {c.lastService}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-xs font-black text-slate-900">{c.totalSpent} €</p>
                      <p className="text-[11px] text-slate-500">{c.visits} appuntament{c.visits === 1 ? "o" : "i"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setNewPet(c.pet);
                        setNewOwner(c.owner);
                        setNewPhone(c.phone);
                        setNewSize(
                          c.size === "Piccola" || c.size === "Grande" ? c.size : "Media"
                        );
                        setTab("nuovo");
                      }}
                      className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 text-xs font-bold transition"
                    >
                      + Riprenota
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: RICHIAMI MANTO */}
        {tab === "richiami" && (
          <div className="grid lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 shadow-xs">
              {recalls.map((item) => {
                const msg = encodeURIComponent(
                  `Ciao ${item.owner}! È passato il periodo consigliato per il manto di ${item.pet} (${item.due}). Vuoi bloccare un posto questa settimana da ${SALON_CONFIG.shortName}?`
                );
                return (
                  <div
                    key={item.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-slate-900">{item.pet}</span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
                          {item.due}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">
                        {item.owner} · {item.phone}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={`https://wa.me/${cleanPhoneForWa(item.phone)}?text=${msg}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Apri WA
                      </a>
                      {item.status === "Da scrivere" ? (
                        <button
                          type="button"
                          onClick={() => handleSendRecall(item)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Segna inviato
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                          <UserCheck className="w-3.5 h-3.5" /> Inviato
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <form
              onSubmit={handleAddRecall}
              className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs"
            >
              <h3 className="font-black text-sm text-slate-900">Aggiungi richiamo manuale</h3>
              <input
                required
                value={recallPet}
                onChange={(e) => setRecallPet(e.target.value)}
                placeholder="Cane e razza (es. Kira Spitz)"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
              <input
                required
                value={recallOwner}
                onChange={(e) => setRecallOwner(e.target.value)}
                placeholder="Nome proprietario"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
              <input
                value={recallPhone}
                onChange={(e) => setRecallPhone(e.target.value)}
                placeholder="WhatsApp (+39...)"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
              <input
                value={recallDue}
                onChange={(e) => setRecallDue(e.target.value)}
                placeholder="Motivo (es. Manto a 7 settimane)"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Aggiungi in lista richiami
              </button>
            </form>
          </div>
        )}

        {/* TAB 4: LISTINO & SERVIZI */}
        {tab === "listino" && (
          <div className="grid sm:grid-cols-2 gap-4">
            {services.map((srv) => {
              const edit = editingServices[srv.id] || {
                price: String(srv.basePrice),
                duration: String(srv.durationMin),
                desc: srv.desc,
              };
              const baseNum = Number(edit.price) || srv.basePrice;
              return (
                <div
                  key={srv.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-black text-sm text-slate-900">{srv.title}</h3>
                      <p className="text-[11px] text-slate-500">
                        Postazione {srv.station} · Anteprima: Piccola{" "}
                        {Math.max(18, baseNum - 4)}€ · Media {baseNum}€ · Grande {baseNum + 10}€
                      </p>
                    </div>
                  </div>
                  <textarea
                    rows={2}
                    value={edit.desc}
                    onChange={(e) =>
                      setEditingServices((prev) => ({
                        ...prev,
                        [srv.id]: { ...edit, desc: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-700"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1 mb-1">
                        <Euro className="w-3 h-3" /> Prezzo base Media (€)
                      </label>
                      <input
                        type="number"
                        min={10}
                        max={300}
                        value={edit.price}
                        onChange={(e) =>
                          setEditingServices((prev) => ({
                            ...prev,
                            [srv.id]: { ...edit, price: e.target.value },
                          }))
                        }
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1 mb-1">
                        <Clock className="w-3 h-3" /> Durata (min)
                      </label>
                      <input
                        type="number"
                        min={10}
                        max={240}
                        value={edit.duration}
                        onChange={(e) =>
                          setEditingServices((prev) => ({
                            ...prev,
                            [srv.id]: { ...edit, duration: e.target.value },
                          }))
                        }
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSaveService(srv.id)}
                    className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition"
                  >
                    <Save className="w-3.5 h-3.5" /> Salva e sincronizza sito cliente
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 5: NUOVO APPUNTAMENTO */}
        {tab === "nuovo" && (
          <form
            onSubmit={handleCreateManual}
            className="bg-white rounded-2xl border border-slate-200 p-5 max-w-xl space-y-4 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-black text-base text-slate-900">
                Inserisci appuntamento da banco / telefono
              </h2>
              <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200">
                Stimato: {estimatedNewPrice} €
              </span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold block mb-1">Nome cane e razza</label>
                <input
                  value={newPet}
                  onChange={(e) => setNewPet(e.target.value)}
                  placeholder="Es. Milo (Golden)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Proprietario</label>
                <input
                  value={newOwner}
                  onChange={(e) => setNewOwner(e.target.value)}
                  placeholder="Es. Laura Bianchi"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">WhatsApp / Telefono</label>
                <input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+39 347..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Taglia</label>
                <select
                  value={newSize}
                  onChange={(e) => setNewSize(e.target.value as "Piccola" | "Media" | "Grande")}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                >
                  <option value="Piccola">Piccola</option>
                  <option value="Media">Media</option>
                  <option value="Grande">Grande</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Servizio</label>
                <select
                  value={newService}
                  onChange={(e) => setNewService(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.title}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Orario</label>
                <input
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">Note interne (opzionali)</label>
              <input
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Es. Nodi sotto le orecchie, usare shampoo delicato"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold inline-flex items-center gap-1.5 transition"
            >
              <CheckCircle2 className="w-4 h-4" /> Aggiungi in agenda
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
