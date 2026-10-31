"use client";

import {
  Fragment, createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type ReactNode, type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Maximize2, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import { isMusicPath } from "@/components/layout/hide-in-music";
import { useAuth } from "@/features/auth/auth-provider";
import { cn } from "@/lib/utils/cn";
import { clampDock, dockClock, settleDock, shouldFloat, type DockSpot } from "./dock-logic";

/**
 * Mini-lecteur vidéo de Rivendy Play sur le site (2026-10-31).
 *
 * Avant : la vidéo vivait dans la page de lecture ; quitter la page (vers la
 * marketplace, la Musique…) démontait le lecteur et la coupait, et revenir la
 * relançait de zéro. Désormais UNE lecture vidéo active est montée ici, à la
 * racine du site (app/providers.tsx), comme le lecteur Musique : son contenu
 * est rendu par un portail dans une « scène » (un élément du DOM) que l'on
 * DÉPLACE — dans l'emplacement de la page de lecture tant qu'elle est ouverte
 * (<KeepVideo>), sinon dans le mini-lecteur. La même balise <video>, le même
 * flux hls.js et le même comptage (progression, vues, session d'écran)
 * continuent : rien n'est rechargé ni relancé.
 *
 * Le déplacement est SYNCHRONE (effet de mise en page, avant que la page ne
 * retire son DOM) : une vidéo détachée du document, même 50 ms, est mise en
 * pause par le navigateur (vérifié dans Chromium le 2026-10-31).
 *
 * Règles (les mêmes que le lecteur flottant de l'app) : quitter la page
 * pendant la LECTURE → mini-lecteur ; en pause, finie ou en erreur → la
 * lecture se ferme. Une seule vidéo à la fois : ouvrir une autre lecture
 * remplace celle-ci. La croix ferme et libère tout (progression envoyée, écran
 * libéré) ; un changement de compte ferme le mini-lecteur. Un rechargement de
 * la page n'est PAS une continuité : la page reprend alors à la position
 * enregistrée par le serveur.
 */

type Report = {
  video: HTMLVideoElement | null;
  /** La lecture peut continuer dans le mini-lecteur (droits accordés, pas d'aperçu, pas d'erreur). */
  floatable: boolean;
  /** Ce que le mini-lecteur affiche : le titre, puis le détail (épisode, artiste). */
  label: string;
  detail: string | null;
  /** Lecture arrêtée (erreur, écran repris ailleurs) : le message affiché dans le mini-lecteur. */
  problem: string | null;
};

const EMPTY: Report = { video: null, floatable: false, label: "", detail: null, problem: null };

type Session = { key: string; href: string; node: ReactNode };

type DockApi = {
  keep: (key: string, href: string, node: ReactNode) => void;
  attach: (key: string, slot: HTMLElement) => void;
  detach: (key: string, slot: HTMLElement) => void;
  report: (key: string, patch: Partial<Report>) => void;
  close: () => void;
};

const ApiContext = createContext<DockApi | null>(null);
const SessionContext = createContext<{ key: string; mini: boolean } | null>(null);

/** Déplace la scène sans la détacher du document (moveBefore garde aussi plein écran et image dans l'image). */
function moveInto(parent: HTMLElement, node: HTMLElement) {
  if (node.parentElement === parent) return;
  const atomic = (parent as HTMLElement & { moveBefore?: (n: Node, c: Node | null) => void }).moveBefore;
  if (atomic && node.isConnected && parent.isConnected) {
    try { atomic.call(parent, node, null); return; } catch { /* repli ci-dessous */ }
  }
  parent.appendChild(node);
}

export function PlayDockProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const [mini, setMini] = useState(false);
  const [report, setReport] = useState<Report>(EMPTY);
  // Copies synchrones : attach/detach décident pendant la mise en page, avant tout rendu.
  const sessionRef = useRef<Session | null>(null);
  const reportRef = useRef<Report>(EMPTY);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const slotRef = useRef<HTMLElement | null>(null);
  const miniRef = useRef(false);
  const hostRef = useRef<HTMLDivElement | null>(null);

  const api = useMemo<DockApi>(() => {
    const scene = () => {
      if (!stageRef.current) {
        const el = document.createElement("div");
        el.style.width = "100%";
        stageRef.current = el;
        setStage(el);
      }
      return stageRef.current;
    };
    const setMiniBoth = (on: boolean) => { miniRef.current = on; setMini(on); };
    const end = () => {
      // Pause immédiate : aucun son ne survit à la fermeture, avant même le démontage.
      reportRef.current.video?.pause();
      sessionRef.current = null;
      reportRef.current = EMPTY;
      slotRef.current = null;
      setSession(null);
      setReport(EMPTY);
      setMiniBoth(false);
    };
    return {
      keep(key, href, node) {
        const cur = sessionRef.current;
        if (cur?.key === key) {
          if (cur.node !== node) { sessionRef.current = { ...cur, node }; setSession(sessionRef.current); }
          return;
        }
        // Une autre lecture s'ouvre : elle remplace la précédente (une seule vidéo à la fois).
        if (cur) reportRef.current.video?.pause();
        scene();
        sessionRef.current = { key, href, node };
        reportRef.current = EMPTY;
        setSession(sessionRef.current);
        setReport(EMPTY);
        setMiniBoth(false);
      },
      attach(key, slot) {
        if (sessionRef.current?.key !== key) return;
        slotRef.current = slot;
        moveInto(slot, scene());
        setMiniBoth(false);
      },
      detach(key, slot) {
        if (slotRef.current !== slot) return;
        slotRef.current = null;
        if (sessionRef.current?.key !== key) return;
        const r = reportRef.current;
        const host = hostRef.current;
        if (host && shouldFloat(r.floatable, r.video)) {
          const full = document.fullscreenElement;
          if (full && stageRef.current?.contains(full)) void document.exitFullscreen().catch(() => undefined);
          moveInto(host, scene());
          setMiniBoth(true);
          return;
        }
        // Pas de mini-lecteur : la lecture se ferme — sauf si la même page se
        // rattache aussitôt (double montage du mode strict de React en développement).
        queueMicrotask(() => {
          if (!slotRef.current && !miniRef.current && sessionRef.current?.key === key) end();
        });
      },
      report(key, patch) {
        if (sessionRef.current?.key !== key) return;
        const next = { ...reportRef.current, ...patch };
        if ((Object.keys(patch) as Array<keyof Report>).every((k) => next[k] === reportRef.current[k])) return;
        reportRef.current = next;
        setReport(next);
      },
      close: end,
    };
  }, []);

  // Déconnexion ou autre compte : le mini-lecteur se ferme (la page de lecture, elle, le gère).
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const lastUid = useRef<string | null>(null);
  useEffect(() => {
    const prev = lastUid.current;
    lastUid.current = uid;
    if (prev && prev !== uid && miniRef.current) api.close();
  }, [uid, api]);

  const key = session?.key ?? null;
  const ctx = useMemo(() => (key ? { key, mini } : null), [key, mini]);

  return (
    <ApiContext.Provider value={api}>
      {children}
      {session && stage
        ? createPortal(
            <SessionContext.Provider value={ctx}>
              <Fragment key={session.key}>{session.node}</Fragment>
            </SessionContext.Provider>,
            stage,
          )
        : null}
      {session ? <MiniVideoDock hostRef={hostRef} shown={mini} report={report} href={session.href} onClose={api.close} /> : null}
    </ApiContext.Provider>
  );
}

/** Pour le contenu d'une lecture : affiché en page ou dans le mini-lecteur, et ce qu'il signale au mini-lecteur. */
export function useDockSession() {
  const api = useContext(ApiContext);
  const s = useContext(SessionContext);
  const key = s?.key ?? null;
  const report = useCallback((patch: Partial<Report>) => { if (api && key) api.report(key, patch); }, [api, key]);
  return { mini: !!s?.mini, report };
}

/**
 * Emplacement de la lecture dans une page : `children` (le lecteur et son
 * comptage) est rendu à la racine du site et affiché ICI tant que la page est
 * ouverte ; en quittant la page pendant la lecture, il passe dans le
 * mini-lecteur sans s'arrêter. `sessionKey` identifie le contenu
 * (« movie:… », « episode:… », « clip:… ») : revenir sur la même clé retrouve
 * la lecture en cours, intacte (même position, même état lecture/pause).
 */
export function KeepVideo({ sessionKey, href, className, children }: {
  sessionKey: string;
  /** La page qui affiche ce contenu : « Agrandir » y ramène. */
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const api = useContext(ApiContext);
  const slot = useRef<HTMLDivElement>(null);
  // Le contenu le plus récent de la page (les rappels et données qu'elle passe).
  useLayoutEffect(() => { api?.keep(sessionKey, href, children); });
  useLayoutEffect(() => {
    const el = slot.current;
    if (!api || !el) return;
    api.attach(sessionKey, el);
    return () => api.detach(sessionKey, el);
  }, [api, sessionKey]);
  if (!api) return <div className={className}>{children}</div>;
  return <div ref={slot} className={className} />;
}

// ── Le mini-lecteur ────────────────────────────────────────────────────────

/** Marges du déplacement : sous les barres du haut, au-dessus du bord bas (px). */
const LIMITS = { top: 56, bottom: 8 };

type Playback = { playing: boolean; waiting: boolean; muted: boolean; time: number; duration: number };

function MiniVideoDock({ hostRef, shown, report, href, onClose }: {
  hostRef: RefObject<HTMLDivElement | null>;
  shown: boolean;
  report: Report;
  href: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const inMusic = isMusicPath(usePathname());
  const card = useRef<HTMLElement>(null);
  const [spot, setSpot] = useState<DockSpot | null>(null);
  const [pb, setPb] = useState<Playback>({ playing: false, waiting: false, muted: false, time: 0, duration: 0 });
  const v = report.video;

  // L'état affiché suit la balise vidéo elle-même (lecture, attente du réseau, son, temps).
  useEffect(() => {
    if (!v || !shown) return;
    let waiting = false;
    const read = () => setPb({
      playing: !v.paused && !v.ended,
      waiting,
      muted: v.muted || v.volume === 0,
      time: v.currentTime,
      duration: Number.isFinite(v.duration) ? v.duration : 0,
    });
    const onWait = () => { waiting = true; read(); };
    const onGo = () => { waiting = false; read(); };
    const events = ["play", "pause", "ended", "timeupdate", "volumechange", "durationchange", "seeked"] as const;
    events.forEach((e) => v.addEventListener(e, read));
    v.addEventListener("waiting", onWait);
    ["playing", "canplay"].forEach((e) => v.addEventListener(e, onGo));
    read();
    return () => {
      events.forEach((e) => v.removeEventListener(e, read));
      v.removeEventListener("waiting", onWait);
      ["playing", "canplay"].forEach((e) => v.removeEventListener(e, onGo));
    };
  }, [v, shown]);

  // Déplacement : un glisser déplace le mini-lecteur (collé au bord le plus proche),
  // un simple appui sur l'image l'agrandit ; les boutons ne déplacent jamais.
  // Le geste est suivi sur toute la fenêtre : un glisser rapide sort du mini-lecteur dès le premier mouvement.
  const dragged = useRef(false);
  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("[data-no-drag]")) return;
    const el = card.current;
    if (!el) return;
    const start = { id: e.pointerId, x: e.clientX, y: e.clientY, rect: el.getBoundingClientRect() };
    let moved = false;
    dragged.current = false;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== start.id) return;
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < 6) return;
      moved = true;
      el.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== start.id) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (!moved) return;
      el.style.transform = "";
      dragged.current = true; // l'appui qui suit n'agrandit pas
      if (ev.type === "pointercancel") return;
      const { rect } = start;
      const center = { x: rect.left + rect.width / 2 + ev.clientX - start.x, y: rect.top + rect.height / 2 + ev.clientY - start.y };
      setSpot(settleDock(center, { w: rect.width, h: rect.height }, { w: window.innerWidth, h: window.innerHeight }, LIMITS));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  // Rotation, fenêtre redimensionnée : la position choisie reste dans l'écran.
  useEffect(() => {
    if (!spot || !shown) return;
    const onResize = () => {
      const r = card.current?.getBoundingClientRect();
      if (!r) return;
      setSpot((s) => (s ? clampDock(s, { w: r.width, h: r.height }, { w: window.innerWidth, h: window.innerHeight }, LIMITS) : s));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [spot, shown]);

  const expand = () => {
    if (dragged.current) { dragged.current = false; return; }
    router.push(href);
  };
  // La balise vidéo, pour les commandes (une valeur reçue en propriété ne se modifie pas).
  const media = useRef<HTMLVideoElement | null>(null);
  useEffect(() => { media.current = v; }, [v]);
  const toggle = () => {
    const el = media.current;
    if (!el) return;
    if (el.paused || el.ended) void el.play().catch(() => undefined);
    else el.pause();
  };
  const toggleMute = () => {
    const el = media.current;
    if (!el) return;
    if (el.muted || el.volume === 0) { el.muted = false; if (el.volume === 0) el.volume = 1; } else el.muted = true;
  };

  const problem = report.problem;
  const pct = pb.duration > 0 ? Math.min(100, (pb.time / pb.duration) * 100) : 0;
  const clock = pb.duration > 0 ? `${dockClock(pb.time)} / ${dockClock(pb.duration)}` : dockClock(pb.time);
  // Au-dessus de la barre Musique hors de la Musique, de la navigation basse sur téléphone,
  // et du lecteur de la Musique dans son espace. Un glisser choisit une autre place.
  const place = inMusic
    ? "right-3 bottom-[calc(10rem+env(safe-area-inset-bottom))] md:right-6 md:bottom-[7.5rem]"
    : "right-3 bottom-[calc(var(--rvm-player-h,0px)+5.5rem+env(safe-area-inset-bottom))] md:right-6 md:bottom-[calc(var(--rvm-player-h,0px)+1.5rem)]";

  return (
    <section ref={card} hidden={!shown} aria-label="Lecteur vidéo réduit"
      onPointerDown={onPointerDown}
      style={spot ? { bottom: `max(${spot.bottom}px, calc(env(safe-area-inset-bottom) + 8px))`, [spot.side]: "12px" } : undefined}
      className={cn(
        "fixed z-[46] w-[min(calc(100vw-1.5rem),15rem)] touch-none select-none overflow-hidden rounded-rvp-panel border border-rvp-edge bg-rvp-frame text-rvp-text shadow-rvp-deep sm:w-80",
        !spot && place,
      )}>
      <div className="relative aspect-video w-full bg-black">
        {/* La scène de la lecture (balise vidéo) est posée ici par le fournisseur. */}
        <div ref={hostRef} className="absolute inset-0 [&_video]:pointer-events-none" />
        <button type="button" onClick={expand} aria-label={`Agrandir : ${report.label || "la vidéo"}`}
          className="absolute inset-0 cursor-grab focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rvp-accent active:cursor-grabbing" />
        {problem ? (
          <p role="status" className="pointer-events-none absolute inset-0 grid place-items-center bg-black/75 px-3 text-center text-[13px] font-semibold leading-5 text-white">
            {problem}
          </p>
        ) : pb.waiting ? (
          <span role="status" aria-label="Chargement" className="pointer-events-none absolute inset-0 grid place-items-center">
            <Loader2 className="h-8 w-8 animate-spin text-rvp-accent motion-reduce:animate-none" aria-hidden />
          </span>
        ) : null}
      </div>
      <div aria-hidden className="h-0.5 bg-white/10">
        <div className="h-full bg-rvp-accent" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center gap-0.5 px-1.5 py-1.5">
        <DockButton label={pb.playing ? "Pause" : "Lecture"} onClick={toggle} disabled={!!problem || !v}>
          {pb.playing ? <Pause className="h-[18px] w-[18px] fill-current" aria-hidden /> : <Play className="h-[18px] w-[18px] translate-x-px fill-current" aria-hidden />}
        </DockButton>
        <div className="min-w-0 flex-1 px-1.5">
          <p className="truncate text-[13px] font-semibold leading-5">{report.label || "Rivendy Play"}</p>
          <p className="truncate text-[11.5px] leading-4 text-rvp-muted tabular-nums">
            {report.detail ? `${report.detail} · ${clock}` : clock}
          </p>
        </div>
        <DockButton label={pb.muted ? "Activer le son" : "Couper le son"} onClick={toggleMute} disabled={!v}>
          {pb.muted ? <VolumeX className="h-[18px] w-[18px]" aria-hidden /> : <Volume2 className="h-[18px] w-[18px]" aria-hidden />}
        </DockButton>
        <DockButton label="Agrandir" onClick={() => router.push(href)}>
          <Maximize2 className="h-[17px] w-[17px]" aria-hidden />
        </DockButton>
        <DockButton label="Fermer la vidéo" onClick={onClose}>
          <X className="h-[18px] w-[18px]" aria-hidden />
        </DockButton>
      </div>
    </section>
  );
}

function DockButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" data-no-drag aria-label={label} title={label} onClick={onClick} disabled={disabled}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-rvp-text hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-rvp-accent disabled:opacity-40">
      {children}
    </button>
  );
}
