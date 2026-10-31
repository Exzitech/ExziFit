import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "react";
import type { Reglages } from "../donnees/reglages";
import { ecrireSalles, lireSalles, type Salle } from "../donnees/salles";
import type { Bilan } from "../donnees/synchro";
import { lancerRepos, useReste } from "../minuteur";
import { jourLocal } from "../donnees/fichier";
import { LANGUES, langueDuSysteme, t, type Langue } from "../i18n";
import { nextcloud } from "../canal";
import { dansTauri, stockage, type InfoSynchro } from "../stockage";
import { THEMES } from "../themes";
import Restaurer from "./Restaurer";

interface Props {
  reglages: Reglages;
  onChange: (r: Reglages) => void;
  onErreur: (e: unknown) => void;
  bilan: Bilan | null;
  onSynchro: () => Promise<void>;
}

export default function EcranReglages({ reglages, onChange, onErreur, bilan, onSynchro }: Props) {
  const [dossier, setDossier] = useState("…");
  const [envoyee, setEnvoyee] = useState("…");
  const [version, setVersion] = useState(dansTauri ? "…" : t.reglages.navigateur);
  const [fin, setFin] = useState(0);
  const reste = useReste(fin);
  const [salles, setSalles] = useState<Salle[]>([]);
  const [export_, setExport] = useState("");
  const envoi = nextcloud && reglages.envoi !== false;

  useEffect(() => {
    stockage.dossier().then(setDossier, (e) => setDossier(t.reglages.introuvable(String(e))));
    if (envoi) stockage.sauvegardeEnvoyee().then((j) => setEnvoyee(j ?? t.reglages.aucune), (e) => setEnvoyee(t.reglages.inconnue(String(e))));
    if (dansTauri) getVersion().then(setVersion, (e) => setVersion(t.reglages.inconnue(String(e))));
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
    changerSalles([...salles, { id: `salle-${n}`, nom: t.reglages.salle(n), machines: {} }]);
  };
  const langue = reglages.langue ?? langueDuSysteme();

  return (
    <>
      <h1>{t.reglages.titre}</h1>

      <h2>{t.commun.langue}</h2>
      <select className="langue" value={langue} aria-label={t.commun.langue}
              onChange={(e) => onChange({ ...reglages, langue: e.target.value as Langue })}>
        {LANGUES.map((l) => <option key={l.id} value={l.id} lang={l.id}>{l.nom}</option>)}
      </select>

      <h2>{t.reglages.theme}</h2>
      <div className="choix">
        {THEMES.map((x) => (
          <button
            key={x.id}
            aria-pressed={reglages.theme === x.id}
            onClick={() => onChange({ ...reglages, theme: x.id })}
          >
            {t.themes[x.id]}
          </button>
        ))}
      </div>

      <details className="carte rm">
        <summary>{t.commun.personnage}</summary>
        <div className="choix">
          {(["homme", "femme"] as const).map((x) => (
            <button key={x} aria-pressed={(reglages.sexe ?? "homme") === x} onClick={() => onChange({ ...reglages, sexe: x })}>
              {t.commun[x]}
            </button>
          ))}
        </div>
        <p className="doux petit">{t.reglages.sexe}</p>
        <label>
          {t.commun.prenom}
          <input defaultValue={reglages.prenom ?? ""}
                 onBlur={(ev) => ev.target.value.trim() !== (reglages.prenom ?? "") && onChange({ ...reglages, prenom: ev.target.value.trim() || undefined })} />
        </label>
      </details>

      <details className="carte rm">
        <summary>{t.reglages.salles}</summary>
        {salles.map((x) => (
          <div key={x.id}>
            <label className="petit">
              {t.reglages.machines(Object.keys(x.machines).length)}
              <input defaultValue={x.nom} onBlur={(ev) => renommer(x.id, ev.target.value)} />
            </label>
          </div>
        ))}
        <button onClick={ajouter}>{t.reglages.ajouterSalle}</button>
        <p className="doux petit">{t.reglages.sallesNote}</p>
      </details>

      <details className="carte rm">
        <summary>{t.reglages.donnees}</summary>
        <button onClick={() => stockage.exporter(jourLocal(new Date())).then((x) => setExport(t.reglages.exporte(x)), onErreur)}>
          {t.reglages.exporter}
        </button>
        {export_ && <p className="doux petit">{export_}</p>}
        <Restaurer remplace onErreur={onErreur} />
        <p className="doux petit">{envoi ? t.reglages.envoyee(envoyee) : t.reglages.copieLocale}</p>
        <p className="doux petit">{dossier}</p>
      </details>

      {nextcloud && <Synchro bilan={bilan} onSynchro={onSynchro} onErreur={onErreur} />}

      <details className="carte rm">
        <summary>{t.reglages.minuteur}</summary>
        <div className="compte">{fin ? `${reste} s` : "–"}</div>
        <button className="principal" onClick={() => lancerRepos(15).then(setFin, onErreur)}>
          {t.reglages.tester}
        </button>
        <p className="doux petit">{t.reglages.verrouiller}</p>
      </details>

      <p className="doux petit">{t.reglages.version} : ExziFit {version}</p>
      <p className="doux petit">{t.reglages.illustrations}</p>
    </>
  );
}

const heure = (d: Date) => d.toLocaleString(t.locale, { weekday: "short", hour: "2-digit", minute: "2-digit" });

function texteBilan(b: Bilan | null): string {
  if (!b) return t.synchro.pasLancee;
  if (b.etat === "non-configure") return t.synchro.pasConfiguree;
  if (b.etat === "hors-ligne") return t.synchro.horsLigne;
  return t.synchro.aJour(heure(b.le), Boolean(b.recues), Boolean(b.envoyees));
}

/**
 * Compte Nextcloud dédié à la synchro (il ne voit que le dossier ExziFit-sync). Le mot de passe
 * d'application est gardé par la partie Rust, hors des sauvegardes, et jamais réaffiché.
 */
function Synchro({ bilan, onSynchro, onErreur }: { bilan: Bilan | null; onSynchro: () => Promise<void>; onErreur: (e: unknown) => void }) {
  const [info, setInfo] = useState<InfoSynchro | null>(null);
  const [edition, setEdition] = useState(false);
  const [serveur, setServeur] = useState("");
  const [utilisateur, setUtilisateur] = useState("");
  const [mdp, setMdp] = useState("");
  const [occupe, setOccupe] = useState(false);

  const charger = () =>
    stockage.synchroCompte().then((i) => {
      setInfo(i);
      setServeur(i.compte?.serveur ?? i.serveur_defaut ?? "https://");
      setUtilisateur(i.compte?.utilisateur ?? "exzifit");
    }, onErreur);
  useEffect(() => { if (dansTauri) charger(); }, []);

  const lancer = async () => {
    setOccupe(true);
    await onSynchro();
    setOccupe(false);
  };
  const enregistrer = async () => {
    try {
      await stockage.synchroConfigurer(serveur, utilisateur, mdp);
      setMdp("");
      setEdition(false);
      await charger();
      await lancer();
    } catch (e) {
      onErreur(e);
    }
  };

  if (!dansTauri) return null;
  const compte = info?.compte;
  return (
    <details className="carte rm">
      <summary>{t.synchro.titre}</summary>
      <div>
        {compte && !edition ? (
          <>
            <p className="petit">{compte.utilisateur} · {compte.serveur.replace("https://", "")}</p>
            <p className="doux petit">{t.synchro.dossier(occupe ? t.synchro.enCours : texteBilan(bilan))}</p>
            <button className="principal" disabled={occupe} onClick={lancer}>{t.synchro.maintenant}</button>
            <button className="lien" onClick={() => setEdition(true)}>{t.synchro.changer}</button>
          </>
        ) : (
          <>
            <p className="doux petit">{t.synchro.explication}</p>
            <label className="champ">{t.synchro.serveur}<input value={serveur} onChange={(e) => setServeur(e.target.value)} autoCapitalize="none" /></label>
            <label className="champ">{t.synchro.utilisateur}<input value={utilisateur} onChange={(e) => setUtilisateur(e.target.value)} autoCapitalize="none" /></label>
            <label className="champ">{t.synchro.mdp}
              <input type="password" value={mdp} placeholder={compte ? t.synchro.inchange : ""} onChange={(e) => setMdp(e.target.value)} autoCapitalize="none" />
            </label>
            <button className="principal" disabled={!compte && !mdp} onClick={enregistrer}>{t.synchro.enregistrer}</button>
            {compte && <button className="lien" onClick={() => setEdition(false)}>{t.commun.annuler}</button>}
          </>
        )}
      </div>
    </details>
  );
}
