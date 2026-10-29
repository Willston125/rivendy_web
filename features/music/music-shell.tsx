"use client";

import { Suspense, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AudioLines, Bell, Compass, House, Library, Search, Smartphone, Store, UserRound } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry } from "@/features/country/country-provider";
import { useNotifications } from "@/features/notifications/use-notifications";
import { PLAY_STORE_URL } from "@/features/play/play-link-page";
import { cn } from "@/lib/utils/cn";
import { marketHomePath } from "@/lib/seo";
import { LibraryPanel } from "./music-library-panel";
import { useSearchDraft } from "./music-ui";
import {
  LIB_COLLAPSED, LIB_MAX, LIB_MIN, MusicLayoutProvider, RIGHT_MAX, RIGHT_MIN, useMusicLayout,
} from "./music-layout";
import { ARTIST_SPACE_PATH, MusicNav } from "./music-nav";
import { NowPlayingPanel } from "./music-now-playing";
import { MobileMiniPlayer, MusicPlayerBar } from "./player/mini-player";
import { useMusicPlayer } from "./player/music-player-provider";

/**
 * Coque de l'espace Musique — mise en page « application » du 2026-10-22
 * (vidéo de référence) : la fenêtre entière, une barre du haut, « Ma
 * bibliothèque » à gauche, le panneau central (toutes les pages /music et
 * /artist), « En cours de lecture » à droite, le lecteur permanent en bas.
 * Chaque panneau défile seul ; la page, elle, ne défile pas. Sur écran
 * intermédiaire, le panneau droit devient un tiroir ; sur téléphone, la
 * bibliothèque passe dans la navigation du bas et le mini-lecteur se pose
 * au-dessus. L'en-tête et le pied de page de la marketplace sont masqués
 * ici (HideInMusic) : leurs liens utiles restent en bas du panneau central.
 */
export function MusicShell({ fontClassName, children }: { fontClassName?: string; children: ReactNode }) {
  const player = useMusicPlayer();
  return (
    <MusicLayoutProvider hasCurrent={!!player.current}>
      <ShellFrame fontClassName={fontClassName}>{children}</ShellFrame>
    </MusicLayoutProvider>
  );
}

function ShellFrame({ fontClassName, children }: { fontClassName?: string; children: ReactNode }) {
  const layout = useMusicLayout();
  const player = useMusicPlayer();
  const { user } = useAuth();
  const pathname = usePathname() || "/music";
  const center = useRef<HTMLDivElement>(null);
  // Visiteur (ou session pas encore lue) : la bibliothèque n'est qu'un rail,
  // l'espace va au contenu (lot « Musique web », 2026-10-23).
  const rail = !user;
  const expanded = layout.libMode === "expanded" && !rail;

  // La page ne défile pas : seuls les panneaux défilent (fond de la Musique au rebond).
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.world = "music";
    const overflow = html.style.overflow;
    html.style.overflow = "hidden";
    return () => { delete html.dataset.world; html.style.overflow = overflow; };
  }, []);

  // Chaque page s'ouvre en haut du panneau central (la fenêtre, elle, ne bouge pas).
  useEffect(() => { center.current?.scrollTo({ top: 0 }); }, [pathname]);

  const docked = layout.wide && layout.rightOpen && !!player.current;
  return (
    <div className={cn("rvm-scope flex h-dvh flex-col overflow-hidden bg-rvm-ground font-rvm-body text-rvm-text", fontClassName)}>
      <MusicTopBar />
      <div className="relative flex min-h-0 flex-1 md:gap-2 md:px-2">
        {/* Navigation (lot 2, 2026-10-29) au-dessus de la bibliothèque : deux panneaux, une seule colonne. */}
        <aside aria-label="Navigation et bibliothèque"
          style={{ width: rail ? LIB_COLLAPSED : expanded ? undefined : layout.shownLib }}
          className={cn("relative hidden min-h-0 shrink-0 flex-col gap-2 md:flex", expanded && "md:flex-1")}>
          <MusicNav compact={rail || layout.libMode === "collapsed"} />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-rvm-surface">
            <LibraryPanel />
          </div>
          {layout.libMode === "list" && !rail ? (
            <ResizeHandle label="Redimensionner la bibliothèque" side="right" value={layout.libWidth} min={LIB_MIN} max={LIB_MAX}
              onChange={layout.setLibWidth} />
          ) : null}
        </aside>

        <div ref={center} id="rvm-center"
          className={cn("@container relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-rvm-surface md:rounded-lg", expanded && "md:hidden")}>
          {children}
          <MusicFooter />
        </div>

        {docked ? (
          <div style={{ width: layout.shownRight }} className="relative hidden min-h-0 shrink-0 xl:flex">
            <ResizeHandle label="Redimensionner le panneau En cours de lecture" side="left" value={layout.rightWidth} min={RIGHT_MIN} max={RIGHT_MAX}
              onChange={layout.setRightWidth} />
            <NowPlayingPanel className="w-full" />
          </div>
        ) : null}
        {!layout.wide && layout.drawerOpen && player.current ? <RightDrawer /> : null}
      </div>
      <MusicPlayerBar />
      <MobileMiniPlayer />
      <MobileNav />
    </div>
  );
}

/** Écran intermédiaire : « En cours de lecture » en tiroir par-dessus le panneau central. */
function RightDrawer() {
  const layout = useMusicLayout();
  const { closeRight } = layout;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRight(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeRight]);
  return (
    <>
      <div aria-hidden className="absolute inset-0 z-30 bg-black/40 md:rounded-lg" onClick={closeRight} />
      <div className="absolute bottom-0 right-0 top-0 z-40 flex w-[min(360px,calc(100%-16px))] md:right-2">
        <NowPlayingPanel className="w-full shadow-2xl shadow-black/60 ring-1 ring-rvm-line" />
      </div>
    </>
  );
}

/**
 * Poignée entre deux panneaux : glisser, ou flèches du clavier (16 px),
 * Origine et Fin pour les bornes. Le panneau central garde sa largeur
 * minimale quoi qu'il arrive (fitPanels).
 */
function ResizeHandle({ label, side, value, min, max, onChange }: {
  label: string; side: "left" | "right"; value: number; min: number; max: number; onChange: (w: number) => void;
}) {
  const start = useRef<{ x: number; w: number } | null>(null);
  const [active, setActive] = useState(false);
  const dir = side === "right" ? 1 : -1;
  function down(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, w: value };
    setActive(true);
  }
  function move(e: ReactPointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    onChange(start.current.w + dir * (e.clientX - start.current.x));
  }
  function up() { start.current = null; setActive(false); }
  function key(e: ReactKeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 48 : 16;
    if (e.key === "ArrowRight") { e.preventDefault(); onChange(value + dir * step); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); onChange(value - dir * step); }
    else if (e.key === "Home") { e.preventDefault(); onChange(min); }
    else if (e.key === "End") { e.preventDefault(); onChange(max); }
  }
  return (
    <div role="separator" aria-orientation="vertical" aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
      tabIndex={0} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}
      className={cn("group absolute inset-y-0 z-20 hidden w-3 cursor-col-resize touch-none md:block",
        side === "right" ? "-right-[10px]" : "-left-[10px]")}>
      <span aria-hidden className={cn("absolute inset-y-2 left-1/2 w-0.5 -translate-x-1/2 rounded-full transition-colors",
        active ? "bg-rvm-accent" : "bg-transparent group-hover:bg-white/30 group-focus-visible:bg-rvm-accent")} />
    </div>
  );
}

function Wordmark({ className }: { className?: string }) {
  // Logo officiel, formes et vert d'origine (refonte de l'accueil, 2026-10-28) :
  // 4:1 sur le fond nuit, au-dessus des 3:1 demandés pour un logo.
  return <Image src="/brand/rivendy-wordmark.png" alt="" width={1214} height={428} priority className={cn("w-auto", className)} />;
}

/** Barre du haut : logo, accueil, recherche musicale, application, notifications, compte. */
function MusicTopBar() {
  const pathname = usePathname() || "/music";
  const { user, profile, loading } = useAuth();
  const { country } = useCountry();
  const { unreadCount } = useNotifications();
  const homeHref = country?.id ? marketHomePath(country.id) : "/";
  const initial = (profile?.full_name || profile?.store_name || "R").trim().slice(0, 1).toUpperCase();

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 px-3 md:px-4">
      <div className="flex shrink-0 items-center gap-3">
        {/* Liens secondaires sans téléchargement anticipé : la connexion est souvent lente et payante. */}
        <Link href={homeHref} prefetch={false} aria-label="Rivendy, retour à la marketplace" className="rounded-md">
          <Wordmark className="h-7" />
        </Link>
        <span aria-hidden className="h-5 w-px bg-white/15 sm:h-6" />
        <Link href="/music" aria-label="Rivendy Musique, accueil"
          className="flex items-center gap-1.5 rounded-md text-[11px] font-extrabold uppercase tracking-[0.2em] text-rvm-accent sm:text-[13px] sm:tracking-[0.24em]">
          Musique <AudioLines className="hidden h-3.5 w-3.5 sm:block" aria-hidden />
        </Link>
      </div>

      {/* L'accueil est « Découvrir » dans la navigation de gauche (lot 2) : plus de bouton maison ici. */}
      <div className="mx-auto hidden w-full max-w-[560px] items-center gap-2 md:flex">
        <Suspense fallback={<SearchBoxShell />}>
          <SearchBox />
        </Suspense>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">
        <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer"
          className="hidden h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold text-rvm-soft transition-colors hover:text-rvm-text xl:flex">
          <Smartphone className="h-4 w-4" aria-hidden /> Installer l’appli
        </a>
        <Link href="/music/explore" aria-label="Rechercher de la musique" className="grid h-11 w-11 place-items-center rounded-full text-rvm-text hover:bg-white/10 md:hidden">
          <Search className="h-5 w-5" aria-hidden />
        </Link>
        {user ? (
          <Link href="/notifications" prefetch={false} aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} non lues` : "Notifications"}
            className="relative grid h-11 w-11 place-items-center rounded-full text-rvm-soft transition-colors hover:bg-white/10 hover:text-rvm-text">
            <Bell className="h-5 w-5" aria-hidden />
            {unreadCount > 0 ? (
              <span aria-hidden className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-rvm-accent px-1 text-[10px] font-black text-rvm-on-accent">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </Link>
        ) : null}
        {user ? (
          <Link href="/profile" prefetch={false} aria-label="Mon profil" title="Mon profil"
            className="relative ml-1 grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-rvm-raised text-sm font-bold text-rvm-text ring-4 ring-rvm-surface transition hover:scale-105 motion-reduce:hover:scale-100">
            {profile?.avatar_url ? <Image src={profile.avatar_url} alt="" fill sizes="40px" className="object-cover" /> : <span aria-hidden>{initial}</span>}
          </Link>
        ) : loading ? (
          <span aria-hidden className="ml-1 h-10 w-10 rounded-full bg-rvm-raised" />
        ) : (
          <Link href={`/auth/login?next=${encodeURIComponent(pathname)}`} prefetch={false}
            className="ml-1 flex h-10 items-center gap-2 rounded-full bg-rvm-text px-4 text-sm font-bold text-rvm-ground transition hover:scale-105 motion-reduce:hover:scale-100">
            <UserRound className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Se connecter</span><span className="sr-only sm:hidden">Se connecter</span>
          </Link>
        )}
      </div>
    </header>
  );
}

function SearchBoxShell() {
  return <div aria-hidden className="h-12 flex-1 rounded-full bg-rvm-surface" />;
}

/**
 * Recherche musicale de la barre du haut : elle pilote l'adresse
 * (/music/explore?q=…) ; le panneau central affiche les résultats.
 */
function SearchBox() {
  const router = useRouter();
  const pathname = usePathname() || "/music";
  const params = useSearchParams();
  const onExplore = pathname.startsWith("/music/explore");
  const urlQ = onExplore ? params.get("q") ?? "" : "";
  const [q, setQ] = useSearchDraft(urlQ, (v) => {
    if (!onExplore && v.length < 2) return;
    const sp = new URLSearchParams(onExplore ? window.location.search : "");
    if (v) sp.set("q", v); else sp.delete("q");
    const href = `/music/explore${sp.toString() ? `?${sp}` : ""}`;
    if (onExplore) router.replace(href, { scroll: false }); else router.push(href);
  });

  return (
    <form role="search" aria-label="Rechercher de la musique"
      onSubmit={(e) => { e.preventDefault(); const v = q.trim(); router.push(v ? `/music/explore?q=${encodeURIComponent(v)}` : "/music/explore"); }}
      className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full bg-rvm-surface pl-3 pr-1.5 ring-rvm-text transition hover:bg-rvm-raised focus-within:ring-2">
      <Search className="h-5 w-5 shrink-0 text-rvm-soft" aria-hidden />
      <input value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Que souhaitez-vous écouter ?" aria-label="Que souhaitez-vous écouter ?" enterKeyHint="search"
        className="min-w-0 flex-1 bg-transparent text-[15px] text-rvm-text placeholder:text-rvm-soft focus:outline-none focus-visible:outline-none" />
      <span aria-hidden className="h-6 w-px bg-white/15" />
      <Link href="/music/explore" aria-label="Parcourir les genres" title="Parcourir"
        className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full hover:text-rvm-text", onExplore && !urlQ ? "text-rvm-text" : "text-rvm-soft")}>
        <Compass className="h-5 w-5" aria-hidden />
      </Link>
    </form>
  );
}

/** Téléphone : Accueil, Rechercher, Bibliothèque, retour à la marketplace. */
function MobileNav() {
  const pathname = usePathname() || "/music";
  const { country } = useCountry();
  const homeHref = country?.id ? marketHomePath(country.id) : "/";
  const items = [
    { href: "/music", label: "Accueil", icon: House, active: pathname === "/music" },
    { href: "/music/explore", label: "Rechercher", icon: Search, active: pathname.startsWith("/music/explore") },
    { href: "/music/library", label: "Bibliothèque", icon: Library,
      active: ["/music/library", "/music/playlist", "/music/favorites", "/music/history", ARTIST_SPACE_PATH].some((p) => pathname.startsWith(p)) },
    { href: homeHref, label: "Marketplace", icon: Store, active: false },
  ];
  return (
    <nav aria-label="Navigation Musique" className="shrink-0 border-t border-white/5 bg-rvm-ground pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="grid h-14 grid-cols-4">
        {items.map((it) => (
          <li key={it.label}>
            <Link href={it.href} prefetch={it.label === "Marketplace" ? false : undefined} aria-current={it.active ? "page" : undefined}
              className={cn("flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", it.active ? "text-rvm-text" : "text-rvm-soft")}>
              <it.icon className={cn("h-6 w-6", it.active && "text-rvm-accent")} aria-hidden />
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Fin du panneau central : les liens utiles du site, en compact (le pied
 * de page de la marketplace reste celui des autres espaces Rivendy).
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
    <footer className="mx-4 mt-6 border-t border-white/10 py-6 @2xl:mx-6">
      <nav aria-label="Liens du site">
        <ul className="flex flex-wrap gap-x-5 gap-y-1">
          {links.map((l) => (
            <li key={l.label}>
              <Link href={l.href} prefetch={false} className="inline-block py-1 text-[13px] text-rvm-soft transition-colors hover:text-rvm-text hover:underline">{l.label}</Link>
            </li>
          ))}
          <li>
            <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 py-1 text-[13px] font-semibold text-rvm-accent hover:underline">
              <Smartphone className="h-3.5 w-3.5" aria-hidden /> Application Android
            </a>
          </li>
        </ul>
      </nav>
      <p className="mt-3 text-[13px] text-rvm-muted">© {year} Rivendy — Rivendy Musique</p>
    </footer>
  );
}
