"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Check, CircleCheck, Clock, Film, MicVocal, Plus, ShieldAlert } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { artistStatusOf, type ArtistStatus } from "@/features/play/clips/clips-logic";
import { cn } from "@/lib/utils/cn";
import { loginHref } from "./music-pending";
import { Cover, ListSkeleton, primaryButton, secondaryButton, useLoad } from "./music-ui";
import { ArtistProfileForm } from "./studio/artist-profile-form";
import { fetchMyArtist, type MyArtist } from "./studio/studio-api";
import { ARTIST_SPACE, NEW_RELEASE_PATH, STUDIO_PATH } from "./studio/studio-paths";
import { StudioReleaseList } from "./studio/studio-releases";

/**
 * Espace artiste de la Musique (lot 2 du 2026-10-29 ; publication sur le
 * site, lot 1 du 2026-11-11, canevas validé). Avant : la demande de compte et
 * la publication renvoyaient vers l'application Android — une impasse pour un
 * iPhone. Maintenant tout se fait ici, avec les fonctions de l'app : demande
 * de compte (play_artist_save), profil, « clips seulement », changement de
 * nom ; puis le studio (/music/studio) pour les sorties. Mêmes états et
 * libellés que l'app (artist_space_screen.dart, musique_publish_sheet.dart).
 */
export function MusicArtistSpaceView() {
  const { user, loading } = useAuth();
  const pathname = usePathname() || ARTIST_SPACE;
  const me = useLoad(user ? `my-artist:${user.id}` : null, () => (user ? fetchMyArtist(user.id) : Promise.resolve(null)));
  const artist = me.data;
  const status = artistStatusOf(artist?.status);
  const music = status === "approved" && artist?.music_enabled !== false;
  const known = !!user && !me.loading && !me.error;
  const [editing, setEditing] = useState(false);

  // Lien « #demande » ou « #profil » (feuille « Publier ») : la section arrive après la lecture du compte.
  useEffect(() => {
    if (!known) return;
    const id = window.location.hash.slice(1);
    if (id === "demande" || id === "profil") document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [known]);

  const saved = () => { setEditing(false); me.reload(); };

  return (
    <div className="pb-10">
      <header className="rvm-deep rvm-artist-header px-4 pb-7 pt-10 @2xl:px-8 @2xl:pt-12">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-rvm-ink-accent">Rivendy Musique</p>
        <h1 className="mt-1.5 flex items-center gap-3 font-rvm-display text-[clamp(2rem,5cqw,3rem)] font-black leading-none tracking-tight">
          <MicVocal className="h-[0.8em] w-[0.8em] shrink-0 text-rvm-ink-accent" aria-hidden /> Espace artiste
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-rvm-soft @2xl:text-base">
          {known && music
            ? "Vos sorties, votre profil et vos écoutes. Tout se publie ici, comme dans l’application, avec le même compte."
            : "Publiez vos singles, EP et albums sur Rivendy Musique, depuis le site ou l’application. Chaque compte artiste est vérifié par Rivendy avant la première sortie."}
        </p>
      </header>

      <div className="grid gap-6 px-4 pt-5 @2xl:px-8 @4xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          {loading || me.loading ? <ListSkeleton rows={3} />
            : !user ? (
              <>
                <SignInCard path={pathname} />
                <AboutArtists />
              </>
            ) : me.error ? (
              <div role="alert" className="rounded-2xl border border-rvm-line bg-rvm-panel p-5">
                <p className="font-semibold">Impossible de vérifier votre compte artiste.</p>
                <p className="mt-1 text-sm text-rvm-soft">Vérifiez votre connexion, puis réessayez.</p>
                <button type="button" onClick={me.reload} className={cn(secondaryButton, "mt-4 h-10")}>Réessayer</button>
              </div>
            ) : status === "none" || !artist ? (
              <>
                <AboutArtists />
                <FormSection id="demande" title="Devenir artiste">
                  <ArtistProfileForm artist={null} onSaved={saved} />
                </FormSection>
              </>
            ) : status === "approved" ? (
              <>
                <ArtistCard artist={artist} music={music} />
                {music ? (
                  <section aria-labelledby="rvm-my-releases">
                    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                      <h2 id="rvm-my-releases" className="font-rvm-display text-xl font-extrabold sm:text-2xl">Mes sorties</h2>
                      <Link href={STUDIO_PATH} className="ml-auto text-sm font-bold text-rvm-ink-accent hover:underline">Tout voir</Link>
                    </div>
                    <StudioReleaseList artistId={artist.id} limit={5} />
                  </section>
                ) : null}
                <FormSection id="profil" title="Mon profil artiste">
                  <ArtistProfileForm key={`${artist.id}:${artist.music_enabled}:${artist.name_request ?? ""}`} artist={artist} onSaved={saved} />
                </FormSection>
              </>
            ) : (
              <>
                <RequestCard status={status} artist={artist} editing={editing} onEdit={() => setEditing(true)} />
                {editing && status !== "suspended" ? (
                  <FormSection id="demande" title={status === "rejected" ? "Corriger ma demande" : "Modifier ma demande"}>
                    <ArtistProfileForm artist={artist} onSaved={saved} />
                  </FormSection>
                ) : null}
              </>
            )}
        </div>
        <Aside />
      </div>
    </div>
  );
}

function FormSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titre`} className="scroll-mt-4">
      <h2 id={`${id}-titre`} className="mb-3 font-rvm-display text-xl font-extrabold sm:text-2xl">{title}</h2>
      {children}
    </section>
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
  "Ensuite : singles, EP et albums, vérifiés par Rivendy avant la mise en ligne.",
  "Vos titres s’écoutent sur le site et dans l’application, avec le même compte.",
];

function AboutArtists() {
  return (
    <section aria-labelledby="rvm-about-artists" className="rounded-2xl border border-rvm-line bg-rvm-panel p-5 @2xl:p-6">
      <h2 id="rvm-about-artists" className="font-rvm-display text-xl font-extrabold sm:text-2xl">Vous êtes artiste ?</h2>
      <ul className="mt-3.5 space-y-2.5 text-[15px] leading-relaxed text-rvm-soft">
        {ABOUT.map((t) => (
          <li key={t} className="flex gap-2.5"><Check className="mt-1 h-[18px] w-[18px] shrink-0 text-rvm-ink-accent" aria-hidden />{t}</li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Demande en vérification, refusée ou compte suspendu : ce qui se passe, le
 * motif s'il existe, et l'action de l'app (« Modifier ma demande »,
 * « Corriger et renvoyer »), désormais sur le site. Couleurs lisibles sur le
 * fond clair (l'ancien ambre pâle ne l'était pas).
 */
function RequestCard({ status, artist, editing, onEdit }: {
  status: Exclude<ArtistStatus, "none" | "approved">; artist: MyArtist; editing: boolean; onEdit: () => void;
}) {
  const pending = status === "pending";
  const Icon = pending ? Clock : ShieldAlert;
  const title = pending ? "Demande en vérification" : status === "rejected" ? "Demande non retenue" : "Compte artiste suspendu";
  return (
    <section className="rounded-2xl border border-rvm-line bg-rvm-panel p-5">
      <p className={cn("inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-extrabold",
        pending ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700")}>
        <Icon className="h-4 w-4" aria-hidden /> {title}
      </p>
      {pending ? (
        <p className="mt-3 text-[15px] leading-relaxed text-rvm-soft">
          Rivendy vérifie votre profil d’artiste « {artist.name} ». Vous serez prévenu par une notification, puis vous pourrez publier.
        </p>
      ) : null}
      {!pending && artist.review_reason ? (
        <p className="mt-3 text-[15px] text-rvm-soft"><strong className="text-rvm-text">Motif :</strong> {artist.review_reason}</p>
      ) : null}
      {status === "rejected" ? <p className="mt-2 text-[15px] leading-relaxed text-rvm-soft">Corrigez votre demande, puis renvoyez-la.</p> : null}
      {status === "suspended" ? (
        <p className="mt-2 text-[15px] leading-relaxed text-rvm-soft">
          La publication est fermée pour le moment.{" "}
          <Link href="/help" prefetch={false} className="font-semibold text-rvm-ink-accent hover:underline">Contactez Rivendy depuis l’Aide</Link> pour en savoir plus.
        </p>
      ) : null}
      {status !== "suspended" && !editing ? (
        <button type="button" onClick={onEdit} className={cn(pending ? secondaryButton : primaryButton, "mt-4")}>
          {pending ? "Modifier ma demande" : "Corriger et renvoyer"}
        </button>
      ) : null}
    </section>
  );
}

function ArtistCard({ artist, music }: { artist: MyArtist; music: boolean }) {
  return (
    <section aria-labelledby="rvm-artist-name" className="flex flex-col gap-4 rounded-2xl border border-rvm-line bg-rvm-panel p-5 @xl:flex-row @xl:items-center">
      {artist.avatar_url ? (
        <Cover url={artist.avatar_url} size={160} alt="" rounded="rounded-full" className="h-16 w-16 shrink-0" />
      ) : (
        <span aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rvm-brand/45 to-rvm-raised font-rvm-display text-2xl font-black">
          {artist.name.trim().charAt(0).toUpperCase() || "?"}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-rvm-ink-accent">
          <CircleCheck className="h-4 w-4" aria-hidden /> Compte artiste validé
        </p>
        <h2 id="rvm-artist-name" className="mt-1 truncate font-rvm-display text-2xl font-extrabold">{artist.name}</h2>
        <p className="mt-0.5 text-sm leading-relaxed text-rvm-soft">
          {music ? "Rivendy Musique activée : singles, EP, albums et stories."
            : "Vous avez choisi « clips seulement » : activez Rivendy Musique dans votre profil d’artiste pour publier singles, EP, albums et stories."}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2 self-start @xl:self-center">
        {music ? (
          <Link href={NEW_RELEASE_PATH} className={primaryButton}><Plus className="h-4 w-4" strokeWidth={2.8} aria-hidden /> Nouvelle sortie</Link>
        ) : null}
        <Link href={`/artist/${artist.id}`} className={secondaryButton}>
          Ma page publique <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

const STEPS = [
  { title: "Demandez votre compte", text: "Ici ou dans l’application : c’est le même compte Rivendy." },
  { title: "Rivendy vérifie", text: "Votre nom, votre photo et vos droits. Vous êtes prévenu par une notification." },
  { title: "Publiez", text: "Singles, EP et albums, vérifiés par Rivendy avant la mise en ligne." },
];

/** Colonne de droite : les étapes, les clips et les droits d'auteur (plus de renvoi vers Google Play). */
function Aside() {
  return (
    <aside className="h-fit space-y-4">
      <section aria-labelledby="rvm-artist-steps" className="rounded-2xl border border-rvm-line bg-rvm-panel p-5">
        <h2 id="rvm-artist-steps" className="font-rvm-display text-lg font-extrabold">En trois étapes</h2>
        <ol className="mt-3 space-y-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-rvm-accent text-[13px] font-extrabold text-rvm-on-accent">{i + 1}</span>
              <span className="min-w-0">
                <span className="block text-[15px] font-bold">{s.title}</span>
                <span className="block text-[13.5px] leading-snug text-rvm-soft">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
      <section className="rounded-2xl border border-rvm-line bg-rvm-panel p-5">
        <p className="flex items-center gap-2 font-semibold"><Film className="h-5 w-5 text-rvm-ink-accent" aria-hidden /> Vos clips vidéo</p>
        <p className="mt-2 text-sm leading-relaxed text-rvm-soft">Le même compte artiste sert pour Rivendy Clips. La publication des clips se fait pour le moment depuis l’application Android.</p>
        <div className="mt-3 flex flex-col gap-2 text-sm font-semibold">
          <Link href="/play/clips/artiste" prefetch={false} className="text-rvm-ink-accent hover:underline">Mes clips sur Rivendy Play →</Link>
          <Link href="/droits-auteur" prefetch={false} className="text-rvm-ink-accent hover:underline">Droits d’auteur sur Rivendy →</Link>
        </div>
      </section>
    </aside>
  );
}
