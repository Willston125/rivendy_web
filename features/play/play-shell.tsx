"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight, AudioLines, Bell, Bookmark, Check, ChevronDown, Clock, Film, Info, LayoutGrid, LogOut, Music, Play,
  Search, Smartphone, Store, Tv, UserRound, X, type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry } from "@/features/country/country-provider";
import { useNotifications } from "@/features/notifications/use-notifications";
import { marketHomePath } from "@/lib/seo";
import { cn } from "@/lib/utils/cn";
import { PLAY_STORE_URL } from "./play-link-page";
import { PlayListProvider, usePlayList } from "./play-list";
import { firstNameOf, initialsOf, sectionLabel } from "./play-logic";
import { PlaySearchProvider, usePlaySearch } from "./play-search";

/**
 * Coque de Rivendy Play sur le site — mise en page « application » du
 * 2026-10-23 (maquette du propriétaire) : une fenêtre vert profond avec le
 * menu latéral (Découvrir, Films, Séries, Clips, Ma liste, Récents), la
 * barre du haut (rubrique, recherche Ctrl K, notifications, compte) et le
 * panneau central, seul à défiler sur grand écran. En dessous de 1024 px :
 * barre du haut compacte, navigation basse à cinq destinations, défilement
 * normal de la page. L'en-tête et le pied de page de la marketplace restent
 * masqués sur /play (HideInPlay).
 *
 * Aucun prix ni lien d'achat dans la coque : les pages /play/short/… sont
 * ouvertes depuis l'app Android (règle Google Play).
 */

type NavItem = { href: string; label: string; icon: LucideIcon; match: (p: string) => boolean };

const EXPLORE: NavItem[] = [
  { href: "/play", label: "Découvrir", icon: LayoutGrid, match: (p) => p === "/play" },
  { href: "/play/movies", label: "Films", icon: Film, match: (p) => p.startsWith("/play/movie") },
  { href: "/play/series", label: "Séries", icon: Tv, match: (p) => p.startsWith("/play/series") || p.startsWith("/play/episode") },
  { href: "/play/clips", label: "Clips", icon: Music, match: (p) => p.startsWith("/play/clip") },
];

const MY_LIST: NavItem = { href: "/play/my-list", label: "Ma liste", icon: Bookmark, match: (p) => p.startsWith("/play/my-list") };
const RECENT: NavItem = { href: "/play/history", label: "Récents", icon: Clock, match: (p) => p.startsWith("/play/history") };

/** Téléphone : cinq destinations ; « Récents » est un onglet de Ma liste. */
const MOBILE_NAV: NavItem[] = [
  ...EXPLORE,
  { ...MY_LIST, match: (p) => p.startsWith("/play/my-list") || p.startsWith("/play/history") },
];

export function PlayShell({ children }: { children: ReactNode }) {
  // Fond de toute la page, et sur grand écran la fenêtre qui ne défile pas (site.css).
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.world = "play";
    return () => { delete html.dataset.world; };
  }, []);

  return (
    <PlayListProvider>
      <PlaySearchProvider>
        <ShellFrame>{children}</ShellFrame>
      </PlaySearchProvider>
    </PlayListProvider>
  );
}

function ShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/play";
  const router = useRouter();
  const { inputRef } = usePlaySearch();
  const main = useRef<HTMLDivElement>(null);
  const about = useRef<HTMLDialogElement>(null);

  // Chaque page s'ouvre en haut du panneau central (sur grand écran, lui seul défile).
  useEffect(() => { main.current?.scrollTo({ top: 0 }); }, [pathname]);

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
    <div className="rvp-scope bg-rvp-ground text-rvp-text lg:h-dvh lg:p-3 xl:p-4">
      <a href="#rvp-contenu"
        className="sr-only rounded-lg bg-rvp-accent px-4 py-2.5 text-sm font-bold text-rvp-on-accent focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70]">
        Aller au contenu
      </a>
      <div className="flex min-h-dvh flex-col bg-rvp-frame lg:h-full lg:min-h-0 lg:flex-row lg:overflow-hidden lg:rounded-[28px] lg:border lg:border-rvp-edge lg:shadow-[0_40px_90px_-50px_rgba(0,0,0,0.95)]">
        <PlaySidebar pathname={pathname} onAbout={openAbout} />
        {/* « relative » : les éléments positionnés de la page (textes pour lecteurs d'écran
            compris) défilent et sont rognés avec le panneau, au lieu d'allonger la fenêtre. */}
        <div ref={main} id="rvp-main" className="relative flex min-w-0 flex-1 flex-col lg:overflow-y-auto lg:overscroll-contain">
          <MobileTopBar pathname={pathname} />
          <DesktopTopBar pathname={pathname} />
          <div id="rvp-contenu" tabIndex={-1} className="flex-1 outline-none">{children}</div>
          <PlayFooter onAbout={openAbout} />
          {/* Place de la navigation basse (téléphone, tablette). */}
          <div aria-hidden className="h-[calc(4rem+env(safe-area-inset-bottom))] shrink-0 lg:hidden" />
        </div>
      </div>
      <MobileNav pathname={pathname} />
      <AboutDialog dialogRef={about} />
    </div>
  );
}

function Wordmark({ className }: { className?: string }) {
  // Logo officiel, proportions d'origine, passé en blanc sur le fond sombre (comme l'app).
  // Taille d'affichage (≈ 32 px de haut) : sinon l'optimiseur servait la version 3840 px.
  return <Image src="/brand/rivendy-wordmark.png" alt="" width={91} height={32} priority className={cn("w-auto brightness-0 invert", className)} />;
}

function useHomeHref(): string {
  const { country } = useCountry();
  return country?.id ? marketHomePath(country.id) : "/";
}

// ── Menu latéral (grand écran) ─────────────────────────────────────────────

function PlaySidebar({ pathname, onAbout }: { pathname: string; onAbout: () => void }) {
  const { user } = useAuth();
  const list = usePlayList();
  const homeHref = useHomeHref();
  // Nombre de titres de Ma liste : seulement quand la liste du compte est lue.
  const count = user && list.ids && !list.failed ? list.ids.length : null;

  return (
    <aside aria-label="Menu de Rivendy Play"
      className="no-scrollbar relative hidden w-[92px] shrink-0 flex-col overflow-y-auto border-r border-rvp-edge bg-gradient-to-b from-rvp-side to-rvp-frame px-2.5 pb-4 pt-7 lg:flex xl:w-[220px] xl:px-4 xl:pt-9 2xl:w-[236px]">
      <div className="flex flex-col items-center xl:items-start xl:px-3">
        {/* Le logo ramène à la marketplace, « PLAY » à l'accueil de Play. */}
        <Link href={homeHref} prefetch={false} aria-label="Rivendy, retour à la marketplace" className="rounded-md">
          <Wordmark className="h-6 xl:h-8" />
        </Link>
        <Link href="/play" aria-label="Rivendy Play, accueil"
          className="mt-2 flex items-center gap-1.5 rounded-md text-[10px] font-extrabold uppercase tracking-[0.32em] text-rvp-accent xl:mt-2.5 xl:text-[11px] xl:tracking-[0.38em]">
          Play <Play className="h-2.5 w-2.5 fill-current" aria-hidden />
        </Link>
      </div>

      <SideGroup label="Explorer" className="mt-9 xl:mt-12">
        {EXPLORE.map((it) => <SideLink key={it.href} item={it} active={it.match(pathname)} />)}
      </SideGroup>
      <SideGroup label="Votre espace" className="mt-6 xl:mt-9">
        <SideLink item={MY_LIST} active={MY_LIST.match(pathname)} count={count} />
        <SideLink item={RECENT} active={RECENT.match(pathname)} />
      </SideGroup>

      <div className="mt-auto pt-8">
        {/* Signature de la maquette : seulement si la hauteur d'écran laisse le menu entier visible. */}
        <div className="hidden px-3 [@media(min-width:1280px)_and_(min-height:861px)]:block">
          <span aria-hidden className="grid h-10 w-10 place-items-center rounded-full border border-rvp-edge text-rvp-soft">
            <Play className="h-3.5 w-3.5 translate-x-px fill-current" />
          </span>
          <p className="mt-6 text-[21px] leading-[1.3] tracking-tight">
            <span className="block text-rvp-sage">Nos histoires.</span>
            <span className="block text-rvp-text">Votre écran.</span>
          </p>
          <span aria-hidden className="mt-6 block h-px w-8 bg-rvp-edge" />
          <p className="mt-5 text-[10px] font-semibold uppercase leading-5 tracking-[0.2em] text-rvp-muted">Le cinéma d’ici,<br />en grand.</p>
        </div>
        <button type="button" onClick={onAbout} aria-haspopup="dialog"
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-rvp-edge text-[13px] font-medium text-rvp-soft transition-colors hover:border-rvp-accent/50 hover:text-rvp-text xl:justify-between xl:px-3.5">
          <span className="flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0" aria-hidden />
            <span className="hidden xl:inline">À propos de Play</span>
            <span className="sr-only xl:hidden">À propos de Rivendy Play</span>
          </span>
          <ArrowUpRight className="hidden h-4 w-4 xl:block" aria-hidden />
        </button>
      </div>
    </aside>
  );
}

function SideGroup({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <nav aria-label={label} className={className}>
      <p className="hidden px-3 text-[10px] font-bold uppercase tracking-[0.26em] text-rvp-muted xl:block">{label}</p>
      <ul className="mt-1 space-y-1.5 xl:mt-4">{children}</ul>
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
          "group relative flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-[11px] font-semibold transition-colors xl:min-h-12 xl:flex-row xl:gap-3.5 xl:px-3.5 xl:py-0 xl:text-[14.5px]",
          active ? "bg-rvp-accent/10 text-rvp-text ring-1 ring-inset ring-rvp-accent/40" : "text-rvp-soft hover:bg-white/[0.04] hover:text-rvp-text",
        )}>
        {active ? <span aria-hidden className="absolute inset-y-2.5 left-0 w-[3px] rounded-r-full bg-rvp-accent" /> : null}
        <Icon className={cn("h-5 w-5 shrink-0", active ? "text-rvp-accent" : "text-rvp-muted transition-colors group-hover:text-rvp-soft")} aria-hidden />
        <span className="xl:flex-1">{item.label}</span>
        {count != null ? (
          <span className="absolute right-2 top-1.5 min-w-5 rounded-md border border-rvp-edge bg-rvp-frame px-1 text-center text-[10px] font-semibold leading-4 tabular-nums text-rvp-soft xl:static xl:min-w-6 xl:py-0.5 xl:text-[11px]">
            <span aria-hidden>{count}</span>
            <span className="sr-only">, {count} titre{count > 1 ? "s" : ""}</span>
          </span>
        ) : active ? (
          <span aria-hidden className="hidden h-1.5 w-1.5 rounded-full bg-rvp-accent xl:block" />
        ) : null}
      </Link>
    </li>
  );
}

// ── Barres du haut ─────────────────────────────────────────────────────────

function DesktopTopBar({ pathname }: { pathname: string }) {
  return (
    // Alignée sur le contenu (1480 px au plus, mêmes marges que PlayPage) : sur très grand écran,
    // la recherche et le compte restent au-dessus du catalogue.
    <header className="sticky top-0 z-30 hidden shrink-0 bg-rvp-frame/90 backdrop-blur-md lg:block">
      <div className="mx-auto w-full max-w-[1480px] px-6 xl:px-8">
        <div className="flex h-[76px] items-center gap-5 border-b border-rvp-edge">
          <p className="flex w-32 shrink-0 items-center gap-2.5 text-[14px] font-semibold text-rvp-text xl:w-40">
            <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-rvp-accent" />
            <span className="truncate">{sectionLabel(pathname)}</span>
          </p>
          <SearchBox />
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <NotificationsLink />
            <AccountMenu />
          </div>
        </div>
      </div>
    </header>
  );
}

function MobileTopBar({ pathname }: { pathname: string }) {
  const homeHref = useHomeHref();
  const onSearch = pathname.startsWith("/play/search");
  return (
    <header className="sticky top-0 z-40 border-b border-rvp-edge bg-rvp-frame/90 backdrop-blur-md lg:hidden">
      <div className="mx-auto flex h-14 w-full max-w-[1480px] items-center gap-2.5 px-4 sm:h-16 sm:px-6">
        <Link href={homeHref} prefetch={false} aria-label="Rivendy, retour à la marketplace" className="rounded-md">
          <Wordmark className="h-6" />
        </Link>
        <span aria-hidden className="h-5 w-px bg-white/15" />
        <Link href="/play" aria-label="Rivendy Play, accueil"
          className="flex items-center gap-1 rounded-md text-[11px] font-extrabold uppercase tracking-[0.3em] text-rvp-accent">
          Play <Play className="h-2.5 w-2.5 fill-current" aria-hidden />
        </Link>
        <div className="ml-auto flex items-center gap-0.5">
          <Link href="/play/search" aria-label="Rechercher dans Rivendy Play" aria-current={onSearch ? "page" : undefined}
            className={cn("grid h-11 w-11 place-items-center rounded-full transition-colors hover:bg-white/[0.06]", onSearch ? "text-rvp-accent" : "text-rvp-text")}>
            <Search className="h-5 w-5" aria-hidden />
          </Link>
          <NotificationsLink />
          <AccountMenu compact />
        </div>
      </div>
    </header>
  );
}

/**
 * Recherche de la barre du haut : les résultats suivent la frappe sur la page
 * de recherche ; depuis une autre page, elle s'ouvre dès deux lettres.
 */
function SearchBox() {
  const pathname = usePathname() || "/play";
  const { query, setQuery, open, inputRef } = usePlaySearch();
  const onSearch = pathname === "/play/search";
  const [mac, setMac] = useState(false);
  useEffect(() => { setMac(/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)); }, []);

  useEffect(() => {
    const v = query.trim();
    if (onSearch || v.length < 2) return;
    const timer = window.setTimeout(() => open(v), 350);
    return () => window.clearTimeout(timer);
  }, [query, onSearch, open]);

  return (
    <form role="search" aria-label="Rechercher dans Rivendy Play"
      onSubmit={(e) => { e.preventDefault(); if (!onSearch) open(query); }}
      className="flex h-12 min-w-0 max-w-[460px] flex-1 items-center gap-3 rounded-2xl border border-rvp-edge bg-rvp-card/70 pl-4 pr-2 transition-colors hover:border-white/15 focus-within:border-rvp-accent focus-within:ring-2 focus-within:ring-rvp-accent/25">
      <Search className="h-[18px] w-[18px] shrink-0 text-rvp-muted" aria-hidden />
      <input ref={inputRef} type="search" value={query} maxLength={60}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape" && !query) e.currentTarget.blur(); }}
        placeholder="Rechercher un film, une série…" aria-label="Rechercher un film, une série ou un clip"
        aria-keyshortcuts="Control+K Meta+K" enterKeyHint="search" autoComplete="off" spellCheck={false}
        className="min-w-0 flex-1 bg-transparent text-[15px] text-rvp-text placeholder:text-rvp-muted focus:outline-none focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden" />
      {query ? (
        <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} aria-label="Effacer la recherche"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-rvp-muted transition-colors hover:bg-white/10 hover:text-rvp-text">
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : (
        <kbd aria-hidden className="mr-1 shrink-0 rounded-md border border-rvp-edge px-1.5 py-0.5 font-mono text-[11px] text-rvp-muted">
          {mac ? "⌘ K" : "Ctrl K"}
        </kbd>
      )}
    </form>
  );
}

function NotificationsLink() {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  if (!user) return null;
  return (
    <Link href="/notifications" prefetch={false} aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} non lues` : "Notifications"}
      className="relative grid h-11 w-11 place-items-center rounded-full text-rvp-soft transition-colors hover:bg-white/[0.06] hover:text-rvp-text">
      <Bell className="h-5 w-5" aria-hidden />
      {unreadCount > 0 ? (
        <span aria-hidden className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-rvp-accent px-1 text-[10px] font-black text-rvp-on-accent">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}

function Avatar({ url, initials, className }: { url: string | null | undefined; initials: string; className?: string }) {
  return (
    <span className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-rvp-sage text-[13px] font-bold text-rvp-on-accent ring-2 ring-rvp-edge", className)}>
      {url ? <Image src={url} alt="" fill sizes="44px" className="object-cover" /> : <span aria-hidden>{initials}</span>}
    </span>
  );
}

/**
 * Compte : « Se connecter » pour un visiteur ; sinon l'avatar, le prénom et
 * « Mon espace », qui ouvrent les raccourcis du compte (Échap referme).
 */
function AccountMenu({ compact }: { compact?: boolean }) {
  const { user, profile, loading, signOut } = useAuth();
  const pathname = usePathname() || "/play";
  const homeHref = useHomeHref();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  // Deux exemplaires (barre du téléphone, barre de l'ordinateur) : un identifiant chacun.
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

  if (loading) return <span aria-hidden className="ml-1 h-10 w-10 rounded-full bg-rvp-raised" />;
  if (!user) {
    return (
      <Link href={`/auth/login?next=${encodeURIComponent(pathname)}`} prefetch={false}
        className="ml-1 flex h-11 items-center gap-2 rounded-full border border-rvp-edge px-3 text-sm font-semibold text-rvp-text transition-colors hover:border-rvp-accent/60 hover:text-rvp-accent sm:px-4">
        <UserRound className="h-4 w-4" aria-hidden />
        <span className={compact ? "sr-only sm:not-sr-only" : undefined}>Se connecter</span>
      </Link>
    );
  }

  const name = (profile?.full_name || profile?.store_name || "").trim() || null;
  const first = firstNameOf(name);
  return (
    // Tabulation hors du menu : il se referme. (Un clic sans cible de focus — Safari
    // ne donne pas le focus aux boutons — est traité par l'écouteur pointerdown.)
    <div ref={root} className="relative ml-1"
      onBlur={(e) => { if (open && e.relatedTarget && !root.current?.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <button ref={button} type="button" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((o) => !o)}
        aria-label={compact ? "Mon espace" : undefined}
        className="flex h-12 items-center gap-3 rounded-full p-1 transition-colors hover:bg-white/[0.05] xl:pr-2.5">
        <Avatar url={profile?.avatar_url} initials={initialsOf(name)} className="h-10 w-10" />
        {!compact ? (
          <span className="hidden min-w-0 text-left leading-tight xl:block">
            <span className="block max-w-[9rem] truncate text-[14px] font-semibold text-rvp-text">{first ?? "Mon compte"}</span>
            <span className="block text-[12px] text-rvp-muted">Mon espace</span>
          </span>
        ) : null}
        {!compact ? <ChevronDown className={cn("hidden h-4 w-4 text-rvp-muted transition-transform xl:block", open && "rotate-180")} aria-hidden /> : null}
      </button>
      {open ? (
        <div id={menuId} className="absolute right-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-rvp-edge bg-rvp-card p-2 shadow-2xl shadow-black/60">
          <div className="flex items-center gap-3 px-2.5 pb-3 pt-2">
            <Avatar url={profile?.avatar_url} initials={initialsOf(name)} className="h-9 w-9 text-[12px]" />
            <p className="min-w-0 text-sm">
              <span className="block truncate font-semibold text-rvp-text">{name ?? "Mon compte"}</span>
              <span className="block text-xs text-rvp-muted">Le même compte sur le site et dans l’application</span>
            </p>
          </div>
          <ul className="border-t border-rvp-edge pt-1.5">
            <MenuLink href="/play/my-list" icon={Bookmark}>Ma liste</MenuLink>
            <MenuLink href="/play/history" icon={Clock}>Récents</MenuLink>
            <MenuLink href="/profile" icon={UserRound}>Mon profil</MenuLink>
          </ul>
          <ul className="mt-1.5 border-t border-rvp-edge pt-1.5">
            <MenuLink href={homeHref} icon={Store}>La marketplace</MenuLink>
            <MenuLink href="/music" icon={AudioLines}>Rivendy Musique</MenuLink>
          </ul>
          <div className="mt-1.5 border-t border-rvp-edge pt-1.5">
            <button type="button" onClick={() => { setOpen(false); void signOut(); }}
              className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-rvp-soft transition-colors hover:bg-white/[0.05] hover:text-rvp-text">
              <LogOut className="h-4 w-4 text-rvp-muted" aria-hidden /> Se déconnecter
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({ href, icon: Icon, children }: { href: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <li>
      <Link href={href} prefetch={false}
        className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-rvp-soft transition-colors hover:bg-white/[0.05] hover:text-rvp-text">
        <Icon className="h-4 w-4 text-rvp-muted" aria-hidden /> {children}
      </Link>
    </li>
  );
}

// ── Téléphone : navigation basse ───────────────────────────────────────────

function MobileNav({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Rivendy Play"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-rvp-edge bg-rvp-frame/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      <ul className="mx-auto grid h-16 max-w-xl grid-cols-5">
        {MOBILE_NAV.map((it) => {
          const active = it.match(pathname);
          const Icon = it.icon;
          return (
            <li key={it.href}>
              <Link href={it.href} aria-current={active ? "page" : undefined}
                className={cn("relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors",
                  active ? "text-rvp-text" : "text-rvp-muted hover:text-rvp-soft")}>
                {active ? <span aria-hidden className="absolute inset-x-4 top-0 h-[3px] rounded-b-full bg-rvp-accent" /> : null}
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

// ── Pied de page et « À propos » ───────────────────────────────────────────

function PlayFooter({ onAbout }: { onAbout: () => void }) {
  const homeHref = useHomeHref();
  const year = new Date().getFullYear();
  const links = [
    { href: homeHref, label: "La marketplace" },
    { href: "/music", label: "Rivendy Musique" },
    { href: "/help", label: "Aide" },
    { href: "/legal?tab=cgu", label: "Conditions" },
    { href: "/legal?tab=privacy", label: "Confidentialité" },
  ];
  return (
    <footer className="mx-auto mt-14 w-full max-w-[1480px] px-4 sm:px-6 xl:px-8">
      <div className="flex flex-col gap-3 border-t border-rvp-edge py-6 text-[13px] text-rvp-muted xl:flex-row xl:items-center xl:justify-between xl:gap-6">
        <p>© {year} Rivendy Play</p>
        <p className="text-rvp-soft">Films. Séries. Talents de chez nous.</p>
        <nav aria-label="Liens du site">
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {links.map((l) => (
              <li key={l.label}>
                <Link href={l.href} prefetch={false} className="inline-block py-1.5 transition-colors hover:text-rvp-text">{l.label}</Link>
              </li>
            ))}
            <li>
              <button type="button" onClick={onAbout} aria-haspopup="dialog" className="inline-flex items-center gap-1.5 py-1.5 transition-colors hover:text-rvp-text">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-rvp-accent" /> À propos de Play
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}

/** « À propos de Play » : fenêtre native (Échap ou clic à côté la referment). */
function AboutDialog({ dialogRef }: { dialogRef: RefObject<HTMLDialogElement | null> }) {
  const close = () => dialogRef.current?.close();
  const facts = [
    "Un seul compte : Ma liste, la reprise de lecture et vos récents vous suivent, sur le site comme dans l’application.",
    "Les clips des artistes sont toujours gratuits.",
    "Le catalogue dépend de votre pays.",
  ];
  return (
    <dialog ref={dialogRef} aria-labelledby="rvp-apropos"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
      className="m-auto w-[min(92vw,31rem)] max-w-none rounded-3xl border border-rvp-edge bg-rvp-card p-0 text-rvp-text shadow-2xl shadow-black/70 backdrop:bg-black/70 backdrop:backdrop-blur-sm">
      <div className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.32em] text-rvp-accent">
              Rivendy Play <Play className="h-2.5 w-2.5 fill-current" aria-hidden />
            </p>
            <h2 id="rvp-apropos" className="mt-3 text-[26px] font-semibold leading-tight tracking-tight">
              Nos histoires. <span className="text-rvp-sage">Votre écran.</span>
            </h2>
          </div>
          <button type="button" onClick={close} aria-label="Fermer"
            className="-mr-2 -mt-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-rvp-muted transition-colors hover:bg-white/[0.06] hover:text-rvp-text">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <p className="mt-4 text-[15px] leading-7 text-rvp-soft">
          Des films, des séries et des clips d’artistes, à regarder sur le site et dans l’application Rivendy.
        </p>
        <ul className="mt-5 space-y-3">
          {facts.map((f) => (
            <li key={f} className="flex gap-3 text-sm leading-6 text-rvp-soft">
              <Check className="mt-1 h-4 w-4 shrink-0 text-rvp-accent" aria-hidden /> {f}
            </li>
          ))}
        </ul>
        <div className="mt-7 flex flex-wrap gap-3">
          <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-rvp-accent px-5 text-sm font-bold text-rvp-on-accent transition-colors hover:bg-rvp-accent-hover">
            <Smartphone className="h-4 w-4" aria-hidden /> Application Android
          </a>
          <Link href="/help" prefetch={false} onClick={close}
            className="inline-flex h-11 items-center rounded-xl border border-rvp-edge px-5 text-sm font-semibold text-rvp-text transition-colors hover:border-rvp-accent/60">
            Aide
          </Link>
        </div>
        <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-1 border-t border-rvp-edge pt-4 text-[13px] text-rvp-muted">
          {[
            { href: "/music", label: "Rivendy Musique" },
            { href: "/droits-auteur", label: "Droits d’auteur" },
            { href: "/legal?tab=cgu", label: "Conditions" },
            { href: "/legal?tab=privacy", label: "Confidentialité" },
          ].map((l) => (
            <li key={l.href}>
              <Link href={l.href} prefetch={false} onClick={close} className="inline-block py-1.5 transition-colors hover:text-rvp-text">{l.label}</Link>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  );
}
