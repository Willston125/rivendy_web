import { notFound, redirect } from "next/navigation";
import { getTrackRelease } from "@/features/music/server/music-server";

type Props = { params: Promise<{ id: string }> };

/** Un titre s'ouvre dans sa sortie, mis en avant. */
export default async function TrackPage({ params }: Props) {
  const { id } = await params;
  const releaseId = await getTrackRelease(id);
  if (!releaseId) notFound();
  redirect(`/music/album/${releaseId}?t=${id}`);
}
