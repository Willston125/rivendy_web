"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Bookmark, Clock, Film, History, Lock, Music, Play, RotateCcw, Search, SearchX, Smartphone, Trash2, Tv, X } from "lucide-react";
import { ShareButton } from "@/components/ui/share-button";
import { useAuth } from "@/features/auth/auth-provider";
import { useHomeMarket } from "@/features/media/use-home-market";
import { ProductVideoPlayer } from "@/features/products/product-video-player";
import { useDialogs } from "@/features/ui/dialogs";
import { cn } from "@/lib/utils/cn";
import { clearTitleHistory, fetchCatalog, fetchProgress, fetchTitleHistory, fetchTitlesByIds, forgetProgress } from "./play-api";
import { ClipCard, MediaCard, PlayImg, ProgressTrack } from "./play-cards";
import { CinematicScene, HERO_TITLE, HeroEyebrow, HeroMetadata, PlayButton, sceneTextOffset, useSceneBackdrop } from "./play-hero";
import { useMyListTitles, useProgress } from "./play-hooks";
import { appIntentUrl } from "./play-link-page";
import { usePlayList } from "./play-list";
import {
  currentEpisode, durationLabel, foldText, genresOf, hasTrailer, heroTitleSize, inTerritory, isArtistClip, isListable,
  isVideoReady, kindLabel, kindOf, landscapeArt, posterArt, remainingLabel, resumeAt, resumeEntries, resumeHref,
  searchTitles, titlePath,
  type PlayEpisode, type PlayTitle, type WatchProgress,
} from "./play-logic";
import { usePlaySearch } from "./play-search";
import { usePageBackdrop } from "./play-shell";
import {
  CARD_SIZES, CARD_WIDTHS, WIDE_SIZES, btnGhost, btnPrimary, btnSecondary, display, motion, sceneBleed,
} from "./play-theme";
import {
  EmptyState, ErrorState, FEW_TITLES, FilterChips, GridSkeleton, ListButton, MarketPrompt, MediaGrid, PageHeading, PlayPage,
  PremiumBadge, Section, Spinner, WideGrid, progressRatio, useLoginHref, useMarketPending,
} from "./play-ui";

/**
 * Rivendy Play sur le site — catalogues, fiches, Ma liste, récents et
 * recherche (« Emerald Cinema », 2026-10-24 ; l'accueil est dans
 * play-home.tsx). Mêmes tables et fonctions que l'app (lot C) : une
 * position, Ma liste ou l'historique enregistrés ici se retrouvent dans
 * l'app, et inversement.
 */

// ── Catalogues ─────────────────────────────────────────────────────────────

const CATALOG_ICON = { film: Film, serie: Tv, clip: Music } as const;

export function CatalogView({ kind, heading, intro }: { kind: "film" | "serie" | "clip"; heading: string; intro: string }) {
  const market = useHomeMarket();
  const pending = useMarketPending();
  const progress = useProgress();
  const [round, setRound] = useState(0);
  const [data, setData] = useState<{ key: string; titles: PlayTitle[] | null } | null>(null);
  const [genre, setGenre] = useState<string | null>(null);
  const key = market ? `${market}:${kind}:${round}` : null;

  useEffect(() => {
    if (!market || !key) return;
    let alive = true;
    void fetchCatalog(market, kind)
      .then((list) => { if (alive) setData({ key, titles: list.filter(isListable) }); })
      .catch(() => { if (alive) setData({ key, titles: null }); });
    return () => { alive = false; };
  }, [market, kind, key]);

  const current = data && data.key === key ? data : null;
  const titles = useMemo(() => current?.titles ?? [], [current]);
  const genres = useMemo(() => genresOf(titles), [titles]);
  const shown = genre ? titles.filter((t) => foldText(t.genre?.trim() ?? "") === foldText(genre)) : titles;
  const clips = kind === "clip";
  const layout = clips ? "wide" : "card";
  const noun = clips ? "clip" : kind === "serie" ? "série" : "film";
  // Ambiance : la première carte, floutée en haut de la page (même image que la carte).
  const first = shown[0] ?? null;
  usePageBackdrop(first ? (clips ? landscapeArt(first) ?? posterArt(first) : posterArt(first) ?? landscapeArt(first)) : null,
    CARD_WIDTHS, clips ? WIDE_SIZES : CARD_SIZES);

  return (
    <PlayPage>
      <PageHeading title={heading} intro={intro} icon={CATALOG_ICON[kind]}
        count={current?.titles && titles.length > 0 ? titles.length : null} unit={noun}>
        {/* Les clips gardent leur identité : celle des artistes, toujours gratuits. */}
        {clips ? (
          <span className="inline-flex h-9 items-center gap-2 rounded-full border border-rvp-edge-strong bg-rvp-accent/10 px-3.5 text-[13px] font-semibold text-rvp-accent">
            <Music className="h-4 w-4" aria-hidden /> Toujours gratuits
          </span>
        ) : null}
      </PageHeading>
      {!market ? (
        pending ? <GridSkeleton layout={layout} /> : <MarketPrompt />
      ) : current === null ? (
        <GridSkeleton layout={layout} />
      ) : current.titles === null ? (
        <ErrorState onRetry={() => setRound((n) => n + 1)} />
      ) : titles.length === 0 ? (
        <EmptyState icon={clips ? Music : undefined}
          title={clips ? "Aucun clip pour le moment" : kind === "serie" ? "Aucune série pour le moment" : "Aucun film pour le moment"}
          text="Le catalogue de votre pays s’enrichit : revenez bientôt.">
          <Link href="/play" className={btnSecondary}>Retour à l’accueil</Link>
          {clips ? <Link href="/music/artists" prefetch={false} className={btnSecondary}>Les artistes de Rivendy Musique</Link> : null}
        </EmptyState>
      ) : (
        <>
          {genres.length > 1 ? (
            <FilterChips label="Filtrer par genre" allLabel="Tous" value={genre} onChange={setGenre}
              options={genres.map((g) => ({ value: g, label: g }))} />
          ) : null}
          {clips ? (
            <WideGrid>{shown.map((t, i) => <li key={t.id}><ClipCard title={t} eager={i < 3} /></li>)}</WideGrid>
          ) : (
            <MediaGrid few={shown.length <= FEW_TITLES}>
              {shown.map((t, i) => (
                <li key={t.id}>
                  <MediaCard title={t} eager={i < 4} progress={kind === "film" ? progressRatio(progress, t.id) : null} />
                </li>
              ))}
            </MediaGrid>
          )}
        </>
      )}
    </PlayPage>
  );
}

// ── Fiches ─────────────────────────────────────────────────────────────────

/** Le titre est-il visible dans le marché du compte ? (le serveur revérifie) */
function useTerritory(title: PlayTitle): boolean {
  const market = useHomeMarket();
  return !market || inTerritory(title.play_title_countries, market);
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="mx-auto mt-6 max-w-xl rounded-rvp border border-rvp-edge bg-rvp-ground/60 px-4 py-3 text-left text-sm text-rvp-soft backdrop-blur-md @min-[36rem]:mx-0">
      {children}
    </p>
  );
}

function PremiumNote({ title }: { title: PlayTitle }) {
  if (!title.is_premium || kindOf(title.kind) === "clip") return null;
  return (
    <p className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm text-rvp-soft @min-[36rem]:justify-start">
      <Lock className="h-4 w-4 text-rvp-premium" aria-hidden /> Inclus dans Rivendy+, sur le site et dans l’application.
      <Link href="/plus" className="font-semibold text-rvp-premium underline-offset-4 hover:underline">Découvrir Rivendy+</Link>
    </p>
  );
}

function SecondaryActions({ title }: { title: PlayTitle }) {
  return (
    <>
      <ListButton title={title} />
      <ShareButton variant="button" title={title.title} text={`Regardez « ${title.title} » sur Rivendy Play`} className={btnSecondary} />
      <a href={appIntentUrl(`/play/title/${title.id}`)} className={cn(btnGhost, "md:hidden")}>
        <Smartphone className="h-5 w-5" aria-hidden /> Ouvrir dans l’app
      </a>
    </>
  );
}

/**
 * En-tête d'une fiche : la même scène « key art » que la bannière d'accueil
 * (vraies images du titre), son image en ambiance de la page.
 */
function DetailHero({ title, kicker, heading, children }: { title: PlayTitle; kicker: string; heading?: ReactNode; children: ReactNode }) {
  useSceneBackdrop(title);
  return (
    <CinematicScene title={title} priority className={sceneBleed}>
      <div className={cn(
        "flex flex-col items-center px-5 pb-8 text-center @min-[36rem]:min-h-[var(--rvp-hero)] @min-[36rem]:max-w-[min(42rem,70%)] @min-[36rem]:items-start @min-[36rem]:justify-center @min-[36rem]:px-8 @min-[36rem]:py-12 @min-[36rem]:text-left @min-[48rem]:max-w-[min(42rem,64%)] @min-[48rem]:px-10",
        sceneTextOffset(title),
      )}>
        {kicker ? <HeroEyebrow className="rvp-fade-in">{kicker}</HeroEyebrow> : null}
        {heading ?? (
          <h1 className={cn("rvp-rise-in mt-4 text-balance break-words text-rvp-text", display, HERO_TITLE[heroTitleSize(title.title)], "leading-[0.95]")}>
            {title.title}
          </h1>
        )}
        {children}
      </div>
    </CinematicScene>
  );
}

function Synopsis({ text }: { text: string | null | undefined }) {
  const s = text?.trim();
  if (!s) return null;
  return <p className="mx-auto mt-6 max-w-2xl whitespace-pre-line text-left text-[15px] leading-7 text-rvp-soft @min-[36rem]:mx-0">{s}</p>;
}

function Trailer({ title }: { title: PlayTitle }) {
  const uid = hasTrailer(title) && title.trailer_uid ? title.trailer_uid : null;
  if (!uid) return null;
  return (
    <Section id="bande-annonce" title="Bande-annonce">
      <div className="relative aspect-video w-full max-w-4xl overflow-hidden rounded-rvp-panel border border-rvp-edge bg-black shadow-rvp-deep">
        {/* Sans fond paysage, l'image de la bande-annonce elle-même (jamais l'affiche recadrée). */}
        <ProductVideoPlayer uid={uid} thumbnail={landscapeArt(title)} title={`Bande-annonce — ${title.title}`} />
      </div>
    </Section>
  );
}

const actionsRow = "rvp-rise-in-late mt-7 flex flex-wrap items-center justify-center gap-3 @min-[36rem]:justify-start";
const metaRow = "rvp-fade-in mt-5 justify-center @min-[36rem]:justify-start";

/** Fiche film ou clip. */
export function TitleView({ title }: { title: PlayTitle }) {
  const progress = useProgress();
  const allowed = useTerritory(title);
  const p = progress.find((x) => x.title_id === title.id && !x.episode_id);
  const at = p ? resumeAt(p.position_seconds, p.duration_seconds) : 0;
  const ready = isVideoReady(title);
  const clip = kindOf(title.kind) === "clip";
  const watch = clip ? `/play/watch/clip/${title.id}` : `/play/watch/movie/${title.id}`;

  return (
    <PlayPage className="max-sm:pt-0">
      <DetailHero title={title} kicker={[kindLabel(title.kind), title.genre?.trim()].filter(Boolean).join(" · ")}>
        {isArtistClip(title) && title.artist ? (
          <p className="mt-3 text-base font-semibold text-rvp-soft">
            <Link href={`/artist/${title.artist_id}`} className="underline-offset-4 hover:text-rvp-accent hover:underline">{title.artist}</Link>
          </p>
        ) : null}
        <HeroMetadata title={title} className={metaRow} />
        {!allowed ? <Notice>Ce titre n’est pas disponible dans votre pays.</Notice>
          : !ready ? <Notice>Bientôt disponible. Ajoutez-le à Ma liste pour le retrouver.</Notice> : null}
        <div className={actionsRow}>
          {allowed && ready ? (
            <>
              <Link href={watch} className={btnPrimary}>
                <Play className="h-[18px] w-[18px] fill-current" aria-hidden />
                {at > 0 ? `Reprendre (${durationLabel(at) || "moins d’une minute"})` : clip ? "Regarder le clip" : "Regarder"}
              </Link>
              {at > 0 ? (
                <Link href={`${watch}?start=0`} className={btnSecondary}><RotateCcw className="h-[18px] w-[18px]" aria-hidden /> Recommencer</Link>
              ) : null}
            </>
          ) : null}
          <SecondaryActions title={title} />
        </div>
        <PremiumNote title={title} />
        <Synopsis text={title.synopsis} />
      </DetailHero>
      <Trailer title={title} />
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

  return (
    <PlayPage className="max-sm:pt-0">
      <DetailHero title={title} kicker={[kindLabel(title.kind), title.genre?.trim()].filter(Boolean).join(" · ")}>
        <HeroMetadata title={title} episodes={episodes.length} className={metaRow} />
        {!allowed ? <Notice>Cette série n’est pas disponible dans votre pays.</Notice>
          : episodes.length === 0 ? <Notice>Les épisodes arrivent bientôt. Ajoutez la série à Ma liste pour la retrouver.</Notice> : null}
        <div className={actionsRow}>
          {allowed && current ? <PlayButton title={title} progress={progress} episodes={episodes} /> : null}
          <SecondaryActions title={title} />
        </div>
        <PremiumNote title={title} />
        <Synopsis text={title.synopsis} />
      </DetailHero>
      {episodes.length > 0 ? (
        <Section id="episodes" title="Épisodes" unit="épisode" count={episodes.filter((e) => e.season === shownSeason).length}>
          {seasons.length > 1 ? (
            <FilterChips label="Choisir la saison" value={shownSeason} onChange={(s) => setSeason(s ?? seasons[0])}
              options={seasons.map((s) => ({ value: s, label: `Saison ${s}` }))} />
          ) : null}
          <ol className="grid gap-3 @min-[56rem]:grid-cols-2 @min-[56rem]:gap-4">
            {episodes.filter((e) => e.season === shownSeason).map((e) => {
              const pos = mine.find((x) => x.episode_id === e.id);
              const ratio = pos && pos.duration_seconds > 0 ? Math.min(1, pos.position_seconds / pos.duration_seconds) : 0;
              const locked = !!title.is_premium && !e.is_free_preview;
              return (
                <li key={e.id}>
                  <EpisodeRow series={title} episode={e} ratio={ratio} locked={locked} current={current?.id === e.id} />
                </li>
              );
            })}
          </ol>
        </Section>
      ) : null}
      <Trailer title={title} />
    </PlayPage>
  );
}

/** Épisode sans vignette : l'affiche de la série floutée, et son numéro en grand. */
function EpisodeArt({ number, poster }: { number: number; poster: string | null }) {
  return (
    <span aria-hidden className="absolute inset-0 grid place-items-center overflow-hidden bg-gradient-to-br from-rvp-raised to-rvp-ground">
      {poster ? (
        <PlayImg src={poster} widths={[160, 320]} sizes="192px"
          className="absolute inset-0 h-full w-full scale-125 object-cover object-[50%_20%] opacity-60 blur-md" />
      ) : null}
      <span className="absolute inset-0 bg-gradient-to-t from-rvp-ground/85 to-rvp-ground/25" />
      <span className="rvp-hero-glow absolute inset-0" />
      <span className={cn(display, "relative text-[28px] text-rvp-text")}>É{number}</span>
    </span>
  );
}

function EpisodeRow({ series, episode: e, ratio, locked, current }: {
  series: PlayTitle; episode: PlayEpisode; ratio: number; locked: boolean; current: boolean;
}) {
  const fallbackArt = landscapeArt(series);
  const thumb = e.thumbnail_url?.startsWith("https://") ? e.thumbnail_url : null;
  const numbered = <EpisodeArt number={e.episode_number} poster={posterArt(series)} />;
  return (
    <div className={cn("group flex gap-4 rounded-rvp-panel border bg-rvp-surface/70 p-3 hover:border-rvp-edge-strong hover:bg-rvp-raised/70", motion,
      current ? "border-rvp-edge-strong shadow-rvp-active" : "border-white/[0.06]")}>
      <Link href={`/play/watch/episode/${e.id}`} aria-label={`Regarder l’épisode ${e.episode_number} : ${e.title}`}
        className="relative block aspect-video w-36 shrink-0 overflow-hidden rounded-rvp bg-rvp-raised sm:w-48">
        <PlayImg src={thumb ?? fallbackArt} widths={[320, 480]} sizes="192px"
          className="absolute inset-0 h-full w-full object-cover"
          fallback={fallbackArt && thumb ? (
            <PlayImg src={fallbackArt} widths={[320, 480]} sizes="192px" className="absolute inset-0 h-full w-full object-cover" fallback={numbered} />
          ) : numbered} />
        <span aria-hidden className={cn("absolute inset-0 grid place-items-center bg-rvp-ground/35 opacity-0 group-hover:opacity-100", motion)}>
          <span className="grid h-11 w-11 place-items-center rounded-full bg-rvp-accent text-rvp-on-accent shadow-rvp-cta"><Play className="h-5 w-5 translate-x-px fill-current" /></span>
        </span>
        {ratio > 0 ? <ProgressTrack ratio={ratio} className="absolute inset-x-2 bottom-2" /> : null}
      </Link>
      <div className="min-w-0 flex-1 py-0.5">
        <Link href={`/play/episode/${e.id}`} className="line-clamp-2 font-semibold text-rvp-text underline-offset-4 hover:text-rvp-accent hover:underline">
          {e.episode_number}. {e.title}
        </Link>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-rvp-muted">
          {durationLabel(e.duration_seconds)}
          {locked ? <span className="inline-flex items-center gap-1 text-rvp-premium"><Lock className="h-3 w-3" aria-hidden /> Rivendy+</span> : null}
          {series.is_premium && e.is_free_preview ? <span className="font-semibold text-rvp-accent">Offert</span> : null}
          {current ? <span className="font-semibold text-rvp-accent">À suivre</span> : null}
        </p>
        {e.synopsis ? <p className="mt-1.5 line-clamp-2 text-sm text-rvp-soft">{e.synopsis}</p> : null}
      </div>
    </div>
  );
}

/** Fiche épisode (publique, sans média). */
export function EpisodeView({ episode, series }: { episode: PlayEpisode; series: PlayTitle }) {
  const progress = useProgress();
  const allowed = useTerritory(series);
  const p = progress.find((x) => x.episode_id === episode.id);
  const at = p ? resumeAt(p.position_seconds, p.duration_seconds) : 0;
  const locked = !!series.is_premium && !episode.is_free_preview;
  const heading = (
    <>
      <p className="rvp-fade-in mt-4 text-base font-semibold text-rvp-soft">
        <Link href={`/play/series/${series.id}`} className="underline-offset-4 hover:text-rvp-accent hover:underline">{series.title}</Link>
      </p>
      <h1 className={cn("rvp-rise-in mt-2 text-balance break-words text-[clamp(1.9rem,5cqi,3.2rem)] leading-[1] text-rvp-text", display)}>{episode.title}</h1>
    </>
  );
  return (
    <PlayPage className="max-sm:pt-0">
      <DetailHero title={series} kicker={`Saison ${episode.season} · Épisode ${episode.episode_number}`} heading={heading}>
        <p className="rvp-fade-in mt-5 flex flex-wrap items-center justify-center gap-2.5 text-sm text-rvp-soft @min-[36rem]:justify-start">
          {durationLabel(episode.duration_seconds)}
          {locked ? <PremiumBadge /> : null}
          {series.is_premium && episode.is_free_preview ? <span className="font-semibold text-rvp-accent">Épisode offert</span> : null}
        </p>
        {!allowed ? <Notice>Cette série n’est pas disponible dans votre pays.</Notice> : (
          <div className={actionsRow}>
            <Link href={`/play/watch/episode/${episode.id}`} className={btnPrimary}>
              <Play className="h-[18px] w-[18px] fill-current" aria-hidden /> {at > 0 ? `Reprendre (${durationLabel(at) || "moins d’une minute"})` : "Regarder"}
            </Link>
            <Link href={`/play/series/${series.id}`} className={btnSecondary}>Tous les épisodes</Link>
          </div>
        )}
        {locked ? <PremiumNote title={series} /> : null}
        <Synopsis text={episode.synopsis} />
      </DetailHero>
    </PlayPage>
  );
}

// ── Compte : Ma liste, récents ─────────────────────────────────────────────

function AccountTabs({ active }: { active: "list" | "history" }) {
  const tab = (on: boolean) => cn("flex h-10 items-center rounded-[10px] px-4 text-[14px] font-semibold", motion,
    on ? "bg-rvp-raised text-rvp-text shadow-rvp-active ring-1 ring-inset ring-rvp-edge-strong" : "text-rvp-muted hover:text-rvp-text");
  return (
    <nav aria-label="Mon espace Play" className="mb-8 inline-flex rounded-rvp border border-rvp-edge bg-rvp-surface/60 p-1 backdrop-blur-md">
      <Link href="/play/my-list" aria-current={active === "list" ? "page" : undefined} className={tab(active === "list")}>Ma liste</Link>
      <Link href="/play/history" aria-current={active === "history" ? "page" : undefined} className={tab(active === "history")}>Récents</Link>
    </nav>
  );
}

function SignInState({ title, text }: { title: string; text: string }) {
  const href = useLoginHref();
  return (
    <EmptyState icon={Lock} title={title} text={text}>
      <Link href={href} prefetch={false} className={btnPrimary}>Se connecter</Link>
    </EmptyState>
  );
}

export function MyListView() {
  const { user, loading } = useAuth();
  const list = usePlayList();
  const progress = useProgress();
  const mine = useMyListTitles();
  const ids = list.ids;
  const first = user ? mine.titles[0] ?? null : null;
  usePageBackdrop(first ? posterArt(first) ?? landscapeArt(first) : null, CARD_WIDTHS, CARD_SIZES);

  return (
    <PlayPage>
      <PageHeading title="Ma liste" kicker="Votre espace" icon={Bookmark} intro="La même liste que dans l’application Rivendy."
        count={user && ids && !mine.waiting && !mine.failed ? mine.titles.length : null} />
      <AccountTabs active="list" />
      {loading ? <Spinner /> : !user ? (
        <SignInState title="Retrouvez Ma liste" text="Connectez-vous pour enregistrer des films et des séries, et les retrouver sur le site comme dans l’application." />
      ) : mine.failed ? (
        <ErrorState text="Impossible de charger Ma liste. Vérifiez votre connexion." onRetry={mine.retry} />
      ) : ids === null || mine.waiting ? (
        <GridSkeleton layout="card" />
      ) : mine.titles.length === 0 ? (
        <EmptyState icon={Bookmark} title="Votre liste est vide" text="Ajoutez un film ou une série avec le bouton « + » de sa carte ou « Ma liste » de sa fiche.">
          <Link href="/play/movies" className={btnSecondary}>Voir les films</Link>
          <Link href="/play/series" className={btnSecondary}>Voir les séries</Link>
        </EmptyState>
      ) : (
        <MediaGrid few={mine.titles.length <= FEW_TITLES}>
          {mine.titles.map((t, i) => (
            <li key={t.id}>
              <MediaCard title={t} eager={i < 4} progress={kindOf(t.kind) === "film" ? progressRatio(progress, t.id) : null} />
            </li>
          ))}
        </MediaGrid>
      )}
    </PlayPage>
  );
}

export function HistoryView() {
  const { user, loading } = useAuth();
  const { confirm, notify } = useDialogs();
  const [round, setRound] = useState(0);
  const [data, setData] = useState<{
    key: string; ok: boolean; history: Array<{ title: PlayTitle; viewed_at: string }>; progress: WatchProgress[]; inProgress: PlayTitle[];
  } | null>(null);
  const key = user ? `${user.id}:${round}` : null;

  useEffect(() => {
    if (!key) return;
    let alive = true;
    void (async () => {
      try {
        const [h, p] = await Promise.all([fetchTitleHistory(), fetchProgress()]);
        const t = await fetchTitlesByIds(resumeEntries(p).map((x) => x.title_id));
        if (alive) setData({ key, ok: true, history: h, progress: p, inProgress: t.filter(isListable) });
      } catch {
        if (alive) setData({ key, ok: false, history: [], progress: [], inProgress: [] });
      }
    })();
    return () => { alive = false; };
  }, [key]);

  const current = data && data.key === key ? data : null;
  const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <PlayPage>
      <PageHeading title="Récents" kicker="Votre espace" icon={Clock} intro="Ce que vous avez regardé, sur le site et dans l’application." />
      <AccountTabs active="history" />
      {loading ? <Spinner /> : !user ? (
        <SignInState title="Retrouvez vos récents" text="Connectez-vous pour voir ce que vous avez regardé et reprendre vos films en cours." />
      ) : current === null ? <GridSkeleton layout="card" count={4} /> : !current.ok ? (
        <ErrorState onRetry={() => setRound((n) => n + 1)} />
      ) : (
        <>
          {current.inProgress.length > 0 ? (
            <Section id="en-cours" title="En cours" count={current.inProgress.length} className="mt-0 lg:mt-0">
              <MediaGrid few={current.inProgress.length <= FEW_TITLES}>
                {current.inProgress.map((t) => {
                  const entry = resumeEntries(current.progress).find((x) => x.title_id === t.id);
                  return (
                    <li key={t.id}>
                      <MediaCard title={t} href={entry ? resumeHref(entry) : undefined}
                        meta={entry ? remainingLabel(entry.position_seconds, entry.duration_seconds) : undefined}
                        progress={entry && entry.duration_seconds > 0 ? entry.position_seconds / entry.duration_seconds : null}
                        removeLabel={`Retirer « ${t.title} » de En cours`}
                        onRemove={async () => {
                          if (await forgetProgress(t.id)) {
                            setData((d) => (d ? { ...d, inProgress: d.inProgress.filter((x) => x.id !== t.id) } : d));
                            notify("Retiré de En cours.", "success");
                          } else notify("Action impossible pour l’instant.", "error");
                        }} />
                    </li>
                  );
                })}
              </MediaGrid>
            </Section>
          ) : null}
          <Section id="deja-vus" title="Déjà vus" count={current.history.length} className={current.inProgress.length ? undefined : "mt-0 lg:mt-0"}>
            {current.history.length === 0 ? (
              <EmptyState icon={History} title="Rien pour le moment" text="Les films, séries et clips que vous regardez apparaîtront ici.">
                <Link href="/play" className={btnSecondary}>Découvrir Rivendy Play</Link>
              </EmptyState>
            ) : (
              <>
                <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-rvp-panel border border-rvp-edge bg-rvp-surface/60">
                  {current.history.map((h) => (
                    <li key={`${h.title.id}-${h.viewed_at}`}>
                      <Link href={titlePath(h.title)} className={cn("group flex min-h-16 items-center gap-4 px-4 py-2.5 hover:bg-rvp-raised/60", motion)}>
                        <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-rvp-sm bg-rvp-raised ring-1 ring-white/10">
                          <PlayImg src={posterArt(h.title) ?? landscapeArt(h.title)} widths={[160]} sizes="44px"
                            className="absolute inset-0 h-full w-full object-cover object-[50%_18%]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block truncate font-semibold text-rvp-text group-hover:text-rvp-accent", motion)}>{h.title.title}</span>
                          <span className="block text-xs text-rvp-muted sm:hidden">{dateLabel(h.viewed_at)}</span>
                        </span>
                        <span className="hidden text-xs text-rvp-muted sm:inline">{kindLabel(h.title.kind)}</span>
                        <span className="hidden w-36 text-right text-xs text-rvp-muted sm:inline">{dateLabel(h.viewed_at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <button type="button"
                  onClick={async () => {
                    const ok = await confirm({ title: "Effacer l’historique ?", message: "Les vidéos vues disparaissent de l’historique, sur le site et dans l’application.", confirmLabel: "Effacer", danger: true });
                    if (!ok) return;
                    if (await clearTitleHistory()) { setData((d) => (d ? { ...d, history: [] } : d)); notify("Historique effacé.", "success"); }
                    else notify("Action impossible pour l’instant.", "error");
                  }}
                  className={cn(btnGhost, "mt-4 px-0")}>
                  <Trash2 className="h-4 w-4" aria-hidden /> Effacer l’historique
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

/**
 * Recherche : sur tablette et ordinateur, le champ est celui de la barre du
 * haut ; sur téléphone, celui de la page. Même saisie (usePlaySearch), les
 * résultats suivent la frappe.
 */
export function SearchView() {
  const market = useHomeMarket();
  const pending = useMarketPending();
  const { query, setQuery, inputRef } = usePlaySearch();
  const [round, setRound] = useState(0);
  const [data, setData] = useState<{ key: string; titles: PlayTitle[] | null } | null>(null);
  const key = market ? `${market}:${round}` : null;

  useEffect(() => {
    if (!market || !key) return;
    let alive = true;
    void Promise.all([fetchCatalog(market), fetchCatalog(market, "clip", 300)])
      .then(([a, b]) => { if (alive) setData({ key, titles: [...a, ...b] }); })
      .catch(() => { if (alive) setData({ key, titles: null }); });
    return () => { alive = false; };
  }, [market, key]);

  // Tablette et ordinateur : arrivée sur la page sans saisie en cours → le champ de la barre du haut.
  useEffect(() => {
    const el = inputRef.current;
    if (el && el.offsetParent !== null && (document.activeElement === document.body || document.activeElement === null)) el.focus();
  }, [inputRef]);

  const current = data && data.key === key ? data : null;
  const all = useMemo(() => current?.titles ?? [], [current]);
  const results = useMemo(() => searchTitles(all, query), [all, query]);
  const q = query.trim();
  const shows = results.filter((t) => kindOf(t.kind) !== "clip");
  const clips = results.filter((t) => kindOf(t.kind) === "clip");
  const genres = useMemo(() => genresOf(all.filter(isListable)), [all]);

  return (
    <PlayPage>
      <PageHeading title="Recherche" icon={Search} intro="Titres, genres et artistes du catalogue de votre pays, avec ou sans accents." />
      <form role="search" onSubmit={(e) => e.preventDefault()} className="relative mb-8 md:hidden">
        <label htmlFor="play-search" className="sr-only">Titre, genre ou artiste</label>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-rvp-muted" aria-hidden />
        <input id="play-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus
          enterKeyHint="search" autoComplete="off" maxLength={60} placeholder="Titre, genre, artiste…"
          className="h-14 w-full rounded-rvp-card border border-white/10 bg-rvp-surface/70 pl-12 pr-14 text-lg text-rvp-text backdrop-blur-md placeholder:text-rvp-muted focus:border-rvp-accent focus:outline-none [&::-webkit-search-cancel-button]:hidden" />
        {q ? (
          <button type="button" onClick={() => setQuery("")} aria-label="Effacer la recherche"
            className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-rvp-soft hover:bg-white/10 hover:text-rvp-text">
            <X className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
      </form>

      {!market ? (
        pending ? <GridSkeleton layout="card" /> : <MarketPrompt />
      ) : current === null ? (
        <GridSkeleton layout="card" />
      ) : current.titles === null ? (
        <ErrorState onRetry={() => setRound((n) => n + 1)} />
      ) : (
        <>
          <p aria-live="polite" className="sr-only">
            {q ? (results.length === 0 ? `Aucun résultat pour ${q}` : `${results.length} résultat${results.length > 1 ? "s" : ""} pour ${q}`) : ""}
          </p>
          {!q && genres.length > 0 ? (
            <FilterChips label="Rechercher un genre" value={null} onChange={(g) => { if (g) setQuery(g); }}
              options={genres.map((g) => ({ value: g, label: g }))} />
          ) : null}
          {q && results.length === 0 ? (
            <EmptyState icon={SearchX} title={`Aucun résultat pour « ${q} »`}
              text="Vérifiez l’orthographe, ou essayez un titre, un genre ou le nom d’un artiste.">
              <Link href="/play/movies" className={btnSecondary}>Films</Link>
              <Link href="/play/series" className={btnSecondary}>Séries</Link>
              <Link href="/play/clips" className={btnSecondary}>Clips</Link>
            </EmptyState>
          ) : (
            <>
              {shows.length > 0 ? (
                <Section id="res-titres" title={q ? "Films et séries" : "Tout le catalogue"} count={shows.length} className="mt-0 lg:mt-0">
                  <MediaGrid few={shows.length <= FEW_TITLES}>{shows.map((t) => <li key={t.id}><MediaCard title={t} /></li>)}</MediaGrid>
                </Section>
              ) : null}
              {clips.length > 0 ? (
                <Section id="res-clips" title="Clips" unit="clip" count={clips.length} className={shows.length ? undefined : "mt-0 lg:mt-0"}>
                  <WideGrid>{clips.map((t) => <li key={t.id}><ClipCard title={t} /></li>)}</WideGrid>
                </Section>
              ) : null}
              {!q && results.length === 0 ? (
                <EmptyState title="Le catalogue de votre pays arrive bientôt" text="Aucun titre n’est encore disponible dans votre pays." />
              ) : null}
            </>
          )}
        </>
      )}
    </PlayPage>
  );
}
