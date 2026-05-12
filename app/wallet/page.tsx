import { RequireAuth } from "@/features/auth/require-auth";
import { WalletView } from "@/features/wallet/wallet-view";

export default function WalletPage() {
  return (
    <RequireAuth>
      <WalletView />
    </RequireAuth>
  );
}
