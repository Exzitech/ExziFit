import { useEffect, useState } from "react";
import { useBoutonRetour } from "../boutonRetour";
import { exercice } from "../donnees/exercices";
import { corrigerListe, corrigerSeance, facteurPoulie, lireSeances, type Seance, type Serie } from "../donnees/journal";
import { jourDeSeance } from "../donnees/programme";
import { t } from "../i18n";

/** Série en cours de correction : champs texte, pour taper « 102,5 » sans être interrompu. */
interface Brouillon { serie: Serie; kg: string; reps: string; rir: string }

const date = (iso: string) =>
  new Date(iso).toLocaleDateString(t.locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const heure = (iso: string) => new Date(iso).toLocaleTimeString(t.locale, { hour: "2-digit", minute: "2-digit" });
const titre = (s: Seance) => {
  const j = jourDeSeance(s);
  return j ? `${t.idJour(j.id)} · ${j.nom}` : t.journal.libre;
};

const nb = (v: string) => (v.trim() === "" ? NaN : Number(v.replace(",", ".")));

/** Série corrigée, ou le message qui dit quel champ est faux. La charge affichée est ÷ `f` (poulie). */
function relire(b: Brouillon, f: number): Serie | string {
  const kg = nb(b.kg), reps = nb(b.reps), rir = b.rir.trim() === "" ? undefined : nb(b.rir);
  if (!(kg >= 0)) return t.journal.kgInvalide(b.kg);
  if (!Number.isInteger(reps) || reps < 0) return t.journal.repsInvalides(b.reps);
  if (rir !== undefined && !(Number.isInteger(rir) && rir >= 0)) return t.journal.rirInvalide(b.rir);
  const s: Serie = { ...b.serie, kg: Math.round((kg / f) * 100) / 100, reps };
  if (rir === undefined) delete s.rir;
  else s.rir = rir;
  return s;
}

export default function EcranJournal({ onErreur }: { onErreur: (e: unknown) => void }) {
  const [seances, setSeances] = useState<Seance[] | null>(null);
  /** Séance ouverte, et ses séries en brouillon (par exo, dans l'ordre du journal). */
  const [ouverte, setOuverte] = useState<Seance | null>(null);
  const [brouillon, setBrouillon] = useState<Brouillon[][]>([]);
  const [modifie, setModifie] = useState(false);
  const [probleme, setProbleme] = useState<string | null>(null);
  // Supprimer en deux taps, comme Terminer : un geste raté ne doit rien effacer.
  const [suppressionDemandee, setSuppressionDemandee] = useState(false);

  useEffect(() => {
    lireSeances().then(setSeances).catch(onErreur);
  }, []);

  useBoutonRetour(ouverte ? () => setOuverte(null) : null, onErreur);

  if (!seances) return <h1>{t.journal.titre}</h1>;

  function ouvrir(s: Seance) {
    setOuverte(s);
    setBrouillon(s.exercices.map((x) => x.series.map((serie) => ({
      // Séparateur décimal de la langue (« 102,5 » ou « 102.5 »), sans séparateur de milliers ; `nb` lit les deux.
      serie, kg: (serie.kg * facteurPoulie(s, exercice(x.exo))).toLocaleString(t.locale, { maximumFractionDigits: 2, useGrouping: false }), reps: String(serie.reps), rir: serie.rir === undefined ? "" : String(serie.rir),
    }))));
    setModifie(false);
    setProbleme(null);
    setSuppressionDemandee(false);
  }

  async function ecrire(debut: string, nouvelle: Seance | null) {
    try {
      await corrigerSeance(debut, nouvelle);
      setSeances((l) => l && corrigerListe(l, debut, nouvelle));
      setOuverte(null);
    } catch (e) {
      onErreur(e);
    }
  }

  if (!ouverte) {
    return (
      <>
        <h1>{t.journal.titre}</h1>
        {seances.length === 0 && <p className="doux">{t.journal.aucune}</p>}
        <div className="liste">
          {[...seances].reverse().map((s) => (
            <button key={s.debut} className="ligne" onClick={() => ouvrir(s)}>
              <span>
                {date(s.debut)} · {heure(s.debut)}
                <small>{titre(s)} · {s.exercices.map((x) => exercice(x.exo).nom).join(", ")}</small>
              </span>
              <span className="avance">{s.exercices.reduce((n, x) => n + x.series.length, 0)}</span>
            </button>
          ))}
        </div>
      </>
    );
  }

  const s = ouverte;
  const changer = (ei: number, si: number, champ: "kg" | "reps" | "rir", v: string) => {
    setBrouillon((b) => b.map((l, i) => (i !== ei ? l : l.map((x, j) => (j === si ? { ...x, [champ]: v } : x)))));
    setModifie(true);
  };
  const retirer = (ei: number, si: number) => {
    setBrouillon((b) => b.map((l, i) => (i !== ei ? l : l.filter((_, j) => j !== si))));
    setModifie(true);
  };
  const reste = brouillon.reduce((n, l) => n + l.length, 0);

  const enregistrer = () => {
    const exercices = [];
    for (const [ei, x] of s.exercices.entries()) {
      const f = facteurPoulie(s, exercice(x.exo));
      const series: Serie[] = [];
      for (const b of brouillon[ei]) {
        const r = relire(b, f);
        if (typeof r === "string") return setProbleme(t.journal.probleme(exercice(x.exo).nom, r));
        series.push(r);
      }
      exercices.push({ ...x, series });
    }
    ecrire(s.debut, { ...s, exercices });
  };
  const supprimer = () => {
    if (!suppressionDemandee) return setSuppressionDemandee(true);
    ecrire(s.debut, null);
  };

  return (
    <>
      <div className="haut"><button className="lien" onClick={() => setOuverte(null)}>{t.journal.retour}</button></div>
      <h1>{date(s.debut)}</h1>
      <p className="doux">{titre(s)} · {heure(s.debut)}{s.fin ? ` → ${heure(s.fin)}` : ""}{s.poulie ? t.journal.poulie : ""}</p>
      {s.exercices.map((x, ei) => (
        <div key={ei} className="carte">
          <h2 className="titre-carte">{exercice(x.exo).nom}</h2>
          {brouillon[ei].length === 0 && <p className="doux petit">{t.journal.plusDeSerie}</p>}
          {brouillon[ei].map((b, si) => (
            <div key={si} className="corr">
              <span className="doux petit">{b.serie.type === "echauffement" ? t.journal.ech : b.serie.test ? t.journal.test : brouillon[ei].slice(0, si + 1).filter((x) => x.serie.type === "travail").length}</span>
              <label><input type="text" inputMode="decimal" value={b.kg} onChange={(e) => changer(ei, si, "kg", e.target.value)} />kg</label>
              <label><input type="text" inputMode="numeric" value={b.reps} onChange={(e) => changer(ei, si, "reps", e.target.value)} />{t.seance.reps}</label>
              <label><input type="text" inputMode="numeric" value={b.rir} placeholder="–" onChange={(e) => changer(ei, si, "rir", e.target.value)} />RIR</label>
              <button aria-label={t.journal.supprimerSerie} onClick={() => retirer(ei, si)}>✕</button>
            </div>
          ))}
        </div>
      ))}
      {probleme && <p className="alerte">{probleme}</p>}
      <p className="doux petit">{t.journal.corbeille}</p>
      <div className="bas">
        <button className="principal valider espace-bas" disabled={!modifie || reste === 0} onClick={enregistrer}>
          {reste === 0 ? t.journal.viderSeance : t.commun.enregistrer}
        </button>
        <button onClick={supprimer}>{suppressionDemandee ? t.journal.confirmer : t.journal.supprimer}</button>
      </div>
    </>
  );
}
