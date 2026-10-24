"use client";

import type { RefObject } from "react";
import Link from "next/link";
import { Check, Smartphone, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { PlayMark, useHomeHref } from "./play-brand";
import { PLAY_STORE_URL } from "./play-link-page";
import { btnPrimary, btnSecondary, display, motion } from "./play-theme";

/** Pied de page de Rivendy Play : discret, une ligne sur grand écran. */
export function PlayFooter({ onAbout }: { onAbout: () => void }) {
  const homeHref = useHomeHref();
  const year = new Date().getFullYear();
  const links = [
    { href: homeHref, label: "La marketplace" },
    { href: "/music", label: "Rivendy Musique" },
    { href: "/help", label: "Aide" },
    { href: "/legal?tab=cgu", label: "Conditions" },
    { href: "/legal?tab=privacy", label: "Confidentialité" },
  ];
  return (
    <footer className="mx-auto mt-16 w-full max-w-[1480px] px-4 sm:px-6 xl:px-8">
      {/* Une ligne quand la place le permet ; sinon les liens passent dessous, jamais un texte coupé en deux. */}
      <div className="flex flex-col gap-3 border-t border-rvp-line py-6 text-[13px] text-rvp-muted lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-x-8 lg:gap-y-2">
        <p className="whitespace-nowrap">© {year} Rivendy Play</p>
        <p className="whitespace-nowrap text-rvp-soft">Films. Séries. Talents de chez nous.</p>
        <nav aria-label="Liens du site">
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {links.map((l) => (
              <li key={l.label}>
                <Link href={l.href} prefetch={false} className={cn("inline-block py-1.5 hover:text-rvp-text", motion)}>{l.label}</Link>
              </li>
            ))}
            <li>
              <button type="button" onClick={onAbout} aria-haspopup="dialog" className={cn("inline-flex items-center gap-1.5 py-1.5 hover:text-rvp-text", motion)}>
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-rvp-accent shadow-rvp-dot" /> À propos de Play
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}

/** « À propos de Play » : fenêtre native (Échap ou clic à côté la referment). */
export function AboutDialog({ dialogRef }: { dialogRef: RefObject<HTMLDialogElement | null> }) {
  const close = () => dialogRef.current?.close();
  const facts = [
    "Un seul compte : Ma liste, la reprise de lecture et vos récents vous suivent, sur le site comme dans l’application.",
    "Les clips des artistes sont toujours gratuits.",
    "Le catalogue dépend de votre pays.",
  ];
  return (
    <dialog ref={dialogRef} aria-labelledby="rvp-apropos"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
      className="m-auto w-[min(92vw,32rem)] max-w-none overflow-hidden rounded-rvp-hero border border-rvp-edge bg-rvp-surface p-0 text-rvp-text shadow-rvp-deep backdrop:bg-black/75 backdrop:backdrop-blur-sm">
      <div className="relative isolate p-6 sm:p-8">
        <span aria-hidden className="rvp-halo-top pointer-events-none absolute inset-x-0 top-0 -z-10 h-56" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <PlayMark prefix="Rivendy" className="text-[11px] tracking-[0.32em]" />
            <h2 id="rvp-apropos" className={cn(display, "mt-4 text-[30px] leading-[1.05]")}>
              Votre cinéma. <span className="text-rvp-accent">Votre univers.</span>
            </h2>
            <p className="mt-2 text-sm text-rvp-muted">Des histoires de chez nous.</p>
          </div>
          <button type="button" onClick={close} aria-label="Fermer"
            className={cn("-mr-2 -mt-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-rvp-muted hover:bg-white/[0.06] hover:text-rvp-text", motion)}>
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <p className="mt-5 text-[15px] leading-7 text-rvp-soft">
          Des films, des séries et des clips d’artistes — des histoires d’ici, des Comores, d’Afrique et de l’océan Indien —, à regarder sur le site et dans l’application Rivendy.
        </p>
        <ul className="mt-5 space-y-3">
          {facts.map((f) => (
            <li key={f} className="flex gap-3 text-sm leading-6 text-rvp-soft">
              <Check className="mt-1 h-4 w-4 shrink-0 text-rvp-accent" aria-hidden /> {f}
            </li>
          ))}
        </ul>
        <div className="mt-7 flex flex-wrap gap-3">
          <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" className={cn(btnPrimary, "h-11 text-sm")}>
            <Smartphone className="h-4 w-4" aria-hidden /> Application Android
          </a>
          <Link href="/help" prefetch={false} onClick={close} className={cn(btnSecondary, "h-11 text-sm")}>
            Aide
          </Link>
        </div>
        <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-1 border-t border-rvp-edge pt-4 text-[13px] text-rvp-muted">
          {[
            { href: "/music", label: "Rivendy Musique" },
            { href: "/droits-auteur", label: "Droits d’auteur" },
            { href: "/legal?tab=cgu", label: "Conditions" },
            { href: "/legal?tab=privacy", label: "Confidentialité" },
          ].map((l) => (
            <li key={l.href}>
              <Link href={l.href} prefetch={false} onClick={close} className={cn("inline-block py-1.5 hover:text-rvp-text", motion)}>{l.label}</Link>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  );
}
