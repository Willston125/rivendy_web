"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight, Info, MicVocal, Plus, SquarePlay, Tag, Video, type LucideIcon } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { cn } from "@/lib/utils/cn";
import { motion } from "../play-theme";
import { CLIP_SPACE_PATH, MY_SHORTS_PATH, SHORT_NEW_PATH } from "./create-paths";
import { PlayPopover, PlaySheet } from "./play-sheet";

/**
 * « Créer » de Rivendy Play (lot 4, 2026-11-11, canevas validé) : le bouton
 * du milieu de l'app (play_create_sheet.dart), mêmes entrées, mêmes textes.
 * En tête de la colonne sur tablette et ordinateur ; rond « + » dans la barre
 * du haut sur téléphone (la barre du bas a déjà 5 onglets, comme pour la
 * Musique). Sans compte, il mène à la connexion, comme l'app. « Faire un
 * live » (« Bientôt » dans l'app) n'est pas repris : aucun faux bouton.
 */
export function PlayCreateButton({ variant }: { variant: "rail" | "top" }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || "/play";
  const [open, setOpen] = useState<{ left: number; top: number } | "sheet" | null>(null);
  const button = useRef<HTMLButtonElement>(null);

  // Changement de page : le menu se referme.
  useEffect(() => { setOpen(null); }, [pathname]);

  function toggle() {
    if (!user) {
      router.push(`/auth/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (open) {
      setOpen(null);
      return;
    }
    const r = button.current?.getBoundingClientRect();
    if (variant === "rail" && r) setOpen({ left: r.right + 10, top: Math.max(12, Math.min(r.top, window.innerHeight - 450)) });
    else setOpen("sheet");
  }
  const close = () => setOpen(null);
  const menu = <CreateOptions onPick={close} />;

  return (
    <>
      {variant === "rail" ? (
        <button ref={button} type="button" onClick={toggle} aria-expanded={!!open} aria-haspopup="dialog"
          className={cn("flex h-12 w-full items-center justify-center gap-2 rounded-rvp bg-rvp-accent text-[15px] font-extrabold text-rvp-on-accent shadow-rvp-cta hover:bg-rvp-accent-hover active:bg-rvp-accent-pressed", motion,
            open && "ring-4 ring-rvp-accent/30")}>
          <Plus className="h-5 w-5 shrink-0" strokeWidth={2.8} aria-hidden />
          <span className="sr-only xl:not-sr-only">Créer</span>
        </button>
      ) : (
        <button ref={button} type="button" onClick={toggle} aria-expanded={!!open} aria-haspopup="dialog" aria-label="Créer"
          className="group grid h-11 w-11 shrink-0 place-items-center rounded-full">
          <span aria-hidden className="grid h-[38px] w-[38px] place-items-center rounded-full bg-rvp-accent text-rvp-on-accent shadow-[0_6px_16px_-6px_var(--rvp-accent)] transition-colors group-hover:bg-rvp-accent-hover group-active:bg-rvp-accent-pressed">
            <Plus className="h-[21px] w-[21px]" strokeWidth={2.8} />
          </span>
        </button>
      )}
      {open === "sheet" ? (
        <PlaySheet title="Créer sur Rivendy" subtitle="Un seul compte pour vendre et publier." onClose={close}>{menu}</PlaySheet>
      ) : open ? (
        <PlayPopover position={open} label="Créer sur Rivendy" onClose={close}>
          <p className="px-2 pb-2 pt-1 text-[12px] font-extrabold uppercase tracking-[0.08em] text-rvp-soft">Créer sur Rivendy</p>
          {menu}
        </PlayPopover>
      ) : null}
    </>
  );
}

/** Les entrées de « Créer sur Rivendy » (feuille sur téléphone, menu ancré au-dessus). */
export function CreateOptions({ onPick }: { onPick: () => void }) {
  return (
    <>
      <nav aria-label="Créer" className="flex flex-col gap-2">
        <Option href={SHORT_NEW_PATH} onPick={onPick} icon={Video} title="Publier un Short"
          text="Filmez ou importez jusqu’à 30 secondes : pour un article, ou un Short libre." />
        <Option href={MY_SHORTS_PATH} onPick={onPick} icon={SquarePlay} title="Mes Shorts"
          text="Vos Shorts libres : en vérification, en ligne, refusés." />
        <Option href={CLIP_SPACE_PATH} onPick={onPick} icon={MicVocal} title="Espace artiste"
          text="Publiez vos clips musicaux : compte artiste vérifié par Rivendy." />
        <Option href="/sell" onPick={onPick} icon={Tag} title="Vendre un article"
          text="Publier une annonce sur Rivendy Marketplace." />
      </nav>
      <p className="flex items-center gap-1.5 px-1 pt-1 text-[12px] leading-snug text-rvp-muted">
        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden /> Le nombre de vidéos par mois dépend de votre formule vendeur.
      </p>
    </>
  );
}

function Option({ href, onPick, icon: Icon, title, text }: {
  href: string; onPick: () => void; icon: LucideIcon; title: string; text: ReactNode;
}) {
  return (
    <Link href={href} onClick={onPick} prefetch={false}
      className={cn("flex items-center gap-3.5 rounded-[18px] bg-rvp-raised p-3.5 text-rvp-text hover:bg-white/[0.08]", motion)}>
      <span aria-hidden className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[14px] bg-rvp-accent/15 text-rvp-accent-hover">
        <Icon className="h-[22px] w-[22px]" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-bold">{title}</span>
        <span className="text-[13px] leading-snug text-rvp-soft">{text}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-rvp-muted" aria-hidden />
    </Link>
  );
}
