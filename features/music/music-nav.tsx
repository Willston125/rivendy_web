"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ChartColumn, ChevronRight, Film, House, MicVocal, Music, Play, Search, ShoppingBag, type LucideIcon } from "lucide-react";
import { useCountry } from "@/features/country/country-provider";
import { cn } from "@/lib/utils/cn";
import { marketHomePath } from "@/lib/seo";
import { musicNavActive, type MusicNavKey } from "./music-logic";

/** Page « Espace artiste » de la Musique (lot 2, 2026-10-29). */
export const ARTIST_SPACE_PATH = "/music/artiste";

const ITEMS: Array<{ key: MusicNavKey | "clips"; href: string; label: string; icon: LucideIcon }> = [
  { key: "discover", href: "/music", label: "Découvrir", icon: House },
  { key: "search", href: "/music/explore", label: "Rechercher", icon: Search },
  { key: "hit", href: "/music/hit", label: "Le Hit Rivendy", icon: ChartColumn },
  { key: "clips", href: "/play/clips", label: "Clips", icon: Film },
];

/**
 * Navigation de l'espace Musique, dans la colonne vert lagon (lot 2, puis
 * style « fraîcheur » du 2026-10-29) : la page active dans une pilule citron,
 * les autres en blanc, icônes au trait citron. Icônes seules dans le rail.
 * Les Clips s'ouvrent dans Rivendy Play : pas de préchargement.
 */
export function MusicNav({ compact }: { compact: boolean }) {
  const active = musicNavActive(usePathname() || "/music");
  return (
    <nav aria-label="Rivendy Musique"
      className={cn("shrink-0", compact ? "flex flex-col items-center gap-1.5 pt-3" : "flex flex-col gap-1 px-3 pt-4")}>
      {ITEMS.map((it) => {
        const on = it.key === active;
        const outside = it.key === "clips";
        return (
          <Link key={it.key} href={it.href} prefetch={outside ? false : undefined} aria-current={on ? "page" : undefined}
            aria-label={compact ? (outside ? `${it.label}, dans Rivendy Play` : it.label) : undefined} title={compact ? it.label : undefined}
            className={cn("flex h-12 items-center rounded-2xl transition-colors",
              compact ? "w-12 justify-center" : "gap-3.5 px-4 text-base",
              on ? "bg-rvm-accent font-extrabold text-rvm-on-accent" : "font-semibold text-rvm-text hover:bg-rvm-text/[0.08]")}>
            <it.icon className={cn("h-[22px] w-[22px] shrink-0", on ? "text-rvm-on-accent" : "text-rvm-ink-accent")} aria-hidden />
            {!compact ? <span className="min-w-0 flex-1 truncate">{it.label}</span> : null}
            {!compact && outside ? <span className="sr-only">, dans Rivendy Play</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Bas de la colonne : les espaces Rivendy (Market, la Musique où l'on est,
 * Play). Sortir de la Musique ne précharge rien : la connexion est souvent
 * lente et payante.
 */
export function AppSwitcher({ compact }: { compact: boolean }) {
  const { country } = useCountry();
  const items: Array<{ key: string; href: string; label: string; icon: LucideIcon; here?: boolean }> = [
    { key: "market", href: country?.id ? marketHomePath(country.id) : "/", label: "Market", icon: ShoppingBag },
    { key: "music", href: "/music", label: "Musique", icon: Music, here: true },
    { key: "play", href: "/play", label: "Play", icon: Play },
  ];
  return (
    <nav aria-label="Espaces Rivendy"
      className={cn("shrink-0 border-t border-rvm-line", compact ? "flex flex-col items-center gap-1 py-2" : "grid grid-cols-3 gap-1 px-3 pb-3 pt-2")}>
      {items.map((it) => (
        <Link key={it.key} href={it.href} prefetch={it.here ? undefined : false} aria-current={it.here ? "true" : undefined}
          aria-label={compact ? it.label : undefined} title={compact ? it.label : undefined}
          className={cn("flex flex-col items-center gap-1 rounded-xl py-2 text-xs transition-colors hover:bg-rvm-text/[0.08]",
            compact && "w-12", it.here ? "font-extrabold text-rvm-ink-accent" : "font-semibold text-rvm-text")}>
          <it.icon className="h-6 w-6 text-rvm-ink-accent" aria-hidden />
          {!compact ? it.label : null}
          {it.here ? <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-rvm-ink-accent" /> : null}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Entrée « Espace artiste » (style « fraîcheur ») : une carte vert lagon avec
 * une photo qui donne envie, en bas de « Ma bibliothèque » (panneau) ou de la
 * page Bibliothèque du téléphone. Le même texte pour tous : la page dit
 * ensuite l'état réel du compte (pas de lecture de plus à chaque page).
 * La photo vient de la maquette du propriétaire (public/music/) ; écran bas :
 * elle s'efface, la bibliothèque garde sa place.
 */
export function ArtistSpaceCard({ variant = "panel", className }: { variant?: "panel" | "row"; className?: string }) {
  const here = usePathname() === ARTIST_SPACE_PATH;
  return (
    <Link href={ARTIST_SPACE_PATH} aria-current={here ? "page" : undefined}
      className={cn("rvm-deep rvm-artist-card group block overflow-hidden rounded-2xl shadow-lg shadow-rvm-deep/25 transition hover:brightness-110",
        variant === "row" && "flex items-center", here && "ring-2 ring-rvm-ink-accent", className)}>
      <span className={cn("relative block shrink-0 overflow-hidden",
        variant === "row" ? "h-24 w-28" : "h-28 [@media(max-height:900px)]:hidden")}>
        <Image src="/music/espace-artiste.webp" alt="" fill sizes="(min-width: 768px) 320px, 112px" className="object-cover object-[60%_40%]" />
      </span>
      <span className={cn("block min-w-0", variant === "row" ? "flex-1 px-4" : "px-4 pb-4 pt-3")}>
        <span className="block font-rvm-display text-xl font-black leading-tight">Fais vibrer ta musique.</span>
        <span className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-extrabold text-rvm-ink-accent">
          Espace artiste <ArrowRight className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden />
        </span>
      </span>
      {variant === "row" ? <ChevronRight className="mr-4 h-5 w-5 shrink-0 text-rvm-ink-accent" aria-hidden /> : null}
    </Link>
  );
}

/** Rail (bibliothèque repliée) : l'« Espace artiste » en une icône. */
export function ArtistSpaceIcon({ className }: { className?: string }) {
  const here = usePathname() === ARTIST_SPACE_PATH;
  return (
    <Link href={ARTIST_SPACE_PATH} aria-label="Espace artiste" title="Espace artiste" aria-current={here ? "page" : undefined}
      className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors",
        here ? "bg-rvm-accent text-rvm-on-accent" : "bg-rvm-accent/15 text-rvm-ink-accent hover:bg-rvm-accent/25", className)}>
      <MicVocal className="h-5 w-5" aria-hidden />
    </Link>
  );
}
