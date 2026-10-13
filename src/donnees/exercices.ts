/** Exercices de base, dans le code (docs/modele-donnees.md, « Exercice »). Identifiants stables. */

export type TypeCharge = "barre" | "halteres" | "machine" | "poulie" | "poids-corps-leste" | "poids-corps" | "distance";

export type Muscle =
  | "pectoraux" | "dos" | "epaules" | "biceps" | "triceps" | "quadriceps"
  | "ischios" | "fessiers" | "mollets" | "abdos" | "avant-bras";

export interface Exercice {
  id: string;
  nom: string;
  charge: TypeCharge;
  /** Arrondi des charges proposées, en kg. */
  pas: number;
  muscles: { principaux: Muscle[]; secondaires: Muscle[] };
  /** Compte dans la stat Force (gros mouvements). */
  force?: boolean;
}

const exo = (
  id: string, nom: string, charge: TypeCharge, pas: number,
  principaux: Muscle[], secondaires: Muscle[] = [], force = false,
): Exercice => ({ id, nom, charge, pas, muscles: { principaux, secondaires }, ...(force ? { force } : {}) });

export const EXERCICES: Exercice[] = [
  exo("developpe-couche", "Développé couché", "barre", 2.5, ["pectoraux"], ["triceps", "epaules"], true),
  exo("developpe-militaire-barre", "Développé militaire barre", "barre", 2.5, ["epaules"], ["triceps"], true),
  exo("developpe-incline-halteres", "Développé incliné haltères", "halteres", 2, ["pectoraux"], ["epaules", "triceps"]),
  exo("souleve-de-terre", "Soulevé de terre", "barre", 2.5, ["ischios", "fessiers", "dos"], ["avant-bras"], true),
  exo("hack-squat", "Hack squat", "machine", 5, ["quadriceps"], ["fessiers"], true),
  exo("rowing-barre", "Rowing barre", "barre", 2.5, ["dos"], ["biceps"]),
  exo("rowing-haltere", "Rowing haltère", "halteres", 2, ["dos"], ["biceps"]),
  exo("tractions-lestees", "Tractions lestées", "poids-corps-leste", 2.5, ["dos"], ["biceps"], true),
  exo("tractions-australiennes", "Tractions australiennes", "poids-corps", 1, ["dos"], ["biceps"]),
  exo("dips-lestes", "Dips lestés", "poids-corps-leste", 2.5, ["pectoraux", "triceps"], ["epaules"]),
  exo("dips", "Dips", "poids-corps", 1, ["pectoraux", "triceps"], ["epaules"]),
  exo("fentes-bulgares", "Fentes bulgares", "halteres", 2, ["quadriceps", "fessiers"]),
  exo("hip-thrust", "Hip thrust", "barre", 5, ["fessiers"], ["ischios"]),
  exo("leg-curl-allonge", "Leg curl allongé", "machine", 2.5, ["ischios"]),
  exo("leg-extension", "Leg extension", "machine", 2.5, ["quadriceps"]),
  exo("mollets-debout", "Mollets debout", "machine", 5, ["mollets"]),
  exo("elevations-laterales-poulie", "Élévations latérales poulie", "poulie", 1.25, ["epaules"]),
  exo("ecarte-inverse-poulie", "Écarté inversé poulie", "poulie", 1.25, ["epaules"], ["dos"]),
  exo("face-pull", "Face pull", "poulie", 2.5, ["epaules"], ["dos"]),
  exo("curl-poulie-basse", "Curl poulie basse", "poulie", 2.5, ["biceps"], ["avant-bras"]),
  exo("curl-marteau", "Curl marteau", "halteres", 2, ["biceps"], ["avant-bras"]),
  exo("extension-triceps-poulie-haute", "Extension triceps poulie haute", "poulie", 2.5, ["triceps"]),
  exo("extension-corde-nuque", "Extension corde nuque", "poulie", 2.5, ["triceps"]),
  exo("crunch-poulie-haute", "Crunch poulie haute", "poulie", 2.5, ["abdos"]),
  exo("farmer-walk", "Farmer's walk", "distance", 2, ["avant-bras"], ["dos", "abdos"]),
];

const PAR_ID = new Map(EXERCICES.map((e) => [e.id, e]));

export function exercice(id: string): Exercice {
  const e = PAR_ID.get(id);
  if (!e) throw new Error(`exercice inconnu : ${id}`);
  return e;
}

/** Libellé du champ charge : sur un lesté, `kg` est le lest seul. */
export const libelleCharge = (e: Exercice) => (e.charge === "poids-corps-leste" ? "lest kg" : "kg");
