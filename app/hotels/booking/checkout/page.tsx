import { Suspense } from "react";
import type { Metadata } from "next";
import { BookingCheckoutView } from "@/features/hotels/booking-checkout-view";
import { BlockSkeleton } from "@/features/hotels/hotel-ui";

export const metadata: Metadata = {
  title: "Votre réservation — Rivendy",
  robots: { index: false, follow: false },
};

export default function HotelBookingCheckoutPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-8"><BlockSkeleton lines={6} /></div>}>
      <BookingCheckoutView />
    </Suspense>
  );
}
