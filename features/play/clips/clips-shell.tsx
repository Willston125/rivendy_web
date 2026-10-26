"use client";

import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Bookmark, Flame, History, House, MicVocal, Plus, Search, UsersRound, X, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Wordmark } from "../play-brand";
import { AccountMenu, BAR_SCROLLED, NotificationsLink } from "../play-header";
import { motion } from "../play-theme";
import { artistCta, clipsHref, filterFromParams, hasTrending } from "./clips-logic";
import { useClips, useClipsCatalog } from "./clips-store";

/**
 * Coque de Rivendy Clips (refonte du 2026-10-26, maquette du propriétaire) :
 * le même cadre que Play — menu latéral flottant, barre du haut, navigation
 * basse sur téléphone —, mais consacré aux clips et aux artistes. Chaque
 * entrée mène à un écran qui marche : « Tendances » n'apparaît que si le
 * catalogue a assez de vues pour un vrai classement.
 */

type ClipsNavItem = { href: string; label: string; short?: string; icon: LucideIcon; active: (p: string, f: string | null) => boolean };

const HOME: ClipsNavItem = { href: "/play/clips", label: "Accueil", icon: House, active: (p, f) => p === "/play/clips" && f !== "tendances" };
const TRENDING: ClipsNavItem = { href: "/play/clips?f=tendances", label: "Tendances", icon: Flame, active: (p, f) => p === "/play/clips" && f === "tendances" };
const FOLLOWING: ClipsNavItem = { href: "/play/clips/abonnements", label: "Abonnements", icon: UsersRound, active: (p) => p.startsWith("/play/clips/abonnements") };
const SAVED: ClipsNavItem = { href: "/play/clips/enregistrements", label: "Enregistrements", short: "Enregistrés", icon: Bookmark, active: (p) => p.startsWith("/play/clips/enregistrements") };
const HISTORY: ClipsNavItem = { href: "/play/clips/historique", label: "Historique", icon: History, active: (p) => p.startsWith("/play/clips/historique") };
const ARTIST: ClipsNavItem = { href: "/play/clips/artiste", label: "Espace artiste", short: "Artiste", icon: MicVocal, active: (p) => p.startsWith("/play/clips/artiste") };

/** « Tendances » seulement si le catalogue permet un classement réel. */
function useTrendingAvailable(): boolean {
  const { catalog } = useClipsCatalog();
  return catalog.status === "ready" && hasTrending(catalog.clips, catalog.counts);
}

/** Signature : le logo Rivendy, puis « clips » en turquoise. */
export function ClipsWordmark({ className, size = "md" }: { className?: string; size?: "sm" | "md" }) {
  return (
    <span className={cn("flex items-end gap-1.5", className)}>
      <Wordmark className={size === "sm" ? "h-6" : "h-7 xl:h-8"} />
      <span className={cn("font-rvp-display font-semibold leading-none tracking-tight text-rvp-accent", size === "sm" ? "pb-px text-[17px]" : "pb-0.5 text-[19px] xl:text-[22px]")}>
        clips
      </span>
    </span>
  );
}

// ── Menu latéral (tablette et ordinateur) ──────────────────────────────────

export function ClipsSidebar({ pathname }: { pathname: string }) {
  return (
    <aside aria-label="Menu de Rivendy Clips"
      className="hidden shrink-0 md:sticky md:top-0 md:block md:h-dvh md:self-start md:py-3 md:pl-3 lg:h-full lg:self-stretch xl:py-4 xl:pl-4">
      <div className="no-scrollbar relative flex h-full w-[84px] flex-col overflow-y-auto rounded-rvp-panel border border-rvp-edge bg-rvp-frame px-2 pb-3 pt-6 shadow-rvp-deep xl:w-[232px] xl:px-4 xl:pb-4 xl:pt-7">
        <Link href="/play/clips" aria-label="Rivendy Clips, accueil" className="mx-auto rounded-md xl:mx-0 xl:px-2">
          <span className="hidden xl:block"><ClipsWordmark /></span>
          <span className="grid h-11 w-11 place-items-center rounded-rvp bg-rvp-accent/12 text-rvp-accent xl:hidden">
            <MicVocal className="h-5 w-5" aria-hidden />
          </span>
        </Link>
        <Suspense fallback={<SideNav pathname={pathname} f={null} />}>
          <SideNavWithParams pathname={pathname} />
        </Suspense>
        <div className="mt-auto pt-6">
          <Link href="/play" prefetch={false}
            className={cn("flex h-11 flex-col items-center justify-center gap-0.5 rounded-rvp text-[11px] font-semibold text-rvp-muted hover:bg-white/[0.04] hover:text-rvp-text xl:flex-row xl:justify-start xl:gap-3 xl:px-3.5 xl:text-[13.5px]", motion)}>
            <ArrowLeft className="h-[18px] w-[18px] shrink-0" aria-hidden />
            <span className="hidden xl:inline">Retour à Rivendy Play</span>
            <span className="xl:hidden">Play</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}

function SideNavWithParams({ pathname }: { pathname: string }) {
  const params = useSearchParams();
  return <SideNav pathname={pathname} f={params.get("f")} />;
}

function SideNav({ pathname, f }: { pathname: string; f: string | null }) {
  const trending = useTrendingAvailable();
  const groups: ClipsNavItem[][] = [
    trending ? [HOME, TRENDING, FOLLOWING] : [HOME, FOLLOWING],
    [SAVED, HISTORY],
    [ARTIST],
  ];
  return (
    <>
      {groups.map((items, i) => (
        <nav key={i} aria-label={i === 0 ? "Découvrir" : i === 1 ? "Votre espace" : "Artistes"}
          className={cn(i === 0 ? "mt-8 xl:mt-9" : "mt-4 border-t border-rvp-line pt-4 xl:mt-5 xl:pt-5")}>
          <ul className="space-y-1">
            {items.map((it) => <SideLink key={it.href} item={it} active={it.active(pathname, f)} />)}
          </ul>
        </nav>
      ))}
    </>
  );
}

function SideLink({ item, active }: { item: ClipsNavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <li>
      <Link href={item.href} aria-current={active ? "page" : undefined}
        className={cn(
          "group flex flex-col items-center gap-1 rounded-rvp px-1 py-2.5 text-[11px] font-semibold xl:min-h-11 xl:flex-row xl:gap-3.5 xl:px-3.5 xl:py-0 xl:text-[14.5px]",
          motion,
          active ? "bg-rvp-accent/15 text-rvp-text ring-1 ring-inset ring-rvp-edge-strong" : "text-rvp-soft hover:bg-white/[0.05] hover:text-rvp-text",
        )}>
        <Icon className={cn("h-5 w-5 shrink-0", active ? "text-rvp-accent" : "text-rvp-muted group-hover:text-rvp-soft")} aria-hidden />
        <span className="text-center leading-tight xl:text-left">
          <span className="xl:hidden">{item.short ?? item.label}</span>
          <span className="hidden xl:inline">{item.label}</span>
        </span>
      </Link>
    </li>
  );
}

// ── Barre du haut (tablette et ordinateur) ─────────────────────────────────

export function ClipsHeader({ scrolled }: { scrolled: boolean }) {
  return (
    <header className={cn("sticky top-0 z-30 hidden shrink-0 md:block", motion, scrolled ? BAR_SCROLLED : "bg-transparent")}>
      <div className="mx-auto flex h-[72px] w-full max-w-[1480px] items-center gap-3 px-4 sm:px-6 xl:px-8">
        <Suspense fallback={<SearchBoxShell value="" onChange={() => undefined} onSubmit={() => undefined} />}>
          <ClipsSearchBox />
        </Suspense>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <ArtistButton />
          <NotificationsLink />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}

/** « Publier un clip » pour un artiste validé, sinon « Espace artiste » : les deux mènent à l'espace artiste. */
function ArtistButton({ compact }: { compact?: boolean }) {
  const { artist } = useClips();
  const label = artistCta(artist.status ?? "none");
  return (
    <Link href="/play/clips/artiste" prefetch={false} aria-label={compact ? label : undefined}
      className={cn("flex h-11 items-center gap-2 rounded-rvp border border-rvp-accent/70 px-3 text-[14px] font-semibold text-rvp-text hover:bg-rvp-accent/10 lg:px-4", motion)}>
      <Plus className="h-[18px] w-[18px] text-rvp-accent" aria-hidden />
      <span className={compact ? "sr-only" : "hidden lg:inline"}>{label}</span>
    </Link>
  );
}

/**
 * Recherche « clip, artiste » : sur l'accueil Clips, les résultats suivent la
 * frappe (l'adresse garde la recherche : retour et lien partagé) ; ailleurs,
 * Entrée ouvre l'accueil sur ces résultats.
 */
function ClipsSearchBox() {
  const { value, setValue, submit } = useClipsQueryInput();
  const { search } = useClips();
  return <SearchBoxShell value={value} onChange={setValue} inputRef={search.inputRef} onSubmit={submit} />;
}

/**
 * Saisie de recherche reliée à l'adresse (`?q=`) : sur l'accueil Clips, la
 * grille suit la frappe sans empiler l'historique ; ailleurs, `submit` ouvre
 * l'accueil sur ces résultats. Une réponse de l'adresse n'efface jamais une
 * lettre tapée entre-temps (seul un changement EXTÉRIEUR — retour, filtre,
 * lien — remplace la saisie).
 */
export function useClipsQueryInput(): { value: string; setValue: (v: string) => void; submit: () => void } {
  const router = useRouter();
  const pathname = usePathname() || "";
  const params = useSearchParams();
  const onHome = pathname === "/play/clips";
  const urlQ = onHome ? params.get("q") ?? "" : "";
  const [value, setValue] = useState(urlQ);
  const written = useRef<string | null>(null);

  useEffect(() => {
    if (written.current !== null && written.current.trim().slice(0, 60) === urlQ.trim()) return;
    written.current = null;
    setValue(urlQ);
  }, [urlQ]);

  useEffect(() => {
    if (!onHome || value.trim() === urlQ.trim()) return;
    const t = window.setTimeout(() => {
      written.current = value;
      router.replace(clipsHref(filterFromParams(params.get("f"), params.get("genre")), value), { scroll: false });
    }, 250);
    return () => window.clearTimeout(t);
  }, [value, onHome, urlQ, params, router]);

  return { value, setValue, submit: () => { if (!onHome) router.push(clipsHref({ kind: "discover" }, value)); } };
}

function SearchBoxShell({ value, onChange, onSubmit, inputRef }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <form role="search" aria-label="Rechercher dans Rivendy Clips" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      className={cn("flex h-12 min-w-0 max-w-[600px] flex-1 items-center gap-3 rounded-full border border-rvp-edge bg-rvp-surface pl-4 pr-2 hover:border-white/15 focus-within:border-rvp-accent focus-within:ring-2 focus-within:ring-rvp-accent/25", motion)}>
      <Search className="h-[18px] w-[18px] shrink-0 text-rvp-muted" aria-hidden />
      <input ref={inputRef} type="search" value={value} maxLength={60} onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape" && !value) e.currentTarget.blur(); }}
        placeholder="Rechercher un clip, un artiste…" aria-label="Rechercher un clip, un artiste ou un genre"
        enterKeyHint="search" autoComplete="off" spellCheck={false}
        className="min-w-0 flex-1 bg-transparent text-[15px] text-rvp-text placeholder:text-rvp-muted focus:outline-none focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden" />
      {value ? (
        <button type="button" onClick={() => onChange("")} aria-label="Effacer la recherche"
          className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full text-rvp-muted hover:bg-white/10 hover:text-rvp-text", motion)}>
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </form>
  );
}

// ── Téléphone ──────────────────────────────────────────────────────────────

export function ClipsMobileTopBar({ scrolled }: { scrolled: boolean }) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const { search } = useClips();
  return (
    <header className={cn("sticky top-0 z-40 md:hidden", motion, scrolled ? BAR_SCROLLED : "bg-rvp-ground/90 backdrop-blur-md")}>
      <div className="mx-auto flex h-14 w-full items-center gap-1 px-2 sm:h-16 sm:px-4">
        <Link href="/play" prefetch={false} aria-label="Retour à Rivendy Play"
          className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full text-rvp-text hover:bg-white/[0.06]", motion)}>
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
        <Link href="/play/clips" aria-label="Rivendy Clips, accueil" className="rounded-md">
          <ClipsWordmark size="sm" />
        </Link>
        <div className="ml-auto flex items-center">
          <button type="button" aria-label="Rechercher un clip ou un artiste"
            onClick={() => {
              search.requestFocus();
              if (pathname !== "/play/clips") router.push("/play/clips");
            }}
            className={cn("grid h-11 w-11 place-items-center rounded-full text-rvp-text hover:bg-white/[0.06]", motion)}>
            <Search className="h-5 w-5" aria-hidden />
          </button>
          <NotificationsLink />
          <AccountMenu compact />
        </div>
      </div>
    </header>
  );
}

export function ClipsMobileNav({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Rivendy Clips"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-rvp-edge bg-rvp-frame/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <Suspense fallback={<MobileNavList pathname={pathname} f={null} />}>
        <MobileNavWithParams pathname={pathname} />
      </Suspense>
    </nav>
  );
}

function MobileNavWithParams({ pathname }: { pathname: string }) {
  const params = useSearchParams();
  return <MobileNavList pathname={pathname} f={params.get("f")} />;
}

function MobileNavList({ pathname, f }: { pathname: string; f: string | null }) {
  const trending = useTrendingAvailable();
  const items = trending ? [HOME, TRENDING, FOLLOWING, SAVED, HISTORY] : [HOME, FOLLOWING, SAVED, HISTORY, ARTIST];
  return (
    <ul className="mx-auto grid h-16 max-w-xl grid-cols-5">
      {items.map((it) => {
        const active = it.active(pathname, f);
        const Icon = it.icon;
        return (
          <li key={it.href}>
            <Link href={it.href} aria-current={active ? "page" : undefined}
              className={cn("flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold", motion,
                active ? "text-rvp-accent" : "text-rvp-muted hover:text-rvp-soft")}>
              <Icon className="h-[22px] w-[22px]" aria-hidden />
              {it.short ?? it.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Mise en page commune des pages Clips (même gouttière que les pages Play). */
export function ClipsPage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("@container mx-auto w-full max-w-[1480px] px-4 pb-8 pt-3 sm:px-6 md:pt-1 xl:px-8", className)}>{children}</div>;
}
