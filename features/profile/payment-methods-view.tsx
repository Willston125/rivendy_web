"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Smartphone,
  CreditCard,
  Plus,
  Trash2,
  CreditCardIcon,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { useCountryOrDefault } from "@/features/country/country-provider";
import { getMobileMoneyForCountry } from "@/lib/utils/mobile-money";
import { phoneHint } from "@/lib/utils/phone-validator";

/* ── Types ─────────────────────────────────────────────────── */

/** Nom de l'opérateur (Waafi, M-Pesa…) ou « Cash ». */
type PaymentType = string;

interface SavedMethod {
  id: string;
  type: PaymentType;
  name: string;
  number: string;
}

const CASH = "Cash";

/* ── Component ─────────────────────────────────────────────── */

/**
 * Moyens de paiement du vendeur — comme l'app (payment_methods_screen), ils
 * sont conservés SUR L'APPAREIL. Corrigé le 2026-10-04 : le site les perdait
 * au rechargement et ne proposait que les opérateurs de Djibouti ; ils
 * viennent désormais du marché courant (mobile-money.ts, miroir de l'app).
 */
export function PaymentMethodsView() {
  const { user } = useAuth();
  const country = useCountryOrDefault();
  const storageKey = user ? `rivendy_payment_methods:${user.id}` : null;

  const operators = useMemo(
    () => (country ? getMobileMoneyForCountry(country.id).filter((m) => m.id !== "cash") : []),
    [country],
  );
  const PAYMENT_TYPES: PaymentType[] = useMemo(() => [...operators.map((o) => o.name), CASH], [operators]);

  const [methods, setMethods] = useState<SavedMethod[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedType, setSelectedType] = useState<PaymentType>(CASH);
  const [nameValue, setNameValue] = useState("");
  const [phoneValue, setPhoneValue] = useState("");
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Lecture des moyens enregistrés sur cet appareil, pour ce compte.
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      setMethods(raw ? (JSON.parse(raw) as SavedMethod[]) : []);
    } catch {
      setMethods([]);
    }
    setLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || !loaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(methods));
    } catch {
      /* stockage indisponible : la liste reste en mémoire */
    }
  }, [methods, storageKey, loaded]);

  function getIcon(type: PaymentType) {
    return type === CASH ? CreditCard : Smartphone;
  }

  function getColor(type: PaymentType) {
    return operators.find((o) => o.name === type)?.color ?? (type === CASH ? "#6A5ACD" : "#007168");
  }

  function handleAdd() {
    setError("");
    if (!nameValue.trim()) {
      setError("Veuillez entrer le nom du titulaire");
      return;
    }
    if (selectedType !== CASH && !phoneValue.trim()) {
      setError("Veuillez entrer le numéro");
      return;
    }

    const newMethod: SavedMethod = {
      id: crypto.randomUUID(),
      type: selectedType,
      name: nameValue.trim(),
      number: selectedType === CASH ? "Paiement en espèces" : phoneValue.trim(),
    };
    setMethods((prev) => [...prev, newMethod]);
    setNameValue("");
    setPhoneValue("");
    setSelectedType(CASH);
    setShowModal(false);
  }

  function confirmDelete(id: string) {
    setDeleteId(id);
  }

  function handleDelete() {
    if (!deleteId) return;
    setMethods((prev) => prev.filter((m) => m.id !== deleteId));
    setDeleteId(null);
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-wider text-[#009688]">Rivendy</p>
        <h1 className="mt-1 text-3xl font-black text-[#1A1A1A]">
          Moyens de paiement
        </h1>
      </div>

      {/* Empty state */}
      {methods.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-[#00C4B4]/10">
            <CreditCardIcon className="h-12 w-12 text-[#00C4B4]" />
          </div>
          <p className="text-xl font-bold text-[#1A1A1A]">
            Aucun moyen de paiement
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Ajoutez D-Money, CAC Pay, Waafi ou Cash
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {methods.map((m) => {
            const Icon = getIcon(m.type);
            const color = getColor(m.type);
            return (
              <div
                key={m.id}
                className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm"
              >
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: `${color}18` }}
                >
                  <Icon className="h-5 w-5" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#1A1A1A]">{m.type}</p>
                  <p className="truncate text-xs text-slate-500">{m.name}</p>
                  <p className="text-sm font-semibold text-[#1A1A1A]">
                    {m.number}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => confirmDelete(m.id)}
                  className="rounded-xl p-2 text-red-400 transition hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* FAB */}
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="fixed bottom-6 right-6 flex items-center gap-2 rounded-2xl bg-[#009688] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#007168]/30 transition hover:bg-[#00796B]"
      >
        <Plus className="h-5 w-5" />
        Ajouter
      </button>

      {/* Add modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-3xl bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-slate-200" />
            <h2 className="mb-5 text-xl font-black text-[#1A1A1A]">
              Ajouter un moyen de paiement
            </h2>

            {/* Type chips */}
            <p className="mb-2 text-sm font-semibold text-[#1A1A1A]">Type</p>
            <div className="mb-4 flex flex-wrap gap-2">
              {PAYMENT_TYPES.map((type) => {
                const active = selectedType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedType(type)}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                      active
                        ? "bg-[#00C4B4]/20 text-[#009688]"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>

            {/* Name */}
            <div className="mb-3">
              <label className="mb-1 block text-sm font-semibold text-[#1A1A1A]">
                Nom du titulaire
              </label>
              <input
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                placeholder="Votre nom complet"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#009688] focus:ring-2 focus:ring-[#009688]/20"
              />
            </div>

            {/* Phone */}
            {selectedType !== CASH && (
              <div className="mb-4">
                <label className="mb-1 block text-sm font-semibold text-[#1A1A1A]">
                  Numéro {selectedType}
                </label>
                <input
                  type="tel"
                  value={phoneValue}
                  onChange={(e) => setPhoneValue(e.target.value)}
                  placeholder={phoneHint(country?.id)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#009688] focus:ring-2 focus:ring-[#009688]/20"
                />
              </div>
            )}

            {error && (
              <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-600">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleAdd}
              className="w-full rounded-2xl bg-[#009688] py-4 text-sm font-black text-white transition hover:bg-[#00796B]"
            >
              Ajouter
            </button>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6">
            <p className="mb-2 text-lg font-black text-[#1A1A1A]">Supprimer</p>
            <p className="mb-5 text-sm text-slate-500">
              Supprimer{" "}
              <strong>
                {methods.find((m) => m.id === deleteId)?.type}
              </strong>{" "}
              de{" "}
              <strong>
                {methods.find((m) => m.id === deleteId)?.name}
              </strong>{" "}
              ?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 rounded-xl bg-red-500 py-3 text-sm font-bold text-white transition hover:bg-red-600"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
