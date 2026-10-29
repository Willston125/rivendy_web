import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { MusicShell } from "@/features/music/music-shell";
import { musicFontVariables } from "@/lib/app-fonts";

/**
 * Espace Musique : les pages /music et la page unique d'un artiste (/artist,
 * Play et Musique) partagent UNE coque (mise en page application du
 * 2026-10-22). Passer de l'une à l'autre ne remonte ni la bibliothèque ni
 * les panneaux : leur état et leur défilement sont gardés.
 *
 * Écran d'accueil (lot « Musique web », 2026-10-23) : un manifeste propre à
 * la Musique (s'ouvre sur /music) ; sur Android, il renvoie vers l'appli
 * Rivendy (`prefer_related_applications`) plutôt qu'une copie du site.
 *
 * Style « fraîcheur » (2026-10-29) : barre du haut blanche, d'où la couleur
 * claire de la barre du navigateur ; Nunito pour les titres, Inter pour
 * l'interface.
 */
export const metadata: Metadata = {
  manifest: "/musique.webmanifest",
  appleWebApp: { capable: true, title: "Rivendy Musique", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#FFFFFF" };

export default function MusiqueLayout({ children }: { children: ReactNode }) {
  return <MusicShell fontClassName={musicFontVariables}>{children}</MusicShell>;
}
