import { ShieldCheck, PackageCheck, Truck, HeadphonesIcon } from "lucide-react";

const POINTS = [
  { icon: ShieldCheck, label: "Paiement sécurisé" },
  { icon: PackageCheck, label: "Commande centralisée" },
  { icon: Truck, label: "Livraison suivie" },
  { icon: HeadphonesIcon, label: "Support client dédié" },
];

export function StoreProtectionCard() {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#E0F2F1] text-[#009688]">
          <ShieldCheck className="h-[18px] w-[18px]" />
        </span>
        <h3 className="text-sm font-black leading-tight text-slate-900">
          Votre achat est protégé par Rivendy
        </h3>
      </div>
      <ul className="mt-4 space-y-2.5">
        {POINTS.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <Icon className="h-4 w-4 shrink-0 text-[#009688]" />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
