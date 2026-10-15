//! Synchro PC ↔ téléphone : un fichier `etat.json` dans le dossier Nextcloud privé `ExziFit-sync`,
//! partagé à un utilisateur Nextcloud dédié qui ne voit que lui. Ici, que le transport (WebDAV
//! authentifié, ETag) ; la fusion est dans le front (src/donnees/synchro.ts), testée.
//!
//! Le mot de passe d'application est saisi dans Réglages et rangé dans `acces-synchro.json`, à la
//! racine de `app_data_dir()`, **hors** de `donnees/` : il ne part jamais dans les sauvegardes
//! envoyées sur le partage public. Il n'est jamais renvoyé au front.

use crate::fichiers;
use base64::Engine;
use std::fs;
use std::io;
use std::path::PathBuf;
use std::time::Duration;
use tauri::Manager;

const ACCES: &str = "acces-synchro.json";
const DOSSIER: &str = "ExziFit-sync";
const FICHIER: &str = "etat.json";

#[derive(serde::Serialize, serde::Deserialize)]
struct Acces {
    serveur: String,
    utilisateur: String,
    mot_de_passe: String,
}

fn chemin_acces(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app.path().app_data_dir().map_err(|e| format!("dossier de données introuvable : {e}"))?;
    Ok(base.join(ACCES))
}

fn lire_acces(app: &tauri::AppHandle) -> Result<Option<Acces>, String> {
    let p = chemin_acces(app)?;
    match fs::read_to_string(&p) {
        Ok(t) => serde_json::from_str(&t).map(Some).map_err(|e| format!("{} illisible : {e}", p.display())),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("lecture de {} : {e}", p.display())),
    }
}

/// `https://hôte` sans `/` final ; l'utilisateur en caractères sûrs pour l'URL.
fn verifier(serveur: &str, utilisateur: &str) -> Result<(), String> {
    let hote = serveur.strip_prefix("https://").ok_or("le serveur doit commencer par https://")?;
    if hote.is_empty() || hote.contains('/') {
        return Err(format!("serveur invalide : {serveur:?} (attendu : https://hôte)"));
    }
    if utilisateur.is_empty() || !utilisateur.chars().all(|c| c.is_ascii_alphanumeric() || "._-".contains(c)) {
        return Err(format!("nom d'utilisateur invalide : {utilisateur:?}"));
    }
    Ok(())
}

fn url(a: &Acces, fichier: &str) -> String {
    format!("{}/remote.php/dav/files/{}/{DOSSIER}{fichier}", a.serveur, a.utilisateur)
}

fn agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(15))
        .timeout_read(Duration::from_secs(60))
        .build()
}

fn auth(a: &Acces) -> String {
    let brut = format!("{}:{}", a.utilisateur, a.mot_de_passe);
    format!("Basic {}", base64::engine::general_purpose::STANDARD.encode(brut))
}

/// Apache (conteneur Nextcloud) compresse la réponse et ajoute alors `-gzip` à l'ETag ; un proxy
/// peut aussi le rendre faible (`W/"…"`). Nextcloud ne reconnaît ni l'un ni l'autre en `If-Match`
/// (412 à chaque envoi, vu le 2026-10-14). On redemande sans compression, et on nettoie quand même.
fn etag_fort(e: &str) -> String {
    let e = e.trim().trim_start_matches("W/");
    match e.strip_suffix("-gzip\"") {
        Some(debut) => format!("{debut}\""),
        None => e.to_string(),
    }
}

/// Hors réseau (mode avion, sous-sol) : cas normal, pas une erreur.
fn hors_reseau(e: &ureq::Error) -> bool {
    matches!(e, ureq::Error::Transport(t)
        if matches!(t.kind(), ureq::ErrorKind::Dns | ureq::ErrorKind::ConnectionFailed | ureq::ErrorKind::Io))
}

fn refus(action: &str, code: u16) -> String {
    match code {
        401 => format!("{action} : identifiant ou mot de passe d'application refusé (Réglages)"),
        404 | 409 => format!("{action} : dossier {DOSSIER} introuvable pour cet utilisateur (partage manquant ?)"),
        _ => format!("{action} : le serveur a répondu {code}"),
    }
}

#[derive(serde::Serialize)]
pub struct Compte {
    serveur: String,
    utilisateur: String,
}

#[derive(serde::Serialize)]
pub struct InfoSynchro {
    /// Hôte du partage des sauvegardes, proposé par défaut.
    serveur_defaut: Option<String>,
    compte: Option<Compte>,
}

#[tauri::command]
pub fn synchro_compte(app: tauri::AppHandle) -> Result<InfoSynchro, String> {
    let compte = lire_acces(&app)?.map(|a| Compte { serveur: a.serveur, utilisateur: a.utilisateur });
    let serveur_defaut = crate::envoi::lien().ok().and_then(|l| l.split_once("/s/").map(|(h, _)| h.to_string()));
    Ok(InfoSynchro { serveur_defaut, compte })
}

/// Enregistre le compte ; `mot_de_passe` vide = garder l'actuel (changement d'utilisateur ou de serveur seul).
#[tauri::command]
pub fn synchro_configurer(app: tauri::AppHandle, serveur: String, utilisateur: String, mot_de_passe: String) -> Result<(), String> {
    let serveur = serveur.trim().trim_end_matches('/').to_string();
    let utilisateur = utilisateur.trim().to_string();
    verifier(&serveur, &utilisateur)?;
    let mot_de_passe = if mot_de_passe.is_empty() {
        lire_acces(&app)?.map(|a| a.mot_de_passe).ok_or("mot de passe d'application manquant")?
    } else {
        mot_de_passe.trim().to_string()
    };
    let texte = serde_json::to_string(&Acces { serveur, utilisateur, mot_de_passe }).map_err(|e| e.to_string())?;
    fichiers::ecrire_atomique(&chemin_acces(&app)?, &texte)
}

#[derive(serde::Serialize)]
#[serde(tag = "etat", rename_all = "kebab-case")]
pub enum Lu {
    NonConfigure,
    HorsLigne,
    /// Dossier présent, pas encore de fichier : première synchro.
    Absent,
    Ok { texte: String, etag: String },
}

#[tauri::command]
pub async fn synchro_lire(app: tauri::AppHandle) -> Result<Lu, String> {
    let Some(a) = lire_acces(&app)? else { return Ok(Lu::NonConfigure) };
    tauri::async_runtime::spawn_blocking(move || {
        // `identity` : pas de compression, l'ETag reste celui de Nextcloud (voir `etag_fort`).
        let req = agent().get(&url(&a, &format!("/{FICHIER}"))).set("Authorization", &auth(&a)).set("Accept-Encoding", "identity");
        match req.call() {
            Ok(r) => {
                let etag = etag_fort(r.header("ETag").ok_or("lecture de la synchro : pas d'ETag dans la réponse")?);
                let texte = r.into_string().map_err(|e| format!("lecture de la synchro : {e}"))?;
                Ok(Lu::Ok { texte, etag })
            }
            Err(e) if hors_reseau(&e) => Ok(Lu::HorsLigne),
            Err(ureq::Error::Status(404, _)) => {
                // Fichier absent : normal la première fois, si le dossier existe bien.
                match agent().request("PROPFIND", &url(&a, "")).set("Authorization", &auth(&a)).set("Depth", "0").call() {
                    Ok(_) => Ok(Lu::Absent),
                    Err(e) if hors_reseau(&e) => Ok(Lu::HorsLigne),
                    Err(ureq::Error::Status(c, _)) => Err(refus("Synchro", c)),
                    Err(e) => Err(format!("Synchro : {e}")),
                }
            }
            Err(ureq::Error::Status(c, _)) => Err(refus("Synchro", c)),
            Err(e) => Err(format!("Synchro : {e}")),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(serde::Serialize)]
#[serde(tag = "etat", rename_all = "kebab-case")]
pub enum Ecrit {
    HorsLigne,
    /// Un autre appareil a écrit entre la lecture et l'écriture : relire, refusionner.
    Conflit,
    Ok { etag: Option<String> },
}

/// Écrit `etat.json` si sa version distante est toujours `etag` (`None` : seulement s'il n'existe pas).
#[tauri::command]
pub async fn synchro_ecrire(app: tauri::AppHandle, texte: String, etag: Option<String>) -> Result<Ecrit, String> {
    let a = lire_acces(&app)?.ok_or("synchro non configurée")?;
    tauri::async_runtime::spawn_blocking(move || {
        let req = agent()
            .put(&url(&a, &format!("/{FICHIER}")))
            .set("Authorization", &auth(&a))
            .set("Content-Type", "application/json");
        let req = match &etag {
            Some(e) => req.set("If-Match", e),
            None => req.set("If-None-Match", "*"),
        };
        match req.send_string(&texte) {
            Ok(r) => Ok(Ecrit::Ok { etag: r.header("ETag").map(etag_fort) }),
            Err(e) if hors_reseau(&e) => Ok(Ecrit::HorsLigne),
            Err(ureq::Error::Status(412, _)) => Ok(Ecrit::Conflit),
            Err(ureq::Error::Status(c, _)) => Err(refus("Envoi de la synchro", c)),
            Err(e) => Err(format!("Envoi de la synchro : {e}")),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compte() {
        assert!(verifier("https://h.org", "exzifit").is_ok());
        assert!(verifier("https://h.org", "tom.r_2-x").is_ok());
        for (s, u) in [("http://h.org", "a"), ("https://", "a"), ("https://h.org/x", "a"), ("https://h.org", ""), ("https://h.org", "a/b"), ("https://h.org", "a b")] {
            assert!(verifier(s, u).is_err(), "{s} {u}");
        }
    }

    #[test]
    fn adresse() {
        let a = Acces { serveur: "https://h.org".into(), utilisateur: "exzifit".into(), mot_de_passe: "x".into() };
        assert_eq!(url(&a, "/etat.json"), "https://h.org/remote.php/dav/files/exzifit/ExziFit-sync/etat.json");
        assert_eq!(auth(&a), "Basic ZXh6aWZpdDp4");
    }

    #[test]
    fn etag() {
        assert_eq!(etag_fort("W/\"abc\""), "\"abc\"");
        assert_eq!(etag_fort("\"abc\""), "\"abc\"");
        assert_eq!(etag_fort("\"abc-gzip\""), "\"abc\"");
    }
}
