"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Disc3, ListMusic, Share2, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { fetchArtist, type MusicArtist } from "./music-api";
import { lightData } from "./music-collection";
import { useMusicLibrary } from "./music-library";
import { useMusicLayout } from "./music-layout";
import { artistName, releaseKindLabel, releaseYear, thumbUrl } from "./music-logic";
import { Cover, Equalizer, FollowArtistButton, LikeButton, QueueList, iconButton } from "./music-ui";
import { useMusicPlayer } from "./player/music-player-provider";

/**
 * Panneau « En cours de lecture » (mise en page application du
 * 2026-10-22), à droite sur grand écran, en tiroir sur écran
 * intermédiaire : la sélection en cours, la grande pochette, le titre et
 * l'artiste, puis l'artiste, les crédits RÉELS (artiste, featuring) et la
 * sortie ; la file d'attente s'y affiche aussi. Rien n'est montré sans
 * donnée : pas de paroles (Rivendy n'en stocke pas), pas de chiffres inventés.
 */

const artists = new Map<string, MusicArtist | null>();

function useArtist(id: string | null | undefined): MusicArtist | null {
  const [state, setState] = useState<{ id: string | null; artist: MusicArtist | null }>(
    () => ({ id: id ?? null, artist: id ? artists.get(id) ?? null : null }),
  );
  useEffect(() => {
    if (!id) return;
    if (artists.has(id)) { setState({ id, artist: artists.get(id) ?? null }); return; }
    let alive = true;
    void fetchArtist(id).then((a) => { artists.set(id, a); if (alive) setState({ id, artist: a }); }).catch(() => {});
    return () => { alive = false; };
  }, [id]);
  return state.id === (id ?? null) ? state.artist : null;
}

export function NowPlayingPanel({ className }: { className?: string }) {
  const p = useMusicPlayer();
  const layout = useMusicLayout();
  const library = useMusicLibrary();
  const cur = p.current;
  const artist = useArtist(cur?.release.artist_id);
  if (!cur) return null;
  const { track: t, release: r } = cur;
  const queueMode = layout.rightMode === "queue";
  const nextItem = p.queue[p.index + 1] ?? null;
  const year = releaseYear(r);
  const featuring = (t.featuring?.trim() || r.featuring?.trim() || "").split(/,|&| et /).map((x) => x.trim()).filter(Boolean);

  return (
    <aside aria-label={queueMode ? "File d’attente" : "En cours de lecture"}
      className={cn("rvm-scope flex min-h-0 flex-col overflow-hidden rounded-lg bg-rvm-surface text-rvm-text", className)}>
      <header className="flex h-14 shrink-0 items-center gap-1 pl-4 pr-2">
        {queueMode ? (
          <button type="button" onClick={() => layout.setRightMode("now")} aria-label="Revenir à En cours de lecture"
            className={cn(iconButton, "-ml-2 h-9 w-9")}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
        <h2 className="min-w-0 flex-1 truncate text-base font-bold">
          {queueMode ? "File d’attente"
            : p.source?.href ? <Link href={p.source.href} className="hover:underline">{p.source.label}</Link>
            : p.source?.label ?? "En cours de lecture"}
        </h2>
        {!queueMode ? (
          <button type="button" onClick={() => layout.setRightMode("queue")} aria-label="Afficher la file d’attente" title="File d’attente"
            className={cn(iconButton, "h-9 w-9")}>
            <ListMusic className="h-[18px] w-[18px]" aria-hidden />
          </button>
        ) : null}
        <button type="button" onClick={layout.closeRight} aria-label="Fermer le panneau" title="Fermer" className={cn(iconButton, "h-9 w-9")}>
          <X className="h-[18px] w-[18px]" aria-hidden />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5">
        {queueMode ? <QueueList limit={100} /> : (
          <>
            <Link href={`/music/album/${r.id}?t=${t.id}`} aria-label={`Ouvrir ${r.title}`} className="block">
              <Cover url={r.cover_url} size={480} alt="" className="w-full shadow-xl shadow-rvm-deep/40" rounded="rounded-lg" />
            </Link>
            <div className="mt-4 flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <Link href={`/music/album/${r.id}?t=${t.id}`} className="block truncate text-2xl font-black tracking-tight hover:underline">{t.title}</Link>
                {r.artist_id
                  ? <Link href={`/artist/${r.artist_id}`} className="mt-0.5 block truncate text-[15px] text-rvm-soft hover:text-rvm-text hover:underline">{artistName(r)}</Link>
                  : <p className="mt-0.5 truncate text-[15px] text-rvm-soft">{artistName(r)}</p>}
              </div>
              <button type="button" onClick={() => void library.share("track", t.id, `${t.title} — ${artistName(r)}`)} aria-label="Partager"
                className={cn(iconButton, "h-9 w-9")}>
                <Share2 className="h-[18px] w-[18px]" aria-hidden />
              </button>
              <LikeButton track={t} className="h-9 w-9" />
            </div>
            {p.preview ? (
              <p className="mt-3 rounded-lg border border-rvm-premium/40 bg-rvm-premium/10 px-3 py-2 text-[13px] text-rvm-soft">
                Extrait de 30 s · titre réservé aux abonnés.{" "}
                <Link href="/plus" prefetch={false} className="font-bold text-rvm-premium underline">Découvrir Rivendy+</Link>
              </p>
            ) : null}

            {artist ? (
              <section aria-label="À propos de l’artiste" className="mt-5 overflow-hidden rounded-lg bg-rvm-raised">
                <div className="relative aspect-[16/10] bg-gradient-to-br from-rvm-brand/45 to-rvm-raised">
                  {/* Bannière décorative : épargnée en économie de données ou en 2G. */}
                  {(artist.banner_url || artist.avatar_url) && !lightData() && (thumbUrl(artist.banner_url || artist.avatar_url, 480) ?? "").startsWith("https://") ? (
                    <Image src={thumbUrl(artist.banner_url || artist.avatar_url, 480) as string} alt="" fill unoptimized sizes="400px"
                      className="object-cover object-[50%_30%]" />
                  ) : null}
                  <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/40" />
                  <p className="absolute left-4 top-3 text-sm font-bold text-white">À propos de l’artiste</p>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Link href={`/artist/${artist.id}`} className="min-w-0 truncate text-base font-bold hover:underline">{artist.name}</Link>
                    <FollowArtistButton artist={artist} compact />
                  </div>
                  {artist.genre ? <p className="mt-0.5 text-[13px] text-rvm-soft">{artist.genre}</p> : null}
                  {artist.bio ? <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-rvm-soft">{artist.bio}</p> : null}
                </div>
              </section>
            ) : null}

            <section aria-label="Crédits" className="mt-4 rounded-lg bg-rvm-raised p-4">
              <h3 className="text-base font-bold">Crédits</h3>
              <ul className="mt-3 space-y-3">
                <li>
                  <span className="block truncate text-[15px] font-semibold">{artistName(r)}</span>
                  <span className="block text-[13px] text-rvm-soft">Artiste principal</span>
                </li>
                {featuring.map((name) => (
                  <li key={name}>
                    <span className="block truncate text-[15px] font-semibold">{name}</span>
                    <span className="block text-[13px] text-rvm-soft">En featuring</span>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-label="Sortie" className="mt-4 rounded-lg bg-rvm-raised p-4">
              <h3 className="text-base font-bold">Extrait de</h3>
              <Link href={`/music/album/${r.id}`} className="mt-3 flex items-center gap-3 rounded-md hover:bg-rvm-text/5">
                <Cover url={r.cover_url} size={160} alt="" className="h-12 w-12 shrink-0" rounded="rounded" />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold">{r.title}</span>
                  <span className="block truncate text-[13px] text-rvm-soft">{releaseKindLabel(r.kind)}{year ? ` • ${year}` : ""}</span>
                </span>
                <Disc3 className="ml-auto h-4 w-4 shrink-0 text-rvm-muted" aria-hidden />
              </Link>
            </section>

            <section aria-label="À suivre dans la file d’attente" className="mt-4 rounded-lg bg-rvm-raised p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-bold">À suivre</h3>
                <button type="button" onClick={() => layout.setRightMode("queue")} className="text-[13px] font-semibold text-rvm-soft hover:text-rvm-text hover:underline">
                  Ouvrir la file d’attente
                </button>
              </div>
              {nextItem ? (
                <button type="button" onClick={() => p.playAt(p.index + 1)} className="mt-3 flex w-full items-center gap-3 rounded-md text-left hover:bg-rvm-text/5"
                  aria-label={`Écouter ${nextItem.track.title}`}>
                  <Cover url={nextItem.release.cover_url} size={160} alt="" className="h-12 w-12 shrink-0" rounded="rounded" />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold">{nextItem.track.title}</span>
                    <span className="block truncate text-[13px] text-rvm-soft">{artistName(nextItem.release)}</span>
                  </span>
                </button>
              ) : (
                <p className="mt-2 flex items-center gap-2 text-sm text-rvm-soft">
                  {p.playing ? <Equalizer /> : null} Plus rien après ce titre.
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </aside>
  );
}
