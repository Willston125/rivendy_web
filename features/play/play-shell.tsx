"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Download, Play, Search, UserRound } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry } from "@/features/country/country-provider";
import { useNotifications } from "@/features/notifications/use-notifications";
import { marketHomePath } from "@/lib/seo";
import { cn } from "@/lib/utils/cn";
import { PLAY_STORE_URL } from "./play-link-page";
import { PlayListProvider } from "./play-list";

/**
 * Coque de Rivendy Play sur le site (refonte « salle de cinéma » du
 * 2026-10-22) : en-tête sombre propre à Play — l'en-tête blanc de la
 * marketplace est masqué sur /play (HideInPlay) —, onglets défilants sur
 * téléphone, pied de page Play. Le logo ramène à la marketplace, « PLAY » à
 * l'accueil de Play. Aucun prix ni lien d'achat dans la coque : les pages
 * /play/short/… sont ouvertes depuis l'app Android (règle Google Play).
 */

type NavItem = { href: string; label: string; match: (p: string) => boolean };

const NAV: NavItem[] = [
  { href: "/play", label: "Accueil", match: (p) => p === "/play" },
  { href: "/play/movies", label: "Films", match: (p) => p.startsWith("/play/movie") },
  { href: "/play/series", label: "Séries", match: (p) => p.startsWith("/play/series") || p.startsWith("/play/episode") },
  { href: "/play/clips", label: "Clips", match: (p) => p.startsWith("/play/clip") },
  { href: "/play/my-list", label: "Ma liste", match: (p) => p.startsWith("/play/my-list") || p.startsWith("/play/history") },
];

export function PlayShell({ children }: { children: ReactNode }) {
  // Fond de toute la page (rebond du défilement, bas des pages courtes).
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.world = "play";
    return () => { delete html.dataset.world; };
  }, []);

  return (
    <PlayListProvider>
      <div className="rvp-scope flex min-h-screen flex-col bg-rvp-ground text-rvp-text">
        <PlayHeader />
        <div className="flex-1">{children}</div>
        <PlayFooter />
      </div>
    </PlayListProvider>
  );
}

function Wordmark({ className }: { className?: string }) {
  // Logo officiel, proportions d'origine, passé en blanc sur le fond sombre (comme l'app).
  return <Image src="/brand/rivendy-wordmark.png" alt="" width={1214} height={428} priority className={cn("w-auto brightness-0 invert", className)} />;
}

function PlayHeader() {
  const pathname = usePathname() || "/play";
  const { user, profile, loading } = useAuth();
  const { country } = useCountry();
  const { unreadCount } = useNotifications();
  const homeHref = country?.id ? marketHomePath(country.id) : "/";
  const loginHref = `/auth/login?next=${encodeURIComponent(pathname)}`;
  const initial = (profile?.full_name || profile?.store_name || "R").trim().slice(0, 1).toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-rvp-ground/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:h-[72px] lg:gap-6 lg:px-10">
        <div className="flex shrink-0 items-center gap-3">
          <Link href={homeHref} aria-label="Rivendy, retour à la marketplace" className="rounded-md">
            <Wordmark className="h-7 lg:h-8" />
          </Link>
          <span aria-hidden className="h-6 w-px bg-white/15" />
          <Link href="/play" aria-label="Rivendy Play, accueil"
            className="flex items-center gap-1.5 rounded-md text-[13px] font-extrabold uppercase tracking-[0.28em] text-rvp-accent">
            Play <Play className="h-3 w-3 fill-current" aria-hidden />
          </Link>
        </div>

        <nav aria-label="Rivendy Play" className="ml-6 hidden h-full items-stretch gap-1 lg:flex">
          {NAV.map((it) => {
            const active = it.match(pathname);
            return (
              <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined}
                className={cn("relative flex items-center px-3 text-[15px] transition-colors",
                  active ? "font-semibold text-rvp-text" : "font-medium text-rvp-soft hover:text-rvp-text")}>
                {it.label}
                {active ? <span aria-hidden className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-rvp-accent" /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <Link href="/play/search" aria-label="Rechercher dans Rivendy Play"
            aria-current={pathname.startsWith("/play/search") ? "page" : undefined}
            className={cn("flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-white/10",
              pathname.startsWith("/play/search") ? "text-rvp-accent" : "text-rvp-text")}>
            <Search className="h-5 w-5" aria-hidden />
          </Link>
          {user ? (
            <Link href="/notifications" aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} non lues` : "Notifications"}
              className="relative flex h-11 w-11 items-center justify-center rounded-full text-rvp-text transition-colors hover:bg-white/10">
              <Bell className="h-5 w-5" aria-hidden />
              {unreadCount > 0 ? (
                <span aria-hidden className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-rvp-accent px-1 text-[10px] font-black text-rvp-on-accent">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Link>
          ) : null}
          <span aria-hidden className="mx-1 hidden h-7 w-px bg-white/15 sm:block" />
          {user ? (
            <Link href="/profile" aria-label="Mon profil"
              className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-rvp-raised text-sm font-bold text-rvp-text ring-2 ring-white/15 transition hover:ring-rvp-accent">
              {profile?.avatar_url ? (
                <Image src={profile.avatar_url} alt="" fill sizes="40px" className="object-cover" />
              ) : (
                <span aria-hidden>{initial}</span>
              )}
            </Link>
          ) : loading ? (
            <span aria-hidden className="h-10 w-10 rounded-full bg-rvp-raised" />
          ) : (
            <Link href={loginHref}
              className="flex h-10 items-center gap-2 rounded-full border border-white/20 px-3 text-sm font-semibold text-rvp-text transition-colors hover:border-rvp-accent hover:text-rvp-accent sm:px-4">
              <UserRound className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Se connecter</span>
              <span className="sr-only sm:hidden">Se connecter</span>
            </Link>
          )}
        </div>
      </div>
      <MobileTabs pathname={pathname} />
    </header>
  );
}

/** Téléphone et tablette : les cinq rubriques défilent au doigt, l'active reste visible. */
function MobileTabs({ pathname }: { pathname: string }) {
  const ref = useRef<HTMLUListElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[aria-current=page]")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);
  return (
    <nav aria-label="Rivendy Play" className="lg:hidden">
      <ul ref={ref} className="no-scrollbar flex gap-1 overflow-x-auto px-2 sm:px-4">
        {NAV.map((it) => {
          const active = it.match(pathname);
          return (
            <li key={it.href} className="shrink-0">
              <Link href={it.href} aria-current={active ? "page" : undefined}
                className={cn("relative flex h-11 items-center px-3 text-[15px] transition-colors",
                  active ? "font-semibold text-rvp-text" : "font-medium text-rvp-soft")}>
                {it.label}
                {active ? <span aria-hidden className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-rvp-accent" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function FooterColumn({ title, links }: { title: string; links: Array<{ href: string; label: string }> }) {
  return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-rvp-muted">{title}</h2>
      <ul className="mt-3 space-y-1">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link href={l.href} className="block w-fit py-1.5 text-sm text-rvp-soft transition-colors hover:text-rvp-accent">{l.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlayFooter() {
  const { user } = useAuth();
  const { country } = useCountry();
  const year = new Date().getFullYear();
  const homeHref = country?.id ? marketHomePath(country.id) : "/";
  return (
    // Bas réservé sur téléphone : le bandeau de l'application s'y pose.
    <footer className="mt-8 border-t border-white/5 bg-rvp-panel pb-24 md:pb-0">
      <div className="mx-auto grid w-full max-w-[1600px] grid-cols-2 gap-x-6 gap-y-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.5fr_repeat(3,1fr)] lg:px-10">
        <div className="col-span-2 lg:col-span-1">
          <div className="flex items-center gap-3">
            <Wordmark className="h-7" />
            <span aria-hidden className="h-6 w-px bg-white/15" />
            <span className="flex items-center gap-1.5 text-[13px] font-extrabold uppercase tracking-[0.28em] text-rvp-accent">
              Play <Play className="h-3 w-3 fill-current" aria-hidden />
            </span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-6 text-rvp-muted">
            Films, séries et clips d’artistes, sur le site et dans l’application Rivendy, avec le même compte : la lecture reprend où vous l’avez laissée.
          </p>
          <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer"
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg border border-white/15 px-4 text-sm font-semibold text-rvp-text transition-colors hover:border-rvp-accent hover:text-rvp-accent">
            <Download className="h-4 w-4" aria-hidden /> Application Android
          </a>
        </div>
        <FooterColumn title="Rivendy Play" links={[
          { href: "/play", label: "Accueil" },
          { href: "/play/movies", label: "Films" },
          { href: "/play/series", label: "Séries" },
          { href: "/play/clips", label: "Clips" },
          { href: "/play/search", label: "Recherche" },
        ]} />
        <FooterColumn title="Mon espace" links={[
          { href: "/play/my-list", label: "Ma liste" },
          { href: "/play/history", label: "Historique" },
          user ? { href: "/profile", label: "Mon profil" } : { href: "/auth/login?next=%2Fplay", label: "Se connecter" },
        ]} />
        <FooterColumn title="Rivendy" links={[
          { href: homeHref, label: "La marketplace" },
          { href: "/music", label: "Rivendy Musique" },
          { href: "/help", label: "Aide" },
          { href: "/droits-auteur", label: "Droits d’auteur" },
        ]} />
      </div>
      <div className="border-t border-white/5">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-rvp-muted sm:flex-row sm:px-6 lg:px-10">
          <p>© {year} Rivendy — Rivendy Play</p>
          <div className="flex items-center gap-4">
            <Link href="/legal?tab=cgu" className="py-1 transition-colors hover:text-rvp-text">Conditions</Link>
            <Link href="/legal?tab=privacy" className="py-1 transition-colors hover:text-rvp-text">Confidentialité</Link>
            <Link href="/help" className="py-1 transition-colors hover:text-rvp-text">Aide</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
