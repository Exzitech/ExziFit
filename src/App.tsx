import { useEffect, useState } from "react";
import { useBoutonRetour } from "./boutonRetour";
import { jourLocal } from "./donnees/fichier";
import { ecrireReglages, lireReglages, type Reglages } from "./donnees/reglages";
import EcranBienvenue from "./ecrans/Bienvenue";
import EcranJournal from "./ecrans/Journal";
import EcranPersonnage from "./ecrans/Personnage";
import EcranReglages from "./ecrans/Reglages";
import EcranSeance from "./ecrans/Seance";
import MiseAJour, { surAndroid } from "./MiseAJour";
import { stockage } from "./stockage";
import { appliquerTheme } from "./themes";

type Ecran = "seance" | "journal" | "personnage" | "reglages";

export default function App() {
  const [ecran, setEcran] = useState<Ecran>("seance");
  // `undefined` : en lecture ; `null` : premier lancement (écran de bienvenue).
  const [reglages, setReglages] = useState<Reglages | null | undefined>(undefined);
  const [erreurs, setErreurs] = useState<string[]>([]);
  // Pendant une séance, le bas de l'écran est à la saisie (pouce) : pas de barre de navigation.
  const [enSeance, setEnSeance] = useState(false);

  const signaler = (contexte: string) => (e: unknown) =>
    setErreurs((l) => [...l, `${contexte} : ${e instanceof Error ? e.message : String(e)}`]);

  useBoutonRetour(ecran !== "seance" ? () => setEcran("seance") : null, signaler("Bouton retour"));

  useEffect(() => {
    const lecture = lireReglages();
    lecture
      .then((r) => {
        if (r) appliquerTheme(r.theme);
        setReglages(r);
      })
      .catch(signaler("Réglages"));
    // Une copie datée par jour, au lancement, avant toute écriture de séance ; puis envoi sur
    // Nextcloud en arrière-plan (la dernière copie existante, même si celle du jour a échoué),
    // pour l'installation de Tom seulement. Réglages illisibles : déjà signalé juste au-dessus, pas d'envoi.
    stockage
      .sauvegardeDuJour(jourLocal(new Date()))
      .catch(signaler("Sauvegarde du jour"))
      .then(() => lecture.catch(() => null))
      .then((r) => (r && r.envoi !== false ? stockage.envoyerSauvegarde() : null))
      .catch(signaler("Envoi de la sauvegarde"));
  }, []);

  const changerReglages = (r: Reglages) => {
    appliquerTheme(r.theme);
    setReglages(r);
    ecrireReglages(r).catch(signaler("Enregistrement des réglages"));
  };

  return (
    <>
      {erreurs.length > 0 && (
        <div className="erreurs" role="alert">
          {erreurs.map((m, i) => <div className="erreur" key={i}>{m}</div>)}
        </div>
      )}
      {surAndroid && <MiseAJour />}
      <main>
        {reglages === null && <EcranBienvenue onFini={changerReglages} onErreur={signaler("Bienvenue")} />}
        {ecran === "seance" && reglages && (
          <EcranSeance programmeChoisi={reglages.programme} sexe={reglages.sexe ?? "homme"} onProgramme={(programme) => changerReglages({ ...reglages, programme })}
                       onErreur={signaler("Séance")} onEnSeance={setEnSeance} />
        )}
        {ecran === "journal" && <EcranJournal onErreur={signaler("Journal")} />}
        {ecran === "personnage" && reglages && <EcranPersonnage programmeChoisi={reglages.programme} prenom={reglages.prenom} sexe={reglages.sexe ?? "homme"} onErreur={signaler("Personnage")} />}
        {ecran === "reglages" && reglages && (
          <EcranReglages reglages={reglages} onChange={changerReglages} onErreur={signaler("Réglages")} />
        )}
      </main>
      {!enSeance && reglages && <nav>
        <button aria-current={ecran === "seance" ? "page" : undefined} onClick={() => setEcran("seance")}>
          Séance
        </button>
        <button aria-current={ecran === "journal" ? "page" : undefined} onClick={() => setEcran("journal")}>
          Journal
        </button>
        <button aria-current={ecran === "personnage" ? "page" : undefined} onClick={() => setEcran("personnage")}>
          Perso
        </button>
        <button aria-current={ecran === "reglages" ? "page" : undefined} onClick={() => setEcran("reglages")}>
          Réglages
        </button>
      </nav>}
    </>
  );
}
