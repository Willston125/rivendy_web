"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Fenêtres de « publier une vidéo » (lots 3 et 4, 2026-11-11). Elles
 * s'attachent à la coque de Play (`.rvp-scope`) : ses jetons — vert de Play
 * ou turquoise des Clips — et ses polices les suivent, et aucune colonne qui
 * défile ne les coupe.
 */
export function usePlayPortal(): HTMLElement | null {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setTarget(document.querySelector<HTMLElement>(".rvp-scope") ?? document.body);
  }, []);
  return target;
}

/** Échap ferme ; le focus entre dans la fenêtre, y reste (Tab) et revient au bouton à la fermeture. */
function useDialogFocus(box: RefObject<HTMLElement | null>, onClose: () => void, ready: boolean) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!ready) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Le choix en cours (data-autofocus) d'abord, sinon la première action.
    const root = box.current;
    (root?.querySelector<HTMLElement>("[data-autofocus]") ?? root?.querySelector<HTMLElement>("a[href], button:not([data-close])"))?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
        return;
      }
      if (e.key !== "Tab" || !box.current) return;
      const items = Array.from(box.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input, textarea, select"));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [box, ready]);
}

/** Feuille posée en bas de l'écran sur téléphone, fenêtre centrée au-dessus de 640 px. */
export function PlaySheet({ title, subtitle, onClose, children }: {
  title: string; subtitle?: string; onClose: () => void; children: ReactNode;
}) {
  const target = usePlayPortal();
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  useDialogFocus(box, onClose, !!target);
  if (!target) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" aria-label="Fermer" tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default bg-black/60" />
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="relative flex max-h-[88dvh] w-full flex-col gap-3 overflow-y-auto rounded-t-3xl border-t border-rvp-edge-strong bg-rvp-surface px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2.5 font-rvp-body text-rvp-text sm:max-w-md sm:rounded-3xl sm:border sm:p-5">
        <span aria-hidden className="h-1 w-10 shrink-0 self-center rounded-full bg-white/20 sm:hidden" />
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-rvp-display text-[22px] font-extrabold tracking-[-0.02em]">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[13.5px] leading-snug text-rvp-soft">{subtitle}</p> : null}
          </div>
          <button type="button" data-close onClick={onClose} aria-label="Fermer"
            className="-mr-1.5 -mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-rvp-raised text-rvp-text hover:bg-white/[0.12]">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>,
    target,
  );
}

/** Menu ancré au bouton d'une colonne (tablette, ordinateur), en position fixe : la colonne qui défile ne le coupe pas. */
export function PlayPopover({ position, label, onClose, children }: {
  position: { left: number; top: number }; label: string; onClose: () => void; children: ReactNode;
}) {
  const target = usePlayPortal();
  const box = useRef<HTMLDivElement>(null);
  useDialogFocus(box, onClose, !!target);
  if (!target) return null;
  return createPortal(
    <>
      <button type="button" aria-label="Fermer" tabIndex={-1} onClick={onClose} className="fixed inset-0 z-[70] cursor-default" />
      <div ref={box} role="dialog" aria-label={label} style={{ left: position.left, top: position.top }}
        className="fixed z-[71] w-[400px] max-w-[calc(100vw-24px)] rounded-[20px] border border-rvp-edge-strong bg-rvp-surface p-3 font-rvp-body text-rvp-text shadow-[0_30px_60px_-20px_rgba(0,0,0,0.75)]">
        {children}
      </div>
    </>,
    target,
  );
}
