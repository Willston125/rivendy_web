import Link from "next/link";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">

      {/* Illustration */}
      <div className="relative mb-8">
        <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[#E0F2F1]">
          <span className="text-5xl font-black text-[#009688]">?</span>
        </div>
        <span className="absolute -right-2 -top-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#1A1A1A] text-xl font-black text-white">
          4
        </span>
        <span className="absolute -bottom-2 -left-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#009688] text-xl font-black text-white">
          4
        </span>
      </div>

      {/* Texte */}
      <h1 className="text-3xl font-black text-[#1A1A1A] md:text-4xl">
        Page introuvable
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">
        Cette page n&apos;existe pas ou a été déplacée.<br />
        Retourne sur le feed pour découvrir les produits disponibles sur Rivendy.
      </p>

      {/* Actions */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/"
          className="flex h-12 items-center gap-2 rounded-full bg-[#009688] px-6 text-sm font-black text-white transition hover:bg-[#00796B]"
        >
          <Home className="h-4 w-4" />
          Retour au feed
        </Link>
        <Link
          href="/?q="
          className="flex h-12 items-center gap-2 rounded-full border border-slate-200 bg-white px-6 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
        >
          <Search className="h-4 w-4" />
          Rechercher un produit
        </Link>
      </div>

      {/* Branding discret */}
      <p className="mt-10 text-xs font-semibold text-slate-300">
        Rivendy · Marketplace de confiance
      </p>
    </div>
  );
}
