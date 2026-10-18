import Link from "next/link";
import { Download, Smartphone, Music2 } from "lucide-react";
import { appIntentUrl, PLAY_STORE_URL } from "@/features/play/play-link-page";

/**
 * Rivendy Musique — page de repli d'un lien partagé (lot 4, 2026-10-16) :
 * `/musique/release/{id}`, `/musique/podcast/{id}` et, depuis le lot M6
 * (2026-10-18), `/musique/story/{id}` (story d'un artiste, 24 h ou « À la une »).
 *
 * Avec l'application Rivendy (version qui contient Rivendy Musique), Android
 * ouvre le lien DIRECTEMENT dans l'app (App Link, même hôte vérifié que /store
 * et /play). Cette page ne s'affiche donc que sans l'app, ou avec une version
 * plus ancienne : pochette, titres, et le chemin vers l'application.
 *
 * ⚠️ Aucun prix, aucun Pass, aucun lien d'achat ici : le lien vient de l'app
 * Android (règle Google Play) — la page renvoie seulement vers Google Play.
 * L'écoute reste dans l'application (aucun fichier audio n'est lisible ici).
 */

export type MusiqueLinkContent = {
  kicker: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  image?: string | null;
  /** Titres ou épisodes, pour donner envie (titre + durée « 3:05 »). */
  items?: { title: string; duration?: string | null }[];
  /** Phrase d'invitation sous le contenu (sinon celle d'une sortie). */
  note?: string;
};

export function formatMusiqueDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || seconds < 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function MusiqueLinkPage({
  path,
  content,
  unavailableTitle = "Ce contenu n’est plus disponible",
}: {
  path: string;
  content: MusiqueLinkContent | null;
  unavailableTitle?: string;
}) {
  return (
    <div className="min-h-[80vh] bg-[#0D0B19] px-4 py-10 text-slate-100">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 md:flex-row md:items-start">
        <div className="relative aspect-square w-full max-w-[280px] shrink-0 overflow-hidden rounded-2xl bg-[#1F1A36] shadow-2xl">
          {content?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={content.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Music2 className="h-14 w-14 text-[#F5B83D]" />
            </div>
          )}
        </div>

        <div className="flex w-full flex-col items-center text-center md:items-start md:text-left">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#F5B83D]">
            {content ? content.kicker : "Rivendy Musique"}
          </p>
          <h1 className="mt-2 text-3xl font-black leading-tight text-white md:text-4xl">
            {content ? content.title : unavailableTitle}
          </h1>
          {content?.subtitle ? <p className="mt-2 text-sm font-semibold text-slate-300">{content.subtitle}</p> : null}
          {content?.description ? (
            <p className="mt-4 line-clamp-5 whitespace-pre-line text-sm leading-6 text-slate-300">{content.description}</p>
          ) : null}

          {content?.items && content.items.length > 0 ? (
            <ol className="mt-5 w-full space-y-1 text-left text-sm text-slate-300">
              {content.items.slice(0, 12).map((item, i) => (
                <li key={`${i}-${item.title}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 odd:bg-white/5">
                  <span className="w-5 text-right text-xs font-bold text-slate-500">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  {item.duration ? <span className="text-xs text-slate-500">{item.duration}</span> : null}
                </li>
              ))}
            </ol>
          ) : null}

          <p className="mt-6 text-sm text-slate-400">
            {content
              ? (content.note ??
                "Écoutez-le en entier, ajoutez-le à vos playlists et suivez vos artistes dans l’application Rivendy.")
              : "Découvrez les singles, albums et podcasts de Rivendy Musique dans l’application Rivendy."}
          </p>

          <div className="mt-6 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <a
              href={PLAY_STORE_URL}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#F5B83D] px-6 text-sm font-black text-[#1A1206] transition hover:bg-[#F8CB6E]"
            >
              <Download className="h-4 w-4" />
              Télécharger Rivendy
            </a>
            <a
              href={appIntentUrl(path)}
              className="flex h-12 items-center justify-center gap-2 rounded-full border border-white/20 px-6 text-sm font-bold text-white transition hover:bg-white/10"
            >
              <Smartphone className="h-4 w-4" />
              J’ai déjà l’application
            </a>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Application Android gratuite. Déjà installée ? Mettez-la à jour pour ouvrir ce lien directement.
          </p>
          <Link href="/" className="mt-8 text-sm font-semibold text-[#F5B83D] underline-offset-4 hover:underline">
            Voir la marketplace Rivendy
          </Link>
        </div>
      </div>
    </div>
  );
}
