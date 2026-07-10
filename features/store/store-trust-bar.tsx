import { ShieldCheck, PackageCheck, Truck, BadgeCheck } from "lucide-react";

export function StoreTrustBar({ countryName }: { countryName: string }) {
  const pillars = [
    { icon: ShieldCheck, title: "Paiements protégés", sub: "100% sécurisés" },
    { icon: PackageCheck, title: "Commandes centralisées", sub: "Par Rivendy" },
    { icon: Truck, title: "Livraison suivie", sub: `Partout à ${countryName}` },
    { icon: BadgeCheck, title: "Vendeurs certifiés", sub: "Contrôlés par Rivendy" },
  ];

  return (
    <div className="grid h-full grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:grid-cols-4 lg:gap-x-2">
      {pillars.map(({ icon: Icon, title, sub }) => (
        <div key={title} className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#E0F2F1] text-[#009688]">
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black leading-tight text-slate-900">{title}</p>
            <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400">{sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
