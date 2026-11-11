import { supabase } from "@/lib/supabase/client";
import { parseRadioStation, parseRadioStations, type RadioStation } from "./radio-logic";

/**
 * Radios en direct (2026-11-11) : les MÊMES fonctions serveur que
 * l'application. Le serveur décide de ce qui est montré (radios en ligne,
 * avec leur lettre signée) ; le site ne fait que lire.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Radios en ligne du marché. Une panne LÈVE une erreur (« impossible de charger », pas « aucune radio »). */
export async function fetchRadios(market: string | null): Promise<RadioStation[]> {
  const { data, error } = await supabase.rpc("music_radio_list", { p_market: market ?? "" });
  if (error) throw new Error(error.message);
  return parseRadioStations(data);
}

/** La radio d'un aperçu privé (null : lien inconnu ou retiré). */
export async function fetchRadioPreview(token: string): Promise<RadioStation | null> {
  if (!UUID.test(token)) return null;
  const { data, error } = await supabase.rpc("music_radio_preview", { p_token: token });
  if (error) throw new Error(error.message);
  return parseRadioStation(data);
}

/** Compteur d'écoute (comptes connectés ; le serveur plafonne). Au mieux : jamais d'erreur visible. */
export async function reportRadioListen(stationId: string, market: string | null, seconds: number, start: boolean): Promise<void> {
  try {
    await supabase.rpc("music_radio_listen", {
      p_station: stationId, p_market: market ?? "", p_seconds: seconds, p_start: start,
    });
  } catch {
    /* au mieux */
  }
}
