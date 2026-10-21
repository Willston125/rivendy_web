"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clock, Lock, Play, RotateCcw, Search, Smartphone, Trash2, X } from "lucide-react";
import { ShareButton } from "@/components/ui/share-button";
import { useAuth } from "@/features/auth/auth-provider";
import { useHomeMarket } from "@/features/media/use-home-market";
import { ProductVideoPlayer } from "@/features/products/product-video-player";
import { useDialogs } from "@/features/ui/dialogs";
import { cn } from "@/lib/utils/cn";
import {
  clearTitleHistory, fetchCatalog, fetchMyList, fetchProgress, fetchTitleHistory, fetchTitlesByIds, fetchTopWeek,
  forgetProgress, searchTitles,
} from "./play-api";
import { appIntentUrl } from "./play-link-page";
import {
  ageLabel, currentEpisode, durationLabel, hasTrailer, inTerritory, isArtistClip, isDocumentary, isFinished, isListable,
  isVideoReady, kindLabel, resumeAt, titleMeta, titlePath, wideImage, cover,
  type PlayEpisode, type PlayTitle, type WatchProgress,
} from "./play-logic";
import {
  MarketPrompt, MyListButton, PlayNav, PlayPage, PremiumBadge, Section, Spinner, TitleGrid, TitleRow, progressRatio,
} from "./play-ui";

/**
 * Rivendy Play sur le site — écrans (Omnicanal lot C, 2026-10-22). Mêmes
 * tables et fonctions que l'app : une position, Ma liste ou l'historique
 * enregistrés ici se retrouvent dans l'app, et inversement.
 */

const watchPath = (t: Pick<PlayTitle, "id" | "kind">) => (t.kind === "clip" ? `/play/watch/clip/${t.id}` : `/play/watch/movie/${t.id}`);

function LoginPrompt({ next, text }: { next: string; text: string }) {
  return (
    <p className="rounded-xl bg-white/5 px-4 py-3 text-sm text-white/80">
      <Link href={`/auth/login?next=${encodeURIComponent(next)}`} className="font-bold text-[#5EEAD4] underline">Connectez-vous</Link> {text}
    </p>
  );
}

/** Positions non terminées, la plus récente d'abord (une par titre). */
function unfinished(progress: WatchProgress[]): WatchProgress[] {
  const seen = new Set<string>();
  return progress.filter((p) => {
    if (seen.has(p.title_id) || isFinished(p.position_seconds, p.duration_seconds) || p.position_seconds < 30) return false;
    seen.add(p.title_id);
    return true;
  });
}

// ── Accueil ────────────────────────────────────────────────────────────────

export function PlayHomeView() {
  const market = useHomeMarket();
  const { user } = useAuth();
  const [catalog, setCatalog] = useState<PlayTitle[] | null>(null);
  const [clips, setClips] = useState<PlayTitle[]>([]);
  const [top, setTop] = useState<PlayTitle[]>([]);
  const [progress, setProgress] = useState<WatchProgress[]>([]);
  const [resume, setResume] = useState<PlayTitle[]>([]);

  useEffect(() => {
    if (!market) return;
    let alive = true;
    void (async () => {
      const [cat, cl, topIds] = await Promise.all([fetchCatalog(market), fetchCatalog(market, "clip", 30), fetchTopWeek(market)]);
      const topTitles = await fetchTitlesByIds(topIds);
      if (!alive) return;
      setCatalog(cat.filter(isListable));
      setClips(cl.filter(isListable));
      setTop(topTitles.filter(isListable));
    })();
    return () => { alive = false; };
  }, [market]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void (async () => {
      const p = await fetchProgress();
      const titles = await fetchTitlesByIds(unfinished(p).map((x) => x.title_id).slice(0, 20));
      if (alive) { setProgress(p); setResume(titles.filter(isListable)); }
    })();
    return () => { alive = false; };
  }, [user]);

  const rows = useMemo(() => {
    const all = catalog ?? [];
    const films = all.filter((t) => t.kind === "film");
    const series = all.filter((t) => t.kind === "serie");
    const docs = all.filter((t) => isDocumentary(t.genre));
    const byGenre = new Map<string, PlayTitle[]>();
    for (const t of all) {
      const g = t.genre?.trim();
      if (!g || isDocumentary(g)) continue;
      byGenre.set(g, [...(byGenre.get(g) ?? []), t]);
    }
    const genres = [...byGenre.entries()].filter(([, list]) => list.length >= 3).sort((a, b) => b[1].length - a[1].length).slice(0, 4);
    const featured = [...all].filter((t) => t.featured_rank != null).sort((a, b) => Number(a.featured_rank) - Number(b.featured_rank))[0] ?? all[0] ?? null;
    return { films, series, docs, genres, featured };
  }, [catalog]);

  return (
    <PlayPage>
      {rows.featured ? <Hero title={rows.featured} /> : (
        <header className="rounded-3xl bg-gradient-to-br from-[#0F3B3E] to-[#071719] px-6 py-8">
          <p className="text-sm font-bold uppercase tracking-widest text-[#5EEAD4]">Rivendy Play</p>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">Films, séries et clips</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/70">Le même catalogue que dans l’application, avec le même compte : la lecture reprend où vous l’avez laissée.</p>
        </header>
      )}
      <div className="mt-6"><PlayNav /></div>
      {!user ? <LoginPrompt next="/play" text="pour regarder, reprendre vos films et retrouver Ma liste." /> : null}
      {!market ? (!user ? <div className="mt-6"><MarketPrompt /></div> : <Spinner />) : catalog === null ? <Spinner /> : (
        <>
          {resume.length > 0 ? (
            <Section title="Continuer à regarder">
              <TitleRow titles={resume} progressOf={(t) => (t.kind === "film" ? progressRatio(progress, t.id) : null)} />
            </Section>
          ) : null}
          {top.length > 0 ? <Section title="Top 10 de la semaine"><TitleRow titles={top} ranked /></Section> : null}
          <Section title="Nouveautés"><TitleRow titles={catalog.slice(0, 20)} /></Section>
          {rows.films.length > 0 ? <Section title="Films" href="/play/movies"><TitleRow titles={rows.films.slice(0, 20)} /></Section> : null}
          {rows.series.length > 0 ? <Section title="Séries" href="/play/series"><TitleRow titles={rows.series.slice(0, 20)} /></Section> : null}
          {clips.length > 0 ? <Section title="Clips" href="/play/clips"><TitleRow titles={clips.slice(0, 20)} /></Section> : null}
          {rows.docs.length > 0 ? <Section title="Documentaires"><TitleRow titles={rows.docs.slice(0, 20)} /></Section> : null}
          {rows.genres.map(([g, list]) => <Section key={g} title={g}><TitleRow titles={list.slice(0, 20)} /></Section>)}
          {catalog.length === 0 && clips.length === 0 ? <p className="mt-10 text-sm text-white/60">Le catalogue de votre pays arrive bientôt.</p> : null}
        </>
      )}
    </PlayPage>
  );
}

function Hero({ title }: { title: PlayTitle }) {
  const img = wideImage(title);
  return (
    <header className="relative overflow-hidden rounded-3xl bg-[#0B1F21]">
      {img && img.startsWith("https://") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
      ) : null}
      <div className="relative bg-gradient-to-t from-[#071719] via-[#071719]/70 to-transparent px-6 pb-8 pt-24 sm:pt-40">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#5EEAD4]">À la une · {kindLabel(title.kind)}</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-black text-white sm:text-5xl">{title.title}</h1>
        <p className="mt-2 text-sm text-white/70">{titleMeta(title)}</p>
        {title.synopsis ? <p className="mt-3 line-clamp-3 max-w-2xl text-sm leading-6 text-white/80">{title.synopsis}</p> : null}
        <div className="mt-5 flex flex-wrap gap-3">
          {title.kind !== "serie" && isVideoReady(title) ? (
            <Link href={watchPath(title)} className="flex h-11 items-center gap-2 rounded-full bg-[#00BFA5] px-6 text-sm font-black text-[#071719] hover:bg-[#5EEAD4]">
              <Play className="h-4 w-4 fill-current" /> Regarder
            </Link>
          ) : null}
          <Link href={titlePath(title)} className="flex h-11 items-center rounded-full border border-white/25 px-6 text-sm font-bold text-white hover:bg-white/10">Plus d’infos</Link>
        </div>
      </div>
    </header>
  );
}

// ── Catalogues ─────────────────────────────────────────────────────────────

export function CatalogView({ kind, heading, intro }: { kind: "film" | "serie" | "clip"; heading: string; intro: string }) {
  const market = useHomeMarket();
  const { user } = useAuth();
  const [titles, setTitles] = useState<PlayTitle[] | null>(null);
  const [genre, setGenre] = useState<string | null>(null);

  useEffect(() => {
    if (!market) return;
    let alive = true;
    void fetchCatalog(market, kind).then((list) => { if (alive) setTitles(list.filter(isListable)); });
    return () => { alive = false; };
  }, [market, kind]);

  const genres = useMemo(() => [...new Set((titles ?? []).map((t) => t.genre?.trim()).filter((g): g is string => !!g))].sort(), [titles]);
  const shown = (titles ?? []).filter((t) => !genre || t.genre?.trim() === genre);

  return (
    <PlayPage>
      <h1 className="text-3xl font-black text-white">{heading}</h1>
      <p className="mt-1 text-sm text-white/65">{intro}</p>
      <div className="mt-5"><PlayNav /></div>
      {!market ? (!user ? <MarketPrompt /> : <Spinner />) : titles === null ? <Spinner /> : (
        <>
          {genres.length > 1 ? (
            <div className="mb-5 flex flex-wrap gap-2">
              {[null, ...genres].map((g) => (
                <button key={g ?? "tous"} type="button" onClick={() => setGenre(g)}
                  className={cn("rounded-full px-3 py-1.5 text-xs font-bold", genre === g ? "bg-[#00BFA5] text-[#071719]" : "bg-white/10 text-white hover:bg-white/15")}>
                  {g ?? "Tous"}
                </button>
              ))}
            </div>
          ) : null}
          <TitleGrid titles={shown} />
        </>
      )}
    </PlayPage>
  );
}

// ── Fiches ─────────────────────────────────────────────────────────────────

function TitleHeader({ title, extra }: { title: PlayTitle; extra?: string }) {
  const img = wideImage(title);
  const poster = cover(title);
  return (
    <header className="relative overflow-hidden rounded-3xl bg-[#0B1F21]">
      {img && img.startsWith("https://") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30 blur-[1px]" />
      ) : null}
      <div className="relative flex flex-col gap-6 bg-gradient-to-t from-[#071719] via-[#071719]/80 to-[#071719]/30 px-6 py-8 sm:flex-row sm:items-end">
        {poster && poster.startsWith("https://") && title.kind !== "clip" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt={title.title} className="aspect-[2/3] w-36 shrink-0 rounded-xl object-cover shadow-2xl sm:w-44" />
        ) : null}
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#5EEAD4]">Rivendy Play · {kindLabel(title.kind)}</p>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">{title.title}</h1>
          {isArtistClip(title) && title.artist ? (
            <p className="mt-1 text-sm font-semibold text-white/80">
              <Link href={`/artist/${title.artist_id}`} className="hover:text-[#5EEAD4] hover:underline">{title.artist}</Link>
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/70">
            <span>{extra ?? titleMeta(title)}</span>
            {title.age_rating ? <span className="rounded border border-white/30 px-1.5 text-xs">{ageLabel(title.age_rating)}</span> : null}
            {title.is_premium && title.kind !== "clip" ? <PremiumBadge /> : null}
          </div>
        </div>
      </div>
    </header>
  );
}

/** Le titre est-il visible dans le marché du compte ? (le serveur revérifie) */
function useTerritory(title: PlayTitle): boolean {
  const market = useHomeMarket();
  return !market || inTerritory(title.play_title_countries, market);
}

function useProgress(): WatchProgress[] {
  const { user } = useAuth();
  const [progress, setProgress] = useState<WatchProgress[]>([]);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    void fetchProgress().then((p) => { if (alive) setProgress(p); });
    return () => { alive = false; };
  }, [user]);
  return user ? progress : [];
}

function Unavailable({ text }: { text: string }) {
  return <p className="mt-6 rounded-xl bg-white/5 px-4 py-3 text-sm text-white/75">{text}</p>;
}

function PremiumNote({ title }: { title: PlayTitle }) {
  if (!title.is_premium || title.kind === "clip") return null;
  return (
    <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-white/70">
      <Lock className="h-4 w-4 text-[#5EEAD4]" /> Inclus dans Rivendy+, sur le site et dans l’application.
      <Link href="/plus" className="font-bold text-[#5EEAD4] hover:underline">Découvrir Rivendy+</Link>
    </p>
  );
}

function SecondaryActions({ title }: { title: PlayTitle }) {
  return (
    <>
      <MyListButton titleId={title.id} />
      <ShareButton variant="button" title={title.title} text={`Regardez « ${title.title} » sur Rivendy Play`}
        className="h-11 rounded-full border border-white/25 px-5 text-sm font-bold text-white hover:bg-white/10" />
      <a href={appIntentUrl(`/play/title/${title.id}`)}
        className="flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white/75 hover:bg-white/10 md:hidden">
        <Smartphone className="h-4 w-4" /> Ouvrir dans l’app
      </a>
    </>
  );
}

/** Fiche film ou clip. */
export function TitleView({ title }: { title: PlayTitle }) {
  const progress = useProgress();
  const allowed = useTerritory(title);
  const p = progress.find((x) => x.title_id === title.id && !x.episode_id);
  const at = p ? resumeAt(p.position_seconds, p.duration_seconds) : 0;
  const ready = isVideoReady(title);
  const trailer = hasTrailer(title) && title.trailer_uid ? title.trailer_uid : null;

  return (
    <PlayPage>
      <TitleHeader title={title} />
      {!allowed ? <Unavailable text="Ce titre n’est pas disponible dans votre pays." /> : !ready ? (
        <Unavailable text="Bientôt disponible. Ajoutez-le à Ma liste pour le retrouver." />
      ) : null}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {allowed && ready ? (
          <>
            <Link href={watchPath(title)} className="flex h-11 items-center gap-2 rounded-full bg-[#00BFA5] px-6 text-sm font-black text-[#071719] hover:bg-[#5EEAD4]">
              <Play className="h-4 w-4 fill-current" /> {at > 0 ? `Reprendre (${durationLabel(at) || "0 min"})` : title.kind === "clip" ? "Regarder le clip" : "Regarder"}
            </Link>
            {at > 0 ? (
              <Link href={`${watchPath(title)}?start=0`} className="flex h-11 items-center gap-2 rounded-full border border-white/25 px-5 text-sm font-bold text-white hover:bg-white/10">
                <RotateCcw className="h-4 w-4" /> Recommencer
              </Link>
            ) : null}
          </>
        ) : null}
        <SecondaryActions title={title} />
      </div>
      <PremiumNote title={title} />
      {title.synopsis ? <p className="mt-6 max-w-3xl whitespace-pre-line text-sm leading-7 text-white/80">{title.synopsis}</p> : null}
      {trailer ? (
        <Section title="Bande-annonce">
          <div className="relative aspect-video w-full max-w-3xl overflow-hidden rounded-2xl bg-black">
            <ProductVideoPlayer uid={trailer} thumbnail={wideImage(title)} title={`Bande-annonce — ${title.title}`} />
          </div>
        </Section>
      ) : null}
      <div className="mt-10"><PlayNav /></div>
    </PlayPage>
  );
}

/** Fiche série : saisons, épisodes, reprise de l'épisode en cours. */
export function SeriesView({ title, episodes }: { title: PlayTitle; episodes: PlayEpisode[] }) {
  const progress = useProgress();
  const allowed = useTerritory(title);
  const mine = progress.filter((p) => p.title_id === title.id);
  const { episode: current } = currentEpisode(episodes, mine);
  const seasons = [...new Set(episodes.map((e) => e.season))].sort((a, b) => a - b);
  const [season, setSeason] = useState<number | null>(null);
  const shownSeason = season ?? current?.season ?? seasons[0] ?? 1;
  const posOf = (e: PlayEpisode) => mine.find((p) => p.episode_id === e.id);
  const trailer = hasTrailer(title) && title.trailer_uid ? title.trailer_uid : null;

  return (
    <PlayPage>
      <TitleHeader title={title} extra={titleMeta(title, episodes.length)} />
      {!allowed ? <Unavailable text="Cette série n’est pas disponible dans votre pays." /> : episodes.length === 0 ? (
        <Unavailable text="Les épisodes arrivent bientôt. Ajoutez la série à Ma liste pour la retrouver." />
      ) : null}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {allowed && current ? (
          <Link href={`/play/watch/episode/${current.id}`}
            className="flex h-11 items-center gap-2 rounded-full bg-[#00BFA5] px-6 text-sm font-black text-[#071719] hover:bg-[#5EEAD4]">
            <Play className="h-4 w-4 fill-current" /> {mine.length > 0 ? "Reprendre" : "Regarder"} S{current.season} É{current.episode_number}
          </Link>
        ) : null}
        <SecondaryActions title={title} />
      </div>
      <PremiumNote title={title} />
      {title.synopsis ? <p className="mt-6 max-w-3xl whitespace-pre-line text-sm leading-7 text-white/80">{title.synopsis}</p> : null}

      {episodes.length > 0 ? (
        <Section title="Épisodes">
          {seasons.length > 1 ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {seasons.map((s) => (
                <button key={s} type="button" onClick={() => setSeason(s)}
                  className={cn("rounded-full px-3 py-1.5 text-xs font-bold", shownSeason === s ? "bg-[#00BFA5] text-[#071719]" : "bg-white/10 text-white hover:bg-white/15")}>
                  Saison {s}
                </button>
              ))}
            </div>
          ) : null}
          <ol className="space-y-3">
            {episodes.filter((e) => e.season === shownSeason).map((e) => {
              const p = posOf(e);
              const ratio = p && p.duration_seconds > 0 ? Math.min(1, p.position_seconds / p.duration_seconds) : 0;
              const locked = !!title.is_premium && !e.is_free_preview;
              return (
                <li key={e.id} className={cn("flex gap-4 rounded-2xl bg-[#0B1F21] p-3", current?.id === e.id && "ring-1 ring-[#00BFA5]/60")}>
                  <Link href={`/play/watch/episode/${e.id}`} className="relative block w-36 shrink-0 sm:w-48">
                    {e.thumbnail_url?.startsWith("https://") || wideImage(title)?.startsWith("https://") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={(e.thumbnail_url?.startsWith("https://") ? e.thumbnail_url : wideImage(title)) ?? ""} alt="" className="aspect-video w-full rounded-lg object-cover" />
                    ) : <div className="aspect-video w-full rounded-lg bg-[#0F2A2D]" />}
                    <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30 opacity-0 transition hover:opacity-100">
                      <Play className="h-8 w-8 fill-white text-white" />
                    </span>
                    {ratio > 0 ? <span className="absolute inset-x-1.5 bottom-1.5 h-1 overflow-hidden rounded bg-white/25"><span className="block h-full bg-[#00BFA5]" style={{ width: `${Math.round(ratio * 100)}%` }} /></span> : null}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link href={`/play/episode/${e.id}`} className="font-bold text-white hover:text-[#5EEAD4]">
                      {e.episode_number}. {e.title}
                    </Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-white/55">
                      {durationLabel(e.duration_seconds)}
                      {locked ? <span className="inline-flex items-center gap-1 text-[#5EEAD4]"><Lock className="h-3 w-3" /> Rivendy+</span> : null}
                      {title.is_premium && e.is_free_preview ? <span className="text-[#5EEAD4]">Offert</span> : null}
                    </p>
                    {e.synopsis ? <p className="mt-1 line-clamp-2 text-sm text-white/70">{e.synopsis}</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </Section>
      ) : null}
      {trailer ? (
        <Section title="Bande-annonce">
          <div className="relative aspect-video w-full max-w-3xl overflow-hidden rounded-2xl bg-black">
            <ProductVideoPlayer uid={trailer} thumbnail={wideImage(title)} title={`Bande-annonce — ${title.title}`} />
          </div>
        </Section>
      ) : null}
      <div className="mt-10"><PlayNav /></div>
    </PlayPage>
  );
}

/** Fiche épisode (publique, sans média). */
export function EpisodeView({ episode, series }: { episode: PlayEpisode; series: PlayTitle }) {
  const progress = useProgress();
  const allowed = useTerritory(series);
  const p = progress.find((x) => x.episode_id === episode.id);
  const at = p ? resumeAt(p.position_seconds, p.duration_seconds) : 0;
  const locked = !!series.is_premium && !episode.is_free_preview;
  return (
    <PlayPage>
      <Link href={`/play/series/${series.id}`} className="text-sm font-semibold text-[#5EEAD4] hover:underline">{series.title}</Link>
      <h1 className="mt-2 text-3xl font-black text-white">S{episode.season} É{episode.episode_number} — {episode.title}</h1>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/65">
        {durationLabel(episode.duration_seconds)}
        {locked ? <PremiumBadge /> : null}
      </p>
      {(episode.thumbnail_url || wideImage(series))?.startsWith("https://") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={(episode.thumbnail_url || wideImage(series)) ?? ""} alt="" className="mt-6 aspect-video w-full max-w-3xl rounded-2xl object-cover" />
      ) : null}
      {!allowed ? <Unavailable text="Cette série n’est pas disponible dans votre pays." /> : (
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/play/watch/episode/${episode.id}`} className="flex h-11 items-center gap-2 rounded-full bg-[#00BFA5] px-6 text-sm font-black text-[#071719] hover:bg-[#5EEAD4]">
            <Play className="h-4 w-4 fill-current" /> {at > 0 ? `Reprendre (${durationLabel(at) || "0 min"})` : "Regarder"}
          </Link>
          <Link href={`/play/series/${series.id}`} className="flex h-11 items-center rounded-full border border-white/25 px-5 text-sm font-bold text-white hover:bg-white/10">Tous les épisodes</Link>
        </div>
      )}
      {locked ? <PremiumNote title={series} /> : null}
      {episode.synopsis ? <p className="mt-6 max-w-3xl whitespace-pre-line text-sm leading-7 text-white/80">{episode.synopsis}</p> : null}
      <div className="mt-10"><PlayNav /></div>
    </PlayPage>
  );
}

// ── Compte : Ma liste, historique ──────────────────────────────────────────

export function MyListView() {
  const { user, loading } = useAuth();
  const [titles, setTitles] = useState<PlayTitle[] | null>(null);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    void fetchMyList().then(fetchTitlesByIds).then((t) => { if (alive) setTitles(t); });
    return () => { alive = false; };
  }, [user]);
  return (
    <PlayPage>
      <h1 className="text-3xl font-black text-white">Ma liste</h1>
      <p className="mt-1 text-sm text-white/65">La même liste que dans l’application.</p>
      <div className="mt-5"><PlayNav /></div>
      {loading ? <Spinner /> : !user ? <LoginPrompt next="/play/my-list" text="pour retrouver Ma liste." /> : titles === null ? <Spinner /> : (
        titles.length === 0 ? <p className="text-sm text-white/60">Ajoutez des films et des séries avec le bouton « Ma liste » de leur fiche.</p> : <TitleGrid titles={titles} />
      )}
    </PlayPage>
  );
}

export function HistoryView() {
  const { user, loading } = useAuth();
  const { confirm, notify } = useDialogs();
  const [history, setHistory] = useState<Array<{ title: PlayTitle; viewed_at: string }> | null>(null);
  const [progress, setProgress] = useState<WatchProgress[]>([]);
  const [inProgress, setInProgress] = useState<PlayTitle[]>([]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void (async () => {
      const [h, p] = await Promise.all([fetchTitleHistory(), fetchProgress()]);
      const t = await fetchTitlesByIds(unfinished(p).map((x) => x.title_id));
      if (alive) { setHistory(h); setProgress(p); setInProgress(t); }
    })();
    return () => { alive = false; };
  }, [user]);

  const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <PlayPage>
      <h1 className="text-3xl font-black text-white">Historique</h1>
      <p className="mt-1 text-sm text-white/65">Ce que vous avez regardé, sur le site et dans l’application.</p>
      <div className="mt-5"><PlayNav /></div>
      {loading ? <Spinner /> : !user ? <LoginPrompt next="/play/history" text="pour voir votre historique." /> : history === null ? <Spinner /> : (
        <>
          {inProgress.length > 0 ? (
            <Section title="En cours">
              <ul className="space-y-2">
                {inProgress.map((t) => {
                  const ratio = progressRatio(progress, t.id);
                  return (
                    <li key={t.id} className="flex items-center gap-3 rounded-xl bg-[#0B1F21] px-3 py-2">
                      <Link href={titlePath(t)} className="min-w-0 flex-1">
                        <p className="truncate font-bold text-white">{t.title}</p>
                        <p className="text-xs text-white/55">{kindLabel(t.kind)}{t.kind === "film" && ratio ? ` · ${Math.round(ratio * 100)} % vus` : ""}</p>
                      </Link>
                      <button type="button" aria-label={`Retirer « ${t.title} » de En cours`}
                        onClick={async () => {
                          if (await forgetProgress(t.id)) { setInProgress((l) => l.filter((x) => x.id !== t.id)); notify("Retiré de En cours.", "success"); }
                          else notify("Action impossible pour l’instant.", "error");
                        }}
                        className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white">
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Section>
          ) : null}
          <Section title="Déjà vus">
            {history.length === 0 ? <p className="text-sm text-white/60">Rien pour le moment.</p> : (
              <>
                <ul className="space-y-2">
                  {history.map((h) => (
                    <li key={`${h.title.id}-${h.viewed_at}`}>
                      <Link href={titlePath(h.title)} className="flex items-center gap-3 rounded-xl bg-[#0B1F21] px-3 py-2 hover:bg-[#0F2A2D]">
                        <Clock className="h-4 w-4 shrink-0 text-[#5EEAD4]" />
                        <span className="min-w-0 flex-1 truncate font-semibold text-white">{h.title.title}</span>
                        <span className="text-xs text-white/50">{dateLabel(h.viewed_at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <button type="button"
                  onClick={async () => {
                    const ok = await confirm({ title: "Effacer l’historique ?", message: "Les vidéos vues disparaissent de l’historique, sur le site et dans l’application.", confirmLabel: "Effacer", danger: true });
                    if (!ok) return;
                    if (await clearTitleHistory()) { setHistory([]); notify("Historique effacé.", "success"); }
                    else notify("Action impossible pour l’instant.", "error");
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10">
                  <Trash2 className="h-4 w-4" /> Effacer l’historique
                </button>
              </>
            )}
          </Section>
        </>
      )}
    </PlayPage>
  );
}

// ── Recherche ──────────────────────────────────────────────────────────────

export function SearchView({ initial }: { initial: string }) {
  const market = useHomeMarket();
  const { user } = useAuth();
  const [query, setQuery] = useState(initial);
  const [results, setResults] = useState<PlayTitle[] | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!market || q.length < 2) { setResults(null); return; }
    let alive = true;
    const timer = window.setTimeout(() => {
      void searchTitles(market, q).then((r) => { if (alive) setResults(r.filter(isListable)); });
    }, 300);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [market, query]);

  return (
    <PlayPage>
      <h1 className="text-3xl font-black text-white">Recherche</h1>
      <div className="mt-5"><PlayNav /></div>
      {!market && !user ? <MarketPrompt /> : (
        <>
          <label className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-3">
            <Search className="h-4 w-4 text-white/60" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Film, série, clip, artiste, genre…" autoFocus
              className="w-full bg-transparent text-white placeholder:text-white/45 focus:outline-none" />
          </label>
          <div className="mt-6">
            {results === null ? <p className="text-sm text-white/55">Tapez au moins deux lettres.</p>
              : results.length === 0 ? <p className="text-sm text-white/60">Aucun résultat.</p> : <TitleGrid titles={results} />}
          </div>
        </>
      )}
    </PlayPage>
  );
}
