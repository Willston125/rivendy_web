"use client";

import { Globe } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DialogShell } from "@/components/ui/dialog-shell";
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

// Le marché d'origine ne change qu'à l'inscription : une lecture par compte
// suffit (l'ajout au panier le consulte à chaque clic).
const homeMarketCache = new Map<string, string>();

/** Marché d'origine du compte, ou null s'il est illisible. */
export async function fetchHomeMarketId(
  client: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const cached = homeMarketCache.get(userId);
  if (cached) return cached;
  const { data, error } = await client
    .from("profiles")
    .select("default_market_country_id, country_id")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { default_market_country_id?: string | null; country_id?: string | null };
  const dflt = (row.default_market_country_id ?? "").trim();
  const pays = (row.country_id ?? "").trim();
  const home = dflt || pays || null;
  if (home) homeMarketCache.set(userId, home);
  return home;
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
  return (
    <DialogShell labelledBy="publish-market-title" describedBy="publish-market-desc" onClose={onClose}>
      <div className="flex items-center gap-3">
        <Globe className="h-6 w-6 shrink-0 text-[#007168]" aria-hidden="true" />
        <h2 id="publish-market-title" className="text-lg font-bold text-slate-900">
          Vous n&apos;êtes pas sur votre marché
        </h2>
      </div>
      <div id="publish-market-desc" className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
        <p>
          Vous êtes sur le marché <strong>{active.name}</strong>. Votre compte a été créé pour{" "}
          <strong>{homeName}</strong>.
        </p>
        <p>
          Si vous continuez, l&apos;article sera publié sur le marché {active.name}, au prix indiqué en{" "}
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
    </DialogShell>
  );
}
