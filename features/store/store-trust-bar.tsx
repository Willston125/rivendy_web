import { ShieldCheck, PackageCheck, Truck, BadgeCheck } from "lucide-react";

const PILLARS = [
  { icon: ShieldCheck, title: "Paiements protégés", desc: "Vos paiements sont sécurisés par Rivendy." },
  { icon: PackageCheck, title: "Commandes centralisées", desc: "Rivendy gère chaque commande de bout en bout." },
  { icon: Truck, title: "Livraison suivie", desc: "Suivez votre commande jusqu'à la remise." },
  { icon: BadgeCheck, title: "Vendeurs vérifiés", desc: "Boutiques contrôlées et certifiées par Rivendy." },
];

export function StoreTrustBar() {
  return (
    <section aria-label="Garanties Rivendy" className="mt-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {PILLARS.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E0F2F1] text-[#009688]">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-900">{title}</p>
              <p className="mt-0.5 text-xs leading-snug text-slate-500">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
