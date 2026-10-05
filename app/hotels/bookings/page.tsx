import { Suspense } from "react";
import type { Metadata } from "next";
import { MyBookingsView } from "@/features/hotels/my-bookings-view";
import { CardSkeletons } from "@/features/hotels/hotel-ui";

export const metadata: Metadata = {
  title: "Mes réservations d'hôtel — Rivendy",
  description: "Vos séjours à venir, terminés et annulés.",
  robots: { index: false, follow: false },
};

export default function MyHotelBookingsPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl px-4 py-8"><CardSkeletons count={2} /></div>}>
      <MyBookingsView />
    </Suspense>
  );
}
