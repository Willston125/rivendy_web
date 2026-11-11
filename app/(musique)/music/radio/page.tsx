import type { Metadata } from "next";
import { RadioPage } from "@/features/music/radio/radio-views";

export const metadata: Metadata = {
  title: "Radio en direct | Rivendy Musique",
  description: "Les radios des Comores et de l’océan Indien en direct, gratuites, avec l’accord de chaque station.",
};

export default function MusicRadioRoute() {
  return <RadioPage />;
}
