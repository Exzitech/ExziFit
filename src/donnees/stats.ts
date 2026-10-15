import { exercice, type Muscle } from "./exercices";
import type { Seance, Serie } from "./journal";
import { e1rmSerie, membres, type Programme } from "./programme";

/** Stats du personnage (docs/stats.md) : fonctions pures du journal et des pesées, rien n'est stocké. */

/** `le` : instant de la saisie (synchro : la plus récente gagne), absent avant la 0.1.22. */
export interface Pesee { date: string; kg: number; le?: string }

export type Sexe = "homme" | "femme";

const BAS_DU_CORPS: Muscle[] = ["quadriceps", "ischios", "fessiers", "mollets"];

/**
 * Référence féminine = référence masculine × facteur (docs/stats.md, « Force ») : 0,8 si l'exo
 * travaille surtout le bas du corps, 0,65 sinon. Force 100 = très avancé(e) dans son sexe.
 */
export function facteurSexe(sexe: Sexe, principaux: Muscle[]): number {
  if (sexe === "homme") return 1;
  return principaux.some((m) => BAS_DU_CORPS.includes(m)) ? 0.8 : 0.65;
}

export interface Stats {
  /** `undefined` sans pesée ou sans aucun exo de force fait. */
  force?: number;
  groupes: Record<Muscle, number>;
  endurance: number;
  constance: number;
  /** Part des exos comparables qui progressent ; `undefined` si aucun ne l'est. */
  progression?: number;
}

/** 1RM estimé d'un exo, maintenant (14 derniers jours) et 4 semaines plus tôt (28 à 42 jours). */
export interface Progres {
  exo: string;
  actuel: number;
  /** `undefined` si l'exo n'a pas été fait 4 semaines plus tôt. */
  avant?: number;
}

export const MUSCLES: Muscle[] = [
  "pectoraux", "dos", "epaules", "biceps", "triceps", "quadriceps",
  "ischios", "fessiers", "mollets", "abdos", "avant-bras",
];

const JOUR = 86_400_000;

/** Série de travail à RIR ≤ 3 ; un RIR absent compte (données anciennes). */
export const serieDure = (s: Serie) => s.type === "travail" && (s.rir ?? 0) <= 3;

/** Part du e1RM d'une série encore retenue après `jours` : 1 jusqu'à 21 j, puis −1 %/semaine, plancher 0,7. */
export const usure = (jours: number) => (jours <= 21 ? 1 : Math.max(0.7, 0.99 ** ((jours - 21) / 7)));

/** Pesée la plus proche avant `t` (ms), sinon la première ; `undefined` sans pesée. */
function poidsA(pesees: Pesee[], t: number): number | undefined {
  let res = pesees[0]?.kg;
  for (const p of pesees) if (Date.parse(p.date) <= t) res = p.kg;
  return res;
}

/** Séances faites, triées, jusqu'à `maintenant` inclus. */
const jusqua = (seances: Seance[], t: number) => seances.filter((s) => Date.parse(s.debut) <= t);

function force(seances: Seance[], pesees: Pesee[], sexe: Sexe, t: number): number | undefined {
  const tries = [...pesees].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const poids = poidsA(tries, t);
  if (poids === undefined) return undefined;
  const retenu = new Map<string, number>();
  for (const s of seances) {
    for (const x of s.exercices) {
      const e = exercice(x.exo);
      if (!e.force) continue;
      for (const v of x.series) {
        if (!serieDure(v) || v.reps < 1 || v.reps > 10) continue;
        const quand = Date.parse(v.a ?? s.debut);
        const corps = e.charge === "poids-corps-leste" ? (poidsA(tries, quand) as number) : 0;
        const val = e1rmSerie(v.kg + corps, v.reps, v.rir ?? 0) * usure((t - quand) / JOUR);
        if (val > (retenu.get(e.id) ?? 0)) retenu.set(e.id, val);
      }
    }
  }
  if (!retenu.size) return undefined;
  let total = 0;
  let coefs = 0;
  for (const [id, rm] of retenu) {
    const e = exercice(id);
    const { ref, poids: coef } = e.force!;
    total += (coef * 100 * rm) / poids / (ref * facteurSexe(sexe, e.muscles.principaux));
    coefs += coef;
  }
  return total / coefs;
}

/** Séries dures par semaine sur 28 jours (principal 1, secondaire 0,5), score plafonné à 10 séries. */
function groupes(seances: Seance[], t: number): Record<Muscle, number> {
  const n = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>;
  for (const s of seances) {
    if (Date.parse(s.debut) <= t - 28 * JOUR) continue;
    for (const x of s.exercices) {
      const dures = x.series.filter(serieDure).length;
      if (!dures) continue;
      const { principaux, secondaires } = exercice(x.exo).muscles;
      for (const m of principaux) n[m] += dures;
      for (const m of secondaires) n[m] += dures / 2;
    }
  }
  for (const m of MUSCLES) n[m] = scoreGroupe(n[m] / 4);
  return n;
}

/** Score d'un groupe : séries dures par semaine, plafond à 10. */
const scoreGroupe = (parSemaine: number) => Math.min(parSemaine, 10) * 10;

/** Ce que donnerait un programme suivi en entier (docs/stats.md, « Aperçu d'un programme »). */
export interface Apercu {
  /** Séances par semaine : les jours non optionnels, une rotation par semaine. */
  seances: number;
  groupes: Record<Muscle, number>;
  endurance: number;
  /** Séries de 6 reps au plus sur un exo de Force, par semaine. */
  lourdes: number;
}

/**
 * Groupes et Endurance avec les formules de `stats`, en supposant une rotation par semaine,
 * postes obligatoires seulement, toutes les séries dures ; moyenne des semaines du programme.
 * La Force dépend des charges : pas de chiffre, seulement le nombre de séries lourdes.
 */
export function apercu(p: Programme): Apercu {
  const jours = p.jours.filter((j) => !j.optionnel);
  const n = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>;
  let lourdes = 0;
  for (const sem of p.semaines) {
    for (const j of jours) {
      for (const poste of j.exercices) {
        if (poste.optionnel) continue;
        const x = poste.prescription;
        const [series, reps] = x.type === "pct1rm" ? [sem.schemas[x.schema].series, sem.schemas[x.schema].reps]
          : x.type === "fourchette" ? [x.series, x.repsMax]
          : x.type === "rpe" ? [x.series, x.reps]
          : [x.series, Infinity];
        for (const id of membres(poste)) {
          const e = exercice(id);
          for (const m of e.muscles.principaux) n[m] += series;
          for (const m of e.muscles.secondaires) n[m] += series / 2;
          if (e.force && reps <= 6) lourdes += series;
        }
      }
    }
  }
  const semaines = p.semaines.length;
  for (const m of MUSCLES) n[m] = scoreGroupe(n[m] / semaines);
  return {
    seances: jours.length,
    groupes: n,
    endurance: MUSCLES.reduce((s, m) => s + n[m], 0) / MUSCLES.length,
    lourdes: lourdes / semaines,
  };
}

/** Séances par tranche de 7 jours pour qu'elle compte : moitié des jours non optionnels, sans programme 2. */
export const seuilConstance = (p: Programme | undefined) =>
  p ? Math.ceil(p.jours.filter((j) => !j.optionnel).length / 2) : 2;

/** Part des 8 dernières tranches de 7 jours glissants qui atteignent le seuil. */
function constance(seances: Seance[], t: number, seuil: number): number {
  const parTranche = new Array<number>(8).fill(0);
  for (const s of seances) {
    const k = Math.floor((t - Date.parse(s.debut)) / (7 * JOUR));
    if (k >= 0 && k < 8) parTranche[k]++;
  }
  return (100 * parTranche.filter((c) => c >= seuil).length) / 8;
}

/** Seuil de progrès : en dessous de +1 %, l'exo stagne. */
export const monte = (p: Progres) => p.avant !== undefined && p.actuel >= p.avant * 1.01;

/**
 * Meilleur 1RM estimé de chaque exo sur ses séries dures de 15 reps au plus (on compare un exo à lui-même), dans les 14 derniers
 * jours et entre 28 et 42 jours. Corps compté sur les exos au poids du corps (pesée de la série) ;
 * ceux-ci sont ignorés sans pesée, les distances toujours. Exos faits récemment seulement, par nom.
 */
export function progres(seances: Seance[], pesees: Pesee[], maintenant: Date): Progres[] {
  const t = maintenant.getTime();
  const tries = [...pesees].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const recent = new Map<string, number>();
  const ancien = new Map<string, number>();
  for (const s of jusqua(seances, t)) {
    for (const x of s.exercices) {
      const e = exercice(x.exo);
      if (e.charge === "distance") continue;
      for (const v of x.series) {
        if (!serieDure(v) || v.reps < 1 || v.reps > 15) continue;
        const quand = Date.parse(v.a ?? s.debut);
        const age = (t - quand) / JOUR;
        const fenetre = age <= 14 ? recent : age > 28 && age <= 42 ? ancien : undefined;
        if (!fenetre) continue;
        const corps = e.charge === "poids-corps-leste" || e.charge === "poids-corps" ? poidsA(tries, quand) : 0;
        if (corps === undefined) continue;
        const val = e1rmSerie(v.kg + corps, v.reps, v.rir ?? 0);
        if (val > (fenetre.get(e.id) ?? 0)) fenetre.set(e.id, val);
      }
    }
  }
  return [...recent]
    .map(([exo, actuel]) => ({ exo, actuel, avant: ancien.get(exo) }))
    .sort((a, b) => exercice(a.exo).nom.localeCompare(exercice(b.exo).nom));
}

function progression(p: Progres[]): number | undefined {
  const comparables = p.filter((x) => x.avant !== undefined);
  return comparables.length ? (100 * comparables.filter(monte).length) / comparables.length : undefined;
}

export function stats(seances: Seance[], pesees: Pesee[], sexe: Sexe, seuil: number, maintenant: Date): Stats {
  const t = maintenant.getTime();
  const faites = jusqua(seances, t);
  const g = groupes(faites, t);
  return {
    force: force(faites, pesees, sexe, t),
    groupes: g,
    endurance: MUSCLES.reduce((s, m) => s + g[m], 0) / MUSCLES.length,
    constance: constance(faites, t, seuil),
    progression: progression(progres(faites, pesees, maintenant)),
  };
}
