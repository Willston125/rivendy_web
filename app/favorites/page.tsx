import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth/require-auth";
import { FavoritesView } from "@/features/profile/favorites-view";

export const metadata: Metadata = {
  title: "Mes favoris — Rivendy",
  description: "Retrouvez tous les articles que vous avez sauvegardés sur Rivendy.",
};

export default function FavoritesPage() {
  return (
    <RequireAuth>
      <FavoritesView />
    </RequireAuth>
  );
}
