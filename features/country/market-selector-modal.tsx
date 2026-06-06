"use client";

import { useState } from "react";
import { Globe, CheckCircle2 } from "lucide-react";
import { useCountry } from "@/features/country/country-provider";
import type { Country } from "@/types/rivendy";

// Drapeaux emoji — miroir exact de _region_selector.dart Flutter
const FLAGS: Record<string, string> = {
  BF: "🇧🇫", CM: "🇨🇲", KM: "🇰🇲", CI: "🇨🇮", DJ: "🇩🇯",
  ET: "🇪🇹", FR: "🇫🇷", KE: "🇰🇪", MG: "🇲🇬", ML: "🇲🇱",
  MR: "🇲🇷", YT: "🇾🇹", RE: "🇷🇪", SN: "🇸🇳", SO: "🇸🇴", TZ: "🇹🇿",
};

const DIAL: Record<string, string> = {
  BF: "+226", CM: "+237", KM: "+269", CI: "+225", DJ: "+253",
  ET: "+251", FR: "+33",  KE: "+254", MG: "+261", ML: "+223",
  MR: "+222", YT: "+262", RE: "+262", SN: "+221", SO: "+252", TZ: "+255",
};

function CountryRow({
  country,
  selected,
  onSelect,
}: {
  country: Country;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-left transition-all ${
        selected
          ? "bg-[#007168]/10 ring-2 ring-[#007168]"
          : "hover:bg-slate-50"
      }`}
    >
      <span className="text-3xl leading-none">{FLAGS[country.id] ?? "🌍"}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-[15px] font-bold ${selected ? "text-[#007168]" : "text-slate-900"}`}>
          {country.name}
        </p>
        <p className="text-xs text-slate-400">{DIAL[country.id] ?? ""}</p>
      </div>
      {selected && <CheckCircle2 className="h-5 w-5 shrink-0 text-[#007168]" />}
    </button>
  );
}

/**
 * Modal de sélection de marché obligatoire.
 * S'affiche quand needsMarketSelection = true — pas de bouton fermer.
 * Parity Flutter : _CountryPickerSheet (bottom-sheet draggable).
 */
export function MarketSelectorModal() {
  const { needsMarketSelection, countries, setCountryId, reloadCountries } = useCountry();
  const [pending, setPending] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);

  if (!needsMarketSelection) return null;

  async function handleRetry() {
    setRetrying(true);
    await reloadCountries();
    setRetrying(false);
  }

  async function handleSelect(countryId: string) {
    setPending(countryId);
    setLoading(true);
    await setCountryId(countryId);
    setLoading(false);
    // Le provider va mettre country != null → needsMarketSelection = false → modal disparaît
  }

  return (
    // Backdrop plein écran — z-50 pour passer au-dessus du header (z-40)
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md sm:rounded-3xl rounded-t-3xl bg-white overflow-hidden shadow-2xl">

        {/* En-tête */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          {/* Drag handle — mobile */}
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E0F2F1]">
              <Globe className="h-5 w-5 text-[#007168]" />
            </div>
            <div>
              <p className="text-[17px] font-black text-slate-950">Choisissez votre marché</p>
              <p className="text-xs text-slate-400">Rivendy est disponible dans {countries.length} pays</p>
            </div>
          </div>
        </div>

        {/* Liste des pays */}
        <div className="max-h-[60vh] overflow-y-auto px-3 py-3">
          {countries.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <p className="text-sm text-slate-400">
                Impossible de charger les marchés.
              </p>
              <button
                type="button"
                onClick={handleRetry}
                disabled={retrying}
                className="rounded-full bg-[#009688] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#00796B] disabled:opacity-60"
              >
                {retrying ? "Chargement…" : "Réessayer"}
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {countries.map((c) => (
                <CountryRow
                  key={c.id}
                  country={c}
                  selected={pending === c.id}
                  onSelect={() => !loading && handleSelect(c.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-4">
          <p className="text-center text-[11px] text-slate-400">
            Vous pouvez changer de marché à tout moment depuis le menu.
          </p>
        </div>
      </div>
    </div>
  );
}
