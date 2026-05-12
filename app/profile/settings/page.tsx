import { RequireAuth } from "@/features/auth/require-auth";
import { SettingsView } from "@/features/profile/settings-view";

export default function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsView />
    </RequireAuth>
  );
}
