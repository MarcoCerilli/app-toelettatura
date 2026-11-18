"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  HeartHandshake,
  Lock,
  MapPin,
  MessageSquare,
  Phone,
  Scissors,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
} from "lucide-react";
import { SALON_CONFIG } from "@/lib/salon-config";
import { GroomingBotWidget } from "@/components/GroomingBotWidget";

interface ServiceItem {
  id: string;
  title: string;
  desc: string;
  durationMin: number;
  basePrice: number;
  photo: string;
  station: "Vasca" | "Tosatura" | "Finishing";
}

const FALLBACK_SERVICES: ServiceItem[] = [
  {
    id: "bagno",
    title: "Bagno e asciugatura",
    desc: "Lavaggio con prodotti delicati, asciugatura silenziosa e spazzolatura. Ideale per manti che non vanno tosati.",
    durationMin: 50,
    basePrice: 38,
    photo: "/images/bagno.jpg",
    station: "Vasca",
  },
  {
    id: "tosatura",
    title: "Tosatura completa",
    desc: "Bagno, taglio a forbice o macchinetta secondo lo standard di razza o la lunghezza concordata.",
    durationMin: 100,
    basePrice: 65,
    photo: "/images/tosatura.jpg",
    station: "Tosatura",
  },
  {
    id: "stripping",
    title: "Stripping",
    desc: "Lavorazione a mano per terrier, bassotti e manti ruvidi su postazione dedicata per mantenere il pelo sano.",
    durationMin: 120,
    basePrice: 80,
    photo: "/images/stripping.jpg",
    station: "Tosatura",
  },
  {
    id: "unghie",
    title: "Unghie, orecchie e igiene",
    desc: "Intervento rapido tra un taglio e l'altro: taglio unghie, pulizia padiglione auricolare e ritocco igienico.",
    durationMin: 25,
    basePrice: 22,
    photo: "/images/unghie.jpg",
    station: "Finishing",
  },
];

const DEFAULT_SLOTS = [
  "Oggi ore 15:00",
  "Domani ore 10:30",
  "Giovedì ore 11:00",
  "Sabato ore 09:00 (ultimo posto)",
];

const REVIEWS = [
  {
    name: "Chiara N.",
    pet: "Lola · Maltese",
    service: "Bagno e asciugatura",
    text: "Ho prenotato alle 22:30 dal sito mentre ero sul divano. Conferma immediata e zero attese in salone: Lola è uscita profumata e tranquillissima.",
  },
  {
    name: "Marco S.",
    pet: "Teo · Barboncino",
    service: "Tosatura completa",
    text: "Il bot mi ha guidato in 30 secondi nella scelta della taglia e dell'orario. Dopo 7 settimane è arrivato il promemoria automatico per il richiamo.",
  },
  {
    name: "Sara V.",
    pet: "Iris · Jack Russell",
    service: "Stripping",
    text: "Postazione dedicata e mano esperta sullo stripping. Si vede la differenza rispetto ai saloni dove fanno tutto nello stesso tavolo.",
  },
];

const FAQS = [
  {
    q: "Cosa succede se il mio cane ha molti nodi?",
    a: "Segnalalo nelle note o al bot durante la prenotazione: così possiamo valutare se aggiungere 15–20 minuti di snodatura delicata senza mettere fretta al cane.",
  },
  {
    q: "Come funziona la prenotazione con il Bot h24?",
    a: "Puoi scrivere nella chat in qualsiasi momento (anche la sera o la domenica). Il bot verifica taglia, servizio e postazione libera, blocca l'orario e lo invia subito all'agenda del salone.",
  },
  {
    q: "A che età posso portare un cucciolo per il primo bagno?",
    a: "Dopo il completamento del ciclo vaccinale. Consigliamo un primo inserimento breve (Bagno e asciugatura o Igiene) per abituare il cucciolo al phon silenzioso.",
  },
  {
    q: "Posso spostare o annullare l'appuntamento?",
    a: "Certo, ti chiediamo solo di avvisarci su WhatsApp almeno 24 ore prima così possiamo liberare la postazione per un altro cliente in lista.",
  },
];

function computePrice(basePrice: number, size: "Piccola" | "Media" | "Grande") {
  if (size === "Grande") return basePrice + 10;
  if (size === "Piccola") return Math.max(18, basePrice - 4);
  return basePrice;
}

export default function ToelettaturaDemoPage() {
  const [services, setServices] = useState<ServiceItem[]>(FALLBACK_SERVICES);
  const [slots, setSlots] = useState<string[]>(DEFAULT_SLOTS);
  const [size, setSize] = useState<"Piccola" | "Media" | "Grande">("Media");
  const [service, setService] = useState(FALLBACK_SERVICES[1].title);
  const [slot, setSlot] = useState(DEFAULT_SLOTS[0]);
  const [petName, setPetName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bookedId, setBookedId] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    fetch("/api/services")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        if (Array.isArray(data.services) && data.services.length > 0) {
          setServices(data.services);
        }
        if (Array.isArray(data.slots) && data.slots.length > 0) {
          setSlots(data.slots.map((s: { slot: string }) => s.slot));
        }
      })
      .catch(() => {
        // Keep fallback data if offline
      });
  }, []);

  const submitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    const pet = petName.trim() || "Teo (Barboncino)";
    const cell = phone.trim() || "+39 347 220 1188";

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pet,
          size,
          phone: cell,
          service,
          time: slot,
          notes: notes.trim() || undefined,
          source: "sito",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Impossibile completare la prenotazione.");
        return;
      }
      setPetName(pet);
      setPhone(cell);
      setBookedId(data.booking?.id || "OK");
    } catch {
      setErrorMsg("Errore di rete durante la prenotazione. Riprova.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6efe6] text-stone-800">
      {/* Top Navbar */}
      <nav className="bg-amber-950 text-amber-50 px-3 sm:px-6 py-2.5 sticky top-0 z-40 border-b border-amber-900/80">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-amber-950 flex items-center justify-center shrink-0">
              <Scissors className="w-4 h-4" />
            </div>
            <span className="font-black text-sm text-white truncate">
              {SALON_CONFIG.salonName}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-5 text-xs font-semibold text-amber-100/90">
            <a href="#servizi" className="hover:text-white transition">Servizi</a>
            <a href="#metodo" className="hover:text-white transition">Postazioni</a>
            <a href="#bot" className="hover:text-white transition">Bot AI h24</a>
            <a href="#recensioni" className="hover:text-white transition">Recensioni</a>
            <a href="#faq" className="hover:text-white transition">FAQ</a>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href="#prenota"
              className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 text-xs font-black transition"
            >
              Prenota
            </a>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-900 hover:bg-amber-800 text-amber-100 text-xs font-bold border border-amber-700/60 transition"
            >
              <Lock className="w-3 h-3" /> Area Admin
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero + Quick Booking */}
      <header className="lg:relative lg:min-h-[78vh]">
        <div className="relative h-[30vh] min-h-[210px] max-h-[250px] lg:absolute lg:inset-0 lg:h-full lg:max-h-none lg:min-h-full">
          <img
            src="/images/hero.jpg"
            alt="Barboncino in salone, appena tosato"
            className="absolute inset-0 w-full h-full object-cover object-[center_18%]"
          />
          <div className="hidden lg:block absolute inset-0 bg-gradient-to-t from-amber-950/90 via-amber-950/45 to-amber-950/15" />
          <div className="absolute top-3 left-3 right-3 lg:hidden">
            <div className="inline-flex items-center gap-2 max-w-full rounded-2xl bg-white/95 backdrop-blur px-3 py-2 shadow-md">
              <div className="w-8 h-8 rounded-xl bg-amber-700 text-white flex items-center justify-center shrink-0">
                <Scissors className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="font-black text-sm leading-none text-stone-900">{SALON_CONFIG.salonName}</p>
                <p className="text-[11px] font-semibold text-stone-600 mt-0.5">
                  {SALON_CONFIG.shortAddress} · {SALON_CONFIG.hours}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 w-full max-w-6xl mx-auto px-3 -mt-8 lg:mt-0 lg:relative lg:px-4 lg:py-16 lg:flex lg:items-end lg:min-h-[78vh]">
          <div className="w-full grid lg:grid-cols-12 gap-6 lg:gap-8 items-end">
            <div className="hidden lg:block lg:col-span-7 text-amber-50 space-y-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200">
                {SALON_CONFIG.address} · {SALON_CONFIG.hours}
              </p>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-500 text-amber-950 flex items-center justify-center">
                  <Scissors className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="font-black text-lg leading-none">{SALON_CONFIG.salonName}</h1>
                  <p className="text-xs text-amber-200">{SALON_CONFIG.tagline}</p>
                </div>
              </div>
              <h2 className="text-4xl sm:text-5xl font-black leading-[1.05] max-w-xl">
                Blocca l&apos;orario del tuo cane in 30 secondi.
              </h2>
              <p className="text-amber-100/90 text-base sm:text-lg max-w-lg">
                Scegli taglia e servizio o chiedi al nostro Bot automatico h24: ogni appuntamento finisce subito nella postazione giusta senza attese.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <a
                  href="#bot"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold backdrop-blur border border-white/20 transition"
                >
                  <Bot className="w-4 h-4 text-amber-300" /> Chiedi al Bot automatico
                </a>
                <a
                  href="#servizi"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 text-xs font-bold border border-amber-400/30 transition"
                >
                  Scopri il listino <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
              <div className="grid grid-cols-3 gap-3 max-w-md pt-2">
                <div>
                  <div className="text-2xl font-black">6–8 sett.</div>
                  <div className="text-[11px] text-amber-200">Richiamo del prossimo taglio</div>
                </div>
                <div>
                  <div className="text-2xl font-black">3 posti</div>
                  <div className="text-[11px] text-amber-200">Vasca, tosatura, finishing</div>
                </div>
                <div>
                  <div className="text-2xl font-black">24/7</div>
                  <div className="text-[11px] text-amber-200">Bot e agenda sempre attivi</div>
                </div>
              </div>
            </div>

            {/* Quick Booking Card */}
            <div
              id="prenota"
              className="lg:col-span-5 bg-white border border-amber-100 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-3 text-stone-800"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="lg:hidden text-[11px] font-black uppercase tracking-wider text-amber-800">
                    {SALON_CONFIG.shortName} · prenota online
                  </p>
                  <h2 className="lg:hidden font-black text-xl leading-tight text-stone-900">
                    Blocca l&apos;orario del tuo cane
                  </h2>
                  <h3 className="hidden lg:block font-black text-lg">Prenotazione rapida</h3>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 shrink-0">
                  Attivo h24
                </span>
              </div>

              {!bookedId ? (
                <form onSubmit={submitBooking} className="space-y-3">
                  <div>
                    <label className="text-xs font-bold block mb-1">Taglia</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["Piccola", "Media", "Grande"] as const).map((item) => (
                        <button
                          type="button"
                          key={item}
                          onClick={() => setSize(item)}
                          className={`py-2 rounded-xl text-xs font-bold border transition ${
                            size === item
                              ? "bg-amber-700 text-white border-amber-700"
                              : "bg-stone-50 border-stone-200 hover:bg-stone-100"
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold block mb-1">Servizio</label>
                    <select
                      value={service}
                      onChange={(e) => setService(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 text-xs"
                    >
                      {services.map((item) => (
                        <option key={item.id} value={item.title}>
                          {item.title} ({item.durationMin} min · {computePrice(item.basePrice, size)} €)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold block mb-1">Orario disponibile</label>
                    <div className="grid grid-cols-2 gap-2">
                      {slots.map((item) => (
                        <button
                          type="button"
                          key={item}
                          onClick={() => setSlot(item)}
                          className={`px-2.5 py-2 rounded-xl text-[11px] font-bold border text-left leading-tight transition ${
                            slot === item
                              ? "bg-amber-700 text-white border-amber-700"
                              : "bg-stone-50 border-stone-200 hover:bg-stone-100"
                          }`}
                        >
                          {item.replace(" (ultimo posto)", "")}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={petName}
                      onChange={(e) => setPetName(e.target.value)}
                      placeholder="Nome e razza (es. Teo)"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs"
                    />
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="WhatsApp (es. 347...)"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs"
                    />
                  </div>

                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Note opzionali (es. nodi, cucciolo, paura del phon)"
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 text-xs"
                  />

                  {errorMsg && (
                    <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                      {errorMsg}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 rounded-2xl bg-amber-800 hover:bg-amber-900 text-white text-sm font-bold inline-flex items-center justify-center gap-2 transition disabled:opacity-60"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {submitting ? "Salvataggio..." : "Conferma e blocca il posto"}
                  </button>
                </form>
              ) : (
                <div className="space-y-4 text-center py-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-700 mx-auto" />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                      Codice {bookedId}
                    </p>
                    <h4 className="font-black text-lg text-stone-900">
                      Posto bloccato in agenda!
                    </h4>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-left text-xs space-y-1">
                    <div className="font-bold text-amber-900 inline-flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5" /> Riepilogo WhatsApp
                    </div>
                    <p>
                      Ciao, {petName || "Teo"} ({size}) è confermato per{" "}
                      <strong>{service}</strong> — <strong>{slot}</strong>. Ti aspettiamo in{" "}
                      {SALON_CONFIG.shortAddress}.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => setBookedId(null)}
                      className="flex-1 py-2.5 rounded-xl border border-stone-300 text-xs font-bold hover:bg-stone-50"
                    >
                      Nuova prenotazione
                    </button>
                    <Link
                      href="/admin"
                      className="flex-1 py-2.5 rounded-xl bg-stone-900 text-white text-xs font-bold inline-flex items-center justify-center gap-1"
                    >
                      Vedi in Admin <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Sezione 1: Servizi & Listino Dinamico */}
      <section id="servizi" className="max-w-6xl mx-auto px-3 py-10 sm:px-4 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              Listino trasparente per taglia
            </p>
            <h2 className="text-2xl sm:text-3xl font-black text-stone-900">
              Quattro servizi su misura. Tocca e prenota.
            </h2>
          </div>

          <div className="inline-flex items-center gap-1 bg-white p-1 rounded-2xl border border-amber-200 shadow-sm">
            {(["Piccola", "Media", "Grande"] as const).map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => setSize(sz)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  size === sz
                    ? "bg-amber-800 text-white"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                Taglia {sz}
              </button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {services.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setService(item.title);
                setBookedId(null);
                document.getElementById("prenota")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="text-left bg-white rounded-3xl overflow-hidden shadow-sm border border-amber-100/80 hover:shadow-lg hover:-translate-y-0.5 transition flex flex-col"
            >
              <img src={item.photo} alt={item.title} className="w-full h-40 object-cover" />
              <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                      {item.durationMin} min
                    </span>
                    <span className="text-[10px] font-semibold text-stone-500">
                      Postazione {item.station}
                    </span>
                  </div>
                  <h3 className="font-black text-base text-stone-900">{item.title}</h3>
                  <p className="text-xs text-stone-600 leading-relaxed">{item.desc}</p>
                </div>
                <div className="pt-2 flex items-center justify-between border-t border-stone-100">
                  <span className="font-black text-lg text-amber-900">
                    {computePrice(item.basePrice, size)} €
                  </span>
                  <span className="text-xs font-bold text-amber-700 inline-flex items-center gap-1">
                    Seleziona <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Sezione 2: Le 3 Postazioni & Metodo */}
      <section id="metodo" className="bg-white border-y border-amber-100 py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 grid lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6">
            <div className="rounded-3xl overflow-hidden shadow-lg border border-amber-100">
              <img
                src="/images/stations.jpg"
                alt="Le tre postazioni di toelettatura Casa Manto"
                className="w-full h-72 sm:h-80 object-cover"
              />
            </div>
          </div>
          <div className="lg:col-span-6 space-y-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                Organizzazione interna · Zero stress
              </p>
              <h2 className="text-2xl sm:text-3xl font-black text-stone-900 mt-1">
                Tre postazioni dedicate. Un bagno non blocca una tosatura.
              </h2>
            </div>
            <p className="text-sm text-stone-600 leading-relaxed">
              Ogni servizio viene assegnato automaticamente alla postazione corretta. Così il tuo cane non resta in gabbia ad aspettare e riceve attenzioni continue.
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-[#fbf7f1] border border-amber-100 space-y-1">
                <p className="font-black text-sm text-amber-950">1. Vasca</p>
                <p className="text-xs text-stone-600">Shampoo lenitivi, acqua tiepida e asciugatura silenziosa.</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#fbf7f1] border border-amber-100 space-y-1">
                <p className="font-black text-sm text-amber-950">2. Tosatura</p>
                <p className="text-xs text-stone-600">Tavoli dedicati a tagli a forbice, macchinetta e stripping.</p>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#fbf7f1] border border-amber-100 space-y-1">
                <p className="font-black text-sm text-amber-950">3. Finishing</p>
                <p className="text-xs text-stone-600">Unghie, pulizia orecchie, ritocco muso e controllo finale.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sezione 3: Bot Automatico h24 */}
      <section id="bot" className="max-w-6xl mx-auto px-3 py-12 sm:px-4 sm:py-16">
        <div className="grid lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-5 space-y-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-950 text-amber-100 px-3 py-1 text-[11px] font-bold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Assistente Automatico h24
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-stone-900">
              Hai dubbi su prezzi, nodi o orari? Chiedi al Bot e prenota in chat.
            </h2>
            <p className="text-sm text-stone-600 leading-relaxed">
              Anche alle 22:00 o la domenica, l&apos;assistente automatico di Casa Manto risponde subito, calcola il prezzo per la taglia del tuo cane e salva l&apos;appuntamento direttamente nella nostra agenda interna.
            </p>
            <ul className="space-y-2 text-xs font-semibold text-stone-700">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Preventivo immediato in base a taglia e servizio
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Prenotazione guidata in 4 passaggi senza telefonare
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Sincronizzazione istantanea con la dashboard Admin
              </li>
            </ul>
          </div>
          <div className="lg:col-span-7">
            <GroomingBotWidget variant="inline" />
          </div>
        </div>
      </section>

      {/* Sezione 4: Recensioni */}
      <section id="recensioni" className="bg-amber-950 text-amber-50 py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                Chi ci sceglie ogni 6–8 settimane
              </p>
              <h2 className="text-2xl sm:text-3xl font-black mt-1">
                Recensioni dei clienti a {SALON_CONFIG.demoCity}
              </h2>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-200">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" /> 4.9 / 5 su 180+ appuntamenti
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {REVIEWS.map((rev) => (
              <div
                key={rev.name}
                className="rounded-3xl bg-amber-900/50 border border-amber-800 p-5 space-y-3"
              >
                <div className="flex items-center gap-1 text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                  ))}
                </div>
                <p className="text-xs sm:text-sm text-amber-100 leading-relaxed">
                  &ldquo;{rev.text}&rdquo;
                </p>
                <div className="pt-2 border-t border-amber-800/80">
                  <p className="font-black text-xs text-white">{rev.name}</p>
                  <p className="text-[11px] text-amber-300">
                    {rev.pet} · {rev.service}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sezione 5: FAQ */}
      <section id="faq" className="max-w-4xl mx-auto px-3 py-12 sm:px-4 sm:py-16 space-y-6">
        <div className="text-center space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
            Domande frequenti
          </p>
          <h2 className="text-2xl sm:text-3xl font-black text-stone-900">
            Tutto quello che c&apos;è da sapere prima di venire
          </h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={item.q}
                className="bg-white rounded-2xl border border-amber-100 overflow-hidden shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left font-bold text-sm text-stone-900"
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-amber-800 shrink-0 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 text-xs sm:text-sm text-stone-600 leading-relaxed">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Sezione 6: Contatti & Footer */}
      <footer id="contatti" className="bg-stone-900 text-stone-300 py-10">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 grid sm:grid-cols-3 gap-6 items-start">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white font-black text-base">
              <Scissors className="w-4 h-4 text-amber-400" /> {SALON_CONFIG.salonName}
            </div>
            <p className="text-xs text-stone-400">{SALON_CONFIG.tagline}</p>
          </div>
          <div className="space-y-1.5 text-xs">
            <p className="font-bold text-white flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-amber-400" /> {SALON_CONFIG.address}
            </p>
            <p className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" /> {SALON_CONFIG.hours}
            </p>
            <p className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-amber-400" /> +39 02 4590 1122 · WhatsApp attivo
            </p>
          </div>
          <div className="sm:text-right space-y-2">
            <p className="text-xs text-stone-400 inline-flex items-center gap-1.5">
              <HeartHandshake className="w-3.5 h-3.5 text-amber-400" /> Gestione interna staff
            </p>
            <div>
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition"
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Accedi all&apos;Area Admin
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating Bot Assistant */}
      <GroomingBotWidget variant="floating" />
    </div>
  );
}
