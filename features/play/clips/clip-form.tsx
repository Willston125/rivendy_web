"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Lock, MicVocal, Upload } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useDialogs } from "@/features/ui/dialogs";
import { cn } from "@/lib/utils/cn";
import { deleteVideo, readVideoDuration } from "@/lib/video/video-service";
import {
  fetchArtistGenre, fetchClipSettings, fetchMyTracks, linkClipTrack, requestVideoTicket, sendClip, updateClip, UploadError,
  type TrackOption,
} from "../create/create-api";
import { CLIP, clipFileProblem, clipFormProblem, clock, DONE_MESSAGE, megabytes } from "../create/create-logic";
import { CLIP_SPACE_PATH } from "../create/create-paths";
import { VideoDrop, VideoPreview } from "../create/create-ui";
import { startVideoUpload, videoUploadBusy } from "../create/video-uploads";
import { btnPrimary, btnSecondary, display } from "../play-theme";
import { EmptyState, ErrorState, Spinner, useLoginHref } from "../play-ui";
import { fetchMyClips, type MyClip } from "./clips-api";
import { ClipsPage } from "./clips-shell";
import { useClips } from "./clips-store";

/**
 * Envoyer un clip, ou modifier le texte d'un de ses clips (lot 3,
 * 2026-11-11, canevas validé) — artist_clip_form_screen.dart. Envoi : une
 * vidéo de 10 min et 200 Mo au plus, envoyée entière (pas de coupe), titre,
 * genre, description, titre Musique relié (facultatif). L'adresse d'envoi est
 * demandée AVANT (artiste validé, quota du mois : la réponse s'affiche ici),
 * puis le fichier part en arrière-plan : un bandeau le suit sur tout le site.
 * Modification : le texte seulement — la vidéo ne se remplace pas.
 */
export function ClipFormView({ clipId }: { clipId: string }) {
  const editing = clipId !== "nouveau";
  const router = useRouter();
  const dialogs = useDialogs();
  const loginHref = useLoginHref();
  const { user, loading } = useAuth();
  const { artist } = useClips();
  const userId = user?.id ?? null;
  const status = artist.status;
  const artistId = artist.profile?.id ?? null;

  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("");
  const [trackId, setTrackId] = useState<string | null>(null);
  const [trackTouched, setTrackTouched] = useState(false);
  const [tracks, setTracks] = useState<TrackOption[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState<{ clip: MyClip | null; failed: boolean } | null>(null);
  const [round, setRound] = useState(0);

  // Titres de l'artiste (pour relier le clip) et genre du profil, proposé pour un nouveau clip.
  useEffect(() => {
    if (!artistId || status !== "approved") return;
    let alive = true;
    fetchMyTracks(artistId).then((t) => { if (alive) setTracks(t); }, () => { if (alive) setTracks([]); });
    if (!editing) fetchArtistGenre(artistId).then((g) => { if (alive && g) setGenre((cur) => cur || g); }, () => undefined);
    return () => { alive = false; };
  }, [artistId, status, editing]);

  // Modification : le clip (texte) et le titre qui lui est relié.
  useEffect(() => {
    if (!editing || !userId) return;
    let alive = true;
    Promise.all([fetchMyClips(), fetchClipSettings(clipId)]).then(([clips, settings]) => {
      if (!alive) return;
      const clip = clips.find((c) => c.id === clipId) ?? null;
      setLoaded({ clip, failed: false });
      if (clip) {
        setTitle(clip.title);
        setDescription(clip.description);
        setGenre(clip.genre);
        setTrackId(settings.trackId);
      }
    }, () => { if (alive) setLoaded({ clip: null, failed: true }); });
    return () => { alive = false; };
  }, [editing, userId, clipId, round]);

  // L'aperçu local est libéré quand la vidéo change ou que la page se ferme.
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  async function pick(f: File) {
    setProblem(null);
    setChecking(true);
    try {
      const d = await readVideoDuration(f).catch(() => Number.NaN);
      const p = clipFileProblem(d, f.size);
      if (p) {
        setProblem(p);
        return;
      }
      setFile(f);
      setDuration(d);
      setPreviewUrl(URL.createObjectURL(f));
    } finally {
      setChecking(false);
    }
  }

  function unpick() {
    setFile(null);
    setPreviewUrl(null);
    setProblem(null);
  }

  async function submit() {
    const p = clipFormProblem({ editing, hasVideo: !!file, title, description, genre });
    setProblem(p);
    if (p) return;
    setSaving(true);
    try {
      if (editing) {
        await updateClip(clipId, { title, description, genre });
        if (trackTouched) await linkClipTrack(clipId, trackId);
        dialogs.notify("Clip modifié.", "success");
        router.push(CLIP_SPACE_PATH);
        return;
      }
      const f = file;
      if (!f) return;
      if (videoUploadBusy()) throw new UploadError("Un envoi est déjà en cours : attendez qu’il se termine.");
      // 1. Adresse d'envoi : artiste validé et quota du mois, vérifiés tout de suite.
      const ticket = await requestVideoTicket("clip", f);
      const fields = { title, description, genre, trackId };
      // 2. Le fichier part en arrière-plan ; « Renvoyer » redemande une adresse.
      const started = startVideoUpload({
        kind: "clip",
        label: `Envoi du clip « ${title.trim()} »`,
        success: DONE_MESSAGE.clip,
        doneHref: CLIP_SPACE_PATH,
        doneLabel: "Mes clips",
        task: async (ctx, attempt) => sendClip(attempt === 0 ? ticket : await requestVideoTicket("clip", f), f, fields, ctx),
      });
      if (!started) {
        void deleteVideo(ticket.cfUid).catch(() => false);
        throw new UploadError("Un envoi est déjà en cours : attendez qu’il se termine.");
      }
      dialogs.notify("Envoi en cours : vous pouvez continuer à naviguer sur Rivendy.", "success");
      router.push(CLIP_SPACE_PATH);
    } catch (e) {
      setProblem(e instanceof UploadError ? e.message : "Envoi impossible, réessayez.");
    } finally {
      setSaving(false);
    }
  }

  const heading = (
    <header className="pb-5 pt-2 md:pt-1">
      <Link href={CLIP_SPACE_PATH} prefetch={false} className="inline-flex min-h-11 items-center gap-1.5 text-[14px] font-semibold text-rvp-soft hover:text-rvp-text">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Espace artiste
      </Link>
      <h1 className={cn(display, "text-[28px] leading-tight text-rvp-text sm:text-[34px]")}>{editing ? "Modifier le clip" : "Envoyer un clip"}</h1>
      <p className="mt-1.5 max-w-2xl text-[15px] text-rvp-soft">
        {editing ? "Le texte seulement : la vidéo ne se remplace pas." : "Gratuit pour tous, sur le site et dans l’application, une fois vérifié par Rivendy."}
      </p>
    </header>
  );

  if (loading || (user && status === null)) return <ClipsPage>{heading}<Spinner /></ClipsPage>;
  if (!user) {
    return (
      <ClipsPage>
        {heading}
        <EmptyState icon={Lock} title="Connectez-vous à votre compte Rivendy" text="Le même compte que dans l’application : votre profil d’artiste et vos clips.">
          <Link href={loginHref} prefetch={false} className={btnPrimary}>Se connecter</Link>
        </EmptyState>
      </ClipsPage>
    );
  }
  if (status === "none") {
    return (
      <ClipsPage>
        {heading}
        <EmptyState icon={MicVocal} title="Devenez artiste d’abord"
          text="Demandez votre compte artiste : Rivendy le vérifie (nom, droits sur votre musique), puis vous publiez vos clips.">
          <Link href="/music/artiste#demande" prefetch={false} className={btnPrimary}>Devenir artiste</Link>
        </EmptyState>
      </ClipsPage>
    );
  }
  if (status !== "approved") {
    return (
      <ClipsPage>
        {heading}
        <EmptyState icon={MicVocal}
          title={status === "suspended" ? "Votre compte artiste est suspendu" : "Compte artiste à valider"}
          text={status === "suspended" ? "Contactez Rivendy depuis l’Aide pour en savoir plus." : "Votre compte artiste doit être validé par Rivendy avant d’envoyer un clip."}>
          <Link href={CLIP_SPACE_PATH} prefetch={false} className={btnPrimary}>Mon espace artiste</Link>
        </EmptyState>
      </ClipsPage>
    );
  }
  if (editing && !loaded) return <ClipsPage>{heading}<Spinner /></ClipsPage>;
  if (editing && loaded?.failed) {
    return <ClipsPage>{heading}<ErrorState text="Impossible de charger ce clip. Vérifiez votre connexion." onRetry={() => { setLoaded(null); setRound((n) => n + 1); }} /></ClipsPage>;
  }
  if (editing && (!loaded?.clip || loaded.clip.review_status === "rejected")) {
    return (
      <ClipsPage>
        {heading}
        <EmptyState icon={MicVocal} title={loaded?.clip ? "Ce clip a été refusé" : "Ce clip n’existe plus"}
          text={loaded?.clip ? "Un clip refusé ne se modifie pas : supprimez-le et envoyez-en un nouveau." : "Il a peut-être été supprimé."}>
          <Link href={CLIP_SPACE_PATH} prefetch={false} className={btnPrimary}>Mes clips</Link>
        </EmptyState>
      </ClipsPage>
    );
  }

  const field = "w-full rounded-xl border border-rvp-edge bg-rvp-raised px-3.5 text-[16px] text-rvp-text placeholder:text-rvp-muted focus:border-rvp-accent focus:outline-none focus:ring-2 focus:ring-rvp-accent/25";
  const label = "text-[13px] font-bold text-rvp-soft";
  const busy = saving || checking;

  return (
    <ClipsPage>
      {heading}
      <div className={cn("grid gap-7", !editing && "lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]")}>
        {!editing ? (
          <div className="flex min-w-0 flex-col gap-4">
            {file && previewUrl ? (
              <VideoPreview url={previewUrl} shape="wide" name={file.name} durationLabel={clock(duration)} sizeLabel={megabytes(file.size)} onChange={unpick} />
            ) : (
              <VideoDrop shape="wide" busy={checking} onFile={pick}
                title="Choisir la vidéo du clip"
                hint={`${CLIP.maxSeconds / 60} minutes et 200 Mo au plus · MP4 ou MOV · format horizontal conseillé`}
                note="Sur ordinateur, vous pouvez aussi glisser le fichier ici. Le clip est envoyé entier, sans coupe." />
            )}
            <section className="hidden rounded-rvp-panel border border-rvp-edge bg-rvp-surface p-5 lg:block">
              <h2 className="text-[15px] font-bold text-rvp-text">Ce qui se passe ensuite</h2>
              <ol className="mt-3 space-y-2.5 text-[14px] leading-6 text-rvp-soft">
                <li><strong className="text-rvp-text">1. Envoi</strong> directement chez Cloudflare, par morceaux : gardez l’onglet ouvert ; une coupure reprend où elle s’était arrêtée.</li>
                <li><strong className="text-rvp-text">2. Encodage</strong> de la vidéo, quelques minutes.</li>
                <li><strong className="text-rvp-text">3. Vérification</strong> par Rivendy (droits, contenu).</li>
                <li><strong className="text-rvp-text">4. En ligne</strong> dans Rivendy Clips, gratuit pour tous.</li>
              </ol>
            </section>
          </div>
        ) : null}

        <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="flex min-w-0 max-w-2xl flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={label}>Titre du clip</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={CLIP.titleMax} autoComplete="off"
              placeholder="Le titre tel qu’il apparaîtra" className={cn(field, "h-12")} />
            <span className="self-end text-[12px] text-rvp-muted">{title.trim().length} / {CLIP.titleMax}</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={label}>Genre musical</span>
            <input value={genre} onChange={(e) => setGenre(e.target.value)} maxLength={CLIP.genreMax} autoComplete="off" className={cn(field, "h-12")} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={label}>Description (paroles, featuring, réalisation…)</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={CLIP.descriptionMax} rows={5}
              className={cn(field, "resize-y py-3 leading-relaxed")} />
            <span className="flex gap-3 text-[12px] text-rvp-muted">
              <span className="flex-1">Sans numéro, WhatsApp ni lien : tout contact passe par Rivendy.</span>
              <span>{description.trim().length} / {CLIP.descriptionMax}</span>
            </span>
          </label>
          {tracks && tracks.length > 0 ? (
            <label className="flex flex-col gap-1.5">
              <span className={label}>Titre sur Rivendy Musique (facultatif)</span>
              <select value={trackId ?? ""} onChange={(e) => { setTrackId(e.target.value || null); setTrackTouched(true); }} className={cn(field, "h-12")}>
                <option value="">Aucun</option>
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>{`${t.title} — ${t.release}${t.online ? "" : " (pas encore en ligne)"}`}</option>
                ))}
              </select>
              <span className="text-[12px] text-rvp-muted">Sous le clip : « Écouter le titre » ; sur la sortie : « Voir le clip ».</span>
            </label>
          ) : null}
          {!editing ? (
            <p className="text-[13px] leading-relaxed text-rvp-soft">
              En envoyant ce clip, vous confirmez détenir les droits sur la musique et les images. Rivendy le vérifie avant de le publier, gratuitement, dans tous les pays.
            </p>
          ) : null}
          {problem ? <p role="alert" className="rounded-xl bg-red-500/12 px-3.5 py-2.5 text-[14px] leading-snug text-red-200">{problem}</p> : null}
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className={cn(btnPrimary, "h-12")}>
              {editing ? <Check className="h-5 w-5" aria-hidden /> : <Upload className="h-5 w-5" aria-hidden />}
              {saving ? "Un instant…" : editing ? "Enregistrer" : "Envoyer le clip"}
            </button>
            <Link href={CLIP_SPACE_PATH} prefetch={false} className={cn(btnSecondary, "h-12")}>Annuler</Link>
          </div>
          {!editing ? <p className="text-[12.5px] text-rvp-muted">{CLIP.perMonth} clips par mois, {CLIP.maxSeconds / 60} min chacun au plus.</p> : null}
        </form>
      </div>
    </ClipsPage>
  );
}
