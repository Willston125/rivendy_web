"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight, AudioLines, ChartColumn, ChevronRight, Headphones, Lock, MicVocal, Search, Share2, Smartphone, Sparkles, Sun, Trophy, X,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useHomeMarket } from "@/features/media/use-home-market";
import { appIntentUrl } from "@/features/play/play-link-page";
import { cn } from "@/lib/utils/cn";
import type { Advertisement } from "@/types/rivendy";
import { fetchMusicBanners, useMusicPlus } from "./music-ads";
import {
  fetchArtistTopTracks, fetchArtistsByIds, fetchArtistsWithMusic, fetchFeatured, fetchFollowedArtists, fetchGenres,
  fetchHistory, fetchHit, fetchNewReleases, fetchRelease, fetchReleasesByArtist, fetchTracksByIds, searchMusic,
  type MusicArtist, type MusicGenre, type SearchRow,
} from "./music-api";
import { CollectionPage, IconTile, MetaLine, useCoverTint } from "./music-collection";
import { useMusicLibrary } from "./music-library";
import { MusicAdBanner, SelectionHero, SelectionHeroSkeleton } from "./music-home-hero";
import {
  HOME_GRID, HOME_HIT, HOME_SHOWS, artistName, availableGenres, distinctArtistIds, filterByGenre, genreTone, hitMovement,
  releaseKindLabel, releaseYear, rythmeTagline, searchable, totalDurationLabel, uniqueReleases, usefulRubrics,
  type HomeRubric, type MusicRelease, type MusicTrack,
} from "./music-logic";
import { MusicInstallHint } from "./music-install-hint";
import { loginHref } from "./music-pending";
import {
  ArtistCard, ArtistFollowCard, CardRow, CardRowSkeleton, Cover, CoverGridSkeleton, EmptyState, ErrorState, ExplicitTag,
  FollowArtistButton, ListSkeleton, PageTitle, PlayAllButton, PremiumTag, ReleaseGrid, ReleaseShelf, ReleaseWideCard,
  SaveReleaseButton, Section, ShuffleButton, TrackList, iconButton, primaryButton, toQueue, useLoad, useSearchDraft,
} from "./music-ui";
import { useMusicPlayer, type QueueItem } from "./player/music-player-provider";

export { FavoritesView, HistoryView, LibraryView, PlaylistView } from "./music-library-views";

/** Marché d'écoute : marché d'origine du compte, sinon le pays choisi (comme l'app). */
export const useMusicMarket = useHomeMarket;

/** Comparaison tolérante aux accents et à la casse (filtres locaux). */
function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** Teinte du Rivendy Hit : un vert profond dérivé de --rv-primary (texte blanc lisible). */
const HIT_TINT: [number, number, number] = [10, 74, 66];

// ── Accueil ────────────────────────────────────────────────────────────────

/** Filtres « Nouveautés » et « Ambiances » de l'accueil : une seule rubrique, sur place. */
type HomeFocus = "new" | "moods" | null;
/** Carte « À chaque envie, son rythme » : un vrai genre, ou les nouveautés. */
type RythmeTile = { key: string; name: string; href: string; tagline: string; fresh?: boolean };
/** Carte qui complète la rangée des nouveautés : un genre ou le Hit, de vraies pages. */
type HomeFiller = { kind: "genre"; id: string; name: string; tone: string } | { kind: "hit" };

/**
 * Accueil de la Musique, style « fraîcheur » (2026-10-29, 2e référence du
 * propriétaire) puis réglages du même jour (sa maquette et sa vidéo) :
 * « Bonjour » et un soleil, la bannière « La sélection Rivendy », les
 * filtres (tous restent sur la page), quatre grandes nouveautés, le
 * Rivendy Hit et « À chaque envie, son rythme » côte à côte, puis l'affiche
 * sponsorisée (jamais pour un abonné Rivendy+) et les artistes à
 * découvrir. Le lecteur n'est jamais vide : le dernier titre écouté (ou le
 * n° 1 du Hit) y est prêt, sans démarrer seul. Tout suit le catalogue
 * réel : rien n'est inventé pour remplir.
 */
export function MusicHomeView() {
  const market = useMusicMarket();
  const { user, profile, loading: authLoading } = useAuth();
  const plus = useMusicPlus();
  const player = useMusicPlayer();
  const [genre, setGenre] = useState<string | null>(null);
  const [focus, setFocus] = useState<HomeFocus>(null);

  const home = useLoad(`home:${market ?? ""}`, async () => {
    const [featured, fresh, hit, genres] = await Promise.all([
      fetchFeatured(market), fetchNewReleases(market, 48), fetchHit("all", "", market),
      fetchGenres().catch(() => [] as MusicGenre[]),
    ]);
    const all = uniqueReleases([featured, fresh]);
    const artists = await fetchArtistsByIds(distinctArtistIds(all).slice(0, 18)).catch(() => [] as MusicArtist[]);
    return { featured, fresh, hit, genres, artists, all };
  });
  // Une affiche au hasard parmi celles en ligne, et seulement sans Rivendy+ (statut lu, jamais deviné).
  const banner = useLoad(plus.ready && !plus.active && market ? `music-ad:${market}` : null, async () => {
    const ads = await fetchMusicBanners(market);
    return ads.length ? ads[Math.floor(Math.random() * ads.length)] : null;
  });
  const ad = plus.ready && !plus.active ? banner.data : null;

  const data = home.data;
  const genres = useMemo(() => (data ? availableGenres(data.all, data.genres) : []), [data]);
  const fresh = useMemo(() => (data ? filterByGenre(data.fresh, genre) : []), [data, genre]);
  const hit = useMemo(() => {
    const rows = (data?.hit ?? []).filter((h) => !genre || h.music_tracks?.music_releases?.genre_id === genre);
    const items = toQueue(rows.map((h) => h.music_tracks).filter((t): t is MusicTrack => !!t)).slice(0, HOME_HIT);
    // L'accueil montre le rang seul ; l'évolution reste sur la page du Hit.
    const ranks = new Map(rows.map((h) => [h.music_tracks?.id ?? "", { rank: h.rank, move: "" }]));
    return { items, ranks };
  }, [data, genre]);
  const artists = useMemo(() => (!data ? [] : genre
    ? data.artists.filter((a) => data.all.some((r) => r.genre_id === genre && r.artist_id === a.id))
    : data.artists), [data, genre]);
  // La sélection du dashboard ; sans sélection, les dernières sorties.
  const selection = data ? (data.featured.length > 0 ? data.featured : data.fresh.slice(0, 3)) : [];
  // Cartes « rythme » : les vrais genres et une phrase d'envie (pas un nombre, qui fait paraître
  // le catalogue vide) ; moins de trois genres : les nouveautés complètent.
  const allTiles = useMemo<RythmeTile[]>(() => {
    const list: RythmeTile[] = genres.map((g) => ({
      key: g.id, name: g.name, href: `/music/explore?genre=${encodeURIComponent(g.id)}`, tagline: rythmeTagline(g.name),
    }));
    if (list.length < 3 && (data?.all.length ?? 0) > 0) {
      list.push({ key: "new", name: "Nouveautés", href: "/music/explore", tagline: "Les dernières sorties à écouter.", fresh: true });
    }
    return list;
  }, [data, genres]);
  // Rangée des nouveautés incomplète : un genre (« La sélection Rivendy »), puis le Hit.
  const fillers = useMemo<HomeFiller[]>(() => [
    ...(genre ? [] : genres.map((g, k) => ({ kind: "genre" as const, id: g.id, name: g.name, tone: genreTone(k) }))),
    ...((data?.hit.length ?? 0) > 0 ? [{ kind: "hit" as const }] : []),
  ], [data, genre, genres]);
  // « Tout voir » des artistes seulement vers une page qui montre plus que l'accueil.
  const rubrics = data ? usefulRubrics({ hitTracks: data.hit.length, releases: data.all.length, artists: data.artists.length, clips: 0 }) : [];
  const firstName = (profile?.full_name || "").trim().split(/\s+/)[0] || "";

  // Les cinq filtres se comportent pareil : ils trient l'accueil sur place, aucun ne quitte la page.
  const chips = [
    { key: "all", label: "Pour toi", on: !genre && !focus, pick: () => { setGenre(null); setFocus(null); } },
    ...genres.map((g) => ({ key: g.id, label: g.name, on: genre === g.id, pick: () => { setGenre(g.id); setFocus(null); } })),
    ...((data?.all.length ?? 0) > 0 ? [{ key: "new", label: "Nouveautés", on: focus === "new", pick: () => { setGenre(null); setFocus("new"); } }] : []),
    ...(allTiles.length >= 2 ? [{ key: "moods", label: "Ambiances", on: focus === "moods", pick: () => { setGenre(null); setFocus("moods"); } }] : []),
  ];

  // Lecteur jamais vide (réglages du 2026-10-29) : sans file chargée, le dernier titre écouté
  // (compte) ou le n° 1 du Hit y est prêt. Rien ne démarre seul : un clic sur lecture.
  const { prepare } = player;
  const hasCurrent = !!player.current;
  useEffect(() => {
    if (!data || authLoading || hasCurrent) return;
    let alive = true;
    void (async () => {
      if (user) {
        const recent = await fetchHistory(20).catch(() => []);
        if (!alive) return;
        const items = toQueue(recent.map((h) => h.track));
        if (items.length > 0) {
          prepare(items, { source: { label: "Écoutés récemment", href: "/music/history" }, hint: "Reprendre l’écoute" });
          return;
        }
      }
      const top = toQueue(data.hit.map((h) => h.music_tracks).filter((t): t is MusicTrack => !!t));
      if (alive && top.length > 0) prepare(top, { source: { label: "Rivendy Hit", href: "/music/hit" }, hint: "N° 1 du Rivendy Hit" });
    })();
    return () => { alive = false; };
  }, [authLoading, data, hasCurrent, prepare, user]);

  return (
    <div className="px-4 pb-4 pt-4 @2xl:px-8 @2xl:pt-5">
      <h1 className="sr-only">Rivendy Musique</h1>
      <MusicInstallHint />
      <p className="flex items-center gap-2 font-rvm-display text-xl font-extrabold text-rvm-text @2xl:text-[22px]">
        {firstName ? `Bonjour ${firstName}` : "Bonjour"}
        <Sun className="h-6 w-6 text-rvm-sun @2xl:h-7 @2xl:w-7" aria-hidden />
      </p>
      {home.error ? (
        <div className="mt-5"><ErrorState onRetry={home.reload} /></div>
      ) : !data ? (
        <>
          <div className="mt-3"><SelectionHeroSkeleton /></div>
          <div className="mt-8"><CoverGridSkeleton /></div>
        </>
      ) : data.all.length === 0 && data.hit.length === 0 ? (
        <div className="mt-5">
          <EmptyState title="Les premiers titres arrivent bientôt"
            text="Singles, EP et albums des artistes de l’archipel et d’ailleurs. Chaque sortie est validée par Rivendy avant d’être publiée." />
        </div>
      ) : (
        <>
          <div className="mt-3"><SelectionHero releases={selection} /></div>
          <div role="group" aria-label="Filtrer l’accueil" className="no-scrollbar -mx-4 mt-4 flex gap-2.5 overflow-x-auto px-4 @2xl:mx-0 @2xl:flex-wrap @2xl:px-0">
            {chips.map((c) => (
              <button key={c.key} type="button" onClick={c.pick} aria-pressed={c.on}
                className={cn("h-9 shrink-0 rounded-full px-5 text-sm font-semibold transition-colors",
                  c.on ? "bg-rvm-deep text-white" : "bg-rvm-raised text-rvm-on-accent hover:bg-rvm-raised-hover")}>
                {c.label}
              </button>
            ))}
          </div>
          {!user && !authLoading ? <div className="mt-6"><VisitorWelcome /></div> : null}
          <HomeSections fresh={fresh} genreName={genres.find((g) => g.id === genre)?.name} hit={hit}
            tiles={genre ? [] : focus === "moods" ? allTiles : allTiles.slice(0, 3)} fillers={fillers}
            artists={artists} rubrics={rubrics} genre={genre} focus={focus} ad={ad} />
        </>
      )}
    </div>
  );
}

/**
 * Visiteur : ce qu'est l'espace, et pourquoi se connecter (écouter, liker,
 * ranger). Pas de promesse au-delà de ce que le site fait.
 */
function VisitorWelcome() {
  const pathname = usePathname() || "/music";
  return (
    <section aria-labelledby="rvm-welcome" className="flex flex-col gap-3 rounded-2xl bg-rvm-surface p-4 shadow-[0_10px_30px_rgb(10_74_68/0.07)] @xl:flex-row @xl:items-center @xl:gap-6">
      <div className="min-w-0 flex-1">
        <h2 id="rvm-welcome" className="font-rvm-display text-lg font-black">Bienvenue sur Rivendy Musique</h2>
        <p className="mt-1 text-sm leading-relaxed text-rvm-soft">
          Les sorties validées par Rivendy et le Rivendy Hit de la semaine. Connectez-vous pour écouter, liker des titres
          et créer vos playlists : le compte est gratuit.
        </p>
      </div>
      <Link href={loginHref(pathname)} prefetch={false} className={cn(primaryButton, "shrink-0 self-start @xl:self-center")}>Se connecter</Link>
    </section>
  );
}

/** Pastels des « rythmes » (référence) : jetons --rvm-rythme-* de site.css. */
const RYTHME_TONES = [1, 2, 3].map((n) => ({ bg: `var(--rvm-rythme-${n}-bg)`, fg: `var(--rvm-rythme-${n}-fg)` }));

function HomeSections({ fresh, genreName, hit, tiles, fillers, artists, rubrics, genre, focus, ad }: {
  /** Nouveautés (filtrées par le genre choisi). */
  fresh: MusicRelease[];
  genreName?: string;
  hit: { items: QueueItem[]; ranks: Map<string, { rank: number; move: string }> };
  /** Cartes « rythme » : pas quand un genre est déjà choisi. */
  tiles: RythmeTile[];
  /** De quoi compléter la rangée des nouveautés si elle a moins de quatre sorties. */
  fillers: HomeFiller[];
  artists: MusicArtist[];
  /** Rubriques qui montrent plus que l'accueil : sinon, pas de « Tout voir » des artistes. */
  rubrics: HomeRubric[];
  genre: string | null;
  /** « Nouveautés » ou « Ambiances » : cette rubrique seule. */
  focus: HomeFocus;
  ad: Advertisement | null;
}) {
  const explore = genre ? `/music/explore?genre=${genre}` : "/music/explore";
  const shown = fresh.slice(0, focus === "new" ? HOME_SHOWS.releases : HOME_GRID);
  const fill = focus || shown.length === 0 ? [] : fillers.slice(0, Math.max(0, HOME_GRID - shown.length));
  const showHit = !focus && hit.items.length > 0;
  const showTiles = focus !== "new" && tiles.length >= 2;
  const pair = showHit && showTiles;
  const cell = "w-[44%] shrink-0 snap-start @md:w-[30%] @2xl:w-auto";
  return (
    <>
      {focus !== "moods" ? (
        <Section title="Les nouveautés" href={explore}>
          {shown.length > 0 ? (
            <ul aria-label="Les nouveautés"
              className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-1 @2xl:mx-0 @2xl:grid @2xl:grid-cols-4 @2xl:gap-5 @2xl:overflow-visible @2xl:px-0">
              {shown.map((r, i) => <li key={r.id} className={cell}><ReleaseWideCard release={r} priority={i < 2} /></li>)}
              {fill.map((f) => <li key={f.kind === "hit" ? "hit" : f.id} className={cell}><FillerCard filler={f} /></li>)}
            </ul>
          ) : (
            <EmptyState title={genreName ? `Pas encore de sortie ${genreName}` : "Pas encore de sortie"} text="Revenez bientôt : les sorties arrivent chaque semaine." />
          )}
        </Section>
      ) : null}

      {showHit || showTiles ? (
        <div className={cn("mt-8 grid gap-6", pair && "@4xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]")}>
          {showHit ? (
            <section aria-labelledby="rvm-hit" className="min-w-0 rounded-3xl bg-rvm-surface p-3 shadow-[0_10px_30px_rgb(10_74_68/0.08)] @2xl:p-4">
              <div className="mb-1 px-2 pt-1">
                <h2 id="rvm-hit" className="font-rvm-display text-xl font-extrabold tracking-tight">
                  <Link href="/music/hit" className="inline-flex items-center gap-1 rounded-md hover:underline">
                    Le Hit Rivendy <ChevronRight className="h-5 w-5" aria-hidden />
                  </Link>
                </h2>
                <p className="text-[13px] text-rvm-muted">Les titres du moment</p>
              </div>
              <TrackList items={hit.items} ranks={hit.ranks} label="Le Hit Rivendy" source={{ label: "Rivendy Hit", href: "/music/hit" }}
                showHeader={false} showAlbum={false} quietMenu />
            </section>
          ) : null}
          {showTiles ? (
            <section aria-labelledby="rvm-rythmes-title" className="min-w-0 rounded-3xl bg-rvm-surface p-4 shadow-[0_10px_30px_rgb(10_74_68/0.08)]">
              <h2 id="rvm-rythmes-title" className="mb-3 px-1 font-rvm-display text-xl font-extrabold tracking-tight">À chaque envie, son rythme</h2>
              <ul className={cn("grid gap-3", tiles.length === 2 ? "grid-cols-2" : tiles.length === 3 ? "grid-cols-3" : "grid-cols-2 @xl:grid-cols-3 @3xl:grid-cols-4")}>
                {tiles.map((g, k) => {
                  const tone = RYTHME_TONES[k % RYTHME_TONES.length];
                  return (
                    <li key={g.key}>
                      <Link href={g.href} style={{ backgroundColor: tone.bg }}
                        className="flex h-full flex-col items-center rounded-2xl px-2 pb-3 pt-4 text-center text-rvm-text transition hover:brightness-[0.97]">
                        <RythmeIcon index={k} fresh={g.fresh} color={tone.fg} />
                        <span className="mt-2 max-w-full truncate font-rvm-display text-lg font-extrabold">{g.name}</span>
                        {/* La phrase prend la place libre : les flèches restent alignées d'une carte à l'autre. */}
                        <span className="mt-0.5 flex-1 text-[12.5px] leading-snug text-rvm-soft">{g.tagline}</span>
                        <span aria-hidden className="mt-3 grid h-8 w-8 place-items-center rounded-full bg-rvm-deep text-white">
                          <ArrowRight className="h-4 w-4" />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      {!focus && ad ? <div className="mt-8"><MusicAdBanner ad={ad} className="max-w-4xl" /></div> : null}

      {!focus && artists.length > 0 ? (
        <Section title="Artistes à découvrir" href={rubrics.includes("artists") || artists.length > HOME_SHOWS.artists ? "/music/artists" : undefined}>
          <ul aria-label="Artistes à découvrir" className="grid grid-cols-2 gap-x-4 gap-y-6 @xl:grid-cols-3 @3xl:grid-cols-4 @5xl:grid-cols-6">
            {artists.slice(0, HOME_SHOWS.artists).map((a) => <li key={a.id} className="min-w-0"><ArtistFollowCard artist={a} /></li>)}
          </ul>
        </Section>
      ) : null}
    </>
  );
}

/**
 * Carte qui complète la rangée des nouveautés (moins de quatre sorties) :
 * un genre, « La sélection Rivendy », dans sa couleur de l'Explorer, ou le
 * Rivendy Hit en vert lagon — de vraies pages, jamais un vide.
 */
function FillerCard({ filler }: { filler: HomeFiller }) {
  const isHit = filler.kind === "hit";
  const href = isHit ? "/music/hit" : `/music/explore?genre=${encodeURIComponent(filler.id)}`;
  const title = isHit ? "Le Hit Rivendy" : filler.name;
  return (
    <Link href={href} className="group block min-w-0 rounded-2xl">
      <span style={isHit ? undefined : { backgroundColor: filler.tone }}
        className={cn("relative flex aspect-[16/10] flex-col justify-end overflow-hidden rounded-2xl p-4 text-white shadow-lg shadow-rvm-deep/20 transition duration-300 motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:shadow-xl",
          isHit && "bg-gradient-to-br from-rvm-deep-2 to-rvm-deep")}>
        <span aria-hidden className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
        {isHit
          ? <ChartColumn className="absolute right-4 top-4 h-8 w-8 text-rvm-accent" aria-hidden />
          : <AudioLines className="absolute right-4 top-4 h-8 w-8 text-white/85" aria-hidden />}
        <span className="relative text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/90">{isHit ? "Classement" : "La sélection Rivendy"}</span>
        <span className="relative mt-1 max-w-[80%] truncate font-rvm-display text-2xl font-black leading-tight">{title}</span>
        <span aria-hidden className="absolute bottom-3 right-3 grid h-11 w-11 place-items-center rounded-full bg-rvm-accent text-rvm-on-accent shadow-xl shadow-black/30">
          <ArrowRight className="h-5 w-5" />
        </span>
      </span>
      <span className="mt-2.5 block truncate text-[15px] font-semibold text-rvm-text">{title}</span>
      <span className="block truncate text-[13px] text-rvm-soft">{isHit ? "Les titres du moment" : "La sélection Rivendy"}</span>
    </Link>
  );
}

/** Icônes des cartes de rythme : barres qui dansent, micro, casque ; étincelles pour les nouveautés (décor). */
function RythmeIcon({ index, fresh = false, color }: { index: number; fresh?: boolean; color: string }) {
  if (fresh) return <Sparkles aria-hidden className="h-9 w-9" style={{ color }} strokeWidth={2.2} />;
  if (index % 3 === 0) {
    return (
      <svg aria-hidden width="38" height="32" viewBox="0 0 40 34" style={{ color }}>
        <rect x="2" y="16" width="5" height="16" rx="2.5" fill="currentColor" />
        <rect x="10" y="8" width="5" height="24" rx="2.5" fill="currentColor" fillOpacity={0.6} />
        <rect x="18" y="2" width="5" height="30" rx="2.5" fill="currentColor" />
        <rect x="26" y="10" width="5" height="22" rx="2.5" fill="currentColor" fillOpacity={0.45} />
        <rect x="34" y="18" width="5" height="14" rx="2.5" fill="currentColor" />
      </svg>
    );
  }
  const Icon = index % 3 === 1 ? MicVocal : Headphones;
  return <Icon aria-hidden className="h-9 w-9" style={{ color }} strokeWidth={2.2} />;
}

// ── Explorer : recherche, genres, toutes les sorties ───────────────────────

/**
 * Recherche et genres. L'adresse fait foi (?q=, ?genre=) : la recherche de
 * la barre du haut l'écrit ; sur téléphone, le champ de cette page aussi.
 */
export function ExploreView() {
  const params = useSearchParams();
  const router = useRouter();
  const market = useMusicMarket();
  const genre = params.get("genre");
  const query = (params.get("q") ?? "").trim();

  const search = useLoad(searchable(query) ? `s:${query}` : null, async () => {
    const rows = await searchMusic(query);
    const tracks = await fetchTracksByIds(rows.filter((r) => r.kind === "track").map((r) => r.id));
    return { rows, tracks };
  });
  const catalog = useLoad(`cat:${market ?? ""}`, async () => {
    const [genres, releases] = await Promise.all([fetchGenres(), fetchNewReleases(market, 200)]);
    return { genres: availableGenres(releases, genres), releases };
  });
  const byGenre = useLoad(genre ? `g:${market ?? ""}:${genre}` : null, () => fetchNewReleases(market, 120, genre));

  const setGenre = (g: string | null) => {
    const sp = new URLSearchParams(window.location.search);
    if (g) sp.set("genre", g); else sp.delete("genre");
    router.replace(`/music/explore${sp.toString() ? `?${sp}` : ""}`, { scroll: false });
  };

  const genreName = catalog.data?.genres.find((g) => g.id === genre)?.name ?? null;
  const releases = genre ? byGenre.data : catalog.data?.releases ?? null;

  return (
    <div className="px-4 pb-4 pt-5 @2xl:px-6">
      <PageTitle title={searchable(query) ? `Résultats pour « ${query} »` : "Explorer"}
        subtitle={searchable(query) ? undefined : "Parcourez les genres, ou cherchez un titre, un artiste, un album."} />
      <MobileSearch query={query} />

      {searchable(query) ? (
        <div aria-live="polite">
          {search.error ? <div className="mt-6"><ErrorState onRetry={search.reload} /></div>
            : !search.data ? <div className="mt-6"><ListSkeleton /></div>
            : search.data.rows.length === 0 ? (
              <div className="mt-6"><EmptyState icon={Search} title={`Aucun résultat pour « ${query} »`} text="Vérifiez l’orthographe ou essayez un autre mot." /></div>
            ) : <SearchResults rows={search.data.rows} tracks={search.data.tracks} query={query} />}
        </div>
      ) : (
        <>
          {query.length === 1 ? <p className="mt-3 text-sm text-rvm-soft">Tapez au moins 2 caractères.</p> : null}
          <Section title="Genres">
            {catalog.error ? <ErrorState onRetry={catalog.reload} />
              : !catalog.data ? (
                <div aria-hidden className="grid grid-cols-2 gap-3 @lg:grid-cols-3 @3xl:grid-cols-4 @5xl:grid-cols-5">
                  {Array.from({ length: 5 }, (_, k) => <div key={k} className="h-24 rounded-lg bg-rvm-raised motion-safe:animate-pulse" />)}
                </div>
              ) : catalog.data.genres.length === 0 ? <p className="text-sm text-rvm-soft">Les genres apparaîtront avec les premières sorties.</p>
              : (
                <div role="group" aria-label="Genres" className="grid grid-cols-2 gap-3 @lg:grid-cols-3 @3xl:grid-cols-4 @5xl:grid-cols-5">
                  {catalog.data.genres.map((g, k) => {
                    const active = genre === g.id;
                    return (
                      <button key={g.id} type="button" aria-pressed={active} onClick={() => setGenre(active ? null : g.id)}
                        className={cn("relative h-24 overflow-hidden rounded-lg p-4 text-left transition",
                          active ? "bg-rvm-deep ring-2 ring-rvm-ink-accent" : "hover:brightness-110")} style={active ? undefined : { backgroundColor: genreTone(k) }}>
                        <span className="relative block text-lg font-black text-white">{g.name}</span>
                        <AudioLines className={cn("absolute bottom-3 right-3 h-6 w-6", active ? "text-rvm-accent" : "text-white/60")} aria-hidden />
                      </button>
                    );
                  })}
                </div>
              )}
          </Section>

          <Section title={genreName ? `Sorties · ${genreName}` : "Toutes les sorties"} subtitle={genreName ? undefined : "Des plus récentes aux plus anciennes."}>
            {(genre ? byGenre.error : catalog.error) ? <ErrorState onRetry={genre ? byGenre.reload : catalog.reload} />
              : releases === null ? <CardRowSkeleton count={5} />
              : <ReleaseGrid releases={releases} empty={genreName ? `Pas encore de sortie ${genreName}.` : "Les premières sorties arrivent bientôt."} />}
          </Section>
        </>
      )}
    </div>
  );
}

/** Téléphone : la barre du haut n'a qu'une loupe ; le champ de recherche est ici. */
function MobileSearch({ query }: { query: string }) {
  const router = useRouter();
  const [q, setQ] = useSearchDraft(query, (v) => {
    const sp = new URLSearchParams(window.location.search);
    if (v) sp.set("q", v); else sp.delete("q");
    router.replace(`/music/explore${sp.toString() ? `?${sp}` : ""}`, { scroll: false });
  });
  return (
    <form role="search" aria-label="Rechercher de la musique" onSubmit={(e) => e.preventDefault()}
      className="mt-4 flex h-12 items-center gap-2 rounded-md bg-rvm-text px-3 text-rvm-ground md:hidden">
      <Search className="h-5 w-5 shrink-0" aria-hidden />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Que souhaitez-vous écouter ?"
        aria-label="Que souhaitez-vous écouter ?" enterKeyHint="search"
        className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-rvm-ground placeholder:text-rvm-ground/60 focus:outline-none focus-visible:outline-none" />
      {q ? (
        <button type="button" onClick={() => setQ("")} aria-label="Effacer la recherche" className="grid h-9 w-9 place-items-center rounded-full">
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </form>
  );
}

function SearchResults({ rows, tracks, query }: { rows: SearchRow[]; tracks: MusicTrack[]; query: string }) {
  const artists = rows.filter((r) => r.kind === "artist");
  const releases = rows.filter((r) => r.kind === "release");
  const podcasts = rows.filter((r) => r.kind === "podcast");
  const queue = toQueue(tracks);
  const tile = (r: SearchRow, href: string, round = false) => (
    <li key={`${r.kind}-${r.id}`}>
      <Link href={href} className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-rvm-text/[0.07]">
        <Cover url={r.cover_url} size={160} alt="" className="h-14 w-14 shrink-0" rounded={round ? "rounded-full" : "rounded"} />
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold">{r.title}</span>
          {r.subtitle ? <span className="block truncate text-[13px] text-rvm-soft">{r.subtitle}</span> : null}
        </span>
      </Link>
    </li>
  );
  return (
    <>
      {queue.length > 0 ? (
        <Section title="Titres">
          <TrackList items={queue} label="Titres trouvés" source={{ label: `Recherche « ${query} »`, href: `/music/explore?q=${encodeURIComponent(query)}` }} />
        </Section>
      ) : null}
      {artists.length > 0 ? (
        <Section title="Artistes"><ul className="grid gap-1 @xl:grid-cols-2 @4xl:grid-cols-3">{artists.map((r) => tile(r, `/artist/${r.id}`, true))}</ul></Section>
      ) : null}
      {releases.length > 0 ? (
        <Section title="Albums et singles"><ul className="grid gap-1 @xl:grid-cols-2 @4xl:grid-cols-3">{releases.map((r) => tile(r, `/music/album/${r.id}`))}</ul></Section>
      ) : null}
      {podcasts.length > 0 ? (
        <Section title="Podcasts"><ul className="grid gap-1 @xl:grid-cols-2 @4xl:grid-cols-3">{podcasts.map((r) => tile(r, `/musique/podcast/${r.id}`))}</ul></Section>
      ) : null}
    </>
  );
}

// ── Artistes ───────────────────────────────────────────────────────────────

export function ArtistsView() {
  const market = useMusicMarket();
  const { user } = useAuth();
  const [filter, setFilter] = useState("");
  const all = useLoad(`artists:${market ?? ""}`, () => fetchArtistsWithMusic(market));
  const followed = useLoad(user ? `followed:${user.id}` : null, () => fetchFollowedArtists());
  const f = fold(filter);
  const shown = (all.data ?? []).filter((a) => !f || fold(a.name).includes(f) || fold(a.genre ?? "").includes(f));

  return (
    <div className="px-4 pb-4 pt-5 @2xl:px-6">
      <PageTitle title="Artistes" subtitle="Les artistes qui ont de la musique à écouter sur Rivendy."
        aside={(all.data?.length ?? 0) > 8 ? (
          <label className="flex h-10 w-full max-w-xs items-center gap-2 rounded-full bg-rvm-raised px-3 focus-within:ring-2 focus-within:ring-rvm-ink-accent @lg:w-64">
            <Search className="h-4 w-4 text-rvm-soft" aria-hidden />
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrer les artistes" aria-label="Filtrer les artistes"
              className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-rvm-soft focus:outline-none focus-visible:outline-none" />
          </label>
        ) : undefined} />
      {followed.data && followed.data.length > 0 && !f ? (
        <Section title="Vos artistes suivis">
          <CardRow label="Vos artistes suivis">{followed.data.map((a) => <ArtistCard key={a.id} artist={a} />)}</CardRow>
        </Section>
      ) : null}
      <Section title="Tous les artistes">
        {all.error ? <ErrorState onRetry={all.reload} />
          : !all.data ? <CardRowSkeleton round />
          : shown.length === 0 ? (
            <EmptyState icon={MicVocal} title={f ? "Aucun artiste ne correspond" : "Les premiers artistes arrivent bientôt"}
              text={f ? "Essayez un autre nom." : "Chaque artiste est validé par Rivendy avant de publier."} />
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 @lg:grid-cols-3 @3xl:grid-cols-4 @5xl:grid-cols-5 @7xl:grid-cols-6">
              {shown.map((a) => <ArtistCard key={a.id} artist={a} />)}
            </div>
          )}
      </Section>
    </div>
  );
}

// ── Rivendy Hit ────────────────────────────────────────────────────────────

export function HitView() {
  const market = useMusicMarket();
  const [scope, setScope] = useState<"all" | "country">("all");
  const hit = useLoad(`hit:${scope}:${market ?? ""}`, () => fetchHit(scope, scope === "all" ? "" : market ?? "", market));
  const rows = useMemo(() => hit.data ?? [], [hit.data]);
  const queue = useMemo(() => toQueue(rows.map((h) => h.music_tracks).filter((t): t is MusicTrack => !!t)), [rows]);
  const ranks = useMemo(() => new Map(rows.map((h) => [h.music_tracks?.id ?? "", { rank: h.rank, move: hitMovement(h.rank, h.previous_rank) }])), [rows]);
  const week = rows[0]?.week_start;
  const total = queue.reduce((s, x) => s + Number(x.track.duration_seconds ?? 0), 0);
  const source = { label: "Rivendy Hit", href: "/music/hit" };

  return (
    <CollectionPage tint={HIT_TINT} kicker="Classement" title="Rivendy Hit" cover={<IconTile icon={Trophy} />}
      description="Les titres les plus écoutés de la semaine, selon le nombre d’auditeurs."
      meta={<MetaLine parts={[
        week ? `Semaine du ${new Date(`${week}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}` : null,
        queue.length ? `${queue.length} titre${queue.length > 1 ? "s" : ""}` : null,
        total ? totalDurationLabel(total) : null,
      ]} />}
      compactActions={<PlayAllButton items={queue} source={source} variant="round" className="h-11 w-11" />}
      actions={(
        <>
          <PlayAllButton items={queue} source={source} variant="round" label="Écouter le Hit" />
          <ShuffleButton items={queue} source={source} />
          <div role="group" aria-label="Classement" className="ml-auto flex gap-2">
            {([["all", "Général"], ["country", "Mon pays"]] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setScope(v)} aria-pressed={scope === v}
                className={cn("h-8 rounded-full px-3.5 text-sm font-semibold transition-colors",
                  scope === v ? "bg-rvm-accent text-rvm-on-accent" : "bg-rvm-text/10 text-rvm-text hover:bg-rvm-text/20")}>{l}</button>
            ))}
          </div>
        </>
      )}>
      {hit.error ? <ErrorState onRetry={hit.reload} />
        : hit.loading ? <ListSkeleton rows={8} />
        : queue.length === 0 ? <EmptyState title="Pas encore de classement pour cette semaine" text="Chaque lundi, les titres les plus écoutés de la semaine passée." />
        : <TrackList items={queue} ranks={ranks} label="Rivendy Hit" source={source} stickyHeader />}
    </CollectionPage>
  );
}

// ── Sortie (album, single, EP) ─────────────────────────────────────────────

export function AlbumView({ release, tracks, highlight }: { release: MusicRelease; tracks: MusicTrack[]; highlight?: string | null }) {
  const library = useMusicLibrary();
  const market = useMusicMarket();
  const tint = useCoverTint(release.cover_url);
  const queue = useMemo(() => toQueue(tracks, release), [tracks, release]);
  const more = useLoad(release.artist_id ? `more:${release.artist_id}:${market ?? ""}` : null,
    () => fetchReleasesByArtist(release.artist_id as string, market));
  const others = (more.data ?? []).filter((r) => r.id !== release.id);
  const year = releaseYear(release);
  const total = tracks.reduce((s, t) => s + Number(t.duration_seconds ?? 0), 0);
  const source = { label: release.title, href: `/music/album/${release.id}` };

  // Après le retour en haut du panneau (coque), on descend jusqu'au titre partagé.
  useEffect(() => {
    if (!highlight) return;
    const id = window.requestAnimationFrame(() => document.getElementById(`t-${highlight}`)?.scrollIntoView({ block: "center" }));
    return () => window.cancelAnimationFrame(id);
  }, [highlight]);

  return (
    <CollectionPage tint={tint} kicker={releaseKindLabel(release.kind)} title={release.title}
      cover={<Cover url={release.cover_url} size={480} alt={`Pochette de ${release.title}`} priority className="w-full shadow-2xl shadow-rvm-deep/50" rounded="rounded-md" />}
      description={release.description}
      meta={<MetaLine parts={[
        release.artist_id
          ? <Link href={`/artist/${release.artist_id}`} className="font-bold hover:underline">{artistName(release)}</Link>
          : <span className="font-bold">{artistName(release)}</span>,
        year,
        `${tracks.length} titre${tracks.length > 1 ? "s" : ""}`,
        total ? totalDurationLabel(total) : null,
        release.explicit ? <ExplicitTag /> : null,
        release.is_premium ? <PremiumTag /> : null,
      ]} />}
      compactActions={<PlayAllButton items={queue} source={source} variant="round" className="h-11 w-11" />}
      actions={(
        <>
          <PlayAllButton items={queue} source={source} variant="round" />
          <ShuffleButton items={queue} source={source} />
          <SaveReleaseButton release={release} variant="icon" />
          <button type="button" onClick={() => void library.share("release", release.id, `${release.title} — ${artistName(release)}`)}
            aria-label="Partager" title="Partager" className={cn(iconButton, "h-12 w-12 text-rvm-soft")}>
            <Share2 className="h-6 w-6" aria-hidden />
          </button>
          <a href={appIntentUrl(`/musique/release/${release.id}`)} className="ml-auto inline-flex items-center gap-1.5 text-sm text-rvm-soft underline md:hidden">
            <Smartphone className="h-4 w-4" aria-hidden /> Ouvrir dans l’application
          </a>
        </>
      )}>
      {release.is_premium ? (
        <p className="mx-2 mb-4 flex flex-wrap items-center gap-1.5 text-[13px] text-rvm-soft">
          <Lock className="h-3.5 w-3.5 text-rvm-premium" aria-hidden /> Sortie Premium : écoute complète avec
          <Link href="/plus" prefetch={false} className="font-semibold text-rvm-ink-accent hover:underline">Rivendy+</Link>, extraits de 30 s sinon.
        </p>
      ) : null}
      {queue.length === 0 ? <EmptyState title="Les titres de cette sortie arrivent bientôt" />
        : <TrackList items={queue} numbered showCover={false} showAlbum={false} hideRelease highlight={highlight}
          label={`Titres de ${release.title}`} source={source} stickyHeader />}
      {release.release_date ? (
        <p className="mx-2 mt-6 text-[13px] text-rvm-soft">
          {new Date(`${release.release_date}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      ) : null}
      {others.length > 0 ? (
        <div className="px-2">
          <Section title={`Plus de ${artistName(release)}`} href={release.artist_id ? `/artist/${release.artist_id}` : undefined} hrefLabel="Voir l’artiste">
            <ReleaseShelf releases={others} label={`Plus de ${artistName(release)}`} />
          </Section>
        </div>
      ) : null}
    </CollectionPage>
  );
}

/** Page d'une sortie chargée côté navigateur (titre ouvert par la recherche). */
export function AlbumClientLoader({ id, highlight }: { id: string; highlight?: string | null }) {
  const data = useLoad(`album:${id}`, () => fetchRelease(id));
  if (data.error) return <div className="p-4 @2xl:p-6"><ErrorState onRetry={data.reload} /></div>;
  if (!data.data) return <div className="p-4 @2xl:p-6"><ListSkeleton rows={8} /></div>;
  if (!data.data.release) return <div className="p-4 @2xl:p-6"><EmptyState title="Cette sortie n’est pas disponible" /></div>;
  return <AlbumView release={data.data.release} tracks={data.data.tracks} highlight={highlight} />;
}

// ── Artiste ────────────────────────────────────────────────────────────────

export function ArtistView({ artist }: { artist: MusicArtist }) {
  const library = useMusicLibrary();
  const market = useMusicMarket();
  const tint = useCoverTint(artist.banner_url || artist.avatar_url);
  const page = useLoad(`artist:${artist.id}:${market ?? ""}`, async () => {
    const [top, releases] = await Promise.all([
      fetchArtistTopTracks(artist.id, market).catch(() => [] as MusicTrack[]),
      fetchReleasesByArtist(artist.id, market),
    ]);
    return { top, releases };
  });
  const queue = useMemo(() => toQueue(page.data?.top ?? []), [page.data]);
  const source = { label: artist.name, href: `/artist/${artist.id}` };

  return (
    <CollectionPage tint={tint} kicker="Artiste" title={artist.name} roundCover
      cover={artist.avatar_url
        ? <Cover url={artist.avatar_url} size={480} alt={artist.name} rounded="rounded-full" className="w-full shadow-2xl shadow-rvm-deep/50" priority />
        : <ArtistInitial name={artist.name} />}
      meta={<MetaLine parts={[
        artist.genre,
        page.data ? `${page.data.releases.length} sortie${page.data.releases.length > 1 ? "s" : ""}` : null,
      ]} />}
      compactActions={<PlayAllButton items={queue} source={source} variant="round" className="h-11 w-11" />}
      actions={(
        <>
          <PlayAllButton items={queue} source={source} variant="round" />
          <ShuffleButton items={queue} source={source} />
          <FollowArtistButton artist={artist} compact />
          <button type="button" onClick={() => void library.share("artist", artist.id, artist.name)} aria-label="Partager" title="Partager"
            className={cn(iconButton, "h-12 w-12 text-rvm-soft")}>
            <Share2 className="h-6 w-6" aria-hidden />
          </button>
        </>
      )}>
      {page.error ? <ErrorState onRetry={page.reload} /> : (
        <div className="px-2">
          <Section title="Titres populaires" className="mt-2">
            {!page.data ? <ListSkeleton /> : queue.length === 0
              ? <p className="text-sm text-rvm-soft">Pas encore de titres populaires.</p>
              : <TrackList items={queue} label={`Titres populaires de ${artist.name}`} source={source} />}
          </Section>
          <Section title="Sorties">
            {!page.data ? <CardRowSkeleton count={5} />
              : page.data.releases.length === 0 ? <p className="text-sm text-rvm-soft">Pas encore de sortie.</p>
              : <ReleaseShelf releases={page.data.releases} label={`Sorties de ${artist.name}`} />}
          </Section>
          {artist.bio ? (
            <Section title="À propos">
              <p className="max-w-3xl whitespace-pre-line text-[15px] leading-relaxed text-rvm-soft">{artist.bio}</p>
            </Section>
          ) : null}
        </div>
      )}
    </CollectionPage>
  );
}

function ArtistInitial({ name }: { name: string }) {
  return (
    <span aria-hidden className="flex aspect-square w-full items-center justify-center rounded-full bg-gradient-to-br from-rvm-brand/60 to-rvm-raised text-6xl font-black text-white shadow-2xl shadow-rvm-deep/50">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
