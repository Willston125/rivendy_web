import { RequireAuth } from "@/features/auth/require-auth";
import { ProfileInfoForm } from "@/features/profile/profile-info-form";

export default function ProfileInfoPage() {
  return (
    <RequireAuth>
      <ProfileInfoForm />
    </RequireAuth>
  );
}
