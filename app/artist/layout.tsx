import type { ReactNode } from "react";
import { MusicShell } from "@/features/music/music-shell";

/** La page unique d'un artiste (Play et Musique) s'affiche dans l'espace Musique. */
export default function ArtistLayout({ children }: { children: ReactNode }) {
  return <MusicShell>{children}</MusicShell>;
}
