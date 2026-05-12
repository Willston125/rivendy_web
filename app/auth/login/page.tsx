import { Suspense } from "react";
import { MessageCircle, ShieldCheck, Store } from "lucide-react";
import { LoginForm } from "@/features/auth/login-form";

export default function LoginPage() {
  return (
    <div className="mx-auto grid min-h-[80vh] max-w-6xl gap-8 px-4 py-10 md:grid-cols-[1fr_440px] md:px-6">

      {/* ── Panneau gauche — marketing ─────────────────────────────── */}
      <section className="hidden flex-col justify-between rounded-3xl bg-[#1A1A1A] p-10 text-white md:flex">
        <div>
          <span className="inline-block rounded-full bg-[#007168] px-3 py-1 text-xs font-black tracking-wider text-white">
            RIVENDY
          </span>
        </div>

        <div className="space-y-6">
          <h1 className="text-5xl font-black leading-tight">
            Commande sans<br />
            <span className="text-[#00C4B4]">contact direct</span><br />
            vendeur.
          </h1>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#007168]/30">
                <ShieldCheck className="h-4 w-4 text-[#00C4B4]" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Protection acheteur</p>
                <p className="text-xs text-slate-400">Chaque commande est suivie par Rivendy, de la validation à la livraison.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#25D366]/20">
                <MessageCircle className="h-4 w-4 text-[#25D366]" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Via WhatsApp</p>
                <p className="text-xs text-slate-400">Confirmation instantanée sur ton numéro — simple et rapide.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                <Store className="h-4 w-4 text-slate-300" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Vendeurs certifiés</p>
                <p className="text-xs text-slate-400">Les boutiques sont vérifiées et validées par l'équipe Rivendy.</p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs font-semibold text-slate-500">
          Marketplace de confiance · {new Date().getFullYear()}
        </p>
      </section>

      {/* ── Panneau droit — formulaire ─────────────────────────────── */}
      <section className="flex flex-col justify-center rounded-3xl bg-white p-6 shadow-sm md:p-8">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-[#007168]">Connexion</p>
          <h2 className="mt-1 text-3xl font-black text-[#1A1A1A]">Bon retour 👋</h2>
          <p className="mt-2 text-sm text-slate-500">
            Accède à ton panier, tes commandes et ton espace vendeur.
          </p>
        </div>
        <div className="mt-6">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
