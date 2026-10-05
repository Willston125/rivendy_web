import { Suspense } from "react";
import type { Metadata } from "next";
import { BookingDetailView } from "@/features/hotels/booking-detail-view";
import { BlockSkeleton } from "@/features/hotels/hotel-ui";

export const metadata: Metadata = {
  title: "Détail de la réservation — Rivendy",
  robots: { index: false, follow: false },
};

export default async function HotelBookingDetailPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-4 py-8"><BlockSkeleton lines={6} /></div>}>
      <BookingDetailView bookingId={bookingId} />
    </Suspense>
  );
}
