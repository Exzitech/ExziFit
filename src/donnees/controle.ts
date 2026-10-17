// Contrôle des fichiers de données : valeurs impossibles qu'une saisie ou un bug aurait écrites
// (NaN devenu null, Infinity, reps négatives, séance sans exercice). Pur et sans import d'exécution :
// l'agent de QA (scripts/qa-ia.mjs) l'importe tel quel sous Node ; l'app avertit à la lecture (lireJson).
import type { Serie } from "./journal";

const JOURNAL = /^journal\/\d{4}-\d{2}\.json$/;

const fini = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const date = (v: unknown) => typeof v === "string" && !Number.isNaN(Date.parse(v));

/** Anomalies d'un fichier du dossier de données (texte brut), lisibles par un humain ; vide si rien à redire. */
export function controlerFichier(chemin: string, texte: string): string[] {
  let d: unknown;
  try {
    d = JSON.parse(texte);
  } catch (e) {
    return [`${chemin} : JSON illisible (${(e as Error).message})`];
  }
  return controlerDonnees(chemin, d);
}

/** Même contrôle sur le contenu déjà lu. */
export function controlerDonnees(chemin: string, donnees: unknown): string[] {
  const d = donnees as any;
  const pb: string[] = [];
  const non = (ou: string, quoi: string) => pb.push(`${chemin}${ou && " " + ou} : ${quoi}`);
  if (d?.format !== 1) non("", `format ${JSON.stringify(d?.format)}`);

  const serie = (ou: string, s: Serie) => {
    if (s.type !== "echauffement" && s.type !== "travail") non(ou, `type ${JSON.stringify(s.type)}`);
    if (!fini(s.kg) || s.kg < 0) non(ou, `charge ${JSON.stringify(s.kg)}`);
    if (!Number.isInteger(s.reps) || s.reps < 0) non(ou, `reps ${JSON.stringify(s.reps)}`);
    if (s.rir !== undefined && (!fini(s.rir) || s.rir < 0)) non(ou, `RIR ${JSON.stringify(s.rir)}`);
    if (s.prevu && (!fini(s.prevu.kg) || !fini(s.prevu.reps))) non(ou, `prévu ${JSON.stringify(s.prevu)}`);
    if (s.a !== undefined && !date(s.a)) non(ou, `heure ${JSON.stringify(s.a)}`);
  };
  // `terminee` : une séance archivée a au moins un exercice et une fin ; celle en cours, pas forcément.
  const seance = (ou: string, s: any, terminee: boolean) => {
    if (!date(s?.debut)) return non(ou, `début ${JSON.stringify(s?.debut)}`);
    if (s.fin !== undefined && (!date(s.fin) || Date.parse(s.fin) < Date.parse(s.debut))) non(ou, `fin ${JSON.stringify(s.fin)}`);
    if (!Array.isArray(s.exercices)) return non(ou, "exercices absents");
    if (terminee && !s.exercices.some((x: any) => x?.series?.length)) non(ou, "séance sans série");
    s.exercices.forEach((x: any, i: number) => {
      const lieu = `${ou}, exo ${i + 1}`;
      if (typeof x?.exo !== "string" || !x.exo) return non(lieu, `identifiant ${JSON.stringify(x?.exo)}`);
      if (!Array.isArray(x.series)) return non(lieu, "séries absentes");
      x.series.forEach((s: Serie, j: number) => serie(`${lieu} (${x.exo}), série ${j + 1}`, s));
    });
  };

  if (JOURNAL.test(chemin)) {
    if (!Array.isArray(d?.seances)) return [...pb, `${chemin} : seances absentes`];
    d.seances.forEach((s: any, i: number) => {
      seance(`séance ${i + 1} (${s?.debut})`, s, true);
      if (date(s?.debut) && !chemin.includes(String(s.debut).slice(0, 7))) non(`séance ${i + 1}`, `début ${s.debut} hors du mois du fichier`);
    });
  } else if (chemin === "en-cours.json") {
    if (d?.seance !== null) seance("séance en cours", d?.seance, false);
  } else if (chemin === "poids.json") {
    (d?.pesees ?? []).forEach((p: any, i: number) => {
      if (!fini(p?.kg) || p.kg <= 0) non(`pesée ${i + 1}`, `poids ${JSON.stringify(p?.kg)}`);
      if (!date(p?.date)) non(`pesée ${i + 1}`, `date ${JSON.stringify(p?.date)}`);
    });
  } else if (chemin === "blocs.json") {
    (d?.blocs ?? []).forEach((b: any, i: number) => {
      for (const [exo, kg] of Object.entries(b?.rm ?? {}))
        if (!fini(kg) || kg <= 0) non(`bloc ${i + 1} (${b.id})`, `1RM ${exo} ${JSON.stringify(kg)}`);
    });
  } else if (chemin === "salles.json") {
    (d?.salles ?? []).forEach((s: any) => {
      for (const [exo, m] of Object.entries<any>(s?.machines ?? {}))
        if (m?.aVide !== undefined && (!fini(m.aVide) || m.aVide < 0)) non(`salle ${s.id}`, `poids à vide ${exo} ${JSON.stringify(m.aVide)}`);
    });
  }
  return pb;
}
