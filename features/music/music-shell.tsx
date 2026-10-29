"use client";

import { Suspense, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bell, ChartColumn, ChevronDown, Download, House, Library, LogOut, Music, Search, Smartphone, Sparkles, UserRound,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry } from "@/features/country/country-provider";
import { useNotifications } from "@/features/notifications/use-notifications";
import { PLAY_STORE_URL } from "@/features/play/play-link-page";
import { cn } from "@/lib/utils/cn";
import { marketHomePath } from "@/lib/seo";
import { useSearchDraft } from "./music-ui";
import { MusicLayoutProvider, RIGHT_MAX, RIGHT_MIN, useMusicLayout } from "./music-layout";
import { AppSwitcher, ARTIST_SPACE_PATH, ArtistSpaceCard, LibraryLinks, MusicNav } from "./music-nav";
import { NowPlayingPanel } from "./music-now-playing";
import { MobileMiniPlayer, MusicPlayerBar } from "./player/mini-player";
import { useMusicPlayer } from "./player/music-player-provider";

/**
 * Coque de l'espace Musique — mise en page « application » du 2026-10-22
 * (vidéo de référence), réglages du 2026-10-29 : la fenêtre entière, une
 * barre du haut, la colonne vert lagon à gauche, le panneau central (toutes
 * les pages /music et /artist), « En cours de lecture » à droite sur très
 * grand écran, le lecteur permanent en bas. Chaque panneau défile seul ; la
 * page, elle, ne défile pas. En dessous de 1600 px, le panneau droit est un
 * tiroir posé sur le panneau central (qui garde sa largeur) ; sur téléphone,
 * la bibliothèque passe dans la navigation du bas et le mini-lecteur se pose
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
  const pathname = usePathname() || "/music";
  const center = useRef<HTMLDivElement>(null);

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
      <div className="relative flex min-h-0 flex-1">
        {/* Colonne vert lagon, comme la maquette du propriétaire (réglages du 2026-10-29) :
            navigation, « Ma bibliothèque » en trois entrées, espace artiste, espaces Rivendy.
            Fenêtre trop basse : la colonne entière défile, jamais une liste écrasée. */}
        <aside aria-label="Navigation et bibliothèque" style={{ width: layout.shownLib }}
          className="rvm-deep @container relative hidden min-h-0 shrink-0 flex-col overflow-y-auto overscroll-contain [scrollbar-width:thin] md:flex">
          <MusicNav />
          <span aria-hidden className="mx-5 my-3 block h-px shrink-0 bg-rvm-line [@media(max-height:760px)]:my-2" />
          <LibraryLinks />
          <ArtistSpaceCard className="mx-3 mt-3 shrink-0" />
          <AppSwitcher />
        </aside>

        <div ref={center} id="rvm-center" className="@container relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-rvm-ground">
          {children}
          <MusicFooter />
        </div>

        {docked ? (
          <div style={{ width: layout.shownRight }} className="relative hidden min-h-0 shrink-0 border-l border-rvm-line min-[1600px]:flex">
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

/**
 * Sous 1600 px : « En cours de lecture » en tiroir, posé sur le panneau
 * central seulement (la colonne de gauche reste utilisable) ; l'accueil
 * garde sa largeur, rien ne se tasse. Échap ou un clic à côté le referme.
 */
function RightDrawer() {
  const layout = useMusicLayout();
  const { closeRight } = layout;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRight(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeRight]);
  return (
    <div className="absolute inset-y-0 right-0 z-30" style={{ left: layout.tablet ? layout.shownLib : 0 }}>
      <div aria-hidden className="absolute inset-0 bg-rvm-deep/30" onClick={closeRight} />
      <div className="absolute inset-y-2 right-2 flex w-[min(360px,calc(100%-16px))]">
        <NowPlayingPanel className="w-full rounded-2xl shadow-2xl shadow-rvm-deep/40 ring-1 ring-rvm-line" />
      </div>
    </div>
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
      className={cn("group absolute inset-y-0 z-20 hidden w-3 cursor-col-resize touch-none lg:block",
        side === "right" ? "-right-[10px]" : "-left-[10px]")}>
      <span aria-hidden className={cn("absolute inset-y-2 left-1/2 w-0.5 -translate-x-1/2 rounded-full transition-colors",
        active ? "bg-rvm-accent" : "bg-transparent group-hover:bg-rvm-text/30 group-focus-visible:bg-rvm-accent")} />
    </div>
  );
}

function Wordmark({ className }: { className?: string }) {
  // Logo officiel, formes et vert d'origine (refonte de l'accueil, 2026-10-28),
  // posé sur la barre blanche du style « fraîcheur ».
  return <Image src="/brand/rivendy-wordmark.png" alt="" width={1214} height={428} priority className={cn("w-auto", className)} />;
}

/** Barre du haut (blanche, style « fraîcheur ») : logo, recherche musicale, application, notifications, compte. */
function MusicTopBar() {
  const pathname = usePathname() || "/music";
  const { user, profile, loading } = useAuth();
  const { country } = useCountry();
  const { unreadCount } = useNotifications();
  const homeHref = country?.id ? marketHomePath(country.id) : "/";
  const initial = (profile?.full_name || profile?.store_name || "R").trim().slice(0, 1).toUpperCase();

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-rvm-line bg-rvm-surface px-3 md:gap-4 md:px-5">
      <div className="flex shrink-0 items-center gap-3 md:w-[260px]">
        {/* Liens secondaires sans téléchargement anticipé : la connexion est souvent lente et payante. */}
        <Link href={homeHref} prefetch={false} aria-label="Rivendy, retour à la marketplace" className="rounded-md">
          <Wordmark className="h-7" />
        </Link>
        <span aria-hidden className="h-6 w-px bg-rvm-line" />
        <Link href="/music" aria-label="Rivendy Musique, accueil"
          className="flex items-center gap-2 rounded-md text-[11px] font-extrabold uppercase tracking-[0.24em] text-rvm-deep sm:text-[13px] sm:tracking-[0.3em]">
          <Music className="h-4 w-4 text-rvm-sun sm:h-5 sm:w-5" aria-hidden /> Musique
        </Link>
      </div>

      <div className="mx-auto hidden w-full max-w-[560px] items-center md:flex">
        <Suspense fallback={<SearchBoxShell />}>
          <SearchBox />
        </Suspense>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">
        <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer"
          className="hidden h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-rvm-text transition-colors hover:bg-rvm-raised xl:flex">
          <Download className="h-[18px] w-[18px]" aria-hidden /> Installer l’appli
        </a>
        <Link href="/music/explore" aria-label="Rechercher de la musique" className="grid h-11 w-11 place-items-center rounded-full text-rvm-text hover:bg-rvm-text/10 md:hidden">
          <Search className="h-5 w-5" aria-hidden />
        </Link>
        {user ? (
          <Link href="/notifications" prefetch={false} aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} non lues` : "Notifications"}
            className="relative grid h-11 w-11 place-items-center rounded-full text-rvm-text transition-colors hover:bg-rvm-raised">
            <Bell className="h-5 w-5" aria-hidden />
            {unreadCount > 0 ? (
              <span aria-hidden className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-rvm-deep px-1 text-[10px] font-black text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </Link>
        ) : null}
        {user ? <span aria-hidden className="mx-1 hidden h-6 w-px bg-rvm-line sm:block" /> : null}
        {user ? (
          <AccountMenu avatarUrl={profile?.avatar_url} initial={initial} />
        ) : loading ? (
          <span aria-hidden className="ml-1 h-10 w-10 rounded-full bg-rvm-raised" />
        ) : (
          <Link href={`/auth/login?next=${encodeURIComponent(pathname)}`} prefetch={false}
            className="ml-1 flex h-10 items-center gap-2 rounded-full bg-rvm-deep px-4 text-sm font-bold text-white transition hover:scale-105 hover:bg-rvm-deep-2 motion-reduce:hover:scale-100">
            <UserRound className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Se connecter</span><span className="sr-only sm:hidden">Se connecter</span>
          </Link>
        )}
      </div>
    </header>
  );
}

/**
 * Compte (maquette : l'avatar et une petite flèche) : Mon profil, Rivendy+,
 * Se déconnecter — comme le menu de Rivendy Play. Échap, un clic à côté ou
 * la tabulation hors du menu le referment.
 */
function AccountMenu({ avatarUrl, initial }: { avatarUrl?: string | null; initial: string }) {
  const { signOut } = useAuth();
  const pathname = usePathname() || "/music";
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const item = "flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-rvm-text transition-colors hover:bg-rvm-raised";
  return (
    <div ref={root} className="relative"
      onBlur={(e) => { if (open && e.relatedTarget && !root.current?.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <button ref={button} type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={menuId} aria-label="Mon compte"
        className="flex items-center gap-1 rounded-full p-0.5 text-rvm-text transition-colors hover:bg-rvm-raised sm:pr-1.5">
        <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-rvm-raised text-sm font-bold ring-2 ring-rvm-line">
          {avatarUrl ? <Image src={avatarUrl} alt="" fill sizes="40px" className="object-cover" /> : <span aria-hidden>{initial}</span>}
        </span>
        <ChevronDown className={cn("hidden h-4 w-4 transition-transform motion-reduce:transition-none sm:block", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div id={menuId} className="absolute right-0 top-full z-[60] mt-2 w-60 rounded-2xl border border-rvm-line bg-rvm-surface p-2 shadow-[0_20px_44px_rgb(6_63_59/0.18)]">
          <ul>
            <li>
              <Link href="/profile" prefetch={false} className={item}>
                <UserRound className="h-[18px] w-[18px] text-rvm-ink-accent" aria-hidden /> Mon profil
              </Link>
            </li>
            <li>
              <Link href="/plus" prefetch={false} className={item}>
                <Sparkles className="h-[18px] w-[18px] text-rvm-ink-accent" aria-hidden /> Rivendy+
              </Link>
            </li>
          </ul>
          <div className="mt-1.5 border-t border-rvm-line pt-1.5">
            <button type="button" onClick={() => { setOpen(false); void signOut(); }} className={item}>
              <LogOut className="h-[18px] w-[18px] text-rvm-ink-accent" aria-hidden /> Se déconnecter
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SearchBoxShell() {
  return <div aria-hidden className="h-12 flex-1 rounded-full bg-rvm-field" />;
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
      className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full bg-rvm-field pl-4 pr-1.5 ring-rvm-ink-accent transition hover:bg-rvm-field-hover focus-within:ring-2">
      <Search className="h-5 w-5 shrink-0 text-rvm-text" aria-hidden />
      {/* Pas de boussole (maquette) : « Rechercher », dans la colonne, ouvre déjà les genres. */}
      <input value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Que souhaitez-vous écouter ?" aria-label="Que souhaitez-vous écouter ?" enterKeyHint="search"
        className="min-w-0 flex-1 bg-transparent pr-3 text-[15px] text-rvm-text placeholder:text-rvm-soft focus:outline-none focus-visible:outline-none" />
    </form>
  );
}

/**
 * Téléphone (vert lagon, style « fraîcheur ») : Découvrir, Rechercher, le
 * Hit, Bibliothèque. La marketplace reste au logo, en haut à gauche.
 */
function MobileNav() {
  const pathname = usePathname() || "/music";
  const items = [
    { href: "/music", label: "Découvrir", icon: House, active: pathname === "/music" },
    { href: "/music/explore", label: "Rechercher", icon: Search, active: pathname.startsWith("/music/explore") },
    { href: "/music/hit", label: "Le Hit", icon: ChartColumn, active: pathname.startsWith("/music/hit") },
    { href: "/music/library", label: "Bibliothèque", icon: Library,
      active: ["/music/library", "/music/playlist", "/music/favorites", "/music/history", ARTIST_SPACE_PATH].some((p) => pathname.startsWith(p)) },
  ];
  return (
    <nav aria-label="Navigation Musique" className="rvm-deep shrink-0 pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="grid h-16 grid-cols-4">
        {items.map((it) => (
          <li key={it.label}>
            <Link href={it.href} aria-current={it.active ? "page" : undefined}
              className={cn("flex h-full flex-col items-center justify-center gap-1 text-[11px]", it.active ? "font-extrabold text-rvm-ink-accent" : "font-semibold text-rvm-text")}>
              <span className={cn("grid h-8 w-14 place-items-center rounded-full", it.active ? "bg-rvm-accent text-rvm-on-accent" : "text-rvm-ink-accent")}>
                <it.icon className="h-[22px] w-[22px]" aria-hidden />
              </span>
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
    <footer className="mx-4 mt-6 border-t border-rvm-text/10 py-6 @2xl:mx-6">
      <nav aria-label="Liens du site">
        <ul className="flex flex-wrap gap-x-5 gap-y-1">
          {links.map((l) => (
            <li key={l.label}>
              <Link href={l.href} prefetch={false} className="inline-block py-1 text-[13px] text-rvm-soft transition-colors hover:text-rvm-text hover:underline">{l.label}</Link>
            </li>
          ))}
          <li>
            <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 py-1 text-[13px] font-semibold text-rvm-ink-accent hover:underline">
              <Smartphone className="h-3.5 w-3.5" aria-hidden /> Application Android
            </a>
          </li>
        </ul>
      </nav>
      <p className="mt-3 text-[13px] text-rvm-muted">© {year} Rivendy — Rivendy Musique</p>
    </footer>
  );
}
