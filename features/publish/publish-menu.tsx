"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronRight, Clapperboard, Disc3, Lock, Plus, Smartphone, Tag, X } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { fetchMyMusicArtist, type MyMusicArtist } from "@/features/music/music-api";
import { ARTIST_SPACE, NEW_RELEASE_PATH } from "@/features/music/studio/studio-paths";
import { artistStatusOf } from "@/features/play/clips/clips-logic";
import { CLIP_NEW_PATH, SHORT_NEW_PATH } from "@/features/play/create/create-paths";
import { cn } from "@/lib/utils/cn";

/**
 * « + Publier » de la marketplace (lot 0, 2026-11-11, canevas validé) : visible
 * à toutes les tailles. Avant, « Vendre » n'apparaissait qu'au-dessus de
 * 1280 px : sur téléphone et tablette il fallait le trouver dans le menu ☰, et
 * un utilisateur d'iPhone (pas d'application iOS) ne savait pas qu'il pouvait
 * publier ici. Sur téléphone, une feuille en bas de l'écran ; au-dessus, un
 * menu sous le bouton. Seulement ce qui marche sur le site (aucun faux
 * bouton) : un article (/sell), un Short (lot 4), une sortie musicale
 * (studio, ou demande de compte artiste) et un clip (lot 3, artiste validé).
 * Les stories s'ajouteront avec leur lot.
 */
export function PublishMenu() {
  const { user, loading } = useAuth();
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [artist, setArtist] = useState<MyMusicArtist | null | undefined>(undefined);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Changement de page : le menu se referme.
  useEffect(() => { setOpen(false); }, [pathname]);

  // Le compte artiste n'est lu qu'à l'ouverture : aucune requête de plus à chaque page.
  useEffect(() => {
    if (!open || !user || artist !== undefined) return;
    let alive = true;
    fetchMyMusicArtist(user.id).then((a) => { if (alive) setArtist(a); }, () => { if (alive) setArtist(null); });
    return () => { alive = false; };
  }, [open, user, artist]);
  useEffect(() => { setArtist(undefined); }, [user?.id]);

  // Échap referme et rend la main au bouton ; sur téléphone, la page ne défile plus derrière la feuille.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    const phone = window.matchMedia("(max-width: 767px)").matches;
    const html = document.documentElement;
    const overflow = html.style.overflow;
    if (phone) html.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("nav a")?.focus();
    return () => { document.removeEventListener("keydown", onKey); if (phone) html.style.overflow = overflow; };
  }, [open]);

  const status = artistStatusOf(artist?.status);
  const canPublishMusic = status === "approved" && artist?.music_enabled !== false;
  const musicHref = canPublishMusic ? NEW_RELEASE_PATH : ARTIST_SPACE;
  // Les clips restent ouverts à un artiste validé en « clips seulement ».
  const canPublishClip = status === "approved";
  const close = () => setOpen(false);

  return (
    <div className="relative mr-0.5">
      <button ref={button} type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="dialog"
        className={cn("flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-extrabold text-white shadow-sm shadow-[#009688]/30 transition",
          open ? "bg-[#00796B] ring-4 ring-[#B2DFDB]" : "bg-[#009688] hover:bg-[#00796B]")}>
        <Plus className="h-[18px] w-[18px]" strokeWidth={2.6} aria-hidden />
        Publier
      </button>

      {open ? (
        <>
          <button type="button" aria-label="Fermer" tabIndex={-1} onClick={close}
            className="fixed inset-0 z-[60] cursor-default bg-slate-900/50 md:z-40 md:bg-transparent" />
          <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId}
            className={cn("fixed inset-x-0 bottom-0 z-[61] flex max-h-[88dvh] flex-col gap-3 overflow-y-auto rounded-t-3xl bg-white px-4 pt-2.5 shadow-[0_-18px_40px_-20px_rgba(15,23,42,0.45)]",
              "pb-[max(1.75rem,env(safe-area-inset-bottom))]",
              "md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-full md:z-50 md:mt-2 md:max-h-none md:w-[400px] md:gap-1.5 md:rounded-2xl md:border md:border-slate-200 md:p-2.5 md:shadow-xl md:shadow-slate-300/40")}>
            <span aria-hidden className="h-1 w-10 shrink-0 self-center rounded-full bg-slate-300 md:hidden" />
            <div className="flex items-start gap-2 md:px-2 md:pt-1">
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="text-xl font-extrabold tracking-tight text-slate-900 md:text-[13px] md:font-extrabold md:uppercase md:tracking-[0.06em] md:text-slate-500">
                  Que voulez-vous publier ?
                </h2>
                <p className="mt-1 text-sm leading-snug text-slate-500 md:hidden">Un seul compte Rivendy, sur le site comme dans l’application.</p>
              </div>
              <button type="button" onClick={close} aria-label="Fermer"
                className="-mr-1.5 -mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-700 md:hidden">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            {!loading && !user ? (
              <div className="flex items-center gap-3 rounded-2xl border border-[#B2DFDB] bg-[#E0F2F1] py-2.5 pl-3.5 pr-2.5">
                <p className="min-w-0 flex-1 text-sm leading-snug text-teal-950"><strong>Connectez-vous pour publier.</strong> Le même compte que dans l’application.</p>
                <Link href={`/auth/login?next=${encodeURIComponent(pathname)}`} prefetch={false} onClick={close}
                  className="flex h-11 shrink-0 items-center rounded-full bg-[#009688] px-4 text-sm font-extrabold text-white hover:bg-[#00796B]">
                  Se connecter
                </Link>
              </div>
            ) : null}

            <nav aria-label="Publier" className="flex flex-col gap-2 md:gap-1">
              <PublishEntry href="/sell" onClick={close} tone="market" icon={<Tag className="h-[22px] w-[22px]" aria-hidden />}
                title="Un article à vendre" text="Photos, prix et vidéo de 15 s. Vérifié par Rivendy sous 24 h." />
              <PublishEntry href={SHORT_NEW_PATH} onClick={close} tone="play" icon={<Smartphone className="h-[22px] w-[22px]" aria-hidden />}
                title="Un Short" text="Une vidéo de 30 s au plus : pour un de vos articles, ou un Short libre." />
              <PublishEntry href={musicHref} onClick={close} tone="music" icon={<Disc3 className="h-[22px] w-[22px]" aria-hidden />}
                title="Une sortie musicale"
                text={canPublishMusic ? "Single, EP ou album, vérifié par Rivendy avant la mise en ligne." : "Single, EP ou album. Demandez d’abord votre compte artiste."}
                locked={!canPublishMusic} />
              <PublishEntry href={canPublishClip ? CLIP_NEW_PATH : ARTIST_SPACE} onClick={close} tone="clips"
                icon={<Clapperboard className="h-[22px] w-[22px]" aria-hidden />}
                title="Un clip musical"
                text={canPublishClip ? "Jusqu’à 10 min, gratuit pour tous sur Rivendy Clips." : "Jusqu’à 10 min. Demandez d’abord votre compte artiste."}
                locked={!canPublishClip} />
            </nav>

            {user ? (
              <div className="flex justify-center gap-6 text-sm font-bold md:justify-between md:border-t md:border-slate-100 md:px-2 md:pt-1">
                <Link href="/seller" onClick={close} className="flex min-h-11 items-center text-[#009688] hover:text-[#00796B]">Mon espace vendeur</Link>
                <Link href={ARTIST_SPACE} onClick={close} className="flex min-h-11 items-center text-[#009688] hover:text-[#00796B]">Mon espace artiste</Link>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

const TONES = {
  market: "bg-[#E0F2F1] text-[#009688]",
  music: "bg-[#EEFFB5] text-[#063F3B]",
  play: "bg-[#04120D] text-[#00D6A3]",
  clips: "bg-[#161E22] text-[#1CC8B4]",
} as const;

function PublishEntry({ href, onClick, tone, icon, title, text, locked = false }: {
  href: string; onClick: () => void; tone: keyof typeof TONES; icon: ReactNode; title: string; text: string; locked?: boolean;
}) {
  return (
    <Link href={href} onClick={onClick}
      className="flex min-h-[68px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 transition hover:border-[#B2DFDB] hover:bg-slate-50 md:min-h-0 md:rounded-[14px] md:border-transparent md:p-2.5">
      <span aria-hidden className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl md:h-10 md:w-10", TONES[tone])}>
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-bold md:text-sm">{title}</span>
        <span className="text-[13px] leading-snug text-slate-500 md:text-[12.5px]">{text}</span>
      </span>
      {locked ? (
        <span className="inline-flex h-[26px] shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2.5 text-xs font-bold text-slate-600">
          <Lock className="h-3 w-3" strokeWidth={2.6} aria-hidden /> Artiste
        </span>
      ) : <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />}
    </Link>
  );
}
