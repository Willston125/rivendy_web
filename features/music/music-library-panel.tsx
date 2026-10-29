"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowDownAZ, Check, Clock, Heart, LayoutGrid, Library, List, LoaderCircle, Maximize2, Minimize2, PanelLeftClose, Pin,
  Play, Plus, Rows3, Search, Volume2, X,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useHomeMarket } from "@/features/media/use-home-market";
import { cn } from "@/lib/utils/cn";
import { fetchArtistTopTracks, fetchLikedTracks, fetchPlaylist, fetchRelease } from "./music-api";
import { IconTile, PlaylistCover } from "./music-collection";
import { useMusicLayout, type LibraryView } from "./music-layout";
import { useMusicLibrary } from "./music-library";
import { inviteLogin } from "./music-login-invite";
import { ArtistSpaceCard, ArtistSpaceIcon } from "./music-nav";
import { filterLibrary, libraryKinds, sortLibrary, type LibraryEntry, type LibraryKind, type LibrarySort } from "./music-logic";
import { loginHref } from "./music-pending";
import { Cover, iconButton, toQueue } from "./music-ui";
import { useMusicPlayer } from "./player/music-player-provider";

/**
 * « Ma bibliothèque » (mise en page application du 2026-10-22) : à gauche
 * de l'espace Musique, repliable (pochettes seules) ou agrandie (grille à
 * la place du panneau central) ; page entière sur téléphone
 * (/music/library). Uniquement les données du compte : titres likés,
 * playlists, albums enregistrés, artistes suivis.
 */

const KIND_LABEL: Record<"playlist" | "album" | "artist", string> = { playlist: "Playlists", album: "Albums", artist: "Artistes" };
/** Historique du compte (page existante) : épinglé dans la bibliothèque, comme dans la référence « fraîcheur ». */
const HISTORY_HREF = "/music/history";
const SORT_LABEL: Record<LibrarySort, string> = { recent: "Récents", added: "Ajoutés récemment", alpha: "Ordre alphabétique" };
const VIEW_LABEL: Record<LibraryView, string> = { compact: "Compacte", list: "Liste", grid: "Grille" };

export function LibraryPanel({ variant = "panel" }: { variant?: "panel" | "page" }) {
  const layout = useMusicLayout();
  const library = useMusicLibrary();
  const { user, loading } = useAuth();
  const pathname = usePathname() || "/music";
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const page = variant === "page";
  const mode = page ? "list" : layout.libMode;
  const view: LibraryView = page ? (layout.libView === "compact" ? "compact" : layout.libView) : mode === "expanded" ? "grid" : layout.libView;
  const kind = layout.libKind;

  const all = library.entries ?? [];
  const kinds = libraryKinds(all);
  const shown = sortLibrary(filterLibrary(all, kind, query), layout.libSort);
  // « Écoutés récemment » juste après les entrées épinglées (favoris), hors filtre et recherche.
  const firstFree = shown.findIndex((e) => !e.pinned);
  const historyAt = user && !kind && !query ? (firstFree < 0 ? shown.length : firstFree) : -1;
  const historyActive = pathname === HISTORY_HREF;
  function withHistory(rows: ReactNode[], history: ReactNode): ReactNode[] {
    if (historyAt < 0) return rows;
    const out = [...rows];
    out.splice(historyAt, 0, history);
    return out;
  }

  // Un filtre qui ne correspond plus à rien (album retiré…) s'efface.
  const { setLibKind } = layout;
  useEffect(() => {
    if (kind && kind !== "liked" && !kinds.includes(kind as "playlist" | "album" | "artist")) setLibKind(null);
  }, [kind, kinds, setLibKind]);

  // Visiteur, bibliothèque repliée : un rail ; ses boutons expliquent le compte.
  // Dépliée (par défaut), la colonne lui montre l'invitation à se connecter.
  if (!page && !user && mode === "collapsed") return <VisitorRail busy={loading} />;

  if (mode === "collapsed") {
    return (
      <nav aria-label="Ma bibliothèque (repliée)" className="flex h-full flex-col items-center gap-2 py-3">
        <button type="button" onClick={() => layout.setLibMode("list")} aria-label="Ouvrir la bibliothèque" title="Ouvrir la bibliothèque"
          className={cn(iconButton, "h-11 w-11 text-rvm-soft")}>
          <Library className="h-6 w-6" aria-hidden />
        </button>
        <button type="button" onClick={() => void library.newPlaylist()} aria-label="Créer une playlist" title="Créer une playlist"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-rvm-raised text-rvm-text hover:bg-rvm-text/15">
          <Plus className="h-5 w-5" aria-hidden />
        </button>
        <ul className="mt-1 flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto px-1 pb-2">
          {withHistory(shown.map((e) => (
            <li key={e.key}>
              <Link href={e.href} aria-label={`${e.title} — ${e.subtitle}`} title={e.title}
                aria-current={pathname === e.href ? "page" : undefined}
                className={cn("block rounded-md p-1.5 hover:bg-rvm-text/[0.07]", pathname === e.href && "bg-rvm-text/10")}>
                <EntryCover entry={e} className="h-12 w-12" />
              </Link>
            </li>
          )), <li key="history"><HistoryItem variant="rail" active={historyActive} /></li>)}
        </ul>
        <ArtistSpaceIcon />
      </nav>
    );
  }

  return (
    // Page (téléphone) : c'est le panneau central qui défile, pas la liste.
    <nav aria-label="Ma bibliothèque" className={cn("@container flex min-h-0 flex-col", !page && "h-full")}>
      <div className={cn("flex shrink-0 items-center gap-2 px-4 pb-2", page ? "pt-5 @2xl:px-6" : "pt-3 @max-[18rem]:gap-1 @max-[18rem]:px-3")}>
        {!page ? (
          <button type="button" onClick={() => layout.setLibMode("collapsed")} aria-label="Replier la bibliothèque" title="Replier la bibliothèque"
            className={cn(iconButton, "-ml-2 h-9 w-9 text-rvm-soft")}>
            <PanelLeftClose className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
        {page
          ? <h1 className="min-w-0 flex-1 truncate text-2xl font-black">Ma bibliothèque</h1>
          : (
            // Colonne étroite (tablette) : le libellé court de la navigation du téléphone.
            <h2 className="min-w-0 flex-1 truncate text-base font-bold">
              <span className="@max-[18rem]:hidden">Ma bibliothèque</span>
              <span className="hidden @max-[18rem]:inline">Bibliothèque</span>
            </h2>
          )}
        <button type="button" onClick={() => void library.newPlaylist()} aria-label="Créer une playlist"
          title="Créer une playlist"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-rvm-raised text-sm font-bold text-rvm-text transition-colors hover:bg-rvm-text/15 @xs:w-auto @xs:px-3.5">
          <Plus className="h-4 w-4" aria-hidden /> <span className="hidden @xs:inline">Créer</span>
        </button>
        {!page && user ? (
          <button type="button" onClick={() => layout.setLibMode(mode === "expanded" ? "list" : "expanded")}
            aria-label={mode === "expanded" ? "Réduire la bibliothèque" : "Agrandir la bibliothèque"}
            title={mode === "expanded" ? "Réduire la bibliothèque" : "Agrandir la bibliothèque"}
            className={cn(iconButton, "h-9 w-9 text-rvm-soft")}>
            {mode === "expanded" ? <Minimize2 className="h-[18px] w-[18px]" aria-hidden /> : <Maximize2 className="h-[18px] w-[18px]" aria-hidden />}
          </button>
        ) : null}
      </div>

      {user && kinds.length > 0 ? (
        <div role="group" aria-label="Filtrer la bibliothèque" className="no-scrollbar flex shrink-0 items-center gap-2 overflow-x-auto px-4 pb-2">
          {kind ? (
            <button type="button" onClick={() => setLibKind(null)} aria-label="Retirer le filtre"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rvm-raised text-rvm-soft hover:text-rvm-text">
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
          {kinds.map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setLibKind(kind === k ? null : (k as LibraryKind))}
              className={cn("h-8 shrink-0 rounded-full px-3.5 text-sm font-semibold transition-colors",
                kind === k ? "bg-rvm-accent text-rvm-on-accent" : "bg-rvm-raised text-rvm-text hover:bg-rvm-text/15")}>
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      ) : null}

      {user && all.length > 0 ? (
        <div className="flex shrink-0 items-center gap-2 px-3 pb-1">
          {searching || mode === "expanded" || page ? (
            <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md bg-rvm-raised px-2.5 focus-within:ring-2 focus-within:ring-rvm-ink-accent">
              <Search className="h-4 w-4 shrink-0 text-rvm-soft" aria-hidden />
              <input value={query} onChange={(e) => setQuery(e.target.value)} autoFocus={searching}
                onKeyDown={(e) => { if (e.key === "Escape") { setQuery(""); setSearching(false); } }}
                placeholder="Rechercher dans la bibliothèque" aria-label="Rechercher dans la bibliothèque"
                className="min-w-0 flex-1 bg-transparent text-sm text-rvm-text placeholder:text-rvm-soft focus:outline-none focus-visible:outline-none" />
              {query ? (
                <button type="button" onClick={() => setQuery("")} aria-label="Effacer la recherche" className="text-rvm-soft hover:text-rvm-text">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </label>
          ) : (
            <button type="button" onClick={() => setSearching(true)} aria-label="Rechercher dans la bibliothèque" title="Rechercher dans la bibliothèque"
              className={cn(iconButton, "h-9 w-9 text-rvm-soft")}>
              <Search className="h-[18px] w-[18px]" aria-hidden />
            </button>
          )}
          <SortMenu />
        </div>
      ) : null}

      <div className={cn("pb-3", !page && "min-h-0 flex-1 overflow-y-auto overscroll-contain", view === "grid" ? "px-3" : "px-2")}>
        {!user ? (
          loading ? <RowsSkeleton /> : <SignedOut path={pathname} />
        ) : library.libraryError && !library.entries ? (
          <div className="m-2 rounded-lg bg-rvm-raised p-4 text-sm">
            <p className="font-semibold">Impossible de charger votre bibliothèque.</p>
            <button type="button" onClick={library.refreshLibrary} className="mt-3 h-9 rounded-full border border-rvm-text/25 px-4 font-semibold hover:border-rvm-text">Réessayer</button>
          </div>
        ) : !library.entries ? <RowsSkeleton /> : shown.length === 0 ? (
          <p className="px-3 py-4 text-sm text-rvm-soft">{query ? `Rien ne correspond à « ${query} ».` : "Rien pour ce filtre."}</p>
        ) : view === "grid" ? (
          <ul className={cn("grid gap-2", page ? "grid-cols-2 @lg:grid-cols-3 @3xl:grid-cols-4 @5xl:grid-cols-6" : "grid-cols-[repeat(auto-fill,minmax(118px,1fr))]")}>
            {withHistory(shown.map((e) => <li key={e.key}><EntryCard entry={e} active={pathname === e.href} /></li>),
              <li key="history"><HistoryItem variant="card" active={historyActive} /></li>)}
          </ul>
        ) : (
          <ul>
            {withHistory(shown.map((e) => <li key={e.key}><EntryRow entry={e} active={pathname === e.href} compact={view === "compact"} /></li>),
              <li key="history"><HistoryItem variant={view === "compact" ? "compact" : "row"} active={historyActive} /></li>)}
          </ul>
        )}
        {user && library.entries && all.length <= 2 && !query && !kind ? <Starter hasPlaylist={all.some((e) => e.kind === "playlist")} /> : null}
        {/* Téléphone : l'« Espace artiste » suit la liste (pas de colonne de gauche). */}
        {page ? <ArtistSpaceCard variant="row" className="mx-1 mt-6" /> : null}
      </div>
      {/* Panneau : la carte reste en bas, hors de la liste qui défile (lot 2, 2026-10-29). */}
      {!page && mode === "list" ? <div className="shrink-0 px-3 pb-2 pt-2"><ArtistSpaceCard /></div> : null}
    </nav>
  );
}

/** Pochette d'une entrée : favoris (dégradé vert), playlist (mosaïque), album, artiste (rond). */
/**
 * Rail du visiteur (lot « Musique web », 2026-10-23) : la bibliothèque et
 * « Créer » ouvrent une invitation qui explique le compte, sans quitter la page.
 */
function VisitorRail({ busy }: { busy: boolean }) {
  return (
    <nav aria-label="Ma bibliothèque" className="flex h-full flex-col items-center gap-2 py-3">
      <button type="button" disabled={busy} onClick={() => inviteLogin({ kind: "library" })}
        aria-label="Ma bibliothèque" title="Ma bibliothèque" className={cn(iconButton, "h-11 w-11 text-rvm-soft")}>
        <Library className="h-6 w-6" aria-hidden />
      </button>
      <button type="button" disabled={busy} onClick={() => inviteLogin({ kind: "create" })}
        aria-label="Créer une playlist" title="Créer une playlist"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-rvm-raised text-rvm-text hover:bg-rvm-text/15 disabled:opacity-40">
        <Plus className="h-5 w-5" aria-hidden />
      </button>
      <ArtistSpaceIcon className="mt-auto" />
    </nav>
  );
}

/** Vignette d’une entrée (aussi dans les raccourcis de l’accueil). */
export function EntryCover({ entry: e, className, size = 160 }: { entry: LibraryEntry; className?: string; size?: 160 | 320 }) {
  if (e.kind === "liked") return <IconTile icon={Heart} className={cn("rounded shadow-none", className)} />;
  if (e.kind === "playlist") return <PlaylistCover covers={e.covers ?? []} size={size} className={cn("rounded shadow-none", className)} />;
  if (e.kind === "artist") {
    return e.cover ? <Cover url={e.cover} size={size} alt="" rounded="rounded-full" className={className} />
      : (
        <span aria-hidden className={cn("flex aspect-square items-center justify-center rounded-full bg-gradient-to-br from-rvm-brand/45 to-rvm-raised font-black text-rvm-text", className)}>
          {e.title.trim().charAt(0).toUpperCase() || "?"}
        </span>
      );
  }
  return <Cover url={e.cover} size={size} alt="" rounded="rounded" className={className} />;
}

/** Lire une entrée de la bibliothèque : ses titres sont chargés au clic. */
function usePlayEntry(entry: LibraryEntry) {
  const player = useMusicPlayer();
  const market = useHomeMarket();
  const [busy, setBusy] = useState(false);
  const isThis = player.source?.href === entry.href && !!player.current;
  async function play() {
    if (isThis) { player.toggle(); return; }
    setBusy(true);
    const source = { label: entry.title, href: entry.href };
    try {
      if (entry.kind === "liked") player.playQueue(toQueue(await fetchLikedTracks()), 0, { source });
      else if (entry.kind === "playlist") player.playQueue(toQueue((await fetchPlaylist(entry.id)).tracks), 0, { source });
      else if (entry.kind === "album") { const { release, tracks } = await fetchRelease(entry.id); player.playQueue(toQueue(tracks, release), 0, { source }); }
      else player.playQueue(toQueue(await fetchArtistTopTracks(entry.id, market)), 0, { source });
    } catch {
      player.playQueue([], 0);
    } finally {
      setBusy(false);
    }
  }
  return { isThis, playing: isThis && player.playing, busy, play };
}

function EntryRow({ entry: e, active, compact }: { entry: LibraryEntry; active: boolean; compact: boolean }) {
  const { isThis, playing, busy, play } = usePlayEntry(e);
  return (
    <div className={cn("group relative flex items-center gap-3 rounded-md px-2 transition-colors hover:bg-rvm-text/[0.07]",
      compact ? "h-9" : "py-1.5", active && "bg-rvm-text/10 hover:bg-rvm-text/[0.13]")}>
      {!compact ? (
        <div className="relative shrink-0">
          <EntryCover entry={e} className="h-12 w-12" />
          <button type="button" onClick={play} aria-label={playing ? `Mettre en pause ${e.title}` : `Écouter ${e.title}`}
            className={cn("absolute inset-0 z-10 flex items-center justify-center rounded bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100",
              e.kind === "artist" && "rounded-full")}>
            {busy ? <LoaderCircle className="h-5 w-5 motion-safe:animate-spin" aria-hidden />
              : playing ? <Volume2 className="h-5 w-5" aria-hidden /> : <Play className="h-5 w-5 fill-current" aria-hidden />}
          </button>
        </div>
      ) : null}
      <Link href={e.href} aria-current={active ? "page" : undefined} className="min-w-0 flex-1 after:absolute after:inset-0 after:rounded-md">
        {compact ? (
          <span className="block truncate text-[14px]">
            <span className={cn("font-semibold", isThis ? "text-rvm-ink-accent" : "text-rvm-text")}>{e.title}</span>
            <span className="text-rvm-soft"> • {e.subtitle.split(" • ")[0]}</span>
          </span>
        ) : (
          <>
            <span className={cn("block truncate text-[15px] font-semibold", isThis ? "text-rvm-ink-accent" : "text-rvm-text")}>{e.title}</span>
            <span className="flex items-center gap-1 truncate text-[13px] text-rvm-soft">
              {e.pinned ? <Pin className="h-3.5 w-3.5 shrink-0 fill-rvm-ink-accent text-rvm-ink-accent" aria-label="Épinglé" /> : null}
              <span className="truncate">{e.subtitle}</span>
            </span>
          </>
        )}
      </Link>
      {isThis ? <Volume2 className="relative h-4 w-4 shrink-0 text-rvm-ink-accent" aria-label="En cours de lecture" /> : null}
    </div>
  );
}

function EntryCard({ entry: e, active }: { entry: LibraryEntry; active: boolean }) {
  const { isThis, playing, busy, play } = usePlayEntry(e);
  return (
    <div className={cn("group relative rounded-md p-2.5 transition-colors hover:bg-rvm-text/[0.07]", active && "bg-rvm-text/10")}>
      <div className="relative">
        <EntryCover entry={e} size={320} className="w-full shadow-lg shadow-rvm-deep/40" />
        <button type="button" onClick={play} aria-label={playing ? `Mettre en pause ${e.title}` : `Écouter ${e.title}`}
          className="absolute bottom-2 right-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-rvm-accent text-rvm-on-accent shadow-xl shadow-rvm-deep/40 opacity-0 transition hover:scale-105 group-hover:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none">
          {busy ? <LoaderCircle className="h-5 w-5 motion-safe:animate-spin" aria-hidden />
            : playing ? <Volume2 className="h-5 w-5" aria-hidden /> : <Play className="ml-0.5 h-5 w-5 fill-current" aria-hidden />}
        </button>
      </div>
      <Link href={e.href} aria-current={active ? "page" : undefined}
        className={cn("mt-2 block truncate text-[15px] font-semibold after:absolute after:inset-0 after:rounded-md", isThis ? "text-rvm-ink-accent" : "text-rvm-text")}>
        {e.title}
      </Link>
      <p className="flex items-center gap-1 truncate text-[13px] text-rvm-soft">
        {e.pinned ? <Pin className="h-3.5 w-3.5 shrink-0 fill-rvm-ink-accent text-rvm-ink-accent" aria-label="Épinglé" /> : null}
        <span className="truncate">{e.subtitle}</span>
      </p>
    </div>
  );
}

/**
 * « Écoutés récemment » : un lien vers l'historique du compte, dans chaque vue de
 * la bibliothèque (liste, compacte, grille, rail). La page existe déjà ; seul
 * son accès vit ici depuis que l'accueil « fraîcheur » n'a plus cette rangée.
 */
function HistoryItem({ variant, active }: { variant: "row" | "compact" | "card" | "rail"; active: boolean }) {
  const label = "Écoutés récemment";
  const current = active ? "page" : undefined;
  if (variant === "rail") {
    return (
      <Link href={HISTORY_HREF} aria-label={`${label} — Historique`} title={label} aria-current={current}
        className={cn("block rounded-md p-1.5 hover:bg-rvm-text/[0.07]", active && "bg-rvm-text/10")}>
        <IconTile icon={Clock} className="h-12 w-12 rounded shadow-none" />
      </Link>
    );
  }
  if (variant === "card") {
    return (
      <Link href={HISTORY_HREF} aria-current={current}
        className={cn("block rounded-md p-2.5 transition-colors hover:bg-rvm-text/[0.07]", active && "bg-rvm-text/10")}>
        <IconTile icon={Clock} className="w-full shadow-lg shadow-rvm-deep/40" />
        <span className="mt-2 block truncate text-[15px] font-semibold text-rvm-text">{label}</span>
        <span className="block truncate text-[13px] text-rvm-soft">Historique</span>
      </Link>
    );
  }
  return (
    <Link href={HISTORY_HREF} aria-current={current}
      className={cn("flex items-center gap-3 rounded-md px-2 transition-colors hover:bg-rvm-text/[0.07]",
        variant === "compact" ? "h-9" : "py-1.5", active && "bg-rvm-text/10 hover:bg-rvm-text/[0.13]")}>
      {variant === "row" ? <IconTile icon={Clock} className="h-12 w-12 shrink-0 rounded shadow-none" /> : null}
      {variant === "compact" ? (
        <span className="block min-w-0 flex-1 truncate text-[14px]">
          <span className="font-semibold text-rvm-text">{label}</span>
          <span className="text-rvm-soft"> • Historique</span>
        </span>
      ) : (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-rvm-text">{label}</span>
          <span className="block truncate text-[13px] text-rvm-soft">Historique</span>
        </span>
      )}
    </Link>
  );
}

/** Tri et présentation (menu ancré sous le bouton, comme les menus « … »). */
function SortMenu() {
  const layout = useMusicLayout();
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const ViewIcon = layout.libView === "grid" ? LayoutGrid : layout.libView === "compact" ? Rows3 : List;
  return (
    <>
      <button type="button" onClick={(e) => setAnchor(e.currentTarget)} aria-haspopup="menu" aria-expanded={!!anchor}
        aria-label={`Trier et afficher : ${SORT_LABEL[layout.libSort]}, vue ${VIEW_LABEL[layout.libView].toLowerCase()}`}
        title="Trier et afficher"
        className="ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold text-rvm-soft hover:text-rvm-text">
        {SORT_LABEL[layout.libSort]} <ViewIcon className="h-4 w-4" aria-hidden />
      </button>
      {anchor ? <SortPopover anchor={anchor} onClose={() => { anchor.focus(); setAnchor(null); }} /> : null}
    </>
  );
}

function SortPopover({ anchor, onClose }: { anchor: HTMLElement; onClose: () => void }) {
  const layout = useMusicLayout();
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useLayoutEffect(() => {
    const a = anchor.getBoundingClientRect();
    const w = menu.current?.offsetWidth ?? 220;
    setPos({ left: Math.max(8, Math.min(a.right - w, window.innerWidth - w - 8)), top: a.bottom + 6 });
  }, [anchor]);
  useEffect(() => {
    menu.current?.querySelector<HTMLElement>("[role=menuitemradio]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Tab") { e.preventDefault(); closeRef.current(); return; }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const list = Array.from(menu.current?.querySelectorAll<HTMLElement>("[role=menuitemradio]") ?? []);
      const i = list.indexOf(document.activeElement as HTMLElement);
      list[(i + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length]?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  const item = (checked: boolean, label: string, Icon: typeof Clock, onSelect: () => void) => (
    <button key={label} type="button" role="menuitemradio" aria-checked={checked} tabIndex={-1}
      onClick={() => { onSelect(); closeRef.current(); }}
      className={cn("flex min-h-10 w-full items-center gap-3 px-3 text-left text-sm hover:bg-rvm-text/10 focus:bg-rvm-text/10 focus:outline-none",
        checked ? "text-rvm-ink-accent" : "text-rvm-text")}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="flex-1">{label}</span>
      {checked ? <Check className="h-4 w-4" aria-hidden /> : null}
    </button>
  );
  return createPortal(
    <div className="rvm-scope fixed inset-0 z-[65]" onClick={onClose}>
      <div ref={menu} role="menu" aria-label="Trier et afficher la bibliothèque" onClick={(e) => e.stopPropagation()}
        style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
        className="absolute w-56 rounded-lg border border-rvm-line bg-rvm-raised py-1.5 text-rvm-text shadow-2xl">
        <p className="px-3 pb-1 pt-1.5 text-xs font-bold uppercase tracking-wider text-rvm-soft">Trier par</p>
        {item(layout.libSort === "recent", SORT_LABEL.recent, Clock, () => layout.setLibSort("recent"))}
        {item(layout.libSort === "added", SORT_LABEL.added, Plus, () => layout.setLibSort("added"))}
        {item(layout.libSort === "alpha", SORT_LABEL.alpha, ArrowDownAZ, () => layout.setLibSort("alpha"))}
        <div className="my-1.5 border-t border-rvm-line" />
        <p className="px-3 pb-1 pt-1 text-xs font-bold uppercase tracking-wider text-rvm-soft">Afficher en</p>
        {item(layout.libView === "compact", VIEW_LABEL.compact, Rows3, () => layout.setLibView("compact"))}
        {item(layout.libView === "list", VIEW_LABEL.list, List, () => layout.setLibView("list"))}
        {item(layout.libView === "grid", VIEW_LABEL.grid, LayoutGrid, () => layout.setLibView("grid"))}
      </div>
    </div>,
    document.body,
  );
}

function RowsSkeleton() {
  return (
    <ul aria-hidden className="space-y-1 px-2 pt-1">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="flex items-center gap-3 py-1.5">
          <span className="h-12 w-12 rounded bg-rvm-raised motion-safe:animate-pulse" />
          <span className="flex-1 space-y-2">
            <span className="block h-3 w-2/3 rounded bg-rvm-raised motion-safe:animate-pulse" />
            <span className="block h-3 w-1/3 rounded bg-rvm-raised/70 motion-safe:animate-pulse" />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Sans compte : ce que la bibliothèque contiendra, et la connexion. */
function SignedOut({ path }: { path: string }) {
  return (
    <div className="space-y-3 px-2 pt-1">
      <div className="rounded-lg bg-rvm-raised p-4">
        <p className="font-bold">Créez votre première playlist</p>
        <p className="mt-1 text-sm text-rvm-soft">Connectez-vous : vos playlists, titres likés, albums et artistes suivis vous attendent ici, comme dans l’application.</p>
        <Link href={loginHref(path)} prefetch={false} className="mt-4 inline-flex h-9 items-center rounded-full bg-rvm-text px-4 text-sm font-bold text-rvm-ground hover:scale-105 motion-reduce:hover:scale-100">
          Se connecter
        </Link>
      </div>
    </div>
  );
}

/** Bibliothèque presque vide : de quoi la remplir, sans rien inventer. */
function Starter({ hasPlaylist }: { hasPlaylist: boolean }) {
  const library = useMusicLibrary();
  const button = "mt-4 inline-flex h-9 items-center rounded-full bg-rvm-text px-4 text-sm font-bold text-rvm-ground hover:scale-105 motion-reduce:hover:scale-100";
  if (hasPlaylist) {
    return (
      <div className="mx-2 mt-3 rounded-lg bg-rvm-raised p-4">
        <p className="font-bold">Retrouvez vos albums et vos artistes</p>
        <p className="mt-1 text-sm text-rvm-soft">Enregistrez une sortie avec ⊕ ou suivez un artiste : ils apparaîtront ici, comme dans l’application.</p>
        <Link href="/music/explore" className={button}>Explorer</Link>
      </div>
    );
  }
  return (
    <div className="mx-2 mt-3 rounded-lg bg-rvm-raised p-4">
      <p className="font-bold">Créez votre première playlist</p>
      <p className="mt-1 text-sm text-rvm-soft">Ajoutez-y des titres avec le menu « … » d’un titre. Les albums enregistrés et les artistes suivis apparaissent aussi ici.</p>
      <button type="button" onClick={() => void library.newPlaylist()} className={button}>
        Créer une playlist
      </button>
    </div>
  );
}
