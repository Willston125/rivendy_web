import type { Metadata } from "next";
import Link from "next/link";
import { CopyrightClaimForm } from "@/features/legal/copyright-claim-form";

export const metadata: Metadata = {
  title: "Droits d'auteur — Rivendy",
  description:
    "Signaler une œuvre publiée sans autorisation sur Rivendy Play ou Rivendy Musique : procédure et formulaire.",
  alternates: { canonical: "/droits-auteur" },
};

// Audit n° 19, lot G (GC19-4) : procédure publique droits d'auteur. Le
// formulaire ne demande pas de compte ; l'équipe Rivendy décide au dashboard.
export default function CopyrightPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-slate-800">
      <p className="text-xs font-black uppercase tracking-wider text-[#007168]">Rivendy Play · Rivendy Musique</p>
      <h1 className="mt-1 text-3xl font-black text-[#1A1A1A]">Droits d&apos;auteur</h1>
      <p className="mt-3 text-slate-600">
        Vous êtes titulaire des droits d&apos;une chanson, d&apos;un album, d&apos;une vidéo ou d&apos;un film, ou vous
        représentez ce titulaire, et vous trouvez cette œuvre publiée sur Rivendy sans autorisation ? Signalez-la ici.
        Aucun compte Rivendy n&apos;est nécessaire.
      </p>

      <h2 className="mt-8 text-lg font-black text-[#1A1A1A]">Comment ça se passe</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
        <li>Vous envoyez la réclamation ci-dessous ; vous recevez une référence (DA-…).</li>
        <li>
          L&apos;équipe Rivendy vérifie votre réclamation, en principe sous 72 heures. Si elle est fondée, le contenu
          est retiré de Rivendy et son auteur en est informé. Vos coordonnées ne lui sont pas communiquées.
        </li>
        <li>
          L&apos;auteur du contenu peut contester s&apos;il pense avoir le droit de le publier. Nous vous en informons
          par e-mail avant toute remise en ligne.
        </li>
        <li>Un compte qui reçoit trois avertissements en six mois ne peut plus publier sur Rivendy Play et Rivendy Musique.</li>
      </ol>
      <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
        Une réclamation fausse ou abusive peut engager votre responsabilité. Si vous n&apos;êtes pas sûr que
        l&apos;usage n&apos;est pas autorisé, renseignez-vous avant d&apos;envoyer.
      </p>

      <h2 className="mt-8 text-lg font-black text-[#1A1A1A]">Envoyer une réclamation</h2>
      <div className="mt-3">
        <CopyrightClaimForm />
      </div>

      <h2 className="mt-8 text-lg font-black text-[#1A1A1A]">Votre contenu a été retiré ?</h2>
      <p className="mt-2 text-sm text-slate-700">
        Si vous détenez les droits ou une autorisation, contestez depuis{" "}
        <Link href="/help" className="font-bold text-[#007168] hover:underline">Aide &amp; support</Link>{" "}
        (sujet « Autre chose ») en citant la référence DA-… reçue dans votre notification, et expliquez pourquoi vous
        avez le droit de publier ce contenu.
      </p>
    </main>
  );
}
