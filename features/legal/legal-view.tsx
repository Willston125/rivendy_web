"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { FileText, Shield } from "lucide-react";

type Tab = "cgu" | "privacy";

const CGU = `Conditions Générales d'Utilisation (CGU)

1. Présentation de la Plateforme
Rivendy est une plateforme de mise en relation (marketplace) permettant aux utilisateurs de vendre et d'acheter des articles neufs ou d'occasion en toute sécurité.

2. Engagements du Vendeur
• Les articles mis en vente doivent correspondre exactement à la description (photos et état).
• La vente d'objets contrefaits, illégaux ou dangereux est formellement interdite.
• Le vendeur s'engage à respecter les délais de livraison annoncés s'il gère les expéditions.

3. Engagements de l'Acheteur
• L'acheteur s'engage à payer le prix convenu, incluant les potentiels frais de livraison.
• Tout litige doit d'abord faire l'objet de discussions via les outils de communication internes avant intervention du support.

4. Responsabilité de Rivendy
Rivendy agit en tant qu'hébergeur de l'application et n'est pas responsable des litiges entre acheteur et vendeur en cas de vente directe (main propre). Cependant, tout signalement d'escroquerie entraînera le bannissement immédiat du membre.

5. Frais et Commissions
L'utilisation du Wallet Rivendy et certains statuts VIP ou annonces "Boostées" sont assujettis à des frais clairement indiqués lors de la transaction.

6. Propriété Intellectuelle
Le nom Rivendy, son logo, et tout contenu produit par la plateforme sont protégés. Toute reproduction sans autorisation est interdite.

7. Modification des CGU
Rivendy se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés des changements majeurs via notification dans l'application.

Mise à jour : Novembre 2024`;

const PRIVACY = `Politique de Confidentialité de Rivendy

1. Collecte des Données
Nous collectons uniquement les données nécessaires au bon fonctionnement de la plateforme :
• Informations de profil (nom, email, téléphone)
• Données de transaction et paiements
• Préférences et favoris
• Données d'utilisation (analytics anonymisés)

2. Utilisation de vos Données
Vos données sont strictement utilisées pour :
• Sécuriser vos transactions entre acheteurs et vendeurs
• Vous notifier des nouveautés et messages
• Améliorer l'expérience utilisateur globale
• Lutter contre la fraude et les abus

3. Partage et Sécurité
Rivendy s'engage à ne jamais revendre vos informations personnelles à des tiers. Toutes les données sont chiffrées selon les standards de sécurité en vigueur (SSL, Supabase sécurisé).

Nous pouvons partager des données anonymisées avec nos partenaires analytiques pour améliorer nos services.

4. Cookies et Traçage
Le site utilise des cookies strictement nécessaires au fonctionnement. Aucun cookie publicitaire tiers n'est déposé sans votre consentement.

5. Durée de Conservation
Vos données sont conservées aussi longtemps que votre compte est actif. En cas de suppression du compte, vos données personnelles sont effacées sous 30 jours.

6. Vos Droits (RGPD)
Vous disposez des droits suivants sur vos données :
• Droit d'accès et de portabilité
• Droit de rectification
• Droit à l'effacement ("droit à l'oubli")
• Droit d'opposition au traitement

Pour toute demande : support@rivendy.dj

Mise à jour : Novembre 2024`;

export function LegalView({ defaultTab = "cgu" }: { defaultTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(defaultTab);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
      id: "cgu",
      label: "CGU",
      icon: <FileText className="h-4 w-4" />,
    },
    {
      id: "privacy",
      label: "Confidentialité",
      icon: <Shield className="h-4 w-4" />,
    },
  ];

  const content = tab === "cgu" ? CGU : PRIVACY;
  const title = tab === "cgu" ? "Conditions Générales d'Utilisation" : "Politique de Confidentialité";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-6">
      {/* En-tête */}
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-wider text-[#007168]">Rivendy</p>
        <h1 className="mt-1 text-3xl font-black text-[#1A1A1A]">{title}</h1>
      </div>

      {/* Onglets */}
      <div className="mb-6 flex gap-1 rounded-2xl bg-slate-100 p-1">
        {tabs.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-black transition ${
              tab === id
                ? "bg-white text-[#007168] shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div className="rounded-3xl bg-white p-6 shadow-sm md:p-8">
        <div className="prose prose-sm max-w-none">
          {content.split("\n").map((line, i) => {
            if (line.trim() === "") return <div key={i} className="h-3" />;

            // Titre principal
            if (/^\d+\.\s/.test(line) && !line.startsWith("•")) {
              return (
                <h2 key={i} className="mt-5 text-base font-black text-[#1A1A1A] first:mt-0">
                  {line}
                </h2>
              );
            }

            // Titre secondaire en gras (Conditions Générales d'Utilisation (CGU))
            if (line.startsWith("Conditions") || line.startsWith("Politique")) {
              return (
                <p key={i} className="mb-1 font-black text-[#1A1A1A]">
                  {line}
                </p>
              );
            }

            // Bullet
            if (line.startsWith("•")) {
              return (
                <p key={i} className="flex gap-2 text-sm leading-relaxed text-slate-600">
                  <span className="mt-0.5 shrink-0 text-[#007168]">•</span>
                  <span>{line.slice(1).trim()}</span>
                </p>
              );
            }

            // Mention "Mise à jour"
            if (line.startsWith("Mise à jour")) {
              return (
                <p key={i} className="mt-4 text-xs text-slate-400">
                  {line}
                </p>
              );
            }

            // Texte normal
            return (
              <p key={i} className="text-sm leading-relaxed text-slate-600">
                {line}
              </p>
            );
          })}
        </div>
      </div>

      {/* Footer contact */}
      <p className="mt-6 text-center text-xs text-slate-400">
        Pour toute question légale :{" "}
        <a href="mailto:support@rivendy.dj" className="font-bold text-[#007168] hover:underline">
          support@rivendy.dj
        </a>
      </p>
    </div>
  );
}
