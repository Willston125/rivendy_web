"use client";

import { useState } from "react";
import { BadgeCheck, Copy, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountryOrDefault } from "@/features/country/country-provider";
import { formatMoney, normalizePhoneForWhatsApp } from "@/lib/utils/format";
import { supabase } from "@/lib/supabase/client";
import { CASH_METHOD, getMobileMoneyForCountry } from "@/lib/utils/mobile-money";
import type { SellerSubscriptionInput } from "@/types/rivendy";

/* ── Plans ─────────────────────────────────────────────────── */

type SubscriptionTier = "certified" | "pro";

interface Plan {
  id: string;
  tier: SubscriptionTier;
  /** Valeur envoyée dans la colonne plan ('monthly' | 'yearly'). */
  dbPlan: "monthly" | "yearly";
  label: string;
  emoji: string;
  priceFDJ: number;
  priceKMF: number;
  durationDays: number;
  durationLabel: string;
  buttonLabel: string;
  savingsLabel?: string;
  badge?: string;
  badgeColor?: string;
  isPopular?: boolean;
  features: string[];
}

// Parity Flutter subscription_screen.dart — priceForMarket(marketId)
function priceForMarket(plan: Plan, countryId: string): number {
  return countryId === "KM" ? plan.priceKMF : plan.priceFDJ;
}

function tierLabel(tier: SubscriptionTier): string {
  return tier === "pro" ? "Pro" : "Certifié";
}

// Grille validée par le propriétaire le 2026-08-09 — miroir EXACT de
// rivendy_app/lib/features/auth/screens/subscription_screen.dart
// (subscriptionPlans, gardé par subscription_plans_test.dart).
// Annuel = 10 mois payés. La formule hebdomadaire n'est plus vendue.
const CERTIFIED_FEATURES = [
  "Badge ✅ Vendeur Certifié",
  "Stories affichées 72 h au lieu de 24 h",
  "⚡ 2 boosts 3 jours inclus / mois",
  "🎬 Stories vidéo",
  "🎬 15 vidéos produit / mois",
  "🎬 Vidéo de couverture boutique",
];

const PRO_FEATURES = [
  "Badge ✅ Vendeur Certifié",
  "Stories affichées 72 h au lieu de 24 h",
  "⚡ 4 boosts 3 jours inclus / mois",
  "🎬 Stories vidéo",
  "🎬 Vidéos produit illimitées",
  "🎬 Vidéo de couverture boutique",
];

const PLANS: Plan[] = [
  {
    id: "certified_monthly",
    tier: "certified",
    dbPlan: "monthly",
    label: "Mensuel",
    emoji: "📅",
    priceFDJ: 1500,
    priceKMF: 3000,
    durationDays: 30,
    durationLabel: "30 jours",
    buttonLabel: "S'abonner 30 jours",
    badge: "LE PLUS POPULAIRE",
    badgeColor: "#009688",
    isPopular: true,
    features: CERTIFIED_FEATURES,
  },
  {
    id: "certified_yearly",
    tier: "certified",
    dbPlan: "yearly",
    label: "Annuel",
    emoji: "🏆",
    priceFDJ: 15000,
    priceKMF: 30000,
    durationDays: 365,
    durationLabel: "1 an",
    buttonLabel: "S'abonner 1 an",
    savingsLabel: "2 mois offerts",
    badge: "MEILLEUR PRIX",
    badgeColor: "#FFB800",
    features: CERTIFIED_FEATURES,
  },
  {
    id: "pro_monthly",
    tier: "pro",
    dbPlan: "monthly",
    label: "Mensuel",
    emoji: "🚀",
    priceFDJ: 3500,
    priceKMF: 7500,
    durationDays: 30,
    durationLabel: "30 jours",
    buttonLabel: "S'abonner 30 jours",
    features: PRO_FEATURES,
  },
  {
    id: "pro_yearly",
    tier: "pro",
    dbPlan: "yearly",
    label: "Annuel",
    emoji: "🏆",
    priceFDJ: 35000,
    priceKMF: 75000,
    durationDays: 365,
    durationLabel: "1 an",
    buttonLabel: "S'abonner 1 an",
    savingsLabel: "2 mois offerts",
    badge: "MEILLEUR PRIX",
    badgeColor: "#FFB800",
    features: PRO_FEATURES,
  },
];

/* ── Component ─────────────────────────────────────────────── */

export function SubscriptionView() {
  const { user, profile } = useAuth();
  const countryNullable = useCountryOrDefault();
  const country = countryNullable as any;
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>("certified");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Jamais de numéro en dur — miroir de mobile_money_data.dart (parité app).
  const paymentMethods = getMobileMoneyForCountry(country?.id ?? "");
  const selectedMethod =
    paymentMethods.find((m) => m.id === selectedMethodId && m.enabled) ??
    paymentMethods.find((m) => m.enabled) ??
    CASH_METHOD;
  const isCash = selectedMethod.id === "cash";

  const userName = profile?.full_name ?? "USER";
  const userId = userName.replace(/\s/g, "").toUpperCase().slice(0, 6) || "USER";
  // Préfixe selon la formule — parité subscription_screen.dart (PRO-/CERT-).
  const reference = `${(selectedPlan?.tier ?? selectedTier) === "pro" ? "PRO" : "CERT"}-${userId}`;

  const visiblePlans = PLANS.filter((plan) => plan.tier === selectedTier);

  const whatsapp = normalizePhoneForWhatsApp(country.whatsapp_number);

  function copyReference() {
    navigator.clipboard.writeText(reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handlePaid(plan: Plan) {
    if (!user) return;
    setSubmitting(true);

    try {
      const payload: SellerSubscriptionInput = {
        seller_id: user.id,
        plan: plan.dbPlan,
        tier: plan.tier,
        price_paid: priceForMarket(plan, country?.id),
        duration_days: plan.durationDays,
        status: "pending",
        // Parité subscription_screen.dart — l'id de la méthode choisie.
        payment_method: selectedMethod.id,
        country_id: country?.id,
        payment_reference: reference,
      };
      await supabase.from("seller_subscriptions").insert(payload);
    } catch (_) {
      // non-blocking
    }

    const formattedPrice = formatMoney(priceForMarket(plan, country?.id), country);
    const msg = encodeURIComponent(
      `Bonjour Rivendy, j'ai effectué le paiement pour mon abonnement Vendeur ${tierLabel(plan.tier)}.\n\n` +
        `• Formule : ${tierLabel(plan.tier)}\n` +
        `• Plan : ${plan.label} (${plan.durationLabel})\n` +
        `• Montant : ${formattedPrice}\n` +
        `• Mode de paiement : ${selectedMethod.name}\n` +
        `• Référence : ${reference}\n` +
        `• Nom : ${userName}\n\n` +
        `Merci de valider mon badge. 🙏`
    );
    window.open(`https://wa.me/${whatsapp}?text=${msg}`, "_blank");
    setSelectedPlan(null);
    setSubmitting(false);
  }

  if (!country) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-6">
      {/* Header gradient */}
      <div className="mb-6 rounded-3xl bg-gradient-to-br from-[#00897B] to-[#004D40] p-8 text-center text-white shadow-xl shadow-[#007168]/20">
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-lg shadow-black/20">
          <BadgeCheck className="h-14 w-14 text-[#009688]" />
        </div>
        <h1 className="text-2xl font-black leading-tight">
          Devenir Vendeur Certifié ✅
        </h1>
        <p className="mt-2 text-sm text-white/70">
          Gagnez la confiance de vos acheteurs
        </p>
        <div className="mt-4 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm leading-relaxed">
          Votre badge apparaît sur votre profil
          <br />
          et sur CHAQUE produit que vous publiez
        </div>
      </div>

      {/* Badge preview */}
      <div className="mb-6">
        <p className="mb-3 text-sm font-bold text-[#1A1A1A]">
          Aperçu de ce que verront les acheteurs
        </p>
        <div className="grid grid-cols-2 gap-3">
          {/* Preview product */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="relative flex aspect-square items-center justify-center bg-[#E8F5E9]">
              <span className="text-4xl">🛍</span>
              <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-lg bg-white px-2 py-1 shadow-sm">
                <BadgeCheck className="h-3 w-3 text-[#009688]" />
                <span className="text-[9px] font-bold text-[#009688]">Certifié</span>
              </div>
            </div>
            <div className="p-2">
              <p className="text-sm font-black text-[#009688]">{formatMoney(priceForMarket(PLANS[0], country?.id), country)}</p>
              <p className="truncate text-xs text-slate-500">Produit exemple</p>
            </div>
          </div>
          {/* Preview profile */}
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#00C4B4] to-[#6A5ACD]">
              <span className="text-2xl">👤</span>
            </div>
            <p className="text-sm font-black text-[#1A1A1A]">Votre Nom</p>
            <div className="mt-2 flex items-center gap-1 rounded-full bg-[#009688]/10 px-2 py-1">
              <BadgeCheck className="h-3.5 w-3.5 text-[#009688]" />
              <span className="text-[10px] font-bold text-[#009688]">Certifié Rivendy</span>
            </div>
            <p className="mt-2 text-center text-[10px] italic text-slate-400">
              ← Votre badge
              <br />
              visible ici
            </p>
          </div>
        </div>
      </div>

      {/* Plans */}
      <h2 className="mb-1 text-lg font-black text-[#1A1A1A]">
        Choisissez votre abonnement
      </h2>
      <p className="mb-4 text-sm text-slate-400">Résiliable à tout moment</p>

      {/* Sélecteur de formule — parité subscription_screen.dart (_buildTierTab) */}
      <div className="mb-5 flex rounded-xl bg-slate-100 p-1">
        {(["certified", "pro"] as const).map((tier) => (
          <button
            key={tier}
            type="button"
            onClick={() => setSelectedTier(tier)}
            className={`flex-1 rounded-lg py-2.5 text-sm font-black transition ${
              selectedTier === tier
                ? "bg-white text-[#009688] shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tier === "pro" ? "🚀 Pro" : "✅ Certifié"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
        {visiblePlans.map((plan) => {
          const displaySavings = plan.savingsLabel
            ? plan.dbPlan === "yearly"
              ? `${plan.savingsLabel} — soit ~${Math.round(priceForMarket(plan, country?.id) / 12).toLocaleString("fr-FR")} ${country?.currency_symbol}/mois`
              : plan.savingsLabel
            : null;

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col overflow-hidden rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md ${
                plan.isPopular
                  ? "border-2 border-[#009688] shadow-lg shadow-[#009688]/10"
                  : "border border-slate-200"
              } ${plan.badge ? "pt-9" : ""}`}
            >
              {plan.badge && (
                <div
                  className="absolute right-0 top-0 rounded-bl-xl px-3 py-1.5 text-[10px] font-black text-white"
                  style={{ backgroundColor: plan.badgeColor }}
                >
                  {plan.badge}
                </div>
              )}

              {/* Header centré (pricing card) */}
              <div className="text-center">
                <span className="text-3xl">{plan.emoji}</span>
                <p className="mt-2 font-black text-[#1A1A1A]">{plan.label}</p>
                <p
                  className={`mt-2 text-2xl font-black ${
                    plan.isPopular ? "text-[#009688]" : "text-[#1A1A1A]"
                  }`}
                >
                  {formatMoney(priceForMarket(plan, country?.id), country)}
                </p>
                <p className="text-xs text-slate-400">/ {plan.durationLabel}</p>
              </div>

              {/* Savings */}
              {displaySavings && (
                <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-center">
                  <p className="text-xs font-semibold text-green-700">
                    💰 {displaySavings}
                  </p>
                </div>
              )}

              <hr className="my-4 border-slate-100" />

              {/* Features */}
              <ul className="mb-5 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#009688]" />
                    {f}
                  </li>
                ))}
              </ul>

              {/* Button — collé en bas pour aligner les cartes */}
              <button
                type="button"
                onClick={() => setSelectedPlan(plan)}
                className={`mt-auto w-full rounded-xl py-3 text-sm font-black text-white transition ${
                  plan.isPopular
                    ? "bg-[#009688] hover:bg-[#00796B]"
                    : "bg-[#1A1A1A] hover:bg-[#333]"
                }`}
              >
                {plan.buttonLabel}
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
        Paiement vérifié manuellement sous 2h
        <br />
        {/* Jamais de numéro en dur — source unique : le pays actif. */}
        Support : WhatsApp {country.whatsapp_number}
      </p>

      {/* Payment modal overlay */}
      {selectedPlan && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setSelectedPlan(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle — mobile uniquement */}
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />

            {/* Title */}
            <div className="mb-5 flex items-start gap-3">
              <BadgeCheck className="h-7 w-7 shrink-0 text-[#009688]" />
              <div>
                <p className="font-black text-[#009688]">
                  Abonnement {tierLabel(selectedPlan.tier)} {selectedPlan.label} sélectionné
                </p>
                <p className="text-sm text-slate-500">
                  {selectedPlan.durationLabel} ·{" "}
                  {formatMoney(priceForMarket(selectedPlan, country?.id), country)}
                </p>
              </div>
            </div>

            <p className="mb-4 font-bold text-[#1A1A1A]">
              Pour activer ton badge Vendeur Certifié :
            </p>

            {/* Step 1 — choix de la méthode (parité subscription_screen.dart) */}
            <div className="mb-3 flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#009688]/10 text-xs font-black text-[#009688]">
                1
              </div>
              <div className="flex-1 text-sm text-slate-600">
                <p>Choisissez votre mode de paiement :</p>
                <div className="mt-2 space-y-1.5">
                  {paymentMethods.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      disabled={!m.enabled}
                      onClick={() => setSelectedMethodId(m.id)}
                      className="flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed"
                      style={{
                        borderColor:
                          selectedMethod.id === m.id ? m.color : "#E2E8F0",
                        backgroundColor:
                          selectedMethod.id === m.id ? `${m.color}10` : "white",
                        color: m.enabled ? "#1A1A1A" : "#94A3B8",
                      }}
                    >
                      <span>{m.name}</span>
                      {m.enabled ? (
                        selectedMethod.id === m.id && (
                          <CheckCircle2
                            className="h-4 w-4"
                            style={{ color: m.color }}
                          />
                        )
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-400">
                          Bientôt disponible
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 2 — numéro (Mobile Money activé) ou note cash */}
            <div className="mb-3 flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#009688]/10 text-xs font-black text-[#009688]">
                2
              </div>
              <div className="flex-1 text-sm text-slate-600">
                {!isCash && selectedMethod.number ? (
                  <>
                    <p>
                      Envoie{" "}
                      <strong>{formatMoney(priceForMarket(selectedPlan, country?.id), country)}</strong>{" "}
                      sur ce numéro :
                    </p>
                    <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <span
                        className="text-xs font-bold"
                        style={{ color: selectedMethod.color }}
                      >
                        {selectedMethod.name} :{" "}
                      </span>
                      <span
                        className="text-base font-black"
                        style={{ color: selectedMethod.color }}
                      >
                        {selectedMethod.number}
                      </span>
                    </p>
                  </>
                ) : (
                  <p>
                    Contactez-nous sur WhatsApp pour convenir du paiement en
                    espèces.
                  </p>
                )}
              </div>
            </div>

            {/* Step 3 */}
            <div className="mb-3 flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#009688]/10 text-xs font-black text-[#009688]">
                3
              </div>
              <div className="flex-1 text-sm text-slate-600">
                <p>Référence obligatoire dans le motif :</p>
                <button
                  type="button"
                  onClick={copyReference}
                  className="mt-2 flex w-full items-center justify-between rounded-xl border border-[#009688]/35 bg-[#009688]/5 px-4 py-3 transition hover:bg-[#009688]/10"
                >
                  <span className="font-black tracking-wide text-[#009688]">
                    {reference}
                  </span>
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-[#009688]" />
                  ) : (
                    <Copy className="h-4 w-4 text-[#009688]" />
                  )}
                </button>
              </div>
            </div>

            {/* Step 4 */}
            <div className="mb-5 flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#009688]/10 text-xs font-black text-[#009688]">
                4
              </div>
              <p className="text-sm text-slate-600">
                Tape &quot;J&apos;ai payé&quot; — on t&apos;envoie sur WhatsApp
                pour confirmer. Badge activé sous 2h.
              </p>
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={() => handlePaid(selectedPlan)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#009688] py-4 text-sm font-black text-white transition hover:bg-[#00796B] disabled:opacity-60"
            >
              <BadgeCheck className="h-5 w-5" />
              J&apos;ai payé — Confirmer par WhatsApp
            </button>
            <p className="mt-2 text-center text-xs text-slate-400">
              En confirmant, vous attestez avoir effectué le paiement.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
