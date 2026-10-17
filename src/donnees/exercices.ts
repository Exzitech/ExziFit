/** Exercices de base, dans le code (docs/modele-donnees.md, « Exercice »). Identifiants stables. */

import { t } from "../i18n";

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
  | "elevation-laterale" | "arriere-epaule" | "curl" | "extension-coude" | "abdos" | "port"
  | "abduction-hanche" | "adduction-hanche";

export interface Exercice {
  id: string;
  nom: string;
  charge: TypeCharge;
  mouvement: Mouvement;
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
  id: string, nom: string, charge: TypeCharge, mouvement: Mouvement, pas: number,
  principaux: Muscle[], secondaires: Muscle[], force?: [ref: number, poids: number],
): Exercice => ({
  id, nom, charge, mouvement, pas, muscles: { principaux, secondaires }, ...(force ? { force: { ref: force[0], poids: force[1] } } : {}),
});
/** Machine chargée de disques (Smith, presse) : `kg` = disques seuls. */
const disq = (e: Exercice): Exercice => ({ ...e, disques: true });

export const EXERCICES: Exercice[] = [
  exo("developpe-couche", "Bench press", "barre", "poussee-horizontale", 2.5, ["pectoraux"], ["triceps", "epaules"], [1.75, 1]),
  exo("developpe-militaire-barre", "Overhead press", "barre", "poussee-verticale", 2.5, ["epaules"], ["triceps"], [1.1, 1]),
  disq(exo("developpe-militaire-smith", "Smith overhead press", "machine", "poussee-verticale", 2.5, ["epaules"], ["triceps"], [1.1, 0.5])),
  exo("developpe-militaire-halteres", "Dumbbell shoulder press", "halteres", "poussee-verticale", 2, ["epaules"], ["triceps"], [0.45, 0.5]),
  disq(exo("developpe-couche-smith", "Smith bench press", "machine", "poussee-horizontale", 2.5, ["pectoraux"], ["triceps", "epaules"], [1.75, 0.5])),
  exo("developpe-incline-halteres", "Incline dumbbell press", "halteres", "poussee-horizontale", 2, ["pectoraux"], ["epaules", "triceps"], [0.55, 0.5]),
  exo("ecarte-poulie", "Cable fly", "poulie", "poussee-horizontale", 1.25, ["pectoraux"], ["epaules"], [0.2, 0.25]),
  exo("souleve-de-terre", "Deadlift", "barre", "charniere", 2.5, ["ischios", "fessiers", "dos"], ["avant-bras"], [2.75, 1]),
  exo("souleve-roumain", "Romanian deadlift", "barre", "charniere", 2.5, ["ischios", "fessiers"], ["dos"], [2, 0.5]),
  disq(exo("hack-squat", "Hack squat", "machine", "squat", 5, ["quadriceps"], ["fessiers"], [3, 1])),
  disq(exo("squat-smith", "Smith squat", "machine", "squat", 5, ["quadriceps", "fessiers"], [], [2.25, 0.5])),
  disq(exo("presse-cuisses", "Leg press", "machine", "squat", 5, ["quadriceps", "fessiers"], [], [4, 0.5])),
  exo("rowing-barre", "Barbell row", "barre", "tirage-horizontal", 2.5, ["dos"], ["biceps"], [1.5, 0.5]),
  exo("rowing-haltere", "Dumbbell row", "halteres", "tirage-horizontal", 2, ["dos"], ["biceps"], [0.8, 0.5]),
  exo("tractions-lestees", "Weighted pull-up", "poids-corps-leste", "tirage-vertical", 2.5, ["dos"], ["biceps"], [1.75, 1]),
  exo("tractions-australiennes", "Inverted row", "poids-corps", "tirage-horizontal", 1, ["dos"], ["biceps"]),
  exo("tirage-vertical-neutre", "Neutral-grip lat pulldown", "poulie", "tirage-vertical", 2.5, ["dos"], ["biceps"], [1, 0.5]),
  exo("pullover-poulie", "Cable pullover", "poulie", "tirage-vertical", 2.5, ["dos"], [], [0.4, 0.25]),
  exo("dips-lestes", "Weighted dip", "poids-corps-leste", "poussee-horizontale", 2.5, ["pectoraux", "triceps"], ["epaules"], [2, 0.5]),
  exo("dips", "Dip", "poids-corps", "poussee-horizontale", 1, ["pectoraux", "triceps"], ["epaules"]),
  exo("fentes-bulgares", "Bulgarian split squat", "halteres", "fente", 2, ["quadriceps", "fessiers"], [], [0.6, 0.5]),
  exo("hip-thrust", "Hip thrust", "barre", "hanche", 5, ["fessiers"], ["ischios"], [3, 0.5]),
  exo("leg-curl-allonge", "Lying leg curl", "machine", "flexion-genou", 2.5, ["ischios"], [], [1, 0.25]),
  exo("leg-curl-assis", "Seated leg curl", "machine", "flexion-genou", 2.5, ["ischios"], [], [1.1, 0.25]),
  exo("leg-extension", "Leg extension", "machine", "extension-genou", 2.5, ["quadriceps"], [], [1.25, 0.25]),
  exo("mollets-debout", "Standing calf raise", "machine", "mollets", 5, ["mollets"], [], [2.5, 0.25]),
  exo("mollets-assis", "Seated calf raise", "machine", "mollets", 5, ["mollets"], [], [1.5, 0.25]),
  exo("elevations-laterales-poulie", "Cable lateral raise", "poulie", "elevation-laterale", 1.25, ["epaules"], [], [0.15, 0.25]),
  exo("ecarte-inverse-poulie", "Cable reverse fly", "poulie", "arriere-epaule", 1.25, ["epaules"], ["dos"], [0.15, 0.25]),
  exo("face-pull", "Face pull", "poulie", "arriere-epaule", 2.5, ["epaules"], ["dos"], [0.5, 0.25]),
  exo("curl-poulie-basse", "Cable curl", "poulie", "curl", 2.5, ["biceps"], ["avant-bras"], [0.6, 0.25]),
  exo("curl-marteau", "Hammer curl", "halteres", "curl", 2, ["biceps"], ["avant-bras"], [0.35, 0.25]),
  exo("curl-incline-halteres", "Incline dumbbell curl", "halteres", "curl", 2, ["biceps"], [], [0.2, 0.25]),
  exo("extension-triceps-poulie-haute", "Triceps pushdown", "poulie", "extension-coude", 2.5, ["triceps"], [], [0.75, 0.25]),
  exo("extension-corde-nuque", "Overhead rope extension", "poulie", "extension-coude", 2.5, ["triceps"], [], [0.6, 0.25]),
  exo("crunch-poulie-haute", "Cable crunch", "poulie", "abdos", 2.5, ["abdos"], [], [1, 0.25]),
  exo("farmer-walk", "Farmer's walk", "distance", "port", 2, ["avant-bras"], ["dos", "abdos"]),
  // Remplaçants (0.1.21) : un par schéma qui n'en avait pas sans le même matériel. Références de Force indicatives.
  exo("squat", "Back squat", "barre", "squat", 2.5, ["quadriceps", "fessiers"], ["abdos"], [2.5, 1]),
  exo("goblet-squat", "Goblet squat", "halteres", "squat", 2, ["quadriceps", "fessiers"], [], [0.8, 0.5]),
  exo("split-squat", "Split squat", "halteres", "fente", 2, ["quadriceps", "fessiers"], [], [0.7, 0.5]),
  exo("fentes-marchees", "Walking lunge", "halteres", "fente", 2, ["quadriceps", "fessiers"], [], [0.5, 0.5]),
  exo("developpe-couche-halteres", "Dumbbell bench press", "halteres", "poussee-horizontale", 2, ["pectoraux"], ["triceps", "epaules"], [0.7, 0.5]),
  exo("developpe-machine", "Machine chest press", "machine", "poussee-horizontale", 5, ["pectoraux"], ["triceps", "epaules"], [1.5, 0.5]),
  exo("tirage-vertical", "Lat pulldown", "poulie", "tirage-vertical", 2.5, ["dos"], ["biceps"], [1, 0.5]),
  exo("rowing-poulie", "Seated cable row", "poulie", "tirage-horizontal", 2.5, ["dos"], ["biceps"], [1.2, 0.5]),
  exo("releve-jambes", "Hanging leg raise", "poids-corps", "abdos", 1, ["abdos"], []),
  // Séances d'une testeuse (2026-10-17) : fessiers, machines guidées, poids du corps. Sans part
  // dans la Force (pas de référence connue). Pas de groupe adducteurs : en ajouter un changerait
  // l'Endurance de tous (moyenne des groupes) ; l'adduction est rangée avec les fessiers, comme sa machine.
  exo("abduction-machine", "Hip abduction machine", "machine", "abduction-hanche", 5, ["fessiers"], []),
  exo("adduction-machine", "Hip adduction machine", "machine", "adduction-hanche", 5, ["fessiers"], []),
  exo("abduction-quatre-pattes", "Quadruped hip abduction", "poids-corps", "abduction-hanche", 1, ["fessiers"], []),
  exo("pont-fessier", "Glute bridge", "poids-corps", "hanche", 1, ["fessiers"], ["ischios"]),
  exo("squat-sumo-haltere", "Dumbbell sumo squat", "halteres", "squat", 2, ["quadriceps", "fessiers"], []),
  exo("fente-laterale", "Lateral lunge", "barre", "fente", 2.5, ["quadriceps", "fessiers"], []),
  exo("rowing-halteres-penche", "Bent-over dumbbell row", "halteres", "tirage-horizontal", 2, ["dos"], ["biceps"]),
  exo("curl-inverse-barre", "Reverse barbell curl", "barre", "curl", 2.5, ["biceps"], ["avant-bras"]),
  exo("kickback-triceps", "Dumbbell triceps kickback", "halteres", "extension-coude", 2, ["triceps"], []),
  exo("sit-up", "Sit-up", "poids-corps", "abdos", 1, ["abdos"], []),
  exo("crunch-jambes-levees", "Legs-up crunch", "poids-corps", "abdos", 1, ["abdos"], []),
  exo("mollets-poids-corps", "Bodyweight calf raise", "poids-corps", "mollets", 1, ["mollets"], []),
];

const PAR_ID = new Map(EXERCICES.map((e) => [e.id, e]));
/** Noms du catalogue ci-dessus (ceux du français et de l'anglais) ; une langue peut les remplacer (`t.exos`). */
const NOMS = new Map(EXERCICES.map((e) => [e.id, e.nom]));

/** Noms dans la langue courante, posés sur le catalogue lui-même : tous les écrans lisent `nom`. */
export function traduireExercices(): void {
  for (const e of EXERCICES) e.nom = t.exos[e.id] ?? NOMS.get(e.id)!;
}

export function exercice(id: string): Exercice {
  const e = PAR_ID.get(id);
  if (!e) throw new Error(`exercice inconnu : ${id}`);
  return e;
}

/** Libellé du champ charge : sur un lesté, `kg` est le lest seul ; sur une machine à disques, les disques seuls. */
export const libelleCharge = (e: Exercice) =>
  e.charge === "poids-corps-leste" ? t.charge.leste : e.disques ? t.charge.disques : e.poulie ? t.charge.pile : t.charge.kg;

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
