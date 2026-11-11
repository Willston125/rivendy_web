"use client";

import { Suspense, type ReactNode } from "react";
import { AuthProvider } from "@/features/auth/auth-provider";
import { CartProvider } from "@/features/cart/cart-provider";
import { CountryProvider } from "@/features/country/country-provider";
import { MarketSelectorModal } from "@/features/country/market-selector-modal";
import { MarketUrlSync } from "@/features/country/market-url-sync";
import { NotificationsProvider } from "@/features/notifications/use-notifications";
import { FavoritesProvider } from "@/features/products/favorites-provider";
import { DialogsProvider } from "@/features/ui/dialogs";
import { MusicPlayerProvider } from "@/features/music/player/music-player-provider";
import { MiniPlayer } from "@/features/music/player/mini-player";
import { MusicLibraryProvider } from "@/features/music/music-library";
import { RadioDock, RadioPlayerProvider } from "@/features/music/radio/radio-player";
import { PlayDockProvider } from "@/features/play/player/play-dock";
import { VideoUploadBanner } from "@/features/play/create/video-upload-banner";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <DialogsProvider>
    <AuthProvider>
      <NotificationsProvider>
      <CountryProvider>
        {/* Modal obligatoire si aucun marché résolu — parity Flutter MarketSwitcher */}
        <MarketSelectorModal />
        {/* Réécrit l'URL avec le marché résolu (sinon l'accueil retombe sur DJ) */}
        <Suspense fallback={null}>
          <MarketUrlSync />
        </Suspense>
        <FavoritesProvider>
          <CartProvider>
            {/* Rivendy Music (Omnicanal lot D) : un seul lecteur pour tout le site,
                monté ici pour que la navigation interne ne coupe pas le son. */}
            <MusicPlayerProvider>
              {/* Radios en direct (2026-11-11) : leur propre lecteur, monté ici
                  aussi ; il se coupe avec la musique et la vidéo (MEDIA_PLAY_EVENT). */}
              <RadioPlayerProvider>
              {/* Favoris, playlists et partage du compte, communs aux pages
                  Musique et au lecteur (refonte du 2026-10-22). */}
              <MusicLibraryProvider>
                {/* Rivendy Play (2026-10-31) : la lecture vidéo en cours, montée ici
                    elle aussi — elle continue dans le mini-lecteur hors de sa page. */}
                <PlayDockProvider>
                  {children}
                  <MiniPlayer />
                  <RadioDock />
                  {/* Envoi d'un clip ou d'un Short (2026-11-11) : suivi sur tout le site. */}
                  <VideoUploadBanner />
                </PlayDockProvider>
              </MusicLibraryProvider>
              </RadioPlayerProvider>
            </MusicPlayerProvider>
          </CartProvider>
        </FavoritesProvider>
      </CountryProvider>
      </NotificationsProvider>
    </AuthProvider>
    </DialogsProvider>
  );
}
