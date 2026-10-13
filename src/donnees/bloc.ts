import { ecrireJson, FORMAT, lireJson } from "./fichier";

/** Types de `blocs.json` et `poids.json` (docs/modele-donnees.md, « Bloc » et « Fichiers »). */
export interface Bloc {
  id: string;
  programme: string;
  debut: string;
  fin: string | null;
  /** 1RM figés au début du bloc, ou déduits de la série de calibration. Lesté : corps + lest. */
  rm: Record<string, number>;
}

interface Blocs { format: number; blocs: Bloc[] }
interface Poids { format: number; pesees: { date: string; kg: number }[] }

const BLOCS = "blocs.json";
const POIDS = "poids.json";

export async function lireBlocs(): Promise<Bloc[]> {
  return (await lireJson<Blocs>(BLOCS, () => ({ format: FORMAT, blocs: [] }))).blocs;
}

export const ecrireBlocs = (blocs: Bloc[]) => ecrireJson(BLOCS, { format: FORMAT, blocs } as Blocs);

/** Dernière pesée, `undefined` s'il n'y en a pas. */
export async function lirePoidsCorps(): Promise<number | undefined> {
  const p = await lireJson<Poids>(POIDS, () => ({ format: FORMAT, pesees: [] }));
  return p.pesees[p.pesees.length - 1]?.kg;
}

/** Ajoute une pesée ; une seule par jour (la nouvelle remplace celle du jour). */
export async function noterPoidsCorps(date: string, kg: number): Promise<void> {
  const p = await lireJson<Poids>(POIDS, () => ({ format: FORMAT, pesees: [] }));
  p.pesees = [...p.pesees.filter((x) => x.date !== date), { date, kg }];
  await ecrireJson(POIDS, p);
}
