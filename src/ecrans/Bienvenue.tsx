import { useState } from "react";
import { noterPoidsCorps } from "../donnees/bloc";
import { FORMAT, jourLocal } from "../donnees/fichier";
import { PROGRAMME_DEFAUT, PROGRAMMES } from "../donnees/programme";
import type { Reglages } from "../donnees/reglages";
import type { Sexe } from "../donnees/stats";
import { THEME_DEFAUT } from "../themes";
import Restaurer from "./Restaurer";

/** Premier lancement d'une installation neuve : de quoi ouvrir la première séance, rien de plus. */
export default function EcranBienvenue({ onFini, onErreur }: { onFini: (r: Reglages) => void; onErreur: (e: unknown) => void }) {
  const [prenom, setPrenom] = useState("");
  const [sexe, setSexe] = useState<Sexe>("homme");
  const [poids, setPoids] = useState("");
  const [prog, setProg] = useState(PROGRAMME_DEFAUT);

  const kg = Number(poids.replace(",", "."));
  const poidsOk = !poids.trim() || (Number.isFinite(kg) && kg > 0);

  const commencer = async () => {
    try {
      if (poids.trim()) await noterPoidsCorps(jourLocal(new Date()), kg);
      // Pas d'envoi Nextcloud : le dossier de dépôt est celui de Tom. Sauvegarde = export manuel (Réglages).
      onFini({ format: FORMAT, theme: THEME_DEFAUT, prenom: prenom.trim() || undefined, sexe, programme: prog, envoi: false });
    } catch (e) {
      onErreur(e);
    }
  };

  return (
    <>
      <h1>ExziFit</h1>
      <div className="carte rm">
        <label>
          Prénom
          <input value={prenom} onChange={(ev) => setPrenom(ev.target.value)} autoComplete="given-name" />
        </label>
        <label>
          Poids de corps (kg)
          <input type="number" inputMode="decimal" value={poids} onChange={(ev) => setPoids(ev.target.value)} />
        </label>
      </div>

      <h2>Personnage</h2>
      <div className="choix">
        {(["homme", "femme"] as const).map((x) => (
          <button key={x} aria-pressed={sexe === x} onClick={() => setSexe(x)}>
            {x === "homme" ? "Homme" : "Femme"}
          </button>
        ))}
      </div>

      <h2>Programme</h2>
      <div className="seg" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {PROGRAMMES.map((x) => (
          <button key={x.id} aria-pressed={x.id === prog} onClick={() => setProg(x.id)}>
            {x.nom}<small>{x.jours.length} jours{x.semaines.length > 1 ? ` · ${x.semaines.length} semaines` : ""}</small>
          </button>
        ))}
      </div>
      <p className="doux petit">Tout se change ensuite : programme sur l'accueil, le reste dans les réglages.</p>

      <button className="principal" disabled={!poidsOk} onClick={commencer}>Commencer</button>
      <p className="doux petit">
        Tes données restent sur ce téléphone. Pour les garder ailleurs : Réglages → Exporter les données.
      </p>

      <h2>Nouveau téléphone ?</h2>
      <Restaurer remplace={false} onErreur={onErreur} />
    </>
  );
}
