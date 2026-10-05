// ⚠️ FICHIER GÉNÉRÉ — ne pas modifier à la main.
// Source : rivendy_app/lib/features/products/models/construction_subcategory.dart
// Régénérer : node scripts/sync-listings-from-app.mjs (depuis rivendy_web)

import type { ConstructionSubcategory } from "./types";

export const CONSTRUCTION_SUBCATEGORIES: ConstructionSubcategory[] = [
  {
    "key": "ciment_beton",
    "label": "Ciment & béton",
    "emoji": "🧱",
    "fields": [
      {
        "key": "marque",
        "label": "Marque",
        "hint": "Ex: Lafarge, Holcim",
        "inputType": "text"
      },
      {
        "key": "poids_sac",
        "label": "Poids du sac",
        "hint": "Ex: 50 kg",
        "inputType": "text"
      },
      {
        "key": "quantite",
        "label": "Quantité disponible",
        "hint": "Ex: 100 sacs",
        "inputType": "text"
      },
      {
        "key": "livraison",
        "label": "Livraison possible",
        "hint": "Oui / Non / Sur demande",
        "inputType": "text"
      }
    ]
  },
  {
    "key": "fer_acier",
    "label": "Fer & acier",
    "emoji": "🔩",
    "fields": [
      {
        "key": "type_fer",
        "label": "Type de fer",
        "hint": "Ex: Fer à béton, Tôle",
        "inputType": "text"
      },
      {
        "key": "diametre",
        "label": "Diamètre / Dimension",
        "hint": "Ex: 12 mm",
        "inputType": "text"
      },
      {
        "key": "longueur",
        "label": "Longueur",
        "hint": "Ex: 6 m",
        "inputType": "text"
      },
      {
        "key": "unite_vente",
        "label": "Unité de vente",
        "hint": "Barre / Kg / Lot",
        "inputType": "text"
      },
      {
        "key": "quantite",
        "label": "Quantité disponible",
        "hint": "Ex: 50 barres",
        "inputType": "text"
      }
    ]
  },
  {
    "key": "bois",
    "label": "Bois",
    "emoji": "🪵",
    "fields": [
      {
        "key": "essence",
        "label": "Essence / Type",
        "hint": "Ex: Pin, Chêne, Contreplaqué",
        "inputType": "text"
      },
      {
        "key": "dimensions",
        "label": "Dimensions",
        "hint": "Ex: 200×100×4 cm",
        "inputType": "text"
      },
      {
        "key": "quantite",
        "label": "Quantité disponible",
        "hint": "Ex: 20 planches",
        "inputType": "text"
      }
    ]
  },
  {
    "key": "carrelage",
    "label": "Carrelage",
    "emoji": "🟫",
    "fields": [
      {
        "key": "dimensions",
        "label": "Dimensions",
        "hint": "Ex: 60×60 cm",
        "inputType": "text"
      },
      {
        "key": "surface",
        "label": "Surface (m² disponibles)",
        "hint": "Ex: 25 m²",
        "inputType": "text"
      },
      {
        "key": "couleur_style",
        "label": "Couleur / Style",
        "hint": "Ex: Beige marbré",
        "inputType": "text"
      },
      {
        "key": "usage",
        "label": "Usage",
        "hint": "Sol / Mur / Intérieur / Extérieur",
        "inputType": "text"
      }
    ]
  },
  {
    "key": "peinture",
    "label": "Peinture",
    "emoji": "🎨",
    "fields": [
      {
        "key": "marque",
        "label": "Marque",
        "hint": "Ex: Astral, Seigneurie",
        "inputType": "text"
      },
      {
        "key": "volume",
        "label": "Volume / Conditionnement",
        "hint": "Ex: 5 L",
        "inputType": "text"
      },
      {
        "key": "couleur",
        "label": "Couleur",
        "hint": "Ex: Blanc cassé",
        "inputType": "text"
      },
      {
        "key": "usage",
        "label": "Usage",
        "hint": "Intérieur / Extérieur",
        "inputType": "text"
      }
    ]
  },
  {
    "key": "plomberie",
    "label": "Plomberie",
    "emoji": "🚰",
    "fields": [
      {
        "key": "type_piece",
        "label": "Type de pièce",
        "hint": "Ex: Tuyau PVC, Robinet, Coude",
        "inputType": "text"
      },
      {
        "key": "diametre",
        "label": "Diamètre",
        "hint": "Ex: 32 mm",
        "inputType": "text"
      },
      {
        "key": "matiere",
        "label": "Matière",
        "hint": "PVC / Cuivre / Inox",
        "inputType": "text"
      },
      {
        "key": "quantite",
        "label": "Quantité disponible",
        "hint": "Ex: 10 unités",
        "inputType": "text"
      }
    ]
  },
  {
    "key": "electricite",
    "label": "Électricité",
    "emoji": "⚡",
    "fields": [
      {
        "key": "type_equipement",
        "label": "Type d'équipement",
        "hint": "Ex: Câble, Disjoncteur, Prise",
        "inputType": "text"
      },
      {
        "key": "puissance",
        "label": "Puissance / Voltage",
        "hint": "Ex: 220 V, 16 A",
        "inputType": "text"
      },
      {
        "key": "marque",
        "label": "Marque",
        "hint": "Ex: Schneider, Legrand",
        "inputType": "text"
      },
      {
        "key": "etat",
        "label": "État",
        "hint": "Neuf / Occasion / Reconditionné",
        "inputType": "text"
      }
    ]
  },
  {
    "key": "outillage",
    "label": "Outillage",
    "emoji": "🛠️",
    "fields": [
      {
        "key": "type_outil",
        "label": "Type d'outil",
        "hint": "Ex: Perceuse, Marteau, Scie",
        "inputType": "text"
      },
      {
        "key": "marque",
        "label": "Marque",
        "hint": "Ex: Bosch, Makita",
        "inputType": "text"
      },
      {
        "key": "etat",
        "label": "État",
        "hint": "Neuf / Bon / Occasion",
        "inputType": "text"
      }
    ]
  },
  {
    "key": "sanitaire",
    "label": "Sanitaire",
    "emoji": "🚿",
    "fields": [
      {
        "key": "type",
        "label": "Type",
        "hint": "Ex: Lavabo, WC, Douche, Baignoire",
        "inputType": "text"
      },
      {
        "key": "marque",
        "label": "Marque",
        "hint": "Ex: Roca, Jacob Delafon",
        "inputType": "text"
      },
      {
        "key": "etat",
        "label": "État",
        "hint": "Neuf / Occasion",
        "inputType": "text"
      }
    ]
  },
  {
    "key": "portes_fenetres",
    "label": "Portes & fenêtres",
    "emoji": "🚪",
    "fields": [
      {
        "key": "matiere",
        "label": "Matière",
        "hint": "Bois / Aluminium / PVC / Métal",
        "inputType": "text"
      },
      {
        "key": "dimensions",
        "label": "Dimensions",
        "hint": "Ex: 90×210 cm",
        "inputType": "text"
      },
      {
        "key": "quantite",
        "label": "Quantité disponible",
        "hint": "Ex: 4 unités",
        "inputType": "text"
      }
    ]
  },
  {
    "key": "toiture",
    "label": "Toiture",
    "emoji": "🏠",
    "fields": [
      {
        "key": "type",
        "label": "Type",
        "hint": "Ex: Tôle ondulée, Tuiles, Bac acier",
        "inputType": "text"
      },
      {
        "key": "dimensions",
        "label": "Dimensions",
        "hint": "Ex: 2×1 m",
        "inputType": "text"
      },
      {
        "key": "quantite",
        "label": "Quantité disponible",
        "hint": "Ex: 30 tôles",
        "inputType": "text"
      }
    ]
  },
  {
    "key": "sable_gravier",
    "label": "Sable & gravier",
    "emoji": "🏖️",
    "fields": [
      {
        "key": "type",
        "label": "Type",
        "hint": "Ex: Sable fin, Gravier 6/10",
        "inputType": "text"
      },
      {
        "key": "unite_vente",
        "label": "Unité de vente",
        "hint": "Sac / m³ / Camion",
        "inputType": "text"
      },
      {
        "key": "quantite",
        "label": "Quantité disponible",
        "hint": "Ex: 5 m³",
        "inputType": "text"
      },
      {
        "key": "livraison",
        "label": "Livraison possible",
        "hint": "Oui / Non / Sur demande",
        "inputType": "text"
      }
    ]
  },
  {
    "key": "divers",
    "label": "Matériaux divers",
    "emoji": "📦",
    "fields": []
  }
];
