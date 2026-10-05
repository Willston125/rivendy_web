"use client"; // Les error boundaries doivent être des Client Components

import Link from "next/link";
import { useEffect } from "react";

/**
 * Filet global (2026-10-04). Avant ce fichier, toute erreur côté navigateur
 * affichait l'écran brut « Application error » sans issue — c'est ainsi que
 * la page /notifications plantait sans qu'aucun message ne le dise.
 * `unstable_retry` (Next 16) relance le rendu du segment.
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Rivendy — erreur de rendu :", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-3 text-4xl">⚠️</div>
      <h1 className="text-lg font-black text-slate-900">Cette page n&apos;a pas pu s&apos;afficher</h1>
      <p className="mt-2 text-sm text-slate-500">
        Vos données ne sont pas perdues. Réessayez, ou revenez à l&apos;accueil.
      </p>
      {error.digest && <p className="mt-3 text-xs text-slate-400">Référence : {error.digest}</p>}
      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="rounded-full bg-[#009688] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#007168]"
        >
          Réessayer
        </button>
        <Link
          href="/"
          className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
        >
          Accueil
        </Link>
      </div>
    </div>
  );
}
