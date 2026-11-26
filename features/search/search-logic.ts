/**
 * Filtre de recherche texte pour `.or()` de PostgREST (audit 20, WEB-17 ;
 * audit 22, MKWEB-3).
 *
 * Les mots sont cherchés dans l'ordre, sans tenir compte de la ponctuation ni
 * des espaces qui les séparent : « robe. » donne `%robe%`, « (mkoumi) »
 * `%mkoumi%`, « iPhone 13 (128 Go) » `%iPhone%13%128%Go%`, « t.shirt »
 * `%t%shirt%`. Avant, le texte était cherché tel quel, ponctuation comprise :
 * « (mkoumi) » ne trouvait pas « Robe Mkoumi ».
 *
 * `%` et `_` ne servent jamais de jokers à l'utilisateur. La valeur reste
 * entre guillemets (`( ) , .` y sont permis, `\` et `"` s'échappent).
 * null : rien à chercher.
 */
export function ilikeOrFilter(columns: string[], raw: string): string | null {
  const pattern = searchPattern(raw);
  if (!pattern) return null;
  const quoted = pattern.replace(/[\\"]/g, "\\$&");
  return columns.map((column) => `${column}.ilike."${quoted}"`).join(",");
}

/** Mots gardés au plus : au-delà, ils sont ignorés (motif borné). */
const MAX_WORDS = 10;

/**
 * Motif ILIKE d'une recherche : `%mot1%mot2%…%`. Un mot = lettres (accents et
 * signes diacritiques compris) et chiffres. Une recherche faite seulement de
 * ponctuation (« ... ») reste cherchée telle quelle, comme avant.
 */
export function searchPattern(raw: string): string | null {
  const text = (raw ?? "").normalize("NFC").replace(/[%_]/g, " ").trim();
  if (!text) return null;
  const words = text.split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean).slice(0, MAX_WORDS);
  return words.length ? `%${words.join("%")}%` : `%${text}%`;
}
