//! Mise à jour de l'APK **dev** et **potes** depuis le dossier Nextcloud partagé par lien public (maj.json).
//! `npm run publier` y dépose `ExziFit-dev.apk` et `version-dev.json`, `npm run publier-potes`
//! `ExziFit.apk` et `version.json` ; au lancement, l'app compare
//! sa version, télécharge l'APK dans son cache, vérifie l'empreinte SHA-256 et ouvre
//! l'installeur d'Android (InstallateurPlugin.kt), qui exige en plus la même signature.
//! Repris d'ExziHub (maj_apk.rs, telechargement.rs), sans variantes ni catalogue de plugins.

use serde::{Deserialize, Serialize};

/// `version.json` (et `ExziFit.apk`) : l'app des potes, même identifiant que la prod, jusqu'à
/// leur passage par le Play Store. `version-dev.json` : ExziFit Dev.
const VERSION: &str = if cfg!(canal_potes) { "version.json" } else { "version-dev.json" };

/// Lien public du dossier partagé, intégré à la compilation : rien à côté de l'APK.
fn lien() -> Result<String, String> {
    #[derive(Deserialize)]
    struct Config {
        lien: String,
    }
    let c: Config = serde_json::from_str(include_str!("../maj.json")).map_err(|e| format!("maj.json : {e}"))?;
    if c.lien.is_empty() {
        return Err("maj.json : lien de partage Nextcloud absent".into());
    }
    Ok(c.lien.trim_end_matches('/').to_string())
}

/// Adresse de téléchargement d'un fichier à la racine du dossier partagé.
fn url(fichier: &str) -> Result<String, String> {
    if fichier.is_empty() || !fichier.chars().all(|c| c.is_ascii_alphanumeric() || "._-".contains(c)) {
        return Err(format!("Nom de fichier refusé : {fichier}"));
    }
    Ok(format!("{}/download?path=%2F&files={fichier}", lien()?))
}

/// Contenu de version-dev.json ou version.json, écrit par scripts/publier.cjs.
#[derive(Deserialize)]
#[cfg_attr(not(target_os = "android"), allow(dead_code))]
pub struct Publication {
    pub version: String,
    pub fichier: String,
    pub sha256: String,
    pub taille: Option<u64>,
}

fn version_nombres(v: &str) -> Result<Vec<u64>, String> {
    v.split('.').map(|n| n.trim().parse().map_err(|_| format!("Version illisible : {v}"))).collect()
}

/// La publication si elle est plus récente que `courante`.
fn plus_recente(p: Publication, courante: &str) -> Result<Option<Publication>, String> {
    Ok((version_nombres(&p.version)? > version_nombres(courante)?).then_some(p))
}

/// Télécharge en mémoire (200 Mo max). Bloquant : à appeler hors du thread principal.
/// Délai par lecture, pas pour tout le fichier : une connexion lente mais vivante aboutit.
fn http_get(url: &str, mut progression: impl FnMut(u64)) -> Result<Vec<u8>, String> {
    use std::io::Read;
    const MAX: u64 = 200 * 1024 * 1024;
    let reponse = ureq::AgentBuilder::new()
        .timeout_connect(std::time::Duration::from_secs(20))
        .timeout_read(std::time::Duration::from_secs(60))
        .build()
        .get(url)
        .call()
        .map_err(|e| format!("Téléchargement impossible : {e}"))?;
    let mut lecteur = reponse.into_reader().take(MAX);
    let mut octets = Vec::new();
    let mut morceau = [0u8; 64 * 1024];
    loop {
        let n = lecteur.read(&mut morceau).map_err(|e| format!("Téléchargement interrompu : {e}"))?;
        if n == 0 {
            return Ok(octets);
        }
        octets.extend_from_slice(&morceau[..n]);
        progression(octets.len() as u64);
    }
}

#[cfg_attr(not(target_os = "android"), allow(dead_code))]
fn sha256_hex(octets: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    Sha256::digest(octets).iter().map(|b| format!("{b:02x}")).collect()
}

fn publication(courante: &str) -> Result<Option<Publication>, String> {
    let p: Publication = serde_json::from_slice(&http_get(&url(VERSION)?, |_| {})?)
        .map_err(|e| format!("{VERSION} illisible : {e}"))?;
    plus_recente(p, courante)
}

#[derive(Serialize)]
pub struct Disponible {
    version: String,
}

/// Version publiée plus récente que celle installée, ou null.
#[tauri::command]
pub async fn maj_verifier(app: tauri::AppHandle) -> Result<Option<Disponible>, String> {
    let courante = app.package_info().version.to_string();
    tauri::async_runtime::spawn_blocking(move || publication(&courante))
        .await
        .map_err(|e| e.to_string())?
        .map(|p| p.map(|p| Disponible { version: p.version }))
}

/// Côté Android seulement ; appelé par son chemin complet dans lib.rs (`generate_handler!`
/// ne suit pas un `pub use`).
#[cfg(target_os = "android")]
pub mod android {
    use super::*;
    use tauri::plugin::{Builder, PluginHandle, TauriPlugin};
    use tauri::{AppHandle, Emitter, Manager, Wry};

    struct Installateur(PluginHandle<Wry>);

    /// Enregistre la classe Kotlin (gen/android/.../InstallateurPlugin.kt).
    pub fn init() -> TauriPlugin<Wry> {
        Builder::new("installateur")
            .setup(|app, api| {
                let handle = api.register_android_plugin("com.exzitech.exzifit", "InstallateurPlugin")?;
                app.manage(Installateur(handle));
                Ok(())
            })
            .build()
    }

    /// Progression envoyée à la webview (événement "maj").
    #[derive(Clone, Serialize)]
    struct Progression {
        recu: u64,
        total: Option<u64>,
    }

    /// Télécharge la version publiée, vérifie son empreinte et ouvre l'installeur d'Android.
    #[tauri::command]
    pub async fn maj_installer(app: AppHandle) -> Result<(), String> {
        #[derive(Serialize)]
        struct Args {
            chemin: String,
        }
        let a = app.clone();
        let chemin = tauri::async_runtime::spawn_blocking(move || -> Result<String, String> {
            let courante = a.package_info().version.to_string();
            let p = publication(&courante)?.ok_or("Aucune version plus récente publiée")?;
            // Un événement par pourcent (par Mo sans taille connue), pas un par morceau lu.
            let mut dernier = u64::MAX;
            let octets = http_get(&url(&p.fichier)?, |recu| {
                let palier = p.taille.map_or(recu / 1_000_000, |t| recu * 100 / t.max(1));
                if palier != dernier {
                    dernier = palier;
                    let _ = a.emit("maj", Progression { recu, total: p.taille });
                }
            })?;
            if !sha256_hex(&octets).eq_ignore_ascii_case(&p.sha256) {
                return Err(format!("{} : empreinte différente, téléchargement corrompu ou fichier en cours de synchro", p.fichier));
            }
            // Le cache est le dossier exposé par le FileProvider (res/xml/file_paths.xml).
            let dossier = a.path().app_cache_dir().map_err(|e| e.to_string())?;
            std::fs::create_dir_all(&dossier).map_err(|e| format!("{} : {e}", dossier.display()))?;
            let chemin = dossier.join("mise-a-jour.apk");
            std::fs::write(&chemin, octets).map_err(|e| format!("{} : {e}", chemin.display()))?;
            Ok(chemin.to_string_lossy().into_owned())
        })
        .await
        .map_err(|e| e.to_string())??;
        app.state::<Installateur>()
            .0
            .run_mobile_plugin::<()>("installer", Args { chemin })
            .map_err(|e| format!("Installeur Android : {e}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn publiee(v: &str) -> Publication {
        Publication { version: v.into(), fichier: "ExziFit.apk".into(), sha256: "ab".into(), taille: None }
    }

    #[test]
    fn compare_les_versions_en_nombres() {
        assert_eq!(plus_recente(publiee("0.10.0"), "0.9.3").unwrap().unwrap().version, "0.10.0");
        assert!(plus_recente(publiee("0.2.0"), "0.2.0").unwrap().is_none());
        assert!(plus_recente(publiee("0.1.9"), "0.2.0").unwrap().is_none());
        assert!(plus_recente(publiee("abc"), "0.2.0").is_err());
    }

    #[test]
    fn refuse_un_nom_de_fichier_qui_sort_du_dossier() {
        assert!(url("../x.apk").is_err());
        assert!(url("a&files=b").is_err());
    }
}
