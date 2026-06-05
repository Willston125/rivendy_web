import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth/require-auth";
import { CreateStoreForm } from "@/features/seller/create-store-form";

export const metadata: Metadata = {
  title: "Créer ma Boutique — Rivendy",
  description: "Commencez à vendre vos articles sur Rivendy. Ouvrez votre boutique en ligne gratuitement.",
};

export default function CreateStorePage() {
  return (
    <RequireAuth>
      <CreateStoreForm />
    </RequireAuth>
  );
}
