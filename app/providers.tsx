"use client";

import { Suspense, type ReactNode } from "react";
import { AuthProvider } from "@/features/auth/auth-provider";
import { CartProvider } from "@/features/cart/cart-provider";
import { CountryProvider } from "@/features/country/country-provider";
import { MarketSelectorModal } from "@/features/country/market-selector-modal";
import { MarketUrlSync } from "@/features/country/market-url-sync";
import { NotificationsProvider } from "@/features/notifications/use-notifications";
import { DialogsProvider } from "@/features/ui/dialogs";

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
        <CartProvider>{children}</CartProvider>
      </CountryProvider>
      </NotificationsProvider>
    </AuthProvider>
    </DialogsProvider>
  );
}
