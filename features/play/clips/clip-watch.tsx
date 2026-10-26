"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck, Flag, Heart, Loader2, LogIn, Music, RotateCcw, Share2, SkipForward, X } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { deviceId } from "@/features/media/device-id";
import { useDialogs } from "@/features/ui/dialogs";
import { cn } from "@/lib/utils/cn";
import { fetchPlayback } from "../play-api";
import { inTerritory, playImage, playbackErrorMessage, publicManifest, type PlayTitle } from "../play-logic";
import { usePlayList } from "../play-list";
import { btnPrimary, btnSecondary, display, motion } from "../play-theme";
import { EmptyState } from "../play-ui";
import { VideoPlayer, type FatalReason } from "../player/video-player";
import { ClipComments } from "./clip-comments";
import { useClipViewTracking } from "./clip-tracking";
import { ArtistAvatar, ClipRow, VerifiedMark, clipArt, shareClip } from "./clips-cards";
import {
  CLIP_REPORT_REASONS, fetchClip, fetchClipArtists, fetchClipCounts, fetchFollowers, fetchLiked, reportClip, setLiked,
  type Clip,
} from "./clips-api";
import { FollowButton } from "./clips-follow";
import {
  NO_COUNTS, clipArtistName, clipMeta, clipPath, clipSuggestions, followersLabel, parsePendingClipAction,
  suggestionReasonLabel, type ClipArtist, type ClipCounts,
} from "./clips-logic";
import { ClipsPage } from "./clips-shell";
import { useClips, useClipsCatalog } from "./clips-store";

/**
 * Écran de visionnage d'un clip (refonte Clips du 2026-10-26) — `/play/clip/{id}`,
 * la même adresse pour une carte, une suggestion ou un lien partagé : le
 * lecteur s'affiche tout de suite et la lecture part dès que la vidéo est
 * prête, sans fiche intermédiaire. Clip d'artiste : vidéo publique, regardable
 * sans compte (comme dans l'app). Clip de Rivendy : vidéo signée, le serveur
 * vérifie compte et pays (play-playback-token). Si le navigateur refuse la
 * lecture automatique, la commande « Lancer la lecture » est DANS le lecteur.
 */

const LIKE_KEY = "rivendy_clips_pending_like_v1";
const AUTO_KEY = "rivendy_clips_autonext";
const AUTO_DELAY = 5;

type Source =
  | { kind: "loading" }
  | { kind: "ready"; url: string; sessionId: string | null }
  | { kind: "login" }
  | { kind: "error"; code: string };

function readAuto(): boolean {
  try { return localStorage.getItem(AUTO_KEY) === "1"; } catch { return false; }
}

export function ClipWatchView({ initial }: { initial: Clip }) {
  const router = useRouter();
  const pathname = usePathname() || clipPath(initial.id);
  const { user, loading: authLoading } = useAuth();
  const { notify } = useDialogs();
  const { catalog, market } = useClipsCatalog();
  const { patchCounts, rememberArtist } = useClips();
  const list = usePlayList();
  const [clip, setClip] = useState<Clip>(initial);
  const [gone, setGone] = useState(false);
  const [now] = useState(() => new Date());
  const ready = catalog.status === "ready" ? catalog : null;

  // Le clip relu côté navigateur (réglage des commentaires, retrait depuis le rendu de la page).
  useEffect(() => {
    let alive = true;
    void fetchClip(initial.id).then((c) => {
      if (!alive) return;
      if (c) setClip(c); else setGone(true);
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [initial.id]);

  // ── Artiste, compteurs ───────────────────────────────────────────────────
  const [ownArtist, setOwnArtist] = useState<ClipArtist | null>(null);
  const artist = (clip.artist_id && ready?.artists[clip.artist_id]) || ownArtist;
  useEffect(() => {
    if (!clip.artist_id || ready?.artists[clip.artist_id]) return;
    let alive = true;
    void fetchClipArtists([clip.artist_id]).then((m) => {
      const a = m[clip.artist_id ?? ""];
      if (alive && a) { setOwnArtist(a); rememberArtist(a); }
    });
    return () => { alive = false; };
  }, [clip.artist_id, ready, rememberArtist]);
  const name = clipArtistName(clip, artist ? { [artist.id]: artist } : {});

  const [ownCounts, setOwnCounts] = useState<ClipCounts | null>(null);
  const inCatalog = !!ready?.clips.some((c) => c.id === clip.id);
  const counts = (inCatalog ? ready?.counts[clip.id] : null) ?? ownCounts ?? NO_COUNTS;
  useEffect(() => {
    if (inCatalog) return;
    let alive = true;
    void fetchClipCounts([clip.id]).then((m) => { if (alive) setOwnCounts(m[clip.id] ?? NO_COUNTS); });
    return () => { alive = false; };
  }, [clip.id, inCatalog]);
  const setCounts = (patch: Partial<ClipCounts>) => {
    if (inCatalog) patchCounts(clip.id, patch);
    else setOwnCounts((c) => ({ ...(c ?? NO_COUNTS), ...patch }));
  };

  const [followers, setFollowers] = useState<number | null>(null);
  useEffect(() => {
    if (!artist?.user_id) return;
    let alive = true;
    void fetchFollowers(artist.user_id).then((n) => { if (alive) setFollowers(n); });
    return () => { alive = false; };
  }, [artist?.user_id]);

  // ── J'aime (même table que l'app) ────────────────────────────────────────
  const [liked, setLikedState] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void (async () => {
      let pending = null;
      try { pending = parsePendingClipAction(sessionStorage.getItem(LIKE_KEY), Date.now()); } catch { /* stockage fermé */ }
      const v = await fetchLiked(initial.id);
      if (!alive) return;
      setLikedState(v);
      // J'aime demandé avant la connexion : fait au retour, sur CE clip seulement.
      if (pending?.kind === "like" && pending.id === initial.id) {
        try { sessionStorage.removeItem(LIKE_KEY); } catch { /* rien */ }
        if (!v && (await setLiked(initial.id, true)) && alive) { setLikedState(true); notify("Vous aimez ce clip.", "success"); }
      }
    })();
    return () => { alive = false; };
  }, [userId, initial.id, notify]);

  const toggleLike = async () => {
    if (!userId) {
      if (authLoading) return;
      try { sessionStorage.setItem(LIKE_KEY, JSON.stringify({ kind: "like", id: clip.id, at: Date.now() })); } catch { /* refait après connexion */ }
      notify("Connectez-vous pour aimer ce clip : vous revenez ensuite ici.", "info");
      router.push(`/auth/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (likeBusy) return;
    const on = !liked;
    setLikeBusy(true);
    setLikedState(on);
    setCounts({ likes: Math.max(0, counts.likes + (on ? 1 : -1)) });
    const ok = await setLiked(clip.id, on);
    setLikeBusy(false);
    if (!ok) {
      setLikedState(!on);
      setCounts({ likes: counts.likes });
      notify("Action impossible pour le moment.", "error");
    }
  };

  // ── Source de la vidéo ───────────────────────────────────────────────────
  const [source, setSource] = useState<Source>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const refreshes = useRef(0);
  const artistClip = !!clip.artist_id;
  const publicUid = clip.public_video_uid ?? null;
  const allowed = artistClip || !market || inTerritory(clip.play_title_countries, market);
  const videoReady = clip.video_status === "ready";

  useEffect(() => {
    if (!videoReady) { setSource({ kind: "error", code: "video_not_ready" }); return; }
    if (!allowed) { setSource({ kind: "error", code: "not_in_territory" }); return; }
    // Clip d'artiste : vidéo publique, aucun jeton, aucun compte demandé.
    if (publicUid) { setSource({ kind: "ready", url: publicManifest(publicUid), sessionId: null }); return; }
    if (authLoading) { setSource({ kind: "loading" }); return; }
    if (!userId) { setSource({ kind: "login" }); return; }
    let alive = true;
    setSource({ kind: "loading" });
    void fetchPlayback(clip.id, null, deviceId()).then((res) => {
      if (!alive) return;
      setSource(res.ok ? { kind: "ready", url: res.grant.hls_url, sessionId: res.grant.playback_session_id } : { kind: "error", code: res.error });
    });
    return () => { alive = false; };
  }, [clip.id, publicUid, videoReady, allowed, authLoading, userId, attempt]);

  const onFatal = useCallback((reason: FatalReason) => {
    // Jeton échu (clip de Rivendy) : une nouvelle demande, deux fois au plus.
    if (reason === "auth" && !publicUid && refreshes.current < 2) { refreshes.current += 1; setAttempt((n) => n + 1); return; }
    setSource({ kind: "error", code: reason === "network" ? "network" : "media" });
  }, [publicUid]);
  const retry = () => { refreshes.current = 0; setAttempt((n) => n + 1); };

  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onVideo = useCallback((v: HTMLVideoElement | null) => { videoRef.current = v; setVideo(v); }, []);
  const replay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    void v.play().catch(() => undefined);
  }, []);
  useClipViewTracking(video, clip.id, source.kind === "ready" ? source.sessionId : null);

  // ── À suivre ─────────────────────────────────────────────────────────────
  const suggestions = useMemo(() => (ready ? clipSuggestions(clip, ready.clips, 12) : []), [ready, clip]);
  const next = suggestions[0]?.clip ?? null;
  const [autoNext, setAutoNext] = useState(false);
  useEffect(() => { setAutoNext(readAuto()); }, []);
  const changeAuto = (on: boolean) => {
    setAutoNext(on);
    try { localStorage.setItem(AUTO_KEY, on ? "1" : "0"); } catch { /* réglage pour cette visite seulement */ }
  };

  const [reporting, setReporting] = useState(false);
  const saved = list.has(clip.id);
  const art = clipArt(clip);
  const poster = art.src ? playImage(art.src, 1080) ?? art.src : null;
  const meta = clipMeta(counts.views, clip.published_at, now);

  if (gone) {
    return (
      <ClipsPage>
        <EmptyState icon={Music} title="Ce clip n’est plus disponible" text="Il a peut-être été retiré par l’artiste ou par Rivendy.">
          <Link href="/play/clips" className={btnPrimary}>Voir les autres clips</Link>
        </EmptyState>
      </ClipsPage>
    );
  }

  return (
    <ClipsPage className="max-w-[1720px] max-sm:pt-0">
      <div className="grid gap-x-8 gap-y-6 @min-[64rem]:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
        <div className="min-w-0">
          <div className="max-sm:-mx-4 max-sm:[&>div]:rounded-none">
            {source.kind === "ready" ? (
              <VideoPlayer
                key={`${clip.id}:${attempt}:${source.url}`}
                src={source.url}
                poster={poster}
                title={`${clip.title} — ${name}`}
                overlays
                speedControl={false}
                onVideo={onVideo}
                onFatal={onFatal}
                onEnded={() => undefined}
                endOverlay={<EndCard next={next} auto={autoNext} onReplay={replay} />}
              />
            ) : (
              <PlayerFrame poster={poster}>
                {source.kind === "loading" ? (
                  <span role="status" className="flex flex-col items-center gap-3 text-white">
                    <Loader2 className="h-11 w-11 animate-spin text-rvp-accent motion-reduce:animate-none" aria-hidden />
                    <span className="rounded-md bg-black/55 px-2 py-0.5 text-[13px] font-semibold">Préparation du clip…</span>
                  </span>
                ) : source.kind === "login" ? (
                  <PlayerMessage title="Connectez-vous pour regarder ce clip"
                    text="Ce clip de Rivendy demande un compte (gratuit). Vous revenez ici juste après.">
                    <Link href={`/auth/login?next=${encodeURIComponent(pathname)}`} prefetch={false} className={btnPrimary}>
                      <LogIn className="h-[18px] w-[18px]" aria-hidden /> Se connecter
                    </Link>
                  </PlayerMessage>
                ) : (
                  <PlayerMessage title={source.code === "not_in_territory" ? "Indisponible dans votre pays" : "Lecture impossible"}
                    text={playbackErrorMessage(source.code).replace("Ce titre", "Ce clip")}>
                    {["network", "media", "bad_response", "too_many_requests", "internal", "signing_unavailable", "unknown"].includes(source.code) ? (
                      <button type="button" onClick={retry} className={btnSecondary}><RotateCcw className="h-4 w-4" aria-hidden /> Réessayer</button>
                    ) : null}
                  </PlayerMessage>
                )}
              </PlayerFrame>
            )}
          </div>

          <h1 className={cn(display, "mt-4 text-[22px] leading-tight text-rvp-text sm:text-[26px]")}>{clip.title}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-3">
            {artist ? (
              <Link href={`/artist/${artist.id}`} prefetch={false} className="group flex min-w-0 items-center gap-3 rounded-rvp">
                <ArtistAvatar artist={artist} name={name} className="h-11 w-11 text-[15px]" />
                <span className="min-w-0">
                  <span className="flex items-center gap-1 font-semibold text-rvp-text group-hover:text-rvp-accent">
                    <span className="truncate">{name}</span><VerifiedMark />
                  </span>
                  <span className="block text-[13px] text-rvp-muted">{followers ? followersLabel(followers) : "Artiste"}</span>
                </span>
              </Link>
            ) : (
              <span className="flex min-w-0 items-center gap-3">
                <ArtistAvatar name={name} className="h-11 w-11 text-[15px]" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-rvp-text">{name}</span>
                  <span className="block text-[13px] text-rvp-muted">Clip publié par Rivendy</span>
                </span>
              </span>
            )}
            {artist ? <FollowButton userId={artist.user_id} name={name} className="ml-1" /> : null}
          </div>

          <div role="group" aria-label="Actions sur le clip" className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            <ActionButton onClick={() => void toggleLike()} pressed={liked} busy={likeBusy}
              label={liked ? "Je n’aime plus" : "J’aime"} icon={<Heart className={cn("h-[18px] w-[18px]", liked && "fill-current")} aria-hidden />}>
              J’aime{counts.likes > 0 ? <span className="tabular-nums text-rvp-soft">· {counts.likes}</span> : null}
            </ActionButton>
            <ActionButton onClick={() => void shareClip(clip.title, name, `${window.location.origin}${clipPath(clip.id)}`, notify)}
              icon={<Share2 className="h-[18px] w-[18px]" aria-hidden />}>Partager</ActionButton>
            <ActionButton onClick={() => void list.toggle(clip.id, clip.title)} pressed={saved} busy={list.busy(clip.id)}
              label={saved ? "Retirer des enregistrements" : "Enregistrer"}
              icon={saved ? <BookmarkCheck className="h-[18px] w-[18px]" aria-hidden /> : <Bookmark className="h-[18px] w-[18px]" aria-hidden />}>
              {saved ? "Enregistré" : "Enregistrer"}
            </ActionButton>
            {artistClip ? (
              <ActionButton onClick={() => { if (!userId) { notify("Connectez-vous pour signaler un clip.", "info"); return; } setReporting(true); }}
                icon={<Flag className="h-[18px] w-[18px]" aria-hidden />}>Signaler</ActionButton>
            ) : null}
          </div>

          <Details clip={clip} meta={meta} />

          <ClipComments key={clip.id} titleId={clip.id} commentsMode={clip.comments_mode} ownerId={artist?.user_id ?? null}
            initialCount={Number(clip.comments_count ?? 0)} collapsible />
        </div>

        <aside aria-labelledby="a-suivre" className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="a-suivre" className={cn(display, "text-[19px] font-bold text-rvp-text")}>À suivre</h2>
            <AutoSwitch on={autoNext} onChange={changeAuto} />
          </div>
          {!ready ? (
            catalog.status === "error" ? <p className="text-sm text-rvp-muted">Suggestions indisponibles pour le moment.</p> : (
              <div aria-hidden className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="flex gap-3"><div className="rvp-skeleton aspect-video w-40 rounded-rvp" /><div className="flex-1 space-y-2 pt-1"><div className="rvp-skeleton h-4 rounded" /><div className="rvp-skeleton h-3 w-1/2 rounded" /></div></div>)}</div>
            )
          ) : suggestions.length === 0 ? (
            <p className="text-sm text-rvp-muted">C’est le seul clip disponible pour le moment.</p>
          ) : (
            <ul className="space-y-1.5">
              {suggestions.map(({ clip: c, reason }) => (
                <li key={c.id}><ClipRow clip={c} artists={ready.artists} counts={ready.counts[c.id]} now={now} note={suggestionReasonLabel(reason)} /></li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[12px] text-rvp-muted">Suggestions : le même artiste, le même genre, puis les nouveautés.</p>
        </aside>
      </div>

      {reporting ? (
        <ReportDialog onClose={() => setReporting(false)} onPick={async (reason) => {
          setReporting(false);
          notify((await reportClip(clip.id, reason)) ? "Merci, le clip est signalé. Rivendy va vérifier." : "Signalement impossible pour le moment.",
            "info");
        }} />
      ) : null}
    </ClipsPage>
  );
}

/** Cadre du lecteur avant la vidéo (chargement, connexion, refus) : même place, mêmes proportions. */
function PlayerFrame({ poster, children }: { poster: string | null; children: React.ReactNode }) {
  return (
    <div className="relative grid aspect-video w-full place-items-center overflow-hidden rounded-2xl bg-black">
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35 blur-sm" />
      ) : null}
      <div className="relative px-4 text-center">{children}</div>
    </div>
  );
}

function PlayerMessage({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md rounded-rvp-panel bg-black/60 px-4 py-3 backdrop-blur-md sm:px-5 sm:py-5">
      <p className={cn(display, "text-[16px] text-white sm:text-[20px]")}>{title}</p>
      <p className="mt-1 text-[13px] leading-5 text-white/80 sm:mt-1.5 sm:text-[14px] sm:leading-6">{text}</p>
      {children ? <div className="mt-3 flex flex-wrap justify-center gap-3 sm:mt-4">{children}</div> : null}
    </div>
  );
}

/**
 * Fin du clip : « À suivre » avec un compte à rebours si la lecture
 * automatique est activée (désactivée par défaut), sinon un choix.
 */
function EndCard({ next, auto, onReplay }: { next: PlayTitle | null; auto: boolean; onReplay: () => void }) {
  const router = useRouter();
  const [left, setLeft] = useState(auto && next ? AUTO_DELAY : null);
  useEffect(() => {
    if (left == null || !next) return;
    if (left <= 0) { router.push(clipPath(next.id)); return; }
    const t = window.setTimeout(() => setLeft((n) => (n == null ? n : n - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [left, next, router]);

  return (
    <div className="grid h-full w-full place-items-center bg-black/75 p-4 text-center text-white">
      <div className="max-w-sm">
        {next ? (
          <>
            <p className="text-[13px] font-semibold uppercase tracking-wide text-white/70">{left != null ? `Prochain clip dans ${left} s` : "À suivre"}</p>
            <p className={cn(display, "mt-1 line-clamp-2 text-[18px] sm:text-[20px]")}>{next.title}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2.5">
              <Link href={clipPath(next.id)} className={cn(btnPrimary, "h-11")}><SkipForward className="h-4 w-4" aria-hidden /> Lire maintenant</Link>
              {left != null ? (
                <button type="button" onClick={() => setLeft(null)} className={cn(btnSecondary, "h-11")}><X className="h-4 w-4" aria-hidden /> Annuler</button>
              ) : (
                <button type="button" onClick={onReplay} className={cn(btnSecondary, "h-11")}><RotateCcw className="h-4 w-4" aria-hidden /> Revoir</button>
              )}
            </div>
          </>
        ) : (
          <button type="button" onClick={onReplay} className={cn(btnSecondary, "h-11")}><RotateCcw className="h-4 w-4" aria-hidden /> Revoir le clip</button>
        )}
      </div>
    </div>
  );
}

function ActionButton({ onClick, pressed, busy, label, icon, children }: {
  onClick: () => void; pressed?: boolean; busy?: boolean; label?: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={busy} aria-pressed={pressed} aria-label={label}
      className={cn("inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[14px] font-semibold disabled:opacity-60", motion,
        pressed ? "border-rvp-edge-strong bg-rvp-accent/15 text-rvp-accent" : "border-rvp-edge bg-rvp-surface text-rvp-text hover:bg-rvp-raised")}>
      {busy ? <Loader2 className="h-[18px] w-[18px] animate-spin motion-reduce:animate-none" aria-hidden /> : icon}
      {children}
    </button>
  );
}

/** Interrupteur « Lecture auto » (désactivé par défaut, gardé dans ce navigateur). */
function AutoSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
      className="flex h-10 items-center gap-2.5 rounded-full px-1 text-[13px] font-semibold text-rvp-soft">
      Lecture auto
      <span aria-hidden className={cn("relative h-6 w-10 rounded-full transition-colors", on ? "bg-rvp-accent" : "bg-rvp-raised ring-1 ring-inset ring-white/15")}>
        <span className={cn("absolute left-0 top-0.5 h-5 w-5 rounded-full shadow motion-safe:transition-transform", on ? "translate-x-[18px] bg-white" : "translate-x-0.5 bg-rvp-soft")} />
      </span>
    </button>
  );
}

/** Vues, date, genre et description (repliée au-delà de quatre lignes). */
function Details({ clip, meta }: { clip: PlayTitle; meta: string }) {
  const [open, setOpen] = useState(false);
  const text = clip.synopsis?.trim() ?? "";
  const line = [meta, clip.genre?.trim()].filter(Boolean).join(" · ");
  if (!line && !text) return null;
  const long = text.length > 220 || text.split("\n").length > 4;
  return (
    <div className="mt-4 rounded-rvp-panel bg-rvp-surface px-4 py-3.5">
      {line ? <p className="text-[13.5px] font-semibold text-rvp-text">{line}</p> : null}
      {text ? (
        <>
          <p className={cn("mt-1.5 whitespace-pre-line break-words text-[14.5px] leading-6 text-rvp-soft", !open && long && "line-clamp-4")}>{text}</p>
          {long ? (
            <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="mt-1 h-9 text-sm font-semibold text-rvp-text hover:text-rvp-accent">
              {open ? "Afficher moins" : "Afficher plus"}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** Motifs de signalement d'un clip d'artiste (les mêmes que l'app). */
function ReportDialog({ onClose, onPick }: { onClose: () => void; onPick: (reason: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="signaler-titre"
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-rvp-panel border border-rvp-edge bg-rvp-surface p-0 text-rvp-text shadow-rvp-deep backdrop:bg-black/70">
      <div className="p-5">
        <h2 id="signaler-titre" className={cn(display, "text-[19px] font-bold")}>Pourquoi signaler ce clip ?</h2>
        <p className="mt-1 text-[13.5px] text-rvp-soft">Rivendy vérifie chaque signalement.</p>
        <ul className="mt-4 space-y-1">
          {CLIP_REPORT_REASONS.map((r) => (
            <li key={r.key}>
              <button type="button" onClick={() => onPick(r.key)}
                className={cn("flex min-h-11 w-full items-center rounded-rvp px-3 text-left text-[14.5px] text-rvp-soft hover:bg-white/[0.06] hover:text-rvp-text", motion)}>
                {r.label}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => ref.current?.close()} className={cn(btnSecondary, "mt-4 h-11 w-full")}>Annuler</button>
      </div>
    </dialog>
  );
}
