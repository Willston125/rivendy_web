"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { EllipsisVertical, Upload, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { motion } from "../play-theme";
import { COMMENTS_MODES, commentsModeHint, commentsModeLabel, type CommentsMode, type StatusTone } from "./create-logic";
import { PlaySheet } from "./play-sheet";

/** Morceaux communs aux clips et aux Shorts (lots 3 et 4, 2026-11-11). */

// ── « Qui peut commenter » (pickCommentsMode de l'app) ───────────────────────

export function CommentsModeSheet({ current, onPick, onClose }: {
  current: CommentsMode; onPick: (mode: CommentsMode) => void; onClose: () => void;
}) {
  return (
    <PlaySheet title="Qui peut commenter" onClose={onClose}>
      <div role="radiogroup" aria-label="Qui peut commenter" className="flex flex-col gap-2">
        {COMMENTS_MODES.map((m) => {
          const on = m === current;
          return (
            <button key={m} type="button" role="radio" aria-checked={on} data-autofocus={on ? "" : undefined} onClick={() => onPick(m)}
              className={cn("flex min-h-14 items-center gap-3 rounded-2xl border p-3 text-left", motion,
                on ? "border-rvp-accent bg-rvp-accent/10" : "border-rvp-edge bg-rvp-raised hover:bg-white/[0.08]")}>
              <span aria-hidden className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full border-2", on ? "border-rvp-accent" : "border-rvp-muted")}>
                {on ? <span className="h-2.5 w-2.5 rounded-full bg-rvp-accent" /> : null}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[15px] font-bold">{commentsModeLabel(m)}</span>
                <span className="text-[13px] leading-snug text-rvp-soft">{commentsModeHint(m)}</span>
              </span>
            </button>
          );
        })}
      </div>
    </PlaySheet>
  );
}

// ── Menu d'une ligne (⋯) ─────────────────────────────────────────────────────

export type RowAction = { label: string; icon: LucideIcon; onSelect?: () => void; href?: string; danger?: boolean };

/** Menu ancré au bouton ⋯ : Échap ou un clic à côté le referment. */
export function RowMenu({ label, actions }: { label: string; actions: RowAction[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[14px] font-semibold";
  return (
    <div ref={root} className="relative shrink-0">
      <button ref={button} type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn("grid h-11 w-11 place-items-center rounded-full text-rvp-soft hover:bg-white/[0.08] hover:text-rvp-text", motion, open && "bg-white/[0.08] text-rvp-text")}>
        <EllipsisVertical className="h-5 w-5" aria-hidden />
      </button>
      {open ? (
        <div id={menuId} role="menu" aria-label={label}
          className="absolute right-0 top-full z-30 mt-1 w-56 rounded-2xl border border-rvp-edge-strong bg-rvp-frame p-1.5 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.75)]">
          {actions.map((a) => {
            const Icon = a.icon;
            const cls = cn(item, a.danger ? "text-red-300 hover:bg-red-500/10" : "text-rvp-text hover:bg-white/[0.08]");
            return a.href ? (
              <Link key={a.label} role="menuitem" href={a.href} prefetch={false} onClick={() => setOpen(false)} className={cls}>
                <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden /> {a.label}
              </Link>
            ) : (
              <button key={a.label} type="button" role="menuitem" onClick={() => { setOpen(false); a.onSelect?.(); }} className={cls}>
                <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden /> {a.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// ── Statut ───────────────────────────────────────────────────────────────────

const TONE: Record<StatusTone, string> = {
  online: "bg-rvp-accent/15 text-rvp-accent",
  pending: "bg-amber-300/15 text-amber-200",
  neutral: "bg-white/[0.08] text-rvp-soft",
  rejected: "bg-red-400/15 text-red-200",
};

export function StatusChip({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return <span className={cn("inline-flex h-[22px] items-center rounded-md px-2 text-[11.5px] font-extrabold", TONE[tone])}>{children}</span>;
}

// ── Choix de la vidéo ────────────────────────────────────────────────────────

/**
 * Zone de choix d'une vidéo : un clic ouvre le sélecteur (sur iPhone :
 * Photothèque, Prendre une vidéo ou Fichiers) ; sur ordinateur, on peut aussi
 * y glisser le fichier.
 */
export function VideoDrop({ shape, title, hint, note, busy, onFile }: {
  shape: "wide" | "tall"; title: string; hint: string; note?: string; busy?: boolean; onFile: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={cn("relative flex flex-col items-center justify-center gap-3 rounded-[22px] border-2 border-dashed p-5 text-center", motion,
        shape === "tall" ? "mx-auto aspect-[9/16] w-full max-w-[260px]" : "aspect-video w-full",
        over ? "border-rvp-accent bg-rvp-accent/10" : "border-rvp-edge-strong bg-rvp-surface")}>
      <span aria-hidden className="grid h-14 w-14 place-items-center rounded-[18px] bg-rvp-accent/15 text-rvp-accent-hover">
        {busy ? <span className="h-6 w-6 animate-spin rounded-full border-2 border-rvp-line border-t-rvp-accent" /> : <Upload className="h-7 w-7" />}
      </span>
      <button type="button" onClick={() => input.current?.click()} disabled={busy}
        className="rounded-xl bg-rvp-accent px-5 py-3 text-[15px] font-extrabold text-rvp-on-accent hover:bg-rvp-accent-hover disabled:opacity-60">
        {busy ? "Lecture de la vidéo…" : title}
      </button>
      <span className="text-[13px] leading-snug text-rvp-soft">{hint}</span>
      {note ? <span className="text-[12px] leading-snug text-rvp-muted">{note}</span> : null}
      <input ref={input} type="file" accept="video/*" className="sr-only" tabIndex={-1} aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }} />
    </div>
  );
}

/** Aperçu local de la vidéo choisie (rien n'est encore envoyé). */
export function VideoPreview({ url, shape, durationLabel, sizeLabel, name, onChange }: {
  url: string; shape: "wide" | "tall"; durationLabel: string; sizeLabel: string; name?: string; onChange: () => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className={cn("relative overflow-hidden rounded-[22px] border border-rvp-edge-strong bg-black", shape === "tall" ? "mx-auto aspect-[9/16] w-full max-w-[260px]" : "aspect-video w-full")}>
        {/* « #t=0.1 » : Safari sur iPhone montre ainsi la première image avant la lecture. */}
        <video src={`${url}#t=0.1`} controls playsInline preload="metadata" className="absolute inset-0 h-full w-full object-contain" />
      </div>
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 truncate text-[13.5px] text-rvp-soft">
          {name ? <strong className="font-semibold text-rvp-text">{name}</strong> : null}{name ? " · " : ""}{durationLabel} · {sizeLabel}
        </p>
        <button type="button" onClick={onChange}
          className="h-10 shrink-0 rounded-xl border border-white/15 px-3.5 text-[13.5px] font-bold text-rvp-text hover:bg-white/[0.06]">
          Changer
        </button>
      </div>
    </div>
  );
}
