import { duree, REPOS_MAX, REPOS_MIN, REPOS_PAS } from "../donnees/programme";
import { t } from "../i18n";

/** Repos en − / +, par pas de 15 s. */
export default function Repos({ valeur, onChange }: { valeur: number; onChange: (s: number) => void }) {
  const borne = (s: number) => Math.min(REPOS_MAX, Math.max(REPOS_MIN, s));
  return (
    <span className="repos-reglage">
      <button className="puce" aria-label={t.programmes.moinsRepos} onClick={() => onChange(borne(valeur - REPOS_PAS))}>−</button>
      <b>{duree(valeur)}</b>
      <button className="puce" aria-label={t.programmes.plusRepos} onClick={() => onChange(borne(valeur + REPOS_PAS))}>+</button>
    </span>
  );
}
