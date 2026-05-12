import { RequireAuth } from "@/features/auth/require-auth";
import { ChangePasswordForm } from "@/features/profile/change-password-form";

export default function ChangePasswordPage() {
  return (
    <RequireAuth>
      <ChangePasswordForm />
    </RequireAuth>
  );
}
