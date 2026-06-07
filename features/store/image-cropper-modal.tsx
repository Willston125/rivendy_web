"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Loader2, ZoomIn, Check } from "lucide-react";

/**
 * Recadreur d'image léger (sans dépendance) — option A "recadrage avant upload".
 * L'utilisateur positionne (glisser) et zoome l'image dans un cadre au bon
 * ratio ; on rend la zone visible sur un canvas → l'image enregistrée est déjà
 * cadrée (aucun champ de position en base). Souris + tactile.
 */
export function ImageCropperModal({
  file,
  aspect,
  targetWidth,
  title,
  round = false,
  onCancel,
  onConfirm,
}: {
  file: File;
  aspect: number;
  targetWidth: number;
  title: string;
  round?: boolean;
  onCancel: () => void;
  onConfirm: (blob: Blob) => Promise<void> | void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ px: number; py: number; tx: number; ty: number } | null>(null);

  const [url, setUrl] = useState("");
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [frame, setFrame] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [saving, setSaving] = useState(false);

  // URL objet de l'image choisie
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  // Mesure du cadre (responsive)
  useEffect(() => {
    if (!frameRef.current) return;
    const r = frameRef.current.getBoundingClientRect();
    setFrame({ w: r.width, h: r.height });
  }, [url]);

  const baseScale = nat && frame ? Math.max(frame.w / nat.w, frame.h / nat.h) : 1;
  const scale = baseScale * zoom;

  const clamp = useCallback(
    (vx: number, vy: number) => {
      if (!nat || !frame) return { x: vx, y: vy };
      const dw = nat.w * scale;
      const dh = nat.h * scale;
      return {
        x: Math.min(0, Math.max(frame.w - dw, vx)),
        y: Math.min(0, Math.max(frame.h - dh, vy)),
      };
    },
    [nat, frame, scale],
  );

  // (Re)centre quand l'image, le cadre ou le zoom changent
  useEffect(() => {
    if (!nat || !frame) return;
    const dw = nat.w * scale;
    const dh = nat.h * scale;
    const c = clamp((frame.w - dw) / 2, (frame.h - dh) / 2);
    setTx(c.x);
    setTy(c.y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nat, frame, zoom]);

  function onPointerDown(e: React.PointerEvent) {
    dragRef.current = { px: e.clientX, py: e.clientY, tx, ty };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const c = clamp(
      dragRef.current.tx + (e.clientX - dragRef.current.px),
      dragRef.current.ty + (e.clientY - dragRef.current.py),
    );
    setTx(c.x);
    setTy(c.y);
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  async function confirm() {
    if (!nat || !frame || !imgRef.current) return;
    setSaving(true);
    try {
      const targetH = Math.round(targetWidth / aspect);
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const cropX = -tx / scale;
      const cropY = -ty / scale;
      const cropW = frame.w / scale;
      const cropH = frame.h / scale;
      ctx.drawImage(imgRef.current, cropX, cropY, cropW, cropH, 0, 0, targetWidth, targetH);
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob((b) => res(b), "image/jpeg", 0.9),
      );
      if (blob) await onConfirm(blob);
    } finally {
      setSaving(false);
    }
  }

  const frameMaxW = round ? 300 : 560;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-xl rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
        {/* En-tête */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-base font-black text-slate-900">{title}</p>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fermer"
            className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cadre de recadrage */}
        <div className="flex justify-center">
          <div
            ref={frameRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            className={`relative w-full cursor-grab touch-none select-none overflow-hidden bg-slate-100 active:cursor-grabbing ${
              round ? "rounded-full" : "rounded-2xl"
            }`}
            style={{ maxWidth: frameMaxW, aspectRatio: String(aspect) }}
          >
            {url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={imgRef}
                src={url}
                alt=""
                draggable={false}
                onLoad={(e) =>
                  setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
                }
                style={{
                  position: "absolute",
                  left: tx,
                  top: ty,
                  width: nat ? nat.w * scale : "auto",
                  height: nat ? nat.h * scale : "auto",
                  maxWidth: "none",
                }}
              />
            )}
            {/* Voile grille */}
            <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/30" />
          </div>
        </div>

        {/* Zoom */}
        <div className="mt-4 flex items-center gap-3">
          <ZoomIn className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-[#009688]"
          />
        </div>
        <p className="mt-2 text-center text-xs text-slate-400">
          Glissez l&apos;image pour la positionner · molette/curseur pour zoomer
        </p>

        {/* Actions */}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 flex-1 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 transition hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={saving || !nat}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#009688] text-sm font-black text-white transition hover:bg-[#00796B] disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? "Envoi…" : "Valider"}
          </button>
        </div>
      </div>
    </div>
  );
}
