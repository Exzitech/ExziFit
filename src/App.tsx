import { useEffect, useRef, useState } from "react";
import { useBoutonRetour } from "./boutonRetour";
import { jourLocal, quandAnomalies, quandEcrit } from "./donnees/fichier";
import { ecrireReglages, lireReglages, type Reglages } from "./donnees/reglages";
import { poserRepos } from "./donnees/programme";
import { chargerProgrammesPerso } from "./donnees/programmes-perso";
import EcranBienvenue from "./ecrans/Bienvenue";
import { estSynchronise, synchroniser, type Bilan } from "./donnees/synchro";
import EcranJournal from "./ecrans/Journal";
import EcranPersonnage from "./ecrans/Personnage";
import EcranReglages from "./ecrans/Reglages";
import EcranSeance from "./ecrans/Seance";
import { estLangue, langueDuSysteme, t } from "./i18n";
import { appliquerLangue } from "./langue";
import MiseAJour, { surAndroid } from "./MiseAJour";
import AlarmeExacte from "./AlarmeExacte";
import { majNextcloud } from "./canal";
import { stockage } from "./stockage";
import { appliquerTheme } from "./themes";

/** Langue des réglages, sinon celle du téléphone. */
const langueDe = (r: Reglages) => (estLangue(r.langue) ? r.langue : langueDuSysteme());

type Ecran = "seance" | "journal" | "personnage" | "reglages";

/** Délai entre une écriture et la synchro qu'elle appelle (plusieurs écritures = une synchro). */
const SYNCHRO_APRES_MS = 5000;
/** Au retour au premier plan, pas plus d'une synchro par minute. */
const SYNCHRO_RETOUR_MS = 60_000;

export default function App() {
  const [ecran, setEcran] = useState<Ecran>("seance");
  // `undefined` : en lecture ; `null` : premier lancement (écran de bienvenue).
  const [reglages, setReglages] = useState<Reglages | null | undefined>(undefined);
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [anomalies, setAnomalies] = useState<string[]>([]);
  // Déjà montrées (même masquées) : un fichier se relit souvent, l'avertissement ne revient pas avant la relance.
  const anomaliesVues = useRef(new Set<string>());
  // Pendant une séance, le bas de l'écran est à la saisie (pouce) : pas de barre de navigation.
  const [enSeance, setEnSeance] = useState(false);
  const [bilan, setBilan] = useState<Bilan | null>(null);
  /** Change à chaque arrivée de données d'un autre appareil : les écrans se remontent et relisent. */
  const [generation, setGeneration] = useState(0);
  const [aRelire, setARelire] = useState(false);
  // Lus par la synchro, qui se termine hors du rendu : l'état du moment, pas celui du lancement.
  const ici = useRef({ ecran, enSeance });
  ici.current = { ecran, enSeance };

  const signaler = (contexte: string) => (e: unknown) =>
    setErreurs((l) => [...l, t.app.erreur(contexte, e instanceof Error ? e.message : String(e))]);
  const ctx = t.app.ctx;

  useBoutonRetour(ecran !== "seance" ? () => setEcran("seance") : null, signaler(ctx.boutonRetour));

  const synchro = () =>
    synchroniser()
      .then((b) => {
        setBilan(b);
        if (b.etat !== "ok" || !b.recues) return;
        // En séance ou en pleine correction au Journal, relire ferait perdre l'écran en cours : bandeau.
        if (ici.current.enSeance || ici.current.ecran === "journal") setARelire(true);
        else recharger();
      })
      .catch(signaler(ctx.synchro));

  /** Programmes perso et profil (prénom, programme choisi) arrivent aussi par la synchro. */
  const recharger = () =>
    chargerProgrammesPerso()
      .then(lireReglages)
      .then((r) => { if (r) { poserRepos(r.repos ?? {}); setReglages(r); } })
      .catch(signaler(ctx.synchro))
      .finally(() => setGeneration((g) => g + 1));

  const relire = () => {
    setARelire(false);
    recharger();
  };

  useEffect(() => {
    quandAnomalies((liste) => {
      const neuves = liste.filter((a) => !anomaliesVues.current.has(a));
      if (!neuves.length) return;
      neuves.forEach((a) => anomaliesVues.current.add(a));
      setAnomalies((l) => [...l, ...neuves]);
    });
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    quandEcrit((chemin) => {
      if (!estSynchronise(chemin)) return;
      clearTimeout(minuterie);
      minuterie = setTimeout(synchro, SYNCHRO_APRES_MS);
    });
    let derniere = Date.now();
    const auRetour = () => {
      if (document.visibilityState !== "visible" || Date.now() - derniere < SYNCHRO_RETOUR_MS) return;
      derniere = Date.now();
      synchro();
    };
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      clearTimeout(minuterie);
      document.removeEventListener("visibilitychange", auRetour);
    };
  }, []);

  useEffect(() => {
    // Programmes écrits dans l'app d'abord : les écrans les lisent dès leur premier rendu.
    // Fichier illisible : signalé, l'app s'ouvre avec les programmes du code.
    const lecture = chargerProgrammesPerso().catch(signaler(ctx.programmesPerso)).then(lireReglages);
    lecture
      .then((r) => {
        if (r) {
          appliquerTheme(r.theme);
          poserRepos(r.repos ?? {});
          appliquerLangue(langueDe(r));
        }
        setReglages(r);
      })
      .catch(signaler(ctx.reglages));
    // Une copie datée par jour, au lancement, avant toute écriture de séance ; puis envoi sur
    // Nextcloud en arrière-plan (la dernière copie existante, même si celle du jour a échoué),
    // pour l'installation de Tom seulement. Réglages illisibles : déjà signalé juste au-dessus, pas d'envoi.
    stockage
      .sauvegardeDuJour(jourLocal(new Date()))
      .catch(signaler(ctx.sauvegarde))
      .then(() => lecture.catch(() => null))
      .then((r) => (r && r.envoi !== false ? stockage.envoyerSauvegarde() : null))
      .catch(signaler(ctx.envoi))
      .then(synchro);
  }, []);

  const changerReglages = (r: Reglages) => {
    appliquerTheme(r.theme);
    poserRepos(r.repos ?? {});
    appliquerLangue(langueDe(r));
    setReglages(r);
    ecrireReglages(r).catch(signaler(ctx.enregistrement));
  };

  return (
    <>
      {erreurs.length > 0 && (
        <div className="erreurs" role="alert">
          {erreurs.map((m, i) => <div className="erreur" key={i}>{m}</div>)}
        </div>
      )}
      {anomalies.length > 0 && (
        <div className="erreurs">
          <div className="avertissement">
            <p>{t.app.anomalies}</p>
            <ul>{anomalies.map((a) => <li key={a}>{a}</li>)}</ul>
            <button onClick={() => setAnomalies([])}>{t.app.compris}</button>
          </div>
        </div>
      )}
      {surAndroid && majNextcloud && <MiseAJour />}
      {surAndroid && <AlarmeExacte />}
      {aRelire && !enSeance && (
        <div className="erreurs">
          <button className="principal" onClick={relire}>{t.app.recues}</button>
        </div>
      )}
      {/* Langue changée dans les réglages : les écrans se remontent, rien de leur état n'en garde l'ancienne. */}
      <main key={`${generation}-${reglages?.langue}`}>
        {reglages === null && <EcranBienvenue onFini={changerReglages} onErreur={signaler(ctx.bienvenue)} />}
        {ecran === "seance" && reglages && (
          <EcranSeance programmeChoisi={reglages.programme} sexe={reglages.sexe ?? "homme"} onProgramme={(programme) => changerReglages({ ...reglages, programme })}
                       onRepos={(repos) => changerReglages({ ...reglages, repos })}
                       onErreur={signaler(ctx.seance)} onEnSeance={setEnSeance} />
        )}
        {ecran === "journal" && <EcranJournal onErreur={signaler(ctx.journal)} />}
        {ecran === "personnage" && reglages && <EcranPersonnage programmeChoisi={reglages.programme} prenom={reglages.prenom} sexe={reglages.sexe ?? "homme"} onErreur={signaler(ctx.personnage)} />}
        {ecran === "reglages" && reglages && (
          <EcranReglages reglages={reglages} onChange={changerReglages} onErreur={signaler(ctx.reglages)}
                         bilan={bilan} onSynchro={synchro} />
        )}
      </main>
      {!enSeance && reglages && <nav>
        <button aria-current={ecran === "seance" ? "page" : undefined} onClick={() => setEcran("seance")}>
          {t.nav.seance}
        </button>
        <button aria-current={ecran === "journal" ? "page" : undefined} onClick={() => setEcran("journal")}>
          {t.nav.journal}
        </button>
        <button aria-current={ecran === "personnage" ? "page" : undefined} onClick={() => setEcran("personnage")}>
          {t.nav.perso}
        </button>
        <button aria-current={ecran === "reglages" ? "page" : undefined} onClick={() => setEcran("reglages")}>
          {t.nav.reglages}
        </button>
      </nav>}
    </>
  );
}
