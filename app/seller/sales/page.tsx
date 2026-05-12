import { RequireAuth } from "@/features/auth/require-auth";
import { SellerSalesView } from "@/features/seller/seller-sales-view";

export default function SellerSalesPage() {
  return (
    <RequireAuth>
      <SellerSalesView />
    </RequireAuth>
  );
}
