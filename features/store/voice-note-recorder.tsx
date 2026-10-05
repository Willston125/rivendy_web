"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square, Trash2, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/features/auth/auth-provider";

/** Même plafond que l'app (`_kMaxDurationSeconds`, voice_note_recorder_sheet.dart). */
const MAX_SECONDS = 30;

/** Format accepté par le navigateur : AAC (Safari) d'abord, sinon WebM/Opus. */
function pickMimeType(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates: Array<{ mime: string; ext: string }> = [
    { mime: "audio/mp4", ext: "m4a" },
    { mime: "audio/webm;codecs=opus", ext: "webm" },
    { mime: "audio/webm", ext: "webm" },
  ];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c.mime)) ?? null;
}

/**
 * Présentation vocale de la boutique — miroir de `VoiceNoteRecorderSheet`
 * (app) : même bucket `voice-notes`, même chemin `<vendeur>/voice_…`, même
 * colonne `profiles.voice_note_url`, 30 secondes maximum. Jusqu'au
 * 2026-10-04 le site ne savait que LIRE la note ; « Ajouter une présentation
 * vocale » menait vers une page qui ne le proposait pas.
 */
export function VoiceNoteRecorder() {
  const { user, profile, refreshProfile } = useAuth();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<{ data: Blob; ext: string; mime: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const current = profile?.voice_note_url && profile.voice_note_url.startsWith("http") ? profile.voice_note_url : null;

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    setRecording(false);
  }

  async function start() {
    setMessage(null);
    const format = pickMimeType();
    if (!format || !navigator.mediaDevices?.getUserMedia) {
      setMessage({ ok: false, text: "Ce navigateur ne permet pas d'enregistrer de l'audio." });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: format.mime });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const data = new Blob(chunks, { type: format.mime.split(";")[0] });
        setBlob({ data, ext: format.ext, mime: format.mime.split(";")[0] });
        setPreviewUrl(URL.createObjectURL(data));
      };
      recorderRef.current = recorder;
      recorder.start();
      setBlob(null);
      setPreviewUrl(null);
      setSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) {
            stop();
            return MAX_SECONDS;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setMessage({ ok: false, text: "Accès au micro refusé. Autorisez le micro pour ce site dans votre navigateur." });
    }
  }

  async function publish() {
    if (!user || !blob || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const safeId = user.id.replace(/-/g, "");
      const path = `${user.id}/voice_${safeId}_${Date.now()}.${blob.ext}`;
      const { error: upErr } = await supabase.storage
        .from("voice-notes")
        .upload(path, blob.data, { contentType: blob.mime, upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("voice-notes").getPublicUrl(path);
      const { data: updated, error: updErr } = await supabase
        .from("profiles")
        .update({ voice_note_url: pub.publicUrl })
        .eq("id", user.id)
        .select("voice_note_url");
      if (updErr || !updated?.length) throw updErr ?? new Error("Profil non mis à jour");
      await refreshProfile();
      setBlob(null);
      setPreviewUrl(null);
      setMessage({ ok: true, text: "Présentation vocale publiée sur votre boutique." });
    } catch {
      setMessage({ ok: false, text: "Publication impossible. Réessayez dans un moment." });
    } finally {
      setBusy(false);
    }
  }

  async function removeCurrent() {
    if (!user || busy) return;
    setBusy(true);
    setMessage(null);
    const { data, error } = await supabase
      .from("profiles")
      .update({ voice_note_url: null })
      .eq("id", user.id)
      .select("id");
    setBusy(false);
    if (error || !data?.length) {
      setMessage({ ok: false, text: "Impossible de supprimer la note." });
      return;
    }
    await refreshProfile();
    setMessage({ ok: true, text: "Présentation vocale retirée." });
  }

  return (
    <section id="presentation-vocale" className="scroll-mt-24 space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm font-black text-[#1A1A1A]">Présentation vocale de la boutique</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {MAX_SECONDS} secondes pour présenter votre boutique — elle s&apos;affiche sur votre page, dans l&apos;app et sur le site.
        </p>
      </div>

      {current && !blob && (
        <div className="space-y-2">
          <audio controls src={current} className="w-full" preload="none" />
          <button
            type="button"
            onClick={() => void removeCurrent()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-red-500 hover:underline disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Supprimer la note actuelle
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {!recording ? (
          <button
            type="button"
            onClick={() => void start()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-[#009688] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#00796B] disabled:opacity-50"
          >
            <Mic className="h-4 w-4" /> {current || blob ? "Réenregistrer" : "Enregistrer"}
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-600"
          >
            <Square className="h-4 w-4 fill-white" /> Arrêter ({seconds}s / {MAX_SECONDS}s)
          </button>
        )}
        {blob && !recording && (
          <button
            type="button"
            onClick={() => void publish()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border border-[#009688] px-4 py-2.5 text-sm font-bold text-[#009688] transition hover:bg-[#E0F2F1] disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Publier
          </button>
        )}
      </div>

      {previewUrl && !recording && <audio controls src={previewUrl} className="w-full" />}

      {message && (
        <p className={`text-sm font-semibold ${message.ok ? "text-[#007168]" : "text-red-600"}`}>{message.text}</p>
      )}
    </section>
  );
}
