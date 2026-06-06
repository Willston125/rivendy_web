import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth/require-auth";
import { AccountShell } from "@/features/account/account-shell";
import { WalletView } from "@/features/wallet/wallet-view";

export const metadata: Metadata = {
  title: "Mon Portefeuille — Rivendy",
  description: "Gérez vos gains de vente, effectuez des demandes de retrait et suivez vos transactions sur Rivendy.",
};

export default function WalletPage() {
  return (
    <RequireAuth>
      <AccountShell>
        <WalletView />
      </AccountShell>
    </RequireAuth>
  );
}
