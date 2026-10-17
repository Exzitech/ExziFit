import { t } from "../i18n";
import { stockage } from "../stockage";

/** Version du format des fichiers de données (docs/modele-donnees.md, principe 3). */
export const FORMAT = 1;

/** Contrôle `format` ; un fichier sans numéro ou d'une autre version n'est jamais lu en devinant. */
export function verifierFormat<T extends { format: number }>(chemin: string, donnees: unknown): T {
  if (typeof donnees !== "object" || donnees === null || !("format" in donnees)) {
    throw new Error(`${chemin} : champ "format" absent`);
  }
  const f = (donnees as { format: unknown }).format;
  if (f === FORMAT) return donnees as T;
  if (typeof f === "number" && f > FORMAT) {
    throw new Error(`${chemin} : format ${f}, écrit par une version plus récente d'ExziFit`);
  }
  throw new Error(`${chemin} : format ${JSON.stringify(f)} inconnu`);
}

/** Lit un fichier JSON du modèle ; `vide()` s'il n'existe pas encore. */
export async function lireJson<T extends { format: number }>(chemin: string, vide: () => T): Promise<T> {
  const texte = await stockage.lire(chemin);
  if (texte === null) return vide();
  let donnees: unknown;
  try {
    donnees = JSON.parse(texte);
  } catch (e) {
    throw new Error(`${chemin} illisible : ${(e as Error).message}`);
  }
  return verifierFormat<T>(chemin, donnees);
}

/** JSON indenté, relisible et corrigeable à la main. */
export const texteJson = (donnees: unknown) => JSON.stringify(donnees, null, 2) + "\n";

let surEcriture: (chemin: string) => void = () => {};
/** Appelé après chaque écriture de l'app (la synchro s'y abonne ; ses propres écritures n'y passent pas). */
export const quandEcrit = (f: (chemin: string) => void) => { surEcriture = f; };

export async function ecrireJson(chemin: string, donnees: { format: number }): Promise<void> {
  await stockage.ecrire(chemin, texteJson(donnees));
  surEcriture(chemin);
}

const deux = (n: number) => String(n).padStart(2, "0");

/** `2026-10-13`, date locale. */
export function jourLocal(d: Date): string {
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
}

/** Fichier du journal du mois (local) de `d` : `journal/2026-10.json`. */
export function cheminJournal(d: Date): string {
  return `journal/${jourLocal(d).slice(0, 7)}.json`;
}

/** ISO 8601 local avec fuseau, à la seconde : `2026-10-14T18:02:11+02:00`. */
export function horodatage(d: Date): string {
  const decalage = -d.getTimezoneOffset();
  const signe = decalage >= 0 ? "+" : "-";
  const abs = Math.abs(decalage);
  return (
    `${jourLocal(d)}T${deux(d.getHours())}:${deux(d.getMinutes())}:${deux(d.getSeconds())}` +
    `${signe}${deux(Math.floor(abs / 60))}:${deux(abs % 60)}`
  );
}

/** Ce qu'un export contient, montré avant de remplacer les données. Erreur si ce n'en est pas un. */
export function resumerExport(texte: string): { jour: string; seances: number; prenom?: string } {
  let paquet: { format?: unknown; jour?: unknown; fichiers?: Record<string, string> };
  try {
    paquet = JSON.parse(texte);
  } catch {
    throw new Error(t.fichier.pasExport);
  }
  if (paquet?.format !== FORMAT || typeof paquet.fichiers !== "object" || paquet.fichiers === null) {
    throw new Error(t.fichier.illisible);
  }
  const lire = (chemin: string) => JSON.parse(paquet.fichiers![chemin]);
  const seances = Object.keys(paquet.fichiers)
    .filter((c) => c.startsWith("journal/"))
    .reduce((n, c) => n + (lire(c).seances?.length ?? 0), 0);
  const prenom = "reglages.json" in paquet.fichiers ? lire("reglages.json").prenom : undefined;
  return { jour: String(paquet.jour ?? "?"), seances, prenom };
}
