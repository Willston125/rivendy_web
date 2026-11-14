import Image from "next/image";
import Link from "next/link";
import { Share } from "lucide-react";
import { PLAY_LISTING_URL } from "@/lib/seo";

/**
 * Page /app (2026-11-14) : ce que voient un iPhone, un ordinateur ou un robot.
 * Android ne la voit jamais : `app/app/page.tsx` le redirige vers Google Play.
 * Aucun prix ni achat ici (règle Google Play) : la page renvoie seulement vers la fiche.
 */
export function AppDownloadView({ ios }: { ios: boolean }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-12">
      <section className="rounded-3xl bg-[#E0F2F1] p-6 text-center md:p-10">
        <Image
          src="/brand/rivendy-logo-mark-192.png"
          alt=""
          width={72}
          height={72}
          unoptimized
          className="mx-auto h-[72px] w-[72px] rounded-2xl"
        />
        {ios ? <IosContent /> : <DownloadContent />}
      </section>
      <p className="mt-6 text-center text-xs text-slate-500">
        Google Play et le logo Google Play sont des marques de Google LLC.
      </p>
    </div>
  );
}

function DownloadContent() {
  return (
    <>
      <h1 className="mt-4 text-2xl font-black leading-tight text-slate-900 md:text-4xl">
        Téléchargez l&apos;application Rivendy
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-700 md:text-base">
        Marketplace, Musique et Play : trois univers, une seule application, avec le même compte que sur le site.
      </p>
      <a
        href={PLAY_LISTING_URL}
        target="_blank"
        rel="noopener"
        className="mt-6 inline-block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#009688]"
      >
        <Image
          src="/brand/google-play-badge-fr.png"
          alt="Disponible sur Google Play"
          width={646}
          height={250}
          unoptimized
          className="h-[62px] w-auto"
        />
      </a>
      <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-4 rounded-2xl bg-white p-5 sm:flex-row sm:text-left">
        <Image
          src="/brand/qr-rivendy-app.svg"
          alt="QR code vers www.rivendy.com/app"
          width={148}
          height={148}
          unoptimized
          className="h-[148px] w-[148px] shrink-0"
        />
        <p className="text-sm leading-relaxed text-slate-700">
          <span className="block font-bold text-slate-900">Sur ordinateur ?</span>
          Scannez ce code avec l&apos;appareil photo de votre téléphone Android : Google Play s&apos;ouvre sur Rivendy.
        </p>
      </div>
      <p className="mt-6 text-sm text-slate-700">
        Sur iPhone, Rivendy s&apos;utilise sur le site :{" "}
        <Link href="/" className="font-bold text-[#009688] hover:text-[#007168]">
          www.rivendy.com
        </Link>
      </p>
    </>
  );
}

function IosContent() {
  return (
    <>
      <h1 className="mt-4 text-2xl font-black leading-tight text-slate-900 md:text-4xl">Rivendy sur iPhone</h1>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-700 md:text-base">
        L&apos;application Rivendy existe sur Android (Google Play). Sur iPhone, la Marketplace, la Musique et Play
        sont sur le site, avec le même compte.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-12 items-center rounded-full bg-[#009688] px-7 text-base font-bold text-white hover:bg-[#007168]"
      >
        Ouvrir Rivendy
      </Link>
      <p className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-slate-700">
        Astuce : dans Safari, touchez{" "}
        <Share className="inline h-4 w-4 align-[-3px] text-slate-900" aria-label="Partager" /> puis
        « Sur l&apos;écran d&apos;accueil ». Rivendy s&apos;ouvrira comme une application.
      </p>
    </>
  );
}
