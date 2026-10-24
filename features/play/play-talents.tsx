"use client";

import { useId } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { display, eyebrow, motion } from "./play-theme";

/**
 * « L'espace des talents » (« Emerald Cinema », 2026-10-24) : le pont vers
 * les créateurs — les clips des artistes s'il y en a, sinon les artistes de
 * Rivendy Musique (`talentsTarget`). L'image est une ILLUSTRATION dessinée
 * ici (projecteur, micro, foule) : aucune photo d'artiste inventée, rien à
 * télécharger.
 */
export function TalentSpotlight({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <Link href={href} prefetch={href.startsWith("/music") ? false : undefined}
      className={cn(
        "group @container relative isolate flex min-h-[13rem] flex-col justify-between overflow-hidden rounded-rvp-panel border border-rvp-edge-strong bg-rvp-ground p-5 shadow-rvp-card hover:border-rvp-accent/60 hover:shadow-rvp-glow",
        motion,
        className,
      )}>
      {/* L'illustration, ancrée à droite et en bas ; fondue vers le texte. */}
      <span aria-hidden className="absolute inset-y-0 right-0 -z-10 w-full max-w-[26rem] [mask-image:linear-gradient(to_right,transparent,#000_32%)]">
        <StageArt className="h-full w-full transition-transform duration-(--rvp-slow) ease-rvp motion-safe:group-hover:scale-[1.04]" />
      </span>
      <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-rvp-ground/85 via-rvp-ground/30 to-transparent" />
      <span className={cn(eyebrow, "relative text-rvp-soft")}>L’espace des talents</span>
      {/* Titre réglé sur la largeur de la carte : à côté des cartes, elle prend leur hauteur. */}
      <span className="relative mt-5">
        <span className={cn(display, "block text-[clamp(1.5rem,8.4cqi,1.9rem)] font-bold leading-[1.05] text-rvp-text")}>
          La scène<span className="block text-rvp-accent">est à vous.</span>
        </span>
        <span className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-rvp-text">
          {label}
          <ArrowRight className="h-4 w-4 transition-transform duration-(--rvp-base) ease-rvp motion-safe:group-hover:translate-x-1" aria-hidden />
        </span>
      </span>
    </Link>
  );
}

// Foule : têtes [x, y, rayon] et bras levés (dont deux téléphones allumés), écrits en dur.
const HEADS: Array<[number, number, number]> = [
  [18, 252, 15], [58, 258, 14], [96, 248, 16], [140, 256, 15], [182, 250, 16], [226, 258, 14],
  [266, 249, 16], [306, 256, 15], [348, 247, 17], [392, 255, 15], [432, 250, 16], [470, 257, 15],
];
const ARMS = ["96,264 104,264 112,203 105,201", "297,264 305,264 296,208 289,207", "432,264 440,264 446,199 439,197"];
const HANDS: Array<[number, number]> = [[108, 199], [292, 204], [442, 194]];
const DUST: Array<[number, number, number, number]> = [
  [352, 46, 1.4, 0.7], [371, 82, 1, 0.5], [338, 124, 1.2, 0.45], [392, 140, 1.6, 0.4], [318, 172, 1, 0.35],
  [405, 60, 1.1, 0.55], [380, 192, 1.3, 0.3], [302, 96, 0.9, 0.4], [420, 118, 1, 0.35], [344, 214, 1.2, 0.3],
];

/** Une scène : projecteur, faisceaux, micro sur pied, foule à contre-jour. */
function StageArt({ className }: { className?: string }) {
  // Identifiants propres à chaque dessin (dégradés), sans caractère interdit dans url(#…).
  const id = `rvp-stage-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const url = (name: string) => `url(#${id}-${name})`;
  return (
    <svg viewBox="0 0 480 300" preserveAspectRatio="xMaxYMax slice" aria-hidden className={className}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0B3326" />
          <stop offset="0.55" stopColor="#041510" />
          <stop offset="1" stopColor="#020907" />
        </linearGradient>
        <linearGradient id={`${id}-beam`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E9FFF6" stopOpacity="0.34" />
          <stop offset="0.6" stopColor="#7DFFD2" stopOpacity="0.08" />
          <stop offset="1" stopColor="#7DFFD2" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-lamp`}>
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="0.25" stopColor="#B8FFE9" stopOpacity="0.6" />
          <stop offset="1" stopColor="#00D6A3" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-stage`}>
          <stop offset="0" stopColor="#00D6A3" stopOpacity="0.55" />
          <stop offset="1" stopColor="#00D6A3" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3D5A50" />
          <stop offset="0.35" stopColor="#C8E6DA" />
          <stop offset="0.6" stopColor="#4F6E63" />
          <stop offset="1" stopColor="#14241F" />
        </linearGradient>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0E1F19" />
          <stop offset="0.4" stopColor="#2C4A40" />
          <stop offset="1" stopColor="#06110D" />
        </linearGradient>
        <pattern id={`${id}-mesh`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0 L0 5" stroke="#0A1A15" strokeWidth="1.2" strokeOpacity="0.55" />
        </pattern>
      </defs>

      <rect width="480" height="300" fill={url("bg")} />
      {/* Faisceaux du projecteur. */}
      <polygon points="300,0 420,0 540,300 170,300" fill={url("beam")} opacity="0.45" />
      <polygon points="335,0 385,0 455,300 255,300" fill={url("beam")} />
      {/* Lueur de la scène derrière la foule. */}
      <ellipse cx="330" cy="300" rx="230" ry="80" fill={url("stage")} />
      {DUST.map(([x, y, r, o]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#E9FFF6" opacity={o} />)}
      <circle cx="360" cy="0" r="46" fill={url("lamp")} />

      {/* Pied et micro, éclairés par le haut. */}
      <rect x="357.5" y="168" width="5" height="132" rx="2" fill="#0A1813" />
      <rect x="357.5" y="168" width="1.6" height="132" fill="#7DFFD2" opacity="0.25" />
      <g transform="rotate(-16 360 160)">
        <path d="M347 142 H373 L366 206 Q360 212 354 206 Z" fill={url("body")} />
        <rect x="344.5" y="133" width="31" height="10" rx="3" fill="#0B1E18" stroke="#7DFFD2" strokeOpacity="0.35" />
        <rect x="342" y="88" width="36" height="48" rx="18" fill={url("metal")} />
        <rect x="342" y="88" width="36" height="48" rx="18" fill={url("mesh")} />
        <rect x="342.5" y="88.5" width="35" height="47" rx="17.5" fill="none" stroke="#B8FFE9" strokeOpacity="0.55" />
        <ellipse cx="352" cy="100" rx="4" ry="9" fill="#FFFFFF" opacity="0.35" />
      </g>
      <circle cx="356" cy="108" r="40" fill={url("lamp")} opacity="0.35" />

      {/* La foule à contre-jour, deux téléphones levés. */}
      <g fill="#010604">
        <rect x="0" y="268" width="480" height="32" />
        {HEADS.map(([x, y, r]) => (
          <g key={x}>
            <circle cx={x} cy={y} r={r} />
            <ellipse cx={x} cy={y + r + 14} rx={r * 1.9} ry="16" />
          </g>
        ))}
        {ARMS.map((points) => <polygon key={points} points={points} />)}
        {HANDS.map(([x, y]) => <circle key={x} cx={x} cy={y} r="5" />)}
      </g>
      <rect x="104" y="186" width="8" height="12" rx="1.5" fill="#B8FFE9" opacity="0.85" />
      <rect x="438" y="181" width="8" height="12" rx="1.5" fill="#B8FFE9" opacity="0.8" />
    </svg>
  );
}
