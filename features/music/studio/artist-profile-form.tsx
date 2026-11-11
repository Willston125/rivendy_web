"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { Camera, Globe2, Info, Loader2 } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { artistStatusOf } from "@/features/play/clips/clips-logic";
import { useDialogs } from "@/features/ui/dialogs";
import { cropToAspect } from "@/services/image-upload";
import { cn } from "@/lib/utils/cn";
import { primaryButton, secondaryButton } from "../music-ui";
import {
  fetchOrigins, requestArtistName, saveArtist, setArtistOrigin, setMusicEnabled, StudioError, uploadArtistImage, type MyArtist,
} from "./studio-api";
import { ARTIST, artistProfileProblem, artistTextProblem, originGroups, type Origin } from "./studio-logic";

const field = "w-full rounded-2xl border border-rvm-line bg-rvm-field px-3.5 text-base text-rvm-text outline-none transition placeholder:text-rvm-muted focus:border-rvm-ink-accent focus:bg-rvm-surface";
const label = "text-[13px] font-bold text-rvm-soft";
const help = "text-[12.5px] leading-snug text-rvm-muted";

type Picked = { blob: Blob; url: string };

/**
 * Demande de compte artiste, ou profil d'un artiste (lot 1, 2026-11-11) : le
 * formulaire de l'app (artist_profile_form_screen.dart) — mêmes champs, mêmes
 * limites, mêmes règles, même fonction serveur (play_artist_save). Photo
 * carrée et bannière 16:9 recadrées et allégées dans le navigateur, puis
 * envoyées dans le dossier du compte. Nom validé : il ne change que par une
 * demande à Rivendy. « Publier aussi sur Rivendy Musique » : artiste validé
 * seulement, comme l'app.
 */
export function ArtistProfileForm({ artist, onSaved }: { artist: MyArtist | null; onSaved: () => void }) {
  const { user } = useAuth();
  const dialogs = useDialogs();
  const ids = useId();
  const status = artistStatusOf(artist?.status);
  const approved = status === "approved";
  const nameLocked = approved;

  const [name, setName] = useState(artist?.name ?? "");
  const [genre, setGenre] = useState(artist?.genre ?? "");
  const [bio, setBio] = useState(artist?.bio ?? "");
  const [originId, setOriginId] = useState<string>(artist?.island_id ?? "");
  // Un compte artiste existant a déjà accepté les règles (comme l'app).
  const [rules, setRules] = useState(artist != null);
  const [avatar, setAvatar] = useState<Picked | null>(null);
  const [banner, setBanner] = useState<Picked | null>(null);
  const [origins, setOrigins] = useState<Origin[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [musicBusy, setMusicBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    fetchOrigins().then((o) => { if (alive) setOrigins(o); }, () => { if (alive) setOrigins([]); });
    return () => { alive = false; };
  }, []);

  // Aperçus locaux libérés quand ils sont remplacés ou que le formulaire se ferme.
  useEffect(() => () => { if (avatar) URL.revokeObjectURL(avatar.url); }, [avatar]);
  useEffect(() => () => { if (banner) URL.revokeObjectURL(banner.url); }, [banner]);

  async function pick(e: ChangeEvent<HTMLInputElement>, kind: "avatar" | "banner") {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const blob = await cropToAspect(file, kind === "avatar" ? 1 : 16 / 9);
      const picked = { blob, url: URL.createObjectURL(blob) };
      if (kind === "avatar") setAvatar(picked); else setBanner(picked);
    } catch {
      dialogs.notify("Cette image ne peut pas être lue. Choisissez une photo JPEG ou PNG.", "error");
    }
  }

  async function submit() {
    if (!user) return;
    const p = artistProfileProblem({ name, genre, bio, rules, nameLocked });
    setProblem(p);
    if (p) return;
    setSaving(true);
    try {
      const avatarUrl = avatar ? await uploadArtistImage(user.id, avatar.blob, "avatar") : artist?.avatar_url ?? null;
      const bannerUrl = banner ? await uploadArtistImage(user.id, banner.blob, "banner") : artist?.banner_url ?? null;
      const next = await saveArtist({ name: nameLocked && artist ? artist.name : name, genre, bio, avatarUrl, bannerUrl });
      // L'origine, sans nouvelle vérification (le profil existe désormais).
      const origin = originId || null;
      if (origin !== (artist?.island_id ?? null)) await setArtistOrigin(origin);
      dialogs.notify(next === "approved"
        ? "Profil artiste mis à jour."
        : "Demande envoyée : Rivendy la vérifie, vous serez prévenu par une notification.", "success");
      setAvatar(null);
      setBanner(null);
      onSaved();
    } catch (e) {
      setProblem(e instanceof StudioError ? e.message : "Enregistrement impossible, réessayez.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleMusic() {
    if (!artist || musicBusy) return;
    const on = artist.music_enabled === false;
    setMusicBusy(true);
    try {
      await setMusicEnabled(on);
      dialogs.notify(on ? "Vous publiez aussi sur Rivendy Musique." : "Clips seulement : vous n’apparaissez plus dans Rivendy Musique.", "success");
      onSaved();
    } catch (e) {
      dialogs.notify(e instanceof StudioError ? e.message : "Action impossible pour le moment, réessayez.", "error");
    } finally {
      setMusicBusy(false);
    }
  }

  async function askNewName() {
    const next = await dialogs.ask({
      title: "Changer de nom d’artiste",
      message: "Rivendy vérifie chaque changement de nom (usurpation). Votre nom actuel reste affiché en attendant.",
      placeholder: "Nouveau nom d’artiste",
      maxLength: ARTIST.nameMax,
      confirmLabel: "Demander",
    });
    if (next === null) return;
    await sendNameRequest(next);
  }

  async function sendNameRequest(next: string) {
    const p = next.trim() ? artistTextProblem(next, { min: ARTIST.nameMin, max: ARTIST.nameMax, field: "Nom d’artiste" }) : null;
    if (p) { dialogs.notify(p, "error"); return; }
    try {
      await requestArtistName(next.trim());
      dialogs.notify(next.trim() ? "Demande envoyée : Rivendy la vérifie, vous serez prévenu par une notification." : "Demande de changement de nom annulée.", "success");
      onSaved();
    } catch (e) {
      dialogs.notify(e instanceof StudioError ? e.message : "Demande impossible pour le moment, réessayez.", "error");
    }
  }

  const bannerSrc = banner?.url ?? artist?.banner_url ?? null;
  const avatarSrc = avatar?.url ?? artist?.avatar_url ?? null;
  const submitLabel = artist == null ? "Envoyer ma demande" : status === "rejected" ? "Renvoyer ma demande" : "Enregistrer";

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate className="flex flex-col gap-4">
      <section aria-labelledby={`${ids}-chaine`} className="flex flex-col gap-3 rounded-[20px] border border-rvm-line bg-rvm-surface p-4 @2xl:p-6">
        <h3 id={`${ids}-chaine`} className="font-rvm-display text-[19px] font-black @2xl:text-[22px]">Votre chaîne</h3>
        <div className="relative h-[116px] overflow-hidden rounded-2xl bg-rvm-deep @2xl:h-44">
          {bannerSrc ? (
            <Image src={bannerSrc} alt="Bannière de la chaîne" fill sizes="(min-width: 1024px) 720px, 100vw" unoptimized={bannerSrc.startsWith("blob:")}
              className="object-cover" />
          ) : null}
          <button type="button" onClick={() => bannerInput.current?.click()}
            className="absolute bottom-2 right-2 flex h-10 items-center gap-1.5 rounded-full bg-white/95 px-3.5 text-[13px] font-bold text-rvm-text shadow @2xl:bottom-3 @2xl:right-3">
            <Camera className="h-4 w-4" aria-hidden /> {bannerSrc ? "Changer la bannière" : "Choisir la bannière"}
          </button>
        </div>
        <div className="relative -mt-11 flex items-end gap-3.5 pl-3 @2xl:-mt-14 @2xl:pl-5">
          <span className="relative block h-[84px] w-[84px] shrink-0 overflow-hidden rounded-full border-4 border-rvm-surface bg-rvm-raised shadow-md @2xl:h-[104px] @2xl:w-[104px]">
            {avatarSrc ? (
              <Image src={avatarSrc} alt="Photo de la chaîne" fill sizes="104px" unoptimized={avatarSrc.startsWith("blob:")} className="object-cover" />
            ) : (
              <span aria-hidden className="grid h-full w-full place-items-center font-rvm-display text-3xl font-black text-rvm-ink-accent">
                {(name.trim().charAt(0) || "?").toUpperCase()}
              </span>
            )}
          </span>
          <button type="button" onClick={() => avatarInput.current?.click()} className={cn(secondaryButton, "mb-1 h-10")}>
            {avatarSrc ? "Changer la photo" : "Choisir la photo"}
          </button>
        </div>
        <p className={cn(help, "flex gap-2")}>
          <Info className="mt-px h-4 w-4 shrink-0 text-rvm-ink-accent" aria-hidden />
          Photo et bannière sont recadrées et allégées dans votre navigateur avant l’envoi : moins de données consommées.
        </p>
        <input ref={avatarInput} type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e, "avatar")} />
        <input ref={bannerInput} type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e, "banner")} />
      </section>

      <section aria-labelledby={`${ids}-profil`} className="flex flex-col gap-4 rounded-[20px] border border-rvm-line bg-rvm-surface p-4 @2xl:p-6">
        <h3 id={`${ids}-profil`} className="font-rvm-display text-[19px] font-black @2xl:text-[22px]">Votre profil</h3>
        <div className="grid gap-4 @2xl:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${ids}-name`} className={label}>Nom d’artiste</label>
            <input id={`${ids}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={ARTIST.nameMax}
              readOnly={nameLocked} autoComplete="off" placeholder="Votre nom de scène"
              className={cn(field, "h-12", nameLocked && "bg-rvm-raised text-rvm-soft")} />
            {nameLocked ? (
              <span className={help}>
                Nom validé par Rivendy. Pour le changer, faites une demande.{" "}
                <button type="button" onClick={() => void askNewName()} className="font-bold text-rvm-ink-accent hover:underline">Demander un changement de nom</button>
                {artist?.name_request ? (
                  <span className="mt-1 block">
                    Demande en cours : « {artist.name_request} ».{" "}
                    <button type="button" onClick={() => void sendNameRequest("")} className="font-bold text-rvm-ink-accent hover:underline">Annuler la demande</button>
                  </span>
                ) : null}
              </span>
            ) : <span className={help}>Votre vrai nom de scène. Rivendy le vérifie avant validation.</span>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${ids}-genre`} className={label}>Genre musical</label>
            <input id={`${ids}-genre`} value={genre} onChange={(e) => setGenre(e.target.value)} maxLength={ARTIST.genreMax}
              autoComplete="off" placeholder="Rap, afro, twarab…" className={cn(field, "h-12")} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-bio`} className={label}>Biographie</label>
          <textarea id={`${ids}-bio`} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={ARTIST.bioMax} rows={4}
            placeholder="Présentez-vous en quelques lignes." className={cn(field, "min-h-[112px] resize-y py-3 leading-relaxed")} />
          <span className={cn(help, "flex justify-between gap-3")}>
            <span>Sans numéro, WhatsApp ni lien : tout contact passe par Rivendy.</span>
            <span aria-hidden className="shrink-0 tabular-nums">{bio.trim().length} / {ARTIST.bioMax}</span>
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${ids}-origin`} className={cn(label, "flex items-center gap-1.5")}>
            <Globe2 className="h-4 w-4 text-rvm-ink-accent" aria-hidden /> Origine
          </label>
          <select id={`${ids}-origin`} value={originId} onChange={(e) => setOriginId(e.target.value)} disabled={origins === null}
            className={cn(field, "h-12 appearance-auto pr-2")}>
            <option value="">{origins === null ? "Chargement…" : "Aucune (facultatif)"}</option>
            {(origins ? originGroups(origins) : []).map((g) => (
              <optgroup key={g.country.id} label={g.country.name}>
                <option value={g.country.id}>{g.country.name}{g.children.length ? " (tout le pays)" : ""}</option>
                {g.children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            ))}
          </select>
          <span className={help}>Pays, région ou île d’où vient votre musique.</span>
        </div>
      </section>

      {approved ? (
        <section className="flex items-start gap-3.5 rounded-[20px] border border-rvm-line bg-rvm-surface p-4 @2xl:p-6">
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span id={`${ids}-music`} className="text-[15px] font-bold">Publier aussi sur Rivendy Musique</span>
            <span className="text-[13px] leading-snug text-rvm-soft">
              {artist?.music_enabled === false
                ? "Clips seulement : vous restez dans Rivendy Play."
                : "Singles, EP, albums et stories ; votre page apparaît dans Rivendy Musique."}
            </span>
          </span>
          <button type="button" role="switch" aria-checked={artist?.music_enabled !== false} aria-labelledby={`${ids}-music`}
            onClick={() => void toggleMusic()} disabled={musicBusy}
            className={cn("relative mt-0.5 h-8 w-[52px] shrink-0 rounded-full transition-colors disabled:opacity-60",
              artist?.music_enabled !== false ? "bg-rvm-ink-accent" : "bg-rvm-line")}>
            <span aria-hidden className={cn("absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-[left]",
              artist?.music_enabled !== false ? "left-6" : "left-1")} />
          </button>
        </section>
      ) : null}

      <section className="flex flex-col gap-3.5 rounded-[20px] border border-rvm-line bg-rvm-surface p-4 @2xl:p-6">
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={rules} onChange={(e) => setRules(e.target.checked)}
            className="mt-0.5 h-6 w-6 shrink-0 cursor-pointer rounded-md accent-[#0B7A6E]" />
          <span className="text-sm leading-relaxed">
            Je détiens les droits sur la musique, les images et les clips que je publie. Pas de contenu violent, sexuel ou haineux,
            ni de contact direct. Rivendy peut refuser un clip ou suspendre mon compte.
          </span>
        </label>
        <Link href="/droits-auteur" prefetch={false} className="self-start text-sm font-bold text-rvm-ink-accent hover:underline">Droits d’auteur sur Rivendy →</Link>
        <button type="submit" disabled={saving} className={cn(primaryButton, "h-[52px] w-full text-[15px] @2xl:w-auto @2xl:self-start @2xl:px-8")}>
          {saving ? <><Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Envoi…</> : submitLabel}
        </button>
        {problem ? <p role="alert" className="text-sm font-semibold text-red-700">{problem}</p> : null}
      </section>
    </form>
  );
}
