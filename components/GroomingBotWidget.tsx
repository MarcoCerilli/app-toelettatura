"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bot,
  CheckCircle2,
  MessageCircle,
  Send,
  Sparkles,
  X,
  RotateCcw,
  ArrowRight,
} from "lucide-react";
import { SALON_CONFIG } from "@/lib/salon-config";
import type { BotDraft } from "@/app/api/bot/route";
import type { GroomingBooking } from "@/lib/grooming-bookings";

interface ChatMsg {
  id: string;
  sender: "bot" | "user";
  text: string;
  booking?: GroomingBooking;
}

interface GroomingBotWidgetProps {
  variant?: "inline" | "floating";
  onBookingCreated?: (booking: GroomingBooking) => void;
}

const INITIAL_MESSAGE: ChatMsg = {
  id: "welcome",
  sender: "bot",
  text: `Ciao! Sono l'assistente automatico di ${SALON_CONFIG.salonName}. Posso rispondere a domande su prezzi e manto oppure prenotare il tuo posto in 30 secondi, anche a salone chiuso.`,
};

const INITIAL_SUGGESTIONS = [
  "Prenota un posto",
  "Vedi i prezzi",
  "Orari e indirizzo",
  "Come gestite i nodi?",
];

export function GroomingBotWidget({
  variant = "inline",
  onBookingCreated,
}: GroomingBotWidgetProps) {
  const [open, setOpen] = useState(variant === "inline");
  const [messages, setMessages] = useState<ChatMsg[]>([INITIAL_MESSAGE]);
  const [suggestions, setSuggestions] = useState<string[]>(INITIAL_SUGGESTIONS);
  const [draft, setDraft] = useState<BotDraft>({ step: "idle" });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading, open]);

  const sendMessage = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;

    const userMsg: ChatMsg = {
      id: `u-${Date.now()}`,
      sender: "user",
      text,
    };
    setMessages((prev) => [...prev, userMsg]);
    if (!textOverride) setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, draft }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Errore risposta");
      }

      if (data.draft) {
        setDraft(data.draft);
      }
      if (Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions);
      }

      const botMsg: ChatMsg = {
        id: `b-${Date.now()}`,
        sender: "bot",
        text: data.reply,
        booking: data.bookingCreated,
      };
      setMessages((prev) => [...prev, botMsg]);

      if (data.bookingCreated && onBookingCreated) {
        onBookingCreated(data.bookingCreated);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: "bot",
          text: "Scusa, ho avuto un piccolo problema di connessione. Puoi riprovare tra un secondo o usare il modulo qui accanto.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const resetChat = () => {
    setMessages([INITIAL_MESSAGE]);
    setSuggestions(INITIAL_SUGGESTIONS);
    setDraft({ step: "idle" });
  };

  const chatBody = (
    <div className="flex flex-col h-full bg-white rounded-3xl border border-amber-200/80 shadow-xl overflow-hidden">
      <div className="bg-amber-950 text-amber-50 px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-amber-500 text-amber-950 flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-sm truncate">Assistente {SALON_CONFIG.shortName}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="Attivo h24" />
            </div>
            <p className="text-[11px] text-amber-200/90 truncate">Bot automatico h24 · Prenota in agenda</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={resetChat}
            className="p-1.5 rounded-lg text-amber-200 hover:text-white hover:bg-amber-900 transition"
            title="Ricomincia conversazione"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          {variant === "floating" && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg text-amber-200 hover:text-white hover:bg-amber-900 transition"
              aria-label="Chiudi chat"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div
        ref={listRef}
        className={`flex-1 overflow-y-auto p-4 space-y-3 bg-[#fbf7f1] ${
          variant === "inline" ? "h-[340px]" : "h-[360px]"
        }`}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line ${
                msg.sender === "user"
                  ? "bg-amber-800 text-white rounded-br-sm"
                  : "bg-white text-stone-800 border border-amber-100 shadow-sm rounded-bl-sm"
              }`}
            >
              {msg.text}
              {msg.booking && (
                <div className="mt-2.5 pt-2.5 border-t border-amber-100 space-y-1.5">
                  <div className="inline-flex items-center gap-1 font-bold text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Registrato in agenda ({msg.booking.id})
                  </div>
                  <div className="text-[11px] text-stone-600">
                    {msg.booking.pet} · {msg.booking.service} · {msg.booking.time}
                  </div>
                  <Link
                    href="/admin"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 underline underline-offset-2"
                  >
                    Verifica nell&apos;area Admin <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-amber-100 rounded-2xl px-3.5 py-2 text-xs text-stone-500 inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-600" /> Sto scrivendo...
            </div>
          </div>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="px-3 py-2 bg-white border-t border-amber-100 flex flex-wrap gap-1.5">
          {suggestions.map((sug) => (
            <button
              key={sug}
              type="button"
              onClick={() => sendMessage(sug)}
              disabled={loading}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 transition disabled:opacity-50"
            >
              {sug}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        className="p-2.5 bg-white border-t border-stone-200 flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Scrivi taglia, servizio o fai una domanda..."
          className="flex-1 px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="p-2.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white disabled:opacity-40 transition"
          aria-label="Invia messaggio"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );

  if (variant === "inline") {
    return chatBody;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open ? (
        <div className="w-[340px] sm:w-[370px] max-w-[calc(100vw-2rem)]">
          {chatBody}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex items-center gap-2.5 rounded-full bg-amber-950 hover:bg-amber-900 text-amber-50 pl-4 pr-5 py-3 shadow-2xl border border-amber-700/60 transition"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400" />
          </span>
          <MessageCircle className="w-5 h-5 text-amber-300" />
          <span className="text-xs font-black tracking-wide">Prenota con il Bot h24</span>
        </button>
      )}
    </div>
  );
}
