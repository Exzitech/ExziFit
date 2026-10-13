import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";
import type { Reglages } from "../donnees/reglages";
import { lancerRepos, useReste } from "../minuteur";
import { dansTauri, stockage } from "../stockage";
import { THEMES } from "../themes";

interface Props {
  reglages: Reglages;
  onChange: (r: Reglages) => void;
  onErreur: (e: unknown) => void;
}

export default function EcranReglages({ reglages, onChange, onErreur }: Props) {
  const [dossier, setDossier] = useState("…");
  const [envoyee, setEnvoyee] = useState("…");
  const [version, setVersion] = useState(dansTauri ? "…" : "navigateur (développement)");
  const [fin, setFin] = useState(0);
  const reste = useReste(fin);

  useEffect(() => {
    stockage.dossier().then(setDossier, (e) => setDossier(`introuvable : ${e}`));
    stockage.sauvegardeEnvoyee().then((j) => setEnvoyee(j ?? "aucune"), (e) => setEnvoyee(`inconnue : ${e}`));
    if (dansTauri) getVersion().then(setVersion, (e) => setVersion(`inconnue : ${e}`));
  }, []);

  return (
    <>
      <h1>Réglages</h1>

      <h2>Thème</h2>
      <div className="choix">
        {THEMES.map((t) => (
          <button
            key={t.id}
            aria-pressed={reglages.theme === t.id}
            onClick={() => onChange({ ...reglages, theme: t.id })}
          >
            {t.nom}
          </button>
        ))}
      </div>

      <h2>Minuteur</h2>
      <div className="carte">
        <div className="compte">{fin ? `${reste} s` : "–"}</div>
        <button className="principal" onClick={() => lancerRepos(15).then(setFin, onErreur)}>
          Tester la vibration (15 s)
        </button>
        <p className="doux petit">Verrouiller le téléphone : il doit vibrer à zéro.</p>
      </div>

      <h2>Données</h2>
      <p className="doux petit">{dossier}</p>
      <p className="doux petit">Dernière copie envoyée sur Nextcloud : {envoyee}</p>

      <h2>Version</h2>
      <p className="doux petit">ExziFit {version}</p>
    </>
  );
}
