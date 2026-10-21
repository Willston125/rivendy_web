"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, Clapperboard, Loader2, Lock, Plus } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry } from "@/features/country/country-provider";
import { useDialogs } from "@/features/ui/dialogs";
import { cn } from "@/lib/utils/cn";
import { fetchMyList, setInMyList } from "./play-api";
import { cover, kindLabel, titleMeta, titlePath, wideImage, type PlayTitle, type WatchProgress } from "./play-logic";

/**
 * Rivendy Play sur le site — briques visuelles (Omnicanal lot C, 2026-10-22).
 * Couleurs de l'app : fond nuit #071719, turquoise #00BFA5 / #5EEAD4.
 */

export function PlayPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-h-screen bg-[#071719] text-slate-100", className)}>
      <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
    </div>
  );
}

export function PlayNav() {
  const links = [
    { href: "/play", label: "Accueil" },
    { href: "/play/movies", label: "Films" },
    { href: "/play/series", label: "Séries" },
    { href: "/play/clips", label: "Clips" },
    { href: "/play/search", label: "Recherche" },
    { href: "/play/my-list", label: "Ma liste" },
    { href: "/play/history", label: "Historique" },
  ];
  return (
    <nav className="mb-6 flex flex-wrap gap-2 text-sm">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="rounded-full bg-white/10 px-3 py-1.5 font-semibold text-white hover:bg-white/15">{l.label}</Link>
      ))}
    </nav>
  );
}

export function Spinner() {
  return <div className="py-10 text-center text-white/60"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;
}

export function Section({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-end justify-between">
        <h2 className="text-xl font-black text-white">{title}</h2>
        {href ? <Link href={href} className="text-sm font-semibold text-[#5EEAD4] hover:underline">Tout voir</Link> : null}
      </div>
      {children}
    </section>
  );
}

export function PremiumBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-[#00BFA5]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#5EEAD4]">
      <Lock className="h-2.5 w-2.5" /> Rivendy+
    </span>
  );
}

function Poster({ url, alt, wide }: { url: string | null; alt: string; wide?: boolean }) {
  if (!url || !url.startsWith("https://")) {
    return (
      <div className={cn("flex w-full items-center justify-center rounded-xl bg-[#0F2A2D] text-[#5EEAD4]", wide ? "aspect-video" : "aspect-[2/3]")}>
        <Clapperboard className="h-1/4 w-1/4" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} loading="lazy" className={cn("w-full rounded-xl object-cover", wide ? "aspect-video" : "aspect-[2/3]")} />
  );
}

/** Carte d'un titre (affiche verticale ; vignette large pour les clips). */
export function TitleCard({ title, rank, progress }: { title: PlayTitle; rank?: number; progress?: number | null }) {
  const wide = title.kind === "clip";
  return (
    <Link href={titlePath(title)} className="group block">
      <div className="relative">
        <Poster url={wide ? wideImage(title) : cover(title)} alt={title.title} wide={wide} />
        {rank ? (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-black/70 px-2 py-0.5 text-sm font-black text-[#5EEAD4]">{rank}</span>
        ) : null}
        {title.is_premium && title.kind !== "clip" ? <span className="absolute right-1.5 top-1.5"><PremiumBadge /></span> : null}
        {progress != null && progress > 0 ? (
          <div className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded bg-white/25">
            <div className="h-full bg-[#00BFA5]" style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }} />
          </div>
        ) : null}
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-bold text-white group-hover:text-[#5EEAD4]">{title.title}</p>
      <p className="line-clamp-1 text-xs text-white/55">
        {title.kind === "clip" && title.artist ? title.artist : titleMeta(title) || kindLabel(title.kind)}
      </p>
    </Link>
  );
}

/** Rangée horizontale (accueil). */
export function TitleRow({ titles, ranked, progressOf }: {
  titles: PlayTitle[]; ranked?: boolean; progressOf?: (t: PlayTitle) => number | null;
}) {
  if (titles.length === 0) return <p className="text-sm text-white/55">Rien pour le moment.</p>;
  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
      {titles.map((t, i) => (
        <div key={t.id} className={cn("shrink-0 snap-start", t.kind === "clip" ? "w-60" : "w-36 sm:w-40")}>
          <TitleCard title={t} rank={ranked ? i + 1 : undefined} progress={progressOf?.(t) ?? null} />
        </div>
      ))}
    </div>
  );
}

/** Grille (catalogues, Ma liste, recherche). */
export function TitleGrid({ titles }: { titles: PlayTitle[] }) {
  if (titles.length === 0) return <p className="text-sm text-white/55">Aucun titre pour le moment.</p>;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {titles.map((t) => <TitleCard key={t.id} title={t} />)}
    </div>
  );
}

/** Part déjà vue d'un titre, d'après les positions du compte. */
export function progressRatio(progress: WatchProgress[], titleId: string): number | null {
  const p = progress.find((x) => x.title_id === titleId);
  return p && p.duration_seconds > 0 ? p.position_seconds / p.duration_seconds : null;
}

/** « Ma liste » : même table que l'app (`play_list`). */
export function MyListButton({ titleId }: { titleId: string }) {
  const { user } = useAuth();
  const { notify } = useDialogs();
  const pathname = usePathname();
  const [inList, setInList] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void fetchMyList().then((ids) => { if (alive) setInList(ids.includes(titleId)); });
    return () => { alive = false; };
  }, [user, titleId]);

  if (!user) {
    return (
      <Link href={`/auth/login?next=${encodeURIComponent(pathname || "/play")}`}
        className="flex h-11 items-center gap-2 rounded-full border border-white/25 px-5 text-sm font-bold text-white hover:bg-white/10">
        <Plus className="h-4 w-4" /> Ma liste
      </Link>
    );
  }
  const on = inList === true;
  return (
    <button type="button" disabled={busy || inList === null}
      onClick={async () => {
        setBusy(true);
        const ok = await setInMyList(titleId, !on);
        setBusy(false);
        if (ok) { setInList(!on); notify(on ? "Retiré de Ma liste." : "Ajouté à Ma liste.", "success"); }
        else notify("Action impossible pour l’instant.", "error");
      }}
      className="flex h-11 items-center gap-2 rounded-full border border-white/25 px-5 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-60">
      {on ? <Check className="h-4 w-4 text-[#5EEAD4]" /> : <Plus className="h-4 w-4" />} Ma liste
    </button>
  );
}

/** Aucun pays connu (visiteur sans compte) : le catalogue dépend du marché. */
export function MarketPrompt() {
  const { countries, setCountryId, loading } = useCountry();
  if (loading) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0B1F21] px-5 py-5">
      <p className="font-bold text-white">Dans quel pays êtes-vous ?</p>
      <p className="mt-1 text-sm text-white/65">Le catalogue de Rivendy Play dépend de votre pays.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {countries.map((c) => (
          <button key={c.id} type="button" onClick={() => void setCountryId(c.id)}
            className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#00BFA5] hover:text-[#071719]">
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}
