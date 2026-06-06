"use client";

import { useState } from "react";
import { ChevronDown, Mail, MessageCircle } from "lucide-react";
import { useCountryOrDefault } from "@/features/country/country-provider";
import { normalizePhoneForWhatsApp } from "@/lib/utils/format";

const FAQS = [
  {
    q: "Comment publier un article à vendre ?",
    a: "Cliquez sur le bouton \"Publier\" dans la navigation. Ajoutez 1 à 5 photos de votre article, remplissez le titre, la description, le prix et la catégorie, puis cliquez sur \"Publier l'annonce\". Votre article sera visible sur le feed en quelques secondes.",
  },
  {
    q: "Comment passer une commande sur Rivendy ?",
    a: "Ajoutez les produits que vous souhaitez à votre panier, puis cliquez sur \"Commander\". Renseignez votre nom, votre numéro de téléphone, votre zone de livraison et votre moyen de paiement. Rivendy vous confirme ensuite la commande via WhatsApp.",
  },
  {
    q: "Comment acheter un article en toute sécurité ?",
    a: "Consultez le profil du vendeur, ses avis et son badge de certification. Chaque commande sur Rivendy est gérée par notre équipe — aucun contact direct avec le vendeur n'est nécessaire. Pour les paiements, utilisez les moyens sécurisés disponibles (D-Money, Waafi, Cash à la livraison).",
  },
  {
    q: "Comment signaler un article ou un utilisateur ?",
    a: "Contactez notre support directement via WhatsApp ou email en indiquant l'identifiant de l'article ou du profil concerné. Notre équipe examinera le signalement sous 24h.",
  },
  {
    q: "Puis-je modifier ou supprimer mon annonce ?",
    a: "Oui. Rendez-vous dans votre espace vendeur → \"Ma Boutique\", sélectionnez l'article concerné et choisissez \"Modifier\" ou \"Supprimer\". Les modifications sont effectives immédiatement.",
  },
  {
    q: "Que faire si je n'ai pas reçu mon article ?",
    a: "Contactez notre support via WhatsApp ou email avec la référence de votre commande (CMD-…). Notre équipe fait le suivi de toutes les commandes et vous assistera dans la résolution du problème.",
  },
  {
    q: "Comment fonctionne le portefeuille Rivendy ?",
    a: "En tant que vendeur, vos gains s'accumulent dans votre portefeuille Rivendy au fur et à mesure de vos ventes confirmées. Vous pouvez ensuite faire une demande de retrait via WhatsApp — traité sous 24h vers votre compte D-Money, Waafi ou par virement.",
  },
  {
    q: "Comment obtenir le badge Vendeur Certifié ?",
    a: "Après avoir publié vos premiers articles et réalisé quelques ventes, rendez-vous dans Paramètres → \"Devenir Vendeur Certifié\". Le badge améliore la visibilité de vos annonces et inspire confiance aux acheteurs.",
  },
  {
    q: "Quels sont les frais et commissions Rivendy ?",
    a: "Rivendy prélève une commission de 5% sur chaque vente réalisée via la plateforme. Cette commission est automatiquement calculée et affichée lors de la publication de votre article. Les achats sont gratuits pour les acheteurs.",
  },
] as const;

export function HelpView() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const country = useCountryOrDefault();

  const whatsapp = normalizePhoneForWhatsApp(country.whatsapp_number);
  const waMsg = encodeURIComponent("Bonjour, j'ai besoin d'aide avec Rivendy.");
  const waUrl = `https://wa.me/${whatsapp}?text=${waMsg}`;
  const emailUrl = `mailto:support@rivendy.dj?subject=Aide%20Rivendy&body=Bonjour%2C%20j'ai%20besoin%20d'aide%20avec%20Rivendy.`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-6">
      {/* En-tête */}
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-wider text-[#009688]">Rivendy</p>
        <h1 className="mt-1 text-3xl font-black text-[#1A1A1A]">Aide & Support</h1>
      </div>

      {/* Carte contact rapide */}
      <div className="mb-8 rounded-3xl bg-gradient-to-br from-[#009688] to-[#00C4B4] p-6 text-white shadow-xl shadow-[#007168]/20">
        <h2 className="text-xl font-black">Besoin d&apos;aide ?</h2>
        <p className="mt-1 text-sm text-white/80">
          Notre équipe est disponible 7j/7 de 8h à 22h
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-black text-[#009688] transition hover:bg-white/90"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
          <a
            href={emailUrl}
            className="flex items-center justify-center gap-2 rounded-2xl bg-white/20 py-3 text-sm font-black text-white transition hover:bg-white/30"
          >
            <Mail className="h-4 w-4" />
            Email
          </a>
        </div>
      </div>

      {/* FAQ accordion */}
      <h2 className="mb-4 text-xl font-black text-[#1A1A1A]">Questions fréquentes</h2>
      <div className="space-y-2.5">
        {FAQS.map(({ q, a }, i) => {
          const isOpen = openIndex === i;
          return (
            <div
              key={i}
              className="overflow-hidden rounded-2xl bg-white shadow-sm"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
              >
                <span
                  className={`text-sm font-bold leading-snug transition-colors ${
                    isOpen ? "text-[#009688]" : "text-[#1A1A1A]"
                  }`}
                >
                  {q}
                </span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 transition-transform duration-200 ${
                    isOpen ? "rotate-180 text-[#009688]" : "text-slate-300"
                  }`}
                />
              </button>

              {/* Réponse avec animation CSS */}
              <div
                className={`overflow-hidden transition-all duration-300 ease-out ${
                  isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <div className="border-t border-slate-50 px-5 pb-4 pt-3">
                  <p className="text-sm leading-relaxed text-slate-600">{a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer contact */}
      <div className="mt-8 text-center">
        <p className="text-sm text-slate-500">
          Vous n&apos;avez pas trouvé votre réponse ?<br />
          Contactez-nous directement.
        </p>
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#E0F2F1] px-6 py-3 text-sm font-black text-[#009688] transition hover:bg-[#009688] hover:text-white"
        >
          <MessageCircle className="h-4 w-4" />
          Contacter le support
        </a>
        <p className="mt-3 text-xs text-slate-400">
          support@rivendy.dj
        </p>
      </div>
    </div>
  );
}
