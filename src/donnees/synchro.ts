import { stockage } from "../stockage";
import { BLOCS, lireBlocs, lirePesees, POIDS, type Bloc } from "./bloc";
import { cheminJournal, FORMAT, horodatage, texteJson, verifierFormat } from "./fichier";
import { lireSeances, lireSuppressions, mettreALaCorbeille, SUPPRESSIONS, type Seance, type Suppression } from "./journal";
import type { Pesee } from "./stats";

/**
 * Synchro PC ↔ téléphone (docs/modele-donnees.md, « Synchro ») : `etat.json` dans le dossier
 * Nextcloud privé `ExziFit-sync` contient tout ce qui se synchronise. Chaque appareil le lit, le
 * fusionne avec ses fichiers, écrit chez lui ce qui a changé (après une copie horodatée), puis
 * renvoie la fusion si elle diffère. Pas synchronisés : la séance en cours, la corbeille, les
 * réglages (thème propre à chaque appareil).
 */
export interface Etat {
  format: number;
  seances: Seance[];
  suppressions: Suppression[];
  blocs: Bloc[];
  pesees: Pesee[];
}

const VIDE: Etat = { format: FORMAT, seances: [], suppressions: [], blocs: [], pesees: [] };

/** Fichiers qui entrent dans `etat.json` : une écriture de l'app sur l'un d'eux appelle une synchro. */
export const estSynchronise = (chemin: string) =>
  chemin.startsWith("journal/") || [BLOCS, POIDS, SUPPRESSIONS].includes(chemin);

const t = (iso?: string | null) => (iso ? Date.parse(iso) : 0);
/**
 * Une séance corrigée l'emporte toujours sur une jamais corrigée (les horloges des deux appareils
 * peuvent différer : comparer une correction à une fin de séance n'aurait pas de sens) ; entre deux
 * corrections, la plus récente. Jamais corrigée : 0, les deux copies sont identiques.
 */
const CORRIGEE = 1e15;
const versionSeance = (s: Seance) => (s.modifie ? CORRIGEE + t(s.modifie) : 0);

/**
 * Par clé, la version la plus récente. À égalité de date, le texte le plus grand : arbitraire mais
 * identique sur les deux appareils, qui convergent donc vers le même état.
 */
function recents<T>(a: T[], b: T[], cle: (x: T) => string, version: (x: T) => number): T[] {
  const m = new Map<string, T>();
  for (const x of [...a, ...b]) {
    const y = m.get(cle(x));
    const d = y === undefined ? 1 : version(x) - version(y);
    if (d > 0 || (d === 0 && JSON.stringify(x) > JSON.stringify(y))) m.set(cle(x), x);
  }
  return [...m.values()];
}

/** Tri chronologique sur une date ISO, puis sur le texte (deux dates égales à des fuseaux différents). */
const chrono = <T>(f: (x: T) => string) => (x: T, y: T) =>
  t(f(x)) - t(f(y)) || (f(x) < f(y) ? -1 : f(x) > f(y) ? 1 : 0);

/**
 * Fusion de deux états, symétrique : séances par `debut` (la version la plus récente gagne), une
 * suppression retire la séance sauf si celle-ci a été corrigée après ; blocs par `id` (`modifie`),
 * pesées par jour (`le`). Rien n'est perdu sans trace : ce qu'une fusion remplace localement va
 * à la corbeille.
 */
export function fusionner(a: Etat, b: Etat): Etat {
  const suppressions = recents(a.suppressions, b.suppressions, (x) => x.debut, (x) => t(x.le)).sort(chrono((x) => x.debut));
  // Une suppression retire la séance, sauf si celle-ci a été corrigée après (même échelle que versionSeance).
  const sup = new Map(suppressions.map((x) => [x.debut, CORRIGEE + t(x.le)]));
  const seances = recents(a.seances, b.seances, (s) => s.debut, versionSeance)
    .filter((s) => !((sup.get(s.debut) ?? -1) >= versionSeance(s)))
    .sort(chrono((s) => s.debut));
  const blocs = recents(a.blocs, b.blocs, (x) => x.id, (x) => t(x.modifie))
    .sort((x, y) => chrono((z: Bloc) => z.debut)(x, y) || (x.id < y.id ? -1 : 1));
  const pesees = recents(a.pesees, b.pesees, (x) => x.date, (x) => t(x.le)).sort(chrono((x) => x.date));
  return { format: FORMAT, seances, suppressions, blocs, pesees };
}

const egal = (a: Etat, b: Etat) => JSON.stringify(a) === JSON.stringify(b);
/** Forme canonique (triée, dédoublonnée) d'un état lu tel quel. */
const canonique = (e: Etat) => fusionner(e, VIDE);

function lireDistant(texte: string): Etat {
  let d: unknown;
  try {
    d = JSON.parse(texte);
  } catch (e) {
    throw new Error(`etat.json (Nextcloud) illisible : ${(e as Error).message}`);
  }
  const e = verifierFormat<Etat>("etat.json (Nextcloud)", d);
  for (const k of ["seances", "suppressions", "blocs", "pesees"] as const) {
    if (!Array.isArray(e[k])) throw new Error(`etat.json (Nextcloud) : « ${k} » n'est pas une liste`);
  }
  return e;
}

async function etatLocal(): Promise<Etat> {
  const [seances, suppressions, blocs, pesees] = await Promise.all([lireSeances(), lireSuppressions(), lireBlocs(), lirePesees()]);
  return { format: FORMAT, seances, suppressions, blocs, pesees };
}

const deux = (n: number) => String(n).padStart(2, "0");
const instant = (d: Date) =>
  `${d.getFullYear()}${deux(d.getMonth() + 1)}${deux(d.getDate())}-${deux(d.getHours())}${deux(d.getMinutes())}${deux(d.getSeconds())}`;

const parMois = (l: Seance[]) => {
  const m = new Map<string, Seance[]>();
  for (const s of l) {
    const c = cheminJournal(new Date(s.debut));
    m.set(c, [...(m.get(c) ?? []), s]);
  }
  return m;
};

/**
 * Écrit chez soi ce que la fusion change : copie horodatée de tout le dossier d'abord, séances
 * remplacées ou retirées à la corbeille, puis seuls les fichiers dont le contenu change.
 */
async function appliquer(local: Etat, fusion: Etat): Promise<void> {
  await stockage.sauvegardeSynchro(instant(new Date()));
  const nouv = new Map(fusion.seances.map((s) => [s.debut, JSON.stringify(s)]));
  const perdues = local.seances.filter((s) => nouv.get(s.debut) !== JSON.stringify(s));
  if (perdues.length) await mettreALaCorbeille(perdues, horodatage(new Date()));

  const [avant, apres] = [parMois(local.seances), parMois(fusion.seances)];
  for (const chemin of new Set([...avant.keys(), ...apres.keys()])) {
    const l = apres.get(chemin) ?? [];
    if (JSON.stringify(l) !== JSON.stringify(avant.get(chemin) ?? [])) {
      await stockage.ecrire(chemin, texteJson({ format: FORMAT, seances: l }));
    }
  }
  const fichiers = [
    [BLOCS, { format: FORMAT, blocs: fusion.blocs }, local.blocs, fusion.blocs],
    [POIDS, { format: FORMAT, pesees: fusion.pesees }, local.pesees, fusion.pesees],
    [SUPPRESSIONS, { format: FORMAT, seances: fusion.suppressions }, local.suppressions, fusion.suppressions],
  ] as const;
  for (const [chemin, contenu, a, b] of fichiers) {
    if (JSON.stringify(a) !== JSON.stringify(b)) await stockage.ecrire(chemin, texteJson(contenu));
  }
}

export type Bilan =
  | { etat: "non-configure" }
  | { etat: "hors-ligne" }
  /** `recues` : des données d'un autre appareil sont arrivées (les écrans doivent relire). */
  | { etat: "ok"; recues: boolean; envoyees: boolean; le: Date };

async function faire(essai: number): Promise<Bilan> {
  const lu = await stockage.synchroLire();
  if (lu.etat === "non-configure" || lu.etat === "hors-ligne") return { etat: lu.etat };
  const distant = lu.etat === "ok" ? lireDistant(lu.texte) : VIDE;
  const local = await etatLocal();
  const fusion = fusionner(local, distant);
  const recues = !egal(canonique(local), fusion);
  if (recues) await appliquer(local, fusion);
  let envoyees = false;
  if (lu.etat === "absent" || !egal(canonique(distant), fusion)) {
    const r = await stockage.synchroEcrire(texteJson(fusion), lu.etat === "ok" ? lu.etag : null);
    if (r.etat === "hors-ligne") return r;
    if (r.etat === "conflit") {
      // Un autre appareil a écrit entre-temps : on relit et on refusionne (ce qui est déjà appliqué reste valable).
      if (essai >= 3) throw new Error("synchro : etat.json change sans arrêt sur Nextcloud, nouvel essai plus tard");
      const b = await faire(essai + 1);
      return b.etat === "ok" ? { ...b, recues: b.recues || recues } : b;
    }
    envoyees = true;
  }
  return { etat: "ok", recues, envoyees, le: new Date() };
}

let enCours: Promise<Bilan> | null = null;
let suivante: Promise<Bilan> | null = null;

/**
 * Une seule synchro à la fois. Une demande pendant qu'une tourne (écriture faite entre-temps)
 * reçoit une relance à la suite, partagée par toutes les demandes du moment.
 */
export function synchroniser(): Promise<Bilan> {
  if (!enCours) {
    enCours = faire(0).finally(() => { enCours = null; });
    return enCours;
  }
  // L'échec de la synchro en cours est déjà remis à son appelant ; ici, il ne fait qu'attendre sa fin.
  suivante ??= enCours.catch(() => undefined).then(() => {
    suivante = null;
    return synchroniser();
  });
  return suivante;
}
