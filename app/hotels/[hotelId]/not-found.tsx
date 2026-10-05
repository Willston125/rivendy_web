import Link from "next/link";
import { Building2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/** Hôtel retiré, suspendu ou lien erroné — même message que l'app. */
export default function HotelNotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E0F2F1] text-[#007168]">
        <Building2 className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="mt-4 text-xl font-black text-slate-950">Cet hôtel n&apos;est plus disponible</h1>
      <p className="mt-2 text-sm text-slate-500">
        Il a peut-être été retiré du catalogue. D&apos;autres établissements vous attendent.
      </p>
      <Link href="/hotels" className={buttonVariants({ variant: "outline", className: "mt-6" })}>
        Voir les hôtels
      </Link>
    </main>
  );
}
