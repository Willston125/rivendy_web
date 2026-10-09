"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Messages et confirmations DANS la page, à la place de alert(), confirm() et
 * prompt(). Les fenêtres natives bloquent la page, ne suivent pas le style du
 * site et peuvent ne pas s'afficher du tout dans certains navigateurs intégrés
 * aux applications : confirm() y vaut alors « non » et prompt() « annuler »,
 * sans que la personne ait rien vu.
 */

type Tone = "info" | "success" | "error";
type Toast = { id: number; message: string; tone: Tone };

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Action destructrice : bouton rouge, et le focus part sur « Annuler ». */
  danger?: boolean;
};
export type AskOptions = ConfirmOptions & { placeholder?: string; maxLength?: number };

type Pending =
  | { id: number; kind: "confirm"; options: ConfirmOptions; resolve: (ok: boolean) => void }
  | { id: number; kind: "ask"; options: AskOptions; resolve: (value: string | null) => void };

type DialogsValue = {
  /** Message bref en bas de l'écran, qui se ferme seul. */
  notify: (message: string, tone?: Tone) => void;
  /** Confirmation : true si la personne confirme. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Texte libre (motif…) : la saisie, éventuellement vide, ou null si annulé. */
  ask: (options: AskOptions) => Promise<string | null>;
};

const DialogsContext = createContext<DialogsValue | null>(null);

function cancel(pending: Pending | null) {
  if (!pending) return;
  if (pending.kind === "confirm") pending.resolve(false);
  else pending.resolve(null);
}

export function DialogsProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, tone: Tone = "info") => {
      const id = ++seq.current;
      setToasts((list) => [...list.slice(-2), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), tone === "error" ? 8000 : 5000);
    },
    [dismiss],
  );

  // Une seule fenêtre à la fois : une nouvelle demande annule la précédente.
  const open = useCallback((next: Pending) => {
    cancel(pendingRef.current);
    pendingRef.current = next;
    setPending(next);
  }, []);

  const close = useCallback(() => {
    pendingRef.current = null;
    setPending(null);
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => open({ id: ++seq.current, kind: "confirm", options, resolve })),
    [open],
  );

  const ask = useCallback(
    (options: AskOptions) =>
      new Promise<string | null>((resolve) => open({ id: ++seq.current, kind: "ask", options, resolve })),
    [open],
  );

  const value = useMemo<DialogsValue>(() => ({ notify, confirm, ask }), [notify, confirm, ask]);

  return (
    <DialogsContext.Provider value={value}>
      {children}
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
      {pending && <DialogBox key={pending.id} pending={pending} onClose={close} />}
    </DialogsContext.Provider>
  );
}

export function useDialogs(): DialogsValue {
  const context = useContext(DialogsContext);
  if (!context) throw new Error("useDialogs doit être utilisé dans DialogsProvider");
  return context;
}

function ToastRegion({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[110] flex flex-col items-center gap-2 px-4"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-2xl py-1 pl-4 pr-1 text-sm font-semibold text-white shadow-lg",
            t.tone === "error" ? "bg-red-600" : t.tone === "success" ? "bg-[#00796B]" : "bg-slate-900",
          )}
        >
          <p className="min-w-0 flex-1 py-2 leading-snug">{t.message}</p>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            aria-label="Fermer le message"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/80 transition hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function DialogBox({ pending, onClose }: { pending: Pending; onClose: () => void }) {
  const { options } = pending;
  const [text, setText] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const finish = useCallback(
    (ok: boolean) => {
      if (pending.kind === "confirm") pending.resolve(ok);
      else pending.resolve(ok ? text.trim() : null);
      onClose();
    },
    [pending, text, onClose],
  );

  // Le gestionnaire clavier lit toujours la dernière version de `finish`.
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  });

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (pending.kind === "ask" ? textRef.current : options.danger ? cancelRef.current : confirmRef.current)?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        finishRef.current(false);
        return;
      }
      if (event.key !== "Tab" || !boxRef.current) return;
      const items = Array.from(boxRef.current.querySelectorAll<HTMLElement>("button, textarea"));
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
    // Ouverture seulement : chaque fenêtre est remontée (clé) pour une nouvelle demande.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) finish(false);
      }}
    >
      <div
        ref={boxRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="rivendy-dialog-title"
        aria-describedby={options.message ? "rivendy-dialog-desc" : undefined}
        className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <h2 id="rivendy-dialog-title" className="text-lg font-black leading-snug text-slate-900">
          {options.title}
        </h2>
        {options.message && (
          <p id="rivendy-dialog-desc" className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">
            {options.message}
          </p>
        )}
        {pending.kind === "ask" && (
          <textarea
            ref={textRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={pending.options.placeholder}
            maxLength={pending.options.maxLength ?? 500}
            rows={3}
            aria-label={options.title}
            className="mt-4 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#009688] focus:bg-white"
          />
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => finish(false)}
            className="h-12 rounded-full border border-slate-200 px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            {options.cancelLabel ?? "Annuler"}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => finish(true)}
            className={cn(
              "h-12 rounded-full px-5 text-sm font-black text-white transition",
              options.danger ? "bg-red-600 hover:bg-red-700" : "bg-[#009688] hover:bg-[#00796B]",
            )}
          >
            {options.confirmLabel ?? "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
}
