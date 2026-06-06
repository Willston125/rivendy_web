import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, Truck, MessageCircle, BadgeCheck } from "lucide-react";
import { CATEGORIES } from "@/types/rivendy";

/**
 * Footer global du site — marqueur "vrai site e-commerce".
 * Composant serveur (liens statiques). Affiché sous le contenu de chaque page.
 * Padding bas sur mobile pour ne pas être masqué par la bottom-nav (md:hidden).
 */

const TOP_CATEGORIES = CATEGORIES.slice(0, 6);

const ACHETER = [
  { href: "/", label: "Explorer le catalogue" },
  { href: "/preorders", label: "Sur commande" },
  { href: "/favorites", label: "Mes favoris" },
  { href: "/cart", label: "Mon panier" },
];

const VENDRE = [
  { href: "/sell", label: "Vendre un article" },
  { href: "/seller/create", label: "Ouvrir ma boutique" },
  { href: "/seller/subscription", label: "Devenir Vendeur Certifié" },
  { href: "/seller", label: "Espace vendeur" },
];

const AIDE = [
  { href: "/help", label: "Aide & support" },
  { href: "/legal?tab=privacy", label: "Confidentialité" },
  { href: "/legal?tab=cgu", label: "Conditions d'utilisation" },
];

const TRUST = [
  { icon: ShieldCheck, label: "Paiement protégé par Rivendy" },
  { icon: Truck, label: "Livraison suivie de bout en bout" },
  { icon: BadgeCheck, label: "Vendeurs vérifiés et certifiés" },
  { icon: MessageCircle, label: "Support via WhatsApp" },
];

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">{title}</h3>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link
              href={l.href}
              className="text-sm text-slate-600 transition-colors hover:text-[#009688]"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-12 border-t border-slate-200 bg-white pb-24 md:pb-0">
      {/* Bandeau confiance */}
      <div className="border-b border-slate-100 bg-slate-50">
        <div className="mx-auto grid max-w-[1440px] grid-cols-2 gap-4 px-4 py-6 md:grid-cols-4 lg:px-6">
          {TRUST.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E0F2F1]">
                <Icon className="h-5 w-5 text-[#009688]" />
              </span>
              <span className="text-[13px] font-semibold text-slate-700">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Colonnes de liens */}
      <div className="mx-auto max-w-[1440px] px-4 py-10 lg:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          {/* Marque */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-[#009688]">
                <Image src="/brand/rivendy-logo.jpg" alt="Rivendy" fill sizes="36px" className="object-cover" />
              </span>
              <span className="text-xl font-extrabold tracking-tight text-slate-900">Rivendy</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-500">
              La marketplace de confiance. Achetez et vendez des produits locaux,
              paiement et livraison protégés par Rivendy.
            </p>
          </div>

          <FooterColumn title="Acheter" links={ACHETER} />
          <FooterColumn title="Vendre" links={VENDRE} />
          <FooterColumn title="Aide & infos" links={AIDE} />

          {/* Catégories */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Catégories</h3>
            <ul className="mt-3 space-y-2">
              {TOP_CATEGORIES.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/?category=${c.id}`}
                    className="text-sm text-slate-600 transition-colors hover:text-[#009688]"
                  >
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Barre du bas */}
      <div className="border-t border-slate-100">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-slate-400 sm:flex-row lg:px-6">
          <p>© {year} Rivendy — Marketplace de confiance</p>
          <div className="flex items-center gap-4">
            <Link href="/legal?tab=cgu" className="transition-colors hover:text-slate-600">Conditions</Link>
            <Link href="/legal?tab=privacy" className="transition-colors hover:text-slate-600">Confidentialité</Link>
            <Link href="/help" className="transition-colors hover:text-slate-600">Aide</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
