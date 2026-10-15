import { stockage } from "../stockage";
import { exercice, type Exercice } from "./exercices";
import { cheminJournal, ecrireJson, FORMAT, horodatage, lireJson } from "./fichier";

/** Types du journal (docs/modele-donnees.md, « Séance faite »). */
export interface Serie {
  type: "echauffement" | "travail";
  kg: number;
  reps: number;
  rir?: number;
  /** Ce que l'app avait proposé. */
  prevu?: { kg: number; reps: number };
  a?: string;
  /** Tentative du test de 1RM / 3RM de fin de bloc (semaine de test). */
  test?: true;
}

export interface ExoFait {
  exo: string;
  remplace?: string;
  series: Serie[];
}

/** Poste d'un autre jour ajouté à la séance : `poste` = rang dans `jours[].exercices`. */
export interface Rattrapage { jour: string; poste: number }

export interface Seance {
  debut: string;
  fin?: string;
  bloc?: string;
  /** Programme du jour `jour` ; absent (avant 0.1.30) = le Bloc Force. */
  programme?: string;
  semaine?: number;
  jour?: string;
  /** Salle (salles.json) : ses réglages de machine s'appliquent aux charges notées. */
  salle?: string;
  /**
   * Avant les salles (jusqu'à 0.1.25) : poulie double, la charge notée était la charge réelle et la
   * pile affichait 2 × la charge notée. Plus écrit depuis.
   */
  poulie?: 2;
  /** Dernière correction dans le Journal (synchro : la version la plus récente gagne). */
  modifie?: string;
  /** Postes sautés d'une séance récente, refaits en fin de celle-ci. */
  rattrapage?: Rattrapage[];
  exercices: ExoFait[];
}

export interface Journal {
  format: number;
  seances: Seance[];
}

interface EnCours {
  format: number;
  seance: Seance | null;
}

const EN_COURS = "en-cours.json";

/**
 * Multiplicateur d'affichage : sur une poulie double, la pile affiche le double de la charge
 * effective, seule notée au journal (les calculs comparent ainsi les salles entre elles).
 */
export const facteurPoulie = (s: Seance, e: Exercice) => (e.charge === "poulie" ? s.poulie ?? 1 : 1);

/** Montage de la dernière séance qui a eu un exo à la poulie : `{ poulie: 2 }` ou `{}`. */
export function poulieRetenue(passees: Seance[]): { poulie?: 2 } {
  for (let i = passees.length - 1; i >= 0; i--) {
    if (passees[i].exercices.some((x) => exercice(x.exo).charge === "poulie")) return passees[i].poulie ? { poulie: 2 } : {};
  }
  return {};
}

/** Toutes les séances terminées, de la plus ancienne à la plus récente. */
export async function lireSeances(): Promise<Seance[]> {
  const mois = (await stockage.lister("journal")).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).sort();
  const journaux = await Promise.all(
    mois.map((f) => lireJson<Journal>(`journal/${f}`, () => ({ format: FORMAT, seances: [] }))),
  );
  return journaux.flatMap((j) => j.seances);
}

/** Ajoute une séance terminée au journal du mois de son début. */
export async function archiverSeance(s: Seance): Promise<void> {
  const chemin = cheminJournal(new Date(s.debut));
  const j = await lireJson<Journal>(chemin, () => ({ format: FORMAT, seances: [] }));
  j.seances.push(s);
  await ecrireJson(chemin, j);
}

/** Séance interrompue (app tuée en pleine séance), `null` s'il n'y en a pas. */
export async function lireEnCours(): Promise<Seance | null> {
  return (await lireJson<EnCours>(EN_COURS, () => ({ format: FORMAT, seance: null }))).seance;
}

export const ecrireEnCours = (seance: Seance) => ecrireJson(EN_COURS, { format: FORMAT, seance } as EnCours);
export const supprimerEnCours = () => stockage.supprimer(EN_COURS);

const travail = (s: Seance, exo: string) =>
  s.exercices.filter((e) => e.exo === exo).flatMap((e) => e.series).filter((x) => x.type === "travail");

/** Séances passées où l'exo a été travaillé, de la plus récente à la plus ancienne. */
export function historique(seances: Seance[], exo: string, n: number): { debut: string; series: Serie[] }[] {
  const res: { debut: string; series: Serie[] }[] = [];
  for (let i = seances.length - 1; i >= 0 && res.length < n; i--) {
    const series = travail(seances[i], exo);
    if (series.length) res.push({ debut: seances[i].debut, series });
  }
  return res;
}

/**
 * Charge et reps préremplies : la série précédente du jour sur cet exo ; sinon la 1re série de
 * la dernière séance où il a été fait (la dernière série d'une séance est souvent une série
 * dégradée) ; sinon une barre vide, ou 0 kg, × 8.
 */
export function proposition(passees: Seance[], enCours: Seance, e: Exercice): { kg: number; reps: number } {
  const aujourdhui = travail(enCours, e.id);
  const derniere = aujourdhui[aujourdhui.length - 1] ?? historique(passees, e.id, 1)[0]?.series[0];
  if (derniere) return { kg: derniere.kg, reps: derniere.reps };
  return { kg: e.charge === "barre" ? 20 : 0, reps: 8 };
}

/** Ajuste une charge d'un pas, arrondie au pas, jamais négative. */
export function ajusterKg(kg: number, pas: number, sens: 1 | -1): number {
  const v = Math.round((kg + sens * pas) / pas) * pas;
  return Math.max(0, Math.round(v * 100) / 100);
}

/**
 * Journal après correction : la séance commencée à `debut` remplacée par `nouvelle`, ou retirée
 * si `nouvelle` est `null` ou n'a plus de série. `debut` (à la seconde) identifie la séance.
 */
export function corrigerListe(seances: Seance[], debut: string, nouvelle: Seance | null): Seance[] {
  const i = seances.findIndex((s) => s.debut === debut);
  if (i < 0) throw new Error(`séance du ${debut} introuvable dans le journal`);
  const garde = nouvelle && { ...nouvelle, exercices: nouvelle.exercices.filter((x) => x.series.length) };
  return garde?.exercices.length
    ? seances.map((s, j) => (j === i ? garde : s))
    : seances.filter((_, j) => j !== i);
}

interface Corbeille {
  format: number;
  /** Versions remplacées ou supprimées, à recopier à la main dans le journal pour annuler. */
  seances: { le: string; seance: Seance }[];
}

const CORBEILLE = "corbeille.json";

/**
 * Corrige ou supprime (`nouvelle` = `null`) une séance terminée. L'ancienne version est d'abord
 * ajoutée à `corbeille.json` : une erreur de doigt ne détruit jamais une séance.
 */
export async function corrigerSeance(debut: string, nouvelle: Seance | null): Promise<void> {
  const chemin = cheminJournal(new Date(debut));
  const j = await lireJson<Journal>(chemin, () => ({ format: FORMAT, seances: [] }));
  const ancienne = j.seances.find((s) => s.debut === debut);
  const le = horodatage(new Date());
  const seances = corrigerListe(j.seances, debut, nouvelle && { ...nouvelle, modifie: le });
  await mettreALaCorbeille([ancienne as Seance], le);
  // Supprimée : notée, pour que la synchro la retire aussi des autres appareils.
  if (!seances.some((s) => s.debut === debut)) await noterSuppression({ debut, le });
  await ecrireJson(chemin, { ...j, seances } as Journal);
}

export async function mettreALaCorbeille(anciennes: Seance[], le: string): Promise<void> {
  const c = await lireJson<Corbeille>(CORBEILLE, () => ({ format: FORMAT, seances: [] }));
  c.seances.push(...anciennes.map((seance) => ({ le, seance })));
  await ecrireJson(CORBEILLE, c);
}

/** Séance supprimée : `debut` l'identifie, `le` date la suppression. */
export interface Suppression { debut: string; le: string }
export interface Suppressions { format: number; seances: Suppression[] }
export const SUPPRESSIONS = "suppressions.json";

export const lireSuppressions = async () =>
  (await lireJson<Suppressions>(SUPPRESSIONS, () => ({ format: FORMAT, seances: [] }))).seances;

async function noterSuppression(x: Suppression): Promise<void> {
  const deja = (await lireSuppressions()).filter((y) => y.debut !== x.debut);
  await ecrireJson(SUPPRESSIONS, { format: FORMAT, seances: [...deja, x] } as Suppressions);
}
