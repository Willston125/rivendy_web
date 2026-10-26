"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle2, Clock, Download, ExternalLink, Heart, Lock, MessageCircle, MicVocal, Eye, ShieldAlert, Smartphone } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { cn } from "@/lib/utils/cn";
import { PLAY_STORE_URL } from "../play-link-page";
import { playImage } from "../play-logic";
import { btnPrimary, btnSecondary, display } from "../play-theme";
import { EmptyState, ErrorState, Spinner } from "../play-ui";
import { fetchMyClips, type MyClip } from "./clips-api";
import { clipPath, clockLabel, compactCount, myClipStatusLabel } from "./clips-logic";
import { ClipsPage } from "./clips-shell";
import { useClips } from "./clips-store";

/**
 * Espace artiste sur le site (refonte Clips du 2026-10-26). La création du
 * compte artiste, la publication et la gestion des clips (modifier, activer,
 * désactiver, supprimer) existent dans l'application Rivendy — elles ne sont
 * PAS refaites ici. Le site montre l'état réel du compte et de ses clips, et
 * dit exactement où aller : Play → « Créer » → « Espace artiste ».
 */
export function ClipsArtistSpaceView() {
  const { user, loading } = useAuth();
  const { artist } = useClips();
  const pathname = usePathname() || "/play/clips/artiste";
  const status = artist.status;
  const profile = artist.profile;

  return (
    <ClipsPage>
      <header className="pb-6 pt-2 md:pt-1">
        <h1 className={cn(display, "flex items-center gap-3 text-[28px] leading-tight text-rvp-text sm:text-[34px]")}>
          <MicVocal className="h-7 w-7 text-rvp-accent" aria-hidden /> Espace artiste
        </h1>
        <p className="mt-1.5 max-w-2xl text-[15px] text-rvp-soft">
          Publiez vos clips gratuitement sur Rivendy Play. Chaque compte artiste est vérifié par Rivendy avant la première publication.
        </p>
      </header>

      {loading ? <Spinner /> : !user ? (
        <EmptyState icon={Lock} title="Connectez-vous à votre compte Rivendy"
          text="Le même compte sert sur le site et dans l’application : vous y retrouvez votre profil d’artiste et vos clips.">
          <Link href={`/auth/login?next=${encodeURIComponent(pathname)}`} prefetch={false} className={btnPrimary}>Se connecter</Link>
        </EmptyState>
      ) : status === null ? <Spinner /> : (
        <div className="grid gap-6 @min-[64rem]:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-6">
            <StatusCard status={status} name={profile?.name ?? null} reason={profile?.review_reason ?? null} artistId={profile?.id ?? null} />
            {status === "approved" || status === "suspended" ? <MyClips /> : null}
          </div>
          <AppCard status={status} />
        </div>
      )}
    </ClipsPage>
  );
}

function StatusCard({ status, name, reason, artistId }: { status: string; name: string | null; reason: string | null; artistId: string | null }) {
  const card = "rounded-rvp-panel border border-rvp-edge bg-rvp-surface p-5";
  if (status === "approved") {
    return (
      <section className={card}>
        <p className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-rvp-accent"><CheckCircle2 className="h-4 w-4" aria-hidden /> Compte artiste validé</p>
        <p className={cn(display, "mt-2 text-[22px] text-rvp-text")}>{name}</p>
        <p className="mt-1 text-[14.5px] text-rvp-soft">Vos clips publiés sont gratuits pour tous, sur le site et dans l’application.</p>
        {artistId ? (
          <Link href={`/artist/${artistId}`} prefetch={false} className={cn(btnSecondary, "mt-4 h-11")}>
            <ExternalLink className="h-4 w-4" aria-hidden /> Voir ma page publique
          </Link>
        ) : null}
      </section>
    );
  }
  if (status === "pending") {
    return (
      <section className={card}>
        <p className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-amber-300"><Clock className="h-4 w-4" aria-hidden /> Demande en vérification</p>
        <p className="mt-2 text-[14.5px] text-rvp-soft">Rivendy vérifie votre profil d’artiste{name ? ` « ${name} »` : ""}. Vous pourrez publier vos clips dès sa validation.</p>
      </section>
    );
  }
  if (status === "rejected" || status === "suspended") {
    return (
      <section className={card}>
        <p className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-amber-300">
          <ShieldAlert className="h-4 w-4" aria-hidden /> {status === "rejected" ? "Demande refusée" : "Compte artiste suspendu"}
        </p>
        {reason ? <p className="mt-2 text-[14.5px] text-rvp-soft">Motif : {reason}</p> : null}
        <p className="mt-2 text-[14.5px] text-rvp-soft">
          {status === "rejected" ? "Corrigez votre profil depuis l’application, puis renvoyez-le à la vérification." : "Contactez Rivendy depuis l’Aide pour en savoir plus."}
        </p>
      </section>
    );
  }
  return (
    <section className={card}>
      <p className={cn(display, "text-[20px] text-rvp-text")}>Vous êtes artiste ?</p>
      <ul className="mt-3 space-y-2 text-[14.5px] text-rvp-soft">
        <li>• Un compte Rivendy suffit : pas besoin d’être vendeur.</li>
        <li>• Votre profil (nom, photo, genre) est vérifié par Rivendy.</li>
        <li>• Vos clips sont toujours gratuits pour le public, avec J’aime, commentaires et abonnés.</li>
      </ul>
    </section>
  );
}

/** Où se fait la gestion : l'application (aucun faux bouton sur le site). */
function AppCard({ status }: { status: string }) {
  const action = status === "approved" ? "publier un clip, le modifier, l’activer, le désactiver ou le supprimer"
    : status === "none" ? "créer votre profil d’artiste" : "suivre et modifier votre profil";
  return (
    <aside className="h-fit rounded-rvp-panel border border-rvp-edge-strong bg-rvp-accent/[0.07] p-5">
      <p className="flex items-center gap-2 font-semibold text-rvp-text"><Smartphone className="h-5 w-5 text-rvp-accent" aria-hidden /> Dans l’application Rivendy</p>
      <p className="mt-2 text-[14.5px] leading-6 text-rvp-soft">
        Pour {action} : ouvrez <strong className="text-rvp-text">Play</strong>, touchez <strong className="text-rvp-text">Créer</strong>, puis <strong className="text-rvp-text">Espace artiste</strong>.
      </p>
      <div className="mt-4 flex flex-col gap-2.5">
        <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" className={cn(btnSecondary, "h-11")}>
          <Download className="h-4 w-4" aria-hidden /> L’application sur Google Play
        </a>
      </div>
      <p className="mt-3 text-[12.5px] text-rvp-muted">La publication de vidéos se fait depuis l’application, qui prépare et envoie le fichier.</p>
    </aside>
  );
}

/** Les clips de l'artiste, tous statuts (fonction `play_my_clips`, comme l'app). */
function MyClips() {
  const [round, setRound] = useState(0);
  const [data, setData] = useState<{ round: number; clips: MyClip[] | null } | null>(null);
  useEffect(() => {
    let alive = true;
    void fetchMyClips()
      .then((c) => { if (alive) setData({ round, clips: c }); })
      .catch(() => { if (alive) setData({ round, clips: null }); });
    return () => { alive = false; };
  }, [round]);
  const current = data && data.round === round ? data : null;

  return (
    <section aria-labelledby="mes-clips">
      <h2 id="mes-clips" className={cn(display, "mb-3 text-[21px] font-bold text-rvp-text")}>Mes clips</h2>
      {!current ? <Spinner /> : current.clips === null ? (
        <ErrorState text="Impossible de charger vos clips. Vérifiez votre connexion." onRetry={() => setRound((n) => n + 1)} />
      ) : current.clips.length === 0 ? (
        <p className="rounded-rvp-panel border border-rvp-edge bg-rvp-surface p-5 text-[14.5px] text-rvp-soft">Aucun clip pour le moment. Publiez le premier depuis l’application.</p>
      ) : (
        <ul className="divide-y divide-rvp-line overflow-hidden rounded-rvp-panel border border-rvp-edge bg-rvp-surface">
          {current.clips.map((c) => {
            const label = myClipStatusLabel(c);
            const online = label === "En ligne";
            const thumb = c.thumbnail_url?.startsWith("https://") ? playImage(c.thumbnail_url, 320) ?? c.thumbnail_url : null;
            const body = (
              <>
                <span className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-rvp-sm bg-rvp-raised sm:w-36">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {thumb ? <img src={thumb} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" /> : null}
                  {clockLabel(c.duration_seconds) ? <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 text-[11px] text-white">{clockLabel(c.duration_seconds)}</span> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 font-semibold text-rvp-text">{c.title}</span>
                  <span className={cn("mt-1 inline-block rounded-md px-1.5 py-0.5 text-[11.5px] font-bold", online ? "bg-rvp-accent/15 text-rvp-accent" : "bg-white/[0.06] text-rvp-soft")}>{label}</span>
                  {c.review_status === "rejected" && c.review_reason ? <span className="mt-1 block text-[12.5px] text-amber-300">Motif : {c.review_reason}</span> : null}
                  <span className="mt-1.5 flex flex-wrap gap-x-3 text-[12.5px] text-rvp-muted">
                    <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" aria-hidden /> {compactCount(c.views)}<span className="sr-only"> vues</span></span>
                    <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" aria-hidden /> {compactCount(c.likes)}<span className="sr-only"> J’aime</span></span>
                    <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" aria-hidden /> {compactCount(c.comments_count)}<span className="sr-only"> commentaires</span></span>
                  </span>
                </span>
              </>
            );
            return (
              <li key={c.id}>
                {online ? (
                  <Link href={clipPath(c.id)} className="flex gap-3 p-3 hover:bg-white/[0.03]">{body}</Link>
                ) : <div className="flex gap-3 p-3">{body}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
