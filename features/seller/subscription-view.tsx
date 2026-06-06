"use client";

import { useState } from "react";
import { BadgeCheck, Copy, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountryOrDefault } from "@/features/country/country-provider";
import { formatMoney, normalizePhoneForWhatsApp } from "@/lib/utils/format";
import { supabase } from "@/lib/supabase/client";
import type { SellerSubscriptionInput } from "@/types/rivendy";

/* ── Plans ─────────────────────────────────────────────────── */

interface Plan {
  id: "weekly" | "monthly" | "yearly";
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

const PLANS: Plan[] = [
  {
    id: "weekly",
    label: "Hebdomadaire",
    emoji: "🗓",
    priceFDJ: 1000,
    priceKMF: 2500,
    durationDays: 7,
    durationLabel: "7 jours",
    buttonLabel: "S'abonner 7 jours",
    features: [
      "Badge ✅ Vendeur Certifié",
      "Affiché sur votre profil",
      "Affiché sur vos annonces",
      "Confiance des acheteurs",
    ],
  },
  {
    id: "monthly",
    label: "Mensuel",
    emoji: "📅",
    priceFDJ: 3000,
    priceKMF: 7500,
    durationDays: 30,
    durationLabel: "30 jours",
    buttonLabel: "S'abonner 30 jours",
    savingsLabel: "Économisez 25% vs hebdomadaire",
    badge: "LE PLUS POPULAIRE",
    badgeColor: "#009688",
    isPopular: true,
    features: [
      "Badge ✅ Vendeur Certifié",
      "Affiché sur votre profil",
      "Affiché sur vos annonces",
      "Confiance des acheteurs",
      "Priorité dans les résultats",
    ],
  },
  {
    id: "yearly",
    label: "Annuel",
    emoji: "🏆",
    priceFDJ: 25000,
    priceKMF: 62500,
    durationDays: 365,
    durationLabel: "1 an",
    buttonLabel: "S'abonner 1 an",
    savingsLabel: "Économisez 52%",
    badge: "MEILLEUR PRIX",
    badgeColor: "#FFB800",
    features: [
      "Badge ✅ Vendeur Certifié",
      "Affiché sur votre profil",
      "Affiché sur vos annonces",
      "Confiance des acheteurs",
      "Priorité dans les résultats",
      "Statistiques de ventes avancées",
      "Support prioritaire Rivendy",
    ],
  },
];

const PAYMENT_METHODS = [
  { name: "D-Money", number: "+253 77 00 00 01", color: "#1976D2" },
  { name: "Waafi", number: "+253 77 00 00 02", color: "#388E3C" },
  { name: "CAC Pay", number: "+253 77 00 00 03", color: "#E64A19" },
];

/* ── Component ─────────────────────────────────────────────── */

export function SubscriptionView() {
  const { user, profile } = useAuth();
  const country = useCountryOrDefault();
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const userName = profile?.full_name ?? "USER";
  const userId = userName.replace(/\s/g, "").toUpperCase().slice(0, 6) || "USER";
  const reference = `CERT-${userId}`;

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
        plan: plan.id,
        price_paid: priceForMarket(plan, country.id),
        duration_days: plan.durationDays,
        status: "pending",
        payment_method: "manual",
        country_id: country.id,
        payment_reference: reference,
      };
      await supabase.from("seller_subscriptions").insert(payload);
    } catch (_) {
      // non-blocking
    }

    const formattedPrice = formatMoney(priceForMarket(plan, country.id), country);
    const msg = encodeURIComponent(
      `Bonjour Rivendy, j'ai effectué le paiement pour mon abonnement Vendeur Certifié.\n\n` +
        `• Plan : ${plan.label} (${plan.durationLabel})\n` +
        `• Montant : ${formattedPrice}\n` +
        `• Référence : ${reference}\n` +
        `• Nom : ${userName}\n\n` +
        `Merci de valider mon badge. 🙏`
    );
    window.open(`https://wa.me/${whatsapp}?text=${msg}`, "_blank");
    setSelectedPlan(null);
    setSubmitting(false);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-6">
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
              <p className="text-sm font-black text-[#009688]">{formatMoney(priceForMarket(PLANS[1], country.id), country)}</p>
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

      <div className="space-y-4">
        {PLANS.map((plan) => {
          const displaySavings = plan.savingsLabel
            ? plan.id === "yearly"
              ? `${plan.savingsLabel} — soit ~${Math.round(priceForMarket(plan, country.id) / 12).toLocaleString("fr-FR")} ${country.currency_symbol}/mois`
              : plan.savingsLabel
            : null;

          return (
            <div
              key={plan.id}
              className={`relative overflow-hidden rounded-2xl bg-white shadow-sm transition ${
                plan.isPopular
                  ? "border-2 border-[#009688] shadow-[#009688]/10 shadow-lg"
                  : "border border-slate-200"
              }`}
            >
              {plan.badge && (
                <div
                  className="absolute right-0 top-0 rounded-bl-xl px-3 py-1.5 text-[10px] font-black text-white"
                  style={{ backgroundColor: plan.badgeColor }}
                >
                  {plan.badge}
                </div>
              )}

              <div className={`p-5 ${plan.badge ? "pt-9" : ""}`}>
                {/* Header row */}
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{plan.emoji}</span>
                  <div className="flex-1">
                    <p className="font-black text-[#1A1A1A]">{plan.label}</p>
                    <p className="text-sm text-slate-400">{plan.durationLabel}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-xl font-black ${
                        plan.isPopular ? "text-[#009688]" : "text-[#1A1A1A]"
                      }`}
                    >
                      {formatMoney(priceForMarket(plan, country.id), country)}
                    </p>
                    <p className="text-xs text-slate-400">/ {plan.durationLabel}</p>
                  </div>
                </div>

                {/* Savings */}
                {displaySavings && (
                  <div className="mt-3 rounded-lg bg-green-50 px-3 py-2">
                    <p className="text-xs font-semibold text-green-700">
                      💰 {displaySavings}
                    </p>
                  </div>
                )}

                <hr className="my-3 border-slate-100" />

                {/* Features */}
                <ul className="space-y-1.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#009688]" />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* Button */}
                <button
                  type="button"
                  onClick={() => setSelectedPlan(plan)}
                  className={`mt-4 w-full rounded-xl py-3 text-sm font-black text-white transition ${
                    plan.isPopular
                      ? "bg-[#009688] hover:bg-[#00796B]"
                      : "bg-[#1A1A1A] hover:bg-[#333]"
                  }`}
                >
                  {plan.buttonLabel}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
        Paiement vérifié manuellement sous 2h
        <br />
        Support : WhatsApp +253 77 14 53 06
      </p>

      {/* Payment modal overlay */}
      {selectedPlan && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={() => setSelectedPlan(null)}
        >
          <div
            className="w-full max-w-lg rounded-t-3xl bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-slate-200" />

            {/* Title */}
            <div className="mb-5 flex items-start gap-3">
              <BadgeCheck className="h-7 w-7 shrink-0 text-[#009688]" />
              <div>
                <p className="font-black text-[#009688]">
                  Abonnement {selectedPlan.label} sélectionné
                </p>
                <p className="text-sm text-slate-500">
                  {selectedPlan.durationLabel} ·{" "}
                  {formatMoney(priceForMarket(selectedPlan, country.id), country)}
                </p>
              </div>
            </div>

            <p className="mb-4 font-bold text-[#1A1A1A]">
              Pour activer ton badge Vendeur Certifié :
            </p>

            {/* Step 1 */}
            <div className="mb-3 flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#009688]/10 text-xs font-black text-[#009688]">
                1
              </div>
              <div className="text-sm text-slate-600">
                <p>
                  Envoie{" "}
                  <strong>{formatMoney(priceForMarket(selectedPlan, country.id), country)}</strong>{" "}
                  sur l&apos;un de ces numéros :
                </p>
                <ul className="mt-2 space-y-1">
                  {PAYMENT_METHODS.map((m) => (
                    <li key={m.name} className="flex items-center gap-2">
                      <span
                        className="text-xs font-bold"
                        style={{ color: m.color }}
                      >
                        {m.name} :
                      </span>
                      <span className="font-bold text-[#1A1A1A]">
                        {m.number}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Step 2 */}
            <div className="mb-3 flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#009688]/10 text-xs font-black text-[#009688]">
                2
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

            {/* Step 3 */}
            <div className="mb-5 flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#009688]/10 text-xs font-black text-[#009688]">
                3
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
