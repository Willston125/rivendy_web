"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CheckCircle2, Globe, Loader2, Send } from "lucide-react";
import { DialogShell } from "@/components/ui/dialog-shell";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry } from "@/features/country/country-provider";
import { SUPPORT_REQUEST_ERRORS } from "@/features/help/support-request-form";
import { fetchHomeMarketId } from "@/features/products/publish-market-dialog";
import { supabase } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/utils/format";
import { foreignOrderMessage } from "@/lib/utils/foreign-order";
import { preorderDelayText } from "@/lib/utils/preorder-mode";
import type { Country, Product } from "@/types/rivendy";

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

type Refusal = {
  homeId: string;
  homeName: string;
  foreignName: string;
  plural: boolean;
  /** 2026-10-11 : un article seul → « Commander depuis mon pays ». */
  product?: Product;
  quantity?: number;
};

/**
 * `allows(marchés, { product })` : true si l'achat peut continuer ; sinon la
 * fenêtre s'ouvre (à rendre via `dialog`) et il ne faut rien faire. Avec UN
 * article (`product`), la fenêtre permet de le demander à Rivendy au lieu
 * d'un simple renvoi vers « Sur commande » (miroir de l'app,
 * foreign_order_sheet.dart).
 */
export function useForeignMarketGuard() {
  const router = useRouter();
  const { user } = useAuth();
  const { countries, setCountryId } = useCountry();
  const [refusal, setRefusal] = useState<Refusal | null>(null);

  async function allows(
    productMarketIds: Array<string | null | undefined>,
    opts?: { product?: Product; quantity?: number },
  ): Promise<boolean> {
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
      product: opts?.product,
      quantity: opts?.quantity ?? 1,
    });
    return false;
  }

  async function goToPreorders() {
    const r = refusal;
    setRefusal(null);
    if (!r) return;
    await setCountryId(r.homeId);
    // Le marché dans l'adresse : la page s'ouvre sur celui de l'acheteur même
    // si celui de l'article est encore mémorisé quelque part.
    router.push(`/preorders?country=${encodeURIComponent(r.homeId)}`);
  }

  const dialog = refusal ? (
    refusal.product ? (
      <ForeignOrderDialog
        refusal={refusal}
        product={refusal.product}
        productCountry={countries.find((c) => c.id === refusal.product?.country_id) ?? null}
        onGoPreorders={() => void goToPreorders()}
        onClose={() => setRefusal(null)}
      />
    ) : (
      <ForeignMarketOrderDialog refusal={refusal} onGoPreorders={() => void goToPreorders()} onClose={() => setRefusal(null)} />
    )
  ) : null;

  return { allows, dialog };
}

/** « Commander depuis mon pays » : l'article, ce qui reste à chiffrer, la demande. */
function ForeignOrderDialog({
  refusal,
  product,
  productCountry,
  onGoPreorders,
  onClose,
}: {
  refusal: Refusal;
  product: Product;
  productCountry: Country | null;
  onGoPreorders: () => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const quantity = Math.max(1, refusal.quantity ?? 1);
  const unitPrice = formatMoney(product.price, productCountry);
  const photo = product.photos?.find(Boolean);
  const delay = product.product_type === "preorder"
    ? `${preorderDelayText(product.delivery_days)}, plus le transport`
    : "indiqué par Rivendy dans sa réponse";

  async function send() {
    if (sending) return;
    setSending(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc("create_support_request", {
      p_topic: "order",
      p_message: foreignOrderMessage({
        productId: product.id,
        productTitle: product.title,
        productMarketId: product.country_id ?? "",
        productMarketName: refusal.foreignName,
        unitPriceText: unitPrice,
        quantity,
        homeMarketName: refusal.homeName,
        note,
      }),
      p_order_ref: null,
      p_seller_id: product.seller_id || null,
      p_source: "web",
    });
    setSending(false);
    const res = data as { success?: boolean; error?: string } | null;
    if (rpcError || !res?.success) {
      setError(SUPPORT_REQUEST_ERRORS[res?.error ?? ""] ?? "La demande n'a pas pu être envoyée. Réessayez dans un moment.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <DialogShell labelledBy="foreign-request-title" describedBy="foreign-request-desc" onClose={onClose}>
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-[#009688]" aria-hidden="true" />
          <h2 id="foreign-request-title" className="mt-3 text-lg font-bold text-slate-900">Demande envoyée</h2>
          <p id="foreign-request-desc" className="mt-2 text-sm leading-relaxed text-slate-600">
            Rivendy vous répond dans vos notifications avec le prix final en monnaie de {refusal.homeName}, livraison
            internationale comprise, et le délai. Rien n&apos;est payé pour l&apos;instant.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 min-h-11 w-full rounded-2xl bg-[#007168] px-4 text-sm font-semibold text-white hover:bg-[#005f57]"
          >
            Fermer
          </button>
        </div>
      </DialogShell>
    );
  }

  const rows: Array<[string, string]> = [
    ["Prix de l'article", `${unitPrice} l'unité, prix de son pays`],
    ["Livraison internationale", `calculée par Rivendy pour le trajet ${refusal.foreignName} → ${refusal.homeName}`],
    ["Délai", delay],
    ["Paiement", "rien à payer maintenant : Rivendy vous répond avec le prix final, livraison comprise"],
  ];

  return (
    <DialogShell labelledBy="foreign-request-title" describedBy="foreign-request-desc" onClose={onClose}>
      <div className="flex items-center gap-3">
        <Globe className="h-6 w-6 shrink-0 text-[#009688]" aria-hidden="true" />
        <h2 id="foreign-request-title" className="text-lg font-bold text-slate-900">
          Commander depuis {refusal.homeName}
        </h2>
      </div>
      <p id="foreign-request-desc" className="mt-2 text-sm leading-relaxed text-slate-600">
        Cet article est vendu au marché <strong>{refusal.foreignName}</strong>. Rivendy peut le faire venir pour vous.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
          {photo && <Image src={photo} alt={product.title} fill sizes="56px" className="object-cover" />}
        </div>
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-bold text-slate-800">{product.title}</p>
          <p className="text-xs text-slate-500">Quantité : {quantity}</p>
        </div>
      </div>

      <dl className="mt-4 space-y-1.5 text-sm text-slate-700">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="inline font-bold">{label} : </dt>
            <dd className="inline">{value}</dd>
          </div>
        ))}
      </dl>

      <label htmlFor="foreign-request-note" className="mt-4 block text-sm font-semibold text-slate-700">
        Précisions (taille, couleur…) — facultatif
      </label>
      <textarea
        id="foreign-request-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        rows={2}
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-[#009688] focus:outline-none"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onGoPreorders}
          className="min-h-11 rounded-2xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100"
        >
          Voir « Sur commande » — {refusal.homeName}
        </button>
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#007168] px-4 text-sm font-semibold text-white hover:bg-[#005f57] disabled:opacity-60"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
          {sending ? "Envoi…" : "Demander à Rivendy"}
        </button>
      </div>
    </DialogShell>
  );
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
