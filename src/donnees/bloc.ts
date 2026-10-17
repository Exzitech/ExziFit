import { dater, ecrireJson, FORMAT, horodatage, lireJson } from "./fichier";
import type { Pesee } from "./stats";

/** Types de `blocs.json` et `poids.json` (docs/modele-donnees.md, « Bloc » et « Fichiers »). */
export interface Bloc {
  id: string;
  programme: string;
  debut: string;
  fin: string | null;
  /** 1RM figés au début du bloc, ou déduits de la série de calibration. Lesté : corps + lest. */
  rm: Record<string, number>;
  /** Dernier changement (synchro : le plus récent gagne), posé par `ecrireBlocs`. */
  modifie?: string;
}

export interface Blocs { format: number; blocs: Bloc[] }
export interface Poids { format: number; pesees: Pesee[] }

export const BLOCS = "blocs.json";
export const POIDS = "poids.json";

export async function lireBlocs(): Promise<Bloc[]> {
  return (await lireJson<Blocs>(BLOCS, () => ({ format: FORMAT, blocs: [] }))).blocs;
}

/** Écrit la liste ; un bloc nouveau ou changé reçoit l'instant présent (`dater`). */
export async function ecrireBlocs(blocs: Bloc[]): Promise<void> {
  await ecrireJson(BLOCS, { format: FORMAT, blocs: dater(await lireBlocs(), blocs, new Date()) } as Blocs);
}

/** Toutes les pesées, dans l'ordre d'écriture (la dernière notée en dernier). */
export async function lirePesees(): Promise<Pesee[]> {
  return (await lireJson<Poids>(POIDS, () => ({ format: FORMAT, pesees: [] }))).pesees;
}

/** Ajoute une pesée ; une seule par jour (la nouvelle remplace celle du jour). */
export async function noterPoidsCorps(date: string, kg: number): Promise<void> {
  const p = await lireJson<Poids>(POIDS, () => ({ format: FORMAT, pesees: [] }));
  p.pesees = [...p.pesees.filter((x) => x.date !== date), { date, kg, le: horodatage(new Date()) }];
  await ecrireJson(POIDS, p);
}
