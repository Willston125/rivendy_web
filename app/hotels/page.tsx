import { Suspense } from "react";
import type { Metadata } from "next";
import { HotelsHome } from "@/features/hotels/hotels-home";
import { CardSkeletons } from "@/features/hotels/hotel-ui";

export const metadata: Metadata = {
  title: "Hôtels — Réservez votre séjour sur Rivendy",
  description:
    "Trouvez un hôtel, choisissez vos dates et votre chambre, et recevez une réservation confirmée par Rivendy.",
};

export default function HotelsPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-8"><CardSkeletons count={3} /></div>}>
      <HotelsHome />
    </Suspense>
  );
}
