"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Clock, History, Lock, Play, RotateCcw, Search, SearchX, Smartphone, Trash2, X } from "lucide-react";
import { ShareButton } from "@/components/ui/share-button";
import { useAuth } from "@/features/auth/auth-provider";
import { useHomeMarket } from "@/features/media/use-home-market";
import { ProductVideoPlayer } from "@/features/products/product-video-player";
import { useDialogs } from "@/features/ui/dialogs";
import { cn } from "@/lib/utils/cn";
import {
  clearTitleHistory, fetchCatalog, fetchEpisodesByIds, fetchProgress, fetchTitleHistory, fetchTitlesByIds, fetchTopWeek,
  forgetProgress,
} from "./play-api";
import { HeroSkeleton, Kicker, MetaLine, MobileWideArt, PlayHero, PosterFrame, PrimaryAction, TitleBackdrop } from "./play-hero";
import { appIntentUrl } from "./play-link-page";
import { usePlayList } from "./play-list";
import {
  currentEpisode, durationLabel, foldText, genresOf, hasTrailer, heroTitles, homeRows, inTerritory, isArtistClip,
  isListable, isVideoReady, kindLabel, kindOf, landscapeArt, remainingLabel, resumeAt, resumeEntries,
  resumeHref, searchTitles, titlePath,
  type HomeRow, type PlayEpisode, type PlayTitle, type WatchProgress,
} from "./play-logic";
import {
  EmptyState, ErrorState, FilterChips, GridSkeleton, LandscapeCard, LandscapeGrid, ListButton, LoginNote, MarketPrompt,
  PageHeading, PlayImg, PlayPage, PosterCard, PosterGrid, PremiumBadge, Rail, RailItem, RailSkeleton, Section, Spinner,
  btnGhost, btnPrimary, btnSecondary, progressRatio, useLoginHref,
} from "./play-ui";

/**
 * Rivendy Play sur le site — écrans de la refonte « salle de cinéma »
 * (2026-10-22). Mêmes tables et fonctions que l'app (lot C) : une position,
 * Ma liste ou l'historique enregistrés ici se retrouvent dans l'app, et
 * inversement. Rien n'est inventé pour remplir l'écran : une rangée sans
 * contenu réel n'est pas affichée.
 */

const NO_PROGRESS: WatchProgress[] = [];

/** Positions du compte (reprise, barres d'avancement). */
function useProgress(): WatchProgress[] {
  const { user } = useAuth();
  const [progress, setProgress] = useState<WatchProgress[]>(NO_PROGRESS);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    void fetchProgress().then((p) => { if (alive) setProgress(p); });
    return () => { alive = false; };
  }, [user]);
  return user ? progress : NO_PROGRESS;
}

// ── Accueil ────────────────────────────────────────────────────────────────

type HomeData = { key: string; ok: true; catalog: PlayTitle[]; clips: PlayTitle[]; top: string[] } | { key: string; ok: false };
type ResumeItem = { entry: WatchProgress; title: PlayTitle; episode: PlayEpisode | null };

export function PlayHomeView() {
  const market = useHomeMarket();
  const { user, loading: authLoading } = useAuth();
  const { notify } = useDialogs();
  const [round, setRound] = useState(0);
  const [data, setData] = useState<HomeData | null>(null);
  const [resume, setResume] = useState<ResumeItem[]>([]);
  const [now] = useState(() => new Date());
  const key = market ? `${market}:${round}` : null;

  useEffect(() => {
    if (!market || !key) return;
    let alive = true;
    void Promise.all([fetchCatalog(market), fetchCatalog(market, "clip", 40), fetchTopWeek(market)])
      .then(([catalog, clips, top]) => {
        if (alive) setData({ key, ok: true, catalog: catalog.filter(isListable), clips: clips.filter(isListable), top });
      })
      .catch(() => { if (alive) setData({ key, ok: false }); });
    return () => { alive = false; };
  }, [market, key]);

  const progress = useProgress();
  useEffect(() => {
    const entries = resumeEntries(progress).slice(0, 20);
    if (entries.length === 0) return;
    let alive = true;
    void Promise.all([
      fetchTitlesByIds(entries.map((e) => e.title_id)),
      fetchEpisodesByIds(entries.map((e) => e.episode_id).filter((id): id is string => !!id)),
    ]).then(([titles, episodes]) => {
      if (!alive) return;
      const t = new Map(titles.map((x) => [x.id, x]));
      const e = new Map(episodes.map((x) => [x.id, x]));
      setResume(entries
        .map((entry) => ({ entry, title: t.get(entry.title_id), episode: entry.episode_id ? e.get(entry.episode_id) ?? null : null }))
        .filter((r): r is ResumeItem => !!r.title && isListable(r.title)));
    });
    return () => { alive = false; };
  }, [progress]);

  const current = data && data.key === key ? data : null;
  const ready = current?.ok ? current : null;
  const hero = useMemo(() => (ready ? heroTitles(ready.catalog) : []), [ready]);
  const rows = useMemo(() => (ready ? homeRows(ready.catalog, ready.top, now) : []), [ready, now]);
  const resumeShown = user && resumeEntries(progress).length > 0 ? resume : [];

  if (!market) {
    return (
      <>
        <h1 className="sr-only">Rivendy Play — films, séries et clips</h1>
        {user || authLoading ? <><HeroSkeleton /><PlayPage><RailSkeleton layout="landscape" /></PlayPage></> : <PlayPage><MarketPrompt /></PlayPage>}
      </>
    );
  }

  const forget = async (item: ResumeItem) => {
    if (await forgetProgress(item.title.id)) {
      setResume((l) => l.filter((r) => r.title.id !== item.title.id));
      notify(`« ${item.title.title} » retiré de Continuer à regarder.`, "success");
    } else notify("Action impossible pour l’instant.", "error");
  };

  const loginNote = <LoginNote text="Connectez-vous pour regarder, reprendre vos films là où vous les avez laissés et retrouver Ma liste — sur le site comme dans l’application." />;

  return (
    <>
      <h1 className="sr-only">Rivendy Play — films, séries et clips</h1>
      {current === null ? <HeroSkeleton /> : hero.length > 0 ? <PlayHero titles={hero} progress={progress} /> : null}
      <PlayPage className="pt-0 lg:pt-0">
        {current === null ? (
          <><RailSkeleton layout="landscape" /><RailSkeleton layout="poster" /></>
        ) : !current.ok ? (
          <ErrorState onRetry={() => setRound((n) => n + 1)} />
        ) : (
          <>
            {hero.length === 0 ? (
              <div className="pt-8"><PageHeading title="Rivendy Play" intro="Films, séries et clips, sur le site et dans l’application, avec le même compte." /></div>
            ) : null}
            {resumeShown.length > 0 ? (
              <Section id="row-resume" title="Continuer à regarder" count={resumeShown.length}>
                <Rail label="Continuer à regarder" layout="landscape">
                  {resumeShown.map((r) => (
                    <RailItem key={r.title.id}>
                      <LandscapeCard title={r.title} href={resumeHref(r.entry)}
                        kicker={r.episode ? `Saison ${r.episode.season} · Épisode ${r.episode.episode_number}` : kindLabel(r.title.kind)}
                        caption={remainingLabel(r.entry.position_seconds, r.entry.duration_seconds)}
                        progress={r.entry.duration_seconds > 0 ? r.entry.position_seconds / r.entry.duration_seconds : null}
                        onRemove={() => void forget(r)} removeLabel={`Retirer « ${r.title.title} » de Continuer à regarder`} />
                    </RailItem>
                  ))}
                </Rail>
              </Section>
            ) : null}
            {rows.map((row, i) => (
              <Fragment key={row.id}>
                <HomeRowSection row={row} progress={progress} />
                {i === 0 ? loginNote : null}
              </Fragment>
            ))}
            {current.clips.length > 0 ? (
              <Section id="row-clips" title="Clips" count={current.clips.length} href="/play/clips">
                <Rail label="Clips" layout="landscape">
                  {current.clips.slice(0, 20).map((t) => <RailItem key={t.id}><LandscapeCard title={t} /></RailItem>)}
                </Rail>
              </Section>
            ) : null}
            {rows.length === 0 ? loginNote : null}
            {rows.length === 0 && current.clips.length === 0 ? (
              <EmptyState title="Le catalogue de votre pays arrive bientôt"
                text="Aucun film, aucune série ni aucun clip n’est encore disponible dans votre pays. Revenez bientôt." />
            ) : null}
          </>
        )}
      </PlayPage>
    </>
  );
}

function HomeRowSection({ row, progress }: { row: HomeRow; progress: WatchProgress[] }) {
  const id = `row-${foldText(row.id).replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <Section id={id} title={row.title} count={row.titles.length} href={row.href} total={row.total}>
      <Rail label={row.title} layout={row.layout === "landscape" ? "landscape" : "poster"}>
        {row.titles.map((t, i) => (
          <RailItem key={t.id}>
            {row.layout === "landscape" ? (
              <LandscapeCard title={t} progress={kindOf(t.kind) === "film" ? progressRatio(progress, t.id) : null} />
            ) : (
              <PosterCard title={t} rank={row.layout === "ranked" ? i + 1 : undefined}
                progress={kindOf(t.kind) === "film" ? progressRatio(progress, t.id) : null} />
            )}
          </RailItem>
        ))}
      </Rail>
    </Section>
  );
}

// ── Catalogues ─────────────────────────────────────────────────────────────

export function CatalogView({ kind, heading, intro }: { kind: "film" | "serie" | "clip"; heading: string; intro: string }) {
  const market = useHomeMarket();
  const { user, loading: authLoading } = useAuth();
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
  const layout = kind === "clip" ? "landscape" : "poster";
  const Grid = kind === "clip" ? LandscapeGrid : PosterGrid;
  const noun = kind === "clip" ? "clip" : kind === "serie" ? "série" : "film";

  return (
    <PlayPage>
      <PageHeading title={heading} intro={intro} count={current?.titles && titles.length > 0 ? titles.length : null} unit={noun} />
      {!market ? (
        user || authLoading ? <GridSkeleton layout={layout} /> : <MarketPrompt />
      ) : current === null ? (
        <GridSkeleton layout={layout} />
      ) : current.titles === null ? (
        <ErrorState onRetry={() => setRound((n) => n + 1)} />
      ) : titles.length === 0 ? (
        <EmptyState title={kind === "clip" ? "Aucun clip pour le moment" : kind === "serie" ? "Aucune série pour le moment" : "Aucun film pour le moment"}
          text="Le catalogue de votre pays s’enrichit : revenez bientôt.">
          <Link href="/play" className={btnSecondary}>Retour à l’accueil</Link>
        </EmptyState>
      ) : (
        <>
          {genres.length > 1 ? (
            <FilterChips label="Filtrer par genre" allLabel="Tous" value={genre} onChange={setGenre}
              options={genres.map((g) => ({ value: g, label: g }))} />
          ) : null}
          <Grid>
            {shown.map((t) => (
              <li key={t.id}>
                {kind === "clip" ? <LandscapeCard title={t} /> : (
                  <PosterCard title={t} progress={kind === "film" ? progressRatio(progress, t.id) : null} />
                )}
              </li>
            ))}
          </Grid>
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
  return <p className="mx-auto mt-6 max-w-xl rounded-xl border border-rvp-line bg-rvp-surface/80 px-4 py-3 text-left text-sm text-rvp-soft lg:mx-0">{children}</p>;
}

function PremiumNote({ title }: { title: PlayTitle }) {
  if (!title.is_premium || kindOf(title.kind) === "clip") return null;
  return (
    <p className="mt-5 flex flex-wrap items-center justify-center gap-2 text-sm text-rvp-soft lg:justify-start">
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

/** En-tête d'une fiche : les vraies images du titre, comme la bannière d'accueil. */
function DetailHero({ title, kicker, heading, children }: { title: PlayTitle; kicker: string; heading?: ReactNode; children: ReactNode }) {
  const wide = !!landscapeArt(title);
  return (
    <section className="relative isolate overflow-hidden border-b border-white/5">
      <TitleBackdrop title={title} priority />
      <div className="relative mx-auto grid w-full max-w-[1600px] items-center gap-6 px-4 pb-10 pt-6 sm:px-6 lg:min-h-[clamp(440px,60vh,620px)] lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16 lg:px-10 lg:py-14">
        <div className="flex justify-center lg:hidden">
          <PosterFrame title={title} priority place="mobile" />
          <MobileWideArt title={title} priority />
        </div>
        <div className="min-w-0 text-center lg:max-w-[700px] lg:text-left">
          <Kicker>Rivendy Play <span aria-hidden>·</span> {kicker}</Kicker>
          {heading ?? (
            <h1 className="mt-4 break-words text-[clamp(2rem,4.6vw,4.25rem)] font-black leading-[1] tracking-tight text-rvp-text lg:mt-5">{title.title}</h1>
          )}
          {children}
        </div>
        {!wide ? <div className="hidden lg:block"><PosterFrame title={title} priority place="desktop" /></div> : null}
      </div>
    </section>
  );
}

function Synopsis({ text }: { text: string | null | undefined }) {
  const s = text?.trim();
  if (!s) return null;
  return <p className="mx-auto mt-5 max-w-2xl whitespace-pre-line text-left text-[15px] leading-7 text-rvp-soft lg:mx-0">{s}</p>;
}

function Trailer({ title }: { title: PlayTitle }) {
  const uid = hasTrailer(title) && title.trailer_uid ? title.trailer_uid : null;
  if (!uid) return null;
  return (
    <Section id="bande-annonce" title="Bande-annonce">
      <div className="relative aspect-video w-full max-w-4xl overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
        {/* Sans fond paysage, l'image de la bande-annonce elle-même (jamais l'affiche recadrée). */}
        <ProductVideoPlayer uid={uid} thumbnail={landscapeArt(title)} title={`Bande-annonce — ${title.title}`} />
      </div>
    </Section>
  );
}

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
    <>
      <DetailHero title={title} kicker={[kindLabel(title.kind), title.genre?.trim()].filter(Boolean).join(" · ")}>
        {isArtistClip(title) && title.artist ? (
          <p className="mt-3 text-base font-semibold text-rvp-soft">
            <Link href={`/artist/${title.artist_id}`} className="underline-offset-4 hover:text-rvp-accent hover:underline">{title.artist}</Link>
          </p>
        ) : null}
        <MetaLine title={title} className="mt-4 justify-center lg:justify-start" />
        {!allowed ? <Notice>Ce titre n’est pas disponible dans votre pays.</Notice>
          : !ready ? <Notice>Bientôt disponible. Ajoutez-le à Ma liste pour le retrouver.</Notice> : null}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
          {allowed && ready ? (
            <>
              <Link href={watch} className={btnPrimary}>
                <Play className="h-5 w-5 fill-current" aria-hidden />
                {at > 0 ? `Reprendre (${durationLabel(at) || "moins d’une minute"})` : clip ? "Regarder le clip" : "Regarder"}
              </Link>
              {at > 0 ? (
                <Link href={`${watch}?start=0`} className={btnSecondary}><RotateCcw className="h-5 w-5" aria-hidden /> Recommencer</Link>
              ) : null}
            </>
          ) : null}
          <SecondaryActions title={title} />
        </div>
        <PremiumNote title={title} />
        <Synopsis text={title.synopsis} />
      </DetailHero>
      <PlayPage className="pt-0 lg:pt-0">
        <Trailer title={title} />
      </PlayPage>
    </>
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
    <>
      <DetailHero title={title} kicker={[kindLabel(title.kind), title.genre?.trim()].filter(Boolean).join(" · ")}>
        <MetaLine title={title} episodes={episodes.length} className="mt-4 justify-center lg:justify-start" />
        {!allowed ? <Notice>Cette série n’est pas disponible dans votre pays.</Notice>
          : episodes.length === 0 ? <Notice>Les épisodes arrivent bientôt. Ajoutez la série à Ma liste pour la retrouver.</Notice> : null}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
          {allowed && current ? <PrimaryAction title={title} progress={progress} episodes={episodes} /> : null}
          <SecondaryActions title={title} />
        </div>
        <PremiumNote title={title} />
        <Synopsis text={title.synopsis} />
      </DetailHero>
      <PlayPage className="pt-0 lg:pt-0">
        {episodes.length > 0 ? (
          <Section id="episodes" title="Épisodes" count={episodes.filter((e) => e.season === shownSeason).length}>
            {seasons.length > 1 ? (
              <FilterChips label="Choisir la saison" value={shownSeason} onChange={(s) => setSeason(s ?? seasons[0])}
                options={seasons.map((s) => ({ value: s, label: `Saison ${s}` }))} />
            ) : null}
            <ol className="grid gap-3 lg:grid-cols-2 lg:gap-4">
              {episodes.filter((e) => e.season === shownSeason).map((e) => {
                const pos = mine.find((p) => p.episode_id === e.id);
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
    </>
  );
}

function EpisodeRow({ series, episode: e, ratio, locked, current }: {
  series: PlayTitle; episode: PlayEpisode; ratio: number; locked: boolean; current: boolean;
}) {
  const fallbackArt = landscapeArt(series);
  return (
    <div className={cn("group flex gap-4 rounded-2xl border bg-rvp-surface p-3 transition-colors hover:bg-rvp-raised",
      current ? "border-rvp-accent/60" : "border-transparent")}>
      <Link href={`/play/watch/episode/${e.id}`} aria-label={`Regarder l’épisode ${e.episode_number} : ${e.title}`}
        className="relative block aspect-video w-36 shrink-0 overflow-hidden rounded-xl bg-rvp-raised sm:w-48">
        <PlayImg src={e.thumbnail_url?.startsWith("https://") ? e.thumbnail_url : fallbackArt} widths={[320, 480]} sizes="192px"
          className="absolute inset-0 h-full w-full object-cover"
          fallback={fallbackArt && e.thumbnail_url?.startsWith("https://") ? (
            <PlayImg src={fallbackArt} widths={[320, 480]} sizes="192px" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-rvp-raised to-rvp-ground text-2xl font-black text-rvp-accent/80">É{e.episode_number}</span>
          )} />
        <span className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition group-hover:opacity-100" aria-hidden>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rvp-accent text-rvp-on-accent"><Play className="h-5 w-5 translate-x-px fill-current" /></span>
        </span>
        {ratio > 0 ? (
          <span className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-white/25" aria-hidden>
            <span className="block h-full rounded-full bg-rvp-accent" style={{ width: `${Math.max(3, Math.round(ratio * 100))}%` }} />
          </span>
        ) : null}
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
      <p className="mt-4 text-base font-semibold text-rvp-soft lg:mt-5">
        <Link href={`/play/series/${series.id}`} className="underline-offset-4 hover:text-rvp-accent hover:underline">{series.title}</Link>
      </p>
      <h1 className="mt-2 break-words text-[clamp(1.75rem,3.8vw,3.5rem)] font-black leading-[1.05] tracking-tight text-rvp-text">{episode.title}</h1>
    </>
  );
  return (
    <>
      <DetailHero title={series} kicker={`Saison ${episode.season} · Épisode ${episode.episode_number}`} heading={heading}>
        <p className="mt-4 flex flex-wrap items-center justify-center gap-2.5 text-sm text-rvp-soft lg:justify-start">
          {durationLabel(episode.duration_seconds)}
          {locked ? <PremiumBadge /> : null}
          {series.is_premium && episode.is_free_preview ? <span className="font-semibold text-rvp-accent">Épisode offert</span> : null}
        </p>
        {!allowed ? <Notice>Cette série n’est pas disponible dans votre pays.</Notice> : (
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Link href={`/play/watch/episode/${episode.id}`} className={btnPrimary}>
              <Play className="h-5 w-5 fill-current" aria-hidden /> {at > 0 ? `Reprendre (${durationLabel(at) || "moins d’une minute"})` : "Regarder"}
            </Link>
            <Link href={`/play/series/${series.id}`} className={btnSecondary}>Tous les épisodes</Link>
          </div>
        )}
        {locked ? <PremiumNote title={series} /> : null}
        <Synopsis text={episode.synopsis} />
      </DetailHero>
    </>
  );
}

// ── Compte : Ma liste, historique ──────────────────────────────────────────

function AccountTabs({ active }: { active: "list" | "history" }) {
  const tab = (on: boolean) => cn("relative flex h-11 items-center px-1 text-[15px] transition-colors",
    on ? "font-semibold text-rvp-text" : "font-medium text-rvp-soft hover:text-rvp-text");
  return (
    <nav aria-label="Mon espace Play" className="mb-8 flex gap-6 border-b border-rvp-line">
      <Link href="/play/my-list" aria-current={active === "list" ? "page" : undefined} className={tab(active === "list")}>
        Ma liste{active === "list" ? <span aria-hidden className="absolute inset-x-0 -bottom-px h-[3px] rounded-t-full bg-rvp-accent" /> : null}
      </Link>
      <Link href="/play/history" aria-current={active === "history" ? "page" : undefined} className={tab(active === "history")}>
        Historique{active === "history" ? <span aria-hidden className="absolute inset-x-0 -bottom-px h-[3px] rounded-t-full bg-rvp-accent" /> : null}
      </Link>
    </nav>
  );
}

function SignInState({ title, text }: { title: string; text: string }) {
  const href = useLoginHref();
  return (
    <EmptyState icon={Lock} title={title} text={text}>
      <Link href={href} className={btnPrimary}>Se connecter</Link>
    </EmptyState>
  );
}

export function MyListView() {
  const { user, loading } = useAuth();
  const list = usePlayList();
  const progress = useProgress();
  const [titles, setTitles] = useState<Record<string, PlayTitle>>({});
  const [failed, setFailed] = useState(false);
  const ids = list.ids;
  const missing = useMemo(() => (ids ?? []).filter((id) => !titles[id]), [ids, titles]);

  useEffect(() => {
    if (missing.length === 0) return;
    let alive = true;
    void fetchTitlesByIds(missing)
      .then((found) => {
        if (!alive) return;
        // Un titre retiré du catalogue garde une entrée vide : il n'est plus redemandé.
        setTitles((m) => ({ ...m, ...Object.fromEntries(missing.map((id) => [id, found.find((t) => t.id === id) ?? ({ id, kind: "", title: "" } as PlayTitle)])) }));
        setFailed(false);
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [missing]);

  const shown = (ids ?? []).map((id) => titles[id]).filter((t): t is PlayTitle => !!t && !!t.title);
  const waiting = ids !== null && missing.length > 0 && !failed;

  return (
    <PlayPage>
      <PageHeading title="Ma liste" intro="La même liste que dans l’application Rivendy." count={user && ids && !waiting ? shown.length : null} />
      <AccountTabs active="list" />
      {loading ? <Spinner /> : !user ? (
        <SignInState title="Retrouvez Ma liste" text="Connectez-vous pour enregistrer des films et des séries, et les retrouver sur le site comme dans l’application." />
      ) : list.failed || failed ? (
        <ErrorState text="Impossible de charger Ma liste. Vérifiez votre connexion." onRetry={() => { setFailed(false); list.reload(); }} />
      ) : ids === null || waiting ? (
        <GridSkeleton layout="poster" />
      ) : shown.length === 0 ? (
        <EmptyState title="Votre liste est vide" text="Ajoutez un film ou une série avec le bouton « + » de son affiche ou « Ma liste » de sa fiche.">
          <Link href="/play/movies" className={btnSecondary}>Voir les films</Link>
          <Link href="/play/series" className={btnSecondary}>Voir les séries</Link>
        </EmptyState>
      ) : (
        <PosterGrid>
          {shown.map((t) => (
            <li key={t.id}>
              {kindOf(t.kind) === "clip" ? <LandscapeCard title={t} /> : (
                <PosterCard title={t} progress={kindOf(t.kind) === "film" ? progressRatio(progress, t.id) : null} />
              )}
            </li>
          ))}
        </PosterGrid>
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
      <PageHeading title="Historique" intro="Ce que vous avez regardé, sur le site et dans l’application." />
      <AccountTabs active="history" />
      {loading ? <Spinner /> : !user ? (
        <SignInState title="Retrouvez votre historique" text="Connectez-vous pour voir ce que vous avez regardé et reprendre vos films en cours." />
      ) : current === null ? <Spinner /> : !current.ok ? (
        <ErrorState onRetry={() => setRound((n) => n + 1)} />
      ) : (
        <>
          {current.inProgress.length > 0 ? (
            <Section id="en-cours" title="En cours" count={current.inProgress.length} className="mt-0 lg:mt-0">
              <LandscapeGrid>
                {current.inProgress.map((t) => {
                  const entry = resumeEntries(current.progress).find((x) => x.title_id === t.id);
                  return (
                    <li key={t.id}>
                      <LandscapeCard title={t} href={entry ? resumeHref(entry) : titlePath(t)}
                        caption={entry ? remainingLabel(entry.position_seconds, entry.duration_seconds) : undefined}
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
              </LandscapeGrid>
            </Section>
          ) : null}
          <Section id="deja-vus" title="Déjà vus" count={current.history.length} className={current.inProgress.length ? undefined : "mt-0 lg:mt-0"}>
            {current.history.length === 0 ? (
              <EmptyState icon={History} title="Rien pour le moment" text="Les films, séries et clips que vous regardez apparaîtront ici.">
                <Link href="/play" className={btnSecondary}>Découvrir Rivendy Play</Link>
              </EmptyState>
            ) : (
              <>
                <ul className="divide-y divide-rvp-line overflow-hidden rounded-2xl border border-rvp-line bg-rvp-surface">
                  {current.history.map((h) => (
                    <li key={`${h.title.id}-${h.viewed_at}`}>
                      <Link href={titlePath(h.title)} className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-rvp-raised">
                        <Clock className="h-4 w-4 shrink-0 text-rvp-accent" aria-hidden />
                        <span className="min-w-0 flex-1 truncate font-semibold text-rvp-text">{h.title.title}</span>
                        <span className="hidden text-xs text-rvp-muted sm:inline">{kindLabel(h.title.kind)}</span>
                        <span className="text-xs text-rvp-muted">{dateLabel(h.viewed_at)}</span>
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

export function SearchView({ initial }: { initial: string }) {
  const market = useHomeMarket();
  const { user, loading: authLoading } = useAuth();
  const [query, setQuery] = useState(initial);
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

  // L'adresse suit la recherche (partage, retour arrière) sans recharger la page.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const q = query.trim();
      const url = q ? `/play/search?q=${encodeURIComponent(q.slice(0, 60))}` : "/play/search";
      if (`${window.location.pathname}${window.location.search}` !== url) window.history.replaceState(null, "", url);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [query]);

  const current = data && data.key === key ? data : null;
  const all = useMemo(() => current?.titles ?? [], [current]);
  const results = useMemo(() => searchTitles(all, query), [all, query]);
  const q = query.trim();
  const shows = results.filter((t) => kindOf(t.kind) !== "clip");
  const clips = results.filter((t) => kindOf(t.kind) === "clip");
  const genres = useMemo(() => genresOf(all.filter(isListable)), [all]);

  return (
    <PlayPage>
      <h1 className="sr-only">Rechercher dans Rivendy Play</h1>
      <form role="search" onSubmit={(e) => e.preventDefault()} className="relative mx-auto mb-8 max-w-3xl">
        <label htmlFor="play-search" className="sr-only">Titre, genre ou artiste</label>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-rvp-muted" aria-hidden />
        <input id="play-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus
          enterKeyHint="search" autoComplete="off" maxLength={60} placeholder="Titre, genre, artiste…"
          className="h-14 w-full rounded-xl border border-rvp-line bg-rvp-surface pl-12 pr-14 text-lg text-rvp-text placeholder:text-rvp-muted focus:border-rvp-accent focus:outline-none [&::-webkit-search-cancel-button]:hidden" />
        {q ? (
          <button type="button" onClick={() => setQuery("")} aria-label="Effacer la recherche"
            className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-rvp-soft hover:bg-white/10 hover:text-rvp-text">
            <X className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
        <p className="mt-2 text-center text-xs text-rvp-muted">Avec ou sans accents : « mbaye » trouve « Mbayé ».</p>
      </form>

      {!market ? (
        user || authLoading ? <Spinner /> : <MarketPrompt />
      ) : current === null ? (
        <GridSkeleton layout="poster" />
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
                <Section id="res-titres" title={q ? "Films et séries" : "À découvrir"} count={shows.length} className="mt-0 lg:mt-0">
                  <PosterGrid>{shows.map((t) => <li key={t.id}><PosterCard title={t} /></li>)}</PosterGrid>
                </Section>
              ) : null}
              {clips.length > 0 ? (
                <Section id="res-clips" title="Clips" count={clips.length} className={shows.length ? undefined : "mt-0 lg:mt-0"}>
                  <LandscapeGrid>{clips.map((t) => <li key={t.id}><LandscapeCard title={t} /></li>)}</LandscapeGrid>
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

