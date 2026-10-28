import { Inter, Urbanist } from "next/font/google";

// Les polices de l'application Rivendy (refonte « Emerald Cinema » du
// 2026-10-24) : Urbanist pour les titres, Inter pour l'interface. Servies par
// le site lui-même (next/font), chargées seulement par les espaces qui les
// demandent (Play, puis la Musique le 2026-10-28) ; le texte s'affiche tout de
// suite dans la police de secours, puis bascule. Un seul module : les deux
// espaces partagent les mêmes fichiers, déjà dans le cache du navigateur.
const display = Urbanist({ subsets: ["latin", "latin-ext"], variable: "--font-urbanist", display: "swap" });
// Interface : pas de préchargement, l'image de la bannière passe d'abord.
const body = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap", preload: false });

/** Classes qui déclarent --font-urbanist et --font-inter sur la coque d'un espace. */
export const appFontVariables = `${display.variable} ${body.variable}`;
