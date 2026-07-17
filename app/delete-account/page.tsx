import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Supprimer mon compte — Rivendy",
  description:
    "Comment supprimer définitivement votre compte Rivendy et quelles données sont effacées.",
};

export default function DeleteAccountPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12 text-slate-800">
      <Link
        href="/"
        className="text-sm text-teal-700 hover:underline"
      >
        ← Retour à l&apos;accueil
      </Link>

      <h1 className="mt-6 text-3xl font-bold text-slate-900">
        Supprimer mon compte Rivendy
      </h1>
      <p className="mt-3 text-slate-600">
        Vous pouvez supprimer définitivement votre compte Rivendy à tout moment,
        directement depuis l&apos;application. Cette page explique la procédure et
        les données concernées, conformément à la politique de Google Play.
      </p>

      {/* Procédure in-app */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-slate-900">
          Depuis l&apos;application (recommandé)
        </h2>
        <ol className="mt-4 space-y-3">
          {[
            "Ouvrez l'application Rivendy et connectez-vous à votre compte.",
            "Allez dans Profil, puis Réglages.",
            "En bas de l'écran, dans la section « Zone danger », appuyez sur « Supprimer mon compte ».",
            "Tapez SUPPRIMER pour confirmer, puis validez.",
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white">
                {i + 1}
              </span>
              <span className="pt-0.5 text-slate-700">{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-slate-500">
          La suppression est immédiate et définitive : vous ne pourrez plus vous
          reconnecter avec ce compte.
        </p>
      </section>

      {/* Données supprimées */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-slate-900">
          Données supprimées
        </h2>
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-slate-700">
          <li>Votre compte de connexion (email / téléphone).</li>
          <li>
            Vos informations personnelles : nom, numéro WhatsApp, email, photo de
            profil, informations de boutique.
          </li>
          <li>Vos annonces / produits publiés sont retirés du catalogue.</li>
        </ul>

        <h3 className="mt-6 text-base font-semibold text-slate-900">
          Données conservées (obligations légales et comptables)
        </h3>
        <p className="mt-2 text-slate-700">
          Pour des raisons légales, comptables et de prévention de la fraude,
          l&apos;historique des commandes déjà réalisées (montants, statut de
          livraison) est conservé de manière anonymisée : votre nom n&apos;y est
          plus associé de façon identifiable.
        </p>
      </section>

      {/* Contact */}
      <section className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-lg font-semibold text-slate-900">
          Besoin d&apos;aide ?
        </h2>
        <p className="mt-2 text-slate-700">
          Si vous ne parvenez pas à supprimer votre compte depuis
          l&apos;application, écrivez-nous à{" "}
          <a
            href="mailto:contact@fortixa.fr"
            className="font-medium text-teal-700 hover:underline"
          >
            contact@fortixa.fr
          </a>{" "}
          en précisant le numéro de téléphone ou l&apos;email associé à votre
          compte. Nous traiterons votre demande sous 30 jours.
        </p>
      </section>
    </main>
  );
}
