import { useState } from "react";
import { poidsCorpsDouteux } from "../donnees/aberrant";
import { noterPoidsCorps } from "../donnees/bloc";
import { FORMAT, jourLocal } from "../donnees/fichier";
import { PROGRAMMES } from "../donnees/programme";
import { estPerso } from "../donnees/programmes-perso";
import type { Reglages } from "../donnees/reglages";
import type { Sexe } from "../donnees/stats";
import { LANGUES, langueDuSysteme, t, type Langue } from "../i18n";
import { appliquerLangue } from "../langue";
import { THEME_DEFAUT } from "../themes";
import Apercu from "./Apercu";
import EditeurProgramme from "./EditeurProgramme";
import Restaurer from "./Restaurer";

/** Premier lancement d'une installation neuve : de quoi ouvrir la première séance, rien de plus. */
export default function EcranBienvenue({ onFini, onErreur }: { onFini: (r: Reglages) => void; onErreur: (e: unknown) => void }) {
  // Proposée d'après le téléphone, déjà appliquée par main.tsx.
  const [langue, setLangue] = useState<Langue>(langueDuSysteme);
  const [prenom, setPrenom] = useState("");
  const [sexe, setSexe] = useState<Sexe>("homme");
  const [poids, setPoids] = useState("");
  const [prog, setProg] = useState<string>(); // pas de présélection : à chacun de choisir
  // `null` : pas d'éditeur ; `"nouveau"` ou l'id du programme modifié.
  const [edition, setEdition] = useState<string | null>(null);
  const choisi = PROGRAMMES.find((x) => x.id === prog);

  const kg = Number(poids.replace(",", "."));
  const poidsOk = !poids.trim() || (Number.isFinite(kg) && kg > 0);
  // Poids douteux (820 pour 82) : « Sûr ? » au premier toucher de Commencer.
  const [poidsVu, setPoidsVu] = useState<string | null>(null);
  const doute = poids.trim() !== "" && poidsOk && poidsCorpsDouteux(kg);

  const changerLangue = (l: Langue) => {
    appliquerLangue(l);
    setLangue(l);
  };

  const commencer = async () => {
    if (doute && poidsVu !== poids) return setPoidsVu(poids);
    try {
      if (poids.trim()) await noterPoidsCorps(jourLocal(new Date()), kg);
      // Pas d'envoi Nextcloud : le dossier de dépôt est celui de Tom. Sauvegarde = export manuel (Réglages).
      onFini({ format: FORMAT, theme: THEME_DEFAUT, langue, prenom: prenom.trim() || undefined, sexe, programme: prog, envoi: false });
    } catch (e) {
      onErreur(e);
    }
  };

  if (edition !== null) {
    // Prénom, poids, sexe restent dans l'état de ce composant : rien n'est perdu au retour.
    return (
      <EditeurProgramme initial={edition === "nouveau" ? undefined : choisi} onErreur={onErreur}
                        onEnregistre={(p) => { setProg(p.id); setEdition(null); }} onAnnuler={() => setEdition(null)} />
    );
  }

  return (
    <>
      <h1>ExziFit</h1>
      <div className="seg" style={{ gridTemplateColumns: "1fr 1fr 1fr" }} aria-label={t.commun.langue}>
        {LANGUES.map((l) => (
          <button key={l.id} lang={l.id} aria-pressed={langue === l.id} onClick={() => changerLangue(l.id)}>{l.nom}</button>
        ))}
      </div>
      <div className="carte rm">
        <label>
          {t.commun.prenom}
          <input value={prenom} onChange={(ev) => setPrenom(ev.target.value)} autoComplete="given-name" />
        </label>
        <label>
          {t.commun.poidsCorpsKg}
          <input type="number" inputMode="decimal" value={poids} onChange={(ev) => setPoids(ev.target.value)} />
        </label>
      </div>

      <h2>{t.commun.personnage}</h2>
      <div className="choix">
        {(["homme", "femme"] as const).map((x) => (
          <button key={x} aria-pressed={sexe === x} onClick={() => setSexe(x)}>
            {t.commun[x]}
          </button>
        ))}
      </div>

      <h2>{t.commun.programme}</h2>
      <div className="seg" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {PROGRAMMES.map((x) => (
          <button key={x.id} aria-pressed={x.id === prog} onClick={() => setProg(x.id)}>
            {x.nom}<small>{t.commun.jours(x.jours.length)}{x.semaines.length > 1 ? ` · ${t.commun.semaines(x.semaines.length)}` : ""}</small>
          </button>
        ))}
      </div>
      <div className="liens">
        <button className="lien" onClick={() => setEdition("nouveau")}>{t.bienvenue.creer}</button>
        {choisi && estPerso(choisi.id) && <button className="lien" onClick={() => setEdition(choisi.id)}>{t.commun.modifier(choisi.nom)}</button>}
      </div>
      {choisi ? <Apercu p={choisi} /> : <p className="doux petit">{t.bienvenue.choisir}</p>}
      <p className="doux petit">{t.bienvenue.ensuite}</p>

      <button className="principal" disabled={!poidsOk || !prog} onClick={commencer}>
        {doute && poidsVu === poids ? t.seance.sur(`${poids} kg · ${t.bienvenue.commencer}`) : t.bienvenue.commencer}
      </button>
      <p className="doux petit">{t.bienvenue.donnees}</p>

      {/* Ni barre d'onglets ni bandeau du bas ici : la place de la barre système est à réserver. */}
      <div className="fin-sans-nav">
        <h2>{t.bienvenue.nouveau}</h2>
        <Restaurer remplace={false} onErreur={onErreur} />
      </div>
    </>
  );
}
