import type { ReactNode } from "react";
import { Inter, Urbanist } from "next/font/google";
import { PlayShell } from "@/features/play/play-shell";

// Les polices de l'application Rivendy (refonte « Emerald Cinema » du
// 2026-10-24) : Urbanist pour les titres, Inter pour l'interface. Servies par
// le site lui-même (next/font), chargées seulement sur les pages Play ; le
// texte s'affiche tout de suite dans la police de secours, puis bascule.
const display = Urbanist({ subsets: ["latin", "latin-ext"], variable: "--font-urbanist", display: "swap" });
// Interface : pas de préchargement, l'image de la bannière passe d'abord.
const body = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap", preload: false });

/** Toutes les pages /play partagent la coque de Play : menu, barre du haut, « Ma liste », pied de page. */
export default function PlayLayout({ children }: { children: ReactNode }) {
  return <PlayShell fontClassName={`${display.variable} ${body.variable}`}>{children}</PlayShell>;
}
