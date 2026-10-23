"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CirclePlus, Heart, Library, ListMusic, Play, UserPlus, X, type LucideIcon } from "lucide-react";
import { DialogShell } from "@/components/ui/dialog-shell";
import type { PendingMusicAction } from "./music-logic";
import { loginHref, savePending } from "./music-pending";

/**
 * Invitation à se connecter (lot « Musique web », 2026-10-23) : un visiteur
 * qui veut écouter, liker, enregistrer, suivre, ranger ou ouvrir sa
 * bibliothèque reçoit une explication SUR PLACE, au lieu d'être renvoyé
 * d'un coup vers la page de connexion. « Se connecter » garde l'action
 * (30 min, `music-pending.ts`) : elle est reprise au retour, sur la même page.
 * Le lecteur (monté au-dessus de la bibliothèque) l'ouvre aussi : d'où un
 * petit magasin partagé plutôt qu'un contexte.
 */

export type LoginInvite = {
  kind: PendingMusicAction["kind"] | "create" | "library";
  label?: string;
  /** Action reprise après la connexion (sans action : simple connexion). */
  action?: Omit<PendingMusicAction, "at" | "path">;
  items?: unknown[];
};

let current: LoginInvite | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function inviteLogin(invite: LoginInvite) {
  current = invite;
  notify();
}

function closeInvite() {
  current = null;
  notify();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

const COPY: Record<LoginInvite["kind"], { icon: LucideIcon; title: (l: string) => string; text: string }> = {
  play: {
    icon: Play,
    title: (l) => (l ? `Écoutez « ${l} »` : "Écoutez ce titre"),
    text: "L’écoute demande un compte Rivendy. Après la connexion, vous revenez ici et la lecture vous est proposée.",
  },
  like: {
    icon: Heart,
    title: (l) => (l ? `Gardez « ${l} » dans vos titres likés` : "Gardez vos coups de cœur"),
    text: "Connectez-vous : vos titres likés vous suivent sur le site et dans l’application.",
  },
  save: {
    icon: CirclePlus,
    title: (l) => (l ? `Enregistrez « ${l} »` : "Enregistrez cette sortie"),
    text: "Connectez-vous pour la retrouver dans votre bibliothèque, sur le site et dans l’application.",
  },
  follow: {
    icon: UserPlus,
    title: (l) => (l ? `Suivez ${l}` : "Suivez cet artiste"),
    text: "Connectez-vous pour suivre cet artiste et retrouver ses sorties dans votre bibliothèque.",
  },
  playlist: {
    icon: ListMusic,
    title: (l) => (l ? `Ajoutez « ${l} » à une playlist` : "Rangez ce titre dans une playlist"),
    text: "Connectez-vous pour créer vos playlists et les retrouver sur le site et dans l’application.",
  },
  create: {
    icon: ListMusic,
    title: () => "Créez vos playlists",
    text: "Connectez-vous pour créer des playlists et les retrouver sur le site et dans l’application.",
  },
  library: {
    icon: Library,
    title: () => "Votre bibliothèque",
    text: "Connectez-vous pour retrouver vos playlists, vos titres likés, vos albums et vos artistes suivis, comme dans l’application.",
  },
};

/** Monté une fois (bibliothèque Musique, à la racine du site). */
export function LoginInviteHost() {
  const invite = useSyncExternalStore(subscribe, () => current, () => null);
  const router = useRouter();
  if (!invite) return null;
  const copy = COPY[invite.kind];
  const Icon = copy.icon;

  function login() {
    if (!invite) return;
    const path = `${window.location.pathname}${window.location.search}`;
    if (invite.action) savePending({ ...invite.action, path }, invite.items);
    closeInvite();
    router.push(loginHref(path));
  }

  return (
    <DialogShell onClose={closeInvite} labelledBy="rvm-login-invite-title" layerClassName="z-[70]"
      panelClassName="rvm-scope relative w-full max-w-md rounded-t-3xl border border-rvm-line bg-rvm-surface p-6 text-rvm-text shadow-2xl sm:rounded-3xl">
      <button type="button" onClick={closeInvite} aria-label="Fermer"
        className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-rvm-muted hover:bg-white/10 hover:text-rvm-text">
        <X className="h-5 w-5" aria-hidden />
      </button>
      <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rvm-accent to-rvm-brand text-rvm-on-accent">
        <Icon className="h-7 w-7" />
      </span>
      <h2 id="rvm-login-invite-title" className="mt-4 pr-8 text-xl font-black leading-snug">{copy.title(invite.label?.trim() ?? "")}</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-rvm-soft">{copy.text}</p>
      <p className="mt-2 text-[13px] text-rvm-muted">Pas encore de compte ? Il se crée gratuitement depuis la page de connexion.</p>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={closeInvite}
          className="h-11 rounded-full border border-white/20 px-5 text-sm font-semibold text-rvm-text hover:border-white">
          Plus tard
        </button>
        <button type="button" onClick={login}
          className="h-11 rounded-full bg-rvm-accent px-6 text-sm font-bold text-rvm-on-accent hover:bg-rvm-accent-hover active:bg-rvm-accent-pressed">
          Se connecter
        </button>
      </div>
    </DialogShell>
  );
}
