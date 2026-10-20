import { useEffect, useState } from "react";
import { bandes, bornes, effet, grille, HAUTEUR, LARGEUR, palier, paliers, SEUILS, type Paliers, type Trait } from "../donnees/avatar";
import { lireBlocs, lirePesees, noterPoidsCorps, type Bloc } from "../donnees/bloc";
import { exercice } from "../donnees/exercices";
import { jourLocal } from "../donnees/fichier";
import { lireSeances } from "../donnees/journal";
import { nombre, programme } from "../donnees/programme";
import { lireSalles, normaliser } from "../donnees/salles";
import { monte, MUSCLES, progres, seuilConstance, stats, type Pesee, type Progres, type Sexe, type Stats } from "../donnees/stats";
import { poidsCorpsDouteux } from "../donnees/aberrant";
import { t } from "../i18n";
import ChampSur from "./ChampSur";

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
    [t.stats.force, avant.force, apres.force],
    [t.stats.endurance, avant.endurance, apres.endurance],
    [t.stats.constance, avant.constance, apres.constance],
    [t.stats.progression, avant.progression, apres.progression],
    ...MUSCLES.map((m) => [t.muscles[m], avant.groupes[m], apres.groupes[m]] as [string, number, number]),
  ];
  const bougees = lignes.filter(([, a, b]) => b !== undefined && Math.round(b) !== Math.round(a ?? 0));
  if (!bougees.length) return null;
  return (
    <div className="carte espace-haut">
      <h2 className="titre-carte">{t.commun.personnage}</h2>
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

const TRAITS: Trait[] = ["force", "endurance", "constance"];

/** Ce qui changera sur le personnage au prochain palier, et sous quel score il redescend. */
function Prochain({ trait, valeur }: { trait: Trait; valeur: number | undefined }) {
  const { suivant, perte } = bornes(trait, valeur);
  const p = palier(trait, valeur);
  return (
    <div className="stat">
      <span>{t.stats[trait]} {valeur === undefined ? "" : Math.round(valeur)}</span>
      <b className="doux">{t.perso.palier(p, SEUILS[trait].length)}</b>
      <span className="doux petit pleine-largeur">
        {suivant === undefined ? t.perso.max : t.perso.suivant(suivant, effet(trait, p))}
        {perte === undefined ? "" : t.perso.perte(perte)}
      </span>
    </div>
  );
}

/** « ▲ +4 % », « ▼ −2 % », « = » à moins de 1 % d'écart. */
function ecart(x: Progres): string {
  if (x.avant === undefined) return t.perso.nouveau;
  const pct = t.pct(String(Math.max(1, Math.round((100 * Math.abs(x.actuel - x.avant)) / x.avant))));
  return monte(x) ? `▲ +${pct}` : x.actuel <= x.avant * 0.99 ? `▼ −${pct}` : "=";
}

/** Fenêtre de la courbe du poids : un an, assez pour voir une prise de masse ou une sèche. */
const JOURS_COURBE = 365;

/** Courbe des pesées de l'année ; rien sous deux pesées. Échelle serrée sur les valeurs (±1 kg). */
function CourbePoids({ pesees }: { pesees: Pesee[] }) {
  const jour = (d: string) => Date.parse(`${d}T12:00:00`) / 86_400_000;
  const tri = [...pesees].sort((a, b) => a.date.localeCompare(b.date));
  const fin = tri.length ? jour(tri[tri.length - 1].date) : 0;
  const l = tri.filter((x) => jour(x.date) > fin - JOURS_COURBE);
  if (l.length < 2) return null;
  const [L, H, M] = [300, 90, 6];
  const kgs = l.map((x) => x.kg);
  const bas = Math.min(...kgs) - 1, haut = Math.max(...kgs) + 1;
  const debut = jour(l[0].date), duree = Math.max(1, fin - debut);
  const pts = l.map((x) => [M + ((jour(x.date) - debut) / duree) * (L - 2 * M), M + ((haut - x.kg) / (haut - bas)) * (H - 2 * M)]);
  const ecart = l[l.length - 1].kg - l[0].kg;
  return (
    <figure className="courbe">
      <svg viewBox={`0 0 ${L} ${H}`} role="img" aria-label={t.perso.courbe(nombre(Math.min(...kgs)), nombre(Math.max(...kgs)))}>
        <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="miter" />
        {pts.map(([x, y], i) => <rect key={i} x={x - 2.5} y={y - 2.5} width="5" height="5" fill="var(--accent)" />)}
      </svg>
      <figcaption className="doux petit">
        {t.perso.courbe(nombre(Math.min(...kgs)), nombre(Math.max(...kgs)))} · {t.perso.depuis(`${ecart > 0 ? "+" : ecart < 0 ? "−" : "±"}${nombre(Math.abs(ecart))}`, l[0].date)}
      </figcaption>
    </figure>
  );
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

  if (!s) return <h1>{t.commun.personnage}</h1>;
  const derniere = pesees[pesees.length - 1];
  const pa = paliers(s);
  const pAvant = avant && paliers(avant);
  const change = pAvant && TRAITS.some((x) => pAvant[x] !== pa[x]);
  return (
    <>
      <h1>{prenom ?? t.commun.personnage}</h1>
      <div className="carte">
        <div className="avatars">
          {change && pAvant && (
            <figure>
              <Avatar p={pAvant} sexe={sexe} taille={4} nom={t.perso.avant} />
              <figcaption className="doux">{t.perso.ilYa}</figcaption>
            </figure>
          )}
          <figure>
            <Avatar p={pa} sexe={sexe} taille={6} nom={t.perso.aujourdhuiNom} />
            <figcaption>{change ? t.perso.aujourdhui : t.perso.meme}</figcaption>
          </figure>
        </div>
        {TRAITS.map((x) => <Prochain key={x} trait={x} valeur={s[x]} />)}
      </div>
      <div className="carte rm">
        <label>
          {t.commun.poidsCorpsKg}
          <ChampSur defaut={derniere?.kg} placeholder={t.perso.aNoter} douteux={(kg) => poidsCorpsDouteux(kg, derniere?.kg)} onValeur={peser} />
        </label>
        <p className="doux petit">{derniere ? t.perso.pesee(derniere.date) : t.perso.sansPesee}</p>
        <CourbePoids pesees={pesees} />
      </div>
      <div className="carte">
        <Ligne nom={t.stats.force} valeur={s.force} vide={pesees.length ? t.perso.aucunExoForce : t.perso.peseeManquante} />
        <Ligne nom={t.stats.endurance} valeur={s.endurance} />
        <Ligne nom={t.stats.constance} valeur={s.constance} />
        <Ligne nom={t.stats.progression} valeur={s.progression} vide={t.perso.pasDeComparaison} />
      </div>
      <h2>{t.perso.progression4}</h2>
      <div className="carte">
        {p.length ? p.map((x) => (
          <div key={x.exo} className="stat">
            <span>{exercice(x.exo).nom}</span>
            <b className={monte(x) ? "record" : x.avant === undefined ? "doux" : undefined}>{ecart(x)}</b>
          </div>
        )) : <p className="doux">{t.perso.aucunExo}</p>}
      </div>
      <h2>{t.commun.groupes}</h2>
      <div className="carte">
        {MUSCLES.map((m) => <Ligne key={m} nom={t.muscles[m]} valeur={s.groupes[m]} />)}
      </div>
      <p className="doux petit espace-haut">{t.perso.note}</p>
    </>
  );
}
