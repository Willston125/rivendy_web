"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight, ChartColumn, ChevronRight, Clock, Film, Heart, House, ListMusic, Music, Play, Plus, Search, ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry } from "@/features/country/country-provider";
import { cn } from "@/lib/utils/cn";
import { marketHomePath } from "@/lib/seo";
import { useMusicLibrary } from "./music-library";
import { inviteLogin } from "./music-login-invite";
import { musicNavActive, type MusicNavKey } from "./music-logic";

/** Page « Espace artiste » de la Musique (lot 2, 2026-10-29). */
export const ARTIST_SPACE_PATH = "/music/artiste";

/** Clips : dans Rivendy Play (lien sortant, sans préchargement). */
const CLIPS_HREF = "/play/clips";

const ITEMS: Array<{ key: MusicNavKey | "clips"; href: string; label: string; icon: LucideIcon }> = [
  { key: "discover", href: "/music", label: "Découvrir", icon: House },
  { key: "search", href: "/music/explore", label: "Rechercher", icon: Search },
  { key: "hit", href: "/music/hit", label: "Le Hit Rivendy", icon: ChartColumn },
  { key: "clips", href: CLIPS_HREF, label: "Clips", icon: Film },
];

/**
 * Navigation de l'espace Musique, en haut de la colonne vert lagon (lot 2,
 * style « fraîcheur », réglages du 2026-10-29) : la page active dans une
 * pilule citron, les autres en blanc, icônes au trait citron.
 */
export function MusicNav() {
  const active = musicNavActive(usePathname() || "/music");
  return (
    <nav aria-label="Rivendy Musique" className="flex shrink-0 flex-col gap-1 px-3 pt-4">
      {ITEMS.map((it) => {
        const on = it.key === active;
        const outside = it.key === "clips";
        return (
          <Link key={it.key} href={it.href} prefetch={outside ? false : undefined} aria-current={on ? "page" : undefined}
            className={cn("flex h-12 items-center gap-3.5 rounded-2xl px-4 text-base transition-colors", "[@media(max-height:760px)]:h-11",
              on ? "bg-rvm-accent font-extrabold text-rvm-on-accent" : "font-semibold text-rvm-text hover:bg-rvm-text/[0.08]")}>
            <it.icon className={cn("h-[22px] w-[22px] shrink-0", on ? "text-rvm-on-accent" : "text-rvm-ink-accent")} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{it.label}</span>
            {outside ? <span className="sr-only">, dans Rivendy Play</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

const LIBRARY_LINKS: Array<{ href: string; label: string; icon: LucideIcon; also?: string[] }> = [
  { href: "/music/favorites", label: "Titres likés", icon: Heart },
  { href: "/music/history", label: "Écoutés récemment", icon: Clock },
  { href: "/music/library", label: "Mes playlists", icon: ListMusic, also: ["/music/playlist"] },
];

/**
 * « Ma bibliothèque » de la colonne (réglages du 2026-10-29, maquette du
 * propriétaire) : trois entrées fixes et « + » pour créer une playlist. La
 * bibliothèque complète (recherche, tri, vues, albums, artistes) s'ouvre au
 * centre avec « Mes playlists » : rien n'est perdu, rien n'est écrasé.
 */
export function LibraryLinks() {
  const pathname = usePathname() || "/music";
  const { user, loading } = useAuth();
  const library = useMusicLibrary();
  return (
    <nav aria-label="Ma bibliothèque" className="shrink-0 px-3">
      <div className="flex items-center gap-2 pb-1 pl-4 pr-1">
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold">
          <span className="@max-[16rem]:hidden">Ma bibliothèque</span>
          <span className="hidden @max-[16rem]:inline">Bibliothèque</span>
        </h2>
        <button type="button" disabled={loading} aria-label="Créer une playlist" title="Créer une playlist"
          onClick={() => { if (user) void library.newPlaylist(); else inviteLogin({ kind: "create" }); }}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-rvm-text transition-colors hover:bg-rvm-text/[0.1] disabled:opacity-40">
          <Plus className="h-[22px] w-[22px]" aria-hidden />
        </button>
      </div>
      <ul className="flex flex-col gap-0.5">
        {LIBRARY_LINKS.map((l) => {
          const on = pathname === l.href || (l.also ?? []).some((p) => pathname.startsWith(p));
          return (
            <li key={l.href}>
              <Link href={l.href} aria-current={on ? "page" : undefined}
                className={cn("flex h-11 items-center gap-3.5 rounded-xl px-4 text-[15px] text-rvm-text transition-colors", "[@media(max-height:760px)]:h-10",
                  on ? "bg-rvm-text/[0.12] font-bold" : "font-medium hover:bg-rvm-text/[0.08]")}>
                <l.icon className="h-[22px] w-[22px] shrink-0 text-rvm-ink-accent" aria-hidden />
                <span className="min-w-0 truncate">{l.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Bas de la colonne : les espaces Rivendy, comme la maquette (Market, la
 * Musique où l'on est, Clips, Play). Sortir de la Musique ne précharge
 * rien : la connexion est souvent lente et payante.
 */
export function AppSwitcher() {
  const { country } = useCountry();
  const items: Array<{ key: string; href: string; label: string; icon: LucideIcon; here?: boolean }> = [
    { key: "market", href: country?.id ? marketHomePath(country.id) : "/", label: "Market", icon: ShoppingBag },
    { key: "music", href: "/music", label: "Musique", icon: Music, here: true },
    { key: "clips", href: CLIPS_HREF, label: "Clips", icon: Film },
    { key: "play", href: "/play", label: "Play", icon: Play },
  ];
  return (
    <nav aria-label="Espaces Rivendy" className="mt-auto grid shrink-0 grid-cols-4 gap-0.5 border-t border-rvm-line px-2 pb-2.5 pt-2">
      {items.map((it) => (
        <Link key={it.key} href={it.href} prefetch={it.here ? undefined : false} aria-current={it.here ? "true" : undefined}
          className={cn("flex flex-col items-center gap-1 rounded-xl py-2 text-xs transition-colors hover:bg-rvm-text/[0.08]",
            it.here ? "font-extrabold text-rvm-ink-accent" : "font-semibold text-rvm-text")}>
          <it.icon className="h-6 w-6 text-rvm-ink-accent" aria-hidden />
          {it.label}
          {it.here ? <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-rvm-ink-accent" /> : null}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Entrée « Espace artiste » (style « fraîcheur ») : une carte vert lagon avec
 * une photo qui donne envie, sous « Ma bibliothèque » (colonne) ou en bas de
 * la page Bibliothèque du téléphone. Le même texte pour tous : la page dit
 * ensuite l'état réel du compte (pas de lecture de plus à chaque page).
 * La photo vient de la maquette du propriétaire (public/music/) ; fenêtre
 * basse : la carte passe en ligne (photo à gauche) au lieu de disparaître.
 */
export function ArtistSpaceCard({ variant = "panel", className }: { variant?: "panel" | "row"; className?: string }) {
  const here = usePathname() === ARTIST_SPACE_PATH;
  const row = variant === "row";
  return (
    <Link href={ARTIST_SPACE_PATH} aria-current={here ? "page" : undefined}
      className={cn("rvm-deep rvm-artist-card group block overflow-hidden rounded-2xl shadow-lg shadow-rvm-deep/25 transition hover:brightness-110",
        row ? "flex items-center" : "[@media(max-height:860px)]:flex [@media(max-height:860px)]:items-center", here && "ring-2 ring-rvm-ink-accent", className)}>
      <span className={cn("relative block shrink-0 overflow-hidden",
        row ? "h-24 w-28" : "h-[100px] [@media(max-height:860px)]:h-[72px] [@media(max-height:860px)]:w-[76px]")}>
        <Image src="/music/espace-artiste.webp" alt="" fill sizes="(min-width: 768px) 280px, 112px" className="object-cover object-[60%_40%]" />
      </span>
      <span className={cn("block min-w-0", row ? "flex-1 px-4" : "px-4 pb-3.5 pt-2.5 [@media(max-height:860px)]:flex-1 [@media(max-height:860px)]:px-3 [@media(max-height:860px)]:py-0")}>
        <span className={cn("block font-rvm-display font-black leading-tight", row ? "text-xl" : "text-xl [@media(max-height:860px)]:text-base")}>Fais vibrer ta musique.</span>
        <span className={cn("mt-1.5 inline-flex items-center gap-1.5 font-extrabold text-rvm-ink-accent", row ? "text-sm" : "text-sm [@media(max-height:860px)]:mt-0.5 [@media(max-height:860px)]:text-[13px]")}>
          Espace artiste <ArrowRight className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden />
        </span>
      </span>
      {row ? <ChevronRight className="mr-4 h-5 w-5 shrink-0 text-rvm-ink-accent" aria-hidden /> : null}
    </Link>
  );
}
