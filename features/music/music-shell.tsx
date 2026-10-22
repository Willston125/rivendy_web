"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AudioLines, Clapperboard, Clock, Compass, Heart, House, Library, ListMusic, MicVocal, Plus, Search, Smartphone, Trophy,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry } from "@/features/country/country-provider";
import { PLAY_STORE_URL } from "@/features/play/play-link-page";
import { cn } from "@/lib/utils/cn";
import { marketHomePath } from "@/lib/seo";
import { useMusicLibrary } from "./music-library";
import { loginHref } from "./music-pending";

/**
 * Coque de l'espace Musique du site (refonte du 2026-10-22, maquette
 * « Rivendy Musique Studio ») : navigation latérale propre à la Musique sur
 * grand écran, onglets défilants sur téléphone. L'en-tête global du site
 * (logo, univers, notifications, compte, pays) reste au-dessus : rien n'est
 * doublé ici, sauf la recherche MUSICALE (titres, artistes), qui n'est pas
 * celle des produits.
 */

type NavItem = { href: string; label: string; short?: string; icon: LucideIcon; match: (p: string) => boolean; count?: number | null };

const discover: NavItem[] = [
  { href: "/music", label: "Découvrir", icon: House, match: (p) => p === "/music" || p.startsWith("/music/album") },
  { href: "/music/explore", label: "Explorer", icon: Compass, match: (p) => p.startsWith("/music/explore") || p.startsWith("/music/search") },
  { href: "/music/artists", label: "Artistes", icon: MicVocal, match: (p) => p.startsWith("/music/artists") || p.startsWith("/artist/") },
  { href: "/music/hit", label: "Rivendy Hit", short: "Hit", icon: Trophy, match: (p) => p.startsWith("/music/hit") },
  // Les clips vivent dans Rivendy Play : on garde leur accès tel quel.
  { href: "/play/clips", label: "Clips", icon: Clapperboard, match: () => false },
];

export function MusicShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/music";
  const { user } = useAuth();
  const library = useMusicLibrary();
  const rootRef = useRef<HTMLDivElement>(null);

  // Hauteur réelle de l'en-tête global (une ou deux lignes selon l'écran) :
  // la barre latérale se colle juste dessous. L'en-tête peut n'apparaître
  // qu'après coup (il est sous Suspense) : on le cherche encore un moment.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let watched: Element | null = null;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => set()) : null;
    function set() {
      const header = document.querySelector("header");
      if (header && header !== watched && ro) {
        if (watched) ro.unobserve(watched);
        ro.observe(header);
        watched = header;
      }
      // Une mesure à 0 (onglet en arrière-plan) garde la valeur par défaut.
      const h = Math.round(header?.getBoundingClientRect().height ?? 0);
      if (h > 0) root?.style.setProperty("--rvm-top", `${h}px`);
    }
    set();
    const timers = [150, 600, 2000].map((ms) => window.setTimeout(set, ms));
    window.addEventListener("resize", set);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("resize", set);
      ro?.disconnect();
    };
  }, []);

  const mine: NavItem[] = [
    { href: "/music/favorites", label: "Mes favoris", short: "Favoris", icon: Heart, match: (p) => p.startsWith("/music/favorites"), count: library.likeCount },
    { href: "/music/history", label: "Écoutés récemment", short: "Récents", icon: Clock, match: (p) => p.startsWith("/music/history") },
    { href: "/music/library", label: "Ma bibliothèque", short: "Bibliothèque", icon: Library, match: (p) => p.startsWith("/music/library") },
  ];

  return (
    <div ref={rootRef} className="rvm-scope min-h-[calc(100dvh-var(--rvm-top,64px))] bg-rvm-ground text-rvm-text [--rvm-top:64px]">
      <div className="mx-auto flex max-w-[1680px]">
        {/* Hauteur utile = écran − en-tête global − lecteur fixe (--rvm-player-h,
            publié par le lecteur) : le bloc artiste du bas reste visible. */}
        <aside aria-label="Navigation Musique"
          className="sticky top-[var(--rvm-top)] hidden h-[calc(100dvh-var(--rvm-top)-var(--rvm-player-h,0px))] w-64 shrink-0 flex-col border-r border-rvm-line bg-rvm-panel lg:flex">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-5 pt-6">
            <Link href="/music" className="mb-6 flex items-center gap-3 rounded-xl px-3 py-1">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rvm-accent/15 text-rvm-accent">
                <AudioLines className="h-5 w-5" aria-hidden />
              </span>
              <span>
                <span className="block text-base font-black tracking-tight">Rivendy Musique</span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-rvm-muted">Le son vous appartient</span>
              </span>
            </Link>

            <NavGroup title="Découvrir" items={discover} pathname={pathname} />
            <NavGroup title="Ma bibliothèque" items={mine} pathname={pathname} />

            <div className="mt-6">
              <div className="flex items-center justify-between px-3">
                <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-rvm-muted">Mes playlists</h2>
                <button type="button" onClick={() => void library.newPlaylist()} aria-label="Créer une playlist"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-rvm-accent hover:bg-rvm-accent/15">
                  <Plus className="h-4 w-4" aria-hidden />
                </button>
              </div>
              {!user ? (
                <p className="px-3 pt-2 text-xs text-rvm-muted">
                  <Link href={loginHref(pathname)} className="font-semibold text-rvm-accent hover:underline">Connectez-vous</Link> pour retrouver les playlists de votre compte.
                </p>
              ) : library.playlists === null ? (
                <p className="px-3 pt-2 text-xs text-rvm-muted">Chargement…</p>
              ) : library.playlists.length === 0 ? (
                <p className="px-3 pt-2 text-xs text-rvm-muted">Aucune playlist pour l’instant.</p>
              ) : (
                <ul className="mt-1 space-y-0.5">
                  {library.playlists.map((p) => {
                    const active = pathname === `/music/playlist/${p.id}`;
                    return (
                      <li key={p.id}>
                        <Link href={`/music/playlist/${p.id}`} aria-current={active ? "page" : undefined}
                          className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            active ? "bg-rvm-accent/15 font-semibold text-rvm-accent" : "text-rvm-soft hover:bg-white/5 hover:text-rvm-text")}>
                          <ListMusic className="h-4 w-4 shrink-0" aria-hidden />
                          <span className="truncate">{p.name}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="mt-auto pt-6">
              <div className="rounded-2xl border border-rvm-line bg-gradient-to-br from-rvm-brand/20 to-rvm-surface p-4">
                <p className="text-sm font-bold">Vous êtes artiste ?</p>
                <p className="mt-1 text-xs leading-relaxed text-rvm-soft">
                  Créez votre profil d’artiste dans l’application Rivendy (onglet Musique, « Vous êtes artiste ? »). Chaque sortie est validée par Rivendy.
                </p>
                <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-rvm-accent hover:underline">
                  <Smartphone className="h-3.5 w-3.5" aria-hidden /> Obtenir l’application
                </a>
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <MobileTabs items={[...discover, ...mine]} pathname={pathname} />
          <div className="px-4 pb-10 pt-5 sm:px-6 lg:px-10 lg:pt-7">
            {pathname.startsWith("/music/explore") || pathname.startsWith("/music/search") ? null : <TopSearch />}
            {children}
          </div>
          <MusicFooter />
        </div>
      </div>
    </div>
  );
}

function NavGroup({ title, items, pathname }: { title: string; items: NavItem[]; pathname: string }) {
  return (
    <nav aria-label={title} className="mt-2 first-of-type:mt-0">
      <h2 className="px-3 pb-1 pt-3 text-xs font-bold uppercase tracking-[0.14em] text-rvm-muted">{title}</h2>
      <ul className="space-y-0.5">
        {items.map((it) => {
          const active = it.match(pathname);
          return (
            <li key={it.href}>
              <Link href={it.href} aria-current={active ? "page" : undefined}
                className={cn("relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors",
                  active ? "bg-rvm-accent/15 text-rvm-accent" : "text-rvm-soft hover:bg-white/5 hover:text-rvm-text")}>
                {active ? <span aria-hidden className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-rvm-accent" /> : null}
                <it.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                <span className="flex-1 truncate">{it.label}</span>
                {it.count ? <span className="text-xs tabular-nums text-rvm-muted">{it.count > 999 ? "999+" : it.count}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Téléphone et tablette : onglets défilants au doigt, l'onglet actif visible. */
function MobileTabs({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const ref = useRef<HTMLUListElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[aria-current=page]")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);
  return (
    <nav aria-label="Navigation Musique" className="border-b border-rvm-line bg-rvm-panel lg:hidden">
      <ul ref={ref} className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-2.5">
        {items.map((it) => {
          const active = it.match(pathname);
          return (
            <li key={it.href} className="shrink-0">
              <Link href={it.href} aria-current={active ? "page" : undefined}
                className={cn("inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors",
                  active ? "bg-rvm-accent text-rvm-on-accent" : "bg-rvm-raised text-rvm-soft hover:text-rvm-text")}>
                <it.icon className="h-4 w-4" aria-hidden />
                {it.short ?? it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Recherche musicale (grand écran) : ouvre « Explorer » avec la requête. */
function TopSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form role="search" aria-label="Rechercher de la musique"
      onSubmit={(e) => { e.preventDefault(); const v = q.trim(); router.push(v ? `/music/explore?q=${encodeURIComponent(v)}` : "/music/explore"); }}
      className="mb-7 hidden max-w-xl items-center gap-2 rounded-full border border-rvm-line bg-rvm-surface px-4 transition-colors focus-within:border-rvm-accent lg:flex">
      <Search className="h-4 w-4 shrink-0 text-rvm-muted" aria-hidden />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Un titre, un artiste, une envie…" aria-label="Un titre, un artiste, une envie"
        className="h-11 min-w-0 flex-1 bg-transparent text-sm text-rvm-text placeholder:text-rvm-muted focus:outline-none focus-visible:outline-none" />
    </form>
  );
}

/**
 * Fin de page de l'espace Musique (finitions du 2026-10-22) : compacte et
 * sombre, à la place du grand pied de page clair de la marketplace, avec les
 * liens utiles du site (marketplace, Play, aide, droits d'auteur, conditions).
 */
function MusicFooter() {
  const { country } = useCountry();
  const year = new Date().getFullYear();
  const links = [
    { href: country?.id ? marketHomePath(country.id) : "/", label: "La marketplace" },
    { href: "/play", label: "Rivendy Play" },
    { href: "/help", label: "Aide" },
    { href: "/droits-auteur", label: "Droits d’auteur" },
    { href: "/legal?tab=cgu", label: "Conditions" },
    { href: "/legal?tab=privacy", label: "Confidentialité" },
  ];
  return (
    <footer className="border-t border-rvm-line bg-rvm-panel">
      <div className="flex flex-col gap-3 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-10">
        <p className="text-sm text-rvm-muted">© {year} Rivendy — Rivendy Musique</p>
        <nav aria-label="Liens du site">
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {links.map((l) => (
              <li key={l.label}>
                <Link href={l.href} className="inline-block py-1.5 text-sm text-rvm-soft transition-colors hover:text-rvm-accent">{l.label}</Link>
              </li>
            ))}
            <li>
              <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 py-1.5 text-sm font-semibold text-rvm-accent hover:underline">
                <Smartphone className="h-4 w-4" aria-hidden /> Application Android
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
