"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountry } from "@/features/country/country-provider";
import { inMarket, theMarket } from "@/lib/utils/market-phrase";

/**
 * Connecté, le marché du compte reste maître : il décide aussi où l'on publie.
 * Quand un lien ouvre l'accueil d'un autre marché, on le dit et on propose d'y
 * revenir : « Vous consultez la Côte d'Ivoire — revenir aux Comores ».
 * Sans compte, il n'y a pas d'écart : le marché suit le lien (MarketUrlSync).
 */
export function MarketMismatchBanner({ viewedCountryId }: { viewedCountryId: string }) {
  const { country, countries } = useCountry();
  const { user } = useAuth();
  const [hidden, setHidden] = useState(false);

  const viewed = countries.find((c) => c.id === viewedCountryId.toUpperCase());
  if (hidden || !user || !country || !viewed || viewed.id === country.id) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-2xl border border-[#009688]/20 bg-[#E0F2F1] px-4 py-2.5 text-sm text-[#00695C]"
    >
      <p className="min-w-0 flex-1">
        Vous consultez {theMarket(viewed)} —{" "}
        <Link
          href={`/?country=${country.id}`}
          className="whitespace-nowrap font-black underline underline-offset-2 transition hover:text-[#004D40]"
        >
          revenir {inMarket(country)}
        </Link>
      </p>
      <button
        type="button"
        onClick={() => setHidden(true)}
        aria-label="Masquer ce message"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition hover:bg-white/60"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
