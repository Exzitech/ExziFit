import { useState } from "react";
import { PROGRAMMES } from "../donnees/programme";
import { apercu, MUSCLES, seuilConstance, type Stats } from "../donnees/stats";
import { Barre, NOMS } from "./Personnage";

/**
 * Choix du programme, avec l'aperçu de ses stats (docs/stats.md, « Aperçu d'un programme ») :
 * ce que donneraient 4 semaines de ce programme, à côté des stats d'aujourd'hui.
 */
export default function EcranProgrammes({ actuel, stats, onChoisir, onRetour }: {
  actuel: string; stats: Stats; onChoisir: (id: string) => void; onRetour: () => void;
}) {
  const [vu, setVu] = useState(actuel);
  const p = PROGRAMMES.find((x) => x.id === vu)!;
  const a = apercu(p);
  const ligne = (nom: string, avant: number, apres: number) => (
    <div key={nom} className="stat">
      <span>{nom}</span>
      <b>{Math.round(avant)} → {Math.round(apres)}</b>
      <Barre valeur={apres} />
    </div>
  );
  return (
    <>
      <button className="lien" onClick={onRetour}>‹ Séance</button>
      <h1>Programmes</h1>
      <div className="seg" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {PROGRAMMES.map((x) => (
          <button key={x.id} aria-pressed={x.id === vu} onClick={() => setVu(x.id)}>
            {x.nom}<small>{x.id === actuel ? "en cours" : `${x.jours.length} jours${x.semaines.length > 1 ? ` · ${x.semaines.length} sem.` : ""}`}</small>
          </button>
        ))}
      </div>

      <div className="carte">
        <h2 className="titre-carte">{p.nom}</h2>
        <p className="doux petit">
          Après 4 semaines à {a.seances} séances par semaine, toutes faites (aujourd'hui → avec ce programme).
        </p>
        {ligne("Endurance", stats.endurance, a.endurance)}
        <div className="stat">
          <span>Force</span>
          <b>{Math.round(a.lourdes)} séries lourdes / sem.</b>
          <span className="doux petit pleine-largeur">6 reps au plus, sur les exos qui la font monter</span>
        </div>
        <div className="stat">
          <span>Constance</span>
          <b>{seuilConstance(p)} séances / sem.</b>
        </div>
      </div>
      <h2>Groupes musculaires</h2>
      <div className="carte">
        {MUSCLES.map((m) => ligne(NOMS[m], stats.groupes[m], a.groupes[m]))}
      </div>
      <p className="doux petit espace-haut">
        Mêmes formules que l'onglet Perso, exos en option non comptés. La Force dépend des charges
        soulevées : pas de chiffre d'avance. La Constance compte les semaines où tu fais au moins ce nombre de séances.
        Chaque programme garde son bloc : y revenir reprend au jour où il en était.
      </p>

      <div className="bas">
        <button className="principal valider" disabled={vu === actuel} onClick={() => onChoisir(vu)}>
          {vu === actuel ? "Programme en cours" : `Passer à ${p.nom}`}
        </button>
      </div>
    </>
  );
}
