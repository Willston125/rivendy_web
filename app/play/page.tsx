import type { Metadata } from "next";
import { PlayHomeView } from "@/features/play/play-views";

export const metadata: Metadata = {
  title: "Rivendy Play — Films, séries et clips",
  description: "Films, séries et clips d’artistes des Comores et d’ailleurs. Le même catalogue que dans l’application Rivendy, avec le même compte.",
  alternates: { canonical: "/play" },
};

export default function PlayHomePage() {
  return <PlayHomeView />;
}
