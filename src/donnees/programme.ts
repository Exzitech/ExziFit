import { EXERCICES, exercice, type Exercice, type Muscle } from "./exercices";
import { historique, type Rattrapage, type Seance, type Serie } from "./journal";
import blocForce from "./programmes/bloc-force.json";

/** Types du programme (docs/modele-donnees.md, « Programme »). */
export type Prescription =
  | { type: "pct1rm"; schema: string }
  | { type: "fourchette"; series: number; repsMin: number; repsMax: number; rir?: number }
  | { type: "rpe"; series: number; reps: number; rpe: number }
  | { type: "distance"; series: number; metres: number };

export interface Schema { series: number; reps: number; pct: number[] }

export interface Semaine {
  nom: string;
  label: string;
  schemas: Record<string, Schema>;
  test?: Record<string, number>;
}

/** Une ligne d'un jour : un exercice, ou un superset de plusieurs. */
export interface Poste {
  exo?: string;
  superset?: string[];
  role?: "principal";
  prescription: Prescription;
  repos: number;
  optionnel?: boolean;
  note?: string;
  alternatives?: string[];
}

export interface Jour {
  id: string;
  nom: string;
  objectif: string;
  lourd: boolean;
  optionnel?: boolean;
  note?: string;
  exercices: Poste[];
}

export interface Programme {
  id: string;
  nom: string;
  semaines: Semaine[];
  jours: Jour[];
  regles: ({ type: "ecart"; exos: string[]; heures: number } | { type: "max-lourds-consecutifs"; jours: number })[];
  notes: string[];
}

/**
 * Programme en cours, dans le code tant qu'il n'y a pas d'éditeur (le modèle prévoit
 * `programmes.json` le jour où Tom en écrit un depuis l'app).
 */
export const PROGRAMME = (blocForce as unknown as { programmes: Programme[] }).programmes[0];

export const membres = (p: Poste): string[] => p.superset ?? [p.exo as string];

/** Exos dont la charge se calcule en % du 1RM du bloc : ceux dont le 1RM se saisit. */
export const exosPct1rm = (p: Programme): string[] => [
  ...new Set(p.jours.flatMap((j) => j.exercices.filter((x) => x.prescription.type === "pct1rm").flatMap(membres))),
];

const JOUR_MS = 86_400_000;
const jourDe = (iso: string) => Math.floor((Date.parse(iso.slice(0, 10)) + 12 * 3_600_000) / JOUR_MS);

/**
 * Jour et semaine proposés : le jour qui suit la dernière séance du bloc. Un jour optionnel est
 * sauté quand les séances lourdes s'enchaînent sur `max-lourds-consecutifs` jours de calendrier
 * jusqu'à hier ou aujourd'hui.
 */
export function prochainJour(p: Programme, seances: Seance[], bloc: string, maintenant: Date): number {
  const duBloc = seances.filter((s) => s.bloc === bloc && s.jour);
  const derniere = duBloc[duBloc.length - 1];
  if (!derniere) return 0;
  let i = (p.jours.findIndex((j) => j.id === derniere.jour) + 1) % p.jours.length;
  const max = p.regles.find((r) => r.type === "max-lourds-consecutifs");
  if (p.jours[i].optionnel && max && lourdsDAffilee(p, duBloc, maintenant) >= max.jours) {
    i = (i + 1) % p.jours.length;
  }
  return i;
}

function lourdsDAffilee(p: Programme, seances: Seance[], maintenant: Date): number {
  const lourds = new Set(
    seances.filter((s) => p.jours.find((j) => j.id === s.jour)?.lourd).map((s) => jourDe(s.debut)),
  );
  // Fuseau local : `maintenant` en date locale, comme les horodatages du journal.
  const local = new Date(maintenant.getTime() - maintenant.getTimezoneOffset() * 60_000).toISOString();
  let d = jourDe(local);
  if (!lourds.has(d)) d--;
  let n = 0;
  while (lourds.has(d - n)) n++;
  return n;
}

/**
 * Semaine de la séance qui commence par le jour `jour` : celle de la dernière séance du bloc,
 * plus une si la rotation a fait le tour (jour choisi pas après le dernier fait).
 */
export function semaineDe(p: Programme, seances: Seance[], bloc: string, jour: number): number {
  const duBloc = seances.filter((s) => s.bloc === bloc && s.jour);
  const derniere = duBloc[duBloc.length - 1];
  if (!derniere) return 0;
  const sem = derniere.semaine ?? 0;
  const tour = jour <= p.jours.findIndex((j) => j.id === derniere.jour);
  return Math.min(sem + (tour ? 1 : 0), p.semaines.length - 1);
}

/**
 * Fin de bloc : la dernière séance du bloc est en dernière semaine et le jour choisi relance la
 * rotation. Le jour choisi ouvre alors un nouveau bloc (`rmNouveauBloc`).
 */
export function blocFini(p: Programme, seances: Seance[], bloc: string, jour: number): boolean {
  const duBloc = seances.filter((s) => s.bloc === bloc && s.jour);
  const derniere = duBloc[duBloc.length - 1];
  if (!derniere) return false;
  return (derniere.semaine ?? 0) >= p.semaines.length - 1 && jour <= p.jours.findIndex((j) => j.id === derniere.jour);
}

/**
 * Règles `ecart` touchées par un jour : un exo du jour dont un autre exo de la règle a été fait
 * depuis moins de `heures`. Avertissements seulement, rien n'est bloqué (décidé le 2026-10-13).
 */
export function avertissements(p: Programme, jour: Jour, seances: Seance[], maintenant: Date): string[] {
  const duJour = new Set(jour.exercices.flatMap(membres));
  const res: string[] = [];
  for (const r of p.regles) {
    if (r.type !== "ecart") continue;
    for (const x of r.exos.filter((id) => duJour.has(id))) {
      for (const y of r.exos.filter((id) => id !== x)) {
        const s = [...seances].reverse().find((s) => s.exercices.some((e) => e.exo === y && e.series.some((v) => v.type === "travail")));
        if (!s) continue;
        const h = Math.floor((maintenant.getTime() - Date.parse(s.fin ?? s.debut)) / 3_600_000);
        if (h < r.heures) res.push(`${exercice(y).nom} il y a ${h} h : ${r.heures} h conseillées avant ${exercice(x).nom}.`);
      }
    }
  }
  return res;
}

/** 1RM estimé par Epley avec la réserve. */
const travailSur = (s: Seance, id: string) =>
  s.exercices.some((x) => x.exo === id && x.series.some((v) => v.type === "travail"));

/** Membre fait dans la séance : du travail sur lui ou sur un de ses remplaçants. */
function membreFait(s: Seance, m: string): boolean {
  const vus = [m];
  for (let id = m; ; ) {
    if (travailSur(s, id)) return true;
    const r = s.exercices.find((x) => x.remplace === id);
    if (!r || vus.includes(r.exo)) return false;
    vus.push((id = r.exo));
  }
}

/** Heures depuis la dernière séance qui a travaillé `id`, `null` s'il n'a jamais été fait. */
function heuresDepuis(seances: Seance[], id: string, maintenant: Date): number | null {
  const s = [...seances].reverse().find((x) => travailSur(x, id));
  return s ? Math.floor((maintenant.getTime() - Date.parse(s.fin ?? s.debut)) / 3_600_000) : null;
}

const JAMBES: Muscle[] = ["quadriceps", "ischios", "fessiers"];
/** Repos entre deux gros mouvements de jambes qui partagent un muscle principal (squat → deadlift). */
const REPOS_JAMBES_H = 48;

/**
 * Raison de ne pas proposer `id` maintenant, `null` si rien ne s'y oppose : règle `ecart` du
 * programme, ou gros mouvement de jambes (`force`) sur un muscle commun depuis moins de 48 h.
 * `auJour` : exos de la séance prévue, comptés comme faits maintenant.
 */
export function reposManquant(p: Programme, id: string, seances: Seance[], auJour: string[], maintenant: Date): string | null {
  const e = exercice(id);
  const voisins: { y: string; heures: number }[] = [];
  for (const r of p.regles) {
    if (r.type === "ecart" && r.exos.includes(id)) voisins.push(...r.exos.filter((y) => y !== id).map((y) => ({ y, heures: r.heures })));
  }
  const jambes = e.force ? e.muscles.principaux.filter((m) => JAMBES.includes(m)) : [];
  for (const f of EXERCICES) {
    if (f.force && f.id !== id && f.muscles.principaux.some((m) => jambes.includes(m))) voisins.push({ y: f.id, heures: REPOS_JAMBES_H });
  }
  for (const { y, heures } of voisins) {
    if (auJour.includes(y)) return `${exercice(y).nom} au programme du jour : ${heures} h conseillées avec ${e.nom}.`;
    const h = heuresDepuis(seances, y, maintenant);
    if (h !== null && h < heures) return `${exercice(y).nom} il y a ${h} h : ${heures} h conseillées avant ${e.nom}.`;
  }
  return null;
}

/** Fenêtre où un poste sauté reste à rattraper : à peu près un tour de rotation. */
const RATTRAPAGE_JOURS = 8;

export interface ARattraper { r: Rattrapage; poste: Poste; bloque: string | null }

/**
 * Postes sautés (aucune série de travail) des séances du bloc des 8 derniers jours, pas refaits
 * depuis, hors jours et postes optionnels et hors exos déjà au jour prévu. `bloque` : raison de
 * repos (`reposManquant`) ; ce poste n'est pas proposé aujourd'hui mais le sera plus tard.
 */
export function aRattraper(p: Programme, seances: Seance[], bloc: string, jour: Jour, maintenant: Date): ARattraper[] {
  const auJour = jour.exercices.flatMap(membres);
  const res: ARattraper[] = [];
  const vus = new Set<string>();
  seances.forEach((s, i) => {
    if (s.bloc !== bloc || maintenant.getTime() - Date.parse(s.debut) > RATTRAPAGE_JOURS * JOUR_MS) return;
    const j = p.jours.find((x) => x.id === s.jour);
    if (!j || j.optionnel) return;
    j.exercices.forEach((poste, k) => {
      const ms = membres(poste);
      if (poste.optionnel || ms.some((m) => membreFait(s, m)) || ms.every((m) => auJour.includes(m))) return;
      if (seances.slice(i + 1).some((t) => ms.every((m) => membreFait(t, m)))) return;
      const cle = ms.join("+");
      if (vus.has(cle)) return;
      vus.add(cle);
      const bloque = ms.map((m) => reposManquant(p, m, seances, auJour, maintenant)).find((x) => x !== null) ?? null;
      res.push({ r: { jour: j.id, poste: k }, poste, bloque });
    });
  });
  return res;
}

export const epley = (kg: number, reps: number, rir = 0) => kg * (1 + (reps + rir) / 30);

/** 1RM d'une série (total) : la charge elle-même pour un single à 0 RIR, Epley avec la réserve sinon. */
export const e1rmSerie = (total: number, reps: number, rir: number) => (reps + rir === 1 ? total : epley(total, reps, rir));

export function arrondir(kg: number, pas: number): number {
  return Math.round(Math.round(kg / pas) * pas * 100) / 100;
}

export interface Cible {
  series: number;
  /** Reps visées pour la prochaine série. */
  reps: number;
  /** Charge proposée (lest seul sur un lesté) ; `null` si l'app n'a pas de quoi la calculer. */
  kg: number | null;
  /** « 80 % », « 8–10 reps », « RPE 8 », « 30 m ». */
  texte: string;
}

export interface Contexte {
  semaine: Semaine;
  /** 1RM figé du bloc pour cet exo (corps + lest sur un lesté). */
  rm?: number;
  poidsCorps?: number;
  passees: Seance[];
}

const pct = (v: number) => `${Math.round(v * 1000) / 10}`.replace(".", ",");

/** Total (corps + lest sur un lesté) → charge à afficher, arrondie au pas ; `null` sans pesée sur un lesté. */
function chargeDe(e: Exercice, total: number, poidsCorps?: number): number | null {
  if (e.charge === "poids-corps-leste") return poidsCorps === undefined ? null : Math.max(0, arrondir(total - poidsCorps, e.pas));
  return Math.max(e.charge === "barre" ? 20 : 0, arrondir(total, e.pas));
}

/** Corps ajouté à la charge pour Epley : le poids de corps sur un lesté, 0 sinon. */
const corpsDe = (e: Exercice, poidsCorps?: number) => (e.charge === "poids-corps-leste" ? poidsCorps : 0);

/**
 * Meilleur 1RM estimé d'une liste de séries (corps + lest sur un lesté), Epley avec la réserve ;
 * un single à 0 RIR vaut sa charge (Epley le gonfle de 3 %). Au-delà de 12 reps, Epley ne vaut
 * plus rien : série ignorée. Un RIR « 4+ » ou absent donne un minimum.
 */
function meilleurE1rm(e: Exercice, series: Serie[], poidsCorps?: number): number | undefined {
  const corps = corpsDe(e, poidsCorps);
  if (corps === undefined) return undefined;
  const v = series.filter((s) => s.reps >= 1 && s.reps <= 12).map((s) => e1rmSerie(s.kg + corps, s.reps, s.rir ?? 0));
  return v.length ? Math.max(...v) : undefined;
}

/**
 * 1RM sur lequel se calculent les % : celui du bloc, relevé (jamais baissé) par le 1RM estimé de
 * la dernière séance du bloc sur cet exo — la surcharge progressive suit les séries réelles, une
 * mauvaise séance ne fait pas reculer les suivantes. Sans 1RM du bloc : estimé de la dernière fois
 * où l'exo a été fait, d'où qu'elle vienne ; `undefined` si jamais fait (calibrage).
 */
export function rmEffectif(
  e: Exercice, passees: Seance[], bloc: string | undefined, rmBloc: number | undefined, poidsCorps?: number,
): number | undefined {
  if (rmBloc === undefined) {
    const der = historique(passees, e.id, 1)[0];
    return der && meilleurE1rm(e, der.series, poidsCorps);
  }
  const der = bloc === undefined ? undefined : historique(passees.filter((s) => s.bloc === bloc), e.id, 1)[0];
  return Math.max(rmBloc, (der && meilleurE1rm(e, der.series, poidsCorps)) ?? 0);
}

// ——— Semaine de test : après les séries prévues du principal, un test de 1RM ou de 3RM.

/** Reps du test pour un exo cette semaine (1 = 1RM, 3 = 3RM), `null` hors semaine de test. */
export const repsTest = (sem: Semaine, exo: string): number | null => sem.test?.[exo] ?? sem.test?.["*"] ?? null;

/**
 * Meilleur résultat des tentatives de test (corps + lest sur un lesté), `undefined` sans tentative
 * réussie. Une tentative à 0 RIR est une mesure : elle prime sur les estimations faites avec de la
 * réserve (Epley surestime : 150 × 1 à 1 RIR donne 160 quand 155 à 0 RIR a été le max).
 */
export function resultatTest(e: Exercice, series: Serie[], poidsCorps?: number): number | undefined {
  const corps = corpsDe(e, poidsCorps);
  if (corps === undefined) return undefined;
  const reussies = series.filter((s) => s.test && s.reps >= 1);
  const mesures = reussies.filter((s) => s.rir === 0);
  const v = (mesures.length ? mesures : reussies).map((s) => e1rmSerie(s.kg + corps, s.reps, s.rir ?? 0));
  return v.length ? Math.max(...v) : undefined;
}

/**
 * Test d'un exo dans la séance : `null` hors semaine de test ou si l'exo a déjà été testé dans le
 * bloc (le bench du J5, déjà testé au J1). Fini dès une tentative à 0 RIR ou sous les reps visées.
 */
export function etatTest(sem: Semaine, passees: Seance[], bloc: string | undefined, enCours: Seance, exo: string):
  { reps: number; fini: boolean } | null {
  const reps = repsTest(sem, exo);
  const teste = (s: Seance) => s.exercices.some((x) => x.exo === exo && x.series.some((v) => v.test));
  if (reps === null || passees.some((s) => s.bloc === bloc && teste(s))) return null;
  const tentatives = enCours.exercices.filter((x) => x.exo === exo).flatMap((x) => x.series).filter((v) => v.test);
  return { reps, fini: tentatives.some((v) => v.rir === 0 || v.reps < reps) };
}

/** Première tentative : 95 % de la charge max estimée sur `reps` reps (ouverture). */
export function ouvertureTest(e: Exercice, rm: number, reps: number, poidsCorps?: number): number | null {
  return chargeDe(e, (0.95 * rm) / (reps === 1 ? 1 : 1 + reps / 30), poidsCorps);
}

/** 1RM proposé pour le bloc suivant : le résultat du test du bloc, sinon le 1RM effectif. Arrondi au demi-kilo. */
export function rmNouveauBloc(
  e: Exercice, passees: Seance[], bloc: string, rmBloc: number | undefined, poidsCorps?: number,
): number | undefined {
  const tests = passees.filter((s) => s.bloc === bloc).flatMap((s) => s.exercices.filter((x) => x.exo === e.id).flatMap((x) => x.series));
  const v = resultatTest(e, tests, poidsCorps) ?? rmEffectif(e, passees, bloc, rmBloc, poidsCorps);
  return v === undefined ? undefined : arrondir(v, 0.5);
}

/** RIR visé au mouvement principal : « 1 à 2 RIR » du bloc, on vise le bas (2 RIR → on monte). */
export const RIR_PRINCIPAL = 1;

/** RIR visé pour recaler la série suivante en séance ; `null` si la prescription ne se recale pas. */
export function rirVise(pr: Prescription): number | null {
  if (pr.type === "pct1rm") return RIR_PRINCIPAL;
  if (pr.type === "rpe") return 10 - pr.rpe;
  return null;
}

/**
 * Charge de la série suivante d'après la dernière faite : celle qui donne `reps` reps à `rir` RIR
 * (Epley avec la réserve). Plus de réserve que visé → on monte, moins ou série ratée → on baisse.
 * En calibrage (aucune série fiable encore), un « 4+ » ne dit pas jusqu'où monter : palier fixe,
 * +20 % (au moins 8 pas : +20 kg à la barre), +10 % du total sur un lesté où le corps pèse
 * l'essentiel. Prudent près du max : 120 × 5 à 4+ → 145, pas plus.
 * `null` si la dernière série n'a pas de RIR, ou sans pesée sur un lesté.
 */
export function recalage(
  e: Exercice, der: Serie, reps: number, rir: number, poidsCorps: number | undefined, calibrage: boolean,
): number | null {
  const corps = corpsDe(e, poidsCorps);
  if (der.rir === undefined || corps === undefined) return null;
  const total = der.kg + corps;
  let suivant = epley(total, der.reps, der.rir) / (1 + (reps + rir) / 30);
  if (calibrage && der.rir >= 4) {
    const palier = e.charge === "poids-corps-leste" ? total * 1.1 : Math.max(total * 1.2, total + 8 * e.pas);
    suivant = Math.max(suivant, palier);
  }
  return chargeDe(e, suivant, poidsCorps);
}

/** Charge et reps prescrites pour un exo d'un poste (docs/modele-donnees.md, « Prescriptions »). */
export function cible(e: Exercice, pr: Prescription, c: Contexte): Cible {
  const leste = e.charge === "poids-corps-leste";
  const charge = (total: number) => chargeDe(e, total, c.poidsCorps);
  const derniere = historique(c.passees, e.id, 1)[0]?.series;

  switch (pr.type) {
    case "pct1rm": {
      const s = c.semaine.schemas[pr.schema];
      if (!s) throw new Error(`schéma « ${pr.schema} » absent de la semaine ${c.semaine.nom}`);
      const texte = s.pct.map(pct).join("–") + " %";
      return { series: s.series, reps: s.reps, kg: c.rm === undefined ? null : charge(c.rm * s.pct[0]), texte };
    }
    case "fourchette": {
      const texte = `${pr.repsMin === pr.repsMax ? pr.repsMin : `${pr.repsMin}–${pr.repsMax}`} reps`;
      if (!derniere) return { series: pr.series, reps: pr.repsMin, kg: null, texte };
      // Double progression : toutes les séries en haut de fourchette, réserve tenue → un cran.
      const monte = derniere.length >= pr.series &&
        derniere.every((s) => s.reps >= pr.repsMax && (pr.rir === undefined || (s.rir ?? -1) >= pr.rir));
      const kg = derniere[0].kg;
      if (monte) return { series: pr.series, reps: pr.repsMin, kg: arrondir(kg + e.pas, e.pas), texte };
      const reps = Math.min(pr.repsMax, Math.max(pr.repsMin, derniere[0].reps + 1));
      return { series: pr.series, reps, kg, texte };
    }
    case "rpe": {
      const texte = `RPE ${pr.rpe}`;
      if (!derniere) return { series: pr.series, reps: pr.reps, kg: null, texte };
      const corps = leste ? c.poidsCorps : 0;
      if (corps === undefined) return { series: pr.series, reps: pr.reps, kg: null, texte };
      const e1rm = Math.max(...derniere.map((s) => epley(s.kg + corps, s.reps, s.rir ?? 0)));
      return { series: pr.series, reps: pr.reps, kg: charge(e1rm / (1 + (pr.reps + 10 - pr.rpe) / 30)), texte };
    }
    case "distance":
      return { series: pr.series, reps: pr.metres, kg: derniere?.[0].kg ?? null, texte: `${pr.metres} m` };
  }
}

/**
 * Charge des séries en plus après une série ratée : −10 % du total (corps + lest sur un lesté),
 * arrondi au pas de l'exo. Sans poids de corps, un lesté allège le lest seul.
 */
export function retour(e: Exercice, kg: number, poidsCorps?: number): number {
  if (e.charge === "poids-corps-leste" && poidsCorps !== undefined) {
    return Math.max(0, arrondir((poidsCorps + kg) * 0.9 - poidsCorps, e.pas));
  }
  return Math.max(e.charge === "barre" ? 20 : 0, arrondir(kg * 0.9, e.pas));
}

/** Échauffement d'un mouvement principal, du plus léger au plus lourd ; vide sous la barre. */
export function echauffement(e: Exercice, kg: number): string[] {
  if (e.charge === "poids-corps-leste") return kg > 0 ? ["PDC ×5", `+${nombre(arrondir(kg / 2, e.pas))} ×3`] : [];
  const vide = e.charge === "barre" ? "Barre ×10" : "À vide ×10";
  const paliers = ([[0.4, 5], [0.6, 3], [0.75, 2]] as const)
    .map(([p, reps]) => [arrondir(kg * p, e.pas), reps] as const)
    .filter(([v], i, l) => v > (e.charge === "barre" ? 20 : 0) && (i === 0 || v > l[i - 1][0]));
  return [vide, ...paliers.map(([v, reps]) => `${nombre(v)} ×${reps}`)];
}

export const DISQUES = [25, 20, 15, 10, 5, 2.5, 1.25];

/** Disques par côté sur une barre de 20 kg ; `null` si la charge ne tombe pas juste. */
export function disques(kg: number, barre = 20): number[] | null {
  let reste = Math.round(((kg - barre) / 2) * 100) / 100;
  if (reste < 0) return null;
  const res: number[] = [];
  for (const d of DISQUES) {
    while (reste >= d - 1e-9) {
      res.push(d);
      reste = Math.round((reste - d) * 100) / 100;
    }
  }
  return reste === 0 ? res : null;
}

export const nombre = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

export interface Bilan {
  minutes: number;
  series: number;
  /** Tonnage des séries de travail (corps + lest sur un lesté ; distances exclues), en kg. */
  volume: number;
  exos: { exo: string; series: Serie[]; record?: { avant: number; apres: number } }[];
}

/**
 * Résumé de fin de séance. Record = meilleur 1RM estimé du jour au-dessus de tous ceux des séances
 * passées sur l'exo ; pas de record la première fois (rien à battre).
 */
export function bilan(s: Seance, passees: Seance[], poidsCorps?: number): Bilan {
  const exos: Bilan["exos"] = [];
  let series = 0;
  let volume = 0;
  for (const x of s.exercices) {
    const e = exercice(x.exo);
    const travail = x.series.filter((v) => v.type === "travail");
    if (!travail.length) continue;
    series += travail.length;
    const corps = corpsDe(e, poidsCorps) ?? 0;
    if (e.charge !== "distance") volume += travail.reduce((t, v) => t + (v.kg + corps) * v.reps, 0);
    // Exo testé : le résultat du test (mesure) prime sur les estimations des autres séries.
    const apres = resultatTest(e, travail, poidsCorps) ?? meilleurE1rm(e, travail, poidsCorps);
    const avant = meilleurE1rm(e, passees.flatMap((p) => p.exercices.filter((y) => y.exo === e.id).flatMap((y) => y.series))
      .filter((v) => v.type === "travail"), poidsCorps);
    exos.push({ exo: e.id, series: travail, ...(apres !== undefined && avant !== undefined && apres > avant ? { record: { avant, apres } } : {}) });
  }
  const minutes = s.fin ? Math.round((Date.parse(s.fin) - Date.parse(s.debut)) / 60_000) : 0;
  return { minutes, series, volume: Math.round(volume), exos };
}
