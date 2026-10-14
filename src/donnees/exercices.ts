/** Exercices de base, dans le code (docs/modele-donnees.md, « Exercice »). Identifiants stables. */

export type TypeCharge = "barre" | "halteres" | "machine" | "poulie" | "poids-corps-leste" | "poids-corps" | "distance";

export type Muscle =
  | "pectoraux" | "dos" | "epaules" | "biceps" | "triceps" | "quadriceps"
  | "ischios" | "fessiers" | "mollets" | "abdos" | "avant-bras";

/**
 * Schéma de mouvement : ce qui rend deux exos interchangeables quand la machine est prise.
 * Bulgarian split squat sans banc → split squat ou fentes (même schéma), puis squat (mêmes muscles), jamais un bench.
 */
export type Mouvement =
  | "squat" | "fente" | "charniere" | "hanche" | "poussee-horizontale" | "poussee-verticale"
  | "tirage-vertical" | "tirage-horizontal" | "flexion-genou" | "extension-genou" | "mollets"
  | "elevation-laterale" | "arriere-epaule" | "curl" | "extension-coude" | "abdos" | "port";

export interface Exercice {
  id: string;
  nom: string;
  charge: TypeCharge;
  mouvement: Mouvement;
  /** Arrondi des charges proposées, en kg. */
  pas: number;
  muscles: { principaux: Muscle[]; secondaires: Muscle[] };
  /** Compte dans la stat Force (gros mouvements). */
  force?: boolean;
}

const exo = (
  id: string, nom: string, charge: TypeCharge, mouvement: Mouvement, pas: number,
  principaux: Muscle[], secondaires: Muscle[] = [], force = false,
): Exercice => ({ id, nom, charge, mouvement, pas, muscles: { principaux, secondaires }, ...(force ? { force } : {}) });

export const EXERCICES: Exercice[] = [
  exo("developpe-couche", "Bench press", "barre", "poussee-horizontale", 2.5, ["pectoraux"], ["triceps", "epaules"], true),
  exo("developpe-militaire-barre", "Overhead press", "barre", "poussee-verticale", 2.5, ["epaules"], ["triceps"], true),
  exo("developpe-incline-halteres", "Incline dumbbell press", "halteres", "poussee-horizontale", 2, ["pectoraux"], ["epaules", "triceps"]),
  exo("souleve-de-terre", "Deadlift", "barre", "charniere", 2.5, ["ischios", "fessiers", "dos"], ["avant-bras"], true),
  exo("hack-squat", "Hack squat", "machine", "squat", 5, ["quadriceps"], ["fessiers"], true),
  exo("rowing-barre", "Barbell row", "barre", "tirage-horizontal", 2.5, ["dos"], ["biceps"]),
  exo("rowing-haltere", "Dumbbell row", "halteres", "tirage-horizontal", 2, ["dos"], ["biceps"]),
  exo("tractions-lestees", "Weighted pull-up", "poids-corps-leste", "tirage-vertical", 2.5, ["dos"], ["biceps"], true),
  exo("tractions-australiennes", "Inverted row", "poids-corps", "tirage-horizontal", 1, ["dos"], ["biceps"]),
  exo("dips-lestes", "Weighted dip", "poids-corps-leste", "poussee-horizontale", 2.5, ["pectoraux", "triceps"], ["epaules"]),
  exo("dips", "Dip", "poids-corps", "poussee-horizontale", 1, ["pectoraux", "triceps"], ["epaules"]),
  exo("fentes-bulgares", "Bulgarian split squat", "halteres", "fente", 2, ["quadriceps", "fessiers"]),
  exo("hip-thrust", "Hip thrust", "barre", "hanche", 5, ["fessiers"], ["ischios"]),
  exo("leg-curl-allonge", "Lying leg curl", "machine", "flexion-genou", 2.5, ["ischios"]),
  exo("leg-curl-assis", "Seated leg curl", "machine", "flexion-genou", 2.5, ["ischios"]),
  exo("leg-extension", "Leg extension", "machine", "extension-genou", 2.5, ["quadriceps"]),
  exo("mollets-debout", "Standing calf raise", "machine", "mollets", 5, ["mollets"]),
  exo("elevations-laterales-poulie", "Cable lateral raise", "poulie", "elevation-laterale", 1.25, ["epaules"]),
  exo("ecarte-inverse-poulie", "Cable reverse fly", "poulie", "arriere-epaule", 1.25, ["epaules"], ["dos"]),
  exo("face-pull", "Face pull", "poulie", "arriere-epaule", 2.5, ["epaules"], ["dos"]),
  exo("curl-poulie-basse", "Cable curl", "poulie", "curl", 2.5, ["biceps"], ["avant-bras"]),
  exo("curl-marteau", "Hammer curl", "halteres", "curl", 2, ["biceps"], ["avant-bras"]),
  exo("extension-triceps-poulie-haute", "Triceps pushdown", "poulie", "extension-coude", 2.5, ["triceps"]),
  exo("extension-corde-nuque", "Overhead rope extension", "poulie", "extension-coude", 2.5, ["triceps"]),
  exo("crunch-poulie-haute", "Cable crunch", "poulie", "abdos", 2.5, ["abdos"]),
  exo("farmer-walk", "Farmer's walk", "distance", "port", 2, ["avant-bras"], ["dos", "abdos"]),
  // Remplaçants (0.1.21) : un par schéma qui n'en avait pas sans le même matériel.
  exo("squat", "Back squat", "barre", "squat", 2.5, ["quadriceps", "fessiers"], ["abdos"], true),
  exo("presse-cuisses", "Leg press", "machine", "squat", 5, ["quadriceps", "fessiers"]),
  exo("goblet-squat", "Goblet squat", "halteres", "squat", 2, ["quadriceps", "fessiers"]),
  exo("split-squat", "Split squat", "halteres", "fente", 2, ["quadriceps", "fessiers"]),
  exo("fentes-marchees", "Walking lunge", "halteres", "fente", 2, ["quadriceps", "fessiers"]),
  exo("souleve-roumain", "Romanian deadlift", "barre", "charniere", 2.5, ["ischios", "fessiers"], ["dos"]),
  exo("developpe-couche-halteres", "Dumbbell bench press", "halteres", "poussee-horizontale", 2, ["pectoraux"], ["triceps", "epaules"]),
  exo("developpe-machine", "Machine chest press", "machine", "poussee-horizontale", 5, ["pectoraux"], ["triceps", "epaules"]),
  exo("developpe-halteres-assis", "Seated dumbbell press", "halteres", "poussee-verticale", 2, ["epaules"], ["triceps"]),
  exo("tirage-vertical", "Lat pulldown", "poulie", "tirage-vertical", 2.5, ["dos"], ["biceps"]),
  exo("rowing-poulie", "Seated cable row", "poulie", "tirage-horizontal", 2.5, ["dos"], ["biceps"]),
  exo("mollets-assis", "Seated calf raise", "machine", "mollets", 5, ["mollets"]),
  exo("releve-jambes", "Hanging leg raise", "poids-corps", "abdos", 1, ["abdos"]),
];

const PAR_ID = new Map(EXERCICES.map((e) => [e.id, e]));

export function exercice(id: string): Exercice {
  const e = PAR_ID.get(id);
  if (!e) throw new Error(`exercice inconnu : ${id}`);
  return e;
}

/** Libellé du champ charge : sur un lesté, `kg` est le lest seul. */
export const libelleCharge = (e: Exercice) => (e.charge === "poids-corps-leste" ? "lest kg" : "kg");

export interface Remplacant { e: Exercice; raison: "programme" | "mouvement" | "muscles" | null }

/**
 * Remplaçants de `id`, du plus proche au plus lointain : alternatives du programme, même schéma
 * de mouvement, mêmes muscles principaux, puis tout le reste. Le premier est le « top ».
 */
export function remplacants(id: string, alternatives: string[] = []): Remplacant[] {
  const r = exercice(id);
  const raison = (e: Exercice): Remplacant["raison"] =>
    alternatives.includes(e.id) ? "programme"
      : e.mouvement === r.mouvement ? "mouvement"
        : e.muscles.principaux.some((m) => r.muscles.principaux.includes(m)) ? "muscles" : null;
  const rang = { programme: 0, mouvement: 1, muscles: 2 } as const;
  return EXERCICES.filter((e) => e.id !== id)
    .map((e) => ({ e, raison: raison(e) }))
    .sort((a, b) => (a.raison ? rang[a.raison] : 3) - (b.raison ? rang[b.raison] : 3));
}
