/**
 * 🛡️ ContentFilter — filtre de modération des contenus utilisateurs
 *
 * Vérifie qu'un texte ne contient pas de mots interdits avant publication.
 * Double sécurité : vérification côté client (UX immédiate) + RLS Supabase.
 */

// Insultes & vulgarités françaises
const FR = [
  "merde", "putain", "connard", "connasse", "salope", "pute", "enculé",
  "encule", "fils de pute", "fdp", "ta gueule", "va te faire", "niquer",
  "nique", "baise", "baiser", "bite", "couille", "couilles", "cul",
  "imbécile", "imbecile", "crétin", "cretin", "abruti", "idiot", "con ",
  "conne", "batard", "bâtard", "bordel", "salopard", "fumier", "ordure",
  "dechet", "déchets", "chier", "chiasse", "branler", "branleur",
  "pédale", "pedale", "tapette", "pd", "negro", "nègre", "negre",
  "bounty", "singe", "bamboula", "bicot", "bougnoule", "raton",
];

// Insultes arabes translittérées
const AR = [
  "kess", "kss", "zebbi", "zeb", "sharmouta", "sharmuta", "kahba",
  "ibn el sharmouta", "hayawan", "kalb", "klab", "hmar", "khanzir",
  "ahbal", "niik", "ayir", "ayre", "yil3an", "tal3an",
];

// Insultes somali translittérées (contexte Djibouti)
const SO = [
  "faham", "gaajo", "gabadh xun", "naag xun", "dhilo", "wasakh",
  "libaax", "dameer",
];

// Spam & contournement (numéros, liens externes)
const SPAM = [
  "whatsapp.com", "wa.me", "t.me", "telegram",
  "instagram.com", "facebook.com", "tiktok.com",
  "bit.ly", "tinyurl", "shorturl",
  "achetez sur", "acheter sur", "contactez moi sur", "contactez-moi sur",
  "livraison gratuite ailleurs", "moins cher sur",
];

// Liste complète normalisée
const ALL_WORDS = [...FR, ...AR, ...SO, ...SPAM].map((w) =>
  w.toLowerCase().trim()
);

export class ContentFilter {
  /**
   * Retourne true si le texte est propre (aucun mot interdit détecté).
   */
  static isClean(text: string): boolean {
    return this.firstViolation(text) === null;
  }

  /**
   * Retourne le premier mot interdit trouvé, ou null si le texte est propre.
   */
  static firstViolation(text: string): string | null {
    const normalized = this.normalize(text);
    for (const word of ALL_WORDS) {
      if (normalized.includes(word)) {
        return word;
      }
    }
    return null;
  }

  /**
   * Message d'erreur standard.
   */
  static get errorMessage(): string {
    return "Votre message contient un mot ou lien non autorisé. Veuillez le modifier avant de publier.";
  }

  /**
   * Normalise : minuscule + suppression des accents + suppression des
   * caractères spéciaux entre les lettres.
   */
  private static normalize(text: string): string {
    return text
      .toLowerCase()
      .replace(/[àáâãäå]/g, "a")
      .replace(/[èéêë]/g, "e")
      .replace(/[ìíîï]/g, "i")
      .replace(/[òóôõö]/g, "o")
      .replace(/[ùúûü]/g, "u")
      .replace(/[ç]/g, "c")
      .replace(/[ñ]/g, "n")
      .replace(/[0-9]/g, "") // Retire les chiffres (c0nnard → cnnard)
      .replace(/[^a-z\s]/g, " "); // Garde lettres et espaces
  }
}
