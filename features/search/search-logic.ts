/**
 * Filtre de recherche texte pour `.or()` de PostgREST (audit 20, WEB-17).
 *
 * Valeur entre guillemets : `( ) , .` y sont permis, alors qu'ils cassaient la
 * requête sans guillemets. Dans les guillemets, seuls `\` et `"` s'échappent.
 * `%` est retiré : il servirait de joker à la recherche. null : rien à chercher.
 */
export function ilikeOrFilter(columns: string[], raw: string): string | null {
  const term = raw.trim().replace(/%/g, "").trim();
  if (!term) return null;
  const quoted = term.replace(/[\\"]/g, "\\$&");
  return columns.map((column) => `${column}.ilike."%${quoted}%"`).join(",");
}
