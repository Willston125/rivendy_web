import { Suspense } from "react";
import type { Metadata } from "next";
import { BookingServicesView } from "@/features/hotels/booking-services-view";
import { BlockSkeleton } from "@/features/hotels/hotel-ui";

export const metadata: Metadata = {
  title: "Améliorez votre séjour — Rivendy",
  robots: { index: false, follow: false },
};

export default function HotelBookingServicesPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-8"><BlockSkeleton lines={5} /></div>}>
      <BookingServicesView />
    </Suspense>
  );
}
