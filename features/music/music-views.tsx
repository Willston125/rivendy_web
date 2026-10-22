"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AudioLines, Headphones, LoaderCircle, Lock, Mic2, Search, Share2, Smartphone, UserCheck, UserPlus, X,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useDialogs } from "@/features/ui/dialogs";
import { useHomeMarket } from "@/features/media/use-home-market";
import { appIntentUrl } from "@/features/play/play-link-page";
import { cn } from "@/lib/utils/cn";
import {
  fetchArtistTopTracks, fetchArtistsByIds, fetchArtistsWithMusic, fetchFeatured, fetchFollowedArtists, fetchGenres,
  fetchHistory, fetchHit, fetchNewReleases, fetchRelease, fetchReleasesByArtist, fetchTracksByIds, isFollowing,
  searchMusic, setFollowing,
  type HitRow, type MusicArtist, type MusicGenre, type SearchRow,
} from "./music-api";
import { MUSIC_LIBRARY_EVENT, useMusicLibrary, type LibraryEventDetail } from "./music-library";
import {
  artistName, availableGenres, distinctArtistIds, filterByGenre, hitMovement, releaseKindLabel, releaseMeta,
  releaseYear, searchable, thumbUrl, uniqueReleases,
  type MusicRelease, type MusicTrack,
} from "./music-logic";
import {
  ArtistCard, CardRow, CardRowSkeleton, Cover, EmptyState, ErrorState, ListSkeleton, PageTitle, PlayAllButton,
  PlayReleaseLabelButton, PremiumTag, ReleaseCard, ReleaseGrid, SaveReleaseButton, Section, TrackList, iconButton,
  secondaryButton, toQueue, useLoad,
} from "./music-ui";
import { useMusicPlayer } from "./player/music-player-provider";

export { FavoritesView, HistoryView, LibraryView, PlaylistView } from "./music-library-views";

/** Marché d'écoute : marché d'origine du compte, sinon le pays choisi (comme l'app). */
export const useMusicMarket = useHomeMarket;

/** Comparaison tolérante aux accents et à la casse (filtres locaux). */
function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

// ── Découvrir ──────────────────────────────────────────────────────────────

export function MusicHomeView() {
  const market = useMusicMarket();
  const { user } = useAuth();
  const [genre, setGenre] = useState<string | null>(null);

  const home = useLoad(`home:${market ?? ""}`, async () => {
    const [featured, fresh, hit, genres] = await Promise.all([
      fetchFeatured(market), fetchNewReleases(market, 48), fetchHit("all", "", market),
      fetchGenres().catch(() => [] as MusicGenre[]),
    ]);
    const all = uniqueReleases([featured, fresh]);
    const artists = await fetchArtistsByIds(distinctArtistIds(all).slice(0, 18)).catch(() => [] as MusicArtist[]);
    return { featured, fresh, hit, genres, artists, all };
  });
  const recent = useLoad(user ? `recent:${user.id}` : null, () => fetchHistory().then((rows) => rows.slice(0, 12)));

  const data = home.data;
  const genres = useMemo(() => (data ? availableGenres(data.all, data.genres) : []), [data]);
  const hitQueue = useMemo(() => {
    const rows = (data?.hit ?? []).filter((h) => !genre || h.music_tracks?.music_releases?.genre_id === genre);
    return { items: toQueue(rows.map((h) => h.music_tracks).filter((t): t is MusicTrack => !!t)).slice(0, 8), rows };
  }, [data, genre]);
  const ranks = useMemo(() => new Map(hitQueue.rows.map((h) => [h.music_tracks?.id ?? "", { rank: h.rank, move: hitMovement(h.rank, h.previous_rank) }])), [hitQueue]);

  if (home.error) return <><HomeTitle /><div className="mt-6"><ErrorState onRetry={home.reload} /></div></>;
  if (!data) {
    return (
      <>
        <HomeTitle />
        <div aria-hidden className="mt-6 h-64 rounded-3xl bg-rvm-surface motion-safe:animate-pulse sm:h-80" />
        <div className="mt-10"><CardRowSkeleton /></div>
        <div className="mt-10"><ListSkeleton /></div>
      </>
    );
  }

  const featured = filterByGenre(data.featured, genre);
  const fresh = filterByGenre(data.fresh, genre);
  const artists = genre ? data.artists.filter((a) => data.all.some((r) => r.genre_id === genre && r.artist_id === a.id)) : data.artists;
  const spotlight = (data.featured.length > 0 ? data.featured : data.fresh).slice(0, 5);
  const genreName = genres.find((g) => g.id === genre)?.name;
  const nothing = data.all.length === 0 && data.hit.length === 0;

  return (
    <>
      <HomeTitle />
      {!user ? (
        <p className="mt-4 rounded-xl border border-rvm-line bg-rvm-surface px-4 py-3 text-sm text-rvm-soft">
          <Link href="/auth/login?next=/music" className="font-bold text-rvm-accent hover:underline">Connectez-vous</Link>{" "}
          pour écouter, aimer des titres et retrouver vos playlists — les mêmes que dans l’application.
        </p>
      ) : null}

      {nothing ? (
        <div className="mt-6">
          <EmptyState title="Les premiers titres arrivent bientôt"
            text="Singles, EP et albums des artistes de l’archipel et d’ailleurs. Chaque sortie est validée par Rivendy avant d’être publiée." />
        </div>
      ) : (
        <>
          {spotlight.length > 0 ? <Hero releases={spotlight} top={data.hit[0] ?? null} hit={data.hit} /> : null}
          {genres.length > 0 ? <GenreChips genres={genres} value={genre} onChange={setGenre} /> : null}

          {featured.length > 0 ? (
            <Section title="La sélection Rivendy" subtitle="Les sorties choisies par l’équipe.">
              <CardRow label="La sélection Rivendy">{featured.map((r, i) => <ReleaseCard key={r.id} release={r} priority={i < 2} />)}</CardRow>
            </Section>
          ) : null}

          {hitQueue.items.length > 0 ? (
            <Section title="Titres populaires" subtitle="Le Rivendy Hit de la semaine, selon le nombre d’auditeurs." href="/music/hit" hrefLabel="Voir le Hit">
              <TrackList items={hitQueue.items} ranks={ranks} label="Titres populaires" />
            </Section>
          ) : null}

          <Section title="Nouveautés" subtitle="Les dernières sorties validées par Rivendy." href={genre ? `/music/explore?genre=${genre}` : "/music/explore"}>
            {fresh.length > 0
              ? <CardRow label="Nouveautés">{fresh.map((r) => <ReleaseCard key={r.id} release={r} />)}</CardRow>
              : <EmptyState title={genreName ? `Pas encore de nouveauté ${genreName}` : "Pas encore de nouveauté"} text="Revenez bientôt : les sorties arrivent chaque semaine." />}
          </Section>

          {artists.length > 0 ? (
            <Section title="Artistes à découvrir" href="/music/artists">
              <CardRow label="Artistes à découvrir">{artists.map((a) => <ArtistCard key={a.id} artist={a} />)}</CardRow>
            </Section>
          ) : null}

          {recent.data && recent.data.length > 0 ? (
            <Section title="Écoutés récemment" href="/music/history">
              <RecentRow rows={recent.data} />
            </Section>
          ) : null}
        </>
      )}
    </>
  );
}

function HomeTitle() {
  return (
    <PageTitle title="À découvrir" subtitle="Vos îles. Votre rythme."
      aside={<span className="hidden items-center gap-2 text-xs text-rvm-muted sm:flex"><Headphones className="h-4 w-4 text-rvm-accent" aria-hidden /> Trouvez votre prochain coup de cœur.</span>} />
  );
}

/**
 * Bannière : les sorties mises en avant au dashboard (sinon les plus
 * récentes). La pochette carrée s'affiche entière — jamais un visage coupé —
 * et floutée en fond ; sans visuel, un dégradé vert.
 */
function Hero({ releases, top, hit }: { releases: MusicRelease[]; top: HitRow | null; hit: HitRow[] }) {
  const [i, setI] = useState(0);
  const player = useMusicPlayer();
  const r = releases[Math.min(i, releases.length - 1)];
  const bg = thumbUrl(r.cover_url, 480);
  const year = releaseYear(r);
  const topTrack = top?.music_tracks ?? null;
  const topRelease = topTrack?.music_releases ?? null;

  return (
    <section aria-roledescription="carrousel" aria-label="La sélection Rivendy"
      className="relative mt-6 overflow-hidden rounded-3xl border border-rvm-line bg-rvm-surface">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {bg && bg.startsWith("https://") ? (
          <Image key={bg} src={bg} alt="" fill unoptimized sizes="100vw" className="scale-125 object-cover opacity-40 blur-3xl" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-rvm-ground via-rvm-ground/85 to-rvm-ground/30" />
        <div className="absolute -left-24 -top-32 h-80 w-80 rounded-full bg-rvm-brand/35 blur-3xl" />
      </div>

      <div className="relative grid items-center gap-6 p-5 sm:p-8 md:grid-cols-[minmax(0,1fr)_auto] lg:px-10 lg:py-9">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-black/25 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-rvm-soft">
            <AudioLines className="h-3.5 w-3.5 text-rvm-accent" aria-hidden /> La sélection Rivendy
          </span>
          <div className="mt-4 flex items-center gap-4">
            <Link href={`/music/album/${r.id}`} className="shrink-0 md:hidden" tabIndex={-1} aria-hidden>
              <Cover url={r.cover_url} size={320} alt="" className="h-20 w-20 shadow-xl shadow-black/40" rounded="rounded-xl" />
            </Link>
            <div className="min-w-0">
              <h2 className="line-clamp-2 text-2xl font-black leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                <Link href={`/music/album/${r.id}`} className="hover:underline">{r.title}</Link>
              </h2>
              <p className="mt-1.5 truncate text-sm text-rvm-soft">
                {r.artist_id ? <Link href={`/artist/${r.artist_id}`} className="font-semibold text-rvm-text hover:underline">{artistName(r)}</Link> : artistName(r)}
                {" · "}{releaseKindLabel(r.kind)}{year ? ` · ${year}` : ""}
                {r.is_premium ? <PremiumTag className="ml-2 align-middle" /> : null}
              </p>
            </div>
          </div>
          <p className="mt-3 line-clamp-2 max-w-xl text-sm leading-relaxed text-rvm-muted">
            {r.description?.trim() || "Des pépites des îles aux sons qui vous emmènent ailleurs. Appuyez sur lecture."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <PlayReleaseLabelButton release={r} />
            <SaveReleaseButton release={r} />
          </div>
        </div>

        <div className="relative hidden md:block">
          <Link href={`/music/album/${r.id}`} aria-label={`Ouvrir ${r.title}`} className="block w-56 lg:w-64">
            <Cover url={r.cover_url} size={720} alt="" priority className="w-full shadow-2xl shadow-black/60 ring-1 ring-white/10" rounded="rounded-2xl" />
          </Link>
          {topTrack && topRelease ? (
            <button type="button" onClick={() => player.playQueue(toQueue(hit.map((h) => h.music_tracks).filter((t): t is MusicTrack => !!t)), 0)}
              className="absolute -bottom-4 -left-16 hidden w-60 items-center gap-3 rounded-2xl border border-white/10 bg-rvm-panel/90 p-3 text-left shadow-2xl backdrop-blur hover:border-rvm-accent/60 xl:flex">
              <AudioLines className="h-6 w-6 shrink-0 text-rvm-accent" aria-hidden />
              <span className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-rvm-muted">N° 1 du Rivendy Hit</span>
                <span className="block truncate text-sm font-semibold">{topTrack.title}</span>
                <span className="block truncate text-xs text-rvm-muted">{artistName(topRelease)}</span>
              </span>
            </button>
          ) : null}
        </div>
      </div>

      {releases.length > 1 ? (
        <div className="relative flex gap-1.5 px-5 pb-5 sm:px-8 lg:px-10">
          {releases.map((x, k) => (
            <button key={x.id} type="button" onClick={() => setI(k)} aria-label={`Afficher ${x.title} (${k + 1} sur ${releases.length})`}
              aria-current={k === i ? "true" : undefined}
              className="flex h-6 items-center">
              <span className={cn("block h-1.5 rounded-full transition-all", k === i ? "w-6 bg-rvm-accent" : "w-1.5 bg-white/30 hover:bg-white/50")} />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** Filtres de genre : seulement les genres présents dans le catalogue affiché. */
function GenreChips({ genres, value, onChange }: { genres: MusicGenre[]; value: string | null; onChange: (g: string | null) => void }) {
  const all: Array<{ id: string | null; name: string }> = [{ id: null, name: "Tout" }, ...genres];
  return (
    <div role="group" aria-label="Filtrer par genre" className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:px-0">
      {all.map((g) => {
        const active = value === g.id;
        return (
          <button key={g.id ?? "all"} type="button" onClick={() => onChange(g.id)} aria-pressed={active}
            className={cn("h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors",
              active ? "border-rvm-accent bg-rvm-accent text-rvm-on-accent" : "border-rvm-line bg-rvm-surface text-rvm-soft hover:border-rvm-accent/60 hover:text-rvm-text")}>
            {g.name}
          </button>
        );
      })}
    </div>
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
          <button key={`${it.track.id}-${i}`} type="button" onClick={() => (isCurrent ? player.toggle() : player.playQueue(items, i))}
            aria-label={`Écouter ${it.track.title}`} className="group block w-full text-left">
            <div className={cn("overflow-hidden rounded-xl shadow-lg shadow-black/30 ring-1 ring-white/5", isCurrent && "ring-2 ring-rvm-accent")}>
              <Cover url={it.release.cover_url} size={320} alt="" className="w-full transition duration-300 motion-safe:group-hover:scale-[1.03]" />
            </div>
            <span className={cn("mt-2.5 block truncate text-sm font-semibold", isCurrent ? "text-rvm-accent" : "text-rvm-text")}>{it.track.title}</span>
            <span className="block truncate text-xs text-rvm-muted">{artistName(it.release)}</span>
          </button>
        );
      })}
    </CardRow>
  );
}

// ── Explorer : recherche, genres, toutes les sorties ───────────────────────

export function ExploreView() {
  const params = useSearchParams();
  const router = useRouter();
  const market = useMusicMarket();
  const genre = params.get("genre");
  const [q, setQ] = useState(() => params.get("q") ?? "");
  const [query, setQuery] = useState(() => (params.get("q") ?? "").trim());

  useEffect(() => {
    const t = window.setTimeout(() => setQuery(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  // L'adresse garde la recherche et le genre (lien partageable, retour arrière).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (query) sp.set("q", query); else sp.delete("q");
    const next = `/music/explore${sp.toString() ? `?${sp}` : ""}`;
    if (next !== `${window.location.pathname}${window.location.search}`) router.replace(next, { scroll: false });
  }, [query, router]);

  const setGenre = (g: string | null) => {
    const sp = new URLSearchParams(window.location.search);
    if (g) sp.set("genre", g); else sp.delete("genre");
    router.replace(`/music/explore${sp.toString() ? `?${sp}` : ""}`, { scroll: false });
  };

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

  const genreName = catalog.data?.genres.find((g) => g.id === genre)?.name ?? null;
  const releases = genre ? byGenre.data : catalog.data?.releases ?? null;

  return (
    <>
      <PageTitle title="Explorer" subtitle="Cherchez un titre, un artiste, un album, ou parcourez les genres." />
      <form role="search" onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); }}
        className="mt-5 flex max-w-2xl items-center gap-2 rounded-full border border-rvm-line bg-rvm-surface px-4 transition-colors focus-within:border-rvm-accent">
        <Search className="h-5 w-5 shrink-0 text-rvm-muted" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Un titre, un artiste, une envie…"
          aria-label="Rechercher de la musique" enterKeyHint="search"
          className="h-12 min-w-0 flex-1 bg-transparent text-rvm-text placeholder:text-rvm-muted focus:outline-none focus-visible:outline-none" />
        {search.loading ? <LoaderCircle className="h-4 w-4 text-rvm-muted motion-safe:animate-spin" aria-hidden /> : null}
        {q ? (
          <button type="button" onClick={() => { setQ(""); setQuery(""); }} aria-label="Effacer la recherche" className={cn(iconButton, "h-9 w-9")}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </form>

      {searchable(query) ? (
        <div aria-live="polite">
          {search.error ? <div className="mt-8"><ErrorState onRetry={search.reload} /></div>
            : !search.data ? <div className="mt-8"><ListSkeleton /></div>
            : search.data.rows.length === 0 ? (
              <div className="mt-8"><EmptyState icon={Search} title={`Aucun résultat pour « ${query} »`} text="Vérifiez l’orthographe ou essayez un autre mot." /></div>
            ) : <SearchResults rows={search.data.rows} tracks={search.data.tracks} />}
        </div>
      ) : (
        <>
          {q.trim().length === 1 ? <p className="mt-3 text-sm text-rvm-muted">Tapez au moins 2 caractères.</p> : null}
          <Section title="Genres">
            {catalog.error ? <ErrorState onRetry={catalog.reload} />
              : !catalog.data ? <div aria-hidden className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{Array.from({ length: 5 }, (_, k) => <div key={k} className="h-24 rounded-2xl bg-rvm-surface motion-safe:animate-pulse" />)}</div>
              : catalog.data.genres.length === 0 ? <p className="text-sm text-rvm-muted">Les genres apparaîtront avec les premières sorties.</p>
              : (
                <div role="group" aria-label="Genres" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {catalog.data.genres.map((g, k) => {
                    const active = genre === g.id;
                    return (
                      <button key={g.id} type="button" aria-pressed={active} onClick={() => setGenre(active ? null : g.id)}
                        className={cn("relative h-24 overflow-hidden rounded-2xl border p-4 text-left transition",
                          active ? "border-rvm-accent bg-rvm-accent/20" : "border-rvm-line bg-rvm-surface hover:border-rvm-accent/50")}>
                        <span aria-hidden className={cn("absolute -bottom-8 -right-6 h-24 w-24 rounded-full blur-2xl", k % 2 ? "bg-rvm-brand/40" : "bg-rvm-accent/25")} />
                        <span className="relative block text-base font-bold text-rvm-text">{g.name}</span>
                        <AudioLines className={cn("absolute bottom-3 right-3 h-5 w-5", active ? "text-rvm-accent" : "text-rvm-muted")} aria-hidden />
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
    </>
  );
}

function SearchResults({ rows, tracks }: { rows: SearchRow[]; tracks: MusicTrack[] }) {
  const artists = rows.filter((r) => r.kind === "artist");
  const releases = rows.filter((r) => r.kind === "release");
  const podcasts = rows.filter((r) => r.kind === "podcast");
  const queue = toQueue(tracks);
  const tile = (r: SearchRow, href: string, round = false) => (
    <li key={`${r.kind}-${r.id}`}>
      <Link href={href} className="flex items-center gap-3 rounded-xl border border-transparent bg-rvm-surface p-2.5 hover:border-rvm-line hover:bg-rvm-raised">
        <Cover url={r.cover_url} size={160} alt="" className="h-14 w-14 shrink-0" rounded={round ? "rounded-full" : "rounded-lg"} />
        <span className="min-w-0">
          <span className="block truncate font-semibold">{r.title}</span>
          {r.subtitle ? <span className="block truncate text-xs text-rvm-muted">{r.subtitle}</span> : null}
        </span>
      </Link>
    </li>
  );
  return (
    <>
      {queue.length > 0 ? <Section title="Titres"><TrackList items={queue} label="Titres trouvés" /></Section> : null}
      {artists.length > 0 ? (
        <Section title="Artistes"><ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{artists.map((r) => tile(r, `/artist/${r.id}`, true))}</ul></Section>
      ) : null}
      {releases.length > 0 ? (
        <Section title="Albums et singles"><ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{releases.map((r) => tile(r, `/music/album/${r.id}`))}</ul></Section>
      ) : null}
      {podcasts.length > 0 ? (
        <Section title="Podcasts"><ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{podcasts.map((r) => tile(r, `/musique/podcast/${r.id}`))}</ul></Section>
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
    <>
      <PageTitle title="Artistes" subtitle="Les artistes qui ont de la musique à écouter sur Rivendy."
        aside={(all.data?.length ?? 0) > 8 ? (
          <label className="flex h-10 w-full max-w-xs items-center gap-2 rounded-full border border-rvm-line bg-rvm-surface px-3 focus-within:border-rvm-accent sm:w-64">
            <Search className="h-4 w-4 text-rvm-muted" aria-hidden />
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrer les artistes" aria-label="Filtrer les artistes"
              className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-rvm-muted focus:outline-none focus-visible:outline-none" />
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
            <EmptyState icon={Mic2} title={f ? "Aucun artiste ne correspond" : "Les premiers artistes arrivent bientôt"}
              text={f ? "Essayez un autre nom." : "Chaque artiste est validé par Rivendy avant de publier."} />
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {shown.map((a) => <ArtistCard key={a.id} artist={a} />)}
            </div>
          )}
      </Section>
    </>
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

  return (
    <>
      <PageTitle title="Rivendy Hit"
        subtitle={week ? `Semaine du ${new Date(`${week}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} · classés selon le nombre d’auditeurs.` : "Le classement de la semaine, selon le nombre d’auditeurs."} />
      <div role="group" aria-label="Classement" className="mt-5 flex gap-2">
        {([["all", "Général"], ["country", "Mon pays"]] as const).map(([v, l]) => (
          <button key={v} type="button" onClick={() => setScope(v)} aria-pressed={scope === v}
            className={cn("h-10 rounded-full border px-4 text-sm font-semibold transition-colors",
              scope === v ? "border-rvm-accent bg-rvm-accent text-rvm-on-accent" : "border-rvm-line bg-rvm-surface text-rvm-soft hover:text-rvm-text")}>{l}</button>
        ))}
      </div>
      <div className="mt-6">
        {hit.error ? <ErrorState onRetry={hit.reload} />
          : hit.loading ? <ListSkeleton rows={8} />
          : queue.length === 0 ? <EmptyState title="Pas encore de classement pour cette semaine" text="Chaque lundi, les titres les plus écoutés de la semaine passée." />
          : (
            <>
              <PlayAllButton items={queue} label="Écouter le Hit" />
              <div className="mt-6"><TrackList items={queue} ranks={ranks} label="Rivendy Hit" /></div>
            </>
          )}
      </div>
    </>
  );
}

// ── Sortie (album, single, EP) ─────────────────────────────────────────────

export function AlbumView({ release, tracks, highlight }: { release: MusicRelease; tracks: MusicTrack[]; highlight?: string | null }) {
  const library = useMusicLibrary();
  const market = useMusicMarket();
  const queue = useMemo(() => toQueue(tracks, release), [tracks, release]);
  const more = useLoad(release.artist_id ? `more:${release.artist_id}:${market ?? ""}` : null,
    () => fetchReleasesByArtist(release.artist_id as string, market));
  const others = (more.data ?? []).filter((r) => r.id !== release.id);
  const bg = thumbUrl(release.cover_url, 480);
  const year = releaseYear(release);

  useEffect(() => {
    if (!highlight) return;
    document.getElementById(`t-${highlight}`)?.scrollIntoView({ block: "center" });
  }, [highlight]);

  return (
    <>
      <section className="relative overflow-hidden rounded-3xl border border-rvm-line bg-rvm-surface">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {bg && bg.startsWith("https://") ? <Image src={bg} alt="" fill unoptimized sizes="100vw" className="scale-125 object-cover opacity-35 blur-3xl" /> : null}
          <div className="absolute inset-0 bg-gradient-to-t from-rvm-surface via-rvm-surface/70 to-transparent" />
        </div>
        <div className="relative flex flex-col gap-6 p-5 sm:p-8 md:flex-row md:items-end">
          <Cover url={release.cover_url} size={720} alt={`Pochette de ${release.title}`} priority
            className="w-44 shadow-2xl shadow-black/60 ring-1 ring-white/10 sm:w-56 md:w-60" rounded="rounded-2xl" />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-rvm-accent">
              {releaseKindLabel(release.kind)}
              {release.is_premium ? <PremiumTag /> : null}
              {release.explicit ? <span className="rounded-sm bg-white/20 px-1 text-[10px] text-rvm-text">E</span> : null}
            </p>
            <h1 className="mt-2 text-3xl font-black leading-tight tracking-tight sm:text-5xl">{release.title}</h1>
            <p className="mt-3 text-sm text-rvm-soft">
              {release.artist_id ? <Link href={`/artist/${release.artist_id}`} className="font-semibold text-rvm-text hover:underline">{artistName(release)}</Link> : artistName(release)}
              {year ? ` · ${year}` : ""} · {releaseMeta(tracks)}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <PlayAllButton items={queue} />
              <SaveReleaseButton release={release} />
              <button type="button" onClick={() => void library.share("release", release.id, `${release.title} — ${artistName(release)}`)}
                aria-label="Partager" className={cn(iconButton, "h-11 w-11 border border-white/15")}>
                <Share2 className="h-4 w-4" aria-hidden />
              </button>
              <a href={appIntentUrl(`/musique/release/${release.id}`)} className="inline-flex items-center gap-1.5 text-sm text-rvm-muted underline md:hidden">
                <Smartphone className="h-4 w-4" aria-hidden /> Ouvrir dans l’application
              </a>
            </div>
            {release.is_premium ? (
              <p className="mt-4 flex items-center gap-1.5 text-xs text-rvm-muted">
                <Lock className="h-3.5 w-3.5 text-rvm-premium" aria-hidden /> Sortie Premium : écoute complète avec{" "}
                <Link href="/plus" className="font-semibold text-rvm-accent hover:underline">Rivendy+</Link>, extraits de 30 s sinon.
              </p>
            ) : null}
          </div>
        </div>
      </section>
      {release.description ? <p className="mt-6 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-rvm-soft">{release.description}</p> : null}
      <div className="mt-8">
        {queue.length === 0 ? <EmptyState title="Les titres de cette sortie arrivent bientôt" />
          : <TrackList items={queue} numbered showCover={false} showAlbum={false} hideRelease highlight={highlight} label={`Titres de ${release.title}`} />}
      </div>
      {others.length > 0 ? (
        <Section title={`Plus de ${artistName(release)}`} href={release.artist_id ? `/artist/${release.artist_id}` : undefined} hrefLabel="Voir l’artiste">
          <CardRow label={`Plus de ${artistName(release)}`}>{others.map((r) => <ReleaseCard key={r.id} release={r} />)}</CardRow>
        </Section>
      ) : null}
    </>
  );
}

/** Page d'une sortie chargée côté navigateur (titre ouvert par la recherche). */
export function AlbumClientLoader({ id, highlight }: { id: string; highlight?: string | null }) {
  const data = useLoad(`album:${id}`, () => fetchRelease(id));
  if (data.error) return <ErrorState onRetry={data.reload} />;
  if (!data.data) return <ListSkeleton rows={8} />;
  if (!data.data.release) return <EmptyState title="Cette sortie n’est pas disponible" />;
  return <AlbumView release={data.data.release} tracks={data.data.tracks} highlight={highlight} />;
}

// ── Artiste ────────────────────────────────────────────────────────────────

export function ArtistView({ artist }: { artist: MusicArtist }) {
  const { user } = useAuth();
  const dialogs = useDialogs();
  const library = useMusicLibrary();
  const market = useMusicMarket();
  const [following, setFollowingState] = useState(false);
  const [busy, setBusy] = useState(false);
  const page = useLoad(`artist:${artist.id}:${market ?? ""}`, async () => {
    const [top, releases] = await Promise.all([
      fetchArtistTopTracks(artist.id, market).catch(() => [] as MusicTrack[]),
      fetchReleasesByArtist(artist.id, market),
    ]);
    return { top, releases };
  });

  useEffect(() => {
    if (!user || !artist.user_id) { setFollowingState(false); return; }
    let alive = true;
    void isFollowing(artist.user_id).then((v) => { if (alive) setFollowingState(v); }).catch(() => {});
    return () => { alive = false; };
  }, [user, artist.user_id]);
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<LibraryEventDetail>).detail;
      if (d?.kind === "follow" && d.id === artist.user_id) setFollowingState(d.on);
    };
    window.addEventListener(MUSIC_LIBRARY_EVENT, on);
    return () => window.removeEventListener(MUSIC_LIBRARY_EVENT, on);
  }, [artist.user_id]);

  async function toggleFollow() {
    if (!artist.user_id) return;
    if (!user) { library.requireLogin({ kind: "follow", id: artist.user_id, label: artist.name }); return; }
    setBusy(true);
    const err = await setFollowing(artist.user_id, !following);
    setBusy(false);
    if (err) { dialogs.notify(err === "blocked" ? "Action impossible avec ce compte." : "Action impossible pour l’instant.", "error"); return; }
    setFollowingState(!following);
  }

  const queue = useMemo(() => toQueue(page.data?.top ?? []), [page.data]);
  const banner = thumbUrl(artist.banner_url, 720);

  return (
    <>
      <section className="relative overflow-hidden rounded-3xl border border-rvm-line bg-rvm-surface">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {banner && banner.startsWith("https://") ? (
            // Bannière large : cadrée sur le haut, où sont les visages.
            <Image src={banner} alt="" fill unoptimized sizes="100vw" className="object-cover object-[50%_30%] opacity-60" />
          ) : <div className="absolute -right-20 -top-24 h-80 w-80 rounded-full bg-rvm-brand/35 blur-3xl" />}
          <div className="absolute inset-0 bg-gradient-to-t from-rvm-surface via-rvm-surface/75 to-rvm-surface/10" />
        </div>
        <div className="relative flex flex-col items-center gap-5 px-5 pb-7 pt-16 text-center sm:flex-row sm:items-end sm:px-8 sm:text-left">
          <div className="w-32 shrink-0 overflow-hidden rounded-full shadow-2xl shadow-black/60 ring-4 ring-rvm-surface sm:w-40">
            <Cover url={artist.avatar_url} size={480} alt={artist.name} rounded="rounded-full" className="w-full" priority />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-rvm-accent">Artiste</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-5xl">{artist.name}</h1>
            {artist.genre ? <p className="mt-1 text-sm text-rvm-soft">{artist.genre}</p> : null}
            <div className="mt-4 flex flex-wrap justify-center gap-3 sm:justify-start">
              <PlayAllButton items={queue} />
              {artist.user_id ? (
                <button type="button" onClick={toggleFollow} disabled={busy} aria-pressed={following}
                  className={cn(secondaryButton, following && "border-rvm-accent text-rvm-accent")}>
                  {following ? <UserCheck className="h-4 w-4" aria-hidden /> : <UserPlus className="h-4 w-4" aria-hidden />}
                  {following ? "Abonné" : "Suivre"}
                </button>
              ) : null}
              <button type="button" onClick={() => void library.share("artist", artist.id, artist.name)} aria-label="Partager"
                className={cn(iconButton, "h-11 w-11 border border-white/15")}>
                <Share2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </section>
      {artist.bio ? <p className="mt-6 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-rvm-soft">{artist.bio}</p> : null}
      {page.error ? <div className="mt-8"><ErrorState onRetry={page.reload} /></div> : (
        <>
          <Section title="Titres populaires">
            {!page.data ? <ListSkeleton /> : queue.length === 0
              ? <p className="text-sm text-rvm-muted">Pas encore de titres populaires.</p>
              : <TrackList items={queue} label={`Titres populaires de ${artist.name}`} />}
          </Section>
          <Section title="Sorties">
            {!page.data ? <CardRowSkeleton count={5} /> : <ReleaseGrid releases={page.data.releases} empty="Pas encore de sortie." />}
          </Section>
        </>
      )}
    </>
  );
}
