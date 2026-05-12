import { RequireAuth } from "@/features/auth/require-auth";
import { CreateStoreForm } from "@/features/seller/create-store-form";

export default function CreateStorePage() {
  return (
    <RequireAuth>
      <CreateStoreForm />
    </RequireAuth>
  );
}
