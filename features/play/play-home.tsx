"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useHomeMarket } from "@/features/media/use-home-market";
import { useDialogs } from "@/features/ui/dialogs";
import { cn } from "@/lib/utils/cn";
import { fetchCatalog, fetchEpisodesByIds, fetchTitlesByIds, fetchTopWeek, forgetProgress } from "./play-api";
import { ClipCard, ListToggle, MediaCard, PlayImg, PosterCard, ResumeCard } from "./play-cards";
import { CinematicHero, HeroSkeleton, useSceneBackdrop } from "./play-hero";
import { useMyListTitles, useProgress } from "./play-hooks";
import { usePlayList } from "./play-list";
import {
  byKindFilter, foldText, heroTitles, homeRows, isListable, kindFilters, kindOf, landscapeArt, panelMeta, posterArt,
  remainingLabel, resumeEntries, resumeHref, resumeKicker, suggestionsFor, talentsTarget, titlePath,
  type HomeRow, type KindFilter, type PlayEpisode, type PlayTitle, type WatchProgress,
} from "./play-logic";
import { TalentSpotlight } from "./play-talents";
import { display, motion, sceneBleed } from "./play-theme";
import {
  EmptyState, ErrorState, KindSwitch, LoginNote, MarketPrompt, MediaRow, MediaRowItem, PlayPage, RowSkeleton, Section,
  SectionHeader, progressRatio, useMarketPending,
} from "./play-ui";

/**
 * Accueil de Rivendy Play — « Découvrir » (« Emerald Cinema », 2026-10-24) :
 * la bannière « key art » et, à sa droite, le panneau « À découvrir » ;
 * « Continuer à regarder » ; « À l'affiche » avec « L'espace des talents »
 * dans la même colonne que le panneau ; les clips. Mêmes tables et fonctions
 * que l'app (lot C). Rien n'est inventé pour remplir l'écran : une rangée
 * sans contenu réel n'est pas affichée, « Continuer à regarder » n'existe
 * qu'avec une vraie position.
 */

type HomeData = { key: string; ok: true; catalog: PlayTitle[]; clips: PlayTitle[]; top: string[] } | { key: string; ok: false };
type ResumeItem = { entry: WatchProgress; title: PlayTitle; episode: PlayEpisode | null };

/** Deux colonnes quand le panneau central le permet : la scène (ou le catalogue), et la colonne de droite. */
const SPLIT_COLS = "@min-[60rem]:grid-cols-[minmax(0,1fr)_19rem] @min-[80rem]:grid-cols-[minmax(0,1fr)_21rem]";
const SPLIT = `grid gap-5 ${SPLIT_COLS}`;
/**
 * Cartes d'« À l'affiche » : sur téléphone, une rangée qui glisse (de grandes
 * cartes plutôt que deux petites colonnes) ; ensuite, trois colonnes.
 */
const AFFICHE_LIST =
  "no-scrollbar grid snap-x snap-mandatory auto-cols-[78%] grid-flow-col gap-3 overflow-x-auto pb-4 pt-2 max-sm:-mx-4 max-sm:scroll-px-4 max-sm:px-4 @min-[36rem]:grid-flow-row @min-[36rem]:grid-cols-3 @min-[36rem]:gap-4 @min-[36rem]:overflow-visible @min-[36rem]:pb-0 @min-[56rem]:gap-5";

export function PlayHomeView() {
  const market = useHomeMarket();
  const { user } = useAuth();
  const pending = useMarketPending();
  const { notify } = useDialogs();
  const [round, setRound] = useState(0);
  const [data, setData] = useState<HomeData | null>(null);
  const [resume, setResume] = useState<ResumeItem[]>([]);
  const [heroIndex, setHeroIndex] = useState(0);
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
  // « Continuer à regarder » : seulement avec une VRAIE position (≥ 30 s, pas finie).
  const resumeShown = user && resumeEntries(progress).length > 0 ? resume : [];

  // L'ambiance de la page suit le titre à la une.
  useSceneBackdrop(hero[Math.min(heroIndex, Math.max(0, hero.length - 1))] ?? null);

  // Téléphone : la bannière (ou son squelette) passe sous la barre du haut.
  const bleed = market ? current === null || (!!ready && hero.length > 0) : pending;
  const page = bleed ? "max-sm:pt-0" : undefined;

  if (!market) {
    return (
      <PlayPage className={page}>
        <h1 className="sr-only">Rivendy Play — films, séries et clips</h1>
        {pending ? <HomeSkeleton /> : <MarketPrompt />}
      </PlayPage>
    );
  }

  const forget = async (item: ResumeItem) => {
    if (await forgetProgress(item.title.id)) {
      setResume((l) => l.filter((r) => r.title.id !== item.title.id));
      notify(`« ${item.title.title} » retiré de Continuer à regarder.`, "success");
    } else notify("Action impossible pour l’instant.", "error");
  };

  const loginNote = <LoginNote text="Connectez-vous pour regarder, reprendre vos films là où vous les avez laissés et retrouver Ma liste — sur le site comme dans l’application." />;
  const largeCatalog = rows.length > 0 && rows[0].id !== "affiche";

  return (
    <PlayPage className={page}>
      <h1 className="sr-only">Rivendy Play — films, séries et clips</h1>
      {current === null ? (
        <HomeSkeleton />
      ) : !current.ok ? (
        <ErrorState onRetry={() => setRound((n) => n + 1)} />
      ) : (
        <>
          {hero.length > 0 ? (
            <div className={SPLIT}>
              <CinematicHero titles={hero} progress={progress} index={heroIndex} onIndex={setHeroIndex} className={sceneBleed} />
              <div className="flex min-w-0 flex-col gap-3">
                <Signature />
                <DiscoverPanel catalog={current.catalog} className="flex-1" />
              </div>
            </div>
          ) : null}
          <ContinueWatching items={resumeShown} onForget={(r) => void forget(r)} />
          {rows.map((row, i) => (
            <Fragment key={row.id}>
              {row.id === "affiche"
                ? <AfficheSection row={row} clipCount={current.clips.length} progress={progress} />
                : <HomeRowSection row={row} progress={progress} />}
              {i === 0 ? loginNote : null}
            </Fragment>
          ))}
          {current.clips.length > 0 ? (
            <Section id="row-clips" title="Clips" unit="clip" count={current.clips.length} href="/play/clips">
              <MediaRow label="Clips" layout="wide">
                {current.clips.slice(0, 20).map((t) => <MediaRowItem key={t.id}><ClipCard title={t} /></MediaRowItem>)}
              </MediaRow>
            </Section>
          ) : null}
          {largeCatalog ? <TalentsBanner clipCount={current.clips.length} /> : null}
          {rows.length === 0 ? loginNote : null}
          {rows.length === 0 && current.clips.length === 0 ? (
            <EmptyState title="Le catalogue de votre pays arrive bientôt"
              text="Aucun film, aucune série ni aucun clip n’est encore disponible dans votre pays. Revenez bientôt." />
          ) : null}
        </>
      )}
    </PlayPage>
  );
}

/**
 * Signature de l'univers au-dessus du panneau : « Des histoires de chez nous. »
 * à droite sur grand écran (la signature complète est dans le menu) ;
 * « Votre cinéma. Votre univers. » sous la bannière sur téléphone et tablette.
 */
function Signature() {
  return (
    <>
      <p className="hidden items-center justify-end gap-2 text-[12px] text-rvp-muted @min-[60rem]:flex">
        <Sparkles className="h-3.5 w-3.5 text-rvp-accent" aria-hidden /> Des histoires de chez nous.
      </p>
      <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pt-2 @min-[60rem]:hidden">
        <span className={cn(display, "text-[20px] font-bold text-rvp-text")}>
          Votre cinéma. <span className="text-rvp-accent">Votre univers.</span>
        </span>
        <span className="text-[12px] text-rvp-muted">Des histoires de chez nous.</span>
      </p>
    </>
  );
}

function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden className="mt-5 flex-1 space-y-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="rvp-skeleton h-14 w-14 shrink-0 rounded-rvp-sm" />
          <div className="flex-1 space-y-2"><div className="rvp-skeleton h-3.5 w-3/4 rounded" /><div className="rvp-skeleton h-3 w-1/2 rounded" /></div>
        </div>
      ))}
    </div>
  );
}

function HomeSkeleton() {
  return (
    <>
      <div className={SPLIT}>
        <HeroSkeleton className={sceneBleed} />
        <div aria-hidden className="rvp-glass flex flex-col rounded-rvp-panel p-5">
          <div className="rvp-skeleton h-5 w-28 rounded-md" />
          <PanelSkeleton />
        </div>
      </div>
      <RowSkeleton layout="card" />
    </>
  );
}

/**
 * Panneau « À découvrir » (DiscoverPanel) : les FAVORIS du compte (Ma liste)
 * s'il en a ; sinon des SUGGESTIONS du catalogue, annoncées comme telles.
 * Sous la bannière quand la place manque (trois colonnes, ou une liste).
 */
function DiscoverPanel({ catalog, className }: { catalog: PlayTitle[]; className?: string }) {
  const { user, loading } = useAuth();
  const list = usePlayList();
  const mine = useMyListTitles();
  const waiting = loading || (!!user && !list.failed && (list.ids === null || mine.waiting));
  const favorites = !!user && !mine.failed && mine.titles.length > 0;
  const items = favorites ? mine.titles.slice(0, 3) : suggestionsFor(catalog, list.ids ?? [], 3);
  const total = favorites ? mine.titles.length : items.length;
  if (!waiting && items.length === 0) return null;

  // Les suggestions sont annoncées comme telles (titre ET sous-titre).
  const subtitle = favorites ? "Vos favoris, ici et dans l’application." : "Des suggestions à ajouter à votre liste.";
  return (
    <aside aria-labelledby="rvp-panneau" className={cn("rvp-glass @container flex min-w-0 flex-col rounded-rvp-panel px-5 pb-2 pt-5 shadow-rvp-card", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="rvp-panneau" className={cn(display, "text-[20px] font-bold text-rvp-text")}>{favorites ? "Ma liste" : "À découvrir"}</h2>
        {!waiting ? (
          <span className="grid h-7 min-w-7 shrink-0 place-items-center rounded-lg border border-rvp-edge bg-rvp-ground/50 px-1.5 text-[11px] font-semibold tabular-nums text-rvp-soft">
            <span aria-hidden>{total}</span>
            <span className="sr-only">{total} titre{total > 1 ? "s" : ""}</span>
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-[13px] leading-5 text-rvp-muted">{subtitle}</p>
      {waiting ? <PanelSkeleton /> : (
        <ul className="mt-3 flex-1 divide-y divide-white/[0.06] @min-[52rem]:mt-4 @min-[52rem]:grid @min-[52rem]:grid-cols-3 @min-[52rem]:gap-3 @min-[52rem]:divide-y-0">
          {items.map((t) => <PanelItem key={t.id} title={t} />)}
        </ul>
      )}
      <Link href="/play/my-list"
        className={cn("mt-1 flex h-12 items-center justify-between gap-2 border-t border-white/[0.06] text-[13px] font-semibold text-rvp-soft hover:text-rvp-accent", motion)}>
        {favorites ? `Voir toute ma liste${total > items.length ? ` (${total})` : ""}` : "Retrouver mes favoris"}
        <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
      </Link>
    </aside>
  );
}

function PanelItem({ title }: { title: PlayTitle }) {
  return (
    <li className="flex items-center gap-3 py-3 @min-[52rem]:rounded-rvp-card @min-[52rem]:border @min-[52rem]:border-white/[0.06] @min-[52rem]:bg-rvp-ground/30 @min-[52rem]:p-3">
      <Link href={titlePath(title)} className="group flex min-w-0 flex-1 items-center gap-3 rounded-rvp-sm">
        <span className={cn("relative h-14 w-14 shrink-0 overflow-hidden rounded-rvp-sm bg-rvp-raised ring-1 ring-white/10 group-hover:ring-rvp-edge-strong", motion)}>
          <PlayImg src={posterArt(title) ?? landscapeArt(title)} widths={[160, 320]} sizes="56px"
            className="absolute inset-0 h-full w-full object-cover object-[50%_18%]" />
        </span>
        <span className="min-w-0">
          <span className={cn("block truncate text-[14.5px] font-semibold text-rvp-text group-hover:text-rvp-accent @min-[52rem]:line-clamp-2 @min-[52rem]:whitespace-normal", motion)}>{title.title}</span>
          <span className="mt-0.5 block truncate text-[12.5px] text-rvp-muted">{panelMeta(title)}</span>
        </span>
      </Link>
      <ListToggle titleId={title.id} label={title.title} tone="panel" className="h-9 w-9" />
    </li>
  );
}

/** « Continuer à regarder » (ContinueWatchingSection) : cartes 16:9, reprise directe à la position enregistrée. */
function ContinueWatching({ items, onForget }: { items: ResumeItem[]; onForget: (r: ResumeItem) => void }) {
  if (items.length === 0) return null;
  return (
    <Section id="row-resume" title="Continuer à regarder" count={items.length}>
      <MediaRow label="Continuer à regarder" layout="wide">
        {items.map((r) => (
          <MediaRowItem key={r.title.id}>
            <ResumeCard title={r.title} href={resumeHref(r.entry)} kicker={resumeKicker(r.title, r.episode)}
              remaining={remainingLabel(r.entry.position_seconds, r.entry.duration_seconds)}
              ratio={r.entry.duration_seconds > 0 ? r.entry.position_seconds / r.entry.duration_seconds : null}
              onRemove={() => onForget(r)} removeLabel={`Retirer « ${r.title.title} » de Continuer à regarder`} />
          </MediaRowItem>
        ))}
      </MediaRow>
    </Section>
  );
}

/**
 * « À l'affiche » (petit catalogue) : toutes les cartes, filtre Tout / Films /
 * Séries s'il y a les deux, et « L'espace des talents » dans la colonne de
 * droite (sous les cartes quand la place manque).
 */
function AfficheSection({ row, clipCount, progress }: { row: HomeRow; clipCount: number; progress: WatchProgress[] }) {
  const filters = kindFilters(row.titles);
  const [filter, setFilter] = useState<KindFilter>("all");
  const active = filters.includes(filter) ? filter : "all";
  const shown = byKindFilter(row.titles, active);
  const talents = talentsTarget(clipCount);
  // Une grille : l'en-tête au-dessus des cartes, l'espace des talents à côté
  // d'elles (mêmes haut et bas, quelle que soit la hauteur de l'en-tête).
  return (
    <section aria-labelledby="row-affiche" className={cn("mt-10 grid gap-x-5 lg:mt-12", SPLIT_COLS)}>
      <div className="min-w-0 @min-[60rem]:col-start-1 @min-[60rem]:row-start-1">
        <SectionHeader id="row-affiche" title={row.title} count={row.titles.length}>
          {filters.length ? <KindSwitch label="Filtrer À l’affiche" options={filters} value={active} onChange={setFilter} /> : null}
        </SectionHeader>
      </div>
      <ul aria-label="Titres à l’affiche" className={cn(AFFICHE_LIST, "min-w-0 @min-[60rem]:col-start-1 @min-[60rem]:row-start-2")}>
        {shown.map((t, i) => (
          <li key={t.id} className="min-w-0 snap-start">
            <MediaCard title={t} eager={i < 3} progress={kindOf(t.kind) === "film" ? progressRatio(progress, t.id) : null} />
          </li>
        ))}
      </ul>
      <p aria-live="polite" className="sr-only">
        {active === "all" ? "" : `${shown.length} ${active === "film" ? "film" : "série"}${shown.length > 1 ? "s" : ""} à l’affiche`}
      </p>
      <TalentSpotlight href={talents.href} label={talents.label}
        className="mt-5 @min-[60rem]:col-start-2 @min-[60rem]:row-start-2 @min-[60rem]:mt-2 @min-[60rem]:max-h-[26rem] @min-[60rem]:min-h-0" />
    </section>
  );
}

/** Grand catalogue (MediaRow) : une rangée par rubrique (classement, nouveautés, genres, types). */
function HomeRowSection({ row, progress }: { row: HomeRow; progress: WatchProgress[] }) {
  const id = `row-${foldText(row.id).replace(/[^a-z0-9]+/g, "-")}`;
  const posters = row.layout !== "landscape";
  return (
    <Section id={id} title={row.title} count={row.titles.length} href={row.href} total={row.total}>
      <MediaRow label={row.title} layout={posters ? "poster" : "card"}>
        {row.titles.map((t, i) => (
          <MediaRowItem key={t.id}>
            {posters ? (
              <PosterCard title={t} rank={row.layout === "ranked" ? i + 1 : undefined}
                progress={kindOf(t.kind) === "film" ? progressRatio(progress, t.id) : null} />
            ) : (
              <MediaCard title={t} progress={kindOf(t.kind) === "film" ? progressRatio(progress, t.id) : null} />
            )}
          </MediaRowItem>
        ))}
      </MediaRow>
    </Section>
  );
}

/** Grand catalogue : l'espace des talents en bandeau, après les rangées. */
function TalentsBanner({ clipCount }: { clipCount: number }) {
  const talents = talentsTarget(clipCount);
  return <TalentSpotlight href={talents.href} label={talents.label} className="mt-10 lg:mt-12" />;
}
