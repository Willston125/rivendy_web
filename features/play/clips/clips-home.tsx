"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MicVocal, Music, Search, SearchX, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { btnPrimary, btnSecondary, display, motion } from "../play-theme";
import { EmptyState, ErrorState, MarketPrompt, useMarketPending } from "../play-ui";
import { ArtistAvatar, ClipTile, FEW_SIZES, VerifiedMark } from "./clips-cards";
import { fetchFollowerCounts } from "./clips-api";
import { FollowButton } from "./clips-follow";
import {
  applyClipFilter, artistsToFollow, availableFilters, clipsHref, filterFromParams, filterLabel, followersLabel,
  resolveFilter, sameFilter, searchClips, type ClipArtist, type ClipCounts, type ClipFilter,
} from "./clips-logic";
import type { PlayTitle } from "../play-logic";
import { ClipsPage, useClipsQueryInput } from "./clips-shell";
import { useClips, useClipsCatalog } from "./clips-store";

/**
 * Accueil de Rivendy Clips (refonte du 2026-10-26) : un titre court, des
 * filtres qui agissent vraiment, puis la grille des miniatures — trois ou
 * quatre colonnes sur ordinateur, une grande carte par ligne sur téléphone —
 * et les artistes à suivre. Filtre et recherche vivent dans l'adresse : le
 * retour depuis un clip retrouve la même grille, au même endroit.
 */

const PAGE = 24;
const SCROLL_KEY = "rivendy_clips_scroll_v1";

type SavedScroll = { key: string; main: number; win: number; shown: number };

function readSaved(key: string): SavedScroll | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(SCROLL_KEY) ?? "null") as SavedScroll | null;
    return v && v.key === key ? v : null;
  } catch { return null; }
}

export function ClipsHomeView() {
  const router = useRouter();
  const params = useSearchParams();
  const { catalog, retry, market } = useClipsCatalog();
  const pending = useMarketPending();
  const { search } = useClips();
  const q = (params.get("q") ?? "").trim();
  const wanted = filterFromParams(params.get("f"), params.get("genre"));
  const pageKey = params.toString();
  // Heure figée pour la page (badges « Nouveau », dates relatives).
  const [now] = useState(() => new Date());
  const [shown, setShown] = useState(() => (typeof window === "undefined" ? PAGE : readSaved(pageKey)?.shown ?? PAGE));

  const ready = catalog.status === "ready" ? catalog : null;
  const filters = useMemo(() => (ready ? availableFilters(ready.clips, ready.counts, now) : [{ kind: "discover" } as ClipFilter]), [ready, now]);
  const active = ready ? resolveFilter(wanted, filters) : wanted;
  const results = useMemo(() => {
    if (!ready) return [];
    return searchClips(applyClipFilter(ready.clips, active, ready.counts, now), ready.artists, q);
  }, [ready, active, q, now]);
  const artists = useMemo(() => (ready && !q && active.kind === "discover" ? artistsToFollow(ready.clips, ready.artists) : []), [ready, q, active]);

  // Nouveau filtre ou nouvelle recherche : on repart de la première page.
  const lastKey = useRef(pageKey);
  useEffect(() => {
    if (lastKey.current === pageKey) return;
    lastKey.current = pageKey;
    setShown(PAGE);
  }, [pageKey]);

  // Position gardée en continu (le retour depuis un clip la retrouve).
  useEffect(() => {
    if (!ready) return;
    const main = document.getElementById("rvp-main");
    let frame = 0;
    const save = () => {
      frame = 0;
      try {
        sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ key: pageKey, main: main?.scrollTop ?? 0, win: window.scrollY, shown } satisfies SavedScroll));
      } catch { /* stockage fermé */ }
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(save); };
    main?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { cancelAnimationFrame(frame); main?.removeEventListener("scroll", onScroll); window.removeEventListener("scroll", onScroll); };
  }, [ready, pageKey, shown]);

  // Retour sur la grille : même position, après la remise en haut de la coque.
  const restored = useRef(false);
  useEffect(() => {
    if (!ready || restored.current) return;
    restored.current = true;
    const saved = readSaved(pageKey);
    if (!saved || (saved.main <= 0 && saved.win <= 0)) return;
    let f2 = 0;
    const f1 = requestAnimationFrame(() => {
      f2 = requestAnimationFrame(() => {
        document.getElementById("rvp-main")?.scrollTo({ top: saved.main });
        window.scrollTo({ top: saved.win });
      });
    });
    return () => { cancelAnimationFrame(f1); cancelAnimationFrame(f2); };
  }, [ready, pageKey]);

  // Chargement progressif : la page suivante quand le bas de la grille approche.
  const sentinel = useRef<HTMLDivElement>(null);
  const more = results.length > shown;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !more || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setShown((n) => n + PAGE);
    }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [more, shown]);

  // Loupe du téléphone : le champ de la page reçoit le focus.
  useEffect(() => {
    if (!search.focusRequested) return;
    search.consumeFocus();
    document.getElementById("clips-recherche")?.focus();
  }, [search]);

  const go = (f: ClipFilter) => router.replace(clipsHref(f, q), { scroll: false });
  const visible = results.slice(0, shown);
  const splitAt = artists.length > 0 ? Math.min(visible.length, 8) : visible.length;

  return (
    <ClipsPage>
      <header className="pb-4 pt-2 md:pt-1">
        {q ? (
          <>
            <h1 className={cn(display, "text-[26px] leading-tight text-rvp-text sm:text-[32px]")}>Résultats pour « {q} »</h1>
            <p className="mt-1 text-[15px] text-rvp-soft">Titres, artistes et genres, avec ou sans accents.</p>
          </>
        ) : (
          <>
            <h1 className={cn(display, "text-[30px] leading-[1.05] text-rvp-text sm:text-[40px] xl:text-[46px]")}>La scène est à vous.</h1>
            <p className="mt-2 text-[15px] text-rvp-soft sm:text-base">Les clips qui font vibrer les îles.</p>
          </>
        )}
      </header>

      <MobileSearch />

      {!market ? (
        pending ? <GridSkeleton /> : <MarketPrompt />
      ) : catalog.status === "error" ? (
        <ErrorState text="Impossible de charger les clips. Vérifiez votre connexion." onRetry={retry} />
      ) : !ready ? (
        <><ChipsSkeleton /><GridSkeleton /></>
      ) : ready.clips.length === 0 ? (
        <EmptyState icon={Music} title="Les premiers clips arrivent" text="Aucun clip n’est encore publié dans votre pays. Les artistes peuvent publier les leurs depuis l’espace artiste.">
          <Link href="/play/clips/artiste" className={btnPrimary}><MicVocal className="h-[18px] w-[18px]" aria-hidden /> Espace artiste</Link>
          <Link href="/play" className={btnSecondary}>Retour à Rivendy Play</Link>
        </EmptyState>
      ) : (
        <>
          {filters.length > 1 ? (
            <div role="group" aria-label="Filtrer les clips" className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
              {filters.map((f) => {
                const on = sameFilter(f, active);
                return (
                  <button key={f.kind === "genre" ? `g:${f.genre}` : f.kind} type="button" aria-pressed={on} onClick={() => go(f)}
                    className={cn("h-10 shrink-0 rounded-full border px-4 text-sm font-semibold", motion,
                      on ? "border-rvp-accent bg-rvp-accent text-rvp-on-accent" : "border-rvp-edge bg-rvp-surface text-rvp-soft hover:border-white/20 hover:text-rvp-text")}>
                    {filterLabel(f)}
                  </button>
                );
              })}
            </div>
          ) : null}

          <p aria-live="polite" className="sr-only">
            {`${results.length} clip${results.length > 1 ? "s" : ""}${q ? ` pour ${q}` : ""}, ${filterLabel(active)}`}
          </p>
          {active.kind === "trending" && !q ? (
            <p className="-mt-2 mb-5 text-[13px] text-rvp-muted">Classement selon le nombre de vues comptées par Rivendy.</p>
          ) : null}

          {results.length === 0 ? (
            <EmptyState icon={SearchX} title={q ? `Aucun clip pour « ${q} »` : "Aucun clip ici pour le moment"}
              text={q ? "Vérifiez l’orthographe, ou essayez le nom d’un artiste ou un genre." : "Essayez un autre filtre."}>
              <Link href={clipsHref({ kind: "discover" })} className={btnSecondary}>Voir tous les clips</Link>
            </EmptyState>
          ) : (
            <>
              <h2 className={cn(display, "mb-4 text-[21px] font-bold text-rvp-text sm:text-[23px]")}>
                {q ? `${results.length} clip${results.length > 1 ? "s" : ""}` : active.kind === "discover" ? "À découvrir" : filterLabel(active)}
              </h2>
              <ClipGrid clips={visible.slice(0, splitAt)} ready={ready} now={now} few={results.length <= 2} />
              {artists.length > 0 ? <ArtistsToFollow artists={artists} /> : null}
              {splitAt < visible.length ? <div className="mt-8"><ClipGrid clips={visible.slice(splitAt)} ready={ready} now={now} /></div> : null}
              {more ? (
                <div ref={sentinel} className="mt-8 flex justify-center">
                  <button type="button" onClick={() => setShown((n) => n + PAGE)} className={btnSecondary}>Afficher plus de clips</button>
                </div>
              ) : null}
            </>
          )}
        </>
      )}
    </ClipsPage>
  );
}

/** Grille : 1 à 4 colonnes selon la place ; avec un ou deux clips, deux grandes colonnes au plus (pas une petite carte perdue). */
function ClipGrid({ clips, ready, now, few }: {
  clips: PlayTitle[]; ready: { artists: Record<string, ClipArtist>; counts: Record<string, ClipCounts> }; now: Date; few?: boolean;
}) {
  return (
    <ul className={cn("grid grid-cols-1 gap-x-4 gap-y-7 @min-[34rem]:grid-cols-2 @min-[52rem]:gap-x-5",
      few ? "@min-[90rem]:max-w-[1200px]" : "@min-[52rem]:grid-cols-3 @min-[78rem]:grid-cols-4")}>
      {clips.map((c, i) => (
        <li key={c.id}><ClipTile clip={c} artists={ready.artists} counts={ready.counts[c.id]} now={now} eager={i < 3} sizes={few ? FEW_SIZES : undefined} /></li>
      ))}
    </ul>
  );
}

/** Téléphone : le champ de recherche de la page (la barre du haut n'a que la loupe). */
function MobileSearch() {
  const { value, setValue } = useClipsQueryInput();
  return (
    <form role="search" onSubmit={(e) => { e.preventDefault(); (document.activeElement as HTMLElement | null)?.blur(); }} className="relative mb-5 md:hidden">
      <label htmlFor="clips-recherche" className="sr-only">Rechercher un clip, un artiste</label>
      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-rvp-muted" aria-hidden />
      <input id="clips-recherche" type="search" value={value} onChange={(e) => setValue(e.target.value)} maxLength={60}
        enterKeyHint="search" autoComplete="off" placeholder="Rechercher un clip, un artiste…"
        className="h-12 w-full rounded-full border border-rvp-edge bg-rvp-surface pl-12 pr-12 text-base text-rvp-text placeholder:text-rvp-muted focus:border-rvp-accent focus:outline-none [&::-webkit-search-cancel-button]:hidden" />
      {value ? (
        <button type="button" onClick={() => setValue("")} aria-label="Effacer la recherche"
          className="absolute right-1.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-rvp-soft hover:bg-white/10">
          <X className="h-5 w-5" aria-hidden />
        </button>
      ) : null}
    </form>
  );
}

/** « Des artistes à suivre » : de vrais profils validés, avec leurs clips ici. */
function ArtistsToFollow({ artists }: { artists: ClipArtist[] }) {
  const [followers, setFollowers] = useState<Record<string, number>>({});
  const ids = artists.map((a) => a.user_id ?? "").join(",");
  useEffect(() => {
    let alive = true;
    void fetchFollowerCounts(ids.split(",")).then((m) => { if (alive) setFollowers(m); });
    return () => { alive = false; };
  }, [ids]);

  return (
    <section aria-labelledby="clips-artistes" className="mt-10 border-t border-rvp-line pt-7">
      <h2 id="clips-artistes" className={cn(display, "text-[21px] font-bold text-rvp-text sm:text-[23px]")}>Des artistes à suivre</h2>
      <ul className="no-scrollbar -mx-4 mt-5 flex gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {artists.map((a) => {
          const count = a.user_id ? followersLabel(followers[a.user_id] ?? 0) : "";
          return (
            <li key={a.id} className="flex w-36 shrink-0 flex-col items-center text-center">
              <Link href={`/artist/${a.id}`} prefetch={false} className="group flex flex-col items-center rounded-rvp">
                <span className="relative">
                  <ArtistAvatar artist={a} name={a.name} className={cn("h-24 w-24 text-[28px] ring-2 ring-transparent group-hover:ring-rvp-accent", motion)} />
                  <span className="absolute bottom-0.5 right-0.5 grid h-6 w-6 place-items-center rounded-full bg-rvp-ground">
                    <VerifiedMark />
                  </span>
                </span>
                <span className="mt-2.5 line-clamp-1 text-[15px] font-semibold text-rvp-text group-hover:text-rvp-accent">{a.name}</span>
              </Link>
              <span className="min-h-[18px] text-[12.5px] text-rvp-muted">{count || a.genre || ""}</span>
              <FollowButton userId={a.user_id} name={a.name} size="sm" className="mt-2" />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ChipsSkeleton() {
  return (
    <div aria-hidden className="mb-6 flex gap-2 overflow-hidden">
      {[112, 120, 104, 80, 96].map((w, i) => <span key={i} className="rvp-skeleton h-10 shrink-0 rounded-full" style={{ width: w }} />)}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div role="status">
    <span className="sr-only">Chargement des clips…</span>
    <ul aria-hidden className="grid grid-cols-1 gap-x-4 gap-y-7 @min-[34rem]:grid-cols-2 @min-[52rem]:grid-cols-3 @min-[52rem]:gap-x-5 @min-[78rem]:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <li key={i}>
          <div className="rvp-skeleton aspect-video rounded-rvp" />
          <div className="mt-3 flex gap-3">
            <div className="rvp-skeleton h-9 w-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2"><div className="rvp-skeleton h-4 w-4/5 rounded" /><div className="rvp-skeleton h-3.5 w-1/2 rounded" /></div>
          </div>
        </li>
      ))}
    </ul>
    </div>
  );
}
