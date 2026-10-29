"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils/cn";
import { artistName } from "../music-logic";
import { Cover } from "../music-ui";
import { useMusicProgress, type QueueItem } from "./music-player-provider";

/**
 * Habillage « radio-cassette » du lecteur agrandi (2026-10-29, maquette du
 * propriétaire). Un DÉCOR, construit en éléments indépendants (boîtier et
 * haut-parleurs en SVG, cassette, étiquette avec la vraie pochette, deux
 * bobines, vumètres) : il ne lit rien, ne charge aucun média et ne touche
 * pas à l'unique <audio> du site. L'état réel du lecteur arrive par
 * `data-state` (lecture, pause, chargement) ; les animations vivent dans
 * site.css (`.rvm-deck`) et s'arrêtent si l'on réduit les animations. Les
 * vumètres sont décoratifs : le site n'analyse pas le son (l'audio n'ouvre
 * pas ses règles CORS) et rien ici ne prétend le mesurer.
 */

export type DeckState = "playing" | "paused" | "loading";
type Phase = "idle" | "out" | "in";

/**
 * Couleurs du décor, tirées du vert officiel (--rv-primary #009688) et du
 * citron de la Musique : la radio-cassette garde ses teintes quel que soit
 * l'îlot de couleurs autour d'elle.
 */
const DECK = {
  body: ["#14A497", "#0A887D", "#06665E"],
  bodyEdge: "#065A53",
  panel: "#075C55",
  handle: "#0A7A70",
  chrome: ["#F7FAF9", "#B9C9C4", "#E6EDEA"],
  chromeEdge: "#7F948E",
  rim: ["#E9F0ED", "#9FB3AD", "#F4F8F6"],
  grille: "#0A1A19",
  grilleDot: "#22403C",
  speakerRing: "#0E2523",
  cap: ["#3B5A55", "#0B1716"],
  glass: ["#0E2A27", "#081A18"],
  screen: "#0A1615",
  accent: "#D6FF36",
  vuLow: "#5FD068",
  ground: "#063F3B",
  shell: ["#EAF6F1", "#A9CFC5"],
  shellInner: "#0A1E1C",
  label: ["#121C1B", "#1F302D"],
  window: "#111917",
  tape: "#3A2A21",
  hub: "#0E1C1A",
  screw: "#CFE0DA",
} as const;

/** Barres des vumètres : hauteur de repos et rythme propres à chacune (décor). */
const VU_BARS = Array.from({ length: 12 }, (_, k) => ({
  k,
  duration: `${620 + ((k * 137) % 480)}ms`,
  delay: `-${(k * 211) % 900}ms`,
}));

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * Changement de morceau : la cassette sort (160 ms) puis la suivante entre
 * (220 ms). Plusieurs changements rapides ne s'empilent pas : la sortie en
 * cours prend, à sa fin, le morceau réellement actif à ce moment-là. C'est
 * de l'affichage seulement : la lecture, elle, n'attend rien.
 */
function useCassetteSwap(item: QueueItem, reduce: boolean): { shown: QueueItem; phase: Phase } {
  const [shown, setShown] = useState(item);
  const [phase, setPhase] = useState<Phase>("idle");
  const latest = useRef(item);
  const shownId = useRef(item.track.id);
  const leaving = useRef(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); }, []);

  useEffect(() => {
    latest.current = item;
    const clear = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };
    if (item.track.id === shownId.current) {
      if (!leaving.current) setShown(item);
      return;
    }
    if (reduce) {
      clear();
      leaving.current = false;
      shownId.current = item.track.id;
      setShown(item);
      setPhase("idle");
      return;
    }
    // Une sortie est déjà en cours : à sa fin, elle prendra le morceau actif.
    if (leaving.current) return;
    clear();
    leaving.current = true;
    setPhase("out");
    timers.current.push(window.setTimeout(() => {
      leaving.current = false;
      shownId.current = latest.current.track.id;
      setShown(latest.current);
      setPhase("in");
      timers.current.push(window.setTimeout(() => setPhase("idle"), 220));
    }, 160));
  }, [item, reduce]);

  return { shown, phase };
}

/**
 * La platine : radio-cassette (ordinateur, tablette) ou cassette compacte
 * (téléphone, écran bas), avec l'état réel du lecteur pour les animations.
 */
export function CassetteDeck({ item, state, compact }: { item: QueueItem; state: DeckState; compact: boolean }) {
  const reduce = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { shown, phase } = useCassetteSwap(item, reduce);
  return (
    <div className="rvm-deck relative w-full" data-state={state}>
      {compact ? (
        <div className="relative overflow-hidden rounded-[22px] p-3 shadow-[0_18px_40px_rgb(6_63_59/0.28)]"
          style={{ background: `linear-gradient(160deg, ${DECK.body[0]}, ${DECK.body[1]} 55%, ${DECK.body[2]})` }}>
          <span aria-hidden className="pointer-events-none absolute inset-x-6 top-1.5 h-1 rounded-full bg-white/25" />
          <div className="relative overflow-hidden rounded-2xl p-2.5" style={{ background: `linear-gradient(180deg, ${DECK.glass[0]}, ${DECK.glass[1]})` }}>
            <Cassette item={shown} phase={phase} />
            <span aria-hidden className="rvm-deck-glass pointer-events-none absolute inset-0 rounded-2xl" />
          </div>
          <WaitDot className="absolute right-4 top-4" />
        </div>
      ) : (
        <Boombox item={shown} phase={phase} />
      )}
    </div>
  );
}

/** Chargement : un point citron qui clignote, discret (visible seulement pendant l'attente). */
function WaitDot({ className }: { className?: string }) {
  return <span aria-hidden className={cn("rvm-wait block h-2 w-2 rounded-full", className)} style={{ background: DECK.accent }} />;
}

function Boombox({ item, phase }: { item: QueueItem; phase: Phase }) {
  // Identifiants SVG propres à cette platine (sans « : », refusés dans url(#…)).
  const uid = useId().replace(/:/g, "");
  const ref = (n: string) => `url(#${uid}-${n})`;
  const id = (n: string) => `${uid}-${n}`;
  return (
    <div className="@container relative aspect-[1000/480] w-full select-none">
      <svg viewBox="0 0 1000 480" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden focusable="false">
        <defs>
          <linearGradient id={id("body")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={DECK.body[0]} /><stop offset="0.5" stopColor={DECK.body[1]} /><stop offset="1" stopColor={DECK.body[2]} />
          </linearGradient>
          <linearGradient id={id("chrome")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={DECK.chrome[0]} /><stop offset="0.45" stopColor={DECK.chrome[1]} /><stop offset="1" stopColor={DECK.chrome[2]} />
          </linearGradient>
          <radialGradient id={id("rim")} cx="0.5" cy="0.38" r="0.62">
            <stop offset="0.8" stopColor={DECK.rim[0]} /><stop offset="0.92" stopColor={DECK.rim[1]} /><stop offset="1" stopColor={DECK.rim[2]} />
          </radialGradient>
          <pattern id={id("mesh")} width="9" height="9" patternUnits="userSpaceOnUse">
            <rect width="9" height="9" fill={DECK.grille} />
            <circle cx="4.5" cy="4.5" r="2.4" fill={DECK.grilleDot} />
          </pattern>
          <radialGradient id={id("cap")} cx="0.4" cy="0.35" r="0.7">
            <stop offset="0" stopColor={DECK.cap[0]} /><stop offset="1" stopColor={DECK.cap[1]} />
          </radialGradient>
          <linearGradient id={id("glass")} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={DECK.glass[0]} /><stop offset="1" stopColor={DECK.glass[1]} />
          </linearGradient>
          <linearGradient id={id("vu")} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor={DECK.vuLow} /><stop offset="1" stopColor={DECK.accent} />
          </linearGradient>
          <filter id={id("glow")} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4" /></filter>
          <filter id={id("shadow")} x="-10%" y="-200%" width="120%" height="500%"><feGaussianBlur stdDeviation="10" /></filter>
          {/* Grain très léger du boîtier (texture), limité à sa forme. */}
          <filter id={id("grain")}>
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer><feFuncA type="table" tableValues="0 0.09" /></feComponentTransfer>
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
        </defs>

        {/* Ombre au sol */}
        <ellipse cx="500" cy="462" rx="440" ry="12" fill={DECK.ground} opacity="0.3" filter={ref("shadow")} />

        {/* Poignée */}
        <path d="M285 92 V54 Q285 34 305 34 H695 Q715 34 715 54 V92" fill="none" stroke={ref("chrome")} strokeWidth="12" strokeLinecap="round" />
        <rect x="320" y="18" width="360" height="30" rx="15" fill={DECK.handle} stroke={DECK.bodyEdge} strokeWidth="2" />
        <rect x="336" y="23" width="328" height="7" rx="3.5" fill="#FFFFFF" opacity="0.2" />

        {/* Touches */}
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <rect key={k} x={368 + k * 46} y="72" width="36" height="17" rx="4" fill={ref("chrome")} stroke={DECK.chromeEdge} strokeWidth="1.5" />
        ))}

        {/* Boîtier : dégradé, grain, reflets */}
        <rect x="8" y="84" width="984" height="370" rx="64" fill={ref("body")} stroke={DECK.bodyEdge} strokeWidth="2" />
        <rect x="8" y="84" width="984" height="370" rx="64" fill="#FFFFFF" filter={ref("grain")} />
        <rect x="22" y="96" width="956" height="346" rx="54" fill="none" stroke="#FFFFFF" strokeOpacity="0.16" strokeWidth="2" />
        <path d="M90 98 H910" stroke="#FFFFFF" strokeOpacity="0.28" strokeWidth="3" strokeLinecap="round" />
        <circle cx="54" cy="122" r="6" fill={ref("chrome")} stroke={DECK.chromeEdge} />
        <circle cx="946" cy="122" r="6" fill={ref("chrome")} stroke={DECK.chromeEdge} />

        {/* Panneau du haut : boutons, vumètres (décor), point d'attente */}
        <rect x="300" y="100" width="400" height="50" rx="14" fill={DECK.panel} />
        {[328, 672].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy="125" r="14" fill={ref("chrome")} stroke={DECK.chromeEdge} />
            <circle cx={cx} cy="125" r="5" fill={DECK.chromeEdge} />
          </g>
        ))}
        {[356, 508].map((x) => (
          <g key={x}>
            <rect x={x} y="109" width="136" height="32" rx="6" fill={DECK.screen} />
            {VU_BARS.map((b) => (
              <rect key={b.k} className="rvm-vu-bar" x={x + 8 + b.k * 10.4} y="113" width="6.4" height="24" rx="1.5" fill={ref("vu")}
                style={{ animationDuration: b.duration, animationDelay: b.delay }} />
            ))}
          </g>
        ))}
        <circle className="rvm-wait" cx="500" cy="125" r="4.5" fill={DECK.accent} />

        {/* Haut-parleurs */}
        {[165, 835].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy="292" r="138" fill={ref("rim")} />
            <circle cx={cx} cy="292" r="127" fill={DECK.speakerRing} />
            <circle cx={cx} cy="292" r="120" fill={ref("mesh")} />
            <circle className="rvm-speaker-glow" cx={cx} cy="292" r="110" fill="none" stroke={DECK.accent} strokeWidth="5" filter={ref("glow")} />
            <circle cx={cx} cy="292" r="110" fill="none" stroke={DECK.accent} strokeOpacity="0.55" strokeWidth="1.6" />
            <circle cx={cx} cy="292" r="28" fill={ref("cap")} />
            <circle cx={cx} cy="292" r="10" fill={DECK.grille} />
            <ellipse cx={cx - 8} cy="282" rx="8" ry="4.5" fill="#FFFFFF" opacity="0.18" />
            <path d={`M${cx - 110} 228 A 128 128 0 0 1 ${cx - 36} 164`} fill="none" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="4" strokeLinecap="round" />
          </g>
        ))}

        {/* Compartiment de la cassette (vitre posée par-dessus, hors SVG) */}
        <rect x="318" y="158" width="364" height="232" rx="18" fill={ref("glass")} stroke={ref("chrome")} strokeWidth="4" />

        {/* Plaque au logo officiel, dans ses couleurs d'origine */}
        <rect x="430" y="398" width="140" height="42" rx="21" fill={ref("chrome")} stroke={DECK.chromeEdge} strokeWidth="1.5" />
        <image href="/brand/rivendy-wordmark.png" x="444" y="404" width="112" height="30" preserveAspectRatio="xMidYMid meet" />

        {/* Pieds */}
        <rect x="120" y="448" width="90" height="12" rx="6" fill={DECK.bodyEdge} />
        <rect x="790" y="448" width="90" height="12" rx="6" fill={DECK.bodyEdge} />
      </svg>

      {/* La cassette, dans le compartiment : pochette et bobines vivantes. */}
      <div className="absolute overflow-hidden rounded-[0.8cqw]" style={{ left: "34.4%", top: "35.4%", width: "31.2%", height: "43.3%" }}>
        <Cassette item={item} phase={phase} />
      </div>
      <span aria-hidden className="rvm-deck-glass pointer-events-none absolute rounded-[1.6cqw]"
        style={{ left: "31.8%", top: "32.9%", width: "36.4%", height: "48.3%" }} />
    </div>
  );
}

/**
 * La cassette : coque translucide, étiquette avec la VRAIE pochette (jamais
 * déformée ni rognée ; sans pochette, une vignette Rivendy), le titre de
 * l'album et l'artiste, et la fenêtre des deux bobines.
 */
function Cassette({ item, phase }: { item: QueueItem; phase: Phase }) {
  const { release: r } = item;
  const uid = useId().replace(/:/g, "");
  return (
    <div data-phase={phase} className="rvm-cassette @container relative aspect-[3/2] w-full">
      <svg viewBox="0 0 300 200" className="absolute inset-0 h-full w-full" aria-hidden focusable="false">
        <defs>
          <linearGradient id={`${uid}-shell`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={DECK.shell[0]} stopOpacity="0.55" />
            <stop offset="1" stopColor={DECK.shell[1]} stopOpacity="0.32" />
          </linearGradient>
        </defs>
        <rect x="3" y="3" width="294" height="194" rx="16" fill={`url(#${uid}-shell)`} stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="2" />
        <rect x="10" y="10" width="280" height="180" rx="11" fill={DECK.shellInner} fillOpacity="0.55" />
        {[[18, 18], [282, 18], [18, 182], [282, 182]].map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r="4.5" fill={DECK.screw} stroke={DECK.chromeEdge} />
            <path d={`M${x - 2.5} ${y} H${x + 2.5}`} stroke={DECK.chromeEdge} strokeWidth="1.2" />
          </g>
        ))}
        <path d="M78 196 L92 166 H208 L222 196 Z" fill="#FFFFFF" fillOpacity="0.14" stroke="#FFFFFF" strokeOpacity="0.35" />
        <circle cx="112" cy="182" r="5" fill={DECK.hub} />
        <circle cx="188" cy="182" r="5" fill={DECK.hub} />
        <rect x="141" y="176" width="6" height="9" rx="1" fill={DECK.hub} />
        <rect x="153" y="176" width="6" height="9" rx="1" fill={DECK.hub} />
      </svg>

      {/* Étiquette : îlot vert lagon, pour une vignette de remplacement aux couleurs Rivendy. */}
      <div className="rvm-deep absolute left-[6%] right-[6%] top-[7%] flex h-[46%] items-center gap-[3cqw] overflow-hidden rounded-[2.4cqw] border border-white/15 p-[2cqw] pr-[9cqw]"
        style={{ background: `linear-gradient(135deg, ${DECK.label[0]}, ${DECK.label[1]})` }}>
        <Cover url={r.cover_url} size={320} alt="" rounded="rounded-[1.4cqw]" className="h-full w-auto shrink-0 shadow-lg shadow-black/40" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-rvm-display text-[6.6cqw] font-black uppercase leading-none tracking-[0.03em] text-white">{r.title}</span>
          <span className="mt-[1.6cqw] block truncate text-[3.3cqw] font-bold uppercase tracking-[0.22em] text-white/80">{artistName(r)}</span>
        </span>
        <span aria-hidden className="absolute bottom-[1.4cqw] right-[3cqw] font-rvm-display text-[6.4cqw] font-black text-white">A</span>
      </div>

      {/* Fenêtre des bobines */}
      <div className="absolute left-[22%] right-[22%] top-[56%] h-[27%] overflow-hidden rounded-[2.4cqw] border-[0.6cqw] border-white/25"
        style={{ background: DECK.window }}>
        <Reels />
      </div>
    </div>
  );
}

/**
 * Les deux bobines : elles tournent en lecture (site.css, `.rvm-reel`) et
 * la bande passe de gauche à droite avec la progression du titre. Seul ce
 * petit composant suit la position : le reste de la platine ne se redessine
 * pas à chaque instant, et l'entrée de la cassette ne repart jamais.
 */
function Reels() {
  const { position, duration } = useMusicProgress();
  const pct = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;
  const left = 13 + 12 * (1 - pct);
  const right = 13 + 12 * pct;
  return (
    <svg viewBox="0 0 168 54" className="h-full w-full" aria-hidden focusable="false">
      <path d="M42 51 H126" stroke={DECK.tape} strokeWidth="2.4" />
      <circle cx="42" cy="27" r={left} fill={DECK.tape} />
      <circle cx="126" cy="27" r={right} fill={DECK.tape} />
      <Hub cx={42} />
      <Hub cx={126} />
    </svg>
  );
}

function Hub({ cx }: { cx: number }) {
  return (
    <g className="rvm-reel">
      <circle cx={cx} cy="27" r="12" fill={DECK.accent} />
      <circle cx={cx} cy="27" r="8.5" fill={DECK.hub} />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <rect key={a} x={cx - 1.3} y="18.5" width="2.6" height="4" rx="0.6" fill={DECK.accent} transform={`rotate(${a} ${cx} 27)`} />
      ))}
      <circle cx={cx} cy="27" r="2.6" fill={DECK.accent} />
    </g>
  );
}
