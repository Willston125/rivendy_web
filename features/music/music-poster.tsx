"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { trackAdClick, trackAdDisplay } from "@/features/ads/track";
import { useHomeMarket } from "@/features/media/use-home-market";
import { cn } from "@/lib/utils/cn";
import { safeExternalUrl } from "@/lib/utils/safe-url";
import { fetchPosterPlan } from "./music-ads";
import {
  addListened, nextPoster, posterCta, posterHasLink, posterPlanIsEmpty, posterSlots, posterStep,
  type MusicPoster, type MusicPosterPlan,
} from "./music-logic";
import { useMusicPlayer, useMusicProgress } from "./player/music-player-provider";

/** Le rythme et les cartes changent au dashboard : relus de temps en temps, pas à chaque titre. */
const PLAN_LIFETIME_MS = 10 * 60 * 1000;

/** Point de départ de la rotation, tiré une fois par chargement : chaque carte a sa part. */
const FIRST_CURSOR = Math.floor(Math.random() * 1000);

/** Le bon moment : page visible, personne n'écrit, téléphone pas à l'horizontale. */
function canShowNow(): boolean {
  if (document.visibilityState !== "visible") return false;
  const el = document.activeElement;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return false;
  if (el instanceof HTMLElement && el.isContentEditable) return false;
  return !(window.innerWidth > window.innerHeight && window.innerHeight < 500);
}

function posterHref(p: MusicPoster): string | null {
  if (p.link_type === "product") return `/products/${p.link_value}`;
  if (p.link_type === "store") return `/store/${p.link_value}`;
  return safeExternalUrl(p.link_value);
}

/**
 * Carte publicitaire de Rivendy Musique (maquette validée le 2026-11-06), la
 * même que dans l'application : un compte gratuit la voit 2 à 3 fois par
 * chanson, selon le rythme réglé au dashboard. Elle ÉCOUTE le lecteur et ne
 * lui parle jamais : le son ne dépend ni de son affichage ni de sa fermeture.
 * Le serveur (`music_poster_plan`) décide qui la voit : rien pour un abonné,
 * et rien non plus en cas de panne.
 */
export function MusicPosterHost() {
  const { user } = useAuth();
  const market = useHomeMarket();
  const player = useMusicPlayer();
  const { position, duration, ready } = useMusicProgress();
  const [open, setOpen] = useState<{ poster: MusicPoster; seconds: number } | null>(null);

  const trackId = player.current?.track.id ?? null;
  const plan = useRef<{ key: string; at: number; value: MusicPosterPlan } | null>(null);
  const images = useRef(new Set<string>());
  const cursor = useRef(FIRST_CURSOR);
  const track = useRef({ id: "", listened: 0, lastPos: 0, slots: null as number[] | null, next: 0, shown: new Set<string>() });

  /** Charge d'avance l'image de la prochaine carte : elle s'ouvre tout de suite, ou pas du tout. */
  const prepareNext = useCallback(() => {
    const posters = plan.current?.value.posters ?? [];
    const i = nextPoster(posters.map((p) => p.id), track.current.shown, cursor.current);
    if (i < 0) return;
    const url = posters[i].image_url;
    if (images.current.has(url)) return;
    const img = new window.Image();
    img.onload = () => { images.current.add(url); };
    img.src = url;
  }, []);

  useEffect(() => {
    if (!trackId || !user || !market) return;
    const key = `${user.id}:${market}`;
    const known = plan.current;
    if (known && known.key === key && Date.now() - known.at < PLAN_LIFETIME_MS) return;
    let alive = true;
    void fetchPosterPlan(market).then((value) => {
      if (!alive) return;
      plan.current = { key, at: Date.now(), value };
      track.current.slots = null; // Le rythme a pu changer : le titre en cours le relit.
    });
    return () => { alive = false; };
  }, [trackId, user, market]);

  useEffect(() => {
    if (!trackId) return;
    const t = track.current;
    // Autre titre, ou le même qui repart du début : nouvelle écoute.
    if (trackId !== t.id || (position < 3 && t.lastPos > position + 2)) {
      track.current = { id: trackId, listened: 0, lastPos: position, slots: null, next: 0, shown: new Set() };
      return;
    }
    if (player.playing) t.listened = addListened(t.listened, t.lastPos, position);
    t.lastPos = position;

    const value = plan.current?.value;
    if (!value || posterPlanIsEmpty(value)) return;
    if (!t.slots) {
      // Un extrait de 30 s n'en reçoit jamais.
      if (player.preview) { t.slots = []; return; }
      if (!ready || !(duration > 0)) return;
      t.slots = posterSlots(duration, value.rhythm);
      prepareNext();
    }
    // Un moment passé hors de vue est perdu : aucune carte ne surgit au retour.
    const step = posterStep(t.slots, t.next, t.listened);
    t.next = step.next;
    if (!step.due || open || !canShowNow()) return;
    const i = nextPoster(value.posters.map((p) => p.id), t.shown, cursor.current);
    if (i < 0) return;
    const poster = value.posters[i];
    // Image pas encore là (réseau lent) : ce moment est sauté, sans message.
    if (!images.current.has(poster.image_url)) { prepareNext(); return; }
    cursor.current = i + 1;
    t.shown.add(poster.id);
    trackAdDisplay(poster.id);
    setOpen({ poster, seconds: value.rhythm.showSeconds });
  }, [position, trackId, player.playing, player.preview, duration, ready, open, prepareNext]);

  const close = useCallback(() => {
    setOpen(null);
    prepareNext();
  }, [prepareNext]);

  if (!open) return null;
  return <PosterCard poster={open.poster} seconds={open.seconds} expanded={player.expanded} onClose={close} />;
}

/**
 * Voile gris et carte centrée. Le voile couvre la page mais jamais le lecteur
 * du bas, qui reste utilisable ; il passe au-dessus du lecteur agrandi. Seul
 * le bouton ouvre le lien : toucher l'image par surprise n'ouvre rien.
 */
function PosterCard({ poster, seconds, expanded, onClose }: {
  poster: MusicPoster;
  seconds: number;
  expanded: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, seconds * 1000);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, seconds]);

  const href = posterHasLink(poster) ? posterHref(poster) : null;
  const button = "flex h-[52px] items-center justify-center rounded-full bg-rvm-accent px-4 text-base font-extrabold text-rvm-on-accent transition-colors hover:bg-rvm-accent-hover";
  return (
    <div className={cn("flex items-center justify-center p-4", expanded ? "fixed inset-0 z-[60]" : "absolute inset-x-0 -top-16 bottom-0 z-40")}>
      <div aria-hidden className="absolute inset-0 bg-[rgb(15_23_42/0.58)]" onClick={onClose} />
      <section role="dialog" aria-label="Publicité"
        className="rvm-poster-in relative flex h-[70dvh] max-h-full w-[85%] max-w-[25rem] flex-col overflow-hidden rounded-[22px] bg-white shadow-2xl md:h-auto">
        <span aria-hidden className="rvm-poster-time absolute inset-x-0 top-0 z-10 h-[3px] origin-left bg-rvm-ink-accent"
          style={{ animationDuration: `${seconds}s` }} />
        <div className="flex h-[50px] shrink-0 items-center justify-between pl-4 pr-1">
          <span className="text-xs font-bold text-rvm-muted">Sponsorisé</span>
          <button type="button" onClick={onClose} aria-label="Fermer la publicité"
            className="flex h-11 w-11 items-center justify-center rounded-full text-rvm-text transition-colors hover:bg-rvm-raised">
            <X className="h-6 w-6" aria-hidden />
          </button>
        </div>
        <div className="relative aspect-[3/2] w-full shrink-0 bg-rvm-raised">
          <Image src={poster.image_url} alt="" fill sizes="400px" className="object-cover" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-hidden px-5 pt-4 text-center md:flex-none">
          <p className="line-clamp-2 font-rvm-display text-2xl font-extrabold leading-tight text-rvm-text">{poster.title}</p>
          {poster.body ? <p className="line-clamp-3 text-[15px] leading-snug text-rvm-muted">{poster.body}</p> : null}
        </div>
        {href ? (
          <div className="shrink-0 px-4 pb-4 pt-3">
            {poster.link_type === "external" ? (
              <a href={href} target="_blank" rel="noopener noreferrer sponsored" className={button}
                onClick={() => { trackAdClick(poster.id); onClose(); }}>
                {posterCta(poster)}
              </a>
            ) : (
              <Link href={href} prefetch={false} className={button} onClick={() => { trackAdClick(poster.id); onClose(); }}>
                {posterCta(poster)}
              </Link>
            )}
          </div>
        ) : <div className="h-4 shrink-0" />}
      </section>
    </div>
  );
}
