"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { DialogShell } from "@/components/ui/dialog-shell";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry } from "@/features/country/country-provider";
import { fetchHomeMarketId } from "@/features/products/publish-market-dialog";
import { supabase } from "@/lib/supabase/client";

/* ─────────────────────────────────────────────────────────────────────────
 * 🌍 COMMANDES HORS DU MARCHÉ D'ORIGINE (2026-10-03)
 *
 * Décision propriétaire : Rivendy ne prend pas encore de commande hors du pays
 * de création du compte. Un acheteur qui visite un autre marché peut tout
 * regarder, mais pas commander : on le lui explique et on l'oriente vers
 * « Sur commande », où Rivendy se charge des produits venus d'ailleurs. Les
 * réservations d'hôtel ne sont PAS concernées.
 *
 * La règle porte sur le marché de CHAQUE article. La base l'impose de son côté
 * (secure_create_order → 'foreign_market', 20261003_orders_home_market_only.sql) :
 * ce garde évite seulement de remplir un panier pour rien.
 *
 * Miroir app : rivendy_app/lib/features/checkout/logic/home_market_order_guard.dart
 * ───────────────────────────────────────────────────────────────────────── */

/** Marchés des articles qui ne sont PAS le marché d'origine. Marché d'origine
 *  inconnu ou marché d'article vide → rien (la base tranchera). */
export function foreignMarketsFor(
  homeMarketId: string | null | undefined,
  productMarketIds: Array<string | null | undefined>,
): string[] {
  const home = (homeMarketId ?? "").trim();
  if (!home) return [];
  const foreign = new Set<string>();
  for (const m of productMarketIds) {
    const market = (m ?? "").trim();
    if (market && market !== home) foreign.add(market);
  }
  return Array.from(foreign);
}

type Refusal = { homeId: string; homeName: string; foreignName: string; plural: boolean };

/**
 * `allows(marchés)` : true si l'achat peut continuer ; sinon la fenêtre
 * d'explication s'ouvre (à rendre via `dialog`) et il ne faut rien faire.
 */
export function useForeignMarketGuard() {
  const router = useRouter();
  const { user } = useAuth();
  const { countries, setCountryId } = useCountry();
  const [refusal, setRefusal] = useState<Refusal | null>(null);

  async function allows(productMarketIds: Array<string | null | undefined>): Promise<boolean> {
    // Sans compte, le paiement exige de toute façon une connexion.
    if (!user) return true;
    const homeId = await fetchHomeMarketId(supabase, user.id);
    const foreign = foreignMarketsFor(homeId, productMarketIds);
    if (!homeId || foreign.length === 0) return true;
    const nameOf = (id: string) => countries.find((c) => c.id === id)?.name ?? id;
    setRefusal({
      homeId,
      homeName: nameOf(homeId),
      foreignName: nameOf(foreign[0]),
      plural: productMarketIds.length > 1,
    });
    return false;
  }

  async function goToPreorders() {
    const r = refusal;
    setRefusal(null);
    if (!r) return;
    await setCountryId(r.homeId);
    router.push("/preorders");
  }

  const dialog = refusal ? (
    <ForeignMarketOrderDialog refusal={refusal} onGoPreorders={() => void goToPreorders()} onClose={() => setRefusal(null)} />
  ) : null;

  return { allows, dialog };
}

function ForeignMarketOrderDialog({
  refusal,
  onGoPreorders,
  onClose,
}: {
  refusal: Refusal;
  onGoPreorders: () => void;
  onClose: () => void;
}) {
  return (
    <DialogShell labelledBy="foreign-order-title" describedBy="foreign-order-desc" onClose={onClose}>
      <div className="flex items-center gap-3">
        <Globe className="h-6 w-6 shrink-0 text-[#E65100]" aria-hidden="true" />
        <h2 id="foreign-order-title" className="text-lg font-bold text-slate-900">
          Commande hors de votre pays
        </h2>
      </div>
      <div id="foreign-order-desc" className="mt-3 space-y-2 text-sm leading-relaxed text-slate-600">
        <p>
          {refusal.plural ? "Des articles de votre commande viennent" : "Cet article vient"} du marché{" "}
          <strong>{refusal.foreignName}</strong>. Votre compte a été créé pour <strong>{refusal.homeName}</strong> :
          Rivendy ne prend pas encore de commandes hors de votre pays.
        </p>
        <p>
          Pour acheter des produits d&apos;un autre pays, passez par « Sur commande » : Rivendy s&apos;en charge pour vous.
        </p>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-2xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100"
        >
          Fermer
        </button>
        <button
          type="button"
          onClick={onGoPreorders}
          className="min-h-11 rounded-2xl bg-[#007168] px-4 text-sm font-semibold text-white hover:bg-[#005f57]"
        >
          Aller sur « Sur commande »
        </button>
      </div>
    </DialogShell>
  );
}
