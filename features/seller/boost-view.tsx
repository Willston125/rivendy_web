"use client";

import { useCallback, useEffect, useState } from "react";
import { Zap, CheckCircle2, Copy, CheckCircle } from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountryOrDefault } from "@/features/country/country-provider";
import { firstPhoto, formatMoney, normalizePhoneForWhatsApp } from "@/lib/utils/format";
import { supabase } from "@/lib/supabase/client";
import { CASH_METHOD, getMobileMoneyForCountry } from "@/lib/utils/mobile-money";
import type { BoostPurchaseInput, Product } from "@/types/rivendy";

/* ── Tiers ─────────────────────────────────────────────────── */

interface BoostTier {
  id: "bronze" | "argent" | "or";
  name: string;
  emoji: string;
  priceFDJ: number;
  priceKMF: number;
  durationDays: number;
  color: string;
  bgColor: string;
  isPopular?: boolean;
  benefits: string[];
}

// Parity Flutter boost_screen.dart — priceForMarket(marketId)
function priceForMarket(tier: BoostTier, countryId: string): number {
  return countryId === "KM" ? tier.priceKMF : tier.priceFDJ;
}

const TIERS: BoostTier[] = [
  {
    id: "bronze",
    name: "Bronze",
    emoji: "🥉",
    priceFDJ: 500,
    priceKMF: 1250,
    durationDays: 3,
    color: "#CD7F32",
    bgColor: "#FFF8F0",
    benefits: [
      "Mis en avant pendant 3 jours",
      "Badge \"Boosté\" sur l'annonce",
      "Priorité dans les résultats",
    ],
  },
  {
    id: "argent",
    name: "Argent",
    emoji: "🥈",
    priceFDJ: 1500,
    priceKMF: 3750,
    durationDays: 7,
    color: "#9E9E9E",
    bgColor: "#F8F8F8",
    isPopular: true,
    benefits: [
      "Mis en avant pendant 7 jours",
      "Badge \"Boosté\" sur l'annonce",
      "Top du fil d'actualité",
      "Notifications push aux acheteurs",
    ],
  },
  {
    id: "or",
    name: "Or",
    emoji: "🥇",
    priceFDJ: 3000,
    priceKMF: 7500,
    durationDays: 15,
    color: "#FFB800",
    bgColor: "#FFFBEB",
    benefits: [
      "Mis en avant pendant 15 jours",
      "Badge \"Boosté Or\" sur l'annonce",
      "Position #1 dans sa catégorie",
      "Notifications push aux acheteurs",
      "Statistiques avancées de vues",
    ],
  },
];

/* ── Boost inclus dans l'abonnement (crédits serveur) ──────────
   Parité app : RPC get_boost_credit_status / use_boost_credit — fichier
   propriétaire 20260809_subscription_tiers_boost_credits.sql. Le décompte
   vit ENTIÈREMENT côté serveur ; le client ne fait qu'afficher. */

interface BoostCreditStatus {
  hasSubscription: boolean;
  tier: string | null;
  remaining: number;
}

const NO_CREDITS: BoostCreditStatus = {
  hasSubscription: false,
  tier: null,
  remaining: 0,
};

// Codes RAISE EXCEPTION de use_boost_credit → messages métier affichables.
const CREDIT_ERRORS: Record<string, string> = {
  NO_ACTIVE_SUBSCRIPTION:
    "Abonnement expiré — renouvelez-le pour retrouver vos boosts inclus.",
  NOT_PRODUCT_OWNER: "Ce produit n'appartient pas à votre boutique.",
  PRODUCT_NOT_BOOSTABLE:
    "Seul un article actif peut recevoir un boost inclus.",
  NO_CREDITS_LEFT:
    "0 boost inclus restant ce mois-ci — ils reviennent au prochain cycle.",
};

/* ── Component ─────────────────────────────────────────────── */

export function BoostView({ product }: { product: Product }) {
  const { user } = useAuth();
  const countryNullable = useCountryOrDefault();
  const country = countryNullable as any;
  const [selectedTier, setSelectedTier] = useState<BoostTier | null>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [credits, setCredits] = useState<BoostCreditStatus>(NO_CREDITS);
  const [confirmCredit, setConfirmCredit] = useState(false);
  const [usingCredit, setUsingCredit] = useState(false);
  const [creditMessage, setCreditMessage] =
    useState<{ ok: boolean; text: string } | null>(null);

  const loadCredits = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.rpc("get_boost_credit_status");
      if (error || !data) return;
      const row = data as Record<string, unknown>;
      setCredits({
        hasSubscription: Boolean(row.has_subscription),
        tier: (row.tier as string) ?? null,
        remaining: Number(row.remaining ?? 0),
      });
    } catch {
      // Silencieux — sans statut, la carte « boost inclus » ne s'affiche pas.
    }
  }, [user]);

  useEffect(() => {
    loadCredits();
  }, [loadCredits]);

  // Miroir de la condition serveur : seul un produit 'active' est boostable
  // (pas de produit suspendu/épuisé, pas d'empilement sur un boost en cours).
  const isProductBoostable = product.status === "active";

  async function useIncludedBoost() {
    if (!user || usingCredit) return;
    setUsingCredit(true);
    setCreditMessage(null);
    try {
      const { data, error } = await supabase.rpc("use_boost_credit", {
        p_product_id: product.id,
      });
      if (error) throw error;
      const remaining = Number(
        (data as Record<string, unknown> | null)?.remaining ?? 0,
      );
      setCredits((c) => ({ ...c, remaining }));
      setConfirmCredit(false);
      setCreditMessage({
        ok: true,
        text: `⚡ Boost 3 jours activé ! ${remaining} restant(s) ce mois-ci.`,
      });
    } catch (err) {
      const raw = (err as { message?: string })?.message ?? "";
      const known = Object.keys(CREDIT_ERRORS).find((k) => raw.includes(k));
      setConfirmCredit(false);
      setCreditMessage({
        ok: false,
        text: known ? CREDIT_ERRORS[known] : "Le boost inclus a échoué, réessayez.",
      });
      // Le refus peut venir d'un décompte dépassé : rafraîchir le compteur.
      loadCredits();
    } finally {
      setUsingCredit(false);
    }
  }

  // Jamais de numéro en dur — miroir de mobile_money_data.dart (parité app).
  const paymentMethods = getMobileMoneyForCountry(country?.id ?? "");
  const selectedMethod =
    paymentMethods.find((m) => m.id === selectedMethodId && m.enabled) ??
    paymentMethods.find((m) => m.enabled) ??
    CASH_METHOD;
  const isCash = selectedMethod.id === "cash";

  const reference = `BOOST-${product.id.slice(0, 8).toUpperCase()}-${selectedTier?.id.toUpperCase() ?? ""}`;
  // Jamais de numéro en dur — source unique : le pays actif.
  const whatsapp = normalizePhoneForWhatsApp(country.whatsapp_number);

  function copyReference() {
    navigator.clipboard.writeText(reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handlePaid(tier: BoostTier) {
    if (!user) return;
    setSubmitting(true);

    try {
      const payload: BoostPurchaseInput = {
        product_id: product.id,
        seller_id: user.id,
        plan: tier.id,
        price_paid: priceForMarket(tier, country?.id),
        duration_days: tier.durationDays,
        status: "pending",
        // Parité subscription : l'id de la méthode choisie (waafi_dj, cash…).
        payment_method: selectedMethod.id,
        country_id: country?.id,
        payment_reference: reference,
      };
      await supabase.from("boost_purchases").insert(payload);
    } catch (_) {
      // non-blocking
    }

    const msg = encodeURIComponent(
      `Bonjour Rivendy ⚡\n\n` +
        `J'ai payé pour le boost *${tier.name}* (${tier.durationDays} jours) pour mon article :\n` +
        `📦 *ID:* ${product.id}\n` +
        `📝 *Titre:* ${product.title}\n\n` +
        `🔢 *Référence:* ${reference}\n\n` +
        `Merci de valider mon boost !`
    );
    window.open(`https://wa.me/${whatsapp}?text=${msg}`, "_blank");
    setSelectedTier(null);
    setSubmitting(false);
  }

  if (!country) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-wider text-[#009688]">Rivendy</p>
        <h1 className="mt-1 text-3xl font-black text-[#1A1A1A]">Booster mon annonce</h1>
      </div>

      {/* Product preview */}
      <div className="mb-6 flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm">
        <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-slate-100">
          <Image
            src={firstPhoto(product)}
            alt={product.title}
            fill
            className="object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate font-bold text-[#1A1A1A]">{product.title}</p>
          <p className="mt-1 text-base font-black text-[#009688]">
            {formatMoney(product.price, country)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[#009688]/10 px-3 py-1 text-xs font-semibold text-[#009688]">
          En vente
        </span>
      </div>

      {/* Info banner */}
      <div className="mb-6 flex gap-3 rounded-2xl border border-[#009688]/20 bg-[#E8F5E9] p-4">
        <Zap className="h-6 w-6 shrink-0 text-[#009688]" />
        <p className="text-sm leading-relaxed text-[#004D40]">
          Un boost augmente la visibilité de votre annonce et attire plus
          d&apos;acheteurs potentiels.
        </p>
      </div>

      {/* Boost inclus — abonnés Certifié/Pro (parité app) */}
      {credits.hasSubscription &&
        (credits.tier === "certified" || credits.tier === "pro") && (
          <div
            className={`mb-6 rounded-2xl border-[1.5px] p-4 ${
              credits.remaining > 0 && isProductBoostable
                ? "border-[#009688] bg-[#E8F5F3]"
                : "border-slate-300 bg-slate-100"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚡</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-[#1A1A1A]">
                  Boost inclus — abonnement{" "}
                  {credits.tier === "pro" ? "Pro" : "Certifié"}
                </p>
                <p className="text-xs text-slate-600">
                  {credits.remaining > 0
                    ? `3 jours de mise en avant · ${credits.remaining} restant(s) ce mois-ci`
                    : "0 restant ce mois-ci — revient au prochain cycle"}
                </p>
                {credits.remaining > 0 && !isProductBoostable && (
                  <p className="mt-1 text-xs font-semibold text-orange-600">
                    Seul un article actif peut recevoir un boost inclus.
                  </p>
                )}
              </div>
              {!confirmCredit && (
                <button
                  type="button"
                  disabled={
                    credits.remaining <= 0 || !isProductBoostable || usingCredit
                  }
                  onClick={() => setConfirmCredit(true)}
                  className="shrink-0 rounded-xl bg-[#009688] px-4 py-2.5 text-xs font-black text-white transition hover:bg-[#00796B] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Booster ⚡
                </button>
              )}
            </div>
            {confirmCredit && (
              <div className="mt-3 rounded-xl bg-white p-3">
                <p className="text-sm text-slate-600">
                  Votre article sera mis en avant pendant 3 jours, sans
                  paiement. Il vous restera{" "}
                  <strong>{credits.remaining - 1}</strong> boost(s) inclus ce
                  mois-ci.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={usingCredit}
                    onClick={useIncludedBoost}
                    className="flex-1 rounded-xl bg-[#009688] py-2.5 text-sm font-black text-white transition hover:bg-[#00796B] disabled:opacity-60"
                  >
                    {usingCredit ? "Activation…" : "Confirmer — Booster ⚡"}
                  </button>
                  <button
                    type="button"
                    disabled={usingCredit}
                    onClick={() => setConfirmCredit(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-500 transition hover:bg-slate-50"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
            {creditMessage && (
              <p
                className={`mt-3 rounded-xl px-3 py-2 text-sm font-semibold ${
                  creditMessage.ok
                    ? "bg-[#E0F2F1] text-[#00796B]"
                    : "bg-red-50 text-red-600"
                }`}
              >
                {creditMessage.text}
              </p>
            )}
          </div>
        )}

      {/* Tiers */}
      <h2 className="mb-3 text-lg font-black text-[#1A1A1A]">
        Choisissez votre boost
      </h2>

      <div className="grid gap-4 md:grid-cols-3 md:items-stretch">
        {TIERS.map((tier) => (
          <div
            key={tier.id}
            className="relative flex flex-col overflow-hidden rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md"
            style={{
              border: tier.isPopular ? `2px solid ${tier.color}` : `1.5px solid ${tier.color}33`,
            }}
          >
            {tier.isPopular && (
              <div
                className="absolute right-0 top-0 rounded-bl-xl px-3 py-1.5 text-[10px] font-black text-white"
                style={{ backgroundColor: tier.color }}
              >
                POPULAIRE
              </div>
            )}

            {/* Header centré (pricing card) */}
            <div className="text-center">
              <span className="text-4xl">{tier.emoji}</span>
              <p className="mt-2 font-black" style={{ color: tier.color }}>
                Boost {tier.name}
              </p>
              <p className="text-sm text-slate-500">{tier.durationDays} jours</p>
              <p className="mt-3 text-2xl font-black" style={{ color: tier.color }}>
                {formatMoney(priceForMarket(tier, country?.id), country)}
              </p>
              <p className="text-xs text-slate-400">
                soit{" "}
                {Math.round(priceForMarket(tier, country?.id) / tier.durationDays).toLocaleString("fr-FR")}{" "}
                {country?.currency_symbol}/jour
              </p>
            </div>

            <hr className="my-4 border-slate-100" />

            {/* Benefits */}
            <ul className="mb-5 space-y-2">
              {tier.benefits.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm text-slate-600">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0"
                    style={{ color: tier.color }}
                  />
                  {b}
                </li>
              ))}
            </ul>

            {/* Button — collé en bas pour aligner les cartes */}
            <button
              type="button"
              onClick={() => setSelectedTier(tier)}
              className="mt-auto w-full rounded-xl py-3 text-sm font-black text-white transition hover:opacity-90"
              style={{ backgroundColor: tier.color }}
            >
              Choisir {tier.name}
            </button>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
        Paiement vérifié manuellement sous 24h
        <br />
        {/* Jamais de numéro en dur — source unique : le pays actif. */}
        Support : WhatsApp {country.whatsapp_number}
      </p>

      {/* Payment modal */}
      {selectedTier && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setSelectedTier(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle — mobile uniquement */}
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />

            {/* Title */}
            <div className="mb-5 flex items-start gap-3">
              <span className="text-2xl">{selectedTier.emoji}</span>
              <div>
                <p
                  className="text-lg font-black"
                  style={{ color: selectedTier.color }}
                >
                  Boost {selectedTier.name}
                </p>
                <p className="text-sm text-slate-500">
                  {selectedTier.durationDays} jours ·{" "}
                  {formatMoney(priceForMarket(selectedTier, country?.id), country)}
                </p>
              </div>
            </div>

            {/* Method selector */}
            <p className="mb-2 font-bold text-[#1A1A1A]">
              Méthode de paiement
            </p>
            <div className="mb-5 grid grid-cols-2 gap-2">
              {paymentMethods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={!m.enabled}
                  onClick={() => setSelectedMethodId(m.id)}
                  className="rounded-xl border px-2 py-3 text-center text-xs font-bold transition disabled:cursor-not-allowed"
                  style={{
                    borderColor:
                      selectedMethod.id === m.id ? m.color : "#E2E8F0",
                    backgroundColor:
                      selectedMethod.id === m.id ? `${m.color}15` : "#F8FAFC",
                    color: m.enabled
                      ? selectedMethod.id === m.id
                        ? m.color
                        : "#475569"
                      : "#CBD5E1",
                  }}
                >
                  {m.name}
                  {!m.enabled && (
                    <span className="mt-1 block text-[9px] font-semibold text-slate-400">
                      Bientôt disponible
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Instructions */}
            <div className="mb-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="mb-3 text-sm font-bold text-slate-700">
                Instructions de paiement
              </p>

              {/* Step 1 */}
              <div className="mb-2 flex gap-2">
                <div
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
                  style={{ backgroundColor: selectedTier.color }}
                >
                  1
                </div>
                {!isCash && selectedMethod.number ? (
                  <p className="text-sm text-slate-600">
                    Envoyez{" "}
                    <strong>{formatMoney(priceForMarket(selectedTier, country?.id), country)}</strong>{" "}
                    au numéro {selectedMethod.name} :{" "}
                    <strong
                      style={{ color: selectedTier.color }}
                    >
                      {selectedMethod.number}
                    </strong>
                  </p>
                ) : (
                  <p className="text-sm text-slate-600">
                    Contactez-nous sur WhatsApp pour convenir du paiement en
                    espèces.
                  </p>
                )}
              </div>

              {/* Step 2 */}
              <div className="mb-2 flex gap-2">
                <div
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
                  style={{ backgroundColor: selectedTier.color }}
                >
                  2
                </div>
                <div className="flex-1">
                  <p className="mb-2 text-sm text-slate-600">
                    Mentionnez la référence dans le motif :
                  </p>
                  <button
                    type="button"
                    onClick={copyReference}
                    className="flex w-full items-center justify-between rounded-xl border px-3 py-2 transition hover:opacity-80"
                    style={{
                      borderColor: `${selectedTier.color}66`,
                      backgroundColor: "white",
                    }}
                  >
                    <span
                      className="text-sm font-bold tracking-wide"
                      style={{ color: selectedTier.color }}
                    >
                      {reference}
                    </span>
                    {copied ? (
                      <CheckCircle
                        className="h-4 w-4"
                        style={{ color: selectedTier.color }}
                      />
                    ) : (
                      <Copy
                        className="h-4 w-4"
                        style={{ color: selectedTier.color }}
                      />
                    )}
                  </button>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-2">
                <div
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
                  style={{ backgroundColor: selectedTier.color }}
                >
                  3
                </div>
                <p className="text-sm text-slate-600">
                  Cliquez sur &quot;J&apos;ai payé&quot; ci-dessous. Notre
                  équipe activera votre boost sous 24h.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={() => handlePaid(selectedTier)}
              className="w-full rounded-xl py-4 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: selectedTier.color }}
            >
              J&apos;ai payé — Activer mon boost
            </button>
            <p className="mt-2 text-center text-xs text-slate-400">
              En cliquant, vous confirmez avoir effectué le paiement.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
