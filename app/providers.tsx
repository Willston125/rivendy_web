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
              {/* Favoris, playlists et partage du compte, communs aux pages
                  Musique et au lecteur (refonte du 2026-10-22). */}
              <MusicLibraryProvider>
                {children}
                <MiniPlayer />
              </MusicLibraryProvider>
            </MusicPlayerProvider>
          </CartProvider>
        </FavoritesProvider>
      </CountryProvider>
      </NotificationsProvider>
    </AuthProvider>
    </DialogsProvider>
  );
}
