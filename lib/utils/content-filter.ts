/**
 * 🛡️ ContentFilter — filtre de modération des contenus utilisateurs
 *
 * Vérifie qu'un texte ne contient pas de mots interdits avant publication.
 * Double sécurité : vérification côté client (UX immédiate) + serveur (la
 * règle `play_text_has_contact` refuse aussi numéros et liens, message
 * `contact_forbidden` — audit n° 19, LM19-1).
 *
 * Audit n° 19 (LM19-1, WEB-14) : les numéros et les liens sont cherchés AVANT
 * toute normalisation (avant, « wa.me » devenait « wa me » et passait), et les
 * mots sont comparés ENTIERS (avant, « J'habite », « unique », « véhicule »,
 * « connexion » étaient refusés). Mêmes règles que l'app
 * (`lib/core/utils/content_filter.dart`).
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

// Spam & contournement (les liens et numéros : hasContact)
const SPAM = [
  "whatsapp.com", "wa.me", "t.me", "telegram",
  "instagram.com", "facebook.com", "tiktok.com",
  "bit.ly", "tinyurl", "shorturl",
  "achetez sur", "acheter sur", "contactez moi sur", "contactez-moi sur",
  "livraison gratuite ailleurs", "moins cher sur",
];

/** Minuscules, sans accents, chiffres « déguisés » remis en lettres, le reste en espaces simples. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[àáâãäå]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/[ç]/g, "c")
    .replace(/[ñ]/g, "n")
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/@/g, "a")
    .replace(/[^a-z]+/g, " ")
    .trim();
}

// Liste complète, normalisée comme le texte comparé
const ALL_WORDS = [...new Set([...FR, ...AR, ...SO, ...SPAM].map(normalize))].filter(Boolean);

export class ContentFilter {
  /** Marqueur renvoyé par firstViolation pour un numéro ou un lien. */
  static readonly contact = "contact";

  /** Message pour un numéro ou un lien (règle Contact : tout passe par Rivendy). */
  static readonly contactMessage =
    "Pas de numéro, de WhatsApp ni de lien : tout contact passe par Rivendy.";

  /** Retourne true si le texte est propre (aucun mot interdit, aucun contact). */
  static isClean(text: string): boolean {
    return this.firstViolation(text) === null;
  }

  /**
   * Le premier problème trouvé : `contact` pour un numéro ou un lien, sinon le
   * mot interdit ; null si le texte est propre.
   */
  static firstViolation(text: string): string | null {
    if (this.hasContact(text)) return this.contact;
    const padded = ` ${normalize(text)} `;
    const tokens = new Set(padded.trim().split(" "));
    for (const word of ALL_WORDS) {
      if (word.includes(" ")) {
        if (padded.includes(` ${word} `)) return word;
      } else if (tokens.has(word) || tokens.has(`${word}s`) || tokens.has(`${word}e`) || tokens.has(`${word}es`)) {
        return word;
      }
    }
    return null;
  }

  /**
   * Numéro de téléphone (7 chiffres ou plus, espaces et ponctuation compris),
   * WhatsApp, Telegram, adresse web ou nom de domaine — la règle du serveur
   * (`play_text_has_contact`), sur le texte BRUT.
   */
  static hasContact(text: string): boolean {
    const compact = text.replace(/[\s.()/-]/g, "");
    if (/[0-9]{7,}/.test(compact)) return true;
    if (/(whats\s*app|watsap|https?:\/\/|www\.|telegram)/i.test(text)) return true;
    return /[a-z0-9-]+\.(com|me|net|org|fr|km|dj|ly)([^a-z]|$)/i.test(text);
  }

  /** Message d'erreur standard (mot interdit). */
  static get errorMessage(): string {
    return "Votre message contient un mot non autorisé. Veuillez le modifier avant de publier.";
  }

  /** Le bon message pour un texte refusé. */
  static messageFor(text: string): string {
    return this.hasContact(text) ? this.contactMessage : this.errorMessage;
  }

  /** Refus « contact » renvoyé par le serveur (trigger ou fonction SQL). */
  static isServerContactRefusal(error: unknown): boolean {
    const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
    return message.includes("contact_forbidden");
  }
}
