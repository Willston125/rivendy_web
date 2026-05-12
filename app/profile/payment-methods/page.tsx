import { RequireAuth } from "@/features/auth/require-auth";
import { PaymentMethodsView } from "@/features/profile/payment-methods-view";

export default function PaymentMethodsPage() {
  return (
    <RequireAuth>
      <PaymentMethodsView />
    </RequireAuth>
  );
}
