"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/** L'espace Musique (et la page unique d'un artiste) a sa propre fin de page sombre (finitions du 2026-10-22). */
export const isMusicPath = (p: string | null | undefined) =>
  !!p && (p === "/music" || p.startsWith("/music/") || p.startsWith("/artist/"));

/** Masque le pied de page de la marketplace sur les pages Musique. */
export function HideInMusic({ children }: { children: ReactNode }) {
  return isMusicPath(usePathname()) ? null : <>{children}</>;
}
