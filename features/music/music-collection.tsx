"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Heart, ListMusic, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { headerTint, thumbUrl } from "./music-logic";
import { Cover } from "./music-ui";

/**
 * Page « collection » de la Musique (mise en page application du
 * 2026-10-22) : sortie, playlist, favoris, historique, Rivendy Hit, artiste.
 * Grand en-tête en dégradé (la couleur de la pochette quand elle se lit,
 * sinon un vert dérivé de Rivendy), commandes de lecture juste dessous,
 * puis la liste. Au défilement, une barre compacte garde le titre et le
 * bouton de lecture.
 */

/** Teinte des favoris : un vert profond dérivé de --rv-primary (texte blanc lisible). */
export const LIKED_TINT: [number, number, number] = [7, 92, 82];
/** Teinte neutre (pochette absente ou illisible) : vert nuit de la Musique. */
export const DEFAULT_TINT: [number, number, number] = [18, 52, 58];

const tints = new Map<string, [number, number, number]>();

/**
 * Couleur moyenne d'une pochette (vignette 48 px lue dans un canevas ; le
 * stockage autorise la lecture : Access-Control-Allow-Origin *), assombrie
 * pour que le texte blanc reste lisible. null tant qu'elle n'est pas lue.
 */
export function useCoverTint(url: string | null | undefined): [number, number, number] | null {
  const src = url ? thumbUrl(url, 160) : null;
  const [tint, setTint] = useState<{ src: string | null; rgb: [number, number, number] | null }>(
    () => ({ src, rgb: src ? tints.get(src) ?? null : null }),
  );
  useEffect(() => {
    if (!src || !src.startsWith("https://")) return;
    const known = tints.get(src);
    if (known) { setTint({ src, rgb: known }); return; }
    let alive = true;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = 16; c.height = 16;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 16, 16);
        const d = ctx.getImageData(0, 0, 16, 16).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) {
          const max = Math.max(d[i], d[i + 1], d[i + 2]);
          const min = Math.min(d[i], d[i + 1], d[i + 2]);
          // Les pixels presque noirs, presque blancs ou gris pèsent peu : on garde la couleur.
          const w = max < 24 || min > 235 ? 0.15 : 0.4 + (max - min) / 255;
          r += d[i] * w; g += d[i + 1] * w; b += d[i + 2] * w; n += w;
        }
        if (!n) return;
        const rgb = headerTint([r / n, g / n, b / n]);
        tints.set(src, rgb);
        if (alive) setTint({ src, rgb });
      } catch { /* lecture refusée : teinte par défaut */ }
    };
    img.src = src;
    return () => { alive = false; };
  }, [src]);
  return tint.src === src ? tint.rgb : null;
}

/** Tuile d'une collection sans pochette (favoris, historique, Hit). */
export function IconTile({ icon: Icon, tone = "green", className }: { icon: LucideIcon; tone?: "green" | "night"; className?: string }) {
  return (
    <div className={cn("flex aspect-square items-center justify-center rounded-md shadow-2xl shadow-black/50",
      tone === "green" ? "bg-gradient-to-br from-rvm-accent via-rvm-brand to-[#064A42]" : "bg-gradient-to-br from-[#1C3A42] to-rvm-raised",
      className)}>
      <Icon className={cn("h-[38%] w-[38%] text-white", Icon === Heart && "fill-white")} aria-hidden />
    </div>
  );
}

/** Mosaïque d'une playlist : 4 pochettes, sinon la première, sinon une icône. */
export function PlaylistCover({ covers, className, size = 480 }: { covers: string[]; className?: string; size?: 160 | 320 | 480 }) {
  if (covers.length >= 4) {
    return (
      <div className={cn("grid aspect-square grid-cols-2 overflow-hidden rounded-md shadow-2xl shadow-black/50", className)}>
        {covers.slice(0, 4).map((u) => <Cover key={u} url={u} size={size === 480 ? 320 : 160} alt="" rounded="rounded-none" className="w-full" />)}
      </div>
    );
  }
  if (covers[0]) return <Cover url={covers[0]} size={size} alt="" rounded="rounded-md" className={cn("w-full shadow-2xl shadow-black/50", className)} />;
  return <IconTile icon={ListMusic} tone="night" className={className} />;
}

export function CollectionPage({ tint, kicker, title, cover, meta, description, actions, compactActions, children, roundCover = false }: {
  tint: [number, number, number] | null;
  kicker: string;
  title: string;
  cover: ReactNode;
  meta?: ReactNode;
  description?: string | null;
  /** Commandes sous l'en-tête (lecture, aléatoire, enregistrer, menu…). */
  actions: ReactNode;
  /** Bouton de lecture de la barre compacte. */
  compactActions?: ReactNode;
  children: ReactNode;
  roundCover?: boolean;
}) {
  const [r, g, b] = tint ?? DEFAULT_TINT;
  const actionsRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  // Barre compacte : dès que les commandes passent sous la barre (64 px) du panneau.
  // Un écouteur de défilement plutôt qu'un IntersectionObserver : un saut d'un
  // coup (touche Fin, retour en haut) ne lui échappe pas.
  useEffect(() => {
    const el = actionsRef.current;
    const root = document.getElementById("rvm-center");
    if (!el || !root) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      setCompact(el.getBoundingClientRect().bottom <= root.getBoundingClientRect().top + 64);
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    schedule();
    root.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      root.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const style = { "--hdr": `${r} ${g} ${b}` } as CSSProperties;
  return (
    <div style={style}>
      <div aria-hidden={!compact}
        className={cn("sticky top-0 z-20 -mb-16 flex h-16 items-center gap-3 bg-[rgb(var(--hdr))] px-4 shadow-lg shadow-black/20 transition-opacity duration-200 motion-reduce:transition-none @2xl:px-6",
          compact ? "opacity-100" : "pointer-events-none opacity-0")}>
        {compactActions}
        <p className="min-w-0 truncate text-xl font-black tracking-tight text-white">{title}</p>
      </div>

      <header className="px-4 pb-6 pt-20 @2xl:px-6 @2xl:pt-24"
        style={{ background: "linear-gradient(180deg, rgb(var(--hdr)) 0%, color-mix(in srgb, rgb(var(--hdr)) 70%, var(--rvm-surface)) 100%)" }}>
        <div className="flex flex-col gap-5 @xl:flex-row @xl:items-end">
          <div className={cn("w-40 shrink-0 @xl:w-48 @4xl:w-56", roundCover && "overflow-hidden rounded-full")}>{cover}</div>
          <div className="min-w-0 text-white">
            <p className="text-sm font-semibold">{kicker}</p>
            <h1 className="mt-1 line-clamp-3 break-words text-[clamp(2rem,7cqw,5.5rem)] font-black leading-[0.98] tracking-tight">{title}</h1>
            {description ? <p className="mt-3 line-clamp-2 max-w-2xl text-sm text-white/80">{description}</p> : null}
            {meta ? <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-white/90">{meta}</div> : null}
          </div>
        </div>
      </header>

      <div ref={actionsRef} className="flex flex-wrap items-center gap-3 px-4 py-5 @2xl:gap-5 @2xl:px-6"
        style={{ background: "linear-gradient(180deg, color-mix(in srgb, rgb(var(--hdr)) 38%, var(--rvm-surface)) 0%, var(--rvm-surface) 100%)" }}>
        {actions}
      </div>

      <div className="px-2 pb-8 @2xl:px-4">{children}</div>
    </div>
  );
}

/** « Auteur • 12 titres • 41 min 05 s » : chaque morceau seulement s'il existe. */
export function MetaLine({ parts }: { parts: Array<ReactNode | null | false | undefined> }) {
  const shown = parts.filter((p): p is Exclude<typeof p, null | false | undefined> => !!p);
  return (
    <>
      {shown.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {i > 0 ? <span aria-hidden className="text-white/70">•</span> : null}
          {p}
        </span>
      ))}
    </>
  );
}
