import type { MetadataRoute } from "next";
import { SALON_CONFIG } from "@/lib/salon-config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SALON_CONFIG.salonName,
    short_name: SALON_CONFIG.shortName,
    description:
      "Prenotazioni online h24, assistente automatico e agenda salone per toelettatura.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6efe6",
    theme_color: "#451a03",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
