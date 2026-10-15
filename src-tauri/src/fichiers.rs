//! Dossier de données : lecture, écriture atomique, sauvegarde quotidienne.
//! Le format des fichiers (docs/modele-donnees.md) est l'affaire du front ; ici, que des octets sûrs.

use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use tauri::Manager;

/// Sous-dossier de `app_data_dir()` réservé aux données : sur Android, `app_data_dir()` est la
/// racine du dossier privé de l'app, où la WebView range aussi son cache (binaire, volumineux).
const DONNEES: &str = "donnees";
/// Fichiers et dossiers du modèle (docs/modele-donnees.md), rangés à la racine jusqu'à la 0.1.1.
const ANCIENS: [&str; 7] =
    ["reglages.json", "journal", "en-cours.json", "programmes.json", "blocs.json", "exercices.json", "poids.json"];
const SAUVEGARDES: &str = "sauvegardes";
/// Dans `sauvegardes/` : jour et empreinte de la dernière copie envoyée sur Nextcloud (envoi.rs).
const ENVOYEE: &str = "envoyee.json";
/// Copies quotidiennes gardées ; la première de chaque mois est gardée en plus, sans limite.
const JOURS_GARDES: usize = 30;

pub(crate) fn racine(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("dossier de données introuvable : {e}"))?;
    let d = base.join(DONNEES);
    if !d.is_dir() {
        migrer(&base, &d)?;
    }
    Ok(d)
}

/// Passage à `donnees/` : les fichiers du modèle y sont déplacés (renommage, contenu intact) via
/// `donnees.tmp`, qu'une reprise après coupure complète. L'ancien `sauvegardes/` de la racine est
/// supprimé ensuite : il ne contient que des copies de ces fichiers et du cache de la WebView.
fn migrer(base: &Path, d: &Path) -> Result<(), String> {
    let tmp = base.join(format!("{DONNEES}.tmp"));
    fs::create_dir_all(&tmp).map_err(|e| erreur("création de", &tmp, e))?;
    for nom in ANCIENS {
        let de = base.join(nom);
        if de.exists() {
            fs::rename(&de, tmp.join(nom)).map_err(|e| erreur("déplacement de", &de, e))?;
        }
    }
    fs::rename(&tmp, d).map_err(|e| erreur("renommage de", &tmp, e))?;
    let vieilles = base.join(SAUVEGARDES);
    if vieilles.exists() {
        fs::remove_dir_all(&vieilles).map_err(|e| erreur("suppression de", &vieilles, e))?;
    }
    Ok(())
}

fn erreur(action: &str, p: &Path, e: io::Error) -> String {
    format!("{action} {} : {e}", p.display())
}

/// Chemin relatif au dossier de données, en `/` : minuscules, chiffres, `-` et `.`, sans segment
/// caché (donc sans `..`) ni `.tmp`. Les sauvegardes ne s'écrivent que par `sauvegarde_du_jour`.
fn valider(chemin: &str) -> Result<(), String> {
    let segment_ok = |s: &str| {
        !s.is_empty()
            && !s.starts_with('.')
            && !s.ends_with(".tmp")
            && s.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '.')
    };
    if !chemin.split('/').all(segment_ok) || chemin.split('/').next() == Some(SAUVEGARDES) {
        return Err(format!("chemin refusé : {chemin:?}"));
    }
    Ok(())
}

/// `.tmp` puis renommage, après `sync_all` : jamais de fichier à moitié écrit, même sur coupure.
fn ecrire_atomique(p: &Path, texte: &str) -> Result<(), String> {
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| erreur("création de", parent, e))?;
    }
    let mut tmp = p.as_os_str().to_owned();
    tmp.push(".tmp");
    let tmp = PathBuf::from(tmp);
    let mut f = fs::File::create(&tmp).map_err(|e| erreur("création de", &tmp, e))?;
    f.write_all(texte.as_bytes())
        .and_then(|_| f.sync_all())
        .map_err(|e| erreur("écriture de", &tmp, e))?;
    fs::rename(&tmp, p).map_err(|e| erreur("renommage de", &tmp, e))
}

/// `None` si le fichier n'existe pas (premier lancement) ; toute autre erreur remonte.
#[tauri::command]
pub fn lire(app: tauri::AppHandle, chemin: String) -> Result<Option<String>, String> {
    valider(&chemin)?;
    let p = racine(&app)?.join(&chemin);
    match fs::read_to_string(&p) {
        Ok(t) => Ok(Some(t)),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(erreur("lecture de", &p, e)),
    }
}

#[tauri::command]
pub fn ecrire(app: tauri::AppHandle, chemin: String, texte: String) -> Result<(), String> {
    valider(&chemin)?;
    ecrire_atomique(&racine(&app)?.join(&chemin), &texte)
}

/// Noms des fichiers d'un dossier, triés ; vide si le dossier n'existe pas encore.
#[tauri::command]
pub fn lister(app: tauri::AppHandle, dossier: String) -> Result<Vec<String>, String> {
    valider(&dossier)?;
    let d = racine(&app)?.join(&dossier);
    let entrees = match fs::read_dir(&d) {
        Ok(e) => e,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(erreur("lecture de", &d, e)),
    };
    let mut noms = Vec::new();
    for e in entrees {
        let e = e.map_err(|err| erreur("lecture de", &d, err))?;
        let nom = e.file_name().to_string_lossy().into_owned();
        if e.path().is_file() && !nom.ends_with(".tmp") {
            noms.push(nom);
        }
    }
    noms.sort();
    Ok(noms)
}

/// Un fichier déjà absent n'est pas une erreur : le résultat voulu est atteint.
#[tauri::command]
pub fn supprimer(app: tauri::AppHandle, chemin: String) -> Result<(), String> {
    valider(&chemin)?;
    let p = racine(&app)?.join(&chemin);
    match fs::remove_file(&p) {
        Err(e) if e.kind() != io::ErrorKind::NotFound => Err(erreur("suppression de", &p, e)),
        _ => Ok(()),
    }
}

#[tauri::command]
pub fn dossier_donnees(app: tauri::AppHandle) -> Result<String, String> {
    Ok(racine(&app)?.display().to_string())
}

/// Copie du dossier de données dans `sauvegardes/<jour>/`, une fois par jour.
/// `jour` vient du front (date locale), pour ne pas tirer une dépendance de fuseau horaire.
/// Renvoie le dossier créé, `None` si la copie du jour existe déjà ou s'il n'y a rien à copier.
#[tauri::command]
pub fn sauvegarde_du_jour(app: tauri::AppHandle, jour: String) -> Result<Option<String>, String> {
    if !est_jour(&jour) {
        return Err(format!("jour invalide : {jour:?}"));
    }
    Ok(sauvegarder(&racine(&app)?, &jour)?.map(|p| p.display().to_string()))
}

fn est_jour(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 10
        && b.iter()
            .enumerate()
            .all(|(i, c)| if i == 4 || i == 7 { *c == b'-' } else { c.is_ascii_digit() })
}

fn sauvegarder(racine: &Path, jour: &str) -> Result<Option<PathBuf>, String> {
    let dossier = racine.join(SAUVEGARDES);
    let cible = dossier.join(jour);
    if cible.exists() || !contient_donnees(racine)? {
        return Ok(None);
    }
    // Copie dans un dossier `.tmp` renommé à la fin : une copie interrompue ne passe jamais pour faite.
    let tmp = dossier.join(format!("{jour}.tmp"));
    if tmp.exists() {
        fs::remove_dir_all(&tmp).map_err(|e| erreur("suppression de", &tmp, e))?;
    }
    copier(racine, &tmp, true)?;
    fs::rename(&tmp, &cible).map_err(|e| erreur("renommage de", &tmp, e))?;

    let mut jours = Vec::new();
    for e in fs::read_dir(&dossier).map_err(|e| erreur("lecture de", &dossier, e))? {
        let nom = e.map_err(|err| erreur("lecture de", &dossier, err))?.file_name();
        let nom = nom.to_string_lossy();
        if est_jour(&nom) {
            jours.push(nom.into_owned());
        }
    }
    for vieux in a_elaguer(jours) {
        let p = dossier.join(&vieux);
        fs::remove_dir_all(&p).map_err(|e| erreur("suppression de", &p, e))?;
    }
    Ok(Some(cible))
}

fn contient_donnees(racine: &Path) -> Result<bool, String> {
    for e in fs::read_dir(racine).map_err(|e| erreur("lecture de", racine, e))? {
        if e.map_err(|err| erreur("lecture de", racine, err))?.file_name() != SAUVEGARDES {
            return Ok(true);
        }
    }
    Ok(false)
}

/// Copie récursive ; à la racine, saute `sauvegardes/`. Les `.tmp` (écritures en cours) sont ignorés.
fn copier(src: &Path, dst: &Path, racine: bool) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| erreur("création de", dst, e))?;
    for e in fs::read_dir(src).map_err(|e| erreur("lecture de", src, e))? {
        let e = e.map_err(|err| erreur("lecture de", src, err))?;
        let nom = e.file_name();
        if (racine && nom == SAUVEGARDES) || nom.to_string_lossy().ends_with(".tmp") {
            continue;
        }
        let (de, vers) = (e.path(), dst.join(&nom));
        if de.is_dir() {
            copier(&de, &vers, false)?;
        } else {
            fs::copy(&de, &vers).map_err(|err| erreur("copie de", &de, err))?;
        }
    }
    Ok(())
}

/// Garde les `JOURS_GARDES` copies les plus récentes et la première de chaque mois.
fn a_elaguer(mut jours: Vec<String>) -> Vec<String> {
    jours.sort();
    let recentes = jours.len().saturating_sub(JOURS_GARDES);
    let mut mois_vus = HashSet::new();
    jours
        .into_iter()
        .enumerate()
        .filter_map(|(i, j)| {
            let premiere_du_mois = mois_vus.insert(j[..7].to_string());
            (i < recentes && !premiere_du_mois).then_some(j)
        })
        .collect()
}

/// Dernière copie locale réunie en un seul fichier JSON, prête à envoyer.
pub(crate) struct Paquet {
    pub jour: String,
    pub texte: String,
    pub empreinte: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct Envoyee {
    jour: String,
    sha256: String,
}

fn lire_envoyee(racine: &Path) -> Result<Option<Envoyee>, String> {
    let p = racine.join(SAUVEGARDES).join(ENVOYEE);
    match fs::read_to_string(&p) {
        Ok(t) => serde_json::from_str(&t).map(Some).map_err(|e| format!("{} illisible : {e}", p.display())),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(erreur("lecture de", &p, e)),
    }
}

/// Jour de la dernière copie envoyée sur Nextcloud, `None` si aucune.
#[tauri::command]
pub fn sauvegarde_envoyee(app: tauri::AppHandle) -> Result<Option<String>, String> {
    Ok(lire_envoyee(&racine(&app)?)?.map(|e| e.jour))
}

/// La copie locale la plus récente, si elle est postérieure à la dernière envoyée et que son
/// contenu en diffère (un jour sans séance n'envoie rien). Format : `{ format, jour, fichiers }`,
/// `fichiers` associant chaque chemin relatif à son texte exact.
pub(crate) fn paquet_a_envoyer(racine: &Path) -> Result<Option<Paquet>, String> {
    let dossier = racine.join(SAUVEGARDES);
    let jours = match fs::read_dir(&dossier) {
        Ok(e) => e,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(erreur("lecture de", &dossier, e)),
    };
    let mut dernier: Option<String> = None;
    for e in jours {
        let nom = e.map_err(|err| erreur("lecture de", &dossier, err))?.file_name().to_string_lossy().into_owned();
        if est_jour(&nom) && dernier.as_ref().map_or(true, |d| &nom > d) {
            dernier = Some(nom);
        }
    }
    let Some(jour) = dernier else { return Ok(None) };
    let envoyee = lire_envoyee(racine)?;
    if envoyee.as_ref().is_some_and(|e| e.jour >= jour) {
        return Ok(None);
    }
    let mut fichiers = BTreeMap::new();
    lire_tout(&dossier.join(&jour), "", &mut fichiers)?;
    let empreinte = {
        use sha2::{Digest, Sha256};
        let brut = serde_json::to_vec(&fichiers).map_err(|e| e.to_string())?;
        Sha256::digest(brut).iter().map(|b| format!("{b:02x}")).collect::<String>()
    };
    if envoyee.is_some_and(|e| e.sha256 == empreinte) {
        return Ok(None);
    }
    let texte = texte_paquet(&jour, &fichiers)?;
    Ok(Some(Paquet { jour, texte, empreinte }))
}

fn texte_paquet(jour: &str, fichiers: &BTreeMap<String, String>) -> Result<String, String> {
    serde_json::to_string_pretty(&serde_json::json!({ "format": 1, "jour": jour, "fichiers": fichiers }))
        .map_err(|e| e.to_string())
}

/// Les données telles qu'elles sont maintenant, au format du paquet envoyé (export manuel).
pub(crate) fn paquet_courant(racine: &Path, jour: &str) -> Result<String, String> {
    let mut fichiers = BTreeMap::new();
    lire_tout(racine, "", &mut fichiers)?;
    texte_paquet(jour, &fichiers)
}

/// Saute `sauvegardes/` à la racine et les `.tmp` (écritures en cours), comme `copier`.
fn lire_tout(d: &Path, prefixe: &str, sortie: &mut BTreeMap<String, String>) -> Result<(), String> {
    for e in fs::read_dir(d).map_err(|e| erreur("lecture de", d, e))? {
        let e = e.map_err(|err| erreur("lecture de", d, err))?;
        let nom = e.file_name().to_string_lossy().into_owned();
        if (prefixe.is_empty() && nom == SAUVEGARDES) || nom.ends_with(".tmp") {
            continue;
        }
        let chemin = format!("{prefixe}{nom}");
        if e.path().is_dir() {
            lire_tout(&e.path(), &format!("{chemin}/"), sortie)?;
        } else {
            let texte = fs::read_to_string(e.path()).map_err(|err| erreur("lecture de", &e.path(), err))?;
            sortie.insert(chemin, texte);
        }
    }
    Ok(())
}

pub(crate) fn marquer_envoye(racine: &Path, p: &Paquet) -> Result<(), String> {
    let texte = serde_json::to_string(&Envoyee { jour: p.jour.clone(), sha256: p.empreinte.clone() })
        .map_err(|e| e.to_string())?;
    ecrire_atomique(&racine.join(SAUVEGARDES).join(ENVOYEE), &texte)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chemins() {
        for ok in ["reglages.json", "journal/2026-10.json", "en-cours.json"] {
            assert!(valider(ok).is_ok(), "{ok}");
        }
        for ko in [
            "", "../x.json", "journal/../../x", "/abs.json", "a//b.json", "Maj.json", "a\\b.json",
            ".cache", "x.json.tmp", "sauvegardes", "sauvegardes/2026-10-13/x.json", "C:x.json",
        ] {
            assert!(valider(ko).is_err(), "{ko}");
        }
    }

    #[test]
    fn migration() {
        let b = std::env::temp_dir().join(format!("exzifit-test-migr-{}", std::process::id()));
        let _ = fs::remove_dir_all(&b);
        ecrire_atomique(&b.join("reglages.json"), "{\"format\":1}").unwrap();
        ecrire_atomique(&b.join("cache/WebView/index"), "binaire").unwrap();
        ecrire_atomique(&b.join("sauvegardes/2026-10-13/cache/WebView/index"), "binaire").unwrap();
        // Reprise : un journal déjà déplacé par un lancement interrompu.
        ecrire_atomique(&b.join("donnees.tmp/journal/2026-10.json"), "{}").unwrap();

        let d = b.join(DONNEES);
        migrer(&b, &d).unwrap();
        assert_eq!(fs::read_to_string(d.join("reglages.json")).unwrap(), "{\"format\":1}");
        assert!(d.join("journal/2026-10.json").is_file());
        assert!(!b.join("reglages.json").exists() && !b.join("donnees.tmp").exists());
        assert!(!b.join(SAUVEGARDES).exists(), "ancienne copie du cache supprimée");
        assert!(b.join("cache/WebView/index").is_file(), "cache de la WebView laissé en place");
        assert!(!d.join("cache").exists());

        fs::remove_dir_all(&b).unwrap();
    }

    #[test]
    fn jours() {
        assert!(est_jour("2026-10-13"));
        for ko in ["2026-10-13.tmp", "2026-1-13", "2026/10/13", "abcd-ef-gh", ""] {
            assert!(!est_jour(ko), "{ko}");
        }
    }

    #[test]
    fn elagage() {
        // 70 jours d'affilée à partir du 1er août : on garde les 30 derniers + le 1er de chaque mois.
        let jours: Vec<String> = (0..70)
            .map(|i| {
                let (m, j) = if i < 31 { (8, i + 1) } else if i < 61 { (9, i - 30) } else { (10, i - 60) };
                format!("2026-{m:02}-{j:02}")
            })
            .collect();
        let supprimes = a_elaguer(jours.clone());
        assert_eq!(supprimes.len(), 70 - 30 - 2); // 1er août et 1er septembre gardés en plus
        assert!(!supprimes.contains(&"2026-08-01".to_string()));
        assert!(!supprimes.contains(&"2026-09-01".to_string()));
        assert!(supprimes.contains(&"2026-08-02".to_string()));
        assert!(!supprimes.iter().any(|j| j >= &jours[40]));
        assert!(a_elaguer(jours[..30].to_vec()).is_empty());
    }

    #[test]
    fn sauvegarde() {
        let r = std::env::temp_dir().join(format!("exzifit-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&r);
        fs::create_dir_all(&r).unwrap();

        assert_eq!(sauvegarder(&r, "2026-10-13").unwrap(), None, "rien à copier");

        ecrire_atomique(&r.join("journal/2026-10.json"), "{}").unwrap();
        ecrire_atomique(&r.join("reglages.json"), "{\"format\":1}").unwrap();
        fs::write(r.join("reglages.json.tmp"), "écriture en cours").unwrap();

        let cible = sauvegarder(&r, "2026-10-13").unwrap().expect("copie faite");
        assert_eq!(fs::read_to_string(cible.join("reglages.json")).unwrap(), "{\"format\":1}");
        assert!(cible.join("journal/2026-10.json").is_file());
        assert!(!cible.join("reglages.json.tmp").exists());
        assert_eq!(sauvegarder(&r, "2026-10-13").unwrap(), None, "une fois par jour");

        // Le lendemain : la copie précédente n'est pas recopiée dans la nouvelle.
        let cible = sauvegarder(&r, "2026-10-14").unwrap().unwrap();
        assert!(!cible.join(SAUVEGARDES).exists());

        fs::remove_dir_all(&r).unwrap();
    }

    #[test]
    fn paquet() {
        let r = std::env::temp_dir().join(format!("exzifit-test-paquet-{}", std::process::id()));
        let _ = fs::remove_dir_all(&r);
        fs::create_dir_all(&r).unwrap();
        assert!(paquet_a_envoyer(&r).unwrap().is_none(), "aucune copie");

        ecrire_atomique(&r.join("journal/2026-10.json"), "{
  \"format\": 1
}").unwrap();
        sauvegarder(&r, "2026-10-13").unwrap().unwrap();
        let p = paquet_a_envoyer(&r).unwrap().expect("première copie à envoyer");
        let v: serde_json::Value = serde_json::from_str(&p.texte).unwrap();
        assert_eq!(v["jour"], "2026-10-13");
        assert_eq!(v["fichiers"]["journal/2026-10.json"], "{
  \"format\": 1
}", "texte exact, chemin en /");
        marquer_envoye(&r, &p).unwrap();
        assert!(paquet_a_envoyer(&r).unwrap().is_none(), "déjà envoyée");

        // Le lendemain sans changement : rien ; avec un changement : la nouvelle copie.
        sauvegarder(&r, "2026-10-14").unwrap().unwrap();
        assert!(paquet_a_envoyer(&r).unwrap().is_none(), "contenu identique");
        ecrire_atomique(&r.join("reglages.json"), "{}").unwrap();
        sauvegarder(&r, "2026-10-15").unwrap().unwrap();
        assert_eq!(paquet_a_envoyer(&r).unwrap().unwrap().jour, "2026-10-15");

        // Export : les données vivantes, sans les copies ni les écritures en cours.
        ecrire_atomique(&r.join("en-cours.json.tmp"), "{").unwrap();
        let v: serde_json::Value = serde_json::from_str(&paquet_courant(&r, "2026-10-16").unwrap()).unwrap();
        let chemins: Vec<_> = v["fichiers"].as_object().unwrap().keys().cloned().collect();
        assert_eq!(chemins, ["journal/2026-10.json", "reglages.json"]);

        fs::remove_dir_all(&r).unwrap();
    }
}
