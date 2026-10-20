/**
 * Illustrations des exos (README, « Illustrations des exos ») : deux images par exo, départ et fin,
 * embarquées dans l'app (hors ligne). Générées par `node scripts/illustrations.mjs` depuis
 * `src/illustrations/sources.json`. Exo absent (perso, ou sans image libre) : pas d'illustration.
 */

import sources from "../illustrations/sources.json";

/** `trait` : dessin Everkinetic noir sur blanc, recoloré par le thème ; `photo` : free-exercise-db, telle quelle. */
export type Style = "trait" | "photo";

export interface Illustration { depart: string; fin: string; style: Style }

const fichiers = import.meta.glob<string>("../illustrations/*.webp", { eager: true, query: "?url", import: "default" });
/** id d'exo → [source, clé chez la source]. */
const SOURCES: Record<string, string[]> = sources;

export function illustration(id: string): Illustration | undefined {
  const s = SOURCES[id];
  if (!s) return undefined;
  const depart = fichiers[`../illustrations/${id}-1.webp`], fin = fichiers[`../illustrations/${id}-2.webp`];
  if (!depart || !fin) throw new Error(`Illustration de « ${id} » listée mais pas générée (node scripts/illustrations.mjs).`);
  return { depart, fin, style: s[0] === "fedb" ? "photo" : "trait" };
}
