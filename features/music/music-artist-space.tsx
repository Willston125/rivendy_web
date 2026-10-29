"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Check, CircleCheck, Clock, Disc3, Download, MicVocal, ShieldAlert, Smartphone } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { artistStatusOf, type ArtistStatus } from "@/features/play/clips/clips-logic";
import { PLAY_STORE_URL } from "@/features/play/play-link-page";
import { cn } from "@/lib/utils/cn";
import { fetchMyMusicArtist, fetchMyReleases, type MyMusicArtist } from "./music-api";
import { RELEASE_STATE_LABEL, addedAtLabel, releaseKindLabel, releaseState, type ReleaseState } from "./music-logic";
import { ARTIST_SPACE_PATH } from "./music-nav";
import { loginHref } from "./music-pending";
import { Cover, EmptyState, ListSkeleton, primaryButton, secondaryButton, useLoad } from "./music-ui";

/**
 * Espace artiste de la Musique (lot 2, 2026-10-29), jumeau de celui de Clips
 * (/play/clips/artiste). La demande de compte artiste et la publication
 * (fichiers audio, pochettes, stories) existent dans l'application Rivendy —
 * elles ne sont PAS refaites ici. Le site montre l'état réel du compte et de
 * ses sorties, et dit exactement où aller dans l'app : Musique → Publier
 * (`musique_publish_sheet.dart`, mêmes libellés).
 */

/** Ce que la carte « Dans l'application » explique, selon le compte. */
type Phase = "create" | "follow" | "enable" | "publish";

export function MusicArtistSpaceView() {
  const { user, loading } = useAuth();
  const pathname = usePathname() || ARTIST_SPACE_PATH;
  const me = useLoad(user ? `my-artist:${user.id}` : null, () => (user ? fetchMyMusicArtist(user.id) : Promise.resolve(null)));
  const profile = me.data;
  const status = artistStatusOf(profile?.status);
  const music = status === "approved" && profile?.music_enabled !== false;
  const phase: Phase = status === "approved" ? (music ? "publish" : "enable") : status === "none" ? "create" : "follow";
  const known = !!user && !me.loading && !me.error;

  return (
    <div className="pb-10">
      <header className="rvm-artist-header px-4 pb-7 pt-10 @2xl:px-8 @2xl:pt-12">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-rvm-accent">Rivendy Musique</p>
        <h1 className="mt-1.5 flex items-center gap-3 font-rvm-display text-[clamp(2rem,5cqw,3rem)] font-black leading-none tracking-tight">
          <MicVocal className="h-[0.8em] w-[0.8em] shrink-0 text-rvm-accent" aria-hidden /> Espace artiste
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-rvm-soft @2xl:text-base">
          {known && music
            ? "Vos sorties et leur statut, sur le site. La publication se fait dans l’application."
            : "Publiez vos singles, EP et albums sur Rivendy Musique. Chaque compte artiste est vérifié par Rivendy avant la première sortie."}
        </p>
      </header>

      <div className="grid gap-6 px-4 pt-2 @2xl:px-8 @4xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          {loading || me.loading ? <ListSkeleton rows={3} />
            : !user ? (
              <>
                <SignInCard path={pathname} />
                <AboutArtists />
                <Steps />
              </>
            ) : me.error ? (
              <div role="alert" className="rounded-2xl border border-rvm-line bg-rvm-panel p-5">
                <p className="font-semibold">Impossible de vérifier votre compte artiste.</p>
                <p className="mt-1 text-sm text-rvm-soft">Vérifiez votre connexion, puis réessayez.</p>
                <button type="button" onClick={me.reload} className={cn(secondaryButton, "mt-4 h-10")}>Réessayer</button>
              </div>
            ) : status === "none" || !profile ? (
              <>
                <AboutArtists />
                <Steps />
              </>
            ) : status === "approved" ? (
              <>
                <ArtistCard profile={profile} music={music} />
                {music ? <MyReleases artistId={profile.id} /> : null}
              </>
            ) : <RequestCard status={status} name={profile.name} reason={profile.review_reason} />}
        </div>
        <AppCard phase={known ? phase : "create"} />
      </div>
    </div>
  );
}

function SignInCard({ path }: { path: string }) {
  return (
    <section aria-labelledby="rvm-artist-signin" className="flex flex-col gap-4 rounded-2xl border border-rvm-line bg-rvm-panel p-5 @xl:flex-row @xl:items-center">
      <div className="min-w-0 flex-1">
        <h2 id="rvm-artist-signin" className="font-rvm-display text-xl font-extrabold">Connectez-vous à votre compte Rivendy</h2>
        <p className="mt-1 text-sm leading-relaxed text-rvm-soft">
          Le même compte sert sur le site et dans l’application : vous y retrouvez votre profil d’artiste et vos sorties.
        </p>
      </div>
      <Link href={loginHref(path)} prefetch={false} className={cn(primaryButton, "shrink-0 self-start @xl:self-center")}>Se connecter</Link>
    </section>
  );
}

const ABOUT = [
  "Un compte Rivendy suffit : pas besoin d’être vendeur.",
  "Rivendy vérifie votre profil : votre nom d’artiste, votre photo et vos droits sur votre musique.",
  "Ensuite : singles, EP et albums, vérifiés par Rivendy avant la mise en ligne, et des stories de 24 h.",
  "Vos titres s’écoutent sur le site et dans l’application, avec le même compte.",
];

function AboutArtists() {
  return (
    <section aria-labelledby="rvm-about-artists" className="rounded-2xl border border-rvm-line bg-rvm-panel p-5 @2xl:p-6">
      <h2 id="rvm-about-artists" className="font-rvm-display text-xl font-extrabold sm:text-2xl">Vous êtes artiste ?</h2>
      <ul className="mt-3.5 space-y-2.5 text-[15px] leading-relaxed text-rvm-soft">
        {ABOUT.map((t) => (
          <li key={t} className="flex gap-2.5"><Check className="mt-1 h-[18px] w-[18px] shrink-0 text-rvm-accent" aria-hidden />{t}</li>
        ))}
      </ul>
    </section>
  );
}

const STEPS = [
  { title: "Installez l’application", text: "Rivendy, sur Google Play, avec votre compte habituel." },
  { title: "Demandez votre compte artiste", text: "Musique → Publier → « Devenir artiste »." },
  { title: "Publiez après validation", text: "Rivendy vérifie votre profil, vous êtes prévenu dans l’application, puis vous publiez." },
];

function Steps() {
  return (
    <section aria-labelledby="rvm-artist-steps">
      <h2 id="rvm-artist-steps" className="mb-3 font-rvm-display text-xl font-extrabold sm:text-2xl">En trois étapes</h2>
      <ol className="grid gap-3 @2xl:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="rounded-2xl bg-white/[0.05] p-4">
            <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-rvm-accent font-extrabold text-rvm-on-accent">{i + 1}</span>
            <p className="mt-2.5 text-[15px] font-bold">{s.title}</p>
            <p className="mt-1 text-[13.5px] leading-snug text-rvm-soft">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Demande en vérification, refusée ou compte suspendu : ce qui se passe, et le motif s'il existe. */
function RequestCard({ status, name, reason }: { status: Exclude<ArtistStatus, "none" | "approved">; name: string | null; reason: string | null }) {
  const Icon = status === "pending" ? Clock : ShieldAlert;
  const title = status === "pending" ? "Demande en vérification" : status === "rejected" ? "Demande non retenue" : "Compte artiste suspendu";
  return (
    <section className="rounded-2xl border border-rvm-line bg-rvm-panel p-5">
      <p className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-amber-300"><Icon className="h-4 w-4" aria-hidden /> {title}</p>
      {status === "pending" ? (
        <p className="mt-2 text-[15px] leading-relaxed text-rvm-soft">
          Rivendy vérifie votre profil d’artiste{name ? ` « ${name} »` : ""}. Vous serez prévenu dans l’application, puis vous pourrez publier.
        </p>
      ) : null}
      {status !== "pending" && reason ? <p className="mt-2 text-[15px] text-rvm-soft">Motif : {reason}</p> : null}
      {status === "rejected" ? (
        <p className="mt-2 text-[15px] leading-relaxed text-rvm-soft">Corrigez votre profil depuis l’application, puis renvoyez-le à la vérification.</p>
      ) : null}
      {status === "suspended" ? (
        <p className="mt-2 text-[15px] leading-relaxed text-rvm-soft">
          La publication est fermée pour le moment.{" "}
          <Link href="/help" prefetch={false} className="font-semibold text-rvm-accent hover:underline">Contactez Rivendy depuis l’Aide</Link> pour en savoir plus.
        </p>
      ) : null}
    </section>
  );
}

function ArtistCard({ profile, music }: { profile: MyMusicArtist; music: boolean }) {
  return (
    <section aria-labelledby="rvm-artist-name" className="flex flex-col gap-4 rounded-2xl border border-rvm-line bg-rvm-panel p-5 @xl:flex-row @xl:items-center">
      {profile.avatar_url ? (
        <Cover url={profile.avatar_url} size={160} alt="" rounded="rounded-full" className="h-16 w-16 shrink-0" />
      ) : (
        <span aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rvm-brand/45 to-rvm-raised font-rvm-display text-2xl font-black">
          {profile.name.trim().charAt(0).toUpperCase() || "?"}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-rvm-accent">
          <CircleCheck className="h-4 w-4" aria-hidden /> Compte artiste validé
        </p>
        <h2 id="rvm-artist-name" className="mt-1 truncate font-rvm-display text-2xl font-extrabold">{profile.name}</h2>
        <p className="mt-0.5 text-sm leading-relaxed text-rvm-soft">
          {music ? "Rivendy Musique activée : singles, EP, albums et stories."
            : "Vous avez choisi « clips seulement » : activez Rivendy Musique dans votre profil d’artiste pour publier singles, EP, albums et stories."}
        </p>
      </div>
      <Link href={`/artist/${profile.id}`} className={cn(secondaryButton, "shrink-0 self-start @xl:self-center")}>
        Voir ma page publique <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </section>
  );
}

const CHIP: Record<ReleaseState, string> = {
  published: "bg-rvm-accent/15 text-rvm-accent",
  approved: "bg-rvm-accent/15 text-rvm-accent",
  pending: "bg-amber-300/[0.12] text-amber-300",
  rejected: "bg-amber-300/[0.12] text-amber-300",
  draft: "bg-white/10 text-rvm-soft",
  archived: "bg-white/10 text-rvm-soft",
};

/** Mes sorties, en lecture seule : leur état, et le motif d'un refus. */
function MyReleases({ artistId }: { artistId: string }) {
  const list = useLoad(`my-releases:${artistId}`, () => fetchMyReleases(artistId));
  const [now] = useState(() => Date.now());
  return (
    <section aria-labelledby="rvm-my-releases">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="rvm-my-releases" className="font-rvm-display text-xl font-extrabold sm:text-2xl">Mes sorties</h2>
        <p className="text-[13px] text-rvm-muted">Brouillons, en vérification, en ligne — comme dans l’application.</p>
      </div>
      {list.error ? (
        <div role="alert" className="rounded-2xl border border-rvm-line bg-rvm-panel p-5">
          <p className="font-semibold">Impossible de charger vos sorties.</p>
          <button type="button" onClick={list.reload} className={cn(secondaryButton, "mt-3 h-10")}>Réessayer</button>
        </div>
      ) : !list.data ? <ListSkeleton rows={3} /> : list.data.length === 0 ? (
        <EmptyState icon={Disc3} title="Aucune sortie envoyée pour l’instant"
          text="Préparez la première dans l’application : Musique → Publier → Nouvelle sortie." />
      ) : (
        <ul className="divide-y divide-rvm-line overflow-hidden rounded-2xl border border-rvm-line">
          {list.data.map((r) => {
            const state = releaseState(r.status, r.review_status);
            const added = addedAtLabel(r.created_at, now);
            const when = state === "published"
              ? (r.release_date ?? r.published_at ?? "").slice(0, 4)
              : added ? `créée ${/^\d/.test(added) ? `le ${added}` : added}` : "";
            return (
              <li key={r.id} className="flex items-center gap-3.5 px-4 py-3">
                <Cover url={r.cover_url} size={160} alt="" rounded="rounded-lg" className="h-14 w-14 shrink-0" />
                <div className="min-w-0 flex-1">
                  {state === "published" ? (
                    <Link href={`/music/album/${r.id}`} className="block truncate text-[15px] font-bold hover:underline">{r.title}</Link>
                  ) : <p className="truncate text-[15px] font-bold">{r.title || "Sans titre"}</p>}
                  <p className="truncate text-[13px] text-rvm-soft">{[releaseKindLabel(r.kind), when].filter(Boolean).join(" · ")}</p>
                  {state === "rejected" && r.review_reason ? <p className="mt-0.5 text-[13px] text-amber-300">Motif : {r.review_reason}</p> : null}
                </div>
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[12.5px] font-bold", CHIP[state])}>{RELEASE_STATE_LABEL[state]}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Où se fait la publication : l'application (aucun faux bouton sur le site). */
function AppCard({ phase }: { phase: Phase }) {
  const strong = (t: string) => <strong className="text-rvm-text">{t}</strong>;
  const how = {
    create: <>Pour créer votre compte artiste : ouvrez {strong("Musique")}, touchez {strong("Publier")}, puis {strong("Devenir artiste")}.</>,
    follow: <>Pour suivre ou corriger votre demande : ouvrez {strong("Musique")}, touchez {strong("Publier")}, puis {strong("Mon espace artiste")}.</>,
    enable: <>Pour activer Rivendy Musique : ouvrez {strong("Musique")}, touchez {strong("Publier")}, puis {strong("Mon profil artiste")}.</>,
    publish: <>Pour publier une sortie ou une story, ou reprendre un brouillon : ouvrez {strong("Musique")} et touchez {strong("Publier")}.</>,
  }[phase];
  return (
    <aside aria-label="Dans l’application Rivendy" className="h-fit rounded-2xl border border-rvm-accent/35 bg-rvm-accent/[0.07] p-5">
      <p className="flex items-center gap-2 font-semibold"><Smartphone className="h-5 w-5 text-rvm-accent" aria-hidden /> Dans l’application Rivendy</p>
      <p className="mt-2 text-[15px] leading-relaxed text-rvm-soft">{how}</p>
      <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" className={cn(secondaryButton, "mt-4 w-full")}>
        <Download className="h-4 w-4" aria-hidden /> L’application sur Google Play
      </a>
      <p className="mt-3 text-[12.5px] leading-snug text-rvm-muted">Les fichiers audio et les pochettes s’envoient depuis l’application, qui les prépare.</p>
      <div className="mt-4 flex flex-col gap-2 border-t border-white/[0.08] pt-4 text-sm font-semibold">
        <Link href="/play/clips/artiste" prefetch={false} className="text-rvm-accent hover:underline">Vous publiez aussi des clips vidéo ? Rivendy Play →</Link>
        <Link href="/droits-auteur" prefetch={false} className="text-rvm-accent hover:underline">Droits d’auteur sur Rivendy →</Link>
      </div>
    </aside>
  );
}
