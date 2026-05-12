import { RequireAuth } from "@/features/auth/require-auth";
import { SubscriptionView } from "@/features/seller/subscription-view";

export default function SubscriptionPage() {
  return (
    <RequireAuth>
      <SubscriptionView />
    </RequireAuth>
  );
}
