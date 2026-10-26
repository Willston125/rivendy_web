"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, History, Lock, Trash2, UsersRound, X, type LucideIcon } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useDialogs } from "@/features/ui/dialogs";
import { cn } from "@/lib/utils/cn";
import { usePlayList } from "../play-list";
import { btnGhost, btnPrimary, btnSecondary, display, motion } from "../play-theme";
import { EmptyState, ErrorState, Spinner } from "../play-ui";
import { ArtistAvatar, ClipRow, ClipTile, VerifiedMark } from "./clips-cards";
import {
  fetchArtistsOfPeople, fetchClipArtists, fetchClipCounts, fetchClipHistory, fetchClipsByIds, forgetClipHistory, type Clip,
} from "./clips-api";
import { FollowButton } from "./clips-follow";
import { artistsToFollow, relativeDate, type ClipArtist, type ClipCounts } from "./clips-logic";
import { ClipsPage } from "./clips-shell";
import { useClips, useClipsCatalog } from "./clips-store";

/**
 * Pages du compte dans Rivendy Clips (refonte du 2026-10-26) : Abonnements,
 * Enregistrements, Historique. Les mêmes données que l'app — un clip enregistré
 * ici est dans « Enregistrements » de l'app (`play_list`, la liste du compte),
 * un artiste suivi ici l'est partout.
 */

function Heading({ title, intro, icon: Icon }: { title: string; intro: string; icon: LucideIcon }) {
  return (
    <header className="pb-6 pt-2 md:pt-1">
      <h1 className={cn(display, "flex items-center gap-3 text-[28px] leading-tight text-rvp-text sm:text-[34px]")}>
        <Icon className="h-7 w-7 text-rvp-accent" aria-hidden /> {title}
      </h1>
      <p className="mt-1.5 text-[15px] text-rvp-soft">{intro}</p>
    </header>
  );
}

function SignIn({ title, text }: { title: string; text: string }) {
  const pathname = usePathname() || "/play/clips";
  return (
    <EmptyState icon={Lock} title={title} text={text}>
      <Link href={`/auth/login?next=${encodeURIComponent(pathname)}`} prefetch={false} className={btnPrimary}>Se connecter</Link>
    </EmptyState>
  );
}

/** Artistes et compteurs des clips affichés : ceux du catalogue d'abord, les autres lus à part. */
function useClipExtras(clips: Clip[]): { artists: Record<string, ClipArtist>; counts: Record<string, ClipCounts> } {
  const { catalog } = useClipsCatalog();
  const base = catalog.status === "ready" ? catalog : null;
  const [extra, setExtra] = useState<{ artists: Record<string, ClipArtist>; counts: Record<string, ClipCounts> }>({ artists: {}, counts: {} });
  const missingArtists = clips.map((c) => c.artist_id).filter((id): id is string => !!id && !base?.artists[id] && !extra.artists[id]).join(",");
  const missingCounts = clips.filter((c) => !base?.counts[c.id] && !extra.counts[c.id]).map((c) => c.id).join(",");
  useEffect(() => {
    if (!missingArtists && !missingCounts) return;
    let alive = true;
    void Promise.all([
      missingArtists ? fetchClipArtists(missingArtists.split(",")) : Promise.resolve({}),
      missingCounts ? fetchClipCounts(missingCounts.split(",")) : Promise.resolve({}),
    ]).then(([a, c]) => {
      if (!alive) return;
      const zero = Object.fromEntries((missingCounts ? missingCounts.split(",") : []).map((id) => [id, { views: 0, likes: 0 }]));
      setExtra((e) => ({ artists: { ...e.artists, ...a }, counts: { ...e.counts, ...zero, ...c } }));
    });
    return () => { alive = false; };
  }, [missingArtists, missingCounts]);
  return useMemo(() => ({
    artists: { ...(base?.artists ?? {}), ...extra.artists },
    counts: { ...extra.counts, ...(base?.counts ?? {}) },
  }), [base, extra]);
}

function Grid({ clips, children }: { clips: Clip[]; children?: ReactNode }) {
  const { artists, counts } = useClipExtras(clips);
  const [now] = useState(() => new Date());
  return (
    <ul className="grid grid-cols-1 gap-x-4 gap-y-7 @min-[34rem]:grid-cols-2 @min-[52rem]:grid-cols-3 @min-[52rem]:gap-x-5 @min-[78rem]:grid-cols-4">
      {clips.map((c, i) => <li key={c.id}><ClipTile clip={c} artists={artists} counts={counts[c.id]} now={now} eager={i < 3} /></li>)}
      {children}
    </ul>
  );
}

// ── Enregistrements ────────────────────────────────────────────────────────

export function ClipsSavedView() {
  const { user, loading } = useAuth();
  const list = usePlayList();
  const [round, setRound] = useState(0);
  const [data, setData] = useState<{ key: string; clips: Clip[] | null } | null>(null);
  const ids = list.ids;
  const key = ids ? `${ids.join(",")}:${round}` : null;

  useEffect(() => {
    if (!key || !ids) return;
    let alive = true;
    void fetchClipsByIds(ids)
      .then((c) => { if (alive) setData({ key, clips: c }); })
      .catch(() => { if (alive) setData({ key, clips: null }); });
    return () => { alive = false; };
  }, [key, ids]);
  const current = data && data.key === key ? data : null;
  // Une fois lue, la grille garde son ordre ; un clip retiré disparaît tout de suite.
  const shown = (current?.clips ?? (data?.clips ?? [])).filter((c) => !ids || ids.includes(c.id));

  return (
    <ClipsPage>
      <Heading title="Enregistrements" icon={Bookmark} intro="Les clips que vous gardez pour plus tard — la même liste dans l’application Rivendy." />
      {loading ? <Spinner /> : !user ? (
        <SignIn title="Retrouvez vos clips enregistrés" text="Connectez-vous pour enregistrer des clips et les retrouver sur le site comme dans l’application." />
      ) : list.failed || current?.clips === null ? (
        <ErrorState text="Impossible de charger vos enregistrements. Vérifiez votre connexion." onRetry={() => { list.reload(); setRound((n) => n + 1); }} />
      ) : !current && !data ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <EmptyState icon={Bookmark} title="Aucun clip enregistré" text="Touchez « Enregistrer » sous un clip, ou dans le menu ⋮ d’une carte.">
          <Link href="/play/clips" className={btnSecondary}>Découvrir des clips</Link>
        </EmptyState>
      ) : <Grid clips={shown} />}
    </ClipsPage>
  );
}

// ── Historique ─────────────────────────────────────────────────────────────

export function ClipsHistoryView() {
  const { user, loading } = useAuth();
  const { confirm, notify } = useDialogs();
  const [round, setRound] = useState(0);
  const [data, setData] = useState<{ key: string; rows: Array<{ clip: Clip; viewed_at: string }> | null } | null>(null);
  const key = user ? `${user.id}:${round}` : null;
  const [now] = useState(() => new Date());

  useEffect(() => {
    if (!key) return;
    let alive = true;
    void fetchClipHistory()
      .then((rows) => { if (alive) setData({ key, rows }); })
      .catch(() => { if (alive) setData({ key, rows: null }); });
    return () => { alive = false; };
  }, [key]);
  const current = data && data.key === key ? data : null;
  const rows = useMemo(() => current?.rows ?? [], [current]);
  const { artists, counts } = useClipExtras(useMemo(() => rows.map((r) => r.clip), [rows]));

  const forget = async (ids: string[], all: boolean) => {
    if (all && !(await confirm({ title: "Effacer l’historique des clips ?", message: "Les clips vus disparaissent de l’historique, sur le site et dans l’application. Vos films et séries ne sont pas touchés.", confirmLabel: "Effacer", danger: true }))) return;
    if (await forgetClipHistory(ids)) {
      setData((d) => (d && d.rows ? { ...d, rows: d.rows.filter((r) => !ids.includes(r.clip.id)) } : d));
      notify(all ? "Historique des clips effacé." : "Retiré de l’historique.", "success");
    } else notify("Action impossible pour l’instant.", "error");
  };

  return (
    <ClipsPage>
      <Heading title="Historique" icon={History} intro="Les clips que vous avez regardés, sur le site et dans l’application." />
      {loading ? <Spinner /> : !user ? (
        <SignIn title="Retrouvez votre historique" text="Connectez-vous pour retrouver les clips que vous avez regardés." />
      ) : !current ? <Spinner /> : current.rows === null ? (
        <ErrorState text="Impossible de charger votre historique. Vérifiez votre connexion." onRetry={() => setRound((n) => n + 1)} />
      ) : rows.length === 0 ? (
        <EmptyState icon={History} title="Aucun clip regardé pour le moment" text="Les clips que vous regardez apparaîtront ici.">
          <Link href="/play/clips" className={btnSecondary}>Découvrir des clips</Link>
        </EmptyState>
      ) : (
        <>
          <ul className="max-w-3xl space-y-1.5">
            {rows.map((r) => (
              <li key={r.clip.id} className="group/row relative">
                <ClipRow clip={r.clip} artists={artists} counts={counts[r.clip.id]} now={now} note={`Vu ${relativeDate(r.viewed_at, now)}`} />
                <button type="button" onClick={() => void forget([r.clip.id], false)} aria-label={`Retirer « ${r.clip.title} » de l’historique`}
                  className={cn("absolute right-1 top-1 grid h-10 w-10 place-items-center rounded-full text-rvp-muted hover:bg-white/[0.06] hover:text-rvp-text", motion)}>
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => void forget(rows.map((r) => r.clip.id), true)} className={cn(btnGhost, "mt-4 px-0")}>
            <Trash2 className="h-4 w-4" aria-hidden /> Effacer l’historique des clips
          </button>
        </>
      )}
    </ClipsPage>
  );
}

// ── Abonnements ────────────────────────────────────────────────────────────

export function ClipsFollowingView() {
  const { user, loading } = useAuth();
  const { follows } = useClips();
  const { catalog, retry } = useClipsCatalog();
  const ready = catalog.status === "ready" ? catalog : null;
  const ids = follows.ids;
  const idsKey = ids ? [...ids].sort().join(",") : null;
  const [people, setPeople] = useState<{ key: string; artists: ClipArtist[] } | null>(null);

  useEffect(() => {
    if (idsKey == null) return;
    let alive = true;
    void fetchArtistsOfPeople(idsKey ? idsKey.split(",") : []).then((a) => { if (alive) setPeople({ key: idsKey, artists: a }); });
    return () => { alive = false; };
  }, [idsKey]);

  const followedArtists = people && people.key === idsKey ? people.artists : null;
  const clips = useMemo(() => {
    if (!ready || !ids) return [];
    return ready.clips
      .filter((c) => c.artist_id && ready.artists[c.artist_id]?.user_id && ids.has(ready.artists[c.artist_id].user_id ?? ""))
      .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
  }, [ready, ids]);
  const suggestions = useMemo(() => (ready ? artistsToFollow(ready.clips, ready.artists).filter((a) => !ids?.has(a.user_id ?? "")) : []), [ready, ids]);

  return (
    <ClipsPage>
      <Heading title="Abonnements" icon={UsersRound} intro="Les nouveaux clips des artistes que vous suivez." />
      {loading ? <Spinner /> : !user ? (
        <SignIn title="Suivez vos artistes" text="Connectez-vous pour suivre des artistes et retrouver ici leurs nouveaux clips." />
      ) : follows.failed || catalog.status === "error" ? (
        <ErrorState text="Impossible de charger vos abonnements. Vérifiez votre connexion." onRetry={retry} />
      ) : !ready || !ids || !followedArtists ? <Spinner /> : (
        <>
          {followedArtists.length > 0 ? (
            <ul aria-label="Artistes suivis" className="no-scrollbar -mx-4 mb-8 flex gap-5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
              {followedArtists.map((a) => (
                <li key={a.id} className="w-24 shrink-0 text-center">
                  <Link href={`/artist/${a.id}`} prefetch={false} className="group flex flex-col items-center rounded-rvp">
                    <ArtistAvatar artist={a} name={a.name} className={cn("h-20 w-20 text-[24px] ring-2 ring-transparent group-hover:ring-rvp-accent", motion)} />
                    <span className="mt-2 flex max-w-full items-center justify-center gap-1 text-[13.5px] font-semibold text-rvp-text">
                      <span className="truncate">{a.name}</span><VerifiedMark />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {clips.length > 0 ? <Grid clips={clips} /> : (
            <EmptyState icon={UsersRound}
              title={followedArtists.length === 0 ? "Vous ne suivez encore aucun artiste" : "Pas encore de clip de vos artistes ici"}
              text={followedArtists.length === 0 ? "Suivez un artiste depuis l’un de ses clips : ses nouveautés arriveront ici." : "Leurs prochains clips publiés dans votre pays apparaîtront ici."}>
              <Link href="/play/clips" className={btnSecondary}>Découvrir des clips</Link>
            </EmptyState>
          )}
          {suggestions.length > 0 ? (
            <section aria-labelledby="a-suivre-artistes" className="mt-10 border-t border-rvp-line pt-7">
              <h2 id="a-suivre-artistes" className={cn(display, "text-[21px] font-bold text-rvp-text")}>Des artistes à suivre</h2>
              <ul className="mt-4 grid grid-cols-1 gap-3 @min-[34rem]:grid-cols-2 @min-[64rem]:grid-cols-3">
                {suggestions.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 rounded-rvp-panel border border-rvp-edge bg-rvp-surface p-3">
                    <Link href={`/artist/${a.id}`} prefetch={false} className="flex min-w-0 flex-1 items-center gap-3 rounded-rvp">
                      <ArtistAvatar artist={a} name={a.name} className="h-12 w-12 text-[16px]" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1 font-semibold text-rvp-text"><span className="truncate">{a.name}</span><VerifiedMark /></span>
                        {a.genre ? <span className="block truncate text-[13px] text-rvp-muted">{a.genre}</span> : null}
                      </span>
                    </Link>
                    <FollowButton userId={a.user_id} name={a.name} size="sm" />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </ClipsPage>
  );
}
