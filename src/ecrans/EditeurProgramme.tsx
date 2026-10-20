import { useState } from "react";
import { useBoutonRetour } from "../boutonRetour";
import { EXERCICES, exercice } from "../donnees/exercices";
import type { Programme } from "../donnees/programme";
import {
  brouillonComplet, enregistrerProgramme, nouvelId, OBJECTIFS, reglageExo, versBrouillon, versProgramme,
  type Brouillon, type JourBrouillon, type Objectif,
} from "../donnees/programmes-perso";
import { MUSCLES } from "../donnees/stats";
import { t } from "../i18n";
import Apercu from "./Apercu";
import Repos from "./Repos";

/**
 * Exos proposés, rangés par premier muscle principal puis par nom (celui de la langue courante) ;
 * la distance n'entre pas dans une fourchette de reps.
 */
const parMuscle = () => MUSCLES
  .map((m) => [m, EXERCICES.filter((e) => e.charge !== "distance" && e.muscles.principaux[0] === m)
    .sort((a, b) => a.nom.localeCompare(b.nom, t.locale))] as const)
  .filter(([, l]) => l.length > 0);

const jourVide = (): JourBrouillon => ({ nom: "", objectif: "hypertrophie", exos: [] });

/** Écrire un programme, ou modifier un programme écrit dans l'app (`initial`). */
export default function EditeurProgramme({ initial, onEnregistre, onAnnuler, onErreur }: {
  initial?: Programme; onEnregistre: (p: Programme) => void; onAnnuler: () => void; onErreur: (e: unknown) => void;
}) {
  const [b, setB] = useState<Brouillon>(() => (initial ? versBrouillon(initial) : { nom: "", jours: [jourVide()] }));
  const [enCours, setEnCours] = useState(false);
  useBoutonRetour(onAnnuler, onErreur);

  // Toujours depuis l'état du moment : deux changements avant un rendu ne s'écrasent pas.
  const changerJour = (i: number, f: (j: JourBrouillon) => JourBrouillon) =>
    setB((x) => ({ ...x, jours: x.jours.map((j, k) => (k === i ? f(j) : j)) }));
  const complet = brouillonComplet(b);
  const [catalogue] = useState(parMuscle);
  const id = b.id ?? "perso-apercu";

  const enregistrer = async () => {
    setEnCours(true);
    try {
      const p = versProgramme(b, b.id ?? nouvelId(new Date()));
      await enregistrerProgramme(p);
      onEnregistre(p);
    } catch (e) {
      onErreur(e);
      setEnCours(false);
    }
  };

  return (
    <>
      <button className="lien" onClick={onAnnuler}>{t.editeur.annuler}</button>
      <h1>{initial ? t.editeur.modifier : t.editeur.nouveau}</h1>
      <div className="carte rm">
        <label>
          {t.editeur.nom}
          <input value={b.nom} onChange={(ev) => { const nom = ev.target.value; setB((x) => ({ ...x, nom })); }} placeholder={t.editeur.nomDefaut} />
        </label>
      </div>
      <p className="doux petit">{t.editeur.explication}</p>

      {b.jours.map((j, i) => (
        <div key={i} className="carte espace-haut">
          <div className="rm">
            <label>
              {t.editeur.jour(i + 1)}
              <input value={j.nom} onChange={(ev) => { const nom = ev.target.value; changerJour(i, (x) => ({ ...x, nom })); }} placeholder={t.editeur.jour(i + 1)} />
            </label>
          </div>
          <div className="seg objectifs" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            {(Object.keys(OBJECTIFS) as Objectif[]).map((o) => (
              <button key={o} aria-pressed={j.objectif === o} onClick={() => changerJour(i, (x) => ({ ...x, objectif: o }))}>
                {t.objectifs[o]}
              </button>
            ))}
          </div>
          {j.exos.map((x, rang) => {
            const r = reglageExo(j.objectif, rang, x);
            const changerExo = (f: (z: typeof x) => typeof x) => changerJour(i, (y) => ({
              ...y, exos: y.exos.map((z, k) => (k === rang ? f(z) : z)),
            }));
            const series = (n: number) => changerExo((z) => ({ ...z, series: Math.min(8, Math.max(1, n)) }));
            return (
              <div key={rang} className="exo-prog">
                <span>
                  {exercice(x.exo).nom}
                  <small className="doux">{rang === 0 ? t.editeur.principal : ""}{t.editeur.reglage(r.series, r.repsMin, r.repsMax)}</small>
                </span>
                <button className="puce" onClick={() => series(r.series - 1)} aria-label={t.editeur.moinsSerie}>−</button>
                <button className="puce" onClick={() => series(r.series + 1)} aria-label={t.editeur.plusSerie}>+</button>
                <button className="puce" aria-label={t.editeur.retirer}
                        onClick={() => changerJour(i, (y) => ({ ...y, exos: y.exos.filter((_, k) => k !== rang) }))}>✕</button>
                <span className="repos-ligne">
                  <span className="doux petit">{t.programmes.repos}</span>
                  <Repos valeur={r.repos} onChange={(repos) => changerExo((z) => ({ ...z, repos }))} />
                </span>
              </div>
            );
          })}
          <select className="ajout-exo" value="" aria-label={t.editeur.ajouterExoNom}
                  onChange={(ev) => { const exo = ev.target.value; if (exo) changerJour(i, (y) => ({ ...y, exos: [...y.exos, { exo }] })); }}>
            <option value="">{t.editeur.ajouterExo}</option>
            {catalogue.map(([m, l]) => (
              <optgroup key={m} label={t.muscles[m]}>
                {l.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
              </optgroup>
            ))}
          </select>
          {b.jours.length > 1 && (
            <button className="lien" onClick={() => setB((x) => ({ ...x, jours: x.jours.filter((_, k) => k !== i) }))}>{t.editeur.retirerJour}</button>
          )}
        </div>
      ))}
      <button className="espace-haut" onClick={() => setB((x) => ({ ...x, jours: [...x.jours, jourVide()] }))}>{t.editeur.ajouterJour}</button>

      {b.jours.some((j) => j.exos.length > 0) && (
        <>
          <h2>{t.editeur.resultat}</h2>
          <Apercu p={versProgramme({ ...b, nom: b.nom.trim() || t.editeur.nomDefaut, jours: b.jours.filter((j) => j.exos.length > 0) }, id)} />
        </>
      )}

      <div className="bas">
        {!complet && <p className="doux petit">{t.editeur.manque(b.nom.trim() !== "")}</p>}
        <button className="principal valider" disabled={!complet || enCours} onClick={enregistrer}>{t.commun.enregistrer}</button>
      </div>
    </>
  );
}
