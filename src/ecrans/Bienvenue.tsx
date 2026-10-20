import { useState } from "react";
import { useBoutonRetour } from "../boutonRetour";
import { poidsCorpsDouteux } from "../donnees/aberrant";
import { noterPoidsCorps } from "../donnees/bloc";
import { BUTS, programmePropose, SEANCES_SEMAINE, type But } from "../donnees/bienvenue";
import { exercice } from "../donnees/exercices";
import { FORMAT, jourLocal } from "../donnees/fichier";
import { nombre, PROGRAMMES, tropFacile } from "../donnees/programme";
import { estPerso } from "../donnees/programmes-perso";
import type { Reglages } from "../donnees/reglages";
import type { Sexe } from "../donnees/stats";
import { LANGUES, langueDuSysteme, t, type Langue } from "../i18n";
import { appliquerLangue } from "../langue";
import { THEME_DEFAUT } from "../themes";
import Apercu from "./Apercu";
import EditeurProgramme from "./EditeurProgramme";
import { Avatar } from "./Personnage";
import Restaurer from "./Restaurer";

const ETAPES = 3;
const DEBUTANT = { force: 0, endurance: 0, constance: 0 };

/**
 * Premier lancement d'une installation neuve, en trois écrans (maquette A choisie par Tom le
 * 2026-10-20) : qui s'entraîne, comment (programme proposé), puis une série d'exemple. Rien n'est
 * écrit avant « Commencer ».
 */
export default function EcranBienvenue({ onFini, onErreur }: { onFini: (r: Reglages) => void; onErreur: (e: unknown) => void }) {
  const [etape, setEtape] = useState(0);
  // Proposée d'après le téléphone, déjà appliquée par main.tsx.
  const [langue, setLangue] = useState<Langue>(langueDuSysteme);
  const [prenom, setPrenom] = useState("");
  const [sexe, setSexe] = useState<Sexe>("homme");
  const [poids, setPoids] = useState("");
  const [but, setBut] = useState<But>();
  const [seances, setSeances] = useState(4);
  /** Programme choisi dans la liste complète ; absent = celui proposé d'après le but. */
  const [choix, setChoix] = useState<string>();
  const [tous, setTous] = useState(false);
  // `null` : pas d'éditeur ; `"nouveau"` ou l'id du programme modifié.
  const [edition, setEdition] = useState<string | null>(null);
  useBoutonRetour(etape > 0 && edition === null ? () => setEtape((e) => e - 1) : null, onErreur);

  const prog = choix ?? (but && programmePropose(but, seances));
  const choisi = PROGRAMMES.find((x) => x.id === prog);

  const kg = Number(poids.replace(",", "."));
  const poidsOk = !poids.trim() || (Number.isFinite(kg) && kg > 0);
  // Poids douteux (820 pour 82) : « Sûr ? » au premier toucher de Suivant.
  const [poidsVu, setPoidsVu] = useState<string | null>(null);
  const doute = poids.trim() !== "" && poidsOk && poidsCorpsDouteux(kg);

  const changerLangue = (l: Langue) => {
    appliquerLangue(l);
    setLangue(l);
  };

  const commencer = async () => {
    try {
      if (poids.trim()) await noterPoidsCorps(jourLocal(new Date()), kg);
      // Pas d'envoi Nextcloud : le dossier de dépôt est celui de Tom. Sauvegarde = export manuel (Réglages).
      onFini({ format: FORMAT, theme: THEME_DEFAUT, langue, prenom: prenom.trim() || undefined, sexe, programme: prog, envoi: false });
    } catch (e) {
      onErreur(e);
    }
  };

  if (edition !== null) {
    // Tout le reste vit dans l'état de ce composant : rien n'est perdu au retour.
    return (
      <EditeurProgramme initial={edition === "nouveau" ? undefined : choisi} onErreur={onErreur}
                        onEnregistre={(p) => { setChoix(p.id); setEdition(null); }} onAnnuler={() => setEdition(null)} />
    );
  }

  const haut = (
    <>
      {etape > 0 && <button className="lien" onClick={() => setEtape(etape - 1)}>{t.bienvenue.retour}</button>}
      <p className="doux petit">{t.bienvenue.etape(etape + 1, ETAPES)}</p>
      <div className="etapes" aria-hidden="true">
        {Array.from({ length: ETAPES }, (_, i) => <span key={i} className={i <= etape ? "faite" : undefined} />)}
      </div>
    </>
  );

  if (etape === 0) {
    return (
      <>
        {haut}
        <h1>{t.bienvenue.qui}</h1>
        <div className="seg" style={{ gridTemplateColumns: "1fr 1fr 1fr" }} aria-label={t.commun.langue}>
          {LANGUES.map((l) => (
            <button key={l.id} lang={l.id} aria-pressed={langue === l.id} onClick={() => changerLangue(l.id)}>{l.nom}</button>
          ))}
        </div>
        <p className="doux petit">{t.bienvenue.quiNote}</p>
        <div className="avatars">
          <Avatar p={DEBUTANT} sexe={sexe} taille={5} nom={t.commun.personnage} />
        </div>
        <div className="carte rm">
          <label>
            {t.commun.prenom}
            <input value={prenom} onChange={(ev) => setPrenom(ev.target.value)} autoComplete="given-name" />
          </label>
        </div>
        <div className="choix espace-haut">
          {(["homme", "femme"] as const).map((x) => (
            <button key={x} aria-pressed={sexe === x} onClick={() => setSexe(x)}>{t.commun[x]}</button>
          ))}
        </div>
        <p className="doux petit">{t.bienvenue.sexeNote}</p>
        <button className="principal espace-haut" onClick={() => setEtape(1)}>{t.bienvenue.suivant}</button>
        <div className="fin-sans-nav">
          <h2>{t.bienvenue.nouveau}</h2>
          <Restaurer remplace={false} onErreur={onErreur} />
        </div>
      </>
    );
  }

  if (etape === 1) {
    const suivant = () => (doute && poidsVu !== poids ? setPoidsVu(poids) : setEtape(2));
    return (
      <>
        {haut}
        <h1>{t.bienvenue.comment}</h1>
        <h2>{t.bienvenue.but}</h2>
        <div className="choix">
          {BUTS.map((b) => (
            <button key={b} aria-pressed={!choix && but === b} onClick={() => { setBut(b); setChoix(undefined); }}>{t.bienvenue.buts[b]}</button>
          ))}
        </div>
        {but === "muscle" && !choix && (
          <>
            <h2>{t.bienvenue.seances}</h2>
            <div className="seg" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
              {SEANCES_SEMAINE.map((n) => <button key={n} aria-pressed={seances === n} onClick={() => setSeances(n)}>{n}</button>)}
            </div>
          </>
        )}
        <div className="carte rm espace-haut">
          <label>
            {t.commun.poidsCorpsKg}
            <input type="number" inputMode="decimal" value={poids} onChange={(ev) => setPoids(ev.target.value)} />
          </label>
        </div>
        <p className="doux petit">{t.bienvenue.poidsNote}</p>
        {choisi && (
          <>
            <h2>{choix ? t.commun.programme : t.bienvenue.propose}</h2>
            <Apercu p={choisi} />
          </>
        )}
        <div className="liens">
          <button className="lien" onClick={() => setTous(!tous)}>{tous ? t.bienvenue.masquer : t.bienvenue.autres}</button>
          {choisi && estPerso(choisi.id) && <button className="lien" onClick={() => setEdition(choisi.id)}>{t.commun.modifier(choisi.nom)}</button>}
        </div>
        {tous && (
          <>
            <div className="seg" style={{ gridTemplateColumns: "1fr 1fr" }}>
              {PROGRAMMES.map((x) => (
                <button key={x.id} aria-pressed={x.id === prog} onClick={() => setChoix(x.id)}>
                  {x.nom}<small>{t.commun.jours(x.jours.length)}{x.semaines.length > 1 ? ` · ${t.commun.semaines(x.semaines.length)}` : ""}</small>
                </button>
              ))}
            </div>
            <button className="lien" onClick={() => setEdition("nouveau")}>{t.bienvenue.creer}</button>
          </>
        )}
        <button className="principal espace-haut" disabled={!poidsOk || !prog} onClick={suivant}>
          {doute && poidsVu === poids ? t.seance.sur(`${poids} kg · ${t.bienvenue.suivant}`) : t.bienvenue.suivant}
        </button>
        {!prog && <p className="doux petit">{t.bienvenue.choisir}</p>}
      </>
    );
  }

  return (
    <>
      {haut}
      <h1>{t.bienvenue.exemple}</h1>
      <p className="doux petit">{t.bienvenue.exempleNote}</p>
      <Exemple />
      <p className="doux petit">{t.bienvenue.ensuite}</p>
      <button className="principal espace-haut" onClick={commencer}>{t.bienvenue.commencer}</button>
      <p className="doux petit fin-sans-nav">{t.bienvenue.donnees}</p>
    </>
  );
}

/** Série d'exemple, rien d'écrit : Valider, puis la réserve, et ce que l'app en ferait (vrai calcul). */
function Exemple() {
  const [validee, setValidee] = useState(false);
  const [rir, setRir] = useState<number>();
  const e = exercice("developpe-couche");
  const pr = { type: "fourchette" as const, series: 4, repsMin: 8, repsMax: 12, rir: 2 };
  const serie = { type: "travail" as const, kg: 80, reps: 10, rir };
  const monte = rir === undefined ? null : tropFacile(e, pr, serie, 10);
  const verdict = rir === undefined ? null
    : monte !== null ? t.bienvenue.exMonte(nombre(monte)) : rir >= 2 ? t.bienvenue.exMeme : t.bienvenue.exDur;
  return (
    <div className="carte">
      <h2 className="titre-carte">{e.nom}</h2>
      <p className="doux petit">{t.bienvenue.exSerie}</p>
      <p className="exemple-serie"><b>80</b> kg · <b>10</b> reps</p>
      {!validee ? (
        <button className="principal" onClick={() => setValidee(true)}>{t.bienvenue.exValider}</button>
      ) : (
        <>
          <p className="petit">{t.bienvenue.exReserve}</p>
          <div className="seg" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
            {[0, 1, 2, 3, 4].map((n) => <button key={n} aria-pressed={rir === n} onClick={() => setRir(n)}>{n === 4 ? "4+" : n}</button>)}
          </div>
          {verdict && <p className="petit accent">{verdict}</p>}
        </>
      )}
    </div>
  );
}
