"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import {
  AlertTriangle, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronUp, Circle, Clock, Globe2, ImagePlus, Loader2,
  MoreVertical, Plus, Upload, WifiOff,
} from "lucide-react";
import { DialogShell } from "@/components/ui/dialog-shell";
import { useAuth } from "@/features/auth/auth-provider";
import { artistStatusOf } from "@/features/play/clips/clips-logic";
import { useDialogs } from "@/features/ui/dialogs";
import { cropToAspect } from "@/services/image-upload";
import { cn } from "@/lib/utils/cn";
import { fetchGenres, type MusicGenre } from "../music-api";
import { releaseKindLabel, releaseState, type ReleaseState } from "../music-logic";
import { loginHref } from "../music-pending";
import { EmptyState, ListSkeleton, primaryButton, secondaryButton } from "../music-ui";
import {
  deleteRelease, deleteTrack, fetchMyArtist, fetchOrigins, fetchStudioRelease, reorderTracks, saveRelease, saveTrack,
  StudioError, submitRelease, uploadCover, withdrawRelease, type MyArtist, type StudioRelease, type StudioTrack,
} from "./studio-api";
import {
  fileProblem, isEditable, isoDay, megabytesLabel, originGroups, STUDIO, STUDIO_KINDS, submitChecklist, submitProblem,
  titleFromFile, trackHasFile, trackStatusLabel, tracksFor, type Origin,
} from "./studio-logic";
import { ARTIST_SPACE, releaseEditPath, STUDIO_PATH } from "./studio-paths";
import { ReleaseStateChip } from "./studio-releases";
import { enqueueUploads, forgetUploads, onUploadSettled, retryUpload, useStudioUploads, type UploadItem } from "./upload-manager";

const field = "w-full rounded-2xl border border-rvm-line bg-rvm-field px-3.5 text-base text-rvm-text outline-none transition placeholder:text-rvm-muted focus:border-rvm-ink-accent focus:bg-rvm-surface disabled:bg-rvm-raised disabled:text-rvm-soft";
const label = "text-[13px] font-bold text-rvm-soft";
const card = "rounded-[22px] border border-rvm-line bg-rvm-surface p-4 @2xl:p-5";
const AUDIO_ACCEPT = ".mp3,.m4a,.wav,.flac,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,audio/flac";

type Picked = { blob: Blob; url: string };

function errorText(e: unknown): string {
  return e instanceof StudioError ? e.message : "Une erreur est survenue, réessayez.";
}

/**
 * Éditeur de sortie du studio (lot 2, 2026-11-11, canevas validé) : l'écran
 * de l'app (musique_release_editor_screen.dart) — type, pochette carrée,
 * titre, featuring, présentation, genre, origine, date, contenu explicite ;
 * titres (fichiers MP3, M4A, WAV ou FLAC envoyés tels quels au stockage et
 * préparés par Rivendy) ; attestation des droits ; envoi à Rivendy. En
 * vérification ou en ligne, la sortie se lit sans se modifier. En plus de
 * l'app : la liste « Avant l'envoi » montre d'un coup tout ce qui manque.
 */
export function ReleaseEditor({ releaseId }: { releaseId: string }) {
  const isNew = releaseId === "nouvelle";
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const dialogs = useDialogs();
  const ids = useId();

  const [artist, setArtist] = useState<MyArtist | null>(null);
  const [genres, setGenres] = useState<MusicGenre[]>([]);
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [release, setRelease] = useState<StudioRelease | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "failed" | "missing">("loading");

  const [kind, setKind] = useState<string>("single");
  const [title, setTitle] = useState("");
  const [featuring, setFeaturing] = useState("");
  const [description, setDescription] = useState("");
  const [genreId, setGenreId] = useState("");
  const [islandId, setIslandId] = useState("");
  const [date, setDate] = useState("");
  const [explicit, setExplicit] = useState(false);
  const [cover, setCover] = useState<Picked | null>(null);
  const [attested, setAttested] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [editTrack, setEditTrack] = useState<StudioTrack | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Date de sortie : jusqu'à un an d'avance, comme l'app.
  const [maxDate] = useState(() => {
    const d = new Date();
    return isoDay(new Date(d.getFullYear() + 1, d.getMonth(), d.getDate()));
  });
  const coverInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const replaceFor = useRef<StudioTrack | null>(null);

  const allUploads = useStudioUploads();
  const uploads = useMemo(() => {
    const map = new Map<string, UploadItem>();
    for (const u of allUploads) if (u.releaseId === release?.id) map.set(u.trackId, u);
    return map;
  }, [allUploads, release?.id]);
  const sending = [...uploads.values()].some((u) => u.status === "queued" || u.status === "uploading");

  // Chargement : compte artiste, genres, origines et la sortie (sauf nouvelle).
  useEffect(() => {
    if (!user) return;
    let alive = true;
    setPhase("loading");
    Promise.all([
      fetchMyArtist(user.id),
      fetchGenres().catch(() => [] as MusicGenre[]),
      fetchOrigins().catch(() => [] as Origin[]),
      isNew ? Promise.resolve(null) : fetchStudioRelease(releaseId),
    ]).then(([a, g, o, r]) => {
      if (!alive) return;
      setArtist(a);
      setGenres(g);
      setOrigins(o);
      if (r) {
        setRelease(r);
        setKind(r.kind);
        setTitle(r.title);
        setFeaturing(r.featuring ?? "");
        setDescription(r.description ?? "");
        setGenreId(r.genre_id ?? "");
        setIslandId(r.island_id ?? "");
        setDate(r.release_date ?? "");
        setExplicit(r.explicit);
      } else if (isNew) {
        // Nouvelle sortie : l'origine de l'artiste par défaut (modifiable), comme l'app.
        setIslandId(a?.island_id ?? "");
      }
      setPhase(!isNew && !r ? "missing" : "ready");
    }, () => { if (alive) setPhase("failed"); });
    return () => { alive = false; };
  }, [user, releaseId, isNew, attempt]);

  // Un envoi terminé : on relit la sortie (état du fichier vu par le serveur).
  const releaseKey = release?.id ?? null;
  useEffect(() => {
    if (!releaseKey) return;
    return onUploadSettled((item) => {
      if (item.releaseId !== releaseKey) return;
      if (item.status === "done") dialogs.notify("Titre envoyé : Rivendy le préparera à la vérification.", "success");
      fetchStudioRelease(releaseKey).then((fresh) => {
        if (fresh) setRelease(fresh);
        if (item.status === "done") forgetUploads([item.trackId]);
      }, () => { /* la ligne garde l'état de l'envoi ; « Réessayer » relira */ });
    });
  }, [releaseKey, dialogs]);

  useEffect(() => () => { if (cover) URL.revokeObjectURL(cover.url); }, [cover]);

  async function reload(): Promise<StudioRelease | null> {
    const id = release?.id;
    if (!id) return null;
    try {
      const fresh = await fetchStudioRelease(id);
      if (fresh) setRelease(fresh);
      return fresh;
    } catch {
      dialogs.notify("La sortie n’a pas pu être rechargée. Vérifiez votre connexion.", "error");
      return null;
    }
  }

  const state: ReleaseState = release ? releaseState(release.status, release.review_status) : "draft";
  const editable = !release || isEditable(state);
  const tracks = release?.music_tracks ?? [];
  const limit = tracksFor(release?.kind ?? kind);

  // ── Informations ──────────────────────────────────────────────────────────

  async function pickCover(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const blob = await cropToAspect(file, 1);
      setCover({ blob, url: URL.createObjectURL(blob) });
    } catch {
      dialogs.notify("Cette image ne peut pas être lue. Choisissez une image JPEG ou PNG.", "error");
    }
  }

  async function saveInfo(quiet = false): Promise<StudioRelease | null> {
    if (!artist) return null;
    const t = title.trim();
    if (t.length < 1 || t.length > STUDIO.titleMax) {
      setProblem(`Le titre doit faire de 1 à ${STUDIO.titleMax} caractères.`);
      return null;
    }
    setSaving(true);
    setProblem(null);
    try {
      const coverUrl = cover ? await uploadCover(artist.id, cover.blob) : release?.cover_url ?? null;
      const id = await saveRelease({
        id: release?.id ?? null, kind, title: t, featuring, description, coverUrl,
        genreId: genreId || null, islandId: islandId || null, releaseDate: date ? new Date(`${date}T12:00:00`) : null, explicit,
      });
      if (!release) {
        dialogs.notify("Sortie créée : ajoutez maintenant vos titres.", "success");
        router.replace(releaseEditPath(id));
        return null;
      }
      const fresh = await fetchStudioRelease(id);
      setCover(null);
      if (fresh) setRelease(fresh);
      if (!quiet) dialogs.notify("Sortie enregistrée.", "success");
      return fresh;
    } catch (e) {
      setProblem(errorText(e));
      return null;
    } finally {
      setSaving(false);
    }
  }

  // ── Titres ────────────────────────────────────────────────────────────────

  async function addTracks(files: File[]) {
    let r = release;
    if (!r || files.length === 0) return;
    // Le nombre de titres permis dépend du type : un type changé s'enregistre d'abord.
    if (kind !== r.kind) {
      r = await saveInfo(true);
      if (!r) return;
    }
    const room = tracksFor(r.kind) - r.music_tracks.length;
    if (room <= 0) {
      dialogs.notify(`Un ${releaseKindLabel(r.kind).toLowerCase()} contient ${tracksFor(r.kind)} titres au plus.`, "error");
      return;
    }
    for (const f of files) {
      const p = fileProblem(f.name, f.size);
      if (p) { dialogs.notify(p, "error"); return; }
    }
    if (files.length > room) dialogs.notify(`Il reste de la place pour ${room} titre${room > 1 ? "s" : ""} : les premiers seulement sont ajoutés.`);
    const chosen = files.slice(0, room);
    setSaving(true);
    const queue: Array<{ trackId: string; releaseId: string; file: File }> = [];
    try {
      for (const f of chosen) {
        const trackId = await saveTrack({ id: null, releaseId: r.id, title: titleFromFile(f.name), featuring: "", explicit: false, allowShorts: true });
        queue.push({ trackId, releaseId: r.id, file: f });
      }
    } catch (e) {
      dialogs.notify(errorText(e), "error");
    } finally {
      setSaving(false);
    }
    if (queue.length === 0) return;
    await reload();
    enqueueUploads(queue);
    dialogs.notify(queue.length === 1 ? "Envoi du titre en cours." : `Envoi de ${queue.length} titres en cours.`);
  }

  function onAudioPicked(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const target = replaceFor.current;
    replaceFor.current = null;
    if (target) {
      const f = files[0];
      if (!f || !release) return;
      const p = fileProblem(f.name, f.size);
      if (p) { dialogs.notify(p, "error"); return; }
      enqueueUploads([{ trackId: target.id, releaseId: release.id, file: f }]);
      return;
    }
    void addTracks(files);
  }

  function chooseFiles(target: StudioTrack | null) {
    replaceFor.current = target;
    if (audioInput.current) audioInput.current.multiple = target === null;
    audioInput.current?.click();
  }

  function onDrop(e: DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    setDragOver(false);
    if (!editable) return;
    void addTracks(Array.from(e.dataTransfer.files ?? []));
  }

  async function move(index: number, delta: -1 | 1) {
    if (!release) return;
    const list = [...release.music_tracks];
    const to = index + delta;
    if (to < 0 || to >= list.length) return;
    const [moved] = list.splice(index, 1);
    list.splice(to, 0, moved);
    setRelease({ ...release, music_tracks: list });
    const ok = await reorderTracks(release.id, list.map((t) => t.id));
    if (!ok) dialogs.notify("L’ordre n’a pas pu être enregistré.", "error");
    await reload();
  }

  async function removeTrack(t: StudioTrack) {
    const ok = await dialogs.confirm({
      title: `Retirer « ${t.title} » ?`, message: "Le titre et son fichier sont retirés de la sortie.", confirmLabel: "Retirer", danger: true,
    });
    if (!ok) return;
    if (await deleteTrack(t.id)) {
      forgetUploads([t.id]);
      await reload();
    } else {
      dialogs.notify("Le titre n’a pas pu être retiré.", "error");
    }
  }

  async function saveTrackDetails(t: StudioTrack, v: { title: string; featuring: string; explicit: boolean; allowShorts: boolean }) {
    if (!release) return false;
    try {
      await saveTrack({ id: t.id, releaseId: release.id, ...v });
      await reload();
      return true;
    } catch (e) {
      dialogs.notify(errorText(e), "error");
      return false;
    }
  }

  // ── Envoi, retrait, suppression ───────────────────────────────────────────

  const checks = {
    hasCover: !!(cover || release?.cover_url),
    hasGenre: !!genreId,
    tracks: tracks.map((t) => ({ hasFile: trackHasFile(t.audio_status) })),
    attested,
  };
  const checklist = submitChecklist(checks);
  const blocker = submitProblem({ state, ...checks });

  async function submit() {
    const fresh = await saveInfo(true);
    if (!fresh) return;
    const p = submitProblem({
      state: releaseState(fresh.status, fresh.review_status),
      hasCover: !!fresh.cover_url,
      hasGenre: !!fresh.genre_id,
      tracks: fresh.music_tracks.map((t) => ({ hasFile: trackHasFile(t.audio_status) })),
      attested,
    });
    if (p) { setProblem(p); return; }
    setSaving(true);
    try {
      await submitRelease(fresh.id);
      await reload();
      setAttested(false);
      dialogs.notify("Envoyée à Rivendy : vous serez prévenu dès qu’elle est vérifiée.", "success");
    } catch (e) {
      setProblem(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  async function withdraw() {
    if (!release) return;
    const published = state === "published";
    const ok = await dialogs.confirm({
      title: published ? "Retirer de Rivendy Musique ?" : "Retirer de la vérification ?",
      message: published
        ? "La sortie n’est plus écoutable. Pour la remettre en ligne, il faudra contacter Rivendy."
        : "La sortie redevient un brouillon modifiable ; renvoyez-la quand elle est prête.",
      confirmLabel: "Retirer",
      danger: published,
      focusCancel: !published,
    });
    if (!ok) return;
    try {
      await withdrawRelease(release.id);
      await reload();
    } catch (e) {
      dialogs.notify(errorText(e), "error");
    }
  }

  async function removeDraft() {
    if (!release) return;
    const ok = await dialogs.confirm({ title: "Supprimer ce brouillon ?", message: "La sortie et ses titres sont supprimés.", confirmLabel: "Supprimer", danger: true });
    if (!ok) return;
    if (await deleteRelease(release.id)) {
      forgetUploads(release.music_tracks.map((t) => t.id));
      router.push(STUDIO_PATH);
    } else {
      dialogs.notify("Ce brouillon ne peut pas être supprimé.", "error");
    }
  }

  // ── Écran ─────────────────────────────────────────────────────────────────

  if (authLoading || (user && phase === "loading")) return <div className="px-4 pt-8 @2xl:px-8"><ListSkeleton rows={6} /></div>;
  if (!user) {
    return (
      <div className="px-4 pt-8 @2xl:px-8">
        <EmptyState title="Connectez-vous à votre compte Rivendy" text="Le même compte sert sur le site et dans l’application."
          action={<Link href={loginHref(isNew ? "/music/studio/nouvelle" : releaseEditPath(releaseId))} prefetch={false} className={primaryButton}>Se connecter</Link>} />
      </div>
    );
  }
  if (phase === "failed") {
    return (
      <div className="px-4 pt-8 @2xl:px-8">
        <EmptyState title="La sortie n’a pas pu être chargée." text="Vérifiez votre connexion, puis réessayez."
          action={<button type="button" onClick={() => setAttempt((n) => n + 1)} className={secondaryButton}>Réessayer</button>} />
      </div>
    );
  }
  if (artistStatusOf(artist?.status) !== "approved" || artist?.music_enabled === false) {
    return (
      <div className="px-4 pt-8 @2xl:px-8">
        <EmptyState title="La publication est réservée aux artistes vérifiés par Rivendy."
          action={<Link href={ARTIST_SPACE} className={primaryButton}>Mon espace artiste</Link>} />
      </div>
    );
  }
  if (phase === "missing") {
    return (
      <div className="px-4 pt-8 @2xl:px-8">
        <EmptyState title="Cette sortie n’existe plus." action={<Link href={STUDIO_PATH} className={primaryButton}>Mes sorties</Link>} />
      </div>
    );
  }

  const coverSrc = cover?.url ?? release?.cover_url ?? null;
  const genreName = genres.find((g) => g.id === genreId)?.name;

  return (
    <div className="px-4 pb-12 pt-5 @2xl:px-8">
      <nav aria-label="Fil d’Ariane" className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-bold text-rvm-muted">
        <Link href={ARTIST_SPACE} className="text-rvm-ink-accent hover:underline">Espace artiste</Link>
        <span aria-hidden>›</span>
        <Link href={STUDIO_PATH} className="inline-flex items-center gap-1 text-rvm-ink-accent hover:underline">
          <ChevronLeft className="h-4 w-4 @2xl:hidden" aria-hidden /> Mes sorties
        </Link>
      </nav>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="min-w-0 font-rvm-display text-[26px] font-black leading-tight tracking-tight @2xl:text-4xl">
          {release ? release.title || "Sans titre" : "Nouvelle sortie"}
        </h1>
        {release ? <ReleaseStateChip state={state} className="h-7 text-[12.5px]" /> : null}
        {release && editable && !release.published_at ? (
          <button type="button" onClick={() => void removeDraft()} className="ml-auto h-10 rounded-full px-3 text-sm font-bold text-red-700 hover:bg-red-50">
            Supprimer ce brouillon
          </button>
        ) : null}
      </div>

      {release ? <StateBanner state={state} reason={release.review_reason} /> : null}

      <div className="mt-5 grid items-start gap-5 @4xl:grid-cols-[340px_minmax(0,1fr)]">
        {/* ── Pochette et informations ── */}
        <section aria-label="Informations de la sortie" className={cn(card, "flex flex-col gap-4")}>
          <div className="relative mx-auto w-full max-w-[300px]">
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-rvm-raised">
              {coverSrc ? (
                <Image src={coverSrc} alt="Pochette de la sortie" fill sizes="300px" className="object-cover" />
              ) : (
                <button type="button" disabled={!editable} onClick={() => coverInput.current?.click()}
                  className="flex h-full w-full flex-col items-center justify-center gap-2 text-rvm-soft">
                  <ImagePlus className="h-9 w-9 text-rvm-ink-accent" aria-hidden />
                  <span className="text-sm font-semibold">Pochette carrée</span>
                </button>
              )}
            </div>
            {editable && coverSrc ? (
              <button type="button" onClick={() => coverInput.current?.click()}
                className="absolute bottom-2.5 right-2.5 flex h-10 items-center gap-1.5 rounded-full bg-white/95 px-3.5 text-[13px] font-bold text-rvm-text shadow">
                <ImagePlus className="h-4 w-4" aria-hidden /> Changer la pochette
              </button>
            ) : null}
            <input ref={coverInput} type="file" accept="image/*" className="hidden" onChange={(e) => void pickCover(e)} />
          </div>

          <fieldset disabled={!editable} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className={label}>Type</span>
              <div role="radiogroup" aria-label="Type de sortie" className="grid grid-cols-3 gap-1.5">
                {STUDIO_KINDS.map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
                    className={cn("h-10 rounded-full text-sm font-bold transition",
                      kind === k ? "bg-rvm-text text-white" : "border border-rvm-line bg-rvm-surface text-rvm-text hover:border-rvm-ink-accent")}>
                    {releaseKindLabel(k)} · {tracksFor(k)}
                  </button>
                ))}
              </div>
              <span className="text-[12.5px] text-rvm-muted">Nombre de titres au plus.</span>
            </div>
            <Field id={`${ids}-title`} label="Titre de la sortie">
              <input id={`${ids}-title`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={STUDIO.titleMax}
                autoComplete="off" className={cn(field, "h-12")} />
            </Field>
            <Field id={`${ids}-feat`} label="Featuring (facultatif)">
              <input id={`${ids}-feat`} value={featuring} onChange={(e) => setFeaturing(e.target.value)} maxLength={STUDIO.featuringMax}
                autoComplete="off" placeholder="Artistes invités" className={cn(field, "h-12")} />
            </Field>
            <Field id={`${ids}-desc`} label="Présentation (facultatif)">
              <textarea id={`${ids}-desc`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={STUDIO.descriptionMax}
                rows={3} placeholder="Quelques mots sur cette sortie." className={cn(field, "min-h-[88px] resize-y py-3 leading-relaxed")} />
            </Field>
            <Field id={`${ids}-genre`} label="Genre">
              <select id={`${ids}-genre`} value={genreId} onChange={(e) => setGenreId(e.target.value)} className={cn(field, "h-12 appearance-auto pr-2")}>
                <option value="">{genreName ? genreName : "Choisir un genre"}</option>
                {genres.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </Field>
            <Field id={`${ids}-origin`} label={<span className="inline-flex items-center gap-1.5"><Globe2 className="h-4 w-4 text-rvm-ink-accent" aria-hidden /> Origine (facultatif)</span>}>
              <select id={`${ids}-origin`} value={islandId} onChange={(e) => setIslandId(e.target.value)} className={cn(field, "h-12 appearance-auto pr-2")}>
                <option value="">Aucune</option>
                {originGroups(origins).map((g) => (
                  <optgroup key={g.country.id} label={g.country.name}>
                    <option value={g.country.id}>{g.country.name}{g.children.length ? " (tout le pays)" : ""}</option>
                    {g.children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </Field>
            <Field id={`${ids}-date`} label={<span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-rvm-ink-accent" aria-hidden /> Date de sortie</span>}
              hint={date ? undefined : "Dès la validation, si vous ne choisissez pas de date."}>
              <input id={`${ids}-date`} type="date" value={date} min="1950-01-01" max={maxDate} onChange={(e) => setDate(e.target.value)} className={cn(field, "h-12")} />
            </Field>
            <label className="flex min-h-12 cursor-pointer items-center gap-3">
              <span className="flex-1 text-[15px] font-semibold">Contenu explicite</span>
              <input type="checkbox" role="switch" checked={explicit} onChange={(e) => setExplicit(e.target.checked)}
                className="h-6 w-6 shrink-0 cursor-pointer accent-[#0B7A6E]" />
            </label>
          </fieldset>
          {editable ? (
            <button type="button" disabled={saving} onClick={() => void saveInfo()}
              className={cn(release ? secondaryButton : primaryButton, "h-12 w-full", release && "border-rvm-ink-accent text-rvm-ink-accent")}>
              {saving && !release ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
              {release ? "Enregistrer les informations" : "Créer la sortie"}
            </button>
          ) : null}
          {!release && problem ? <p role="alert" className="text-sm font-semibold text-red-700">{problem}</p> : null}
        </section>

        {/* ── Titres, puis envoi ── */}
        {release ? (
          <div className="flex min-w-0 flex-col gap-5">
            <section aria-labelledby={`${ids}-tracks`} className={cn(card, "flex flex-col gap-3")}>
              <div className="flex flex-wrap items-center gap-2">
                <h2 id={`${ids}-tracks`} className="min-w-0 flex-1 font-rvm-display text-[22px] font-black">Titres ({tracks.length} / {limit})</h2>
                {editable ? (
                  <button type="button" onClick={() => chooseFiles(null)} disabled={saving || tracks.length >= limit}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full bg-rvm-raised px-4 text-sm font-extrabold text-rvm-text transition hover:bg-rvm-raised-hover disabled:opacity-40">
                    <Plus className="h-[18px] w-[18px]" strokeWidth={2.6} aria-hidden /> Ajouter des titres
                  </button>
                ) : null}
              </div>
              <p className="text-[13px] leading-snug text-rvm-soft">MP3, M4A, WAV ou FLAC, 200 Mo au plus. Rivendy égalise le volume et prépare l’extrait de 30 s.</p>
              {sending ? (
                <p role="status" className="flex gap-2.5 rounded-2xl bg-rvm-text px-3.5 py-3 text-[13.5px] leading-snug text-white">
                  <Upload className="mt-px h-[18px] w-[18px] shrink-0 text-rvm-accent" aria-hidden />
                  Envoi en cours : gardez cet onglet ouvert et l’écran allumé jusqu’à la fin. Vous pouvez continuer à naviguer sur Rivendy.
                </p>
              ) : null}

              {tracks.length === 0 ? (
                <p className="py-3 text-[15px] text-rvm-soft">Aucun titre : ajoutez vos fichiers.</p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {tracks.map((t, i) => (
                    <TrackRow key={t.id} track={t} index={i} count={tracks.length} upload={uploads.get(t.id) ?? null} editable={editable}
                      onMove={(d) => void move(i, d)} onEdit={() => setEditTrack(t)} onFile={() => chooseFiles(t)}
                      onRemove={() => void removeTrack(t)} />
                  ))}
                </ol>
              )}

              {editable && tracks.length < limit ? (
                <button type="button" onClick={() => chooseFiles(null)} disabled={saving}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}
                  className={cn("flex flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-5 text-center transition @2xl:flex-row @2xl:justify-center @2xl:gap-3.5 @2xl:text-left",
                    dragOver ? "border-rvm-ink-accent bg-rvm-accent/10" : "border-rvm-line bg-rvm-ground hover:border-rvm-ink-accent/60")}>
                  <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-rvm-raised text-rvm-ink-accent"><Upload className="h-5 w-5" /></span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-extrabold">Ajouter des fichiers audio</span>
                    <span className="text-[12.5px] leading-snug text-rvm-soft">
                      <span className="@2xl:hidden">Sur iPhone, vos morceaux sont souvent dans l’app Fichiers : iCloud Drive, Téléchargements, WhatsApp.</span>
                      <span className="hidden @2xl:inline">Glissez-les ici ou cliquez pour les choisir · le titre est proposé d’après le nom du fichier.</span>
                    </span>
                  </span>
                </button>
              ) : null}
              <input ref={audioInput} type="file" accept={AUDIO_ACCEPT} className="hidden" onChange={onAudioPicked} />
            </section>

            {editable ? (
              <section aria-labelledby={`${ids}-send`} className={cn(card, "flex flex-col gap-3.5")}>
                <h2 id={`${ids}-send`} className="font-rvm-display text-[20px] font-black">Avant l’envoi</h2>
                <ul className="grid gap-2 text-sm @2xl:grid-cols-2">
                  {checklist.map((c) => (
                    <li key={c.key} className={cn("flex items-center gap-2.5", c.ok ? "text-rvm-text" : c.key === "attest" ? "text-rvm-soft" : "font-semibold text-amber-800")}>
                      {c.ok ? <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-green-700" aria-hidden />
                        : c.key === "attest" ? <Circle className="h-[18px] w-[18px] shrink-0" aria-hidden />
                        : <Clock className="h-[18px] w-[18px] shrink-0" aria-hidden />}
                      <span>{c.label}<span className="sr-only">{c.ok ? " : fait" : " : à faire"}</span></span>
                    </li>
                  ))}
                </ul>
                <label className="flex cursor-pointer items-start gap-3 border-t border-rvm-line pt-3.5">
                  <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)}
                    className="mt-0.5 h-6 w-6 shrink-0 cursor-pointer accent-[#0B7A6E]" />
                  <span className="text-sm leading-relaxed">
                    Je détiens tous les droits sur ces titres (paroles, musique, enregistrement) et j’autorise Rivendy à les diffuser.
                  </span>
                </label>
                <button type="button" onClick={() => void submit()} disabled={saving || blocker !== null || sending}
                  className={cn(primaryButton, "h-[52px] w-full text-[15px] @2xl:w-auto @2xl:self-start @2xl:px-10")}>
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null} Envoyer à Rivendy
                </button>
                {problem ? <p role="alert" className="text-sm font-semibold text-red-700">{problem}</p>
                  : blocker ? <p className="text-[13px] text-rvm-soft">{blocker}</p> : null}
                <p className="text-[12.5px] leading-snug text-rvm-muted">Rivendy vérifie chaque sortie avant la mise en ligne. Vous serez prévenu par une notification.</p>
              </section>
            ) : state === "pending" || state === "published" ? (
              <button type="button" onClick={() => void withdraw()} className={cn(secondaryButton, "h-12 self-start border-rvm-ink-accent text-rvm-ink-accent")}>
                {state === "pending" ? "Retirer de la vérification" : "Retirer de Rivendy Musique"}
              </button>
            ) : null}
          </div>
        ) : (
          <section className={cn(card, "flex flex-col gap-2 text-[15px] leading-relaxed text-rvm-soft")}>
            <h2 className="font-rvm-display text-[20px] font-black text-rvm-text">Ensuite : vos titres</h2>
            <p>Créez la sortie avec ses informations, puis ajoutez vos fichiers audio (MP3, M4A, WAV ou FLAC, 200 Mo au plus).</p>
            <p>Un single compte 3 titres au plus, un EP 8, un album 30.</p>
          </section>
        )}
      </div>

      {editTrack ? (
        <TrackDialog track={editTrack} onClose={() => setEditTrack(null)}
          onSave={async (v) => { if (await saveTrackDetails(editTrack, v)) setEditTrack(null); }} />
      ) : null}
    </div>
  );
}

function Field({ id, label: text, hint, children }: { id: string; label: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={label}>{text}</label>
      {children}
      {hint ? <span className="text-[12.5px] text-rvm-muted">{hint}</span> : null}
    </div>
  );
}

/** Bandeau d'état, mêmes textes que l'app (notification au lieu de « dans l'app »). */
function StateBanner({ state, reason }: { state: ReleaseState; reason: string | null }) {
  const content: Partial<Record<ReleaseState, { text: string; tone: string }>> = {
    pending: { text: "Rivendy vérifie votre sortie : elle n’est plus modifiable. Vous serez prévenu par une notification.", tone: "border-rvm-ink-accent/40 bg-rvm-ink-accent/10" },
    rejected: { text: `Refusée${reason ? ` : ${reason}` : ""}. Corrigez puis renvoyez-la.`, tone: "border-red-700/35 bg-red-700/[0.07]" },
    approved: { text: "Validée par Rivendy : la sortie sera mise en ligne prochainement. Elle n’est plus modifiable.", tone: "border-green-700/35 bg-green-700/[0.08]" },
    published: { text: "En ligne sur Rivendy Musique.", tone: "border-green-700/35 bg-green-700/[0.08]" },
    archived: { text: "Retirée : elle n’est plus écoutable.", tone: "border-rvm-line bg-rvm-raised" },
  };
  const c = content[state];
  if (!c) return null;
  return <p className={cn("mt-3 max-w-3xl rounded-xl border p-3 text-sm leading-relaxed text-rvm-text", c.tone)}>{c.text}</p>;
}

function TrackRow({ track: t, index, count, upload, editable, onMove, onEdit, onFile, onRemove }: {
  track: StudioTrack; index: number; count: number; upload: UploadItem | null; editable: boolean;
  onMove: (delta: -1 | 1) => void; onEdit: () => void; onFile: () => void; onRemove: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const missing = !trackHasFile(t.audio_status);
  const extras = [t.featuring ? `feat. ${t.featuring}` : "", t.explicit ? "Explicite" : "", t.allow_shorts === false ? "Shorts fermés" : ""].filter(Boolean);

  let status: ReactNode;
  if (upload?.status === "uploading" || upload?.status === "queued") {
    const pct = Math.round(upload.progress * 100);
    status = (
      <span className="flex flex-col gap-1.5">
        <span className="text-[13px] text-rvm-soft">
          {upload.status === "queued" ? "En attente d’envoi…" : `Envoi en cours… ${pct} % · ${megabytesLabel(upload.file.size)}`}
        </span>
        <span role="progressbar" aria-label={`Envoi de « ${t.title} »`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
          className="block h-1.5 overflow-hidden rounded-full bg-rvm-raised">
          <span className="block h-full rounded-full bg-rvm-ink-accent transition-[width]" style={{ width: `${pct}%` }} />
        </span>
      </span>
    );
  } else if (upload?.status === "failed") {
    status = (
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] font-semibold text-red-700">
        <span className="inline-flex items-center gap-1.5">
          {upload.networkCut ? <WifiOff className="h-4 w-4" aria-hidden /> : <AlertTriangle className="h-4 w-4" aria-hidden />} {upload.error}
        </span>
        <button type="button" onClick={() => retryUpload(t.id)}
          className="h-9 rounded-full border border-rvm-ink-accent px-3.5 text-[13px] font-extrabold text-rvm-ink-accent hover:bg-rvm-ink-accent/10">
          Renvoyer
        </button>
      </span>
    );
  } else {
    const ok = !missing || upload?.status === "done";
    status = (
      <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-semibold", ok ? "text-green-700" : "text-red-700")}>
        {ok ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <AlertTriangle className="h-4 w-4" aria-hidden />}
        {upload?.status === "done" && missing ? "Fichier reçu" : trackStatusLabel(t.audio_status)}
      </span>
    );
  }

  return (
    <li className="flex items-center gap-2 rounded-2xl border border-rvm-line bg-rvm-ground py-2.5 pl-2 pr-1.5 @2xl:pl-3">
      {editable ? (
        <span className="flex shrink-0 flex-col">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Monter « ${t.title} »`}
            className="grid h-7 w-8 place-items-center rounded-lg text-rvm-soft hover:bg-rvm-raised disabled:opacity-25"><ChevronUp className="h-5 w-5" aria-hidden /></button>
          <button type="button" onClick={() => onMove(1)} disabled={index === count - 1} aria-label={`Descendre « ${t.title} »`}
            className="grid h-7 w-8 place-items-center rounded-lg text-rvm-soft hover:bg-rvm-raised disabled:opacity-25"><ChevronDown className="h-5 w-5" aria-hidden /></button>
        </span>
      ) : null}
      <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-rvm-soft">{index + 1}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[15px] font-bold">{t.title}</span>
        {extras.length ? <span className="truncate text-[12.5px] text-rvm-muted">{extras.join(" · ")}</span> : null}
        {status}
      </span>
      {editable ? (
        <span className="relative shrink-0">
          <button type="button" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-label={`Actions pour « ${t.title} »`}
            className="grid h-11 w-11 place-items-center rounded-full text-rvm-soft hover:bg-rvm-raised"><MoreVertical className="h-5 w-5" aria-hidden /></button>
          {menu ? (
            <>
              <button type="button" aria-label="Fermer le menu" tabIndex={-1} onClick={() => setMenu(false)} className="fixed inset-0 z-40 cursor-default" />
              <span role="menu" className="absolute right-0 top-full z-50 mt-1 flex w-56 flex-col rounded-2xl border border-rvm-line bg-rvm-surface p-1.5 shadow-xl">
                <MenuItem onClick={() => { setMenu(false); onEdit(); }}>Modifier</MenuItem>
                <MenuItem onClick={() => { setMenu(false); onFile(); }}>{missing ? "Envoyer le fichier" : "Remplacer le fichier"}</MenuItem>
                <MenuItem danger onClick={() => { setMenu(false); onRemove(); }}>Retirer</MenuItem>
              </span>
            </>
          ) : null}
        </span>
      ) : null}
    </li>
  );
}

function MenuItem({ onClick, danger = false, children }: { onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button type="button" role="menuitem" onClick={onClick}
      className={cn("flex h-11 items-center rounded-xl px-3 text-left text-sm font-semibold hover:bg-rvm-raised", danger ? "text-red-700" : "text-rvm-text")}>
      {children}
    </button>
  );
}

/** « Titre » : la fenêtre de l'app — titre, featuring, contenu explicite, ouvert aux Shorts. */
function TrackDialog({ track, onClose, onSave }: {
  track: StudioTrack; onClose: () => void;
  onSave: (v: { title: string; featuring: string; explicit: boolean; allowShorts: boolean }) => Promise<void>;
}) {
  const ids = useId();
  const [title, setTitle] = useState(track.title);
  const [featuring, setFeaturing] = useState(track.featuring ?? "");
  const [explicit, setExplicit] = useState(track.explicit);
  const [shorts, setShorts] = useState(track.allow_shorts !== false);
  const [busy, setBusy] = useState(false);
  const bad = title.trim().length < 1 || title.trim().length > STUDIO.titleMax;
  return (
    <DialogShell onClose={onClose} labelledBy={`${ids}-t`} layerClassName="z-[75]"
      panelClassName="rvm-scope w-full max-w-md rounded-t-3xl border border-rvm-line bg-rvm-surface p-5 text-rvm-text shadow-2xl sm:rounded-3xl">
      <form onSubmit={async (e) => { e.preventDefault(); if (bad) return; setBusy(true); await onSave({ title, featuring, explicit, allowShorts: shorts }); setBusy(false); }}
        className="flex flex-col gap-4">
        <h2 id={`${ids}-t`} className="font-rvm-display text-[22px] font-black">Titre</h2>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-title`} className={label}>Titre</label>
          <input id={`${ids}-title`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={STUDIO.titleMax} className={cn(field, "h-12")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-feat`} className={label}>Featuring (facultatif)</label>
          <input id={`${ids}-feat`} value={featuring} onChange={(e) => setFeaturing(e.target.value)} maxLength={STUDIO.featuringMax} className={cn(field, "h-12")} />
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <span className="flex-1 text-[15px] font-semibold">Contenu explicite</span>
          <input type="checkbox" role="switch" checked={explicit} onChange={(e) => setExplicit(e.target.checked)} className="h-6 w-6 accent-[#0B7A6E]" />
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <span className="flex flex-1 flex-col">
            <span className="text-[15px] font-semibold">Ouvert aux Shorts</span>
            <span className="text-[12.5px] text-rvm-muted">Les créateurs peuvent l’utiliser comme son.</span>
          </span>
          <input type="checkbox" role="switch" checked={shorts} onChange={(e) => setShorts(e.target.checked)} className="h-6 w-6 accent-[#0B7A6E]" />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-11 rounded-full px-4 text-sm font-bold text-rvm-text hover:bg-rvm-raised">Annuler</button>
          <button type="submit" disabled={busy || bad} className={primaryButton}>Enregistrer</button>
        </div>
      </form>
    </DialogShell>
  );
}
