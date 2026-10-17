import type { Programme } from "../donnees/programme";
import { apercu, MUSCLES, seuilConstance, type Stats } from "../donnees/stats";
import { t } from "../i18n";
import { Barre } from "./Personnage";

/**
 * Aperçu des stats d'un programme (docs/stats.md, « Aperçu d'un programme ») : ce que donneraient
 * 4 semaines de ce programme, à côté des stats d'aujourd'hui quand il y en a (`stats` absent :
 * premier lancement, aucun historique).
 */
export default function Apercu({ p, stats }: { p: Programme; stats?: Stats }) {
  const a = apercu(p);
  const ligne = (nom: string, avant: number | undefined, apres: number) => (
    <div key={nom} className="stat">
      <span>{nom}</span>
      <b>{avant === undefined ? "" : `${Math.round(avant)} → `}{Math.round(apres)}</b>
      <Barre valeur={apres} />
    </div>
  );
  return (
    <>
      <div className="carte">
        <h2 className="titre-carte">{p.nom}</h2>
        <p className="doux petit">{t.apercu.apres(a.seances, stats !== undefined)}</p>
        {ligne(t.stats.endurance, stats?.endurance, a.endurance)}
        <div className="stat">
          <span>{t.stats.force}</span>
          <b>{t.apercu.lourdes(Math.round(a.lourdes))}</b>
          <span className="doux petit pleine-largeur">{t.apercu.lourdesNote}</span>
        </div>
        <div className="stat">
          <span>{t.stats.constance}</span>
          <b>{t.apercu.parSemaine(seuilConstance(p))}</b>
        </div>
      </div>
      <h2>{t.commun.groupes}</h2>
      <div className="carte">
        {MUSCLES.map((m) => ligne(t.muscles[m], stats?.groupes[m], a.groupes[m]))}
      </div>
      <p className="doux petit espace-haut">{t.apercu.note}</p>
    </>
  );
}
