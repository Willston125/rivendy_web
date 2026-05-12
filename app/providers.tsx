"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/features/auth/auth-provider";
import { CartProvider } from "@/features/cart/cart-provider";
import { CountryProvider } from "@/features/country/country-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CountryProvider>
        <CartProvider>{children}</CartProvider>
      </CountryProvider>
    </AuthProvider>
  );
}
