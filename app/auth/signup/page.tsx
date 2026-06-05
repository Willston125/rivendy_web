import type { Metadata } from "next";
import { BadgeCheck, Package, Wallet } from "lucide-react";
import { SignupForm } from "@/features/auth/signup-form";

export const metadata: Metadata = {
  title: "Créer un compte — Rivendy",
  description: "Inscrivez-vous sur Rivendy pour acheter des articles ou commencer à vendre sur notre marketplace.",
};

export default function SignupPage() {
  return (
    <div className="mx-auto grid min-h-[80vh] max-w-6xl gap-8 px-4 py-10 md:grid-cols-[1fr_480px] md:px-6">

      {/* ── Panneau gauche — marketing ─────────────────────────────── */}
      <section className="hidden flex-col justify-between rounded-3xl bg-[#007168] p-10 text-white md:flex">
        <div>
          <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-black tracking-wider text-white">
            RIVENDY
          </span>
        </div>

        <div className="space-y-6">
          <h1 className="text-5xl font-black leading-tight">
            Rejoins la<br />
            <span className="text-[#E0F2F1]">marketplace</span><br />
            de confiance.
          </h1>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20">
                <Package className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Acheteur</p>
                <p className="text-xs text-white/70">
                  Commande des produits vérifiés. Aucun contact direct avec le vendeur — Rivendy gère tout.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20">
                <Wallet className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Vendeur</p>
                <p className="text-xs text-white/70">
                  Publie tes produits, reçois les commandes via Rivendy, encaisse tes gains.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20">
                <BadgeCheck className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Certifiable</p>
                <p className="text-xs text-white/70">
                  Après tes premières ventes, demande ta certification vendeur Rivendy.
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs font-semibold text-white/40">
          Marketplace de confiance · {new Date().getFullYear()}
        </p>
      </section>

      {/* ── Panneau droit — formulaire ─────────────────────────────── */}
      <section className="flex flex-col justify-center rounded-3xl bg-white p-6 shadow-sm md:p-8">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-[#007168]">Inscription</p>
          <h2 className="mt-1 text-3xl font-black text-[#1A1A1A]">Créer un compte</h2>
          <p className="mt-2 text-sm text-slate-500">
            Acheteur ou vendeur — ton profil Rivendy en 30 secondes.
          </p>
        </div>
        <div className="mt-6">
          <SignupForm />
        </div>
      </section>
    </div>
  );
}
