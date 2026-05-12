import type { Metadata } from "next";
import { CheckCircle2, Clock, Eye, Zap } from "lucide-react";
import { RequireAuth } from "@/features/auth/require-auth";
import { ProductForm } from "@/features/products/product-form";

export const metadata: Metadata = {
  title: "Publier un produit — Rivendy",
  description:
    "Mettez votre produit en vente sur Rivendy en quelques minutes. Touchez des milliers d'acheteurs à Djibouti.",
};

const STEPS = [
  {
    icon: CheckCircle2,
    label: "Tu remplis le formulaire",
    desc: "Titre, photos, prix et détails de ton produit.",
  },
  {
    icon: Clock,
    label: "Modération Rivendy",
    desc: "Notre équipe vérifie et valide l'annonce sous 24 h.",
  },
  {
    icon: Eye,
    label: "Publication",
    desc: "Ton produit est visible par tous les acheteurs.",
  },
  {
    icon: Zap,
    label: "Commandes & paiements",
    desc: "Rivendy centralise les commandes — tu es protégé.",
  },
];

export default function SellPage() {
  return (
    <RequireAuth>
      <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-10">

        {/* En-tête */}
        <div className="mb-8">
          <p className="text-sm font-bold text-[#009688]">Publier un produit</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
            Vends sur Rivendy
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
            Ton annonce sera examinée par notre équipe avant d&apos;être publiée.
            Le processus prend en général moins de 24 h.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">

          {/* ── Formulaire ─────────────────────────────────────────── */}
          <section className="rounded-3xl bg-white p-5 shadow-sm md:p-8">
            <ProductForm />
          </section>

          {/* ── Panneau latéral : étapes ───────────────────────────── */}
          <aside className="space-y-4">

            {/* Étapes du processus */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-black text-slate-900">Comment ça marche ?</h2>
              <ol className="space-y-4">
                {STEPS.map(({ icon: Icon, label, desc }, i) => (
                  <li key={label} className="flex gap-3">
                    {/* Numéro + ligne */}
                    <div className="flex flex-col items-center">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E0F2F1] text-xs font-black text-[#009688]">
                        {i + 1}
                      </span>
                      {i < STEPS.length - 1 && (
                        <div className="mt-1 w-px flex-1 bg-slate-100" />
                      )}
                    </div>
                    {/* Contenu */}
                    <div className="pb-4">
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-[#009688]" />
                        <p className="text-[13px] font-bold text-slate-900">{label}</p>
                      </div>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">{desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Conseil photos */}
            <div className="rounded-2xl border border-[#B2DFDB] bg-[#E0F2F1] p-4">
              <p className="text-[12px] font-black text-[#009688]">💡 Conseil photo</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[#007168]">
                Les annonces avec au moins 3 photos claires se vendent{" "}
                <strong>3× plus vite</strong>. Prends des photos sous plusieurs angles,
                en bonne lumière.
              </p>
            </div>

            {/* Commission info */}
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-[12px] font-black text-slate-900">💰 Commission Rivendy</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                Une commission est ajoutée automatiquement à ton prix vendeur.
                Tu reçois exactement le montant que tu as saisi — sans surprise.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </RequireAuth>
  );
}
