import { Suspense } from "react";
import type { Metadata } from "next";
import { HotelResultsView } from "@/features/hotels/hotel-results-view";
import { CardSkeletons } from "@/features/hotels/hotel-ui";

export const metadata: Metadata = {
  title: "Hôtels disponibles — Rivendy",
  description: "Hôtels disponibles pour vos dates, filtrés par budget, classement et équipements.",
  robots: { index: false, follow: true },
};

export default function HotelResultsPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-8"><CardSkeletons count={6} /></div>}>
      <HotelResultsView />
    </Suspense>
  );
}
