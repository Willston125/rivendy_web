import { Suspense } from "react";
import type { Metadata } from "next";
import { BookingConfirmationView } from "@/features/hotels/booking-confirmation-view";
import { BlockSkeleton } from "@/features/hotels/hotel-ui";

export const metadata: Metadata = {
  title: "Réservation confirmée — Rivendy",
  robots: { index: false, follow: false },
};

export default function HotelBookingConfirmationPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl px-4 py-8"><BlockSkeleton lines={6} /></div>}>
      <BookingConfirmationView />
    </Suspense>
  );
}
