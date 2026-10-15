import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";
import type { Reglages } from "../donnees/reglages";
import { ecrireSalles, lireSalles, type Salle } from "../donnees/salles";
import { lancerRepos, useReste } from "../minuteur";
import { jourLocal } from "../donnees/fichier";
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
  const [salles, setSalles] = useState<Salle[]>([]);
  const [export_, setExport] = useState("");
  const envoi = reglages.envoi !== false;

  useEffect(() => {
    stockage.dossier().then(setDossier, (e) => setDossier(`introuvable : ${e}`));
    if (envoi) stockage.sauvegardeEnvoyee().then((j) => setEnvoyee(j ?? "aucune"), (e) => setEnvoyee(`inconnue : ${e}`));
    if (dansTauri) getVersion().then(setVersion, (e) => setVersion(`inconnue : ${e}`));
    lireSalles().then(setSalles, onErreur);
  }, []);

  const changerSalles = (tous: Salle[]) => ecrireSalles(tous).then(() => setSalles(tous), onErreur);
  const renommer = (id: string, nom: string) => {
    if (nom.trim() && salles.some((x) => x.id === id && x.nom !== nom.trim())) {
      changerSalles(salles.map((x) => (x.id === id ? { ...x, nom: nom.trim() } : x)));
    }
  };
  const ajouter = () => {
    let n = salles.length + 1;
    while (salles.some((x) => x.id === `salle-${n}`)) n++;
    changerSalles([...salles, { id: `salle-${n}`, nom: `Salle ${n}`, machines: {} }]);
  };

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

      <h2>Personnage</h2>
      <div className="choix">
        {(["homme", "femme"] as const).map((x) => (
          <button key={x} aria-pressed={(reglages.sexe ?? "homme") === x} onClick={() => onChange({ ...reglages, sexe: x })}>
            {x === "homme" ? "Homme" : "Femme"}
          </button>
        ))}
      </div>
      <p className="doux petit">Change le dessin et les références de Force (niveau « très avancé » de chaque sexe).</p>
      <div className="carte rm">
        <label>
          Prénom
          <input defaultValue={reglages.prenom ?? ""}
                 onBlur={(ev) => ev.target.value.trim() !== (reglages.prenom ?? "") && onChange({ ...reglages, prenom: ev.target.value.trim() || undefined })} />
        </label>
      </div>

      <h2>Salles</h2>
      <div className="carte rm">
        {salles.map((x) => (
          <label key={x.id} className="petit">
            {Object.keys(x.machines).length} machine{Object.keys(x.machines).length > 1 ? "s" : ""} réglée{Object.keys(x.machines).length > 1 ? "s" : ""}
            <input defaultValue={x.nom} onBlur={(ev) => renommer(x.id, ev.target.value)} />
          </label>
        ))}
        <button onClick={ajouter}>Ajouter une salle</button>
        <p className="doux petit">
          Poids à vide et poulie à moufle se règlent pendant la séance, sous le nom de l'exercice ; la salle
          se choisit sur l'accueil.
        </p>
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
      <button onClick={() => stockage.exporter(jourLocal(new Date())).then((x) => setExport(`Exporté : ${x}`), onErreur)}>
        Exporter les données
      </button>
      {export_ && <p className="doux petit">{export_}</p>}
      <p className="doux petit">
        {envoi ? `Dernière copie envoyée sur Nextcloud : ${envoyee}` : "Copie quotidienne sur ce téléphone ; pour la garder ailleurs, exporter."}
      </p>

      <h2>Version</h2>
      <p className="doux petit">ExziFit {version}</p>
    </>
  );
}
