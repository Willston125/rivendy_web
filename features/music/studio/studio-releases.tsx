"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Disc3, Plus } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { artistStatusOf } from "@/features/play/clips/clips-logic";
import { cn } from "@/lib/utils/cn";
import { RELEASE_STATE_LABEL, addedAtLabel, releaseKindLabel, releaseState, type ReleaseState } from "../music-logic";
import { loginHref } from "../music-pending";
import { Cover, EmptyState, ListSkeleton, primaryButton, secondaryButton, useLoad } from "../music-ui";
import { fetchMyArtist, fetchStudioReleases, fetchStudioStats } from "./studio-api";
import { playsLabel } from "./studio-logic";
import { ARTIST_SPACE, NEW_RELEASE_PATH, releaseEditPath } from "./studio-paths";

/** Pastille d'état d'une sortie : couleurs lisibles sur le fond clair. */
const CHIP: Record<ReleaseState, string> = {
  published: "bg-rvm-accent/25 text-rvm-ink-accent",
  approved: "bg-rvm-accent/25 text-rvm-ink-accent",
  pending: "bg-amber-100 text-amber-800",
  rejected: "bg-red-100 text-red-700",
  draft: "bg-rvm-raised text-rvm-soft",
  archived: "bg-rvm-raised text-rvm-soft",
};

export function ReleaseStateChip({ state, className }: { state: ReleaseState; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[12px] font-extrabold", CHIP[state], className)}>
      {RELEASE_STATE_LABEL[state]}
    </span>
  );
}

/**
 * Mes sorties (lot 2, 2026-11-11) : la liste de l'app (musique_studio_screen
 * .dart) — pochette, type et nombre de titres, état, motif d'un refus, écoutes
 * du mois pour une sortie en ligne. Chaque sortie s'ouvre dans l'éditeur.
 */
export function StudioReleaseList({ artistId, limit }: { artistId: string; limit?: number }) {
  const list = useLoad(`studio-releases:${artistId}`, () => fetchStudioReleases(artistId));
  const stats = useLoad(`studio-stats:${artistId}`, () => fetchStudioStats());
  const [now] = useState(() => Date.now());

  if (list.error) {
    return (
      <div role="alert" className="rounded-2xl border border-rvm-line bg-rvm-panel p-5">
        <p className="font-semibold">Vos sorties n’ont pas pu être chargées. Vérifiez votre connexion.</p>
        <button type="button" onClick={list.reload} className={cn(secondaryButton, "mt-3 h-10")}>Réessayer</button>
      </div>
    );
  }
  if (!list.data) return <ListSkeleton rows={3} />;
  if (list.data.length === 0) {
    return (
      <EmptyState icon={Disc3} title="Aucune sortie pour le moment"
        text="Publiez votre premier single, EP ou album : Rivendy le vérifie puis le met en ligne."
        action={<Link href={NEW_RELEASE_PATH} className={primaryButton}><Plus className="h-4 w-4" strokeWidth={2.8} aria-hidden /> Nouvelle sortie</Link>} />
    );
  }
  const rows = limit ? list.data.slice(0, limit) : list.data;
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => {
        const state = releaseState(r.status, r.review_status);
        const n = r.music_tracks.length;
        const plays = stats.data?.releases[r.id];
        const added = addedAtLabel(r.created_at, now);
        return (
          <li key={r.id}>
            <Link href={releaseEditPath(r.id)}
              className="flex items-center gap-3 rounded-2xl border border-rvm-line bg-rvm-surface p-3 transition hover:border-rvm-ink-accent/50 hover:bg-rvm-raised/40">
              <Cover url={r.cover_url} size={160} alt="" rounded="rounded-[10px]" className="h-16 w-16 shrink-0" />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-[15px] font-bold">{r.title || "Sans titre"}</span>
                <span className="truncate text-[13px] text-rvm-soft">
                  {[releaseKindLabel(r.kind), `${n} titre${n > 1 ? "s" : ""}`, state === "draft" && added ? `créée ${/^\d/.test(added) ? `le ${added}` : added}` : ""].filter(Boolean).join(" · ")}
                </span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <ReleaseStateChip state={state} />
                  {state === "published" && plays ? (
                    <span className="text-[12.5px] text-rvm-soft">{playsLabel(plays.month)} ce mois-ci · {plays.total} au total</span>
                  ) : null}
                </span>
                {state === "rejected" && r.review_reason ? (
                  <span className="line-clamp-2 text-[12.5px] leading-snug text-red-700">Motif : {r.review_reason}</span>
                ) : null}
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-rvm-muted" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Page « Mes sorties » du studio (/music/studio). */
export function StudioReleasesView() {
  const { user, loading } = useAuth();
  const me = useLoad(user ? `my-artist:${user.id}` : null, () => (user ? fetchMyArtist(user.id) : Promise.resolve(null)));
  const artist = me.data;
  const approved = artistStatusOf(artist?.status) === "approved";
  const music = approved && artist?.music_enabled !== false;
  const stats = useLoad(music && artist ? `studio-stats:${artist.id}` : null, () => fetchStudioStats());

  return (
    <div className="px-4 pb-10 pt-6 @2xl:px-8">
      <Link href={ARTIST_SPACE} className="inline-flex min-h-8 items-center gap-1 text-[13.5px] font-bold text-rvm-ink-accent hover:underline">
        <ChevronRight className="h-4 w-4 rotate-180" aria-hidden /> Espace artiste
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 flex-1 font-rvm-display text-[28px] font-black tracking-tight @2xl:text-4xl">Mes sorties</h1>
        {music ? (
          <Link href={NEW_RELEASE_PATH} className={primaryButton}><Plus className="h-4 w-4" strokeWidth={2.8} aria-hidden /> Nouvelle sortie</Link>
        ) : null}
      </div>
      {music && stats.data ? (
        <p className="mt-2 text-[13px] font-bold text-rvm-ink-accent">
          {stats.data.followers} abonné{stats.data.followers > 1 ? "s" : ""} · {playsLabel(Object.values(stats.data.releases).reduce((a, b) => a + b.month, 0))} ce mois-ci
        </p>
      ) : null}

      <div className="mt-5 max-w-3xl">
        {loading || me.loading ? <ListSkeleton rows={4} />
          : !user ? (
            <EmptyState title="Connectez-vous à votre compte Rivendy" text="Le même compte sert sur le site et dans l’application."
              action={<Link href={loginHref("/music/studio")} prefetch={false} className={primaryButton}>Se connecter</Link>} />
          ) : me.error ? (
            <div role="alert" className="rounded-2xl border border-rvm-line bg-rvm-panel p-5">
              <p className="font-semibold">Vos sorties n’ont pas pu être chargées. Vérifiez votre connexion.</p>
              <button type="button" onClick={me.reload} className={cn(secondaryButton, "mt-3 h-10")}>Réessayer</button>
            </div>
          ) : !approved || !artist ? (
            <EmptyState title="La publication est réservée aux artistes vérifiés par Rivendy."
              action={<Link href={ARTIST_SPACE} className={primaryButton}>Mon espace artiste</Link>} />
          ) : !music ? (
            <EmptyState title="Vous avez choisi « clips seulement »"
              text="Activez Rivendy Musique dans votre profil artiste pour publier."
              action={<Link href={`${ARTIST_SPACE}#profil`} className={primaryButton}>Mon profil artiste</Link>} />
          ) : (
            <>
              <StudioReleaseList artistId={artist.id} />
              <p className="mt-4 text-[12.5px] leading-snug text-rvm-muted">Mêmes sorties que dans l’application : un brouillon commencé ici se reprend là-bas, et inversement.</p>
            </>
          )}
      </div>
    </div>
  );
}
