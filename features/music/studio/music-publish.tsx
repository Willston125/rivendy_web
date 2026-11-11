"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Disc3, Library, Plus, X } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { artistStatusOf } from "@/features/play/clips/clips-logic";
import { cn } from "@/lib/utils/cn";
import { fetchMyMusicArtist, type MyMusicArtist } from "../music-api";
import { loginHref } from "../music-pending";
import { followMessage, publishPhase } from "./studio-logic";
import { ARTIST_SPACE, NEW_RELEASE_PATH, STUDIO_PATH } from "./studio-paths";

/**
 * « Publier » de Rivendy Musique (lot 0, 2026-11-11, canevas validé) : un
 * bouton en haut de la colonne vert lagon (tablette et ordinateur) et, sur
 * téléphone, un rond citron « + » dans la barre du haut. L'app le met au
 * milieu de sa barre du bas ; sur le site, cette barre a déjà 5 onglets avec
 * la Radio et un 6e ne tient pas sur 375 px (choix du propriétaire, 11/11).
 * La feuille reprend musique_publish_sheet.dart (mêmes cas, mêmes libellés) :
 * sans compte → connexion ; pas encore artiste → « Devenir artiste » ;
 * demande en cours, refusée ou compte suspendu → « Mon espace artiste » ;
 * « clips seulement » → « Mon profil artiste » ; artiste validé → nouvelle
 * sortie, mes sorties. Les stories s'ajouteront avec leur lot (aucun faux
 * bouton).
 */
export function MusicPublishButton({ variant }: { variant: "rail" | "top" }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || "/music";
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => { setOpen(false); }, [pathname]);

  function toggle() {
    // Comme l'app : sans compte, « Publier » mène à la connexion.
    if (!user) { router.push(loginHref(pathname)); return; }
    setOpen((v) => !v);
  }

  const panel = open ? (
    <PublishPanel variant={variant} onClose={() => { setOpen(false); button.current?.focus(); }} />
  ) : null;

  if (variant === "rail") {
    return (
      <>
        <button ref={button} type="button" onClick={toggle} aria-expanded={open} aria-haspopup="dialog"
          className="mx-4 mt-4 flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-rvm-accent text-[15px] font-extrabold text-rvm-on-accent shadow-lg shadow-black/15 transition hover:bg-rvm-accent-hover active:bg-rvm-accent-pressed [@media(max-height:760px)]:h-11">
          <Plus className="h-5 w-5" strokeWidth={2.8} aria-hidden /> Publier
        </button>
        {panel}
      </>
    );
  }
  // Barre du haut du téléphone : le rond citron fait 40 px, la zone de toucher 44 px.
  return (
    <>
      <button ref={button} type="button" onClick={toggle} aria-expanded={open} aria-haspopup="dialog" aria-label="Publier"
        className="group grid h-11 w-11 shrink-0 place-items-center rounded-full md:hidden">
        <span aria-hidden className="grid h-10 w-10 place-items-center rounded-full bg-rvm-accent text-rvm-on-accent shadow-sm shadow-rvm-deep/20 ring-1 ring-rvm-deep/15 transition-colors group-hover:bg-rvm-accent-hover group-active:bg-rvm-accent-pressed">
          <Plus className="h-[22px] w-[22px]" strokeWidth={2.8} />
        </span>
      </button>
      {panel}
    </>
  );
}

/** La coque Musique porte les polices et les jetons : la feuille s'y attache (jamais dans une colonne qui défile). */
function usePortalTarget(): HTMLElement | null {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => { setTarget(document.querySelector<HTMLElement>(".rvm-scope") ?? document.body); }, []);
  return target;
}

function PublishPanel({ variant, onClose }: { variant: "rail" | "top"; onClose: () => void }) {
  const { user } = useAuth();
  const target = usePortalTarget();
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  const [artist, setArtist] = useState<MyMusicArtist | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetchMyMusicArtist(user.id).then(
      (a) => { if (alive) { setArtist(a); setFailed(false); } },
      () => { if (alive) setFailed(true); },
    );
    return () => { alive = false; };
  }, [user, attempt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const status = artistStatusOf(artist?.status);
  const phase = publishPhase({
    signedIn: !!user, loading: artist === undefined && !failed, error: failed, status, musicEnabled: artist?.music_enabled,
  });

  // La première action reçoit le focus une fois le compte lu.
  useEffect(() => { box.current?.querySelector<HTMLElement>("a, button:not([data-close])")?.focus(); }, [phase, target]);

  if (!target) return null;
  // Téléphone : une feuille posée en bas, par-dessus toute la page (navigation du bas comprise).
  const sheet = variant === "top";
  return createPortal(
    <div className="rvm-scope font-rvm-body text-rvm-text">
      <button type="button" aria-label="Fermer" tabIndex={-1} onClick={onClose}
        className="fixed inset-0 z-[70] cursor-default bg-rvm-deep/50" />
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className={cn("fixed z-[71] flex flex-col gap-3 bg-rvm-surface shadow-2xl shadow-rvm-deep/40",
          sheet ? "inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2.5"
            : "left-1/2 top-24 w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 rounded-3xl p-5")}>
        {sheet ? <span aria-hidden className="h-1 w-10 shrink-0 self-center rounded-full bg-rvm-line" /> : null}
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-rvm-display text-[22px] font-black leading-tight">Publier sur Rivendy Musique</h2>
            <p className="mt-1 text-[13px] leading-snug text-rvm-soft">Singles, EP, albums et stories — pour les artistes vérifiés par Rivendy.</p>
          </div>
          <button type="button" data-close onClick={onClose} aria-label="Fermer"
            className="-mr-1.5 -mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-rvm-raised text-rvm-text hover:bg-rvm-raised-hover">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {phase === "loading" ? (
          <div role="status" className="flex items-center justify-center gap-2 py-6 text-sm text-rvm-soft">
            <span aria-hidden className="h-5 w-5 animate-spin rounded-full border-2 border-rvm-line border-t-rvm-ink-accent" /> Vérification de votre compte…
          </div>
        ) : phase === "error" ? (
          <Info text="Impossible de vérifier votre compte artiste. Vérifiez votre connexion.">
            <button type="button" onClick={() => { setFailed(false); setArtist(undefined); setAttempt((n) => n + 1); }} className={actionClass}>Réessayer</button>
          </Info>
        ) : phase === "become" ? (
          <Info text="Pour publier votre musique, demandez d’abord votre compte artiste : Rivendy le vérifie (nom, droits sur votre musique), puis vous publiez singles, albums et stories.">
            <Link href={`${ARTIST_SPACE}#demande`} onClick={onClose} className={actionClass}>Devenir artiste</Link>
          </Info>
        ) : phase === "follow" ? (
          <Info text={followMessage(status, artist?.review_reason)}>
            <Link href={ARTIST_SPACE} onClick={onClose} className={actionClass}>Mon espace artiste</Link>
          </Info>
        ) : phase === "enable" ? (
          <Info text="Vous avez choisi « clips seulement ». Activez Rivendy Musique dans votre profil artiste pour publier vos singles, EP, albums et stories.">
            <Link href={`${ARTIST_SPACE}#profil`} onClick={onClose} className={actionClass}>Mon profil artiste</Link>
          </Info>
        ) : (
          <nav aria-label="Publier sur Rivendy Musique" className="flex flex-col gap-2">
            <Option href={NEW_RELEASE_PATH} onClick={onClose} icon={<Disc3 className="h-[22px] w-[22px]" aria-hidden />}
              title="Nouvelle sortie" text="Single, EP ou album : vos fichiers, une pochette, puis Rivendy vérifie et publie." />
            <Option href={STUDIO_PATH} onClick={onClose} icon={<Library className="h-[22px] w-[22px]" aria-hidden />}
              title="Mes sorties" text="Brouillons, en vérification, en ligne." />
          </nav>
        )}
      </div>
    </div>,
    target,
  );
}

const actionClass = "flex h-[50px] w-full items-center justify-center rounded-full bg-rvm-accent text-[15px] font-extrabold text-rvm-on-accent transition hover:bg-rvm-accent-hover";

function Info({ text, children }: { text: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-[15px] leading-relaxed text-rvm-soft">{text}</p>
      {children}
    </div>
  );
}

function Option({ href, onClick, icon, title, text }: { href: string; onClick: () => void; icon: ReactNode; title: string; text: string }) {
  return (
    <Link href={href} onClick={onClick}
      className="flex items-center gap-3 rounded-2xl bg-rvm-raised p-3 text-rvm-text transition-colors hover:bg-rvm-raised-hover">
      <span aria-hidden className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl bg-rvm-accent text-rvm-on-accent">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-bold">{title}</span>
        <span className="text-[13px] leading-snug text-rvm-soft">{text}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-rvm-muted" aria-hidden />
    </Link>
  );
}
