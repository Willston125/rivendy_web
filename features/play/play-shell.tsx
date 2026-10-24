"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { AboutDialog, PlayFooter } from "./play-footer";
import { MobileTopBar, PlayHeader } from "./play-header";
import { PlayListProvider } from "./play-list";
import { playImage, playSrcSet } from "./play-logic";
import { PlaySearchProvider, usePlaySearch } from "./play-search";
import { EXPLORE, MY_LIST, PlaySidebar, type NavItem } from "./play-sidebar";
import { motion } from "./play-theme";

/**
 * Coque de Rivendy Play — « Emerald Cinema » (refonte du 2026-10-24) : la
 * salle sombre (halos émeraude, vignettage), le menu latéral flottant, la
 * barre du haut presque invisible et le panneau central, seul à défiler sur
 * grand écran. Tablette (768 à 1023 px) : menu en icônes, défilement normal.
 * Téléphone : barre du haut compacte et navigation basse à cinq destinations.
 * L'en-tête et le pied de page de la marketplace restent masqués sur /play
 * (HideInPlay).
 *
 * Aucun prix ni lien d'achat dans la coque : les pages /play/short/… sont
 * ouvertes depuis l'app Android (règle Google Play).
 */

/** Téléphone : cinq destinations ; « Récents » est un onglet de Ma liste. */
const MOBILE_NAV: NavItem[] = [
  ...EXPLORE,
  { ...MY_LIST, match: (p) => p.startsWith("/play/my-list") || p.startsWith("/play/history") },
];

// ── Ambiance de la page ────────────────────────────────────────────────────
// L'image du titre à l'écran (bannière de l'accueil, fiche, premier titre
// d'un catalogue), floutée derrière la barre du haut et le haut de la page :
// le décor du film se prolonge au-delà de la bannière. La page donne les
// MÊMES largeurs et tailles que l'image qu'elle affiche déjà : le navigateur
// reprend la même adresse, aucun téléchargement de plus.

type Backdrop = { src: string; widths: readonly number[]; sizes: string } | null;
const BackdropContext = createContext<(b: Backdrop) => void>(() => undefined);

/** Une page demande son ambiance ; elle est retirée en quittant la page. */
export function usePageBackdrop(src: string | null, widths: readonly number[], sizes: string) {
  const set = useContext(BackdropContext);
  useEffect(() => {
    set(src ? { src, widths, sizes } : null);
    return () => set(null);
  }, [set, src, widths, sizes]);
}

function PageBackdrop({ backdrop }: { backdrop: Backdrop }) {
  if (!backdrop) return null;
  const { src, widths, sizes } = backdrop;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[min(64rem,150vh)] overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={src} src={playImage(src, widths[Math.min(1, widths.length - 1)]) ?? src} srcSet={playSrcSet(src, widths)} sizes={sizes}
        alt="" decoding="async"
        className="rvp-fade-in absolute inset-0 h-full w-full scale-110 object-cover object-[50%_20%] opacity-45 blur-[64px] saturate-150" />
      <div className="rvp-backdrop-veil absolute inset-0" />
    </div>
  );
}

// ── Coque ──────────────────────────────────────────────────────────────────

export function PlayShell({ fontClassName, children }: { fontClassName?: string; children: ReactNode }) {
  // Fond de toute la page, et sur grand écran la fenêtre qui ne défile pas (site.css).
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.world = "play";
    return () => { delete html.dataset.world; };
  }, []);

  return (
    <PlayListProvider>
      <PlaySearchProvider>
        <ShellFrame fontClassName={fontClassName}>{children}</ShellFrame>
      </PlaySearchProvider>
    </PlayListProvider>
  );
}

function ShellFrame({ fontClassName, children }: { fontClassName?: string; children: ReactNode }) {
  const pathname = usePathname() || "/play";
  const router = useRouter();
  const { inputRef } = usePlaySearch();
  const main = useRef<HTMLDivElement>(null);
  const about = useRef<HTMLDialogElement>(null);
  const [backdrop, setBackdropState] = useState<Backdrop>(null);
  const [scrolled, setScrolled] = useState(false);

  const setBackdrop = useCallback((b: Backdrop) => {
    setBackdropState((cur) => (cur?.src === b?.src && cur?.sizes === b?.sizes ? cur : b));
  }, []);

  // Chaque page s'ouvre en haut du panneau central (sur grand écran, lui seul défile).
  useEffect(() => { main.current?.scrollTo({ top: 0 }); }, [pathname]);

  // Barres du haut transparentes en haut de page, en verre dès que l'on défile :
  // le panneau central sur grand écran, la page sur téléphone et tablette.
  useEffect(() => {
    const el = main.current;
    if (!el) return;
    let frame = 0;
    const read = () => { frame = 0; setScrolled(Math.max(el.scrollTop, window.scrollY) > 8); };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(read); };
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    read();
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Ctrl K (⌘ K sur Mac) : le champ de la barre du haut ; sans lui (téléphone), la page de recherche.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      const input = inputRef.current;
      if (input && input.offsetParent !== null) {
        input.focus();
        input.select();
      } else {
        router.push("/play/search");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inputRef, router]);

  const openAbout = () => about.current?.showModal();

  return (
    <BackdropContext.Provider value={setBackdrop}>
      {/* lg:h-dvh dès le rendu serveur : la fenêtre a sa hauteur avant même que html[data-world] soit posé. */}
      <div className={cn("rvp-scope rvp-atmosphere font-rvp-body text-rvp-text md:flex lg:h-dvh lg:overflow-hidden", fontClassName)}>
        <a href="#rvp-contenu"
          className="sr-only rounded-rvp bg-rvp-accent px-4 py-2.5 text-sm font-bold text-rvp-on-accent focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70]">
          Aller au contenu
        </a>
        <PlaySidebar pathname={pathname} onAbout={openAbout} />
        {/* « relative » : les éléments positionnés de la page (textes pour lecteurs d'écran
            compris) défilent et sont rognés avec le panneau, au lieu d'allonger la fenêtre.
            « isolate » : l'ambiance de la page se pose sous le contenu, jamais sous le fond. */}
        <div ref={main} id="rvp-main" className="relative isolate flex min-h-dvh min-w-0 flex-1 flex-col lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain">
          <PageBackdrop backdrop={backdrop} />
          <MobileTopBar pathname={pathname} scrolled={scrolled} />
          <PlayHeader pathname={pathname} scrolled={scrolled} />
          <div id="rvp-contenu" tabIndex={-1} className="flex-1 outline-none">{children}</div>
          <PlayFooter onAbout={openAbout} />
          {/* Place de la navigation basse (téléphone). */}
          <div aria-hidden className="h-[calc(4rem+env(safe-area-inset-bottom))] shrink-0 md:hidden" />
        </div>
        <MobileNav pathname={pathname} />
        <AboutDialog dialogRef={about} />
      </div>
    </BackdropContext.Provider>
  );
}

// ── Téléphone : navigation basse ───────────────────────────────────────────

function MobileNav({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Rivendy Play"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-rvp-edge bg-rvp-ground/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <ul className="mx-auto grid h-16 max-w-xl grid-cols-5">
        {MOBILE_NAV.map((it) => {
          const active = it.match(pathname);
          const Icon = it.icon;
          return (
            <li key={it.href}>
              <Link href={it.href} aria-current={active ? "page" : undefined}
                className={cn("relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold", motion,
                  active ? "text-rvp-text" : "text-rvp-muted hover:text-rvp-soft")}>
                {active ? <span aria-hidden className="absolute inset-x-4 top-0 h-[3px] rounded-b-full bg-rvp-accent shadow-rvp-dot" /> : null}
                <Icon className={cn("h-[22px] w-[22px]", active && "text-rvp-accent")} aria-hidden />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
