"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { QrCode } from "@/components/ui/qr-code";
import { bookingQrPayload } from "@/lib/hotels/types";

/**
 * Référence + QR code à présenter à l'arrivée.
 *
 * ⚠️ Le QR ne contient QUE `RIVENDY:HOTEL:<référence>` (§1.11) : aucun nom,
 * téléphone ni montant. Le code est photographiable par n'importe qui.
 * Il n'est affiché que pour un séjour À VENIR — l'appelant en décide.
 */
export function BookingReferenceCard({ reference, showQr }: { reference: string; showQr: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-sm">
      {showQr ? (
        <>
          <QrCode value={bookingQrPayload(reference)} size={160} title={`QR code de la réservation ${reference}`} />
          <p className="text-xs text-slate-500">Présentez ce code à votre arrivée.</p>
        </>
      ) : null}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Référence</p>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copier la référence ${reference}`}
          className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-full bg-slate-100 px-4 font-mono text-base font-black text-slate-950 hover:bg-slate-200"
        >
          {reference}
          {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden /> : <Copy className="h-4 w-4 text-slate-500" aria-hidden />}
        </button>
        <p className="mt-1 h-4 text-xs font-semibold text-emerald-700" aria-live="polite">
          {copied ? "Référence copiée" : ""}
        </p>
      </div>
    </div>
  );
}
