"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Loader2, MapPin, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchLocalities,
  fetchNeighborhoods,
  fetchRegions,
  formatKmf,
  matchesLocationQuery,
  resolveDeliveryFee,
  type DeliveryAddress,
  type DeliveryLocality,
  type DeliveryNeighborhood,
  type DeliveryRegion,
} from "@/lib/utils/delivery-location";

/**
 * 📍 SÉLECTION D'ADRESSE — parité avec l'app Flutter
 *
 * Parcours progressif : Région → Localité → Quartier → Repère.
 *
 * ⚠️ L'acheteur ne voit JAMAIS une liste unique des 201 localités : c'est tout
 * l'objet du découpage. Les localités affichées sont uniquement celles de la
 * région choisie.
 *
 * ⚠️ CASCADE — changer un niveau invalide tous les niveaux inférieurs. Sans ça,
 * on peut se retrouver avec une localité de Mbadjini-Est (3 000 KMF) sous la
 * région Moroni-Bambao (500 KMF) et facturer le mauvais tarif.
 */

interface Props {
  /** Remonte l'adresse courante, ou `null` si elle est incomplète. */
  onChange: (address: DeliveryAddress | null) => void;
}

export function DeliveryAddressPicker({ onChange }: Props) {
  const [regions, setRegions] = useState<DeliveryRegion[]>([]);
  const [localities, setLocalities] = useState<DeliveryLocality[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<DeliveryNeighborhood[]>([]);

  const [region, setRegion] = useState<DeliveryRegion | null>(null);
  const [locality, setLocality] = useState<DeliveryLocality | null>(null);
  const [neighborhood, setNeighborhood] = useState<DeliveryNeighborhood | null>(null);
  const [customNeighborhood, setCustomNeighborhood] = useState("");
  const [customMode, setCustomMode] = useState(false);

  const [landmark, setLandmark] = useState("");
  const [addressDetails, setAddressDetails] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");

  const [localityQuery, setLocalityQuery] = useState("");
  const [neighborhoodQuery, setNeighborhoodQuery] = useState("");

  const [loadingRegions, setLoadingRegions] = useState(true);
  const [loadingLocalities, setLoadingLocalities] = useState(false);
  const [loadingNeighborhoods, setLoadingNeighborhoods] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // ── Chargement des régions ───────────────────────────────────────────────
  const loadRegions = useCallback(() => {
    setLoadingRegions(true);
    setLoadError(false);
    fetchRegions()
      .then((list) => {
        setRegions(list);
        if (list.length === 0) setLoadError(true);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoadingRegions(false));
  }, []);

  useEffect(() => {
    loadRegions();
  }, [loadRegions]);

  const fee = useMemo(
    () => resolveDeliveryFee({ region, locality, neighborhood }),
    [region, locality, neighborhood]
  );

  // Remonte l'adresse au parent dès qu'un champ change.
  useEffect(() => {
    if (!region || !locality) {
      onChange(null);
      return;
    }
    onChange({
      region,
      locality,
      neighborhood,
      customNeighborhood,
      landmark,
      addressDetails,
      recipientPhone,
      deliveryFeeKmf: fee,
    });
  }, [
    region,
    locality,
    neighborhood,
    customNeighborhood,
    landmark,
    addressDetails,
    recipientPhone,
    fee,
    onChange,
  ]);

  // ── Sélection avec cascade ───────────────────────────────────────────────
  function selectRegion(next: DeliveryRegion) {
    if (region?.id === next.id) return;
    setRegion(next);
    // Cascade : tout ce qui dépend de la région devient invalide.
    setLocality(null);
    setNeighborhood(null);
    setCustomNeighborhood("");
    setCustomMode(false);
    setLocalities([]);
    setNeighborhoods([]);
    setLocalityQuery("");

    setLoadingLocalities(true);
    fetchLocalities(next.id)
      .then(setLocalities)
      .catch(() => setLocalities([]))
      .finally(() => setLoadingLocalities(false));
  }

  function selectLocality(next: DeliveryLocality) {
    if (locality?.id === next.id) return;
    setLocality(next);
    // Cascade : le quartier dépend de la localité.
    setNeighborhood(null);
    setCustomNeighborhood("");
    setCustomMode(false);
    setNeighborhoods([]);
    setNeighborhoodQuery("");

    setLoadingNeighborhoods(true);
    fetchNeighborhoods(next.id)
      .then(setNeighborhoods)
      .catch(() => setNeighborhoods([]))
      .finally(() => setLoadingNeighborhoods(false));
  }

  // Les deux modes de quartier sont exclusifs : sinon le tarif serait ambigu.
  function selectNeighborhood(next: DeliveryNeighborhood) {
    setNeighborhood(next);
    setCustomNeighborhood("");
  }

  function changeCustomNeighborhood(value: string) {
    setCustomNeighborhood(value);
    if (value.trim()) setNeighborhood(null);
  }

  const visibleLocalities = useMemo(
    () => localities.filter((l) => matchesLocationQuery(l.name, localityQuery)),
    [localities, localityQuery]
  );
  const visibleNeighborhoods = useMemo(
    () =>
      neighborhoods.filter((n) => matchesLocationQuery(n.name, neighborhoodQuery)),
    [neighborhoods, neighborhoodQuery]
  );

  // ── Rendu ────────────────────────────────────────────────────────────────
  if (loadingRegions) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
        <p className="text-[13px] text-slate-600">
          Zones de livraison indisponibles pour le moment.
        </p>
        <button
          type="button"
          onClick={loadRegions}
          className="mt-2 text-[13px] font-bold text-[#009688] hover:underline"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Étape 1 — Région */}
      <div>
        <Label className="text-sm font-bold text-slate-700">
          1. Région <span className="text-red-500">*</span>
        </Label>
        <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {regions.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectRegion(item)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                region?.id === item.id
                  ? "border-[#009688] bg-teal-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <MapPin
                className={`h-4 w-4 shrink-0 ${
                  region?.id === item.id ? "text-[#009688]" : "text-slate-400"
                }`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-slate-900">
                  {item.name}
                </span>
                <span className="block text-[11px] text-slate-500">
                  à partir de {formatKmf(item.base_fee_kmf)}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
            </button>
          ))}
        </div>
      </div>

      {/* Étape 2 — Localité */}
      {region && (
        <div>
          <Label className="text-sm font-bold text-slate-700">
            2. Ville ou village <span className="text-red-500">*</span>
          </Label>

          {loadingLocalities ? (
            <div className="flex items-center gap-2 py-4 text-[13px] text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : (
            <>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={localityQuery}
                  onChange={(e) => setLocalityQuery(e.target.value)}
                  placeholder="Rechercher une ville, un village ou une commune"
                  className="pl-9"
                />
                {localityQuery && (
                  <button
                    type="button"
                    onClick={() => setLocalityQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label="Effacer la recherche"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
                {visibleLocalities.length === 0 ? (
                  <p className="py-4 text-center text-[13px] text-slate-400">
                    Aucun résultat dans {region.name}.
                  </p>
                ) : (
                  visibleLocalities.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectLocality(item)}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                        locality?.id === item.id
                          ? "border-[#009688] bg-teal-50"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <span className="truncate text-[13px] font-semibold text-slate-800">
                        {item.name}
                      </span>
                      {/* Tarif spécifique signalé : l'acheteur doit comprendre
                          pourquoi le montant diffère du « à partir de ». */}
                      {item.custom_fee_kmf != null && (
                        <span className="ml-2 shrink-0 text-[11px] font-bold text-[#009688]">
                          {formatKmf(item.custom_fee_kmf)}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Étape 3 — Quartier */}
      {locality && (
        <div>
          <Label className="text-sm font-bold text-slate-700">
            3. Quartier <span className="text-red-500">*</span>
          </Label>

          {loadingNeighborhoods ? (
            <div className="flex items-center gap-2 py-4 text-[13px] text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : neighborhoods.length === 0 || customMode ? (
            // Aucun quartier enregistré, ou l'acheteur a choisi « Autre » :
            // saisie libre.
            <div className="mt-2">
              <Input
                value={customNeighborhood}
                onChange={(e) => changeCustomNeighborhood(e.target.value)}
                placeholder="Ex. : derrière le marché"
              />
              {neighborhoods.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomMode(false);
                    setCustomNeighborhood("");
                  }}
                  className="mt-1.5 text-[12px] font-bold text-[#009688] hover:underline"
                >
                  ← Revenir à la liste des quartiers
                </button>
              )}
            </div>
          ) : (
            <>
              {neighborhoods.length > 8 && (
                <div className="relative mt-2">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={neighborhoodQuery}
                    onChange={(e) => setNeighborhoodQuery(e.target.value)}
                    placeholder="Rechercher un quartier"
                    className="pl-9"
                  />
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {visibleNeighborhoods.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectNeighborhood(item)}
                    className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                      neighborhood?.id === item.id
                        ? "border-[#009688] bg-[#009688] text-white"
                        : "border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    {item.name}
                    {item.custom_fee_kmf != null && (
                      <span className="ml-1 opacity-70">
                        · {formatKmf(item.custom_fee_kmf)}
                      </span>
                    )}
                  </button>
                ))}
                {/* Toujours en fin de liste, comme dans l'app. */}
                <button
                  type="button"
                  onClick={() => setCustomMode(true)}
                  className="rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-[12px] font-semibold text-slate-500 hover:border-[#009688] hover:text-[#009688]"
                >
                  Autre quartier
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Étape 4 — Repère et détails */}
      {locality && (
        <div className="space-y-3">
          <div>
            <Label htmlFor="landmark" className="text-sm font-bold text-slate-700">
              Point de repère <span className="text-red-500">*</span>
            </Label>
            <Input
              id="landmark"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              placeholder="Ex. : près de la grande mosquée"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label
              htmlFor="addressDetails"
              className="text-sm font-bold text-slate-700"
            >
              Adresse complémentaire
            </Label>
            <Input
              id="addressDetails"
              value={addressDetails}
              onChange={(e) => setAddressDetails(e.target.value)}
              placeholder="Ex. : maison bleue, portail noir"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label
              htmlFor="recipientPhone"
              className="text-sm font-bold text-slate-700"
            >
              Numéro du destinataire
            </Label>
            <Input
              id="recipientPhone"
              type="tel"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              placeholder="Ex. : +269 333 44 55"
              className="mt-1.5"
            />
          </div>
        </div>
      )}

      {/* Tarif résolu */}
      {region && locality && (
        <div className="flex items-center justify-between rounded-xl border border-[#B2DFDB] bg-[#E0F2F1] px-4 py-3">
          <span className="text-[13px] font-bold text-[#007168]">
            Frais de livraison
          </span>
          <span className="text-[16px] font-black text-[#009688]">
            {formatKmf(fee)}
          </span>
        </div>
      )}
    </div>
  );
}
