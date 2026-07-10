"use client";

import { useEffect, useRef, useState } from "react";
import { AudioLines, Loader2, Pause, Play } from "lucide-react";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Lecteur de note vocale vendeur — réplique web de `voice_note_player.dart`.
 * Style « message WhatsApp » : bouton play + barre de progression + durée.
 */
export function VoiceNotePlayer({
  audioUrl,
  label = "Message du vendeur",
}: {
  audioUrl: string;
  label?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [errored, setErrored] = useState(false);

  // Garde : URL invalide → ne rien afficher
  const valid = Boolean(audioUrl) && audioUrl !== "null" && audioUrl.startsWith("http");

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setPosition(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);
    const onEnd = () => {
      setPlaying(false);
      setPosition(0);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onWaiting = () => setLoading(true);
    const onPlaying = () => setLoading(false);
    const onError = () => {
      setErrored(true);
      setLoading(false);
      setPlaying(false);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("error", onError);
    };
  }, []);

  if (!valid || errored) return null;

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      return;
    }
    setLoading(true);
    try {
      await audio.play();
    } catch {
      setErrored(true);
    } finally {
      setLoading(false);
    }
  }

  const progress = duration > 0 ? Math.min(1, position / duration) : 0;

  return (
    <div className="flex h-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        aria-label={playing ? "Pause" : "Lire la note vocale"}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#009688] text-white transition hover:bg-[#00796B] disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : playing ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5 translate-x-[1px]" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[#009688]">
          <AudioLines className="h-3.5 w-3.5" />
          <span className="text-xs font-bold text-slate-800">{label}</span>
        </div>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-[#009688] transition-[width] duration-150"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <p className="mt-1 text-[10px] font-medium text-slate-400">
          {playing ? `${formatTime(position)} / ${formatTime(duration)}` : formatTime(duration)}
        </p>
      </div>
    </div>
  );
}
