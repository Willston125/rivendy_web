import type { ReactNode } from "react";
import { MusicShell } from "@/features/music/music-shell";

/**
 * Espace Musique : les pages /music et la page unique d'un artiste (/artist,
 * Play et Musique) partagent UNE coque (mise en page application du
 * 2026-10-22). Passer de l'une à l'autre ne remonte ni la bibliothèque ni
 * les panneaux : leur état et leur défilement sont gardés.
 */
export default function MusiqueLayout({ children }: { children: ReactNode }) {
  return <MusicShell>{children}</MusicShell>;
}
