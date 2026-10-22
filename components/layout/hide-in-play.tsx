"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/** Rivendy Play a son propre en-tête et son pied de page (refonte du 2026-10-22). */
export const isPlayPath = (p: string | null | undefined) => !!p && (p === "/play" || p.startsWith("/play/"));

/** Masque l'élément de la marketplace (en-tête, pied de page) sur les pages /play. */
export function HideInPlay({ children }: { children: ReactNode }) {
  return isPlayPath(usePathname()) ? null : <>{children}</>;
}
