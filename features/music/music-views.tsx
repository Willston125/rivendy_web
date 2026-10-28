"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AudioLines, Lock, MicVocal, Search, Share2, Smartphone, Trophy, X } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useHomeMarket } from "@/features/media/use-home-market";
import { fetchCatalog } from "@/features/play/play-api";
import { appIntentUrl } from "@/features/play/play-link-page";
import { cn } from "@/lib/utils/cn";
import {
  fetchArtistTopTracks, fetchArtistsByIds, fetchArtistsWithMusic, fetchFeatured, fetchFollowedArtists, fetchGenres,
  fetchHistory, fetchHit, fetchNewReleases, fetchRelease, fetchReleasesByArtist, fetchTracksByIds, searchMusic,
  type MusicArtist, type MusicGenre, type SearchRow,
} from "./music-api";
import { CollectionPage, IconTile, MetaLine, useCoverTint } from "./music-collection";
import { useMusicLibrary } from "./music-library";
import { HomeHero } from "./music-home-hero";
import {
  HOME_GRID, HOME_SHOWS, artistName, availableGenres, distinctArtistIds, filterByGenre, heroHitBadge, hitMovement,
  homeShelves, homeSpotlight, recentIsUseful, releaseKindLabel, releaseYear, searchable, totalDurationLabel,
  uniqueReleases, usefulRubrics, type HomeRubric, type MusicRelease, type MusicTrack,
} from "./music-logic";
import { MusicInstallHint } from "./music-install-hint";
import { loginHref } from "./music-pending";
import {
  ArtistCard, ArtistFollowCard, CardRow, CardRowSkeleton, Cover, CoverGridSkeleton, EmptyState, ErrorState, ExplicitTag,
  FollowArtistButton, ListSkeleton, PageTitle, PlayAllButton, PremiumTag, ReleaseCoverGrid, ReleaseGrid, ReleaseShelf,
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

/**
 * Accueil de la Musique (refonte du 2026-10-28, maquette « Monte le son. »,
 * dans la coque application du 2026-10-22) : l'accroche et les filtres de
 * genre, la sortie à la une, les nouveautés en grandes pochettes, le Rivendy
 * Hit et les artistes à découvrir côte à côte, puis les écoutes récentes.
 * Tout suit le catalogue réel : rien n'est inventé pour remplir, et une
 * sortie n'apparaît jamais deux fois. « Ma bibliothèque » (favoris,
 * historique, playlists) reste dans son panneau, et dans la navigation du
 * bas sur téléphone : plus de raccourcis en tête de page.
 */
export function MusicHomeView() {
  const market = useMusicMarket();
  const { user, loading: authLoading } = useAuth();
  const [genre, setGenre] = useState<string | null>(null);

  const home = useLoad(`home:${market ?? ""}`, async () => {
    const [featured, fresh, hit, genres, clips] = await Promise.all([
      fetchFeatured(market), fetchNewReleases(market, 48), fetchHit("all", "", market),
      fetchGenres().catch(() => [] as MusicGenre[]),
      // Un seul clip suffit à savoir si le raccourci vers Rivendy Play mène quelque part.
      fetchCatalog(market, "clip", 1).catch(() => []),
    ]);
    const all = uniqueReleases([featured, fresh]);
    const artists = await fetchArtistsByIds(distinctArtistIds(all).slice(0, 18)).catch(() => [] as MusicArtist[]);
    return { featured, fresh, hit, genres, artists, all, clips: clips.length };
  });
  const recent = useLoad(user ? `recent:${user.id}` : null, () => fetchHistory().then((rows) => rows.slice(0, 12)));

  const data = home.data;
  const genres = useMemo(() => (data ? availableGenres(data.all, data.genres) : []), [data]);
  const hit = useMemo(() => {
    const rows = (data?.hit ?? []).filter((h) => !genre || h.music_tracks?.music_releases?.genre_id === genre);
    const items = toQueue(rows.map((h) => h.music_tracks).filter((t): t is MusicTrack => !!t)).slice(0, 5);
    // L'accueil montre le rang seul ; l'évolution reste sur la page du Hit.
    const ranks = new Map(rows.map((h) => [h.music_tracks?.id ?? "", { rank: h.rank, move: "" }]));
    return { items, ranks };
  }, [data, genre]);
  const spot = useMemo(
    () => (data ? homeSpotlight(filterByGenre(data.featured, genre), filterByGenre(data.fresh, genre)) : null),
    [data, genre],
  );
  // « Tout voir » seulement vers une page qui montre plus que l'accueil (petit catalogue : aucune).
  const rubrics = data
    ? usefulRubrics({ hitTracks: data.hit.length, releases: data.all.length, artists: data.artists.length, clips: data.clips })
    : [];
  const top = data?.hit[0];
  const hitBadge = !!spot?.release
    && heroHitBadge(top ? { rank: top.rank, releaseId: top.music_tracks?.release_id ?? null } : null, spot.release.id).kind === "same";

  const intro = (
    <div>
      <p className="text-sm text-rvm-soft">Votre prochaine découverte est ici.</p>
      <h1 className="mt-1 font-rvm-display text-[clamp(2.125rem,6cqw,3.5rem)] font-black leading-none tracking-tight">Monte le son.</h1>
      {genres.length > 0 ? (
        <div role="group" aria-label="Filtrer par genre"
          className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 @2xl:mx-0 @2xl:flex-wrap @2xl:px-0">
          {[{ id: null as string | null, name: "Tout" }, ...genres].map((g) => {
            const active = genre === g.id;
            return (
              <button key={g.id ?? "all"} type="button" onClick={() => setGenre(g.id)} aria-pressed={active}
                className={cn("h-9 shrink-0 rounded-full px-4 text-sm font-bold transition-colors",
                  active ? "bg-rvm-accent text-rvm-on-accent" : "bg-white/10 text-rvm-text hover:bg-white/20")}>
                {g.name}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="px-4 pb-2 pt-4 @2xl:px-6 @2xl:pt-6 @5xl:px-8">
      <MusicInstallHint />
      {home.error ? (
        <>
          {intro}
          <div className="mt-6"><ErrorState onRetry={home.reload} /></div>
        </>
      ) : !data || !spot ? (
        <>
          <HomeHero intro={intro} release={null} loading />
          <div className="mt-8"><CoverGridSkeleton /></div>
          <div className="mt-8"><ListSkeleton /></div>
        </>
      ) : data.all.length === 0 && data.hit.length === 0 ? (
        <>
          {intro}
          <div className="mt-6">
            <EmptyState title="Les premiers titres arrivent bientôt"
              text="Singles, EP et albums des artistes de l’archipel et d’ailleurs. Chaque sortie est validée par Rivendy avant d’être publiée." />
          </div>
        </>
      ) : (
        <>
          <HomeHero intro={intro} release={spot.release} kicker={spot.source === "featured" ? "À la une" : "Nouveauté"} hitBadge={hitBadge} />
          {!user && !authLoading ? <div className="mt-6"><VisitorWelcome /></div> : null}
          <HomeSections artists={data.artists} all={data.all} spot={spot} genre={genre} genreName={genres.find((g) => g.id === genre)?.name}
            hitItems={hit.items} ranks={hit.ranks} recent={recent.data} rubrics={rubrics} />
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
    <section aria-labelledby="rvm-welcome" className="flex flex-col gap-3 rounded-lg bg-white/[0.06] p-4 @xl:flex-row @xl:items-center @xl:gap-6">
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

function HomeSections({ artists: allArtists, all, spot, genre, genreName, hitItems, ranks, recent, rubrics }: {
  artists: MusicArtist[];
  all: MusicRelease[];
  /** Sortie à la une, et la sélection et les nouveautés SANS elle (homeSpotlight). */
  spot: { release: MusicRelease | null; featured: MusicRelease[]; fresh: MusicRelease[] };
  genre: string | null;
  genreName?: string;
  hitItems: QueueItem[];
  ranks: Map<string, { rank: number; move: string }>;
  recent: Array<{ track: MusicTrack }> | null;
  /** Rubriques qui montrent plus que l'accueil : sinon, pas de « Tout voir ». */
  rubrics: HomeRubric[];
}) {
  const shelves = homeShelves(spot.featured, spot.fresh);
  const artists = genre ? allArtists.filter((a) => all.some((r) => r.genre_id === genre && r.artist_id === a.id)) : allArtists;
  const shownReleases = shelves.mode === "one" ? shelves.releases.slice(0, HOME_GRID)
    : [...shelves.selection.slice(0, HOME_GRID), ...shelves.news.slice(0, HOME_GRID)];
  const shown = new Set([...(spot.release ? [spot.release.id] : []), ...shownReleases.map((r) => r.id)]);
  const showRecent = !!recent && recentIsUseful(recent.map((r) => r.track.release_id), shown);
  const explore = genre ? `/music/explore?genre=${genre}` : "/music/explore";
  const moreHref = (list: MusicRelease[]) => (list.length > HOME_GRID || rubrics.includes("explore") ? explore : undefined);
  const oneTitle = shelves.mode === "one" && shelves.title === "Nouveautés" ? "Les nouveautés" : shelves.mode === "one" ? shelves.title : "";
  // Le Hit et les artistes côte à côte quand le panneau le permet ; à côté du
  // Hit, quatre artistes (au-delà, « Tout voir »).
  const side = hitItems.length > 0 && artists.length > 0;
  const artistsShown = side ? 4 : HOME_SHOWS.artists;
  return (
    <>
      {shelves.mode === "one" ? (
        shelves.releases.length > 0 ? (
          <Section title={oneTitle} href={moreHref(shelves.releases)}>
            <ReleaseCoverGrid releases={shelves.releases} label={oneTitle} />
          </Section>
        ) : !spot.release ? (
          <Section title="Les nouveautés">
            <EmptyState title={genreName ? `Pas encore de sortie ${genreName}` : "Pas encore de sortie"} text="Revenez bientôt : les sorties arrivent chaque semaine." />
          </Section>
        ) : null
      ) : (
        <>
          <Section title="La sélection Rivendy" href={moreHref(shelves.selection)}>
            <ReleaseCoverGrid releases={shelves.selection} label="La sélection Rivendy" />
          </Section>
          <Section title="Les nouveautés" href={moreHref(shelves.news)}>
            <ReleaseCoverGrid releases={shelves.news} label="Les nouveautés" />
          </Section>
        </>
      )}

      {hitItems.length > 0 || artists.length > 0 ? (
        <div className={cn("mt-8 grid gap-8", side && "@4xl:grid-cols-[minmax(0,1fr)_19rem] @6xl:grid-cols-[minmax(0,1fr)_21rem]")}>
          {hitItems.length > 0 ? (
            <Section className="mt-0 min-w-0 @container" title="Le Hit Rivendy" subtitle="Les plus écoutés de la semaine."
              href="/music/hit" hrefLabel="Voir le Hit">
              <TrackList items={hitItems} ranks={ranks} label="Le Hit Rivendy" source={{ label: "Rivendy Hit", href: "/music/hit" }} showHeader={false} />
            </Section>
          ) : null}
          {artists.length > 0 ? (
            <Section className={cn("mt-0 min-w-0", side && "@4xl:border-l @4xl:border-white/10 @4xl:pl-8")} title="À découvrir"
              href={rubrics.includes("artists") || artists.length > artistsShown ? "/music/artists" : undefined}>
              <ul aria-label="Artistes à découvrir"
                className={cn("grid grid-cols-2 gap-x-4 gap-y-6", side ? "@xl:grid-cols-4 @4xl:grid-cols-2" : "@xl:grid-cols-3 @3xl:grid-cols-4 @5xl:grid-cols-6")}>
                {artists.slice(0, artistsShown).map((a) => <li key={a.id} className="min-w-0"><ArtistFollowCard artist={a} /></li>)}
              </ul>
            </Section>
          ) : null}
        </div>
      ) : null}

      {showRecent && recent ? (
        <Section title="Écoutés récemment" href="/music/history">
          <RecentRow rows={recent} />
        </Section>
      ) : null}
    </>
  );
}

/** « Écoutés récemment » : cartes de titres, toucher relance la liste. */
function RecentRow({ rows }: { rows: Array<{ track: MusicTrack }> }) {
  const player = useMusicPlayer();
  const items = toQueue(rows.map((r) => r.track));
  return (
    <CardRow label="Écoutés récemment">
      {items.map((it, i) => {
        const isCurrent = player.current?.track.id === it.track.id;
        return (
          <button key={`${it.track.id}-${i}`} type="button"
            onClick={() => (isCurrent ? player.toggle() : player.playQueue(items, i, { source: { label: "Écoutés récemment", href: "/music/history" } }))}
            aria-label={`Écouter ${it.track.title}`} className="group block w-full text-left">
            <div className={cn("overflow-hidden rounded-xl shadow-lg shadow-black/30 ring-1 ring-white/5", isCurrent && "ring-2 ring-rvm-accent")}>
              <Cover url={it.release.cover_url} size={320} alt="" className="w-full transition duration-300 motion-safe:group-hover:scale-[1.03]" />
            </div>
            <span className={cn("mt-2.5 block truncate text-[15px] font-semibold", isCurrent ? "text-rvm-accent" : "text-rvm-text")}>{it.track.title}</span>
            <span className="block truncate text-[13px] text-rvm-soft">{artistName(it.release)}</span>
          </button>
        );
      })}
    </CardRow>
  );
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
                          active ? "bg-rvm-accent/25 ring-2 ring-rvm-accent" : k % 2 ? "bg-[#0F3B3A] hover:brightness-125" : "bg-[#173444] hover:brightness-125")}>
                        <span className="relative block text-lg font-black text-white">{g.name}</span>
                        <AudioLines className={cn("absolute bottom-3 right-3 h-6 w-6", active ? "text-rvm-accent" : "text-white/50")} aria-hidden />
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
      <Link href={href} className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-white/[0.07]">
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
          <label className="flex h-10 w-full max-w-xs items-center gap-2 rounded-full bg-rvm-raised px-3 focus-within:ring-2 focus-within:ring-rvm-accent @lg:w-64">
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
                  scope === v ? "bg-rvm-accent text-rvm-on-accent" : "bg-white/10 text-rvm-text hover:bg-white/20")}>{l}</button>
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
      cover={<Cover url={release.cover_url} size={480} alt={`Pochette de ${release.title}`} priority className="w-full shadow-2xl shadow-black/50" rounded="rounded-md" />}
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
          <Link href="/plus" prefetch={false} className="font-semibold text-rvm-accent hover:underline">Rivendy+</Link>, extraits de 30 s sinon.
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
        ? <Cover url={artist.avatar_url} size={480} alt={artist.name} rounded="rounded-full" className="w-full shadow-2xl shadow-black/50" priority />
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
    <span aria-hidden className="flex aspect-square w-full items-center justify-center rounded-full bg-gradient-to-br from-rvm-brand/60 to-rvm-raised text-6xl font-black text-white shadow-2xl shadow-black/50">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
