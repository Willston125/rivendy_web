import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, ClipboardCheck, PackageCheck, QrCode, Smartphone, Store, Truck, Wallet } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { HOME_MARKET_ID, marketHomePath, PLAY_LISTING_URL, storesPath } from "@/lib/seo";
import { CATEGORIES } from "@/types/rivendy";

/**
 * Page publique « Vendre en ligne » (référencement, 2026-10-13).
 * Vise « vendre en ligne Comores » — `/sell` est derrière la connexion, Google
 * n'en voit que l'écran de connexion. Chaque affirmation ci-dessous est un
 * fait du produit (CLAUDE.md §5) : le vendeur encaisse son prix fixé, tout
 * contact passe par Rivendy, livraison par quartier en Grande Comore, zones
 * tarifées à Djibouti, modération sous 24 h (`app/sell/page.tsx`).
 */

export const metadata: Metadata = {
  title: "Vendre en ligne aux Comores — ouvrez votre boutique | Rivendy",
  description:
    "Vendez en ligne aux Comores avec Rivendy : ouvrez votre boutique en quelques minutes, touchez les acheteurs de Moroni et de Grande Comore, recevez le prix que vous fixez.",
  alternates: { canonical: "/vendre-en-ligne" },
};

const STEPS = [
  { icon: Store, title: "Ouvrez votre boutique", text: "Nom, logo, description : votre boutique est prête en quelques minutes, sur le site ou dans l'application." },
  { icon: ClipboardCheck, title: "Publiez vos articles", text: "Photos, prix, tailles, couleurs, note vocale. L'équipe Rivendy vérifie chaque annonce sous 24 h." },
  { icon: PackageCheck, title: "Recevez des commandes", text: "Rivendy centralise les commandes et accompagne l'acheteur jusqu'à la livraison." },
  { icon: Wallet, title: "Encaissez votre prix", text: "Vous recevez exactement le prix que vous avez fixé, dès que l'acheteur confirme la réception." },
];

const REASONS = [
  { icon: Truck, title: "Livraison par quartier", text: "En Grande Comore, l'acheteur choisit sa région, sa localité et son quartier : les frais de livraison sont connus avant la commande." },
  { icon: BadgeCheck, title: "Des acheteurs en confiance", text: "Tout contact passe par Rivendy, jamais en direct : l'acheteur sait à qui s'adresser, vous n'êtes pas sollicité à toute heure." },
  { icon: QrCode, title: "Faites connaître votre boutique", text: "QR code et catalogue PDF à partager sur vos réseaux, dans votre magasin ou sur vos sacs." },
  { icon: Smartphone, title: "Sur le site et l'application", text: "Gérez boutique, stock et commandes depuis votre téléphone avec l'application Rivendy Android." },
];

const FAQ = [
  {
    q: "Comment vendre en ligne aux Comores ?",
    a: "Créez un compte Rivendy, ouvrez votre boutique puis publiez vos articles avec photos et prix. Après vérification par l'équipe Rivendy, ils sont visibles par les acheteurs des Comores sur le site et dans l'application.",
  },
  {
    q: "Combien je touche sur une vente ?",
    a: "Exactement le prix que vous avez fixé. La commission de Rivendy s'ajoute au prix payé par l'acheteur : elle n'est jamais retirée de votre part.",
  },
  {
    q: "Comment se passe la livraison à Moroni et en Grande Comore ?",
    a: "L'acheteur indique sa région, sa localité et son quartier au moment de commander. Les frais de livraison s'affichent avant la validation et sont payés par l'acheteur en plus des articles.",
  },
  {
    q: "Puis-je vendre à Djibouti ?",
    a: "Oui. Rivendy est ouvert à Djibouti, avec livraison par zone tarifée, ainsi que dans 14 autres marchés. Vos prix sont fixés dans la monnaie de chaque marché.",
  },
  {
    q: "Quels produits puis-je vendre ?",
    a: "Mode, beauté et parfums, électronique, maison, artisanat local, matériaux de construction, supermarché, mais aussi restaurants, pharmacies, hôtels, location et services de mariage.",
  },
];

const SELLABLE = CATEGORIES.filter((c) => c.id !== "personnels");

export default function SellOnlinePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-5 md:px-6 md:py-8">
      <Breadcrumbs items={[{ label: "Accueil", href: "/" }, { label: "Vendre en ligne" }]} />

      <header className="rounded-3xl bg-[#E0F2F1] p-6 md:p-10">
        <h1 className="text-2xl font-black leading-tight text-slate-900 md:text-4xl">
          Vendre en ligne aux Comores avec Rivendy
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-700 md:text-base">
          Ouvrez votre boutique en ligne et touchez les acheteurs de Moroni et de toute la Grande Comore.
          Vous fixez votre prix, Rivendy s&apos;occupe des commandes, du contact client et du suivi de livraison.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/seller/create"
            className="rounded-full bg-[#009688] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#007168]"
          >
            Ouvrir ma boutique
          </Link>
          <a
            href={PLAY_LISTING_URL}
            target="_blank"
            rel="noopener"
            className="rounded-full border border-[#009688] bg-white px-5 py-2.5 text-sm font-bold text-[#007168] hover:bg-[#F2FBFA]"
          >
            Télécharger l&apos;application
          </a>
        </div>
      </header>

      <section className="mt-10">
        <h2 className="text-xl font-black text-slate-900">Comment ça marche</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="rounded-2xl border border-slate-200 bg-white p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E0F2F1]">
                <Icon className="h-5 w-5 text-[#009688]" />
              </span>
              <h3 className="mt-3 text-sm font-bold text-slate-900">
                {i + 1}. {title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-black text-slate-900">Pourquoi vendre sur Rivendy</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {REASONS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-3 rounded-2xl bg-slate-50 p-4">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#009688]" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-black text-slate-900">Ce que vous pouvez vendre aux Comores</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {SELLABLE.map((c) => (
            <li key={c.id}>
              <Link
                href={marketHomePath(HOME_MARKET_ID, c.id)}
                className="block rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-[#009688] hover:text-[#007168]"
              >
                {c.label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-slate-600">
          Voir aussi :{" "}
          <Link href={storesPath(HOME_MARKET_ID)} className="font-bold text-[#009688] hover:text-[#007168]">
            les boutiques en ligne à Moroni et aux Comores
          </Link>
          .
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-black text-slate-900">Questions fréquentes</h2>
        <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group p-4">
              <summary className="cursor-pointer list-none text-sm font-bold text-slate-900">
                {q}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
