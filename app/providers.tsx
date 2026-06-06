"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/features/auth/auth-provider";
import { CartProvider } from "@/features/cart/cart-provider";
import { CountryProvider } from "@/features/country/country-provider";
import { MarketSelectorModal } from "@/features/country/market-selector-modal";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CountryProvider>
        {/* Modal obligatoire si aucun marché résolu — parity Flutter MarketSwitcher */}
        <MarketSelectorModal />
        <CartProvider>{children}</CartProvider>
      </CountryProvider>
    </AuthProvider>
  );
}
