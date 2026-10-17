import { useState } from "react";
import { PROGRAMMES } from "../donnees/programme";
import { estPerso } from "../donnees/programmes-perso";
import type { Stats } from "../donnees/stats";
import { t } from "../i18n";
import Apercu from "./Apercu";
import EditeurProgramme from "./EditeurProgramme";

/**
 * Choix du programme, avec l'aperçu de ses stats : ce que donneraient 4 semaines de ce programme,
 * à côté des stats d'aujourd'hui. On y écrit aussi ses propres programmes.
 */
export default function EcranProgrammes({ actuel, stats, onChoisir, onRetour, onErreur }: {
  actuel: string; stats: Stats; onChoisir: (id: string) => void; onRetour: () => void; onErreur: (e: unknown) => void;
}) {
  const [vu, setVu] = useState(actuel);
  // `null` : pas d'éditeur ; `"nouveau"` ou l'id du programme modifié.
  const [edition, setEdition] = useState<string | null>(null);
  const p = PROGRAMMES.find((x) => x.id === vu)!;

  if (edition !== null) {
    return (
      <EditeurProgramme initial={edition === "nouveau" ? undefined : p} onErreur={onErreur}
                        onEnregistre={(n) => { setVu(n.id); setEdition(null); }} onAnnuler={() => setEdition(null)} />
    );
  }
  return (
    <>
      <button className="lien" onClick={onRetour}>{t.programmes.retour}</button>
      <h1>{t.programmes.titre}</h1>
      <div className="seg" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {PROGRAMMES.map((x) => (
          <button key={x.id} aria-pressed={x.id === vu} onClick={() => setVu(x.id)}>
            {x.nom}<small>{x.id === actuel ? t.programmes.enCours : `${t.commun.jours(x.jours.length)}${x.semaines.length > 1 ? ` · ${t.commun.sem(x.semaines.length)}` : ""}`}</small>
          </button>
        ))}
      </div>
      <div className="liens">
        <button className="lien" onClick={() => setEdition("nouveau")}>{t.programmes.creer}</button>
        {estPerso(p.id) && <button className="lien" onClick={() => setEdition(p.id)}>{t.commun.modifier(p.nom)}</button>}
      </div>

      <Apercu p={p} stats={stats} />
      <p className="doux petit">{t.programmes.bloc}</p>

      <div className="bas">
        <button className="principal valider" disabled={vu === actuel} onClick={() => onChoisir(vu)}>
          {vu === actuel ? t.programmes.actuel : t.programmes.passer(p.nom)}
        </button>
      </div>
    </>
  );
}
