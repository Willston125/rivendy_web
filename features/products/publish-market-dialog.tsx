"use client";

import { useEffect, useRef } from "react";
import { Globe } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Country } from "@/types/rivendy";

/* ─────────────────────────────────────────────────────────────────────────
 * 🌍 RAPPEL DU MARCHÉ D'ORIGINE AVANT DE PUBLIER (2026-10-03)
 *
 * Décision propriétaire : un vendeur PEUT vendre sur un autre marché que le
 * sien — la base publie sur le marché ACTIF (current_publish_market(),
 * 20261003_publish_market_active_first.sql). Mais un vendeur qui visitait un
 * autre marché et publie dans la foulée risque de le faire sans s'en rendre
 * compte (prix dans une autre monnaie, acheteurs d'un autre pays). Avant tout
 * envoi, on lui rappelle où il est : publier ici, ou revenir chez lui.
 *
 * Marché d'origine = marché de création du compte
 * (profiles.default_market_country_id, à défaut country_id).
 *
 * Miroir app : rivendy_app/lib/features/products/logic/publish_market_reminder.dart
 * ───────────────────────────────────────────────────────────────────────── */

/** Rappel seulement si les deux marchés sont connus et différents : un marché
 *  d'origine illisible ne bloque jamais une publication. */
export function needsHomeMarketReminder(
  homeMarketId: string | null | undefined,
  activeMarketId: string | null | undefined,
): boolean {
  const home = (homeMarketId ?? "").trim();
  const active = (activeMarketId ?? "").trim();
  return home !== "" && active !== "" && home !== active;
}

/** Marché d'origine du compte, ou null s'il est illisible. */
export async function fetchHomeMarketId(
  client: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("profiles")
    .select("default_market_country_id, country_id")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { default_market_country_id?: string | null; country_id?: string | null };
  const dflt = (row.default_market_country_id ?? "").trim();
  if (dflt) return dflt;
  const pays = (row.country_id ?? "").trim();
  return pays || null;
}

export function PublishMarketDialog({
  active,
  homeName,
  onPublishHere,
  onSwitchHome,
  onClose,
}: {
  active: Country;
  homeName: string;
  onPublishHere: () => void;
  onSwitchHome: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Référence stable : le parent peut passer une fonction neuve à chaque
  // rendu sans relancer l'effet (ce qui ferait sauter le focus).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Focus confiné dans la fenêtre, Échap = fermer sans publier (même
  // sémantique que la modale de marché).
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.querySelector<HTMLElement>("button")?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>("button:not([disabled])"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
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
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-market-title"
        aria-describedby="publish-market-desc"
        className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <Globe className="h-6 w-6 shrink-0 text-[#007168]" aria-hidden="true" />
          <h2 id="publish-market-title" className="text-lg font-bold text-slate-900">
            Tu n&apos;es pas sur ton marché
          </h2>
        </div>
        <div id="publish-market-desc" className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
          <p>
            Tu es sur le marché <strong>{active.name}</strong>. Ton compte a été créé pour{" "}
            <strong>{homeName}</strong>.
          </p>
          <p>
            Si tu continues, l&apos;article sera publié sur le marché {active.name}, au prix indiqué en{" "}
            {active.currency_symbol || active.currency_code}, pour les acheteurs de ce pays.
          </p>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onSwitchHome}
            className="min-h-11 rounded-2xl px-4 text-sm font-semibold text-[#007168] hover:bg-[#007168]/10"
          >
            Revenir sur {homeName}
          </button>
          <button
            type="button"
            onClick={onPublishHere}
            className="min-h-11 rounded-2xl bg-[#007168] px-4 text-sm font-semibold text-white hover:bg-[#005f57]"
          >
            Publier sur {active.name}
          </button>
        </div>
      </div>
    </div>
  );
}
