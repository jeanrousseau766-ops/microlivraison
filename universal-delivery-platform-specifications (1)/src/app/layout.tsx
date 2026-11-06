import type { Metadata } from "next";
import type { ReactNode } from "react";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import Shell from "@/components/Shell";

export const metadata: Metadata = {
  title: "Locho — Tout Loches, livré · 04h–23h",
  description:
    "Plateforme de livraison universelle de Loches (37) : repas, courses, boulangerie, fleurs, cadeaux, colis. Commerces locaux, livreurs indépendants, suivi en temps réel.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700;9..144,900&family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          rel="icon"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23E4572E'/%3E%3Cpath d='M9 25V11h3V8h3v3h2V8h3v3h3v14h-5v-6h-4v6z' fill='%23FFFCF3'/%3E%3C/svg%3E"
        />
      </head>
      <body className="bg-paper text-ink antialiased">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
