"use client";

// ════════════════════════════════════════════════════════════════════
// ✅ Confirmation d'adresse de récupération — atterrissage du lien reçu
// ════════════════════════════════════════════════════════════════════
// Le lien est envoyé par change-email à la NOUVELLE adresse. L'ouvrir prouve
// que le titulaire relève bien cette boîte : tant que ce n'est pas fait,
// password-reset n'y enverra aucun lien de réinitialisation (audit 21,
// EDGE-1). Le client ne pose rien : l'Edge Function password-reset
// (action verify_email) marque la preuve en service_role.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle, Link2Off, Loader2 } from "lucide-react";
import { resetMessage, verifyEmailToken } from "@/lib/utils/password-reset";

type Phase = "verification" | "succes" | "lienMort";

export function VerifyEmailForm() {
  const params = useSearchParams();
  const token = (params.get("token") ?? "").trim().toLowerCase();

  const [phase, setPhase] = useState<Phase>("verification");
  const [deadReason, setDeadReason] = useState("");

  const run = useCallback(async () => {
    if (!/^[0-9a-f]{64}$/.test(token)) {
      setDeadReason("Ce lien est incomplet ou a été tronqué par votre messagerie.");
      setPhase("lienMort");
      return;
    }
    const res = await verifyEmailToken(token);
    if (res.ok) {
      setPhase("succes");
      return;
    }
    setDeadReason(resetMessage(res));
    setPhase("lienMort");
  }, [token]);

  useEffect(() => {
    void run();
  }, [run]);

  if (phase === "verification") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#009688]" />
        <p className="mt-4 text-sm text-slate-500">Confirmation de votre adresse…</p>
      </div>
    );
  }

  if (phase === "succes") {
    return (
      <div className="mx-auto max-w-md space-y-6 px-4 py-12 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#E0F2F1]">
          <CheckCircle className="h-10 w-10 text-[#009688]" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-[#1A1A1A]">Adresse confirmée</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            Votre adresse de récupération est activée. En cas d&apos;oubli de mot de
            passe, vous pourrez recevoir un lien de réinitialisation à cette adresse.
          </p>
        </div>
        <Link
          href="/"
          className="flex h-14 items-center justify-center rounded-2xl bg-[#009688] text-sm font-black text-white transition hover:bg-[#00796B]"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-12 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
        <Link2Off className="h-9 w-9 text-red-500" />
      </div>
      <div>
        <h1 className="text-2xl font-black text-[#1A1A1A]">Lien inutilisable</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">{deadReason}</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          Rouvrez « Informations personnelles » dans votre compte pour renvoyer un
          lien de confirmation.
        </p>
      </div>
      <Link
        href="/"
        className="flex h-14 items-center justify-center rounded-2xl bg-[#009688] text-sm font-black text-white transition hover:bg-[#00796B]"
      >
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
