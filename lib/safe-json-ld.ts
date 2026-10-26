/**
 * Sérialise un objet pour un <script type="application/ld+json"> injecté via
 * dangerouslySetInnerHTML, sans ouvrir de faille XSS.
 *
 * Échappe « < » en sa séquence JSON (point de code 0x3c) : séquence valide (le
 * parseur JSON y relit « < »), mais l'analyseur HTML ne rencontre jamais de
 * « < » littéral — donc aucun </script> saisi dans un titre ou une description
 * (clip, film, série, épisode, fiche produit) ne peut fermer la balise et
 * injecter du script. Échappe aussi U+2028 / U+2029, qui cassent l'analyse d'un
 * script en ligne.
 *
 * ⚠️ Piège (audit 21, WEBMEDIA-1) : en TypeScript/JS, un littéral d'échappement
 * « backslash-u003c » vaut DÉJÀ le caractère « < » — un remplacement par ce
 * littéral ne change donc rien. On construit la séquence à l'EXÉCUTION (esc)
 * pour échapper à ce piège et ne dépendre d'aucun littéral dans la source.
 *
 * Fonction pure, SANS aucun import : importable telle quelle sous `node --test`
 * (check:playweb) pour prouver qu'un </script> saisi ne produit aucune balise.
 */
export function safeJsonLd(data: unknown): string {
  // Construit « backslash u + 4 chiffres hexa » à l'exécution (ex. pour 0x3c →
  // la séquence d'échappement JSON de « < »).
  const esc = (cp: number) => "\\u" + cp.toString(16).padStart(4, "0");
  return JSON.stringify(data)
    .split("<").join(esc(0x3c))
    .split(String.fromCharCode(0x2028)).join(esc(0x2028))
    .split(String.fromCharCode(0x2029)).join(esc(0x2029));
}
