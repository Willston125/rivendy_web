"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckCircle2, Clock, ExternalLink, Eye, EyeOff, Heart, LifeBuoy, Lock, MessageCircle, MicVocal, Pencil, ShieldAlert, Trash2,
  Upload, UserRound,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useDialogs } from "@/features/ui/dialogs";
import { cn } from "@/lib/utils/cn";
import { deleteClip, fetchClipSettings, setClipActive, setCommentsMode, UploadError } from "../create/create-api";
import { CLIP, commentsModeLabel, type CommentsMode, type StatusTone } from "../create/create-logic";
import { CLIP_NEW_PATH, clipEditPath } from "../create/create-paths";
import { CommentsModeSheet, RowMenu, StatusChip, type RowAction } from "../create/create-ui";
import { VideoUploadCard } from "../create/video-upload-banner";
import { onVideoUploadSettled, useVideoUpload } from "../create/video-uploads";
import { playImage } from "../play-logic";
import { btnPrimary, btnSecondary, display } from "../play-theme";
import { EmptyState, ErrorState, Spinner } from "../play-ui";
import { fetchMyClips, type MyClip } from "./clips-api";
import { clipPath, clockLabel, compactCount, myClipStatusLabel } from "./clips-logic";
import { ClipsPage } from "./clips-shell";
import { useClips } from "./clips-store";

/**
 * Espace artiste de Rivendy Clips. La demande de compte artiste et le profil
 * se font sur le site depuis le 2026-11-11 (/music/artiste, le même compte
 * pour la Musique et les Clips) ; l'envoi et la gestion des clips aussi
 * depuis le lot 3 (canevas validé, artist_space_screen.dart) : « Envoyer un
 * clip », puis pour chaque clip Voir, Modifier, Désactiver / Activer, Qui
 * peut commenter, Supprimer — mêmes cas que l'app.
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
          Publiez vos clips gratuitement sur Rivendy Play. Chaque clip est vérifié par Rivendy avant d’être en ligne.
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
            {status === "approved" || status === "suspended" ? <MyClips manage={status === "approved"} /> : null}
          </div>
          <SideCard status={status} />
        </div>
      )}
    </ClipsPage>
  );
}

const card = "rounded-rvp-panel border border-rvp-edge bg-rvp-surface p-5";

function StatusCard({ status, name, reason, artistId }: { status: string; name: string | null; reason: string | null; artistId: string | null }) {
  if (status === "approved") {
    return (
      <section className={card}>
        <p className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-rvp-accent"><CheckCircle2 className="h-4 w-4" aria-hidden /> Compte artiste validé</p>
        <p className={cn(display, "mt-2 text-[22px] text-rvp-text")}>{name}</p>
        <p className="mt-1 text-[14.5px] text-rvp-soft">Vos clips publiés sont gratuits pour tous, sur le site et dans l’application.</p>
        <div className="mt-4 flex flex-col gap-3">
          <SendClipAction />
          <div className="flex flex-wrap gap-2.5">
            <Link href="/music/artiste#profil" prefetch={false} className={cn(btnSecondary, "h-11")}>
              <UserRound className="h-4 w-4" aria-hidden /> Mon profil
            </Link>
            {artistId ? (
              <Link href={`/artist/${artistId}`} prefetch={false} className={cn(btnSecondary, "h-11")}>
                <ExternalLink className="h-4 w-4" aria-hidden /> Ma page publique
              </Link>
            ) : null}
          </div>
          <p className="text-[12.5px] leading-5 text-rvp-muted">
            {CLIP.perMonth} clips par mois, {CLIP.maxSeconds / 60} min chacun au plus · chaque clip est vérifié par Rivendy avant publication.
          </p>
        </div>
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
          {status === "rejected" ? "Corrigez votre profil sur le site (Mon espace artiste), puis renvoyez-le à la vérification." : "Contactez Rivendy depuis l’Aide pour en savoir plus."}
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

/** « Envoyer un clip », ou l'envoi d'un clip en cours (le bandeau flottant s'efface alors). */
function SendClipAction() {
  const upload = useVideoUpload();
  const sendingClip = upload?.kind === "clip" && (upload.phase === "uploading" || upload.phase === "retrying");
  return (
    <>
      <VideoUploadCard kind="clip" />
      {!sendingClip ? (
        <Link href={CLIP_NEW_PATH} prefetch={false} className={cn(btnPrimary, "h-12 self-start")}>
          <Upload className="h-5 w-5" aria-hidden /> Envoyer un clip
        </Link>
      ) : null}
    </>
  );
}

/**
 * Colonne de droite : la demande de compte artiste se fait sur le site
 * (/music/artiste) ; pour un artiste validé, ce qui suit un envoi ; pour un
 * compte suspendu, où demander de l'aide.
 */
function SideCard({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <aside className="h-fit rounded-rvp-panel border border-rvp-edge bg-rvp-surface p-5">
        <p className="font-semibold text-rvp-text">Ce qui se passe après l’envoi</p>
        <ol className="mt-3 space-y-2.5 text-[14px] leading-6 text-rvp-soft">
          <li><strong className="text-rvp-text">1. Envoi</strong> directement chez Cloudflare, par morceaux : une coupure reprend où elle s’était arrêtée.</li>
          <li><strong className="text-rvp-text">2. Encodage</strong> de la vidéo, quelques minutes.</li>
          <li><strong className="text-rvp-text">3. Vérification</strong> par Rivendy (droits, contenu).</li>
          <li><strong className="text-rvp-text">4. En ligne</strong> dans Rivendy Clips, gratuit pour tous.</li>
        </ol>
      </aside>
    );
  }
  if (status === "suspended") {
    return (
      <aside className="h-fit rounded-rvp-panel border border-rvp-edge-strong bg-rvp-accent/[0.07] p-5">
        <p className="flex items-center gap-2 font-semibold text-rvp-text"><LifeBuoy className="h-5 w-5 text-rvp-accent" aria-hidden /> Besoin d’aide ?</p>
        <p className="mt-2 text-[14.5px] leading-6 text-rvp-soft">Vos clips ne peuvent plus être modifiés ni envoyés. Vous pouvez toujours les supprimer.</p>
        <Link href="/help" prefetch={false} className={cn(btnSecondary, "mt-4 h-11 w-full")}>Contacter Rivendy</Link>
      </aside>
    );
  }
  return (
    <aside className="h-fit rounded-rvp-panel border border-rvp-edge-strong bg-rvp-accent/[0.07] p-5">
      <p className="flex items-center gap-2 font-semibold text-rvp-text"><MicVocal className="h-5 w-5 text-rvp-accent" aria-hidden /> Votre compte artiste</p>
      <p className="mt-2 text-[14.5px] leading-6 text-rvp-soft">
        {status === "none" ? "Demandez votre compte artiste sur le site, sans l’application." : "Suivez et modifiez votre demande sur le site."}{" "}
        Le même compte sert pour Rivendy Musique et Rivendy Clips.
      </p>
      <Link href="/music/artiste" prefetch={false} className={cn(btnPrimary, "mt-4 h-11 w-full")}>
        {status === "none" ? "Devenir artiste" : "Mon espace artiste"}
      </Link>
    </aside>
  );
}

function toneOf(label: string): StatusTone {
  if (label === "En ligne") return "online";
  if (label === "Refusé" || label === "Vidéo en erreur") return "rejected";
  if (label === "Désactivé") return "neutral";
  return "pending";
}

/** Les clips de l'artiste (tous statuts), par la même fonction que l'app (`play_my_clips`). */
function MyClips({ manage }: { manage: boolean }) {
  const dialogs = useDialogs();
  const [round, setRound] = useState(0);
  const [data, setData] = useState<{ round: number; clips: MyClip[] | null } | null>(null);
  const [comments, setComments] = useState<{ id: string; mode: CommentsMode } | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchMyClips()
      .then((c) => { if (alive) setData({ round, clips: c }); })
      .catch(() => { if (alive) setData({ round, clips: null }); });
    return () => { alive = false; };
  }, [round]);

  // Un clip vient d'être envoyé : la liste se relit.
  useEffect(() => onVideoUploadSettled((u) => { if (u.kind === "clip" && u.phase === "done") setRound((n) => n + 1); }), []);

  const reload = () => setRound((n) => n + 1);
  const current = data && data.round === round ? data : null;

  async function toggle(c: MyClip, activate: boolean) {
    try {
      await setClipActive(c.id, activate);
      dialogs.notify(activate ? "Clip de nouveau en ligne." : "Clip désactivé : il n’est plus visible.", "success");
      reload();
    } catch (e) {
      dialogs.notify(e instanceof UploadError ? e.message : "Action impossible pour le moment.", "error");
    }
  }

  async function remove(c: MyClip) {
    const ok = await dialogs.confirm({
      title: "Supprimer ce clip ?",
      message: `« ${c.title} » et sa vidéo seront supprimés définitivement, avec ses J’aime et ses commentaires.`,
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    const deleted = await deleteClip(c.id).catch(() => false);
    dialogs.notify(deleted ? "Clip supprimé." : "Suppression impossible pour le moment.", deleted ? "success" : "error");
    if (deleted) reload();
  }

  async function openComments(c: MyClip) {
    // Réglage lu sur le clip publié ; avant publication, celui du compte s'appliquera.
    const s = await fetchClipSettings(c.id);
    setComments({ id: c.id, mode: s.commentsMode });
  }

  async function pickComments(mode: CommentsMode) {
    const target = comments;
    setComments(null);
    if (!target || mode === target.mode) return;
    const saved = await setCommentsMode("title", target.id, mode);
    dialogs.notify(saved ? `Commentaires : ${commentsModeLabel(mode).toLowerCase()}.` : "Réglage impossible pour le moment.", saved ? "success" : "error");
  }

  return (
    <section aria-labelledby="mes-clips">
      <h2 id="mes-clips" className={cn(display, "mb-3 text-[21px] font-bold text-rvp-text")}>
        Mes clips{current?.clips ? ` (${current.clips.length})` : ""}
      </h2>
      {!current ? <Spinner /> : current.clips === null ? (
        <ErrorState text="Impossible de charger vos clips. Vérifiez votre connexion." onRetry={reload} />
      ) : current.clips.length === 0 ? (
        <p className="rounded-rvp-panel border border-rvp-edge bg-rvp-surface p-5 text-[14.5px] text-rvp-soft">
          {manage ? "Aucun clip pour le moment. Touchez « Envoyer un clip » pour publier le premier." : "Aucun clip pour le moment."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {current.clips.map((c) => {
            const label = myClipStatusLabel(c);
            const online = label === "En ligne";
            const live = c.review_status === "approved" && c.status === "published";
            const thumb = c.thumbnail_url?.startsWith("https://") ? playImage(c.thumbnail_url, 320) ?? c.thumbnail_url : null;
            const actions: RowAction[] = [
              ...(online ? [{ label: "Voir", icon: Eye, href: clipPath(c.id) }] : []),
              ...(manage && c.review_status !== "rejected" ? [{ label: "Modifier", icon: Pencil, href: clipEditPath(c.id) }] : []),
              ...(manage && c.review_status === "approved"
                ? [{ label: live ? "Désactiver" : "Activer", icon: live ? EyeOff : Eye, onSelect: () => void toggle(c, !live) }] : []),
              { label: "Qui peut commenter", icon: MessageCircle, onSelect: () => void openComments(c) },
              { label: "Supprimer", icon: Trash2, danger: true, onSelect: () => void remove(c) },
            ];
            const media = (
              <span className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-rvp-sm bg-rvp-raised sm:w-36">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {thumb ? <img src={thumb} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" /> : null}
                {clockLabel(c.duration_seconds) ? <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 text-[11px] text-white">{clockLabel(c.duration_seconds)}</span> : null}
              </span>
            );
            return (
              <li key={c.id} className="flex items-start gap-3 rounded-rvp-panel border border-rvp-edge bg-rvp-surface p-3">
                {online ? <Link href={clipPath(c.id)} aria-label={`Voir « ${c.title} »`} className="shrink-0">{media}</Link> : media}
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 font-semibold text-rvp-text">{c.title}</span>
                  <span className="mt-1 block"><StatusChip tone={toneOf(label)}>{label}</StatusChip></span>
                  {c.review_status === "rejected" && c.review_reason ? <span className="mt-1 block text-[12.5px] text-red-200">Motif : {c.review_reason}</span> : null}
                  {c.review_status === "approved" ? (
                    <span className="mt-1.5 flex flex-wrap gap-x-3 text-[12.5px] text-rvp-muted">
                      <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" aria-hidden /> {compactCount(c.views)}<span className="sr-only"> vues</span></span>
                      <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" aria-hidden /> {compactCount(c.likes)}<span className="sr-only"> J’aime</span></span>
                      <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" aria-hidden /> {compactCount(c.comments_count)}<span className="sr-only"> commentaires</span></span>
                    </span>
                  ) : null}
                </span>
                <RowMenu label={`Options du clip « ${c.title} »`} actions={actions} />
              </li>
            );
          })}
        </ul>
      )}
      {comments ? <CommentsModeSheet current={comments.mode} onPick={(m) => void pickComments(m)} onClose={() => setComments(null)} /> : null}
    </section>
  );
}
