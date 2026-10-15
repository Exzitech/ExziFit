import { useEffect, useState } from "react";
import { bandes, bornes, EFFETS, grille, HAUTEUR, LARGEUR, palier, paliers, SEUILS, type Paliers, type Trait } from "../donnees/avatar";
import { lireBlocs, lirePesees, noterPoidsCorps, type Bloc } from "../donnees/bloc";
import { exercice, type Muscle } from "../donnees/exercices";
import { jourLocal } from "../donnees/fichier";
import { lireSeances } from "../donnees/journal";
import { programme } from "../donnees/programme";
import { lireSalles, normaliser } from "../donnees/salles";
import { monte, MUSCLES, progres, seuilConstance, stats, type Pesee, type Progres, type Sexe, type Stats } from "../donnees/stats";

export const NOMS: Record<Muscle, string> = {
  pectoraux: "Pectoraux", dos: "Dos", epaules: "Épaules", biceps: "Biceps", triceps: "Triceps",
  quadriceps: "Quadriceps", ischios: "Ischios", fessiers: "Fessiers", mollets: "Mollets",
  abdos: "Abdos", "avant-bras": "Avant-bras",
};

/** Seuil de Constance : celui du programme choisi s'il a un bloc ouvert, sinon celui sans programme. */
export function seuilActuel(blocs: Bloc[], choisi: string | undefined) {
  const p = programme(choisi);
  return seuilConstance(blocs.some((b) => b.programme === p.id && b.fin === null) ? p : undefined);
}

/** Barre de 10 cases ; au-delà de 100 elle est simplement pleine. */
export function Barre({ valeur }: { valeur: number }) {
  const pleines = Math.min(10, Math.round(valeur / 10));
  return (
    <span className="barre" aria-hidden>
      {Array.from({ length: 10 }, (_, i) => <i key={i} className={i < pleines ? "pleine" : undefined} />)}
    </span>
  );
}

function Ligne({ nom, valeur, vide = "" }: { nom: string; valeur: number | undefined; vide?: string }) {
  return (
    <div className="stat">
      <span>{nom}</span>
      <b>{valeur === undefined ? <span className="doux petit">{vide}</span> : Math.round(valeur)}</b>
      {valeur !== undefined && <Barre valeur={valeur} />}
    </div>
  );
}

/** Une ligne par stat qui a bougé d'au moins un point, pour le résumé de fin de séance. */
export function Ecarts({ avant, apres }: { avant: Stats; apres: Stats }) {
  const lignes: [string, number | undefined, number | undefined][] = [
    ["Force", avant.force, apres.force],
    ["Endurance", avant.endurance, apres.endurance],
    ["Constance", avant.constance, apres.constance],
    ["Progression", avant.progression, apres.progression],
    ...MUSCLES.map((m) => [NOMS[m], avant.groupes[m], apres.groupes[m]] as [string, number, number]),
  ];
  const bougees = lignes.filter(([, a, b]) => b !== undefined && Math.round(b) !== Math.round(a ?? 0));
  if (!bougees.length) return null;
  return (
    <div className="carte espace-haut">
      <h2 className="titre-carte">Personnage</h2>
      {bougees.map(([nom, a, b]) => (
        <div key={nom} className="stat">
          <span>{nom}</span>
          <b>{a === undefined ? "" : `${Math.round(a)} → `}{Math.round(b as number)}</b>
          <Barre valeur={b as number} />
        </div>
      ))}
    </div>
  );
}

/** Personnage dessiné depuis les paliers ; `taille` = côté d'un pixel en px. */
export function Avatar({ p, sexe, taille, nom }: { p: Paliers; sexe: Sexe; taille: number; nom: string }) {
  const etat = p.constance === 0 ? "terne" : p.constance === SEUILS.constance.length ? "halo" : undefined;
  return (
    <svg className={`avatar ${etat ?? ""}`} role="img" aria-label={nom} width={LARGEUR * taille} height={HAUTEUR * taille}
         viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`} shapeRendering="crispEdges">
      {bandes(grille(p, sexe)).map((b) => <rect key={`${b.x},${b.y}`} x={b.x} y={b.y} width={b.l} height={1} className={`px${b.c}`} />)}
    </svg>
  );
}

const TRAITS: [Trait, string][] = [["force", "Force"], ["endurance", "Endurance"], ["constance", "Constance"]];

/** Ce qui changera sur le personnage au prochain palier, et sous quel score il redescend. */
function Prochain({ t, nom, valeur }: { t: Trait; nom: string; valeur: number | undefined }) {
  const { suivant, perte } = bornes(t, valeur);
  const p = palier(t, valeur);
  return (
    <div className="stat">
      <span>{nom} {valeur === undefined ? "" : Math.round(valeur)}</span>
      <b className="doux">palier {p}/{SEUILS[t].length}</b>
      <span className="doux petit pleine-largeur">
        {suivant === undefined ? "Palier maximal." : `À ${suivant} : ${EFFETS[t][p]}.`}
        {perte === undefined ? "" : ` Sous ${perte}, il redescend.`}
      </span>
    </div>
  );
}

/** « ▲ +4 % », « ▼ −2 % », « = » à moins de 1 % d'écart. */
function ecart(x: Progres): string {
  if (x.avant === undefined) return "nouveau";
  const pct = Math.max(1, Math.round((100 * Math.abs(x.actuel - x.avant)) / x.avant));
  return monte(x) ? `▲ +${pct} %` : x.actuel <= x.avant * 0.99 ? `▼ −${pct} %` : "=";
}

export default function EcranPersonnage(
  { programmeChoisi, prenom, sexe, onErreur }: {
    programmeChoisi: string | undefined; prenom: string | undefined; sexe: Sexe; onErreur: (e: unknown) => void;
  },
) {
  const [s, setS] = useState<Stats | null>(null);
  const [avant, setAvant] = useState<Stats | null>(null);
  const [p, setP] = useState<Progres[]>([]);
  const [pesees, setPesees] = useState<Pesee[]>([]);

  const charger = () =>
    Promise.all([lireSeances(), lirePesees(), lireBlocs(), lireSalles()])
      .then(([brutes, pe, blocs, salles]) => {
        // Charge réelle (chariot compris, moufle retirée) : les salles se comparent entre elles.
        const seances = normaliser(brutes, salles);
        const maintenant = new Date();
        setPesees(pe);
        const seuil = seuilActuel(blocs, programmeChoisi);
        setS(stats(seances, pe, sexe, seuil, maintenant));
        setAvant(stats(seances, pe, sexe, seuil, new Date(maintenant.getTime() - 56 * 86_400_000)));
        setP(progres(seances, pe, maintenant));
      })
      .catch(onErreur);

  useEffect(() => { charger(); }, []);

  const peser = (v: string) => {
    const n = Number(v.replace(",", "."));
    if (!v.trim() || !Number.isFinite(n) || n <= 0 || n === pesees[pesees.length - 1]?.kg) return;
    noterPoidsCorps(jourLocal(new Date()), n).then(charger, onErreur);
  };

  if (!s) return <h1>Personnage</h1>;
  const derniere = pesees[pesees.length - 1];
  const pa = paliers(s);
  const pAvant = avant && paliers(avant);
  const change = pAvant && TRAITS.some(([t]) => pAvant[t] !== pa[t]);
  return (
    <>
      <h1>{prenom ?? "Personnage"}</h1>
      <div className="carte">
        <div className="avatars">
          {change && pAvant && (
            <figure>
              <Avatar p={pAvant} sexe={sexe} taille={4} nom="Personnage il y a 8 semaines" />
              <figcaption className="doux">Il y a 8 sem.</figcaption>
            </figure>
          )}
          <figure>
            <Avatar p={pa} sexe={sexe} taille={6} nom="Personnage aujourd'hui" />
            <figcaption>{change ? "Aujourd'hui" : "Même silhouette qu'il y a 8 sem."}</figcaption>
          </figure>
        </div>
        {TRAITS.map(([t, nom]) => <Prochain key={t} t={t} nom={nom} valeur={s[t]} />)}
      </div>
      <div className="carte rm">
        <label>
          Poids de corps (kg)
          <input type="number" inputMode="decimal" defaultValue={derniere?.kg ?? ""} placeholder="à noter"
                 onBlur={(ev) => peser(ev.target.value)} />
        </label>
        <p className="doux petit">{derniere ? `Dernière pesée : ${derniere.date}.` : "Sans pesée, pas de Force (elle se rapporte au poids de corps)."}</p>
      </div>
      <div className="carte">
        <Ligne nom="Force" valeur={s.force} vide={pesees.length ? "aucun exo de force" : "pesée manquante"} />
        <Ligne nom="Endurance" valeur={s.endurance} />
        <Ligne nom="Constance" valeur={s.constance} />
        <Ligne nom="Progression" valeur={s.progression} vide="pas encore de comparaison" />
      </div>
      <h2>Progression sur 4 semaines</h2>
      <div className="carte">
        {p.length ? p.map((x) => (
          <div key={x.exo} className="stat">
            <span>{exercice(x.exo).nom}</span>
            <b className={monte(x) ? "record" : x.avant === undefined ? "doux" : undefined}>{ecart(x)}</b>
          </div>
        )) : <p className="doux">Aucun exo fait ces 14 derniers jours.</p>}
      </div>
      <h2>Groupes musculaires</h2>
      <div className="carte">
        {MUSCLES.map((m) => <Ligne key={m} nom={NOMS[m]} valeur={s.groupes[m]} />)}
      </div>
      <p className="doux petit espace-haut">
        Calculé depuis le journal, rien n'est crédité : Force sur les 1RM estimés rapportés au poids
        de corps, groupes et Endurance sur les séries dures des 4 dernières semaines, Constance sur
        les 8 dernières semaines. Progression : 1RM estimé des 14 derniers jours comparé à celui d'il y a
        4 à 6 semaines, sur les séries dures ; la stat est la part des exos comparables qui montent d'au moins 1 %.
      </p>
    </>
  );
}
