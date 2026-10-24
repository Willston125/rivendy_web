"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Bookmark, Clock, Film, Info, LayoutGrid, Music, Tv, type LucideIcon } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { cn } from "@/lib/utils/cn";
import { PlayMark, Wordmark, useHomeHref } from "./play-brand";
import { usePlayList } from "./play-list";
import { motion } from "./play-theme";

/**
 * Menu latéral de Rivendy Play (« Emerald Cinema », 2026-10-24) : un panneau
 * flottant sur le fond de la salle. Complet dès 1280 px, en icônes de 768 à
 * 1279 px (tablette et petit écran), absent du téléphone (navigation basse).
 */

export type NavItem = { href: string; label: string; icon: LucideIcon; match: (p: string) => boolean };

export const EXPLORE: NavItem[] = [
  { href: "/play", label: "Découvrir", icon: LayoutGrid, match: (p) => p === "/play" },
  { href: "/play/movies", label: "Films", icon: Film, match: (p) => p.startsWith("/play/movie") },
  { href: "/play/series", label: "Séries", icon: Tv, match: (p) => p.startsWith("/play/series") || p.startsWith("/play/episode") },
  { href: "/play/clips", label: "Clips", icon: Music, match: (p) => p.startsWith("/play/clip") },
];

export const MY_LIST: NavItem = { href: "/play/my-list", label: "Ma liste", icon: Bookmark, match: (p) => p.startsWith("/play/my-list") };
export const RECENT: NavItem = { href: "/play/history", label: "Récents", icon: Clock, match: (p) => p.startsWith("/play/history") };

export function PlaySidebar({ pathname, onAbout }: { pathname: string; onAbout: () => void }) {
  const { user } = useAuth();
  const list = usePlayList();
  const homeHref = useHomeHref();
  // Nombre de titres de Ma liste : seulement quand la liste du compte est lue.
  const count = user && list.ids && !list.failed ? list.ids.length : null;

  return (
    <aside aria-label="Menu de Rivendy Play"
      className="hidden shrink-0 md:sticky md:top-0 md:block md:h-dvh md:self-start md:py-3 md:pl-3 lg:h-full lg:self-stretch xl:py-4 xl:pl-4">
      <div className="no-scrollbar relative flex h-full w-[84px] flex-col overflow-y-auto rounded-rvp-panel border border-rvp-edge bg-gradient-to-b from-rvp-surface to-rvp-frame px-2 pb-3 pt-6 shadow-rvp-deep xl:w-[228px] xl:px-4 xl:pb-4 xl:pt-8">
        <span aria-hidden className="rvp-halo-top pointer-events-none absolute inset-x-0 top-0 h-48" />
        <div className="relative flex flex-col items-center xl:items-start xl:px-2">
          {/* Le logo ramène à la marketplace, « PLAY » à l'accueil de Play. */}
          <Link href={homeHref} prefetch={false} aria-label="Rivendy, retour à la marketplace" className="rounded-md">
            <Wordmark className="h-6 xl:h-8" />
          </Link>
          <Link href="/play" aria-label="Rivendy Play, accueil" className="mt-2 rounded-md xl:mt-2.5">
            <PlayMark className="text-[10px] tracking-[0.32em] xl:text-[11px] xl:tracking-[0.38em]" />
          </Link>
        </div>

        <SideGroup label="Explorer" className="mt-9 xl:mt-11">
          {EXPLORE.map((it) => <SideLink key={it.href} item={it} active={it.match(pathname)} />)}
        </SideGroup>
        <SideGroup label="Votre espace" className="mt-5 xl:mt-8" separated>
          <SideLink item={MY_LIST} active={MY_LIST.match(pathname)} count={count} />
          <SideLink item={RECENT} active={RECENT.match(pathname)} />
        </SideGroup>

        <div className="relative mt-auto pt-8">
          {/* Signature : seulement si la hauteur d'écran laisse le menu entier visible. */}
          <div className="hidden px-2 [@media(min-width:1280px)_and_(min-height:861px)]:block">
            <p className="font-rvp-display text-[21px] font-bold leading-[1.15] tracking-tight">
              <span className="block text-rvp-text">Votre cinéma.</span>
              <span className="block text-rvp-accent">Votre univers.</span>
            </p>
            <p className="mt-3 text-[12px] leading-5 text-rvp-muted">Des histoires de chez nous.</p>
          </div>
          <AboutButton onAbout={onAbout} />
        </div>
      </div>
    </aside>
  );
}

function SideGroup({ label, className, separated, children }: { label: string; className?: string; separated?: boolean; children: ReactNode }) {
  return (
    <nav aria-label={label} className={cn("relative", className)}>
      {/* Menu en icônes : un trait sépare les groupes à la place de leur nom. */}
      {separated ? <span aria-hidden className="mx-auto mb-4 block h-px w-8 bg-rvp-line xl:hidden" /> : null}
      <p className="hidden px-3 text-[10px] font-bold uppercase tracking-[0.26em] text-rvp-muted xl:block">{label}</p>
      <ul className="mt-1 space-y-1.5 xl:mt-3.5">{children}</ul>
    </nav>
  );
}

/** Entrée du menu : icône et libellé dessous (en icônes), ou en ligne (menu complet). */
function SideLink({ item, active, count }: { item: NavItem; active: boolean; count?: number | null }) {
  const Icon = item.icon;
  return (
    <li>
      <Link href={item.href} aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex flex-col items-center gap-1 rounded-rvp px-1 py-2.5 text-[11px] font-semibold xl:min-h-12 xl:flex-row xl:gap-3.5 xl:px-3.5 xl:py-0 xl:text-[14.5px]",
          motion,
          active
            ? "bg-rvp-accent/[0.09] text-rvp-text shadow-rvp-active ring-1 ring-inset ring-rvp-edge-strong"
            : "text-rvp-soft hover:bg-white/[0.04] hover:text-rvp-text",
        )}>
        {active ? <span aria-hidden className="absolute inset-y-2.5 left-0 w-[3px] rounded-r-full bg-rvp-accent shadow-rvp-dot" /> : null}
        <Icon className={cn("h-5 w-5 shrink-0", motion, active ? "text-rvp-accent" : "text-rvp-muted group-hover:text-rvp-soft")} aria-hidden />
        <span className="xl:flex-1">{item.label}</span>
        {count != null ? (
          <span className="absolute right-1.5 top-1.5 min-w-5 rounded-md border border-rvp-edge bg-rvp-ground/70 px-1 text-center text-[10px] font-semibold leading-4 tabular-nums text-rvp-soft xl:static xl:min-w-6 xl:py-0.5 xl:text-[11px]">
            <span aria-hidden>{count}</span>
            <span className="sr-only">, {count} titre{count > 1 ? "s" : ""}</span>
          </span>
        ) : active ? (
          <span aria-hidden className="hidden h-1.5 w-1.5 rounded-full bg-rvp-accent shadow-rvp-dot xl:block" />
        ) : null}
      </Link>
    </li>
  );
}

/** « À propos de Play » : une bobine de film en filigrane (menu complet), une icône sinon. */
function AboutButton({ onAbout }: { onAbout: () => void }) {
  return (
    <button type="button" onClick={onAbout} aria-haspopup="dialog"
      className={cn(
        "group relative mt-6 flex h-12 w-full items-center justify-center overflow-hidden rounded-rvp-card border border-rvp-edge bg-rvp-ground/40 text-rvp-soft hover:border-rvp-edge-strong hover:text-rvp-text xl:h-[76px] xl:justify-start xl:gap-3 xl:pl-[78px] xl:pr-3.5",
        motion,
      )}>
      <ReelArt className="pointer-events-none absolute -left-5 top-1/2 hidden h-[84px] w-[84px] -translate-y-1/2 text-rvp-accent/40 transition-transform duration-(--rvp-slow) ease-rvp motion-safe:group-hover:rotate-[36deg] xl:block" />
      <Info className="h-4 w-4 xl:hidden" aria-hidden />
      <span className="hidden flex-1 text-left text-[13px] font-semibold leading-tight xl:block">À propos<br />de Play</span>
      <span className="sr-only xl:hidden">À propos de Rivendy Play</span>
      <ArrowRight className="hidden h-4 w-4 shrink-0 transition-transform duration-(--rvp-base) ease-rvp motion-safe:group-hover:translate-x-0.5 xl:block" aria-hidden />
    </button>
  );
}

/** Bobine de film dessinée (cinq perforations autour du moyeu). */
function ReelArt({ className }: { className?: string }) {
  // Positions écrites en dur (pas de trigonométrie au rendu : même attribut au serveur et au navigateur).
  const holes: Array<[number, number]> = [[32, 17], [46.27, 27.36], [40.82, 44.14], [23.18, 44.14], [17.73, 27.36]];
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden className={className}>
      <circle cx="32" cy="32" r="29" />
      <circle cx="32" cy="32" r="24.5" strokeOpacity="0.5" />
      <circle cx="32" cy="32" r="4.5" />
      {holes.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="6.5" />)}
    </svg>
  );
}
