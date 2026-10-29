"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ArrowUpRight, ChevronRight, House, MicVocal, Search, SquarePlay, Trophy, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { musicNavActive, type MusicNavKey } from "./music-logic";

/** Page « Espace artiste » de la Musique (lot 2, 2026-10-29). */
export const ARTIST_SPACE_PATH = "/music/artiste";

const ITEMS: Array<{ key: MusicNavKey | "play"; href: string; label: string; icon: LucideIcon }> = [
  { key: "discover", href: "/music", label: "Découvrir", icon: House },
  { key: "search", href: "/music/explore", label: "Rechercher", icon: Search },
  { key: "hit", href: "/music/hit", label: "Le Hit Rivendy", icon: Trophy },
  { key: "play", href: "/play", label: "Rivendy Play", icon: SquarePlay },
];

/**
 * Navigation de l'espace Musique (lot 2, 2026-10-29), au-dessus de « Ma
 * bibliothèque » : libellés quand la bibliothèque est en liste, icônes
 * seules dans le rail (visiteur, bibliothèque repliée). Rivendy Play quitte
 * la Musique : une petite flèche, jamais « active », pas de préchargement.
 */
export function MusicNav({ compact }: { compact: boolean }) {
  const active = musicNavActive(usePathname() || "/music");
  return (
    <nav aria-label="Rivendy Musique"
      className={cn("shrink-0 rounded-lg bg-rvm-surface", compact ? "flex flex-col items-center gap-1 py-2" : "flex flex-col gap-0.5 p-2")}>
      {ITEMS.map((it) => {
        const on = it.key === active;
        const outside = it.key === "play";
        return (
          <Link key={it.key} href={it.href} prefetch={outside ? false : undefined} aria-current={on ? "page" : undefined}
            aria-label={compact ? (outside ? `${it.label}, quitte la Musique` : it.label) : undefined} title={compact ? it.label : undefined}
            className={cn("relative flex h-11 items-center rounded-md transition-colors",
              compact ? "w-[52px] justify-center" : "gap-3.5 px-3.5 text-[15px]",
              on ? "bg-rvm-accent/[0.13] font-bold text-rvm-text" : "font-semibold text-rvm-soft hover:bg-white/[0.06] hover:text-rvm-text")}>
            {on ? <span aria-hidden className={cn("absolute inset-y-2.5 w-[3px] rounded-r-full bg-rvm-accent", compact ? "-left-2.5" : "left-0")} /> : null}
            <it.icon className={cn("h-[22px] w-[22px] shrink-0", on && "text-rvm-accent")} aria-hidden />
            {!compact ? <span className="min-w-0 flex-1 truncate">{it.label}</span> : null}
            {!compact && outside ? (
              <>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-rvm-muted" aria-hidden />
                <span className="sr-only">, quitte la Musique</span>
              </>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Entrée « Espace artiste » : carte en bas de « Ma bibliothèque » (panneau)
 * ou ligne en bas de la page Bibliothèque du téléphone. Le même texte pour
 * tous : la page dit ensuite l'état réel du compte (pas de lecture de plus
 * à chaque page, la connexion est souvent lente).
 */
export function ArtistSpaceCard({ variant = "panel", className }: { variant?: "panel" | "row"; className?: string }) {
  const here = usePathname() === ARTIST_SPACE_PATH;
  return (
    <Link href={ARTIST_SPACE_PATH} aria-current={here ? "page" : undefined}
      className={cn("rvm-artist-card group block rounded-xl border text-rvm-text transition-colors hover:border-rvm-accent/50",
        here ? "border-rvm-accent/60" : "border-white/[0.06]", variant === "row" ? "flex items-center gap-3.5 p-4" : "p-3.5", className)}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rvm-accent/15 text-rvm-accent">
        <MicVocal className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <span className={cn("block min-w-0", variant === "row" ? "flex-1" : "mt-2.5")}>
        <span className="block font-rvm-display text-lg font-extrabold leading-tight">Votre musique mérite sa scène.</span>
        {variant === "row" ? (
          <span className="mt-1 block text-[13px] text-rvm-soft">Espace artiste : singles, EP, albums.</span>
        ) : (
          <>
            {/* Écran bas : la carte reste courte, la bibliothèque garde sa place. */}
            <span className="mt-1 hidden text-[13px] leading-snug text-rvm-soft [@media(min-height:860px)]:block">
              Singles, EP, albums : publiez avec un compte artiste vérifié.
            </span>
            <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-rvm-accent">
              Espace artiste <ArrowRight className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden />
            </span>
          </>
        )}
      </span>
      {variant === "row" ? <ChevronRight className="h-5 w-5 shrink-0 text-rvm-accent" aria-hidden /> : null}
    </Link>
  );
}

/** Rail (visiteur, bibliothèque repliée) : l'« Espace artiste » en une icône. */
export function ArtistSpaceIcon({ className }: { className?: string }) {
  const here = usePathname() === ARTIST_SPACE_PATH;
  return (
    <Link href={ARTIST_SPACE_PATH} aria-label="Espace artiste" title="Espace artiste" aria-current={here ? "page" : undefined}
      className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors",
        here ? "bg-rvm-accent text-rvm-on-accent" : "bg-rvm-accent/15 text-rvm-accent hover:bg-rvm-accent/25", className)}>
      <MicVocal className="h-5 w-5" aria-hidden />
    </Link>
  );
}
