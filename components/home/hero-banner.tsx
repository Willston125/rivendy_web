import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Package, Shield, Truck } from "lucide-react";

/**
 * Hero Banner premium — fidèle au design de référence.
 *
 * Structure :
 * - Grande bannière full-width avec fond dégradé teal
 * - Côté gauche : titre, sous-titre, 3 avantages, CTA
 * - Côté droit : image femme souriante (generée)
 */
export function HeroBanner() {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#009688] via-[#00897B] to-[#00796B] shadow-lg shadow-[#009688]/15">

      {/* Décorations de fond */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute right-1/3 top-1/4 h-32 w-32 rounded-full bg-white/[0.03]" />

      <div className="relative flex flex-col items-center gap-6 p-6 sm:p-8 md:flex-row md:gap-0 md:p-0">

        {/* ── Côté gauche : texte ──────────────────────────────── */}
        <div className="flex-1 space-y-5 md:py-10 md:pl-10 lg:py-12 lg:pl-12">

          {/* Titre principal */}
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold leading-tight text-white sm:text-3xl lg:text-[2.1rem] lg:leading-[1.2]">
              Achetez, vendez et{" "}
              <br className="hidden sm:block" />
              commandez à Djibouti{" "}
              <br className="hidden sm:block" />
              avec <span className="text-[#B2DFDB]">Rivendy</span>
            </h1>
          </div>

          {/* Avantages — 3 badges inline */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-white/90">
              <Package className="h-4 w-4 text-[#B2DFDB]" />
              Produits locaux
            </span>
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-white/90">
              <Shield className="h-4 w-4 text-[#B2DFDB]" />
              Paiement sécurisé
            </span>
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-white/90">
              <Truck className="h-4 w-4 text-[#B2DFDB]" />
              Livraison rapide
            </span>
          </div>

          {/* CTA Button */}
          <Link
            href="/?country=DJ"
            className="group inline-flex items-center gap-2.5 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-[#009688] shadow-lg shadow-black/10 transition-all duration-200 hover:shadow-xl hover:shadow-black/15 active:scale-[.97]"
          >
            Découvrir les offres
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#009688] transition-transform duration-200 group-hover:translate-x-0.5">
              <ArrowRight className="h-3.5 w-3.5 text-white" />
            </span>
          </Link>
        </div>

        {/* ── Côté droit : image hero ─────────────────────────── */}
        <div className="relative hidden w-[340px] shrink-0 self-end md:block lg:w-[400px] xl:w-[420px]">
          <Image
            src="/brand/hero-woman.png"
            alt="Femme souriante utilisant Rivendy pour faire du shopping"
            width={420}
            height={480}
            className="relative z-10 h-auto w-full object-contain object-bottom"
            priority
          />
          {/* Halo lumineux derrière la personne */}
          <div className="pointer-events-none absolute bottom-0 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        </div>
      </div>
    </section>
  );
}
