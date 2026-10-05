import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth/require-auth";
import { AccountShell } from "@/features/account/account-shell";
import { ProfileInfoForm } from "@/features/profile/profile-info-form";
import { VoiceNoteRecorder } from "@/features/store/voice-note-recorder";

export const metadata: Metadata = {
  title: "Mes Informations Personnelles — Rivendy",
  description: "Gérez vos informations personnelles, votre numéro de téléphone et vos coordonnées sur Rivendy.",
};

export default function ProfileInfoPage() {
  return (
    <RequireAuth>
      <AccountShell>
        <div className="space-y-6">
          <ProfileInfoForm />
          {/* Présentation vocale de la boutique — comme l'app (parité 2026-10-04) */}
          <VoiceNoteRecorder />
        </div>
      </AccountShell>
    </RequireAuth>
  );
}
