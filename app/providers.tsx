"use client";

import { Suspense, type ReactNode } from "react";
import { AuthProvider } from "@/features/auth/auth-provider";
import { CartProvider } from "@/features/cart/cart-provider";
import { CountryProvider } from "@/features/country/country-provider";
import { MarketSelectorModal } from "@/features/country/market-selector-modal";
import { MarketUrlSync } from "@/features/country/market-url-sync";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CountryProvider>
        {/* Modal obligatoire si aucun marché résolu — parity Flutter MarketSwitcher */}
        <MarketSelectorModal />
        {/* Réécrit l'URL avec le marché résolu (sinon l'accueil retombe sur DJ) */}
        <Suspense fallback={null}>
          <MarketUrlSync />
        </Suspense>
        <CartProvider>{children}</CartProvider>
      </CountryProvider>
    </AuthProvider>
  );
}
