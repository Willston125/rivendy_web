"use client";

import { useState } from "react";
import { Play } from "lucide-react";

const STREAM_SUBDOMAIN = "customer-22iqkw4cwdg7uf5h.cloudflarestream.com";

/** Miniature Cloudflare Stream d'une vidéo produit (générée côté Stream). */
export function streamThumbnail(uid: string, height = 720): string {
  return `https://${STREAM_SUBDOMAIN}/${uid}/thumbnails/thumbnail.jpg?time=1s&height=${height}`;
}

/** Lecteur vidéo produit — poster cliquable, iframe Stream chargée AU CLIC
 *  seulement : jamais d'autoplay (data acheteur et facture maîtrisées).
 *  Parité avec l'app Flutter (ProductVideoPlayer, plan A). */
export function ProductVideoPlayer({
  uid,
  thumbnail,
  title,
}: {
  uid: string;
  thumbnail?: string | null;
  title: string;
}) {
  const [playing, setPlaying] = useState(false);
  const poster = thumbnail || streamThumbnail(uid);

  if (playing) {
    return (
      <div className="absolute inset-0 bg-black">
        <iframe
          src={`https://${STREAM_SUBDOMAIN}/${uid}/iframe?autoplay=true&preload=metadata&poster=${encodeURIComponent(poster)}`}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={`Vidéo — ${title}`}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="absolute inset-0 block h-full w-full bg-black"
      aria-label="Lire la vidéo du produit"
    >
      {/* Miniature distante Cloudflare : next/image exigerait de déclarer le
          domaine dans next.config — une balise img suffit ici. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={poster} alt="" className="h-full w-full object-cover" />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/55 transition-transform hover:scale-105">
          <Play className="ml-1 h-8 w-8 fill-white text-white" />
        </span>
      </span>
    </button>
  );
}
