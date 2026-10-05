// ⚠️ FICHIER GÉNÉRÉ — ne pas modifier à la main.
// Source : rivendy_app/lib/features/products/models/phase_b_listings.dart
// Régénérer : node scripts/sync-listings-from-app.mjs (depuis rivendy_web)

import type { PhaseBCategory } from "./types";

export const PHASE_B_CATEGORIES: PhaseBCategory[] = [
  {
    "categoryKey": "location",
    "label": "Location",
    "emoji": "🚗",
    "listings": [
      {
        "typeKey": "location_voiture",
        "label": "Location de voiture",
        "emoji": "🚗",
        "listingType": "vehicle",
        "businessType": "agence",
        "fields": [
          {
            "key": "marque",
            "label": "Marque",
            "hint": "Ex: Toyota, Hyundai",
            "inputType": "text",
            "options": []
          },
          {
            "key": "modele",
            "label": "Modèle",
            "hint": "Ex: Corolla, Tucson",
            "inputType": "text",
            "options": []
          },
          {
            "key": "annee",
            "label": "Année",
            "hint": "Ex: 2021",
            "inputType": "number",
            "options": []
          },
          {
            "key": "transmission",
            "label": "Transmission",
            "hint": "Automatique / Manuelle",
            "inputType": "dropdown",
            "options": [
              "Automatique",
              "Manuelle"
            ]
          },
          {
            "key": "carburant",
            "label": "Carburant",
            "hint": "Essence / Diesel / Hybride",
            "inputType": "dropdown",
            "options": [
              "Essence",
              "Diesel",
              "Hybride",
              "Électrique"
            ]
          },
          {
            "key": "places",
            "label": "Nombre de places",
            "hint": "Ex: 5",
            "inputType": "number",
            "options": []
          },
          {
            "key": "prix_jour",
            "label": "Prix / jour",
            "hint": "Ex: 150 000",
            "inputType": "number",
            "options": []
          },
          {
            "key": "chauffeur_inclus",
            "label": "Chauffeur inclus",
            "hint": "Oui / Non / En option",
            "inputType": "dropdown",
            "options": [
              "Non",
              "Oui",
              "En option"
            ]
          },
          {
            "key": "zone_couverture",
            "label": "Zone de couverture",
            "hint": "Ex: votre quartier / ville",
            "inputType": "text",
            "options": []
          }
        ]
      },
      {
        "typeKey": "vente_voiture",
        "label": "Vente de voiture",
        "emoji": "🏎️",
        "listingType": "vehicle",
        "businessType": "boutique",
        "fields": [
          {
            "key": "marque",
            "label": "Marque",
            "hint": "Ex: Toyota, Peugeot, Mercedes",
            "inputType": "text",
            "options": []
          },
          {
            "key": "modele",
            "label": "Modèle",
            "hint": "Ex: Land Cruiser, 308",
            "inputType": "text",
            "options": []
          },
          {
            "key": "annee",
            "label": "Année",
            "hint": "Ex: 2019",
            "inputType": "number",
            "options": []
          },
          {
            "key": "kilometrage",
            "label": "Kilométrage",
            "hint": "Ex: 85 000 km",
            "inputType": "number",
            "options": []
          },
          {
            "key": "transmission",
            "label": "Transmission",
            "hint": "Automatique / Manuelle",
            "inputType": "dropdown",
            "options": [
              "Automatique",
              "Manuelle"
            ]
          },
          {
            "key": "carburant",
            "label": "Carburant",
            "hint": "Essence / Diesel / Hybride",
            "inputType": "dropdown",
            "options": [
              "Essence",
              "Diesel",
              "Hybride",
              "Électrique"
            ]
          },
          {
            "key": "couleur",
            "label": "Couleur",
            "hint": "Ex: Blanc, Noir, Gris",
            "inputType": "text",
            "options": []
          },
          {
            "key": "etat",
            "label": "État général",
            "hint": "Excellent / Bon / Moyen",
            "inputType": "dropdown",
            "options": [
              "Excellent",
              "Bon",
              "Moyen"
            ]
          },
          {
            "key": "dedouane",
            "label": "Véhicule dédouané localement",
            "hint": "Oui / Non",
            "inputType": "dropdown",
            "options": [
              "Oui",
              "Non"
            ]
          }
        ]
      },
      {
        "typeKey": "location_moto",
        "label": "Location de moto",
        "emoji": "🏍️",
        "listingType": "vehicle",
        "businessType": "agence",
        "fields": [
          {
            "key": "marque",
            "label": "Marque",
            "hint": "Ex: Honda, Yamaha, Bajaj",
            "inputType": "text",
            "options": []
          },
          {
            "key": "modele",
            "label": "Modèle",
            "hint": "Ex: CB125, FZ150",
            "inputType": "text",
            "options": []
          },
          {
            "key": "annee",
            "label": "Année",
            "hint": "Ex: 2022",
            "inputType": "number",
            "options": []
          },
          {
            "key": "cylindree",
            "label": "Cylindrée",
            "hint": "Ex: 125 cc",
            "inputType": "number",
            "options": []
          },
          {
            "key": "prix_jour",
            "label": "Prix / jour",
            "hint": "Ex: 50 000",
            "inputType": "number",
            "options": []
          },
          {
            "key": "casque_inclus",
            "label": "Casque inclus",
            "hint": "Oui / Non",
            "inputType": "dropdown",
            "options": [
              "Oui",
              "Non"
            ]
          },
          {
            "key": "zone_couverture",
            "label": "Zone de couverture",
            "hint": "Ex: votre quartier / ville",
            "inputType": "text",
            "options": []
          }
        ]
      },
      {
        "typeKey": "location_appartement",
        "label": "Appartement",
        "emoji": "🏢",
        "listingType": "rental",
        "businessType": "agence",
        "fields": [
          {
            "key": "chambres",
            "label": "Nombre de chambres",
            "hint": "Ex: 2",
            "inputType": "number",
            "options": []
          },
          {
            "key": "salons",
            "label": "Nombre de salons",
            "hint": "Ex: 1",
            "inputType": "number",
            "options": []
          },
          {
            "key": "surface",
            "label": "Surface (m²)",
            "hint": "Ex: 80 m²",
            "inputType": "text",
            "options": []
          },
          {
            "key": "meuble",
            "label": "Meublé",
            "hint": "Oui / Non",
            "inputType": "dropdown",
            "options": [
              "Oui",
              "Non"
            ]
          },
          {
            "key": "prix_mois",
            "label": "Prix / mois",
            "hint": "Ex: 35 000",
            "inputType": "number",
            "options": []
          },
          {
            "key": "localisation",
            "label": "Localisation / Quartier",
            "hint": "Ex: Djibouti Centre",
            "inputType": "text",
            "options": []
          },
          {
            "key": "equipements",
            "label": "Équipements",
            "hint": "Ex: Wi-Fi, Parking, Climatisation, Sécurité",
            "inputType": "text",
            "options": []
          },
          {
            "key": "caution",
            "label": "Caution",
            "hint": "Ex: 70 000",
            "inputType": "number",
            "options": []
          },
          {
            "key": "duree_min",
            "label": "Durée minimale",
            "hint": "Ex: 6 mois",
            "inputType": "text",
            "options": []
          },
          {
            "key": "disponibilite",
            "label": "Disponibilité",
            "hint": "Immédiate / Sur date",
            "inputType": "dropdown",
            "options": [
              "Immédiate",
              "Sur date"
            ]
          }
        ]
      },
      {
        "typeKey": "location_studio",
        "label": "Studio",
        "emoji": "🛏️",
        "listingType": "rental",
        "businessType": "agence",
        "fields": [
          {
            "key": "surface",
            "label": "Surface (m²)",
            "hint": "Ex: 30 m²",
            "inputType": "text",
            "options": []
          },
          {
            "key": "meuble",
            "label": "Meublé",
            "hint": "Oui / Non",
            "inputType": "dropdown",
            "options": [
              "Oui",
              "Non"
            ]
          },
          {
            "key": "prix_mois",
            "label": "Prix / mois",
            "hint": "Ex: 22 000",
            "inputType": "number",
            "options": []
          },
          {
            "key": "localisation",
            "label": "Localisation / Quartier",
            "hint": "Ex: Héron",
            "inputType": "text",
            "options": []
          },
          {
            "key": "equipements",
            "label": "Équipements",
            "hint": "Ex: Wi-Fi, Cuisine équipée",
            "inputType": "text",
            "options": []
          },
          {
            "key": "caution",
            "label": "Caution",
            "hint": "Ex: 44 000",
            "inputType": "number",
            "options": []
          },
          {
            "key": "duree_min",
            "label": "Durée minimale",
            "hint": "Ex: 3 mois",
            "inputType": "text",
            "options": []
          },
          {
            "key": "disponibilite",
            "label": "Disponibilité",
            "hint": "Immédiate / Sur date",
            "inputType": "dropdown",
            "options": [
              "Immédiate",
              "Sur date"
            ]
          }
        ]
      },
      {
        "typeKey": "location_bureau",
        "label": "Bureau",
        "emoji": "🏬",
        "listingType": "rental",
        "businessType": "agence",
        "fields": [
          {
            "key": "surface",
            "label": "Surface (m²)",
            "hint": "Ex: 45 m²",
            "inputType": "text",
            "options": []
          },
          {
            "key": "capacite",
            "label": "Capacité (postes)",
            "hint": "Ex: 8 postes",
            "inputType": "text",
            "options": []
          },
          {
            "key": "prix_mois",
            "label": "Prix / mois",
            "hint": "Ex: 18 000",
            "inputType": "number",
            "options": []
          },
          {
            "key": "localisation",
            "label": "Localisation / Quartier",
            "hint": "Ex: Djibouti Centre",
            "inputType": "text",
            "options": []
          },
          {
            "key": "equipements",
            "label": "Équipements",
            "hint": "Ex: Wi-Fi, Climatisation, Parking",
            "inputType": "text",
            "options": []
          },
          {
            "key": "disponibilite",
            "label": "Disponibilité",
            "hint": "Immédiate / Sur date",
            "inputType": "dropdown",
            "options": [
              "Immédiate",
              "Sur date"
            ]
          }
        ]
      },
      {
        "typeKey": "location_salle",
        "label": "Salle / Espace",
        "emoji": "🎪",
        "listingType": "rental",
        "businessType": "agence",
        "fields": [
          {
            "key": "capacite",
            "label": "Capacité (personnes)",
            "hint": "Ex: 60 personnes",
            "inputType": "text",
            "options": []
          },
          {
            "key": "prix_evenement",
            "label": "Prix / événement",
            "hint": "Ex: 25 000",
            "inputType": "number",
            "options": []
          },
          {
            "key": "localisation",
            "label": "Localisation / Quartier",
            "hint": "Ex: Djibouti Centre",
            "inputType": "text",
            "options": []
          },
          {
            "key": "equipements",
            "label": "Équipements",
            "hint": "Ex: Sonorisation, Climatisation, Traiteur",
            "inputType": "text",
            "options": []
          },
          {
            "key": "disponibilite",
            "label": "Disponibilité",
            "hint": "Immédiate / Sur date",
            "inputType": "dropdown",
            "options": [
              "Immédiate",
              "Sur date"
            ]
          }
        ]
      },
      {
        "typeKey": "location_vacances",
        "label": "Maison de vacances",
        "emoji": "🏖️",
        "listingType": "rental",
        "businessType": "agence",
        "fields": [
          {
            "key": "chambres",
            "label": "Nombre de chambres",
            "hint": "Ex: 3",
            "inputType": "number",
            "options": []
          },
          {
            "key": "capacite",
            "label": "Capacité (personnes)",
            "hint": "Ex: 6 personnes",
            "inputType": "text",
            "options": []
          },
          {
            "key": "prix_nuit",
            "label": "Prix / nuit",
            "hint": "Ex: 40 000",
            "inputType": "number",
            "options": []
          },
          {
            "key": "localisation",
            "label": "Localisation",
            "hint": "Ex: Plage, Tadjourah",
            "inputType": "text",
            "options": []
          },
          {
            "key": "equipements",
            "label": "Équipements",
            "hint": "Ex: Piscine, Wi-Fi, Vue mer",
            "inputType": "text",
            "options": []
          },
          {
            "key": "disponibilite",
            "label": "Disponibilité",
            "hint": "Immédiate / Sur date",
            "inputType": "dropdown",
            "options": [
              "Immédiate",
              "Sur date"
            ]
          }
        ]
      },
      {
        "typeKey": "location_materiel",
        "label": "Matériel",
        "emoji": "🛠️",
        "listingType": "rental",
        "businessType": "agence",
        "fields": [
          {
            "key": "type_materiel",
            "label": "Type de matériel",
            "hint": "Ex: Sono, Groupe électrogène, Tente",
            "inputType": "text",
            "options": []
          },
          {
            "key": "prix_jour",
            "label": "Prix / jour",
            "hint": "Ex: 15 000",
            "inputType": "number",
            "options": []
          },
          {
            "key": "caution",
            "label": "Caution",
            "hint": "Ex: 30 000",
            "inputType": "number",
            "options": []
          },
          {
            "key": "localisation",
            "label": "Zone de couverture",
            "hint": "Ex: votre quartier / ville",
            "inputType": "text",
            "options": []
          },
          {
            "key": "disponibilite",
            "label": "Disponibilité",
            "hint": "Immédiate / Sur date",
            "inputType": "dropdown",
            "options": [
              "Immédiate",
              "Sur date"
            ]
          }
        ]
      },
      {
        "typeKey": "location_evenementiel",
        "label": "Événementiel",
        "emoji": "🎉",
        "listingType": "rental",
        "businessType": "prestataire",
        "fields": [
          {
            "key": "type_prestation",
            "label": "Type de prestation",
            "hint": "Ex: Décoration, Traiteur, Animation",
            "inputType": "text",
            "options": []
          },
          {
            "key": "capacite",
            "label": "Capacité (personnes)",
            "hint": "Ex: 100 personnes",
            "inputType": "text",
            "options": []
          },
          {
            "key": "prix_evenement",
            "label": "Prix / événement",
            "hint": "Ex: 50 000",
            "inputType": "number",
            "options": []
          },
          {
            "key": "localisation",
            "label": "Zone de couverture",
            "hint": "Ex: votre ville",
            "inputType": "text",
            "options": []
          },
          {
            "key": "disponibilite",
            "label": "Disponibilité",
            "hint": "Immédiate / Sur date",
            "inputType": "dropdown",
            "options": [
              "Immédiate",
              "Sur date"
            ]
          }
        ]
      }
    ]
  },
  {
    "categoryKey": "mariage",
    "label": "Mariage",
    "emoji": "💍",
    "listings": [
      {
        "typeKey": "robe_mariage",
        "label": "Robe de mariée",
        "emoji": "👗",
        "listingType": "wedding_offer",
        "businessType": "boutique",
        "fields": [
          {
            "key": "taille",
            "label": "Taille",
            "hint": "Ex: 38, 40, 42",
            "inputType": "text",
            "options": []
          },
          {
            "key": "couleur",
            "label": "Couleur",
            "hint": "Ex: Blanc ivoire",
            "inputType": "text",
            "options": []
          },
          {
            "key": "style",
            "label": "Style",
            "hint": "Princesse / Sirène / Empire…",
            "inputType": "dropdown",
            "options": [
              "Princesse",
              "Sirène",
              "Empire",
              "Bustier",
              "Bohème",
              "Autre"
            ]
          },
          {
            "key": "etat",
            "label": "État",
            "hint": "Neuf / Bon état / Occasion",
            "inputType": "text",
            "options": []
          },
          {
            "key": "location_ou_vente",
            "label": "Location ou vente ?",
            "hint": "Location / Vente",
            "inputType": "dropdown",
            "options": [
              "Location",
              "Vente"
            ]
          }
        ]
      },
      {
        "typeKey": "decoration_mariage",
        "label": "Décoration",
        "emoji": "🌸",
        "listingType": "wedding_offer",
        "businessType": "prestataire",
        "fields": [
          {
            "key": "type_deco",
            "label": "Type de décoration",
            "hint": "Ex: Fleurs, Arche, Nappes",
            "inputType": "text",
            "options": []
          },
          {
            "key": "couleurs",
            "label": "Palette de couleurs",
            "hint": "Ex: Blanc & Or",
            "inputType": "text",
            "options": []
          },
          {
            "key": "forfait",
            "label": "Forfait inclus",
            "hint": "Ex: Installation + démontage",
            "inputType": "text",
            "options": []
          }
        ]
      },
      {
        "typeKey": "traiteur_mariage",
        "label": "Traiteur",
        "emoji": "🍽️",
        "listingType": "wedding_offer",
        "businessType": "restaurant",
        "fields": [
          {
            "key": "type_cuisine",
            "label": "Type de cuisine",
            "hint": "Ex: Djiboutienne, Somalienne, Yéménite, Française",
            "inputType": "text",
            "options": []
          },
          {
            "key": "prix_par_personne",
            "label": "Prix par personne",
            "hint": "Ex: 200 000",
            "inputType": "number",
            "options": []
          },
          {
            "key": "capacite_min",
            "label": "Capacité minimum",
            "hint": "Ex: 50 personnes",
            "inputType": "number",
            "options": []
          },
          {
            "key": "menu_inclus",
            "label": "Menu inclus",
            "hint": "Ex: Entrée + Plat + Dessert + Boissons",
            "inputType": "text",
            "options": []
          },
          {
            "key": "service_inclus",
            "label": "Service inclus",
            "hint": "Ex: Serveurs, vaisselle",
            "inputType": "text",
            "options": []
          }
        ]
      },
      {
        "typeKey": "photographe_mariage",
        "label": "Photographe / Vidéaste",
        "emoji": "📸",
        "listingType": "wedding_offer",
        "businessType": "prestataire",
        "fields": [
          {
            "key": "type_service",
            "label": "Service proposé",
            "hint": "Photo / Vidéo / Photo+Vidéo",
            "inputType": "dropdown",
            "options": [
              "Photo uniquement",
              "Vidéo uniquement",
              "Photo + Vidéo"
            ]
          },
          {
            "key": "duree_couverture",
            "label": "Durée de couverture",
            "hint": "Ex: 8 h, toute la journée",
            "inputType": "text",
            "options": []
          },
          {
            "key": "livraison_album",
            "label": "Délai livraison album",
            "hint": "Ex: 2 semaines",
            "inputType": "text",
            "options": []
          },
          {
            "key": "equipement",
            "label": "Équipement",
            "hint": "Ex: Drone, 2 photographes",
            "inputType": "text",
            "options": []
          }
        ]
      },
      {
        "typeKey": "makeup_mariage",
        "label": "Maquillage & Coiffure",
        "emoji": "💄",
        "listingType": "wedding_offer",
        "businessType": "prestataire",
        "fields": [
          {
            "key": "type_service",
            "label": "Service",
            "hint": "Maquillage / Coiffure / Les deux",
            "inputType": "dropdown",
            "options": [
              "Maquillage",
              "Coiffure",
              "Maquillage + Coiffure"
            ]
          },
          {
            "key": "deplacement",
            "label": "Déplacement à domicile",
            "hint": "Oui / Non",
            "inputType": "dropdown",
            "options": [
              "Oui",
              "Non"
            ]
          },
          {
            "key": "experience",
            "label": "Années d'expérience",
            "hint": "Ex: 5 ans",
            "inputType": "text",
            "options": []
          }
        ]
      },
      {
        "typeKey": "salle_mariage",
        "label": "Salle de réception",
        "emoji": "🏛️",
        "listingType": "wedding_offer",
        "businessType": "agence",
        "fields": [
          {
            "key": "capacite",
            "label": "Capacité (personnes)",
            "hint": "Ex: 300",
            "inputType": "number",
            "options": []
          },
          {
            "key": "equipements",
            "label": "Équipements inclus",
            "hint": "Ex: Clim, Sono, Scène",
            "inputType": "text",
            "options": []
          },
          {
            "key": "prix_journee",
            "label": "Prix / journée",
            "hint": "Ex: 5 000 000",
            "inputType": "number",
            "options": []
          },
          {
            "key": "localisation",
            "label": "Localisation",
            "hint": "Ex: votre quartier / ville",
            "inputType": "text",
            "options": []
          },
          {
            "key": "parking",
            "label": "Parking disponible",
            "hint": "Oui / Non",
            "inputType": "dropdown",
            "options": [
              "Oui",
              "Non"
            ]
          }
        ]
      },
      {
        "typeKey": "voiture_mariage",
        "label": "Voiture de mariage",
        "emoji": "🚘",
        "listingType": "vehicle",
        "businessType": "agence",
        "fields": [
          {
            "key": "marque",
            "label": "Marque & Modèle",
            "hint": "Ex: Mercedes Classe E",
            "inputType": "text",
            "options": []
          },
          {
            "key": "couleur",
            "label": "Couleur",
            "hint": "Ex: Blanc, Noir",
            "inputType": "text",
            "options": []
          },
          {
            "key": "decoration_incluse",
            "label": "Décoration incluse",
            "hint": "Oui / Non / En option",
            "inputType": "dropdown",
            "options": [
              "Oui",
              "Non",
              "En option"
            ]
          },
          {
            "key": "chauffeur_inclus",
            "label": "Chauffeur inclus",
            "hint": "Oui / Non",
            "inputType": "dropdown",
            "options": [
              "Oui",
              "Non"
            ]
          },
          {
            "key": "prix_journee",
            "label": "Prix / journée",
            "hint": "Ex: 500 000",
            "inputType": "number",
            "options": []
          }
        ]
      }
    ]
  },
  {
    "categoryKey": "restaurant",
    "label": "Restaurant",
    "emoji": "🍽️",
    "listings": [
      {
        "typeKey": "plat_restaurant",
        "label": "Plat",
        "emoji": "🍛",
        "listingType": "meal",
        "businessType": "restaurant",
        "fields": [
          {
            "key": "type_cuisine",
            "label": "Type de cuisine",
            "hint": "Ex: Djiboutienne, Somalienne, Yéménite, Indienne, Française",
            "inputType": "text",
            "options": []
          },
          {
            "key": "allergenes",
            "label": "Allergènes",
            "hint": "Ex: Arachides, Gluten, Fruits de mer",
            "inputType": "text",
            "options": []
          },
          {
            "key": "disponibilite",
            "label": "Disponibilité",
            "hint": "Ex: Midi & Soir, Toute la journée",
            "inputType": "dropdown",
            "options": [
              "Midi uniquement",
              "Soir uniquement",
              "Midi & Soir",
              "Toute la journée"
            ]
          },
          {
            "key": "livraison",
            "label": "Livraison disponible",
            "hint": "Oui / Non",
            "inputType": "dropdown",
            "options": [
              "Oui",
              "Non"
            ]
          },
          {
            "key": "niveau_epice",
            "label": "Niveau épicé",
            "hint": "Sélectionnez",
            "inputType": "dropdown",
            "options": [
              "Doux 🌿",
              "Moyen 🌶",
              "Épicé 🌶🌶",
              "Très épicé 🌶🌶🌶"
            ]
          },
          {
            "key": "regime",
            "label": "Régime alimentaire",
            "hint": "Sélectionnez",
            "inputType": "dropdown",
            "options": [
              "Standard",
              "Végétarien",
              "Vegan",
              "Sans gluten",
              "Halal"
            ]
          },
          {
            "key": "temps_preparation",
            "label": "Temps de préparation",
            "hint": "Sélectionnez",
            "inputType": "dropdown",
            "options": [
              "Moins de 15 min",
              "15 à 30 min",
              "30 à 60 min",
              "Plus de 60 min"
            ]
          },
          {
            "key": "type_etablissement",
            "label": "Type d'établissement",
            "hint": "Sélectionnez",
            "inputType": "dropdown",
            "options": [
              "Fast-food",
              "Restaurant",
              "Pâtisserie",
              "Boissons",
              "Grillade",
              "Café"
            ]
          },
          {
            "key": "horaires_ouverture",
            "label": "Horaires d'ouverture",
            "hint": "Ex: 08:00 - 22:00",
            "inputType": "text",
            "options": []
          },
          {
            "key": "zone_livraison",
            "label": "Zone de livraison",
            "hint": "Ex: Centre-ville, Héron, Balbala",
            "inputType": "text",
            "options": []
          }
        ]
      },
      {
        "typeKey": "menu_restaurant",
        "label": "Menu (formule)",
        "emoji": "📋",
        "listingType": "meal",
        "businessType": "restaurant",
        "fields": [
          {
            "key": "contenu_menu",
            "label": "Contenu du menu",
            "hint": "Ex: Entrée + Plat + Boisson",
            "inputType": "text",
            "options": []
          },
          {
            "key": "nb_personnes",
            "label": "Nombre de personnes",
            "hint": "Ex: 1, 2, 4",
            "inputType": "number",
            "options": []
          },
          {
            "key": "disponibilite",
            "label": "Disponibilité",
            "hint": "Ex: Midi & Soir",
            "inputType": "dropdown",
            "options": [
              "Midi uniquement",
              "Soir uniquement",
              "Midi & Soir",
              "Toute la journée"
            ]
          },
          {
            "key": "livraison",
            "label": "Livraison disponible",
            "hint": "Oui / Non",
            "inputType": "dropdown",
            "options": [
              "Oui",
              "Non"
            ]
          },
          {
            "key": "type_etablissement",
            "label": "Type d'établissement",
            "hint": "Sélectionnez",
            "inputType": "dropdown",
            "options": [
              "Fast-food",
              "Restaurant",
              "Pâtisserie",
              "Boissons",
              "Grillade",
              "Café"
            ]
          },
          {
            "key": "horaires_ouverture",
            "label": "Horaires d'ouverture",
            "hint": "Ex: 08:00 - 22:00",
            "inputType": "text",
            "options": []
          },
          {
            "key": "zone_livraison",
            "label": "Zone de livraison",
            "hint": "Ex: Centre-ville, Héron, Balbala",
            "inputType": "text",
            "options": []
          }
        ]
      },
      {
        "typeKey": "offre_restaurant",
        "label": "Offre spéciale restaurant",
        "emoji": "🏷️",
        "listingType": "meal",
        "businessType": "restaurant",
        "fields": [
          {
            "key": "type_offre",
            "label": "Type d'offre",
            "hint": "Ex: Happy hour, Buffet, Brunch",
            "inputType": "text",
            "options": []
          },
          {
            "key": "horaires",
            "label": "Horaires",
            "hint": "Ex: 12h00 – 15h00",
            "inputType": "text",
            "options": []
          },
          {
            "key": "jours",
            "label": "Jours",
            "hint": "Ex: Lundi – Vendredi, Tous les jours",
            "inputType": "text",
            "options": []
          },
          {
            "key": "type_etablissement",
            "label": "Type d'établissement",
            "hint": "Sélectionnez",
            "inputType": "dropdown",
            "options": [
              "Fast-food",
              "Restaurant",
              "Pâtisserie",
              "Boissons",
              "Grillade",
              "Café"
            ]
          },
          {
            "key": "horaires_ouverture",
            "label": "Horaires d'ouverture",
            "hint": "Ex: 08:00 - 22:00",
            "inputType": "text",
            "options": []
          },
          {
            "key": "zone_livraison",
            "label": "Zone de livraison",
            "hint": "Ex: Centre-ville, Héron, Balbala",
            "inputType": "text",
            "options": []
          }
        ]
      }
    ]
  },
  {
    "categoryKey": "pharmacie",
    "label": "Pharmacie",
    "emoji": "💊",
    "listings": [
      {
        "typeKey": "produit_pharmacie",
        "label": "Produit pharmacie",
        "emoji": "💊",
        "listingType": "pharmacie",
        "businessType": "pharmacie",
        "fields": [
          {
            "key": "rayon",
            "label": "Rayon",
            "hint": "Sélectionnez",
            "inputType": "dropdown",
            "options": [
              "Médicaments",
              "Hygiène",
              "Bébé",
              "Bien-être",
              "Premiers soins",
              "Parapharmacie",
              "Matériel"
            ]
          },
          {
            "key": "requires_prescription",
            "label": "Ordonnance requise",
            "hint": "Oui / Non",
            "inputType": "dropdown",
            "options": [
              "Oui",
              "Non"
            ]
          },
          {
            "key": "type_pharmacie",
            "label": "Type de pharmacie",
            "hint": "Sélectionnez",
            "inputType": "dropdown",
            "options": [
              "Pharmacie générale",
              "Parapharmacie",
              "Pharmacie spécialisée"
            ]
          },
          {
            "key": "horaires_ouverture",
            "label": "Horaires d'ouverture",
            "hint": "Ex: 08:00 - 22:00",
            "inputType": "text",
            "options": []
          },
          {
            "key": "livraison",
            "label": "Livraison disponible",
            "hint": "Oui / Non",
            "inputType": "dropdown",
            "options": [
              "Oui",
              "Non"
            ]
          },
          {
            "key": "zone_livraison",
            "label": "Zone de livraison",
            "hint": "Ex: Centre-ville, Héron, Balbala",
            "inputType": "text",
            "options": []
          }
        ]
      }
    ]
  },
  {
    "categoryKey": "personnels",
    "label": "Personnels",
    "emoji": "👤",
    "listings": [
      {
        "typeKey": "menage",
        "label": "Femme / Homme de ménage",
        "emoji": "🧹",
        "listingType": "service",
        "businessType": "prestataire",
        "fields": [
          {
            "key": "type_menage",
            "label": "Type de ménage",
            "hint": "Ponctuel / Régulier / Les deux",
            "inputType": "dropdown",
            "options": [
              "Ponctuel",
              "Régulier",
              "Les deux"
            ]
          },
          {
            "key": "tarif_journee",
            "label": "Tarif / journée",
            "hint": "Ex: 100 000",
            "inputType": "number",
            "options": []
          },
          {
            "key": "zone",
            "label": "Zone d'intervention",
            "hint": "Ex: votre quartier / ville",
            "inputType": "text",
            "options": []
          },
          {
            "key": "experience",
            "label": "Années d'expérience",
            "hint": "Ex: 3 ans",
            "inputType": "number",
            "options": []
          },
          {
            "key": "references",
            "label": "Références disponibles",
            "hint": "Oui / Non",
            "inputType": "dropdown",
            "options": [
              "Oui",
              "Non"
            ]
          }
        ]
      },
      {
        "typeKey": "chauffeur",
        "label": "Chauffeur",
        "emoji": "🚘",
        "listingType": "service",
        "businessType": "prestataire",
        "fields": [
          {
            "key": "type_mission",
            "label": "Type de mission",
            "hint": "Ponctuel / Mensuel / Les deux",
            "inputType": "dropdown",
            "options": [
              "Ponctuel",
              "Mensuel",
              "Les deux"
            ]
          },
          {
            "key": "tarif_journee",
            "label": "Tarif / journée",
            "hint": "Ex: 200 000",
            "inputType": "number",
            "options": []
          },
          {
            "key": "permis",
            "label": "Type de permis",
            "hint": "Ex: B, C, D",
            "inputType": "text",
            "options": []
          },
          {
            "key": "experience",
            "label": "Années d'expérience",
            "hint": "Ex: 5 ans",
            "inputType": "number",
            "options": []
          },
          {
            "key": "zone",
            "label": "Zone d'intervention",
            "hint": "Ex: votre quartier / ville",
            "inputType": "text",
            "options": []
          }
        ]
      },
      {
        "typeKey": "coiffeur",
        "label": "Coiffeur / Coiffeuse",
        "emoji": "✂️",
        "listingType": "service",
        "businessType": "prestataire",
        "fields": [
          {
            "key": "specialite",
            "label": "Spécialité",
            "hint": "Ex: Tresses, Tissage, Barbier",
            "inputType": "text",
            "options": []
          },
          {
            "key": "deplacement",
            "label": "Déplacement à domicile",
            "hint": "Oui / Non",
            "inputType": "dropdown",
            "options": [
              "Oui",
              "Non"
            ]
          },
          {
            "key": "tarif_prestation",
            "label": "Tarif moyen",
            "hint": "Ex: 50 000",
            "inputType": "number",
            "options": []
          },
          {
            "key": "zone",
            "label": "Zone",
            "hint": "Ex: votre quartier / ville",
            "inputType": "text",
            "options": []
          }
        ]
      },
      {
        "typeKey": "coursier",
        "label": "Coursier / Livreur",
        "emoji": "📦",
        "listingType": "service",
        "businessType": "prestataire",
        "fields": [
          {
            "key": "moyen_transport",
            "label": "Moyen de transport",
            "hint": "Moto / Voiture / Vélo",
            "inputType": "dropdown",
            "options": [
              "Moto",
              "Voiture",
              "Vélo",
              "À pied"
            ]
          },
          {
            "key": "zone",
            "label": "Zone de livraison",
            "hint": "Ex: votre quartier / ville",
            "inputType": "text",
            "options": []
          },
          {
            "key": "tarif_livraison",
            "label": "Tarif de base",
            "hint": "Ex: 30 000",
            "inputType": "number",
            "options": []
          },
          {
            "key": "disponibilite",
            "label": "Disponibilité",
            "hint": "Ex: 7j/7, Jours ouvrés",
            "inputType": "text",
            "options": []
          }
        ]
      },
      {
        "typeKey": "nounou",
        "label": "Nounou / Garde d'enfants",
        "emoji": "👶",
        "listingType": "service",
        "businessType": "prestataire",
        "fields": [
          {
            "key": "age_enfants",
            "label": "Âge des enfants acceptés",
            "hint": "Ex: 0–3 ans, 3–10 ans",
            "inputType": "text",
            "options": []
          },
          {
            "key": "type_garde",
            "label": "Type de garde",
            "hint": "Journée / Nuit / Semaine",
            "inputType": "dropdown",
            "options": [
              "Journée",
              "Nuit",
              "Journée + Nuit",
              "Semaine"
            ]
          },
          {
            "key": "tarif_journee",
            "label": "Tarif / journée",
            "hint": "Ex: 80 000",
            "inputType": "number",
            "options": []
          },
          {
            "key": "experience",
            "label": "Années d'expérience",
            "hint": "Ex: 4 ans",
            "inputType": "number",
            "options": []
          },
          {
            "key": "zone",
            "label": "Zone",
            "hint": "Ex: votre quartier / ville",
            "inputType": "text",
            "options": []
          }
        ]
      },
      {
        "typeKey": "technicien",
        "label": "Technicien / Réparateur",
        "emoji": "🔧",
        "listingType": "service",
        "businessType": "prestataire",
        "fields": [
          {
            "key": "specialite",
            "label": "Spécialité",
            "hint": "Ex: Électronique, Plomberie, Climatisation",
            "inputType": "text",
            "options": []
          },
          {
            "key": "deplacement",
            "label": "Déplacement à domicile",
            "hint": "Oui / Non",
            "inputType": "dropdown",
            "options": [
              "Oui",
              "Non"
            ]
          },
          {
            "key": "tarif_intervention",
            "label": "Tarif d'intervention",
            "hint": "Ex: 100 000",
            "inputType": "number",
            "options": []
          },
          {
            "key": "experience",
            "label": "Années d'expérience",
            "hint": "Ex: 6 ans",
            "inputType": "number",
            "options": []
          },
          {
            "key": "zone",
            "label": "Zone d'intervention",
            "hint": "Ex: votre quartier / ville",
            "inputType": "text",
            "options": []
          }
        ]
      }
    ]
  },
  {
    "categoryKey": "hotel",
    "label": "Hôtels",
    "emoji": "🏨",
    "listings": [
      {
        "typeKey": "chambre_standard",
        "label": "Chambre standard",
        "emoji": "🛏️",
        "listingType": "room",
        "businessType": "hotel",
        "fields": [
          {
            "key": "capacite",
            "label": "Capacité (personnes)",
            "hint": "Ex: 2 personnes",
            "inputType": "text",
            "options": []
          },
          {
            "key": "lits",
            "label": "Lits",
            "hint": "Ex: 1 lit double / 2 lits simples",
            "inputType": "text",
            "options": []
          },
          {
            "key": "prix_nuit",
            "label": "Prix / nuit",
            "hint": "Ex: 25 000",
            "inputType": "number",
            "options": []
          },
          {
            "key": "petit_dejeuner",
            "label": "Petit-déjeuner",
            "hint": "Inclus / En option / Non",
            "inputType": "dropdown",
            "options": [
              "Inclus",
              "En option",
              "Non"
            ]
          },
          {
            "key": "equipements",
            "label": "Équipements",
            "hint": "Ex: Wi-Fi, Climatisation, Vue mer, Balcon",
            "inputType": "text",
            "options": []
          },
          {
            "key": "options",
            "label": "Options incluses",
            "hint": "Ex: Ménage quotidien, Navette aéroport",
            "inputType": "text",
            "options": []
          },
          {
            "key": "localisation",
            "label": "Localisation de l'hôtel",
            "hint": "Ex: Héron, Djibouti",
            "inputType": "text",
            "options": []
          },
          {
            "key": "tags",
            "label": "Ambiances (filtres)",
            "hint": "Ex: Vue mer, Piscine, Business, Famille, Couple, Luxe, Budget, Proche aéroport, Long séjour",
            "inputType": "text",
            "options": []
          }
        ]
      },
      {
        "typeKey": "chambre_double",
        "label": "Chambre double",
        "emoji": "🛌",
        "listingType": "room",
        "businessType": "hotel",
        "fields": [
          {
            "key": "capacite",
            "label": "Capacité (personnes)",
            "hint": "Ex: 2 personnes",
            "inputType": "text",
            "options": []
          },
          {
            "key": "lits",
            "label": "Lits",
            "hint": "Ex: 1 lit double / 2 lits simples",
            "inputType": "text",
            "options": []
          },
          {
            "key": "prix_nuit",
            "label": "Prix / nuit",
            "hint": "Ex: 25 000",
            "inputType": "number",
            "options": []
          },
          {
            "key": "petit_dejeuner",
            "label": "Petit-déjeuner",
            "hint": "Inclus / En option / Non",
            "inputType": "dropdown",
            "options": [
              "Inclus",
              "En option",
              "Non"
            ]
          },
          {
            "key": "equipements",
            "label": "Équipements",
            "hint": "Ex: Wi-Fi, Climatisation, Vue mer, Balcon",
            "inputType": "text",
            "options": []
          },
          {
            "key": "options",
            "label": "Options incluses",
            "hint": "Ex: Ménage quotidien, Navette aéroport",
            "inputType": "text",
            "options": []
          },
          {
            "key": "localisation",
            "label": "Localisation de l'hôtel",
            "hint": "Ex: Héron, Djibouti",
            "inputType": "text",
            "options": []
          },
          {
            "key": "tags",
            "label": "Ambiances (filtres)",
            "hint": "Ex: Vue mer, Piscine, Business, Famille, Couple, Luxe, Budget, Proche aéroport, Long séjour",
            "inputType": "text",
            "options": []
          }
        ]
      },
      {
        "typeKey": "suite",
        "label": "Suite",
        "emoji": "✨",
        "listingType": "room",
        "businessType": "hotel",
        "fields": [
          {
            "key": "capacite",
            "label": "Capacité (personnes)",
            "hint": "Ex: 2 personnes",
            "inputType": "text",
            "options": []
          },
          {
            "key": "lits",
            "label": "Lits",
            "hint": "Ex: 1 lit double / 2 lits simples",
            "inputType": "text",
            "options": []
          },
          {
            "key": "prix_nuit",
            "label": "Prix / nuit",
            "hint": "Ex: 25 000",
            "inputType": "number",
            "options": []
          },
          {
            "key": "petit_dejeuner",
            "label": "Petit-déjeuner",
            "hint": "Inclus / En option / Non",
            "inputType": "dropdown",
            "options": [
              "Inclus",
              "En option",
              "Non"
            ]
          },
          {
            "key": "equipements",
            "label": "Équipements",
            "hint": "Ex: Wi-Fi, Climatisation, Vue mer, Balcon",
            "inputType": "text",
            "options": []
          },
          {
            "key": "options",
            "label": "Options incluses",
            "hint": "Ex: Ménage quotidien, Navette aéroport",
            "inputType": "text",
            "options": []
          },
          {
            "key": "localisation",
            "label": "Localisation de l'hôtel",
            "hint": "Ex: Héron, Djibouti",
            "inputType": "text",
            "options": []
          },
          {
            "key": "tags",
            "label": "Ambiances (filtres)",
            "hint": "Ex: Vue mer, Piscine, Business, Famille, Couple, Luxe, Budget, Proche aéroport, Long séjour",
            "inputType": "text",
            "options": []
          }
        ]
      },
      {
        "typeKey": "chambre_familiale",
        "label": "Chambre familiale",
        "emoji": "👨‍👩‍👧",
        "listingType": "room",
        "businessType": "hotel",
        "fields": [
          {
            "key": "capacite",
            "label": "Capacité (personnes)",
            "hint": "Ex: 2 personnes",
            "inputType": "text",
            "options": []
          },
          {
            "key": "lits",
            "label": "Lits",
            "hint": "Ex: 1 lit double / 2 lits simples",
            "inputType": "text",
            "options": []
          },
          {
            "key": "prix_nuit",
            "label": "Prix / nuit",
            "hint": "Ex: 25 000",
            "inputType": "number",
            "options": []
          },
          {
            "key": "petit_dejeuner",
            "label": "Petit-déjeuner",
            "hint": "Inclus / En option / Non",
            "inputType": "dropdown",
            "options": [
              "Inclus",
              "En option",
              "Non"
            ]
          },
          {
            "key": "equipements",
            "label": "Équipements",
            "hint": "Ex: Wi-Fi, Climatisation, Vue mer, Balcon",
            "inputType": "text",
            "options": []
          },
          {
            "key": "options",
            "label": "Options incluses",
            "hint": "Ex: Ménage quotidien, Navette aéroport",
            "inputType": "text",
            "options": []
          },
          {
            "key": "localisation",
            "label": "Localisation de l'hôtel",
            "hint": "Ex: Héron, Djibouti",
            "inputType": "text",
            "options": []
          },
          {
            "key": "tags",
            "label": "Ambiances (filtres)",
            "hint": "Ex: Vue mer, Piscine, Business, Famille, Couple, Luxe, Budget, Proche aéroport, Long séjour",
            "inputType": "text",
            "options": []
          }
        ]
      },
      {
        "typeKey": "appartement_meuble",
        "label": "Appartement meublé",
        "emoji": "🏢",
        "listingType": "room",
        "businessType": "hotel",
        "fields": [
          {
            "key": "capacite",
            "label": "Capacité (personnes)",
            "hint": "Ex: 2 personnes",
            "inputType": "text",
            "options": []
          },
          {
            "key": "lits",
            "label": "Lits",
            "hint": "Ex: 1 lit double / 2 lits simples",
            "inputType": "text",
            "options": []
          },
          {
            "key": "prix_nuit",
            "label": "Prix / nuit",
            "hint": "Ex: 25 000",
            "inputType": "number",
            "options": []
          },
          {
            "key": "petit_dejeuner",
            "label": "Petit-déjeuner",
            "hint": "Inclus / En option / Non",
            "inputType": "dropdown",
            "options": [
              "Inclus",
              "En option",
              "Non"
            ]
          },
          {
            "key": "equipements",
            "label": "Équipements",
            "hint": "Ex: Wi-Fi, Climatisation, Vue mer, Balcon",
            "inputType": "text",
            "options": []
          },
          {
            "key": "options",
            "label": "Options incluses",
            "hint": "Ex: Ménage quotidien, Navette aéroport",
            "inputType": "text",
            "options": []
          },
          {
            "key": "localisation",
            "label": "Localisation de l'hôtel",
            "hint": "Ex: Héron, Djibouti",
            "inputType": "text",
            "options": []
          },
          {
            "key": "tags",
            "label": "Ambiances (filtres)",
            "hint": "Ex: Vue mer, Piscine, Business, Famille, Couple, Luxe, Budget, Proche aéroport, Long séjour",
            "inputType": "text",
            "options": []
          }
        ]
      }
    ]
  }
];
