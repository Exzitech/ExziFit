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
  /**
   * Part dans la stat Force (docs/stats.md) : `ref` = e1RM ÷ poids de corps qui vaut 100, `poids` =
   * coefficient dans la moyenne. Absent : l'exo ne compte pas (poids du corps sans lest, distance).
   */
  force?: { ref: number; poids: number };
  /** Machine chargée de disques (Smith, presse, hack squat) : `kg` = disques seuls, affichés par côté. */
  disques?: true;
  /**
   * Montage de la salle du jour (salles.ts, `exerciceEn`), jamais dans le catalogue. `aVide` :
   * chariot ou barre de la machine, ajouté aux disques pour les calculs. `poulie` : moufle, la pile
   * affiche `poulie` × la charge réelle.
   */
  aVide?: number;
  poulie?: 2;
}

const exo = (
  id: string, nom: string, charge: TypeCharge, pas: number,
  principaux: Muscle[], secondaires: Muscle[], force?: [ref: number, poids: number],
): Exercice => ({
  id, nom, charge, pas, muscles: { principaux, secondaires }, ...(force ? { force: { ref: force[0], poids: force[1] } } : {}),
});
/** Machine chargée de disques (Smith, presse) : `kg` = disques seuls. */
const disq = (e: Exercice): Exercice => ({ ...e, disques: true });

export const EXERCICES: Exercice[] = [
  exo("developpe-couche", "Bench press", "barre", 2.5, ["pectoraux"], ["triceps", "epaules"], [1.75, 1]),
  exo("developpe-militaire-barre", "Overhead press", "barre", 2.5, ["epaules"], ["triceps"], [1.1, 1]),
  disq(exo("developpe-militaire-smith", "Smith overhead press", "machine", 2.5, ["epaules"], ["triceps"], [1.1, 0.5])),
  exo("developpe-militaire-halteres", "Dumbbell shoulder press", "halteres", 2, ["epaules"], ["triceps"], [0.45, 0.5]),
  disq(exo("developpe-couche-smith", "Smith bench press", "machine", 2.5, ["pectoraux"], ["triceps", "epaules"], [1.75, 0.5])),
  exo("developpe-incline-halteres", "Incline dumbbell press", "halteres", 2, ["pectoraux"], ["epaules", "triceps"], [0.55, 0.5]),
  exo("ecarte-poulie", "Cable fly", "poulie", 1.25, ["pectoraux"], ["epaules"], [0.2, 0.25]),
  exo("souleve-de-terre", "Deadlift", "barre", 2.5, ["ischios", "fessiers", "dos"], ["avant-bras"], [2.75, 1]),
  exo("souleve-roumain", "Romanian deadlift", "barre", 2.5, ["ischios", "fessiers"], ["dos"], [2, 0.5]),
  disq(exo("hack-squat", "Hack squat", "machine", 5, ["quadriceps"], ["fessiers"], [3, 1])),
  disq(exo("squat-smith", "Smith squat", "machine", 5, ["quadriceps", "fessiers"], [], [2.25, 0.5])),
  disq(exo("presse-cuisses", "Leg press", "machine", 5, ["quadriceps", "fessiers"], [], [4, 0.5])),
  exo("rowing-barre", "Barbell row", "barre", 2.5, ["dos"], ["biceps"], [1.5, 0.5]),
  exo("rowing-haltere", "Dumbbell row", "halteres", 2, ["dos"], ["biceps"], [0.8, 0.5]),
  exo("tractions-lestees", "Weighted pull-up", "poids-corps-leste", 2.5, ["dos"], ["biceps"], [1.75, 1]),
  exo("tractions-australiennes", "Inverted row", "poids-corps", 1, ["dos"], ["biceps"]),
  exo("tirage-vertical-neutre", "Neutral-grip lat pulldown", "poulie", 2.5, ["dos"], ["biceps"], [1, 0.5]),
  exo("pullover-poulie", "Cable pullover", "poulie", 2.5, ["dos"], [], [0.4, 0.25]),
  exo("dips-lestes", "Weighted dip", "poids-corps-leste", 2.5, ["pectoraux", "triceps"], ["epaules"], [2, 0.5]),
  exo("dips", "Dip", "poids-corps", 1, ["pectoraux", "triceps"], ["epaules"]),
  exo("fentes-bulgares", "Bulgarian split squat", "halteres", 2, ["quadriceps", "fessiers"], [], [0.6, 0.5]),
  exo("hip-thrust", "Hip thrust", "barre", 5, ["fessiers"], ["ischios"], [3, 0.5]),
  exo("leg-curl-allonge", "Lying leg curl", "machine", 2.5, ["ischios"], [], [1, 0.25]),
  exo("leg-curl-assis", "Seated leg curl", "machine", 2.5, ["ischios"], [], [1.1, 0.25]),
  exo("leg-extension", "Leg extension", "machine", 2.5, ["quadriceps"], [], [1.25, 0.25]),
  exo("mollets-debout", "Standing calf raise", "machine", 5, ["mollets"], [], [2.5, 0.25]),
  exo("mollets-assis", "Seated calf raise", "machine", 5, ["mollets"], [], [1.5, 0.25]),
  exo("elevations-laterales-poulie", "Cable lateral raise", "poulie", 1.25, ["epaules"], [], [0.15, 0.25]),
  exo("ecarte-inverse-poulie", "Cable reverse fly", "poulie", 1.25, ["epaules"], ["dos"], [0.15, 0.25]),
  exo("face-pull", "Face pull", "poulie", 2.5, ["epaules"], ["dos"], [0.5, 0.25]),
  exo("curl-poulie-basse", "Cable curl", "poulie", 2.5, ["biceps"], ["avant-bras"], [0.6, 0.25]),
  exo("curl-marteau", "Hammer curl", "halteres", 2, ["biceps"], ["avant-bras"], [0.35, 0.25]),
  exo("curl-incline-halteres", "Incline dumbbell curl", "halteres", 2, ["biceps"], [], [0.2, 0.25]),
  exo("extension-triceps-poulie-haute", "Triceps pushdown", "poulie", 2.5, ["triceps"], [], [0.75, 0.25]),
  exo("extension-corde-nuque", "Overhead rope extension", "poulie", 2.5, ["triceps"], [], [0.6, 0.25]),
  exo("crunch-poulie-haute", "Cable crunch", "poulie", 2.5, ["abdos"], [], [1, 0.25]),
  exo("farmer-walk", "Farmer's walk", "distance", 2, ["avant-bras"], ["dos", "abdos"]),
];

const PAR_ID = new Map(EXERCICES.map((e) => [e.id, e]));

export function exercice(id: string): Exercice {
  const e = PAR_ID.get(id);
  if (!e) throw new Error(`exercice inconnu : ${id}`);
  return e;
}

/** Libellé du champ charge : sur un lesté, `kg` est le lest seul ; sur une machine à disques, les disques seuls. */
export const libelleCharge = (e: Exercice) =>
  e.charge === "poids-corps-leste" ? "lest kg" : e.disques ? "disques" : e.poulie ? "pile" : "kg";
