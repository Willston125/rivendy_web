"use client";

import { useEffect, useMemo, useRef } from "react";
import { ImagePlus, X } from "lucide-react";
import type { PendingPaymentRequest } from "@/lib/supabase/payment-proof";

/**
 * Capture du paiement Mobile Money — boutons partagés par les écrans boost et
 * abonnement (2026-10-10), miroir de `payment_proof_picker.dart` côté app.
 * L'envoi se fait au clic sur « J'ai payé » ; la capture reste facultative.
 */
export function PaymentProofField({
  file,
  onChange,
  color = "#009688",
  disabled = false,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  color?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files?.[0] ?? null;
          e.target.value = "";
          if (picked) onChange(picked);
        }}
      />
      {file && preview ? (
        <div
          className="flex items-center gap-3 rounded-xl border p-2"
          style={{ borderColor: `${color}55`, backgroundColor: `${color}0F` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:) */}
          <img src={preview} alt="Capture du paiement" className="h-12 w-12 rounded-lg object-cover" />
          <span className="flex-1 text-sm font-bold text-slate-700">Capture ajoutée ✓</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="rounded-lg px-2 py-1 text-xs font-bold text-slate-600 hover:bg-white disabled:opacity-40"
          >
            Changer
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
            aria-label="Retirer la capture"
            className="rounded-lg p-1 text-slate-500 hover:bg-white disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] bg-white py-3 text-sm font-bold transition hover:opacity-80 disabled:opacity-40"
          style={{ borderColor: `${color}88`, color }}
        >
          <ImagePlus className="h-4 w-4" />
          Ajouter la capture du paiement
        </button>
      )}
    </div>
  );
}

/** Rappel d'une demande EN ATTENTE, avec de quoi joindre la capture après coup. */
export function PendingPaymentBanner({
  title,
  request,
  busy,
  onAddProof,
}: {
  title: string;
  request: PendingPaymentRequest;
  busy: boolean;
  onAddProof: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isCash = request.payment_method === "cash";
  const hasProof = !!request.payment_proof_path;
  return (
    <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 p-4">
      <p className="text-sm font-black text-[#1A1A1A]">⏳ {title}</p>
      {request.payment_reference && (
        <p className="mt-1 text-xs text-slate-600">Référence : {request.payment_reference}</p>
      )}
      <p className="mt-2 text-sm text-slate-700">
        {isCash
          ? "L'équipe Rivendy vous contacte pour le règlement en espèces."
          : hasProof
            ? "Capture du paiement reçue ✓ — l'équipe vérifie votre paiement."
            : "Ajoutez la capture de votre paiement : la validation sera plus rapide."}
      </p>
      {!isCash && !hasProof && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const picked = e.target.files?.[0];
              e.target.value = "";
              if (picked) onAddProof(picked);
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-2.5 text-sm font-black text-white transition hover:bg-orange-700 disabled:opacity-60"
          >
            <ImagePlus className="h-4 w-4" />
            {busy ? "Envoi…" : "Ajouter la capture du paiement"}
          </button>
        </>
      )}
    </div>
  );
}
