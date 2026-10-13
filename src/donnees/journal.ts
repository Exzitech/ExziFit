import { stockage } from "../stockage";
import type { Exercice } from "./exercices";
import { cheminJournal, ecrireJson, FORMAT, lireJson } from "./fichier";

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

export interface Seance {
  debut: string;
  fin?: string;
  bloc?: string;
  semaine?: number;
  jour?: string;
  exercices: ExoFait[];
}

interface Journal {
  format: number;
  seances: Seance[];
}

interface EnCours {
  format: number;
  seance: Seance | null;
}

const EN_COURS = "en-cours.json";

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
