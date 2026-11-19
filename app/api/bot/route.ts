import { NextResponse } from "next/server";
import { ai } from "@/lib/gemini";
import { SALON_CONFIG } from "@/lib/salon-config";
import {
  addBooking,
  FreeSlotOption,
  getAvailableSlotsForService,
  getServices,
  hasStationConflict,
  inferScheduleFromText,
  priceForServiceAndSize,
} from "@/lib/server-store";

export interface BotDraft {
  step?: "idle" | "size" | "service" | "slot" | "details" | "done";
  size?: "Piccola" | "Media" | "Grande";
  service?: string;
  slot?: string;
  dateIso?: string;
  startTime?: string;
  pet?: string;
  phone?: string;
}

interface BotRequestBody {
  message?: unknown;
  draft?: BotDraft;
}

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

function detectSize(text: string): "Piccola" | "Media" | "Grande" | undefined {
  const t = normalize(text);
  if (t.includes("piccol") || t.includes("toy") || t.includes("maltese") || t.includes("chihuahua")) return "Piccola";
  if (t.includes("medi") || t.includes("barboncin") || t.includes("cocker") || t.includes("beagle")) return "Media";
  if (t.includes("grand") || t.includes("labrador") || t.includes("golden") || t.includes("pastore")) return "Grande";
  return undefined;
}

function detectService(text: string, services: ReturnType<typeof getServices>): string | undefined {
  const t = normalize(text);
  if (t.includes("stripping") || t.includes("terrier") || t.includes("ruvid")) {
    return services.find((s) => s.id === "stripping")?.title;
  }
  if (t.includes("tosatura") || t.includes("taglio") || t.includes("forbici")) {
    return services.find((s) => s.id === "tosatura")?.title;
  }
  if (t.includes("unghie") || t.includes("orecchie") || t.includes("igiene")) {
    return services.find((s) => s.id === "unghie")?.title;
  }
  if (t.includes("bagno") || t.includes("lavaggio") || t.includes("asciugatura")) {
    return services.find((s) => s.id === "bagno")?.title;
  }
  return undefined;
}

function detectSlot(
  text: string,
  freeSlots: FreeSlotOption[]
): { slot: string; dateIso: string; startTime: string } | undefined {
  const t = normalize(text);
  for (const item of freeSlots) {
    if (t.includes(item.slot.toLowerCase())) {
      return { slot: item.slot, dateIso: item.dateIso, startTime: item.startTime };
    }
  }
  const hasTime = /\d{1,2}:\d{2}/.test(t);
  const hasDayWord =
    t.includes("oggi") ||
    t.includes("domani") ||
    t.includes("luned") ||
    t.includes("marted") ||
    t.includes("mercoled") ||
    t.includes("gioved") ||
    t.includes("venerd") ||
    t.includes("sabat");
  if (hasTime || hasDayWord) {
    const inferred = inferScheduleFromText(text);
    const matchingFree = freeSlots.find(
      (s) => s.dateIso === inferred.dateIso && s.startTime === inferred.startTime
    );
    if (matchingFree) {
      return {
        slot: matchingFree.slot,
        dateIso: matchingFree.dateIso,
        startTime: matchingFree.startTime,
      };
    }
    if (hasTime) {
      return {
        slot: text.trim().slice(0, 40),
        dateIso: inferred.dateIso,
        startTime: inferred.startTime,
      };
    }
  }
  return undefined;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as BotRequestBody;
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 400) : "";
    if (!message) {
      return NextResponse.json({ error: "Messaggio vuoto." }, { status: 400 });
    }

    const services = getServices();
    const t = normalize(message);
    const draft: BotDraft = { ...(body.draft || {}) };

    // Extract any entities from the message
    const foundSize = detectSize(message);
    if (foundSize) draft.size = foundSize;

    const foundService = detectService(message, services);
    if (foundService) draft.service = foundService;

    const freeSlots = getAvailableSlotsForService(draft.service, 4);

    if (draft.step !== "details") {
      const foundSlot = detectSlot(message, freeSlots);
      if (foundSlot) {
        draft.slot = foundSlot.slot;
        draft.dateIso = foundSlot.dateIso;
        draft.startTime = foundSlot.startTime;
      }
    }

    const wantsBooking =
      draft.step === "size" ||
      draft.step === "service" ||
      draft.step === "slot" ||
      draft.step === "details" ||
      t.includes("prenot") ||
      t.includes("appuntamento") ||
      t.includes("posto") ||
      t.includes("fissare") ||
      t.includes("blocca");

    // Step: collecting pet name and phone in "details"
    if (draft.step === "details" && draft.size && draft.service && draft.slot) {
      const matchedSrv = services.find((s) => s.title === draft.service) || services[0];
      const inferred = inferScheduleFromText(draft.slot);
      const targetDate = draft.dateIso || inferred.dateIso;
      const targetStart = draft.startTime || inferred.startTime;

      const conflict = hasStationConflict({
        dateIso: targetDate,
        startTime: targetStart,
        durationMin: matchedSrv.durationMin,
        station: matchedSrv.station,
      });

      if (conflict) {
        const refreshed = getAvailableSlotsForService(draft.service, 4);
        draft.slot = undefined;
        draft.dateIso = undefined;
        draft.startTime = undefined;
        draft.step = "slot";
        return NextResponse.json({
          reply: `Ops! Nel frattempo la postazione ${matchedSrv.station} è stata occupata alle ${targetStart}. Ecco i primi orari realmente liberi per ${draft.service}:`,
          suggestions: refreshed.map((s) => s.slot),
          draft,
        });
      }

      const phoneMatch = message.match(/(\+?\d[\d\s()-]{6,18}\d)/);
      const phone = phoneMatch ? phoneMatch[1].trim() : "+39 347 220 1188";
      const petCandidate = message
        .replace(phoneMatch ? phoneMatch[0] : "", "")
        .replace(/[,;-]/g, " ")
        .trim();
      const pet = petCandidate.length >= 2 ? petCandidate.slice(0, 50) : "Teo (Barboncino)";

      const booking = addBooking({
        pet,
        size: draft.size,
        owner: "Prenotazione Bot AI",
        phone,
        service: draft.service,
        time: draft.slot,
        dateIso: targetDate,
        startTime: targetStart,
        source: "bot",
      });

      return NextResponse.json({
        reply: `Perfetto! Ho bloccato il posto per ${booking.pet} (${booking.size}) per "${booking.service}" — ${booking.time}. Prezzo stimato: ${booking.price} € (Postazione ${booking.station}). Riceverai il promemoria WhatsApp automatico e l'appuntamento è già visibile nell'agenda del salone.`,
        suggestions: ["Prenota un altro cane", "Orari e indirizzo", "Consigli per i nodi"],
        draft: { step: "done" },
        bookingCreated: booking,
      });
    }

    if (wantsBooking) {
      if (!draft.size) {
        draft.step = "size";
        return NextResponse.json({
          reply: "Volentieri! Per calcolare durata e postazione corretta, che taglia ha il tuo cane?",
          suggestions: ["Taglia Piccola", "Taglia Media", "Taglia Grande"],
          draft,
        });
      }

      if (!draft.service) {
        draft.step = "service";
        return NextResponse.json({
          reply: `Perfetto, taglia ${draft.size}. Quale servizio desideri prenotare?`,
          suggestions: services.map((s) => `${s.title} (${priceForServiceAndSize(s.title, draft.size!, services)} €)`),
          draft,
        });
      }

      const matchedSrv = services.find((s) => s.title === draft.service) || services[0];
      const realFreeSlots = getAvailableSlotsForService(draft.service, 4);

      if (draft.slot) {
        const inferred = inferScheduleFromText(draft.slot);
        const conflict = hasStationConflict({
          dateIso: draft.dateIso || inferred.dateIso,
          startTime: draft.startTime || inferred.startTime,
          durationMin: matchedSrv.durationMin,
          station: matchedSrv.station,
        });
        if (conflict) {
          draft.slot = undefined;
          draft.dateIso = undefined;
          draft.startTime = undefined;
          draft.step = "slot";
          return NextResponse.json({
            reply: `La postazione ${matchedSrv.station} è già occupata in quell'orario. Ecco gli orari realmente liberi per ${draft.service}:`,
            suggestions: realFreeSlots.map((s) => s.slot),
            draft,
          });
        }
      }

      if (!draft.slot) {
        draft.step = "slot";
        return NextResponse.json({
          reply: `Ottima scelta: ${draft.service} per taglia ${draft.size} (${priceForServiceAndSize(draft.service, draft.size, services)} € · Postazione ${matchedSrv.station}). Ecco i prossimi orari liberi in agenda:`,
          suggestions: realFreeSlots.map((s) => s.slot),
          draft,
        });
      }

      draft.step = "details";
      return NextResponse.json({
        reply: `Ci siamo quasi! Ho verificato la disponibilità per ${draft.slot} (${draft.service}, ${draft.size}). Scrivimi il nome del cane (e razza) più il tuo numero WhatsApp per confermare (es. "Milo Labrador, 347 1234567").`,
        suggestions: ["Teo Barboncino, 347 2201188", "Luna Maltese, 333 4412201"],
        draft,
      });
    }

    // FAQ & Informational intents
    if (t.includes("prezz") || t.includes("cost") || t.includes("listin")) {
      const lines = services
        .map((s) => `• ${s.title}: da ${priceForServiceAndSize(s.title, "Piccola", services)} € (Piccola) · ${s.basePrice} € (Media) · ${priceForServiceAndSize(s.title, "Grande", services)} € (Grande)`)
        .join("\n");
      return NextResponse.json({
        reply: `Ecco il listino aggiornato di ${SALON_CONFIG.salonName}:\n${lines}\n\nVuoi bloccare un orario adesso?`,
        suggestions: ["Prenota un posto", "Orari e indirizzo", "Come gestite i nodi?"],
        draft: { step: "idle" },
      });
    }

    if (t.includes("orar") || t.includes("dove") || t.includes("indirizz") || t.includes("apert")) {
      return NextResponse.json({
        reply: `Siamo in ${SALON_CONFIG.address} (${SALON_CONFIG.hours}). Le prenotazioni online tramite sito o bot sono attive h24, anche quando il salone è chiuso!`,
        suggestions: ["Prenota un posto", "Vedi i prezzi", "Parlami delle postazioni"],
        draft: { step: "idle" },
      });
    }

    if (t.includes("nod") || t.includes("cucciol") || t.includes("ansios") || t.includes("postazion")) {
      return NextResponse.json({
        reply: "Lavoriamo su 3 postazioni separate (Vasca, Tosatura, Finishing) per evitare attese e stress. Per i cuccioli facciamo un primo inserimento dolce, e se ci sono nodi ti consigliamo di segnalarcelo prima così dedichiamo il tempo giusto senza fretta.",
        suggestions: ["Prenota un posto", "Vedi i prezzi", "Orari e indirizzo"],
        draft: { step: "idle" },
      });
    }

    // Optional Gemini enhancement for open-ended questions when API key is configured
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
      try {
        const serviceSummary = services
          .map((s) => `${s.title} (${s.durationMin} min, base ${s.basePrice} €)`)
          .join("; ");
        const prompt = `Sei l'assistente virtuale ufficiale di "${SALON_CONFIG.salonName}" (${SALON_CONFIG.address}, ${SALON_CONFIG.hours}).
Servizi disponibili: ${serviceSummary}.
Orari liberi: ${freeSlots.map((s) => s.slot).join(", ")}.
Rispondi in italiano in modo cordiale, breve (max 3 frasi) e pratico alla domanda del cliente, invitandolo eventualmente a prenotare.
Domanda cliente: "${message}"`;

        const result = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });
        const text = result.text?.trim();
        if (text) {
          return NextResponse.json({
            reply: text,
            suggestions: ["Prenota un posto", "Vedi i prezzi", "Orari e indirizzo"],
            draft: { step: "idle" },
          });
        }
      } catch {
        // Fall back silently to deterministic reply
      }
    }

    return NextResponse.json({
      reply: `Ciao! Sono l'assistente automatico di ${SALON_CONFIG.salonName}. Posso darti info su prezzi, servizi, cura del manto oppure bloccare subito un appuntamento in agenda al posto tuo. Cosa ti serve?`,
      suggestions: ["Prenota un posto", "Vedi i prezzi", "Orari e indirizzo", "Come gestite i nodi?"],
      draft: { step: "idle" },
    });
  } catch {
    return NextResponse.json(
      { error: "Errore temporaneo dell'assistente. Riprova tra un attimo." },
      { status: 500 }
    );
  }
}
