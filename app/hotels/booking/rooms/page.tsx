import { Suspense } from "react";
import type { Metadata } from "next";
import { BookingRoomsView } from "@/features/hotels/booking-rooms-view";
import { BlockSkeleton } from "@/features/hotels/hotel-ui";

export const metadata: Metadata = {
  title: "Choisissez votre chambre — Rivendy",
  robots: { index: false, follow: false },
};

export default function HotelBookingRoomsPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-8"><BlockSkeleton lines={5} /></div>}>
      <BookingRoomsView />
    </Suspense>
  );
}
