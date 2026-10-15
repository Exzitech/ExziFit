import { useEffect, useState } from "react";
import { ecrireBlocs, lireBlocs, lirePesees, noterPoidsCorps, type Bloc } from "../donnees/bloc";
import { EXERCICES, exercice, libelleCharge, type Exercice } from "../donnees/exercices";
import { horodatage, jourLocal } from "../donnees/fichier";
import {
  ajusterKg, archiverSeance, ecrireEnCours, historique, lireEnCours, lireSeances, proposition, supprimerEnCours,
  type Seance, type Serie,
} from "../donnees/journal";
import {
  ecrireSalles, exerciceEn, lireSalles, montage, normaliser, salleDe, salleRetenue, type Montage, type Salle,
} from "../donnees/salles";
import {
  avertissements, bilan, blocFini, cible, disques, echauffement, encouragement, etatTest, exosPct1rm, membres, nombre, ouvertureTest,
  jourDeSeance, preparation, programme, programmeDe, prochainJour, recalage, retour, rirVise, rmEffectif, rmNouveauBloc,
  semaineDe, type Bilan, type Cible, type Poste, type Programme, type Semaine,
} from "../donnees/programme";
import { seuilConstance, stats, type Pesee, type Sexe, type Stats } from "../donnees/stats";
import { useBoutonRetour } from "../boutonRetour";
import { Ecarts, seuilActuel } from "./Personnage";
import EcranProgrammes from "./Programmes";
import { annulerRepos, lancerRepos, useReste } from "../minuteur";

/** Repos d'un exo hors programme. */
const REPOS_S = 120;
/** Repos entre deux paliers de la montée guidée (séries légères). */
const REPOS_MONTEE_S = 90;
const RIR = [0, 1, 2, 3, 4];

type Vue = "jour" | "saisie" | "exos" | "remplacer";

/** Ligne de la séance : un poste du programme, ou un exo ajouté en plus (sans prescription). */
interface Ligne { membres: string[]; poste?: Poste }

const date = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
const serie = (s: Serie) => `${nombre(s.kg)}×${s.reps}${s.rir === undefined ? "" : ` R${s.rir}`}`;
const duree = (s: number) => (s < 60 ? `${s} s` : s % 60 ? `${Math.floor(s / 60)} min ${s % 60}` : `${s / 60} min`);
const charge = (e: Exercice, kg: number) =>
  e.charge === "poids-corps-leste" ? (kg ? `+${nombre(kg)} kg` : "PDC") : `${nombre(kg)} kg`;

/** « 5 × 5 · 127,5 kg · 80 % », « 3 × 8–10 · 60 kg ». */
function texteCible(e: Exercice, p: Poste, c: Cible): string {
  const kg = c.kg === null ? (p.prescription.type === "pct1rm" ? " · charge à calibrer" : "") : ` · ${charge(e, c.kg)}`;
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
  return [...prog, ...s.exercices.filter((x) => !x.remplace && !dansProg.has(x.exo)).map((x) => ({ membres: [x.exo] }))];
}

/** Exo réellement fait pour un membre (machine prise : chaîne des remplacements). */
function reel(s: Seance, id: string): string {
  for (let n = 0; n < 10; n++) {
    const r = s.exercices.find((x) => x.remplace === id);
    if (!r) break;
    id = r.exo;
  }
  return id;
}

/** Séries du jour sur un exo, échauffements de calibrage compris. */
const duJourTout = (s: Seance, id: string) => s.exercices.filter((x) => x.exo === id).flatMap((x) => x.series);
const faites = (s: Seance, id: string) => duJourTout(s, id).filter((x) => x.type === "travail");

/** Semaine d'une séance de programme (appelée seulement pour les lignes d'un jour). */
const semaineDeSeance = (s: Seance): Semaine => programmeDe(s)!.semaines[s.semaine ?? 0];

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
  const ids = l.membres.map((m) => reel(s, m));
  return ids.reduce((a, b) => (faites(s, b).length < faites(s, a).length ? b : a));
}

function complete(c: Ctx, s: Seance, l: Ligne): boolean {
  return l.membres.every((m) => {
    const id = reel(s, m);
    const ci = cibleDe(c, s, l, id);
    return ci !== null && faites(s, id).length >= ci.series;
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
      const raison = derTest ? `${serie(derTest)} → tentative suivante (visé : ${test.reps} à 0 RIR)` : "Ouverture à 95 % du max estimé.";
      return { kg, reps: test.reps, raison };
    }
    return { kg: avant?.kg ?? 0, reps: test.reps, raison: "Pas de max estimé : charge à choisir." };
  }
  const vise = l.poste ? rirVise(l.poste.prescription) : null;
  if (c && avant && vise !== null) {
    const kg = recalage(e, avant, c.reps, vise, poids, enCalibrage(s, l, id, c));
    if (kg !== null) {
      const sens = kg > avant.kg ? "on monte" : kg < avant.kg ? "on baisse" : "même charge";
      return { kg, reps: c.reps, raison: `${serie(avant)} → ${sens} (visé : ${c.reps} reps à ${vise} RIR)` };
    }
  }
  const duJour = faites(s, id);
  const der = duJour[duJour.length - 1];
  if (c && der && duJour.length >= c.series && der.reps < c.reps) {
    return { kg: retour(e, der.kg, poids), reps: c.reps, raison: "Série ratée : charge allégée de 10 % pour les séries en plus." };
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


export default function EcranSeance({ programmeChoisi, sexe, onProgramme, onErreur, onEnSeance }: {
  /** Programme de `reglages.json` : celui de l'accueil. Une séance en cours garde le sien. */
  programmeChoisi: string | undefined; onProgramme: (id: string) => void;
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
  // Terminer en deux taps : un geste raté avec les mains moites ne doit pas clore la séance.
  const [finDemandee, setFinDemandee] = useState(false);
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
  // résumé se ferme. Depuis la vue du jour, Android ferme l'app (la séance en cours est sur disque).
  const sousVue = seance
    ? vue !== "jour" && (vue !== "saisie" || lignes(seance)[ligne] !== undefined)
    : resume !== null;
  useBoutonRetour(sousVue ? () => (seance ? setVue("jour") : setResume(null)) : null, onErreur);
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

  if (!passees || !salles.length) return <h1>Séance</h1>;

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
    const b: Bloc = { id: `${jourLocal(new Date())}-${prog.id}`, programme: prog.id, debut: jourLocal(new Date()), fin: null, rm: {} };
    const tous = [...blocs, b];
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
        <h1>Séance terminée</h1>
        <p className="doux">{j ? `${j.id} · ${j.nom} · ` : ""}{b.minutes} min · {b.series} séries · {nombre(b.volume)} kg soulevés</p>
        {b.exos.map((x) => x.record && (
          <p key={x.exo} className="record">
            Record : {exercice(x.exo).nom}, 1RM estimé {nombre(Math.round(x.record.apres))} kg
            <span className="doux"> (avant {nombre(Math.round(x.record.avant))})</span>
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
                       onChoisir={(id) => { changerProgramme(id); setVoirProgrammes(false); }} onRetour={() => setVoirProgrammes(false)} />
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
          jour: prog.jours[jourChoisi].id, salle: salle.id, exercices: [],
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
    const apercu: Seance = { debut: "", programme: prog.id, semaine: semaineChoisie, jour: jour.id, salle: salle.id, exercices: [] };

    return (
      <>
        <h1>{prog.nom}</h1>
        <button className="lien" onClick={() => setVoirProgrammes(true)}>Changer de programme ›</button>
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
              {s.nom}<small>{s.label}</small>
            </button>
          ))}
        </div>}
        <div className="seg" style={{ gridTemplateColumns: `repeat(${prog.jours.length}, 1fr)` }}>
          {prog.jours.map((j, i) => (
            <button key={j.id} aria-pressed={i === jourChoisi}
                    onClick={() => (bloc ? choisirJour(prog, passees, bloc.id, i) : setJourChoisi(i))}>
              {j.id}
            </button>
          ))}
        </div>

        <div className="carte">
          <h2 className="titre-carte">{jour.id} · {jour.nom}{jour.optionnel ? " (optionnel)" : ""}</h2>
          {jour.note && <p className="doux petit">{jour.note}</p>}
          {avertissements(prog, jour, passees, new Date()).map((a) => <p key={a} className="alerte petit">{a}</p>)}
          <ol className="apercu">
            {jour.exercices.map((p, i) => {
              const l: Ligne = { membres: membres(p), poste: p };
              const id = membres(p)[0];
              const c = cibleDe(ctx, apercu, l, id);
              return (
                <li key={i}>
                  <b>{nomLigne(l.membres)}</b>{p.optionnel && <span className="badge">option</span>}
                  <span className="doux">{c && texteCible(ctx.x(id), p, c)} · repos {duree(p.repos)}</span>
                </li>
              );
            })}
          </ol>
          {prog.semaines.length > 1 && <p className="doux petit">{sem.nom} · {sem.label}</p>}
        </div>

        {(() => {
          const prep = preparation(jour.exercices.flatMap(membres).map(ctx.x));
          return (
            <details className="carte rm" open>
              <summary>Échauffement · ≈ {prep.minutes} min</summary>
              <ol className="apercu">{prep.etapes.map((t) => <li key={t}>{t}</li>)}</ol>
              <p className="doux petit">Puis la barre à vide et les séries d'approche, affichées à la saisie du premier exercice.</p>
            </details>
          );
        })()}

        {finiBloc ? (
          <div className="carte espace-haut">
            <h2 className="titre-carte">Bloc terminé</h2>
            <p className="doux petit">Démarrer ouvre un nouveau bloc en S1, avec ces 1RM (test du bloc, sinon meilleur estimé) :</p>
            {rmSuivants.map(([id, v]) => (
              <p key={id} className="petit">{exercice(id).nom} : {v === undefined ? "à calibrer" : `${nombre(v)} kg`}</p>
            ))}
          </div>
        ) : (
          <Formulaire1RM exos={exosPct1rm(prog)} bloc={bloc} pdc={pdc} assurerBloc={assurerBloc} changerBloc={changerBloc}
                         onPdc={(kg) => setPesees((l) => [...l.filter((x) => x.date !== jourLocal(new Date())), { date: jourLocal(new Date()), kg }])} onErreur={onErreur}
                         x={ctx.x} estime={(id) => rmEffectif(ctx.x(id), ctx.p, bloc?.id, undefined, pdc)} />
        )}

        <button className="lien" onClick={libre}>Séance libre (sans programme)</button>
        {passees.length > 0 && (
          <p className="doux petit">Dernière séance : {date(passees[passees.length - 1].debut)}
            {passees[passees.length - 1].jour ? ` (${passees[passees.length - 1].jour})` : ""}</p>
        )}

        <div className="bas">
          <button className="principal valider" onClick={demarrer}>
            {finiBloc ? "Nouveau bloc · " : "Démarrer "}{jour.id} · {jour.nom}
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
    <button className={cls} onClick={terminer}>{finDemandee ? "Confirmer la fin" : "Terminer la séance"}</button>
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
    const alternatives = (remplace && l?.poste?.alternatives) || [];
    // Alternatives du programme, puis les exos qui travaillent le même muscle principal.
    const muscles = remplace ? exercice(remplace).muscles.principaux : [];
    const proche = (e: Exercice) => (e.muscles.principaux.some((m) => muscles.includes(m)) ? 0 : 1);
    const autres = EXERCICES.filter((e) => !alternatives.includes(e.id) && e.id !== remplace);
    const liste = [...alternatives.map(exercice), ...autres.sort((a, b) => proche(a) - proche(b))];
    return (
      <>
        <button className="lien" onClick={() => setVue("jour")}>‹ Retour</button>
        <h1>{remplace ? `Remplacer ${exercice(remplace).nom}` : "Ajouter un exercice"}</h1>
        <div className="liste">
          {liste.map((e) => <button key={e.id} onClick={() => ajouterExo(e.id, remplace)}>{e.nom}</button>)}
        </div>
      </>
    );
  }

  if (vue === "jour" || !ls[ligne]) {
    return (
      <>
        <h1>{jour ? `${jour.id} · ${jour.nom}` : "Séance libre"}</h1>
        {jour && prog.semaines.length > 1 && <p className="doux petit">{semaineDeSeance(seance).nom} · {semaineDeSeance(seance).label}</p>}
        <div className="liste">
          {ls.map((l, i) => {
            const id = courant(seance, l);
            const c = cibleDe(ctx, seance, l, id);
            const fait = l.membres.map((m) => faites(seance, reel(seance, m)).length);
            const ok = complete(ctx, seance, l);
            return (
              <button key={i} className={ok ? "ligne faite" : "ligne"} onClick={() => { setAttente(null); ouvrir(ctx, seance, i); }}>
                <span>
                  <b>{nomLigne(l.membres.map((m) => reel(seance, m)))}</b>
                  {l.poste?.optionnel && <span className="badge">option</span>}
                  {l.poste && c && <small>{texteCible(ctx.x(id), l.poste, c)}</small>}
                </span>
                <span className="avance">{ok ? "✓" : `${Math.min(...fait)}/${c?.series ?? "–"}`}</span>
              </button>
            );
          })}
        </div>
        <div className="choix espace">
          <button onClick={() => setVue("exos")}>Ajouter un exo</button>
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
  const tout = duJourTout(seance, id);
  const finie = complete(ctx, seance, l);
  const autres = l.membres.map((m) => reel(seance, m)).filter((x) => x !== id);
  const suivante = premiereAFaire(ctx, seance, ligne);
  const leste = e.charge === "poids-corps-leste";
  const montee = enCalibrage(seance, l, id, c);
  const raison = prerempli(ctx, seance, l, id).raison;
  const test = testEnCours(ctx, seance, l, id);
  const enAttente = attente ? duJourTout(seance, attente).slice(-1)[0] : undefined;

  const valider = () => {
    setFinDemandee(false);
    // `prevu` = la prescription quand il y en a une : c'est elle qui mesure le point 3 de la v1.
    // Série en plus : ce que l'app a prérempli (charge de retour après une série ratée).
    // Recalage par le RIR : la série prévue est la charge recalée, pas la prescription brute.
    const pre = prerempli(ctx, seance, l, id);
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
    const compte = l.membres.map((m) => faites(nouvelle, reel(nouvelle, m)).length);
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

  // Disques par côté : sur une barre de 20 kg, ou sur une machine (disques seuls).
  const plaques = e.charge === "barre" ? disques(kg) : e.disques ? disques(kg, 0) : null;
  const passe = historique(ctx.p, id, 2);

  return (
    <div className="saisie">
      <div className="haut">
        <button className="lien" onClick={() => setVue("jour")}>‹ {jour ? jour.id : "Séance"} · {ls.filter((x) => complete(ctx, seance, x)).length}/{ls.length}</button>
        <button className="lien" onClick={() => setVue("remplacer")}>Remplacer</button>
      </div>

      <h1>{e.nom}{l.poste?.optionnel && <span className="badge">option</span>}</h1>
      {l.poste && c && (
        <p className="cible">
          {test
            ? `Test de ${nomTest(test.reps)} · tentative ${tout.filter((x) => x.test).length + 1}`
            : duJour.length < c.series
              ? `Série ${duJour.length + 1}/${c.series} · ${texteCible(e, l.poste, c)}`
              : `Série ${duJour.filter((x) => !x.test).length + 1} (en plus) · ${texteCible(e, l.poste, c)}`}
          {" "}· repos {duree(l.poste.repos)}
        </p>
      )}
      {(e.disques || e.charge === "poulie") && (
        <ReglageMachine key={`${salle.id}/${e.id}`} e={e} salle={salle} m={montage(salle, e)} onChange={changerMontage} />
      )}
      {autres.length > 0 && <p className="doux petit">Superset avec {nomLigne(autres)}</p>}
      {l.poste?.note && <p className="doux petit">{l.poste.note}</p>}
      {l.poste?.prescription.type === "pct1rm" && c?.kg === null && (
        <p className="doux petit">
          {leste && pdc === undefined
            ? "Poids de corps manquant (à noter sur l'accueil)."
            : montee
              ? "Calibrage : l'app monte la charge à chaque série selon ton RIR. Les paliers à 4+ comptent en échauffement."
              : "Calibré : la charge suit ton RIR série après série."}
        </p>
      )}
      {raison && !attente && <p className="doux petit">{raison}</p>}
      {l.poste?.role === "principal" && duJour.length === 0 && c?.kg && (
        <p className="doux petit">Échauffement : {echauffement(e, c.kg).join(" · ")}</p>
      )}
      {plaques && plaques.length > 0 && (
        <div className="disques" aria-label="disques par côté">
          {plaques.map((d, i) => <span key={i} className="disque" style={{ background: `var(--disque-${String(d).replace(".", "-")})` }}>{nombre(d)}</span>)}
          <span className="doux petit">par côté</span>
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
        ? <p className="alerte petit">Jamais fait : mets ta charge de départ, la prochaine fois elle sera préremplie.</p>
        : <p className="doux petit">Jamais fait.</p>)}

      <div className="bas">
        {fin > 0 && <div className={reste ? "compte" : "compte fini"}>{reste ? `${Math.floor(reste / 60)}:${String(reste % 60).padStart(2, "0")}` : "Go"}</div>}

        {attente ? (
          <>
            {/* Série ratée validée par réflexe : les reps se corrigent ici, avant le RIR. */}
            {enAttente && (
              <div className="reglage">
                <button onClick={() => corrigerDerniere((s) => ({ ...s, reps: Math.max(1, s.reps - 1) }))} aria-label="une rep de moins">−</button>
                <label><output>{enAttente.reps}</output><span>reps faites</span></label>
                <button onClick={() => corrigerDerniere((s) => ({ ...s, reps: s.reps + 1 }))} aria-label="une rep de plus">+</button>
              </div>
            )}
            <p className="question">Reps en réserve ?</p>
            <div className="rir">
              {RIR.map((r) => <button key={r} onClick={() => noterRir(r)}>{r === 4 ? "4+" : r}</button>)}
            </div>
          </>
        ) : test ? (
          <>
            <Reglage kg={kg} reps={reps} e={e} setKg={setKg} setReps={setReps} />
            <button className="principal valider espace-bas" onClick={valider}>Tentative · {nombre(kg)} × {reps}</button>
            {suivante !== null
              ? <button onClick={() => ouvrir(ctx, seance, suivante)}>Passer le test</button>
              : boutonTerminer()}
          </>
        ) : finie ? (
          <>
            <p className="encourage">{encouragement(e, duJour, ctx.p, seance.debut + id, pdc)}</p>
            <Reglage kg={kg} reps={reps} e={e} setKg={setKg} setReps={setReps} distance={l.poste?.prescription.type === "distance"} />
            <button className="espace-bas" onClick={valider}>Série en plus · {nombre(kg)} × {reps}</button>
            {suivante !== null
              ? <button className="principal valider" onClick={() => ouvrir(ctx, seance, suivante)}>
                  Suivant : {nomLigne(ls[suivante].membres.map((m) => reel(seance, m)))}
                  {ls[suivante].poste?.optionnel && <small>en option · si tu as encore du jus</small>}
                </button>
              : boutonTerminer("principal valider")}
          </>
        ) : (
          <>
            <Reglage kg={kg} reps={reps} e={e} setKg={setKg} setReps={setReps} distance={l.poste?.prescription.type === "distance"} />
            <button className="principal valider" onClick={valider}>Valider {nombre(kg)} × {reps}</button>
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
        <button onClick={() => setKg(ajusterKg(kg, e.pas, -1))} aria-label="moins de charge">−</button>
        <label>
          <Champ valeur={kg} mode="decimal" onChange={(n) => setKg(Math.max(0, n))} />
          <span>{libelleCharge(e)}</span>
        </label>
        <button onClick={() => setKg(ajusterKg(kg, e.pas, 1))} aria-label="plus de charge">+</button>
      </div>
      <div className="reglage">
        <button onClick={() => setReps(Math.max(1, reps - 1))} aria-label="une rep de moins">−</button>
        <label>
          <Champ valeur={reps} mode="numeric" onChange={(n) => setReps(Math.max(1, Math.round(n)))} />
          <span>{distance ? "m" : "reps"}</span>
        </label>
        <button onClick={() => setReps(reps + 1)} aria-label="une rep de plus">+</button>
      </div>
    </>
  );
}

/**
 * Réglage de la machine dans la salle du jour, replié sur une ligne : poids à vide (Smith, presse,
 * hack squat) ou poulie à moufle. On note toujours ce qui se lit sur la machine. Machine à disques
 * sans poids à vide noté dans cette salle : déplié d'office, avec un avertissement.
 */
function ReglageMachine({ e, salle, m, onChange }: { e: Exercice; salle: Salle; m: Montage; onChange: (m: Montage) => void }) {
  const manque = e.disques && !m.aVide;
  const [ouvert, setOuvert] = useState(manque);
  const resume = e.disques
    ? (m.aVide ? `${nombre(m.aVide)} kg à vide` : "poids à vide non noté")
    : (m.poulie ? "poulie à moufle (pile × 2)" : "poulie normale");
  return (
    <div className="machine">
      <button className="lien" onClick={() => setOuvert(!ouvert)}>{salle.nom} · {resume} {ouvert ? "▴" : "▾"}</button>
      {ouvert && (e.disques ? (
        <div className="carte rm">
          {manque && (
            <p className="alerte petit">
              Poids à vide pas encore noté ici : sans lui, 1RM, % et Force sont sous-estimés.
              Il est souvent écrit sur le chariot.
            </p>
          )}
          <label className="petit">
            Poids à vide (chariot, barre de la Smith)
            <Champ valeur={m.aVide ?? 0} mode="decimal" onChange={(n) => onChange(n > 0 ? { aVide: n } : {})} />
          </label>
          <p className="doux petit">Note les disques seuls : l'app ajoute ce poids pour le 1RM, les % et les stats.</p>
        </div>
      ) : (
        <div className="carte rm">
          <div className="seg" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <button aria-pressed={!m.poulie} onClick={() => onChange({})}>Normale</button>
            <button aria-pressed={m.poulie === 2} onClick={() => onChange({ poulie: 2 })}>Moufle<small>pile × 2</small></button>
          </div>
          <p className="doux petit">
            Note toujours le chiffre de la pile. Moufle : la pile affiche le double de ce que tu tires
            (26 kg ailleurs = 52 kg ici) ; l'app divise par deux pour comparer tes salles.
          </p>
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
      <summary>{exos.length ? "1RM du bloc" : "Poids de corps"}{manque ? ` · ${manque} à saisir ou calibrer` : ""}{pdc === undefined ? " · pesée manquante" : ""}</summary>
      {exos.map((id) => (
        <label key={id}>
          {x(id).nom}{x(id).charge === "poids-corps-leste" ? " (corps + lest)" : x(id).aVide ? ` (disques + ${nombre(x(id).aVide as number)} à vide)` : ""}
          <input type="number" inputMode="decimal" defaultValue={bloc?.rm[id] ?? ""} placeholder={estime(id) === undefined ? "calibrer" : `≈ ${nombre(Math.round(estime(id) as number))}`}
                 onBlur={(ev) => rm(id, ev.target.value)} />
        </label>
      ))}
      <label>
        Poids de corps
        <input type="number" inputMode="decimal" defaultValue={pdc ?? ""} onBlur={(ev) => poids(ev.target.value)} />
      </label>
      {exos.length > 0 && <p className="doux petit">
        Vide = estimé depuis ta dernière séance (≈), sinon montée guidée en séance. Le 1RM des % ne baisse
        jamais : la dernière séance du bloc le relève si elle a fait mieux (Epley avec la réserve).
      </p>}
    </details>
  );
}
