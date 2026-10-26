"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AudioLines, Bell, Bookmark, ChevronDown, Clock, LogOut, Search, Store, UserRound, X, type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useNotifications } from "@/features/notifications/use-notifications";
import { cn } from "@/lib/utils/cn";
import { PlayMark, Wordmark, useHomeHref } from "./play-brand";
import { firstNameOf, initialsOf, sectionLabel } from "./play-logic";
import { usePlaySearch } from "./play-search";
import { motion } from "./play-theme";

/**
 * Barres du haut de Rivendy Play (« Emerald Cinema », 2026-10-24) : presque
 * invisibles tant que la page est en haut — le cinéma passe d'abord —, verre
 * sombre dès qu'elle défile. Tablette et ordinateur : rubrique, recherche
 * (Ctrl K), notifications, compte. Téléphone : logo, recherche, compte.
 */

export const BAR_SCROLLED = "bg-rvp-ground/80 shadow-[0_1px_0_var(--rvp-edge)] backdrop-blur-xl";

export function PlayHeader({ pathname, scrolled }: { pathname: string; scrolled: boolean }) {
  return (
    // Alignée sur le contenu (1480 px au plus, mêmes marges que PlayPage) : sur très grand écran,
    // la recherche et le compte restent au-dessus du catalogue.
    <header className={cn("sticky top-0 z-30 hidden shrink-0 md:block", motion, scrolled ? BAR_SCROLLED : "bg-transparent")}>
      <div className="mx-auto flex h-[72px] w-full max-w-[1480px] items-center gap-4 px-4 sm:px-6 xl:px-8">
        <p className="flex w-28 shrink-0 items-center gap-2.5 text-[14px] font-semibold text-rvp-text xl:w-40">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-rvp-accent shadow-rvp-dot" />
          <span className="truncate">{sectionLabel(pathname)}</span>
        </p>
        <SearchBox />
        <div className="flex shrink-0 items-center gap-1.5">
          <NotificationsLink />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}

export function MobileTopBar({ pathname, scrolled }: { pathname: string; scrolled: boolean }) {
  const homeHref = useHomeHref();
  const onSearch = pathname.startsWith("/play/search");
  return (
    <header className={cn("sticky top-0 z-40 md:hidden", motion,
      scrolled ? BAR_SCROLLED : "bg-gradient-to-b from-rvp-ground/85 via-rvp-ground/40 to-transparent")}>
      <div className="mx-auto flex h-14 w-full max-w-[1480px] items-center gap-2.5 px-4 sm:h-16 sm:px-6">
        <Link href={homeHref} prefetch={false} aria-label="Rivendy, retour à la marketplace" className="rounded-md">
          <Wordmark className="h-6" />
        </Link>
        <span aria-hidden className="h-5 w-px bg-white/15" />
        <Link href="/play" aria-label="Rivendy Play, accueil" className="rounded-md">
          <PlayMark className="text-[11px] tracking-[0.3em]" />
        </Link>
        <div className="ml-auto flex items-center gap-0.5">
          <Link href="/play/search" aria-label="Rechercher dans Rivendy Play" aria-current={onSearch ? "page" : undefined}
            className={cn("grid h-11 w-11 place-items-center rounded-full hover:bg-white/[0.06]", motion, onSearch ? "text-rvp-accent" : "text-rvp-text")}>
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
      className={cn(
        "mx-auto flex h-12 min-w-0 max-w-[520px] flex-1 items-center gap-3 rounded-rvp border border-white/10 bg-rvp-surface/60 pl-4 pr-2 backdrop-blur-md hover:border-white/20 focus-within:border-rvp-accent focus-within:ring-2 focus-within:ring-rvp-accent/25",
        motion,
      )}>
      <Search className="h-[18px] w-[18px] shrink-0 text-rvp-muted" aria-hidden />
      <input ref={inputRef} type="search" value={query} maxLength={60}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape" && !query) e.currentTarget.blur(); }}
        placeholder="Rechercher un film, une série…" aria-label="Rechercher un film, une série ou un clip"
        aria-keyshortcuts="Control+K Meta+K" enterKeyHint="search" autoComplete="off" spellCheck={false}
        className="min-w-0 flex-1 bg-transparent text-[15px] text-rvp-text placeholder:text-rvp-muted focus:outline-none focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden" />
      {query ? (
        <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} aria-label="Effacer la recherche"
          className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full text-rvp-muted hover:bg-white/10 hover:text-rvp-text", motion)}>
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : (
        <kbd aria-hidden className="mr-1 shrink-0 rounded-md border border-white/15 bg-rvp-ground/40 px-1.5 py-0.5 font-mono text-[11px] text-rvp-muted">
          {mac ? "⌘ K" : "Ctrl K"}
        </kbd>
      )}
    </form>
  );
}

export function NotificationsLink() {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  if (!user) return null;
  return (
    <Link href="/notifications" prefetch={false} aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} non lues` : "Notifications"}
      className={cn("relative grid h-11 w-11 place-items-center rounded-full text-rvp-soft hover:bg-white/[0.06] hover:text-rvp-text", motion)}>
      <Bell className="h-5 w-5" aria-hidden />
      {unreadCount > 0 ? (
        <span aria-hidden className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-rvp-accent px-1 text-[10px] font-black text-rvp-on-accent shadow-rvp-dot">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}

function Avatar({ url, initials, className }: { url: string | null | undefined; initials: string; className?: string }) {
  return (
    <span className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-rvp-accent to-rvp-accent-pressed text-[13px] font-bold text-rvp-on-accent ring-2 ring-rvp-edge-strong", className)}>
      {url ? <Image src={url} alt="" fill sizes="44px" className="object-cover" /> : <span aria-hidden>{initials}</span>}
    </span>
  );
}

/**
 * Compte : « Se connecter » pour un visiteur ; sinon l'avatar, le prénom et
 * « Mon espace », qui ouvrent les raccourcis du compte (Échap referme).
 */
export function AccountMenu({ compact }: { compact?: boolean }) {
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

  if (loading) return <span aria-hidden className="rvp-skeleton ml-1 h-10 w-10 rounded-full" />;
  if (!user) {
    return (
      <Link href={`/auth/login?next=${encodeURIComponent(pathname)}`} prefetch={false}
        className={cn("ml-1 flex h-11 items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 text-sm font-semibold text-rvp-text backdrop-blur-md hover:border-rvp-edge-strong hover:text-rvp-accent sm:px-4", motion)}>
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
        className={cn("flex h-12 items-center gap-3 rounded-full p-1 hover:bg-white/[0.05] xl:pr-2.5", motion)}>
        <Avatar url={profile?.avatar_url} initials={initialsOf(name)} className="h-10 w-10" />
        {!compact ? (
          <span className="hidden min-w-0 text-left leading-tight xl:block">
            <span className="block max-w-[9rem] truncate text-[14px] font-semibold text-rvp-text">{first ?? "Mon compte"}</span>
            <span className="block text-[12px] text-rvp-muted">Mon espace</span>
          </span>
        ) : null}
        {!compact ? <ChevronDown className={cn("hidden h-4 w-4 text-rvp-muted xl:block", motion, open && "rotate-180")} aria-hidden /> : null}
      </button>
      {open ? (
        <div id={menuId} className="rvp-rise-in absolute right-0 top-full z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-rvp-panel border border-rvp-edge bg-rvp-surface/95 p-2 shadow-rvp-deep backdrop-blur-xl">
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
              className={cn("flex h-11 w-full items-center gap-3 rounded-rvp px-3 text-sm font-medium text-rvp-soft hover:bg-white/[0.05] hover:text-rvp-text", motion)}>
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
        className={cn("flex h-11 items-center gap-3 rounded-rvp px-3 text-sm font-medium text-rvp-soft hover:bg-white/[0.05] hover:text-rvp-text", motion)}>
        <Icon className="h-4 w-4 text-rvp-muted" aria-hidden /> {children}
      </Link>
    </li>
  );
}
