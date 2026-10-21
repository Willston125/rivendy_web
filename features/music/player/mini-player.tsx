"use client";

import Link from "next/link";
import {
  ChevronDown, ChevronUp, Loader2, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2, X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { artistName, formatDuration } from "../music-logic";
import { Cover } from "../music-ui";
import { useMusicPlayer } from "./music-player-provider";

/**
 * Mini-lecteur fixé en bas de toutes les pages (comme l'app), et grand
 * lecteur ouvert par-dessus. Un espace réservé évite qu'il cache le bas de
 * la page.
 */
export function MiniPlayer() {
  const p = useMusicPlayer();
  const cur = p.current;
  if (!cur) return null;
  const pct = p.duration > 0 ? Math.min(100, (p.position / p.duration) * 100) : 0;

  return (
    <>
      <div aria-hidden className="h-20" />
      <div className="fixed inset-x-0 bottom-0 z-[45] border-t border-white/10 bg-[#0D0B19]/95 text-white backdrop-blur">
        <div className="h-0.5 bg-white/10"><div className="h-0.5 bg-[#F5B83D]" style={{ width: `${pct}%` }} /></div>
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <button type="button" onClick={() => p.setExpanded(true)} className="flex min-w-0 flex-1 items-center gap-3 text-left"
            aria-label="Ouvrir le lecteur">
            <Cover url={cur.release.cover_url} size={160} alt="" className="h-11 w-11 shrink-0" rounded="rounded-md" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                {cur.track.title}
                {p.preview ? <span className="ml-2 rounded bg-[#F5B83D]/20 px-1.5 text-[10px] font-bold text-[#F5B83D]">Extrait</span> : null}
              </span>
              <span className="block truncate text-xs text-white/60">{artistName(cur.release)}</span>
            </span>
          </button>
          <button type="button" onClick={p.previous} aria-label="Précédent" className="hidden rounded-full p-2 hover:bg-white/10 sm:block">
            <SkipBack className="h-5 w-5" />
          </button>
          <button type="button" onClick={p.toggle} aria-label={p.playing ? "Pause" : "Lecture"}
            className="rounded-full bg-white p-2.5 text-[#0D0B19]">
            {p.loading ? <Loader2 className="h-5 w-5 animate-spin" /> : p.playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
          </button>
          <button type="button" onClick={p.next} disabled={p.index >= p.queue.length - 1 && p.repeat === "off"}
            aria-label="Suivant" className="rounded-full p-2 hover:bg-white/10 disabled:opacity-30">
            <SkipForward className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => p.setExpanded(true)} aria-label="Ouvrir le lecteur" className="hidden rounded-full p-2 hover:bg-white/10 md:block">
            <ChevronUp className="h-5 w-5" />
          </button>
          <button type="button" onClick={p.close} aria-label="Fermer le lecteur" className="rounded-full p-2 text-white/60 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      {p.expanded ? <FullPlayer /> : null}
    </>
  );
}

function FullPlayer() {
  const p = useMusicPlayer();
  const cur = p.current;
  if (!cur) return null;
  const upcoming = p.queue.slice(p.index + 1, p.index + 51);

  return (
    <div role="dialog" aria-modal="true" aria-label="Lecteur" className="fixed inset-0 z-[55] overflow-y-auto bg-[#0D0B19] text-white">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <button type="button" onClick={() => p.setExpanded(false)} className="flex items-center gap-1 text-sm text-white/70">
          <ChevronDown className="h-5 w-5" /> Réduire
        </button>

        <div className="mt-6 flex flex-col items-center gap-6 md:flex-row md:items-end">
          <Cover url={cur.release.cover_url} size={720} alt={cur.release.title} className="w-64 shadow-2xl md:w-72" />
          <div className="min-w-0 flex-1 text-center md:text-left">
            <Link href={`/music/album/${cur.release.id}`} onClick={() => p.setExpanded(false)}
              className="block truncate text-2xl font-black hover:underline">{cur.track.title}</Link>
            {cur.release.artist_id ? (
              <Link href={`/artist/${cur.release.artist_id}`} onClick={() => p.setExpanded(false)}
                className="mt-1 block truncate text-white/70 hover:underline">{artistName(cur.release)}</Link>
            ) : <p className="mt-1 truncate text-white/70">{artistName(cur.release)}</p>}
            {p.preview ? (
              <p className="mt-3 rounded-xl bg-[#F5B83D]/15 px-3 py-2 text-sm text-[#F5B83D]">
                Extrait de 30 s · titre réservé aux abonnés.{" "}
                <Link href="/plus" onClick={() => p.setExpanded(false)} className="font-bold underline">Découvrir Rivendy+</Link>
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-8">
          <input type="range" min={0} max={Math.max(1, Math.round(p.duration))} value={Math.round(p.position)}
            onChange={(e) => p.seek(Number(e.target.value))} aria-label="Position"
            className="w-full accent-[#F5B83D]" />
          <div className="flex justify-between text-xs text-white/60">
            <span>{formatDuration(p.position)}</span><span>{formatDuration(p.duration)}</span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-4">
          <button type="button" onClick={p.toggleShuffle} aria-pressed={p.shuffled} aria-label="Aléatoire"
            className={cn("rounded-full p-2", p.shuffled ? "text-[#F5B83D]" : "text-white/70")}><Shuffle className="h-5 w-5" /></button>
          <button type="button" onClick={p.previous} aria-label="Précédent" className="rounded-full p-2"><SkipBack className="h-7 w-7" /></button>
          <button type="button" onClick={p.toggle} aria-label={p.playing ? "Pause" : "Lecture"} className="rounded-full bg-[#F5B83D] p-4 text-[#0D0B19]">
            {p.loading ? <Loader2 className="h-7 w-7 animate-spin" /> : p.playing ? <Pause className="h-7 w-7 fill-current" /> : <Play className="h-7 w-7 fill-current" />}
          </button>
          <button type="button" onClick={p.next} aria-label="Suivant" className="rounded-full p-2"><SkipForward className="h-7 w-7" /></button>
          <button type="button" onClick={p.cycleRepeat} aria-label={`Répétition : ${p.repeat === "off" ? "désactivée" : p.repeat === "all" ? "toute la file" : "ce titre"}`}
            className={cn("rounded-full p-2", p.repeat !== "off" ? "text-[#F5B83D]" : "text-white/70")}>
            {p.repeat === "one" ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
          </button>
        </div>

        <label className="mx-auto mt-4 flex max-w-xs items-center gap-2 text-white/70">
          <Volume2 className="h-4 w-4" />
          <input type="range" min={0} max={100} value={Math.round(p.volume * 100)} onChange={(e) => p.setVolume(Number(e.target.value) / 100)}
            aria-label="Volume" className="w-full accent-[#F5B83D]" />
        </label>

        {p.error ? <p role="alert" className="mt-4 text-center text-sm text-red-300">{p.error}</p> : null}

        <h2 className="mt-10 text-lg font-bold">À suivre</h2>
        {upcoming.length === 0 ? <p className="mt-2 text-sm text-white/60">La file d’attente est vide.</p> : (
          <ul className="mt-2 divide-y divide-white/5">
            {upcoming.map((item, k) => {
              const i = p.index + 1 + k;
              return (
                <li key={`${item.track.id}-${i}`} className="flex items-center gap-3 py-2">
                  <Cover url={item.release.cover_url} size={160} alt="" className="h-10 w-10 shrink-0" rounded="rounded-md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{item.track.title}</span>
                    <span className="block truncate text-xs text-white/60">{artistName(item.release)}</span>
                  </span>
                  <button type="button" onClick={() => p.removeAt(i)} aria-label="Retirer de la file" className="rounded-full p-1.5 text-white/60 hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
