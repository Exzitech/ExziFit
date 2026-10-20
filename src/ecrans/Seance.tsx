import { Fragment, useEffect, useState } from "react";
import { ecrireBlocs, lireBlocs, lirePesees, noterPoidsCorps, type Bloc } from "../donnees/bloc";
import { EXERCICES, exercice, libelleCharge, remplacants, type Exercice } from "../donnees/exercices";
import { illustration } from "../donnees/illustrations";
import { chargeDouteuse, poidsCorpsDouteux, repsDouteuses } from "../donnees/aberrant";
import { horodatage, jourLocal } from "../donnees/fichier";
import {
  ajusterKg, archiverSeance, ecrireEnCours, historique, lireEnCours, lireSeances, proposition, supprimerEnCours,
  type Rattrapage, type Seance, type Serie,
} from "../donnees/journal";
import {
  ecrireSalles, exerciceEn, lireSalles, montage, normaliser, salleDe, salleRetenue, type Montage, type Salle,
} from "../donnees/salles";
import {
  aRattraper, avertissements, bilan, blocFini, cible, disques, duree, echauffement, encouragement, etatTest, exosPct1rm, membres, nombre, ouvertureTest,
  jourDeSeance, preparation, programme, programmeDe, prochainJour, recalage, retour, rirFourchette, rirVise, rmEffectif, tropFacile, rmNouveauBloc,
  semaineDe, type Bilan, type Cible, type Poste, type Programme, type Semaine,
} from "../donnees/programme";
import { seuilConstance, stats, type Pesee, type Sexe, type Stats } from "../donnees/stats";
import { useBoutonRetour } from "../boutonRetour";
import { t } from "../i18n";
import { Ecarts, seuilActuel } from "./Personnage";
import ChampSur from "./ChampSur";
import Illustration from "./Illustration";
import EcranProgrammes from "./Programmes";
import { annulerRepos, lancerRepos, useReste } from "../minuteur";

/** Repos d'un exo hors programme. */
const REPOS_S = 120;
/** Repos entre deux paliers de la montée guidée (séries légères). */
const REPOS_MONTEE_S = 90;
const RIR = [0, 1, 2, 3, 4];

type Vue = "jour" | "saisie" | "exos" | "remplacer";

/**
 * Ligne de la séance : un poste du programme (du jour, ou d'un autre jour à rattraper), ou un exo
 * ajouté en plus (sans prescription).
 */
interface Ligne { membres: string[]; poste?: Poste; rattrapage?: string }

const date = (iso: string) =>
  new Date(iso).toLocaleDateString(t.locale, { weekday: "short", day: "numeric", month: "short" });
const serie = (s: Serie) => `${nombre(s.kg)}×${s.reps}${s.rir === undefined ? "" : ` R${s.rir}`}`;
const charge = (e: Exercice, kg: number) =>
  e.charge === "poids-corps-leste" ? (kg ? `+${nombre(kg)} kg` : t.seance.pdc) : `${nombre(kg)} kg`;
/** Jour d'une séance tel qu'affiché : « J1 · Bench lourd ». */
const titreJour = (j: { id: string; nom: string }) => `${t.idJour(j.id)} · ${j.nom}`;
const titreSemaine = (s: Semaine) => `${t.idSemaine(s.nom)} · ${s.label}`;

/** « 5 × 5 · 127,5 kg · 80 % », « 3 × 8–10 · 60 kg ». */
function texteCible(e: Exercice, p: Poste, c: Cible): string {
  const kg = c.kg === null ? (p.prescription.type === "pct1rm" ? ` · ${t.seance.aCalibrer}` : "") : ` · ${charge(e, c.kg)}`;
  switch (p.prescription.type) {
    case "pct1rm": return `${c.series} × ${c.reps}${kg} · ${c.texte}`;
    case "fourchette": return `${c.series} × ${c.texte.replace(" reps", "")}${kg}`;
    case "rpe": return `${c.series} × ${c.reps} · ${c.texte}${kg}`;
    case "distance": return `${c.series} × ${c.texte}${kg}`;
  }
}

const nomLigne = (ids: string[]) => ids.map((id) => exercice(id).nom).join(" + ");

// ——— Calculs sur une séance : fonctions pures, appelables avant qu'un setState soit appliqué.

function lignes(s: Seance): Ligne[] {
  const jour = jourDeSeance(s);
  const prog: Ligne[] = jour?.exercices.map((p) => ({ membres: membres(p), poste: p })) ?? [];
  const dansProg = new Set(prog.flatMap((l) => l.membres));
  for (const r of s.rattrapage ?? []) {
    const p = programmeDe(s)?.jours.find((j) => j.id === r.jour)?.exercices[r.poste];
    if (!p || membres(p).some((m) => dansProg.has(m))) continue;
    prog.push({ membres: membres(p), poste: p, rattrapage: r.jour });
    membres(p).forEach((m) => dansProg.add(m));
  }
  return [...prog, ...s.exercices.filter((x) => !x.remplace && !dansProg.has(x.exo)).map((x) => ({ membres: [x.exo] }))];
}

/** Exos faits pour un membre : lui, puis ses remplaçants successifs (machine prise). */
function chaine(s: Seance, id: string): string[] {
  const ids = [id];
  for (;;) {
    const r = s.exercices.find((x) => x.remplace === id);
    if (!r || ids.includes(r.exo)) return ids;
    ids.push((id = r.exo));
  }
}

/** Exo réellement fait pour un membre : le dernier remplaçant. */
const reel = (s: Seance, id: string) => chaine(s, id).slice(-1)[0];

/** Séries du jour sur un exo, échauffements de calibrage compris. */
const duJourTout = (s: Seance, id: string) => s.exercices.filter((x) => x.exo === id).flatMap((x) => x.series);
const faites = (s: Seance, id: string) => duJourTout(s, id).filter((x) => x.type === "travail");

/** Semaine d'une séance de programme (appelée seulement pour les lignes d'un jour). */
const semaineDeSeance = (s: Seance): Semaine => programmeDe(s)!.semaines[s.semaine ?? 0];

/**
 * Séries de travail du poste pour un membre, remplacements compris : 1 série de hack squat sur 4,
 * puis squat → il reste 3 séries, au squat.
 */
const faitesMembre = (s: Seance, m: string) => chaine(s, m).reduce((n, id) => n + faites(s, id).length, 0);

/** Idem, depuis l'exo réellement fait. */
function faitesPoste(s: Seance, l: Ligne, id: string): number {
  const m = l.membres.find((x) => reel(s, x) === id);
  return m ? faitesMembre(s, m) : faites(s, id).length;
}

/**
 * Contexte des calculs : séances passées réécrites dans les unités de la salle du jour (ce qui se
 * lit sur ses machines), exercices montés dans cette salle (chariot, moufle).
 */
interface Ctx { p: Seance[]; b: Bloc | undefined; poids: number | undefined; x: (id: string) => Exercice }

function contexte(passees: Seance[], salles: Salle[], salle: Salle, b: Bloc | undefined, poids: number | undefined): Ctx {
  return { p: normaliser(passees, salles, salle), b, poids, x: (id) => exerciceEn(salle, id) };
}

function cibleDe(c: Ctx, s: Seance, l: Ligne, id: string) {
  if (!l.poste) return null;
  const e = c.x(id);
  const rm = rmEffectif(e, c.p, c.b?.id, c.b?.rm[id], c.poids);
  return cible(e, l.poste.prescription, { semaine: semaineDeSeance(s), rm, poidsCorps: c.poids, passees: c.p });
}

/**
 * Montée guidée : exo en % du 1RM sans 1RM connu (ni bloc, ni historique), et aucune série du jour
 * plus dure que « 4+ » RIR. Les séries à 4+ de la montée sont notées en échauffement.
 */
function enCalibrage(s: Seance, l: Ligne, id: string, c: Cible | null): boolean {
  return l.poste?.prescription.type === "pct1rm" && c?.kg === null &&
    duJourTout(s, id).every((x) => x.rir === undefined || x.rir >= 4);
}

/** Test de fin de bloc en cours sur un principal (séries prévues faites, test pas fini), sinon `null`. */
function testEnCours(c: Ctx, s: Seance, l: Ligne, id: string) {
  if (l.poste?.role !== "principal" || !s.jour || !complete(c, s, l)) return null;
  const t = etatTest(semaineDeSeance(s), c.p, s.bloc, s, id);
  return t && !t.fini ? t : null;
}

const nomTest = (reps: number) => (reps === 1 ? "1RM" : `${reps}RM`);

/** Membre à faire maintenant : celui qui a le moins de séries (superset : on alterne). */
function courant(s: Seance, l: Ligne): string {
  const m = l.membres.reduce((a, b) => (faitesMembre(s, b) < faitesMembre(s, a) ? b : a));
  return reel(s, m);
}

function complete(c: Ctx, s: Seance, l: Ligne): boolean {
  return l.membres.every((m) => {
    const id = reel(s, m);
    const ci = cibleDe(c, s, l, id);
    return ci !== null && faitesMembre(s, m) >= ci.series;
  });
}

/**
 * Charge et reps préremplies, avec la raison quand l'app a changé la charge. Mouvement en % du 1RM
 * ou au RPE : recalé sur la dernière série du jour et son RIR (`recalage`). Ailleurs, la charge de
 * la série précédente du jour garde une correction faite au − / + ; séries prévues faites et la
 * dernière ratée (reps sous la cible) : charge de retour pour les séries en plus. Les reps
 * reviennent toujours à la cible du programme.
 */
function prerempli(ctx: Ctx, s: Seance, l: Ligne, id: string): { kg: number; reps: number; raison?: string } {
  const { p, b, poids } = ctx;
  const e = ctx.x(id);
  const c = cibleDe(ctx, s, l, id);
  const tout = duJourTout(s, id);
  const avant = tout[tout.length - 1];
  const test = testEnCours(ctx, s, l, id);
  if (test) {
    // Test : ouverture à 95 % du max estimé, puis chaque tentative recale la suivante à 0 RIR.
    const derTest = tout.filter((x) => x.test).pop();
    const rm = rmEffectif(e, p, b?.id, b?.rm[id], poids);
    const kg = derTest ? recalage(e, derTest, test.reps, 0, poids, false) : rm === undefined ? null : ouvertureTest(e, rm, test.reps, poids);
    if (kg !== null) {
      const raison = derTest ? t.seance.tentative(serie(derTest), test.reps) : t.seance.ouverture;
      return { kg, reps: test.reps, raison };
    }
    return { kg: avant?.kg ?? 0, reps: test.reps, raison: t.seance.sansMax };
  }
  const vise = l.poste ? rirVise(l.poste.prescription) : null;
  if (c && avant && vise !== null) {
    const kg = recalage(e, avant, c.reps, vise, poids, enCalibrage(s, l, id, c));
    if (kg !== null) {
      const sens = kg > avant.kg ? t.seance.monte : kg < avant.kg ? t.seance.baisse : t.seance.meme;
      return { kg, reps: c.reps, raison: t.seance.recale(serie(avant), sens, c.reps, vise) };
    }
  }
  const pr = l.poste?.prescription;
  if (c && avant && pr?.type === "fourchette") {
    const kg = tropFacile(e, pr, avant, c.reps, poids);
    if (kg !== null) return { kg, reps: c.reps, raison: t.seance.recale(serie(avant), t.seance.monte, c.reps, rirFourchette(pr)) };
  }
  const duJour = faites(s, id);
  const der = duJour[duJour.length - 1];
  if (c && der && faitesPoste(s, l, id) >= c.series && der.reps < c.reps) {
    return { kg: retour(e, der.kg, poids), reps: c.reps, raison: t.seance.ratee };
  }
  const prop = proposition(p, s, e);
  return { kg: avant?.kg ?? c?.kg ?? prop.kg, reps: c ? c.reps : prop.reps };
}

/** Première ligne non finie après `depuis` (en bouclant), `null` si tout est fait. */
function premiereAFaire(c: Ctx, s: Seance, depuis: number) {
  const ls = lignes(s);
  for (let k = 1; k <= ls.length; k++) {
    const i = (depuis + k + ls.length) % ls.length;
    if (!complete(c, s, ls[i])) return i;
  }
  return null;
}


export default function EcranSeance({ programmeChoisi, sexe, onProgramme, onRepos, onErreur, onEnSeance }: {
  /** Programme de `reglages.json` : celui de l'accueil. Une séance en cours garde le sien. */
  programmeChoisi: string | undefined; onProgramme: (id: string) => void;
  /** Repos changés sur les programmes fournis (`reglages.repos`), déjà posés par `poserRepos`. */
  onRepos: (r: Record<string, number>) => void;
  sexe: Sexe;
  onErreur: (e: unknown) => void; onEnSeance: (oui: boolean) => void;
}) {
  const [passees, setPassees] = useState<Seance[] | null>(null);
  const [blocs, setBlocs] = useState<Bloc[]>([]);
  const [pesees, setPesees] = useState<Pesee[]>([]);
  const [salles, setSalles] = useState<Salle[]>([]);
  /** Salle choisie sur l'accueil ; `null` = celle de la dernière séance. */
  const [salleChoisie, setSalleChoisie] = useState<string | null>(null);
  /** Poids de corps = dernière pesée notée. */
  const pdc = pesees[pesees.length - 1]?.kg;
  const [seance, setSeance] = useState<Seance | null>(null);
  const [vue, setVue] = useState<Vue>("saisie");
  const [ligne, setLigne] = useState(0);
  /** Exo dont la dernière série attend son RIR. */
  const [attente, setAttente] = useState<string | null>(null);
  const [kg, setKg] = useState(0);
  const [reps, setReps] = useState(0);
  const [fin, setFin] = useState(0);
  const [jourChoisi, setJourChoisi] = useState(0);
  const [semaineChoisie, setSemaineChoisie] = useState(0);
  /** Postes à rattraper cochés (`J4:2`), pour le jour choisi ; `null` = choix par défaut. */
  const [rattChoisis, setRattChoisis] = useState<{ jour: number; cles: string[] } | null>(null);
  // Terminer en deux taps : un geste raté avec les mains moites ne doit pas clore la séance.
  const [finDemandee, setFinDemandee] = useState(false);
  /** Série douteuse (`exo|kg|reps`) dont le premier toucher a demandé « Sûr ? ». */
  const [douteVu, setDouteVu] = useState<string | null>(null);
  /** Résumé de la séance qui vient d'être terminée. */
  const [resume, setResume] = useState<{ seance: Seance; bilan: Bilan; avant: Stats; apres: Stats } | null>(null);
  /** Page de choix du programme, ouverte depuis l'accueil. */
  const [voirProgrammes, setVoirProgrammes] = useState(false);
  const reste = useReste(fin);

  const prog = (seance && programmeDe(seance)) || programme(programmeChoisi);
  /** Bloc ouvert d'un programme : chaque programme garde le sien, y revenir reprend sa rotation. */
  const ouvert = (b: Bloc[], id: string) => b.filter((x) => x.programme === id && x.fin === null).pop();
  const bloc = ouvert(blocs, prog.id);

  useEffect(() => {
    Promise.all([lireSeances(), lireEnCours(), lireBlocs(), lirePesees(), lireSalles()])
      .then(([p, enCours, b, pe, sa]) => {
        setPassees(p);
        setBlocs(b);
        setPesees(pe);
        setSalles(sa);
        const poids = pe[pe.length - 1]?.kg;
        const actif = ouvert(b, prog.id);
        if (enCours) {
          // Séance commencée avant les salles : passée dans les unités de la première salle.
          let s = enCours;
          if (s.salle === undefined) {
            const { poulie: _, ...reste } = normaliser([s], sa, sa[0])[0];
            s = { ...reste, salle: sa[0].id };
            ecrireEnCours(s).catch(onErreur);
          }
          // Séance interrompue : on reprend sur la première ligne pas finie.
          setSeance(s);
          const c = contexte(p, sa, salleDe(sa, s), b.find((x) => x.id === s.bloc) ?? actif, poids);
          ouvrir(c, s, premiereAFaire(c, s, -1) ?? 0);
        } else if (actif) {
          proposer(prog, p, actif.id);
        }
      })
      .catch(onErreur);
  }, []);

  useEffect(() => onEnSeance(seance !== null), [seance !== null]);

  // Retour = le lien « ‹ » de l'écran : saisie et choix d'exo reviennent à la vue du jour, le
  // résumé se ferme. Depuis la vue du jour, retour à l'accueil si la séance est vide ; sinon Android
  // ferme l'app (la séance en cours est sur disque).
  const sousVue = seance
    ? vue !== "jour" && (vue !== "saisie" || lignes(seance)[ligne] !== undefined)
    : resume !== null;
  /** Séance démarrée sans aucune série : la quitter ne perd rien, elle s'annule sans confirmation. */
  const vide = seance !== null && !seance.exercices.some((x) => x.series.length);
  const annuler = () => {
    supprimerEnCours().then(() => {
      setSeance(null);
      setAttente(null);
      setFinDemandee(false);
    }, onErreur);
  };
  useBoutonRetour(sousVue ? () => (seance ? setVue("jour") : setResume(null)) : vide ? annuler : null, onErreur);
  useBoutonRetour(voirProgrammes && !seance ? () => setVoirProgrammes(false) : null, onErreur);

  function proposer(pr: Programme, p: Seance[], blocId: string) {
    choisirJour(pr, p, blocId, prochainJour(pr, p, blocId, new Date()));
  }

  /** Jour choisi, et sa semaine : la première d'un nouveau bloc quand celui-ci est fini. */
  function choisirJour(pr: Programme, p: Seance[], blocId: string, j: number) {
    setJourChoisi(j);
    setSemaineChoisie(blocFini(pr, p, blocId, j) ? 0 : semaineDe(pr, p, blocId, j));
  }

  /** Autre programme sur l'accueil : son jour proposé, ou son premier jour s'il n'a pas de bloc. */
  function changerProgramme(id: string) {
    onProgramme(id);
    const b = ouvert(blocs, id);
    if (b && passees) return proposer(programme(id), passees, b.id);
    setJourChoisi(0);
    setSemaineChoisie(0);
  }

  if (!passees || !salles.length) return <h1>{t.seance.titre}</h1>;

  /** Salle du jour : celle de la séance en cours, sinon celle choisie sur l'accueil. */
  const salle = seance ? salleDe(salles, seance)
    : salles.find((x) => x.id === salleChoisie) ?? salleRetenue(salles, passees);
  const ctx = contexte(passees, salles, salle, bloc, pdc);

  /** Ouvre la saisie d'une ligne avec charge et reps préremplies. */
  function ouvrir(c: Ctx, s: Seance, i: number) {
    const l = lignes(s)[i];
    setLigne(i);
    setVue("saisie");
    setFinDemandee(false);
    if (!l) return;
    const v = prerempli(c, s, l, courant(s, l));
    setKg(v.kg);
    setReps(v.reps);
  }

  const enregistrer = (s: Seance) => {
    setSeance(s);
    ecrireEnCours(s).catch(onErreur);
  };

  async function assurerBloc(): Promise<Bloc> {
    if (bloc) return bloc;
    // Relu sur disque : l'écran peut tenir une liste périmée (synchro, autre écran) ; ne jamais
    // ouvrir un second bloc du programme quand un est déjà en cours (vu le 2026-10-14).
    const surDisque = await lireBlocs();
    const ouvert = surDisque.filter((x) => x.programme === prog.id && x.fin === null).pop();
    if (ouvert) {
      setBlocs(surDisque);
      return ouvert;
    }
    const b: Bloc = { id: `${jourLocal(new Date())}-${prog.id}`, programme: prog.id, debut: jourLocal(new Date()), fin: null, rm: {} };
    const tous = [...surDisque, b];
    await ecrireBlocs(tous);
    setBlocs(tous);
    return b;
  }

  async function changerBloc(b: Bloc) {
    const tous = blocs.some((x) => x.id === b.id) ? blocs.map((x) => (x.id === b.id ? b : x)) : [...blocs, b];
    await ecrireBlocs(tous);
    setBlocs(tous);
  }

  // ——— Accueil : pas de séance en cours.

  if (!seance && resume) {
    const { seance: s, bilan: b, avant, apres } = resume;
    const j = jourDeSeance(s);
    return (
      <>
        <h1>{t.seance.terminee}</h1>
        <p className="doux">{j ? `${titreJour(j)} · ` : ""}{t.seance.bilan(b.minutes, b.series, nombre(b.volume))}</p>
        {b.exos.map((x) => x.record && (
          <p key={x.exo} className="record">
            {t.seance.record(exercice(x.exo).nom, nombre(Math.round(x.record.apres)))}
            <span className="doux">{t.seance.recordAvant(nombre(Math.round(x.record.avant)))}</span>
          </p>
        ))}
        <div className="carte">
          {b.exos.map((x) => (
            <p key={x.exo}><b>{exercice(x.exo).nom}</b><br /><span className="doux">{faites(s, x.exo).map(serie).join("  ")}</span></p>
          ))}
        </div>
        <Ecarts avant={avant} apres={apres} />
        <div className="bas">
          <button className="principal valider" onClick={() => setResume(null)}>OK</button>
        </div>
      </>
    );
  }

  if (!seance && voirProgrammes) {
    const maintenant = new Date();
    return (
      <EcranProgrammes actuel={prog.id} stats={stats(normaliser(passees, salles), pesees, sexe, seuilConstance(prog), maintenant)}
                       onChoisir={(id) => { changerProgramme(id); setVoirProgrammes(false); }} onRetour={() => setVoirProgrammes(false)}
                       onRepos={onRepos} onErreur={onErreur} />
    );
  }

  if (!seance) {
    const finiBloc = bloc !== undefined && blocFini(prog, passees, bloc.id, jourChoisi);
    /** 1RM du bloc suivant, par exo principal (résultat du test, sinon 1RM effectif). */
    const rmSuivants = bloc
      ? exosPct1rm(prog).map((id) => [id, rmNouveauBloc(ctx.x(id), ctx.p, bloc.id, bloc.rm[id], pdc)] as const)
      : [];
    /** Clôt le bloc fini et ouvre le suivant avec les 1RM du test. */
    const nouveauBloc = async (ancien: Bloc): Promise<Bloc> => {
      const aujourdhui = jourLocal(new Date());
      let id = `${aujourdhui}-${prog.id}`;
      while (blocs.some((x) => x.id === id)) id += "-2";
      const rm: Record<string, number> = {};
      for (const [exo, v] of rmSuivants) if (v !== undefined) rm[exo] = v;
      const b: Bloc = { id, programme: prog.id, debut: aujourdhui, fin: null, rm };
      const tous = [...blocs.map((x) => (x.id === ancien.id ? { ...x, fin: aujourdhui } : x)), b];
      await ecrireBlocs(tous);
      setBlocs(tous);
      return b;
    };
    const demarrer = async () => {
      try {
        const b = finiBloc ? await nouveauBloc(bloc) : await assurerBloc();
        const s: Seance = {
          debut: horodatage(new Date()), bloc: b.id, programme: prog.id, semaine: semaineChoisie,
          jour: prog.jours[jourChoisi].id, salle: salle.id,
          ...(choisis.length ? { rattrapage: ratt.filter((x) => choisis.includes(cle(x.r))).map((x) => x.r) } : {}),
          exercices: [],
        };
        enregistrer(s);
        ouvrir(contexte(passees, salles, salle, b, pdc), s, 0);
      } catch (e) {
        onErreur(e);
      }
    };
    const libre = () => {
      enregistrer({ debut: horodatage(new Date()), salle: salle.id, exercices: [] });
      setVue("exos");
    };
    const jour = prog.jours[jourChoisi];
    const sem = prog.semaines[semaineChoisie];
    const cle = (r: Rattrapage) => `${r.jour}:${r.poste}`;
    const ratt = bloc && !finiBloc ? aRattraper(prog, passees, bloc.id, jour, new Date()) : [];
    // Par défaut, coché sur un jour optionnel (léger, il a la place) ; à cocher soi-même sur un jour lourd.
    const choisis = rattChoisis?.jour === jourChoisi ? rattChoisis.cles
      : jour.optionnel ? ratt.filter((x) => !x.bloque).map((x) => cle(x.r)) : [];
    const basculer = (k: string) =>
      setRattChoisis({ jour: jourChoisi, cles: choisis.includes(k) ? choisis.filter((x) => x !== k) : [...choisis, k] });
    const apercu: Seance = { debut: "", programme: prog.id, semaine: semaineChoisie, jour: jour.id, salle: salle.id, exercices: [] };

    return (
      <>
        <h1>{prog.nom}</h1>
        <button className="lien" onClick={() => setVoirProgrammes(true)}>{t.seance.changerProgramme}</button>
        {salles.length > 1 && (
          <div className="seg" style={{ gridTemplateColumns: `repeat(${salles.length}, 1fr)` }}>
            {salles.map((x) => (
              <button key={x.id} aria-pressed={x.id === salle.id} onClick={() => setSalleChoisie(x.id)}>{x.nom}</button>
            ))}
          </div>
        )}
        {prog.semaines.length > 1 && <div className="seg" style={{ gridTemplateColumns: `repeat(${prog.semaines.length}, 1fr)` }}>
          {prog.semaines.map((s, i) => (
            <button key={s.nom} aria-pressed={i === semaineChoisie} onClick={() => setSemaineChoisie(i)}>
              {t.idSemaine(s.nom)}<small>{s.label}</small>
            </button>
          ))}
        </div>}
        <div className="seg" style={{ gridTemplateColumns: `repeat(${prog.jours.length}, 1fr)` }}>
          {prog.jours.map((j, i) => (
            <button key={j.id} aria-pressed={i === jourChoisi}
                    onClick={() => (bloc ? choisirJour(prog, passees, bloc.id, i) : setJourChoisi(i))}>
              {t.idJour(j.id)}
            </button>
          ))}
        </div>

        <div className="carte">
          <h2 className="titre-carte">{titreJour(jour)}{jour.optionnel ? t.seance.optionnel : ""}</h2>
          {jour.note && <p className="doux petit">{jour.note}</p>}
          {avertissements(prog, jour, passees, new Date()).map((a) => <p key={a} className="alerte petit">{a}</p>)}
          <ol className="apercu">
            {jour.exercices.map((p, i) => {
              const l: Ligne = { membres: membres(p), poste: p };
              const id = membres(p)[0];
              const c = cibleDe(ctx, apercu, l, id);
              return (
                <li key={i}>
                  <b>{nomLigne(l.membres)}</b>{p.optionnel && <span className="badge">{t.commun.option}</span>}
                  <span className="doux">{c && texteCible(ctx.x(id), p, c)} · {t.seance.repos(duree(p.repos))}</span>
                </li>
              );
            })}
          </ol>
          {choisis.length > 0 && <p className="petit">{t.seance.aRattraper(choisis.length)}</p>}
          {ratt.length > 0 && !choisis.length && <p className="doux petit">{t.seance.sautes(ratt.length)}</p>}
          {prog.semaines.length > 1 && <p className="doux petit">{titreSemaine(sem)}</p>}
        </div>

        {ratt.length > 0 && (
          <div className="carte espace-haut">
            <h2 className="titre-carte">{t.seance.rattrapage}</h2>
            <p className="doux petit">{t.seance.rattrapageNote}</p>
            <div className="liste">
              {ratt.map((x) => {
                const id = membres(x.poste)[0];
                const c = cibleDe(ctx, apercu, { membres: membres(x.poste), poste: x.poste }, id);
                return x.bloque ? (
                  <p key={cle(x.r)} className="doux petit">{t.seance.plusTard(nomLigne(membres(x.poste)), t.idJour(x.r.jour), x.bloque)}</p>
                ) : (
                  <button key={cle(x.r)} className="ligne" aria-pressed={choisis.includes(cle(x.r))} onClick={() => basculer(cle(x.r))}>
                    <span>
                      <b>{nomLigne(membres(x.poste))}</b><span className="badge">{t.idJour(x.r.jour)}</span>
                      {c && <small>{texteCible(ctx.x(id), x.poste, c)} · {t.seance.repos(duree(x.poste.repos))}</small>}
                    </span>
                    <span className="avance">{choisis.includes(cle(x.r)) ? "✓" : "+"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}


        {(() => {
          const prep = preparation(jour.exercices.flatMap(membres).map(ctx.x));
          return (
            <details className="carte rm" open>
              <summary>{t.seance.echauffement(prep.minutes)}</summary>
              <ol className="apercu">{prep.etapes.map((x) => <li key={x}>{x}</li>)}</ol>
              <p className="doux petit">{t.seance.echauffementNote}</p>
            </details>
          );
        })()}

        {finiBloc ? (
          <div className="carte espace-haut">
            <h2 className="titre-carte">{t.seance.blocTermine}</h2>
            <p className="doux petit">{t.seance.blocNote}</p>
            {rmSuivants.map(([id, v]) => (
              <p key={id} className="petit">{t.seance.rmSuivant(exercice(id).nom, v === undefined ? null : `${nombre(v)} kg`)}</p>
            ))}
          </div>
        ) : (
          <Formulaire1RM exos={exosPct1rm(prog)} bloc={bloc} pdc={pdc} assurerBloc={assurerBloc} changerBloc={changerBloc}
                         onPdc={(kg) => setPesees((l) => [...l.filter((x) => x.date !== jourLocal(new Date())), { date: jourLocal(new Date()), kg }])} onErreur={onErreur}
                         x={ctx.x} estime={(id) => rmEffectif(ctx.x(id), ctx.p, bloc?.id, undefined, pdc)} />
        )}

        <button className="lien" onClick={libre}>{t.seance.libre}</button>
        {passees.length > 0 && (
          <p className="doux petit">{t.seance.derniere(date(passees[passees.length - 1].debut))}
            {passees[passees.length - 1].jour ? ` (${t.idJour(passees[passees.length - 1].jour!)})` : ""}</p>
        )}

        <div className="bas">
          <button className="principal valider" onClick={demarrer}>
            {finiBloc ? t.seance.nouveauBloc : t.seance.demarrer}{titreJour(jour)}
          </button>
        </div>
      </>
    );
  }

  // ——— Séance en cours.

  const ls = lignes(seance);
  const jour = jourDeSeance(seance);

  const terminer = async () => {
    if (!finDemandee) return setFinDemandee(true);
    setFinDemandee(false);
    const faite = { ...seance, fin: horodatage(new Date()), exercices: seance.exercices.filter((x) => x.series.length) };
    const vide = faite.exercices.length === 0;
    try {
      if (!vide) await archiverSeance(faite);
      await supprimerEnCours();
      const p = vide ? passees : [...passees, faite];
      if (!vide) {
        const maintenant = new Date();
        const seuil = seuilActuel(blocs, prog.id);
        // Résumé et stats en charge réelle (chariot compris, moufle retirée), toutes salles confondues.
        const [neutre, avantN] = [normaliser([faite], salles)[0], normaliser(passees, salles)];
        setResume({
          seance: faite, bilan: bilan(neutre, avantN, pdc),
          avant: stats(avantN, pesees, sexe, seuil, maintenant), apres: stats([...avantN, neutre], pesees, sexe, seuil, maintenant),
        });
      }
      setPassees(p);
      setSeance(null);
      setAttente(null);
      setFin(0);
      if (bloc) proposer(prog, p, bloc.id);
      await annulerRepos();
    } catch (e) {
      onErreur(e);
    }
  };
  const boutonTerminer = (cls = "") => (
    <button className={cls} onClick={terminer}>{finDemandee ? t.seance.confirmerFin : t.seance.terminer}</button>
  );

  /** Ajoute un exo (hors programme, ou remplaçant d'un membre) et ouvre sa saisie. */
  const ajouterExo = (id: string, remplace?: string) => {
    const deja = seance.exercices.some((x) => x.exo === id && x.remplace === remplace);
    const s = deja ? seance : { ...seance, exercices: [...seance.exercices, { exo: id, ...(remplace ? { remplace } : {}), series: [] }] };
    if (!deja) enregistrer(s);
    const i = remplace ? ligne : lignes(s).findIndex((l) => l.membres.includes(id));
    setAttente(null);
    ouvrir(ctx, s, i);
  };

  if (vue === "exos" || vue === "remplacer") {
    const l = ls[ligne];
    const remplace = vue === "remplacer" && l ? courant(seance, l) : undefined;
    const liste = remplace
      ? remplacants(remplace, l?.poste?.alternatives)
      : EXERCICES.map((e) => ({ e, raison: null }));
    const c = remplace && l ? cibleDe(ctx, seance, l, remplace) : null;
    const reste = c && l ? c.series - faitesPoste(seance, l, remplace as string) : 0;
    return (
      <>
        <button className="lien" onClick={() => setVue("jour")}>{t.seance.retour}</button>
        <h1>{remplace ? t.seance.remplacerExo(exercice(remplace).nom) : t.seance.ajouterExercice}</h1>
        {remplace && c && reste > 0 && reste < c.series && (
          <p className="doux petit">{t.seance.gardees(reste, c.series)}</p>
        )}
        <div className="liste">
          {liste.map(({ e, raison }, i) => (
            <Fragment key={e.id}>
              {remplace && !raison && liste[i - 1]?.raison && <p className="doux petit">{t.seance.autres}</p>}
              <button className="ligne" onClick={() => ajouterExo(e.id, remplace)}>
                <Illustration id={e.id} taille="vignette" />
                <span>
                  <b>{e.nom}</b>{remplace && i === 0 && raison && <span className="badge">{t.seance.top}</span>}
                  {remplace && raison && <small>{t.seance.pourquoi[raison]}</small>}
                </span>
              </button>
            </Fragment>
          ))}
        </div>
      </>
    );
  }

  if (vue === "jour" || !ls[ligne]) {
    return (
      <>
        {vide && <button className="lien" onClick={annuler}>{t.seance.changerJour}</button>}
        <h1>{jour ? titreJour(jour) : t.seance.libreTitre}</h1>
        {jour && prog.semaines.length > 1 && <p className="doux petit">{titreSemaine(semaineDeSeance(seance))}</p>}
        <div className="liste">
          {ls.map((l, i) => {
            const id = courant(seance, l);
            const c = cibleDe(ctx, seance, l, id);
            const fait = l.membres.map((m) => faitesMembre(seance, m));
            const ok = complete(ctx, seance, l);
            return (
              <button key={i} className={ok ? "ligne faite" : "ligne"} onClick={() => { setAttente(null); ouvrir(ctx, seance, i); }}>
                <Illustration id={id} taille="vignette" />
                <span>
                  <b>{nomLigne(l.membres.map((m) => reel(seance, m)))}</b>
                  {l.poste?.optionnel && <span className="badge">{t.commun.option}</span>}
                  {l.rattrapage && <span className="badge">{t.seance.rattrapageBadge(t.idJour(l.rattrapage))}</span>}
                  {l.poste && c && <small>{texteCible(ctx.x(id), l.poste, c)}</small>}
                </span>
                <span className="avance">{ok ? "✓" : `${Math.min(...fait)}/${c?.series ?? "–"}`}</span>
              </button>
            );
          })}
        </div>
        <div className="choix espace">
          <button onClick={() => setVue("exos")}>{t.seance.ajouterExo}</button>
          {boutonTerminer()}
        </div>
      </>
    );
  }

  // ——— Saisie d'une série.

  const l = ls[ligne];
  const id = courant(seance, l);
  const e = ctx.x(id);
  const c = cibleDe(ctx, seance, l, id);
  const duJour = faites(seance, id);
  /** Séries du poste, celles de l'exo remplacé comprises. */
  const nPoste = faitesPoste(seance, l, id);
  const tout = duJourTout(seance, id);
  const finie = complete(ctx, seance, l);
  const autres = l.membres.map((m) => reel(seance, m)).filter((x) => x !== id);
  const suivante = premiereAFaire(ctx, seance, ligne);
  const leste = e.charge === "poids-corps-leste";
  const montee = enCalibrage(seance, l, id, c);
  const pre = prerempli(ctx, seance, l, id);
  const raison = pre.raison;
  const test = testEnCours(ctx, seance, l, id);
  const enAttente = attente ? duJourTout(seance, attente).slice(-1)[0] : undefined;

  const valider = () => {
    setFinDemandee(false);
    setDouteVu(null);
    // `prevu` = la prescription quand il y en a une : c'est elle qui mesure le point 3 de la v1.
    // Série en plus : ce que l'app a prérempli (charge de retour après une série ratée).
    // Recalage par le RIR : la série prévue est la charge recalée, pas la prescription brute.
    const prevu = finie || pre.raison ? { kg: pre.kg, reps: pre.reps }
      : c && c.kg !== null ? { kg: c.kg, reps: c.reps } : proposition(ctx.p, seance, e);
    const s: Serie = { type: "travail", kg, reps, prevu, a: horodatage(new Date()), ...(test ? { test: true as const } : {}) };
    const existe = seance.exercices.some((x) => x.exo === id);
    const nouvelle: Seance = {
      ...seance,
      exercices: existe
        ? seance.exercices.map((x) => (x.exo === id ? { ...x, series: [...x.series, s] } : x))
        : [...seance.exercices, { exo: id, series: [s] }],
    };
    enregistrer(nouvelle);
    setAttente(id);
    // Superset : le repos vient après le dernier exo du tour, pas entre les deux.
    const compte = l.membres.map((m) => faitesMembre(nouvelle, m));
    if (compte.every((n) => n === compte[0])) {
      lancerRepos(montee ? REPOS_MONTEE_S : l.poste?.repos ?? REPOS_S).then(setFin, onErreur);
    }
  };

  /** Remplace la dernière série de l'exo qui attend son RIR. */
  const corrigerDerniere = (maj: (s: Serie) => Serie): Seance | null => {
    const series = seance.exercices.find((x) => x.exo === attente)?.series ?? [];
    const der = series[series.length - 1];
    if (!attente || !der) return null;
    const nouvelle: Seance = {
      ...seance,
      exercices: seance.exercices.map((x) => (x.exo === attente ? { ...x, series: [...series.slice(0, -1), maj(der)] } : x)),
    };
    enregistrer(nouvelle);
    return nouvelle;
  };

  const noterRir = (rir: number) => {
    // Montée guidée : un palier à 4+ RIR est un échauffement (ne compte ni dans les séries ni dans le volume).
    const enMontee = attente !== null && enCalibrage(seance, l, attente, cibleDe(ctx, seance, l, attente));
    const palier = enMontee && rir >= 4;
    const type = enMontee ? { type: palier ? "echauffement" as const : "travail" as const } : {};
    const nouvelle = corrigerDerniere((s) => ({ ...s, rir, ...type }));
    if (!nouvelle) return;
    setAttente(null);
    // Fin de la montée : la série fiable compte, elle mérite le repos complet du poste.
    if (enMontee && !palier) lancerRepos(l.poste?.repos ?? REPOS_S).then(setFin, onErreur);
    // Rouvre aussi une ligne finie : la charge recalée (ou de retour) se préremplit.
    ouvrir(ctx, nouvelle, ligne);
  };

  /** Réglage de la machine dans la salle du jour ; vaut aussi pour les séances passées dans cette salle. */
  const changerMontage = (m: Montage) => {
    const machines = { ...salle.machines };
    if (m.aVide || m.poulie) machines[id] = m;
    else delete machines[id];
    const tous = salles.map((x) => (x.id === salle.id ? { ...x, machines } : x));
    ecrireSalles(tous).then(() => setSalles(tous), onErreur);
  };

  // Disques par côté sur une barre de 20 kg. Pas sur une machine : les salles n'ont pas les mêmes
  // disques et on en mélange souvent plusieurs (retour de Tom), seule la charge en kg compte.
  const plaques = e.charge === "barre" ? disques(kg) : null;
  const passe = historique(ctx.p, id, 2);

  // Charge ou reps sans commune mesure avec ce que l'exo a connu (faute de frappe) : un toucher de
  // plus, « Sûr ? », au lieu d'un faux record. Distance : les reps sont des mètres.
  const vus = [...tout, ...historique(ctx.p, id, 5).flatMap((h) => h.series)];
  const cle = `${id}|${kg}|${reps}`;
  const douteuse = chargeDouteuse(kg, Math.max(pre.kg, ...vus.map((s) => s.kg))) ||
    (l.poste?.prescription.type !== "distance" && repsDouteuses(reps, Math.max(pre.reps, ...vus.map((s) => s.reps))));
  const validerSur = () => (douteuse && douteVu !== cle ? setDouteVu(cle) : valider());
  const libelle = (texte: string) => (douteuse && douteVu === cle ? t.seance.sur(texte) : texte);

  return (
    <div className="saisie">
      <div className="haut">
        <button className="lien" onClick={() => setVue("jour")}>‹ {jour ? t.idJour(jour.id) : t.seance.titre} · {ls.filter((x) => complete(ctx, seance, x)).length}/{ls.length}</button>
        <button className="lien" onClick={() => setVue("remplacer")}>{t.seance.remplacer}</button>
      </div>

      <h1>{e.nom}{l.poste?.optionnel && <span className="badge">{t.commun.option}</span>}</h1>
      {l.poste && c && (
        <p className="cible">
          {test
            ? t.seance.test(nomTest(test.reps), tout.filter((x) => x.test).length + 1)
            : nPoste < c.series
              ? t.seance.serie(nPoste + 1, c.series, texteCible(e, l.poste, c))
              : t.seance.serieEnPlus(nPoste - duJour.filter((x) => x.test).length + 1, texteCible(e, l.poste, c))}
          {" "}· {t.seance.repos(duree(l.poste.repos))}
        </p>
      )}
      <Consignes key={e.id} id={e.id} />
      {(e.disques || e.charge === "poulie") && (
        <ReglageMachine key={`${salle.id}/${e.id}`} e={e} salle={salle} m={montage(salle, e)} onChange={changerMontage} />
      )}
      {autres.length > 0 && <p className="doux petit">{t.seance.superset(nomLigne(autres))}</p>}
      {l.poste?.note && <p className="doux petit">{l.poste.note}</p>}
      {l.poste?.prescription.type === "pct1rm" && c?.kg === null && (
        <p className="doux petit">
          {leste && pdc === undefined ? t.seance.pdcManquant : montee ? t.seance.calibrage : t.seance.calibre}
        </p>
      )}
      {raison && !attente && <p className="doux petit">{raison}</p>}
      {l.poste?.role === "principal" && duJour.length === 0 && c?.kg && (
        <p className="doux petit">{t.seance.echauffementExo(echauffement(e, c.kg).join(" · "))}</p>
      )}
      {plaques && plaques.length > 0 && (
        <div className="disques" aria-label={t.seance.disquesCote}>
          {plaques.map((d, i) => <span key={i} className="disque" style={{ background: `var(--disque-${String(d).replace(".", "-")})` }}>{nombre(d)}</span>)}
          <span className="doux petit">{t.seance.parCote}</span>
        </div>
      )}

      {tout.length > 0 && (
        <p className="series">
          {tout.map((s, i) => (
            // Toucher la dernière série rouvre son RIR et ses reps (tap raté). Palier de montée en estompé.
            <button key={i} className={s.type === "travail" ? "puce" : "puce doux"} disabled={i !== tout.length - 1}
                    onClick={() => setAttente(id)}>{serie(s)}</button>
          ))}
        </p>
      )}
      {passe.map((h) => <p key={h.debut} className="doux petit">{date(h.debut)} : {h.series.map(serie).join("  ")}</p>)}
      {passe.length === 0 && (kg === 0 && !["poids-corps", "poids-corps-leste", "distance"].includes(e.charge)
        ? <p className="alerte petit">{t.seance.jamaisDepart}</p>
        : <p className="doux petit">{t.seance.jamais}</p>)}

      <div className="bas">
        {fin > 0 && <div className={reste ? "compte" : "compte fini"}>{reste ? `${Math.floor(reste / 60)}:${String(reste % 60).padStart(2, "0")}` : t.seance.go}</div>}

        {attente ? (
          <>
            {/* Série ratée validée par réflexe : les reps se corrigent ici, avant le RIR. */}
            {enAttente && (
              <div className="reglage">
                <button onClick={() => corrigerDerniere((s) => ({ ...s, reps: Math.max(1, s.reps - 1) }))} aria-label={t.seance.moinsRep}>−</button>
                <label><output>{enAttente.reps}</output><span>{t.seance.repsFaites}</span></label>
                <button onClick={() => corrigerDerniere((s) => ({ ...s, reps: s.reps + 1 }))} aria-label={t.seance.plusRep}>+</button>
              </div>
            )}
            <p className="question">{t.seance.reserve}</p>
            <div className="rir">
              {RIR.map((r) => <button key={r} onClick={() => noterRir(r)}>{r === 4 ? "4+" : r}</button>)}
            </div>
          </>
        ) : test ? (
          <>
            <Reglage kg={kg} reps={reps} e={e} setKg={setKg} setReps={setReps} />
            <button className="principal valider espace-bas" onClick={validerSur}>{libelle(t.seance.tentativeBouton(nombre(kg), reps))}</button>
            {suivante !== null
              ? <button onClick={() => ouvrir(ctx, seance, suivante)}>{t.seance.passerTest}</button>
              : boutonTerminer()}
          </>
        ) : finie ? (
          <>
            <p className="encourage">{encouragement(e, duJour, ctx.p, seance.debut + id, pdc)}</p>
            <Reglage kg={kg} reps={reps} e={e} setKg={setKg} setReps={setReps} distance={l.poste?.prescription.type === "distance"} />
            <button className="espace-bas" onClick={validerSur}>{libelle(t.seance.enPlus(nombre(kg), reps))}</button>
            {suivante !== null
              ? <button className="principal valider" onClick={() => ouvrir(ctx, seance, suivante)}>
                  {t.seance.suivant(nomLigne(ls[suivante].membres.map((m) => reel(seance, m))))}
                  {ls[suivante].poste?.optionnel && <small>{t.seance.enOption}</small>}
                </button>
              : boutonTerminer("principal valider")}
          </>
        ) : (
          <>
            <Reglage kg={kg} reps={reps} e={e} setKg={setKg} setReps={setReps} distance={l.poste?.prescription.type === "distance"} />
            <button className="principal valider" onClick={validerSur}>{libelle(t.seance.valider(nombre(kg), reps))}</button>
          </>
        )}
      </div>
    </div>
  );
}

function Reglage({ kg, reps, e, setKg, setReps, distance }: {
  kg: number; reps: number; e: Exercice; setKg: (n: number) => void; setReps: (n: number) => void; distance?: boolean;
}) {
  return (
    <>
      <div className="reglage">
        <button onClick={() => setKg(ajusterKg(kg, e.pas, -1))} aria-label={t.seance.moinsCharge}>−</button>
        <label>
          <Champ valeur={kg} mode="decimal" onChange={(n) => setKg(Math.max(0, n))} />
          <span>{libelleCharge(e)}</span>
        </label>
        <button onClick={() => setKg(ajusterKg(kg, e.pas, 1))} aria-label={t.seance.plusCharge}>+</button>
      </div>
      <div className="reglage">
        <button onClick={() => setReps(Math.max(1, reps - 1))} aria-label={t.seance.moinsRep}>−</button>
        <label>
          <Champ valeur={reps} mode="numeric" onChange={(n) => setReps(Math.max(1, Math.round(n)))} />
          <span>{distance ? "m" : t.seance.reps}</span>
        </label>
        <button onClick={() => setReps(reps + 1)} aria-label={t.seance.plusRep}>+</button>
      </div>
    </>
  );
}

/**
 * Réglage de la machine dans la salle du jour, replié sur une ligne : poids à vide (Smith, presse,
 * hack squat) ou poulie à moufle. On note toujours ce qui se lit sur la machine. Machine à disques
 * sans poids à vide noté dans cette salle : déplié d'office, avec un avertissement.
 */
/** Image et points de technique de l'exo, repliés : la saisie reste à deux gestes. */
function Consignes({ id }: { id: string }) {
  const [ouvert, setOuvert] = useState(false);
  const points = t.consignes[id];
  if (!points && !illustration(id)) return null;
  return (
    <div className="consignes">
      <button className="lien" aria-expanded={ouvert} onClick={() => setOuvert(!ouvert)}>{t.seance.technique} {ouvert ? "▴" : "▾"}</button>
      {ouvert && <Illustration id={id} taille="grande" />}
      {ouvert && points && <ul className="petit">{points.map((p) => <li key={p}>{p}</li>)}</ul>}
    </div>
  );
}

function ReglageMachine({ e, salle, m, onChange }: { e: Exercice; salle: Salle; m: Montage; onChange: (m: Montage) => void }) {
  const manque = e.disques && !m.aVide;
  const [ouvert, setOuvert] = useState(manque);
  const resume = e.disques
    ? (m.aVide ? t.machine.aVide(nombre(m.aVide)) : t.machine.aVideNonNote)
    : (m.poulie ? t.machine.moufle : t.machine.normale);
  return (
    <div className="machine">
      <button className="lien" onClick={() => setOuvert(!ouvert)}>{salle.nom} · {resume} {ouvert ? "▴" : "▾"}</button>
      {ouvert && (e.disques ? (
        <div className="carte rm">
          {manque && (
            <p className="alerte petit">{t.machine.manque}</p>
          )}
          <label className="petit">
            {t.machine.champ}
            <Champ valeur={m.aVide ?? 0} mode="decimal" onChange={(n) => onChange(n > 0 ? { aVide: n } : {})} />
          </label>
          <p className="doux petit">{t.machine.disquesNote}</p>
        </div>
      ) : (
        <div className="carte rm">
          <div className="seg" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <button aria-pressed={!m.poulie} onClick={() => onChange({})}>{t.machine.normaleBouton}</button>
            <button aria-pressed={m.poulie === 2} onClick={() => onChange({ poulie: 2 })}>{t.machine.moufleBouton}<small>{t.machine.pile2}</small></button>
          </div>
          <p className="doux petit">{t.machine.moufleNote}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * Champ numérique : le toucher sélectionne la valeur, ce qu'on tape la remplace (avant, le « 0 »
 * restait devant). Vide pendant la frappe sans rien envoyer ; à la sortie, revient à la valeur.
 */
function Champ({ valeur, mode, onChange }: { valeur: number; mode: "decimal" | "numeric"; onChange: (n: number) => void }) {
  const [texte, setTexte] = useState<string | null>(null);
  return (
    <input type="number" inputMode={mode} value={texte ?? String(valeur)}
           onFocus={(ev) => { setTexte(String(valeur)); ev.currentTarget.select(); }}
           onChange={(ev) => {
             setTexte(ev.target.value);
             const n = Number(ev.target.value.replace(",", "."));
             if (ev.target.value.trim() && Number.isFinite(n)) onChange(n);
           }}
           onBlur={() => setTexte(null)} />
  );
}

/** 1RM figés du bloc (saisis une fois) et poids de corps (lesté). */
function Formulaire1RM({ exos, bloc, pdc, assurerBloc, changerBloc, onPdc, onErreur, estime, x }: {
  /** Exos en % du 1RM du programme (`exosPct1rm`) ; aucun : seul le poids de corps se saisit. */
  exos: string[]; bloc: Bloc | undefined; pdc: number | undefined; assurerBloc: () => Promise<Bloc>;
  changerBloc: (b: Bloc) => Promise<void>; onPdc: (kg: number) => void; onErreur: (e: unknown) => void;
  /** 1RM estimé depuis l'historique, utilisé quand le bloc n'en a pas. */
  estime: (id: string) => number | undefined;
  /** Exercice monté dans la salle du jour (chariot). */
  x: (id: string) => Exercice;
}) {
  const manque = exos.filter((id) => bloc?.rm[id] === undefined && estime(id) === undefined).length;

  const lire = (v: string) => {
    const n = Number(v.replace(",", "."));
    return v.trim() && Number.isFinite(n) && n > 0 ? n : null;
  };
  const rm = async (id: string, v: string) => {
    const n = lire(v);
    try {
      const b = await assurerBloc();
      const r = { ...b.rm };
      if (n === null) delete r[id];
      else r[id] = n;
      await changerBloc({ ...b, rm: r });
    } catch (e) {
      onErreur(e);
    }
  };
  const poids = (v: string) => {
    const n = lire(v);
    if (n === null) return;
    noterPoidsCorps(jourLocal(new Date()), n).then(() => onPdc(n), onErreur);
  };

  return (
    <details className="carte rm">
      <summary>{exos.length ? t.rm.titre : t.commun.poidsCorps}{manque ? t.rm.aSaisir(manque) : ""}{pdc === undefined ? t.rm.peseeManquante : ""}</summary>
      {exos.map((id) => (
        <label key={id}>
          {x(id).nom}{x(id).charge === "poids-corps-leste" ? t.rm.leste : x(id).aVide ? t.rm.aVide(nombre(x(id).aVide as number)) : ""}
          <ChampSur defaut={bloc?.rm[id]} placeholder={estime(id) === undefined ? t.rm.calibrer : `≈ ${nombre(Math.round(estime(id) as number))}`}
                    douteux={(kg) => chargeDouteuse(kg, bloc?.rm[id] ?? estime(id))} onValeur={(v) => rm(id, v)} />
        </label>
      ))}
      <label>
        {t.commun.poidsCorps}
        <ChampSur defaut={pdc} douteux={(kg) => poidsCorpsDouteux(kg, pdc)} onValeur={poids} />
      </label>
      {exos.length > 0 && <p className="doux petit">{t.rm.note}</p>}
    </details>
  );
}
