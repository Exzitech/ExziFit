import { useEffect, useState } from "react";
import { jourLocal } from "./donnees/fichier";
import { ecrireReglages, lireReglages, type Reglages } from "./donnees/reglages";
import EcranReglages from "./ecrans/Reglages";
import EcranSeance from "./ecrans/Seance";
import MiseAJour, { surAndroid } from "./MiseAJour";
import { stockage } from "./stockage";
import { appliquerTheme } from "./themes";

type Ecran = "seance" | "reglages";

export default function App() {
  const [ecran, setEcran] = useState<Ecran>("seance");
  const [reglages, setReglages] = useState<Reglages | null>(null);
  const [erreurs, setErreurs] = useState<string[]>([]);
  // Pendant une séance, le bas de l'écran est à la saisie (pouce) : pas de barre de navigation.
  const [enSeance, setEnSeance] = useState(false);

  const signaler = (contexte: string) => (e: unknown) =>
    setErreurs((l) => [...l, `${contexte} : ${e instanceof Error ? e.message : String(e)}`]);

  useEffect(() => {
    lireReglages()
      .then((r) => {
        appliquerTheme(r.theme);
        setReglages(r);
      })
      .catch(signaler("Réglages"));
    // Une copie datée par jour, au lancement, avant toute écriture de séance ; puis envoi sur
    // Nextcloud en arrière-plan (la dernière copie existante, même si celle du jour a échoué).
    stockage
      .sauvegardeDuJour(jourLocal(new Date()))
      .catch(signaler("Sauvegarde du jour"))
      .then(() => stockage.envoyerSauvegarde())
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
        {ecran === "seance" && <EcranSeance onErreur={signaler("Séance")} onEnSeance={setEnSeance} />}
        {ecran === "reglages" && reglages && (
          <EcranReglages reglages={reglages} onChange={changerReglages} onErreur={signaler("Minuteur")} />
        )}
      </main>
      {!enSeance && <nav>
        <button aria-current={ecran === "seance" ? "page" : undefined} onClick={() => setEcran("seance")}>
          Séance
        </button>
        <button aria-current={ecran === "reglages" ? "page" : undefined} onClick={() => setEcran("reglages")}>
          Réglages
        </button>
      </nav>}
    </>
  );
}
