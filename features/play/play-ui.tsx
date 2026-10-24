"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Clapperboard, Loader2, Lock, Plus, type LucideIcon } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry } from "@/features/country/country-provider";
import { cn } from "@/lib/utils/cn";
import type { KindFilter, PlayTitle, WatchProgress } from "./play-logic";
import { usePlayList } from "./play-list";
import { btnSecondary, display, eyebrow, motion } from "./play-theme";

/**
 * Rivendy Play sur le site — briques de mise en page (« Emerald Cinema »,
 * 2026-10-24) : page, en-têtes de rubrique, rangées défilantes, grilles,
 * états de chargement, vides et d'erreur. Les cartes vivent dans
 * play-cards.tsx, la bannière dans play-hero.tsx. Couleurs, rayons, ombres
 * et durées : jetons de app/site.css, assemblés par play-theme.ts.
 */

/**
 * Contenu d'une page Play, dans le panneau central. Conteneur de requêtes
 * (`@container`) : grilles et rangées se règlent sur la largeur RÉELLE du
 * panneau (le menu latéral la réduit), pas sur celle de la fenêtre.
 */
export function PlayPage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("@container mx-auto w-full max-w-[1480px] px-4 pb-6 pt-4 sm:px-6 md:pt-2 xl:px-8", className)}>{children}</div>;
}

/** En-tête d'une page (Films, Séries, Clips, Ma liste…) : « RIVENDY PLAY », grand titre, présentation. */
export function PageHeading({ title, intro, count, unit = "titre", kicker = "Rivendy Play", icon: Icon, children }: {
  title: string; intro?: string; count?: number | null; unit?: string; kicker?: string; icon?: LucideIcon; children?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4 pt-3 lg:mb-9 lg:pt-5">
      <div className="min-w-0">
        <p className={cn(eyebrow, "flex items-center gap-2 text-rvp-accent")}>
          {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
          {kicker}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-3">
          <h1 className={cn(display, "text-[34px] leading-none text-rvp-text sm:text-[46px]")}>{title}</h1>
          {count != null ? <CountChip n={count} unit={unit} /> : null}
        </div>
        {intro ? <p className="mt-3 max-w-2xl text-[15px] leading-6 text-rvp-soft">{intro}</p> : null}
      </div>
      {children}
    </header>
  );
}

/** Pastille « 3 titres » d'un en-tête de rubrique. */
export function CountChip({ n, unit = "titre" }: { n: number; unit?: string }) {
  return (
    <span className="rounded-md border border-rvp-edge bg-rvp-surface/60 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-rvp-soft">
      {n} {unit}{n > 1 ? "s" : ""}
    </span>
  );
}

export function Spinner({ label = "Chargement…" }: { label?: string }) {
  return (
    <div role="status" className="py-16 text-center text-rvp-muted">
      <Loader2 className="mx-auto h-7 w-7 animate-spin text-rvp-accent motion-reduce:animate-none" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon = Clapperboard, title, text, children }: {
  icon?: LucideIcon; title: string; text?: string; children?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-14 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-rvp-accent/10 text-rvp-accent shadow-rvp-active ring-1 ring-rvp-edge-strong">
        <Icon className="h-7 w-7" aria-hidden />
      </span>
      <h2 className={cn(display, "mt-5 text-[22px] font-bold text-rvp-text")}>{title}</h2>
      {text ? <p className="mt-2 text-sm leading-6 text-rvp-soft">{text}</p> : null}
      {children ? <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div> : null}
    </div>
  );
}

export function ErrorState({ text = "Impossible de charger Rivendy Play. Vérifiez votre connexion.", onRetry }: { text?: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-rvp-hero border border-rvp-edge bg-rvp-surface/60">
      <EmptyState icon={AlertTriangle} title="Chargement impossible" text={text}>
        <button type="button" onClick={onRetry} className={btnSecondary}>Réessayer</button>
      </EmptyState>
    </div>
  );
}

/** Rivendy+ : l'or est réservé à cette marque (comme dans la Musique). */
export function PremiumBadge({ solid }: { solid?: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-rvp-premium",
      solid ? "bg-black/75 ring-1 ring-rvp-premium/40" : "bg-rvp-premium/10 ring-1 ring-rvp-premium/30",
    )}>
      <Lock className="h-3 w-3" aria-hidden /> Rivendy+
    </span>
  );
}

/** « Ma liste » en grand bouton (bannière, fiche). */
export function ListButton({ title, className }: { title: Pick<PlayTitle, "id" | "title">; className?: string }) {
  const list = usePlayList();
  const on = list.has(title.id);
  return (
    <button type="button" aria-pressed={on} disabled={list.busy(title.id)}
      onClick={() => void list.toggle(title.id, title.title)} className={cn(btnSecondary, className)}>
      {list.busy(title.id) ? <Loader2 className="h-[18px] w-[18px] animate-spin motion-reduce:animate-none" aria-hidden />
        : on ? <Check className="h-[18px] w-[18px] text-rvp-accent" aria-hidden /> : <Plus className="h-[18px] w-[18px]" aria-hidden />}
      {on ? "Dans ma liste" : "Ma liste"}
    </button>
  );
}

/** Part déjà vue d'un titre, d'après les positions du compte. */
export function progressRatio(progress: WatchProgress[], titleId: string): number | null {
  const p = progress.find((x) => x.title_id === titleId);
  return p && p.duration_seconds > 0 ? p.position_seconds / p.duration_seconds : null;
}

// ── Rangées et grilles ─────────────────────────────────────────────────────

/** Formes des cartes : 4:3 (catalogue), 16:9 (reprise, clips), 2:3 (affiches classées). */
export type RowLayout = "card" | "wide" | "poster";

// Largeurs réglées sur le panneau central (@container de PlayPage), écrites en entier : Tailwind les lit.
const ROW_COLS: Record<RowLayout, string> = {
  card:
    "auto-cols-[62%] gap-3 @min-[40rem]:auto-cols-[calc((100%_-_2rem)/3.2)] @min-[40rem]:gap-4 @min-[56rem]:auto-cols-[calc((100%_-_3.75rem)/4)] @min-[56rem]:gap-5 @min-[80rem]:auto-cols-[calc((100%_-_5rem)/5)]",
  wide:
    "auto-cols-[82%] gap-3 @min-[40rem]:auto-cols-[calc((100%_-_1rem)/2.15)] @min-[40rem]:gap-4 @min-[56rem]:auto-cols-[calc((100%_-_2.5rem)/3)] @min-[56rem]:gap-5 @min-[80rem]:auto-cols-[calc((100%_-_3.75rem)/4)]",
  poster:
    "auto-cols-[40%] gap-3 @min-[40rem]:auto-cols-[calc((100%_-_3rem)/4.3)] @min-[40rem]:gap-4 @min-[56rem]:auto-cols-[calc((100%_-_6.25rem)/6)] @min-[56rem]:gap-5 @min-[80rem]:auto-cols-[calc((100%_-_7.5rem)/7)]",
};

/**
 * Rangée horizontale (MediaRow) : glissement au doigt (accroché à chaque
 * carte), flèches sur ordinateur, défilement au clavier par la tabulation. Ne
 * déborde jamais du panneau : seule la rangée défile. Un peu d'air en haut et
 * en bas pour le léger agrandissement des cartes au survol.
 */
export function MediaRow({ label, layout, children }: { label: string; layout: RowLayout; children: ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const start = el.scrollLeft <= 4;
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    setEdges((e) => (e.start === start && e.end === end ? e : { start, end }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onScroll) : null;
    ro?.observe(el);
    onScroll();
    return () => { cancelAnimationFrame(frame); el.removeEventListener("scroll", onScroll); ro?.disconnect(); };
  }, [measure]);

  const go = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: smooth ? "smooth" : "auto" });
  };

  const arrow = "absolute bottom-4 top-2 z-20 hidden w-14 items-center justify-center text-white [@media(hover:hover)]:flex";
  return (
    <div className="relative">
      <ul ref={ref} aria-label={label}
        className={cn(
          "no-scrollbar -mx-4 grid snap-x snap-mandatory grid-flow-col overflow-x-auto overscroll-x-contain scroll-px-4 px-4 pb-4 pt-2 sm:-mx-6 sm:scroll-px-6 sm:px-6 xl:-mx-8 xl:scroll-px-8 xl:px-8",
          ROW_COLS[layout],
        )}>
        {children}
      </ul>
      {!edges.start ? (
        <button type="button" onClick={() => go(-1)} aria-label={`${label} : titres précédents`}
          className={cn(arrow, "-left-4 bg-gradient-to-r from-rvp-ground via-rvp-ground/70 to-transparent sm:-left-6 xl:-left-8")}>
          <ChevronLeft className="h-8 w-8 drop-shadow" aria-hidden />
        </button>
      ) : null}
      {!edges.end ? (
        <button type="button" onClick={() => go(1)} aria-label={`${label} : titres suivants`}
          className={cn(arrow, "-right-4 bg-gradient-to-l from-rvp-ground via-rvp-ground/70 to-transparent sm:-right-6 xl:-right-8")}>
          <ChevronRight className="h-8 w-8 drop-shadow" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export function MediaRowItem({ children }: { children: ReactNode }) {
  return <li className="min-w-0 snap-start">{children}</li>;
}

/** En-tête de rubrique : titre, « 3 titres », puis à droite « Tout voir » ou des filtres. */
export function SectionHeader({ id, title, count, href, total, unit, children }: {
  id: string; title: string; count?: number; href?: string; total?: number; unit?: string; children?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 lg:mb-4">
      <div className="flex min-w-0 items-center gap-3">
        <h2 id={id} className={cn(display, "truncate text-[22px] font-bold text-rvp-text sm:text-[24px]")}>{title}</h2>
        {count != null ? <CountChip n={total ?? count} unit={unit} /> : null}
      </div>
      {children}
      {href ? (
        <Link href={href} className={cn("inline-flex h-10 shrink-0 items-center gap-1 rounded-rvp px-2 text-sm font-semibold text-rvp-soft hover:text-rvp-accent", motion)}>
          Tout voir <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

export function Section({ id, title, count, href, total, unit, children, className, actions }: {
  id: string; title: string; count?: number; href?: string; total?: number; unit?: string; children: ReactNode; className?: string; actions?: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cn("mt-10 lg:mt-12", className)}>
      <SectionHeader id={id} title={title} count={count} href={href} total={total} unit={unit}>{actions}</SectionHeader>
      {children}
    </section>
  );
}

const KIND_LABELS: Record<KindFilter, string> = { all: "Tout", film: "Films", serie: "Séries" };

/** Filtre « Tout / Films / Séries » : un groupe de boutons à bascule. */
export function KindSwitch({ label, options, value, onChange }: {
  label: string; options: KindFilter[]; value: KindFilter; onChange: (v: KindFilter) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-rvp border border-rvp-edge bg-rvp-surface/60 p-1 backdrop-blur-md">
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={value === o} onClick={() => onChange(o)}
          className={cn("h-9 min-w-14 rounded-[10px] px-3.5 text-[13px] font-semibold", motion,
            value === o ? "bg-rvp-raised text-rvp-text shadow-rvp-active ring-1 ring-inset ring-rvp-edge-strong" : "text-rvp-muted hover:text-rvp-text")}>
          {KIND_LABELS[o]}
        </button>
      ))}
    </div>
  );
}

/**
 * Grille des cartes 4:3 (largeur du panneau central) : de 2 à 5 colonnes.
 * `few` (trois titres au plus) : de grandes cartes — une par ligne sur
 * téléphone, trois au plus ensuite —, plutôt qu'une grille presque vide.
 */
export function MediaGrid({ children, few }: { children: ReactNode; few?: boolean }) {
  return (
    <ul className={cn("grid gap-3 @min-[40rem]:gap-4 @min-[56rem]:gap-5",
      few ? "grid-cols-1 @min-[30rem]:grid-cols-2 @min-[48rem]:grid-cols-3"
        : "grid-cols-2 @min-[40rem]:grid-cols-3 @min-[56rem]:grid-cols-4 @min-[80rem]:grid-cols-5")}>
      {children}
    </ul>
  );
}

/** « Peu de titres » : la grille passe en grandes cartes. */
export const FEW_TITLES = 3;
/** Grille des cartes 16:9 (clips, résultats de clips). */
export function WideGrid({ children }: { children: ReactNode }) {
  return <ul className="grid grid-cols-1 gap-4 @min-[36rem]:grid-cols-2 @min-[56rem]:grid-cols-3 @min-[56rem]:gap-5 @min-[80rem]:grid-cols-4">{children}</ul>;
}

// ── Chargement ─────────────────────────────────────────────────────────────

const SHAPE: Record<RowLayout, string> = { card: "aspect-[4/3]", wide: "aspect-video", poster: "aspect-[2/3]" };

export function RowSkeleton({ layout }: { layout: RowLayout }) {
  return (
    <div aria-hidden className="mt-10 lg:mt-12">
      <div className="rvp-skeleton mb-4 h-7 w-48 rounded-md" />
      <div className={cn("grid grid-flow-col overflow-hidden", ROW_COLS[layout])}>
        {Array.from({ length: layout === "poster" ? 7 : 5 }, (_, i) => <div key={i} className={cn("rvp-skeleton rounded-rvp-card", SHAPE[layout])} />)}
      </div>
    </div>
  );
}

export function GridSkeleton({ layout, count }: { layout: RowLayout; count?: number }) {
  const n = count ?? (layout === "wide" ? 6 : 8);
  const items = Array.from({ length: n }, (_, i) => <li key={i} className={cn("rvp-skeleton rounded-rvp-card", SHAPE[layout])} />);
  return <div aria-hidden>{layout === "wide" ? <WideGrid>{items}</WideGrid> : <MediaGrid>{items}</MediaGrid>}</div>;
}

// ── Compte et marché ───────────────────────────────────────────────────────

/** Lien de connexion qui ramène sur la page courante. */
export function useLoginHref(): string {
  const pathname = usePathname();
  return `/auth/login?next=${encodeURIComponent(pathname || "/play")}`;
}

/** Invitation discrète à se connecter (reprise, Ma liste). */
export function LoginNote({ text }: { text: string }) {
  const href = useLoginHref();
  const { user, loading } = useAuth();
  if (loading || user) return null;
  return (
    <div className="relative isolate mt-10 flex flex-col gap-4 overflow-hidden rounded-rvp-panel border border-rvp-edge bg-gradient-to-r from-rvp-surface via-rvp-surface/70 to-rvp-ground px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:mt-12 lg:px-7">
      <span aria-hidden className="rvp-halo-top absolute inset-0 -z-10" />
      <p className="text-sm leading-6 text-rvp-soft sm:text-[15px]">{text}</p>
      <Link href={href} prefetch={false} className={cn(btnSecondary, "shrink-0")}>Se connecter</Link>
    </div>
  );
}

/**
 * Le marché arrive bientôt (compte ou liste des pays en cours de lecture) :
 * la page montre son squelette plutôt que la question du pays.
 */
export function useMarketPending(): boolean {
  const { user, loading } = useAuth();
  const { loading: countryLoading } = useCountry();
  return !!user || loading || countryLoading;
}

/** Aucun pays connu (visiteur sans compte) : le catalogue dépend du marché. */
export function MarketPrompt() {
  const { countries, setCountryId, loading } = useCountry();
  if (loading) return <Spinner />;
  return (
    <div className="rvp-glass mx-auto mt-4 max-w-3xl rounded-rvp-hero px-5 py-6 sm:px-8 sm:py-8">
      <p className={cn(eyebrow, "text-rvp-accent")}>Rivendy Play</p>
      <h2 className={cn(display, "mt-2 text-[26px] font-bold text-rvp-text")}>Dans quel pays êtes-vous ?</h2>
      <p className="mt-1 text-sm text-rvp-soft">Le catalogue de Rivendy Play dépend de votre pays.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {countries.map((c) => (
          <button key={c.id} type="button" onClick={() => void setCountryId(c.id)}
            className={cn("h-11 rounded-full border border-white/12 bg-white/[0.04] px-4 text-sm font-semibold text-rvp-text hover:border-rvp-accent hover:bg-rvp-accent hover:text-rvp-on-accent", motion)}>
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Puces de filtre (genres, saisons) : un état clair, cibles de 40 px. */
export function FilterChips<T extends string | number>({ label, options, value, onChange, allLabel }: {
  label: string; options: Array<{ value: T; label: string }>; value: T | null; onChange: (v: T | null) => void; allLabel?: string;
}) {
  const chip = (active: boolean) => cn(
    "h-10 shrink-0 rounded-full border px-4 text-sm font-semibold", motion,
    active ? "border-rvp-edge-strong bg-rvp-accent/15 text-rvp-accent shadow-rvp-active" : "border-white/10 bg-rvp-surface/60 text-rvp-soft hover:border-white/20 hover:text-rvp-text",
  );
  return (
    <div role="group" aria-label={label} className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
      {allLabel ? (
        <button type="button" aria-pressed={value === null} onClick={() => onChange(null)} className={chip(value === null)}>{allLabel}</button>
      ) : null}
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)} className={chip(value === o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
