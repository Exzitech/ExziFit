//! Envoi de la dernière copie locale (`sauvegardes/`) sur Nextcloud : un fichier
//! `exzifit-AAAA-MM-JJ.json` par jour où les données ont changé, dans un dossier partagé en
//! **dépôt de fichiers** (lien public en écriture seule, dans sauvegarde.json). Le lien est
//! dans l'APK, lui-même public : il permet de déposer, jamais de lire ni d'effacer.
//! Sans réseau, rien ne se passe ; la copie part au prochain lancement connecté.

use crate::fichiers;
use std::time::Duration;

/// `https://hôte/s/JETON` → adresse WebDAV publique du dossier (Nextcloud 29 et plus).
fn dav(lien: &str) -> Result<String, String> {
    let (hote, jeton) = lien
        .trim_end_matches('/')
        .rsplit_once("/s/")
        .filter(|(h, j)| h.starts_with("https://") && !j.is_empty() && j.chars().all(|c| c.is_ascii_alphanumeric()))
        .ok_or_else(|| format!("sauvegarde.json : lien de partage Nextcloud invalide ou absent : {lien:?}"))?;
    Ok(format!("{hote}/public.php/dav/files/{jeton}"))
}

fn lien() -> Result<String, String> {
    #[derive(serde::Deserialize)]
    struct Config {
        lien: String,
    }
    let c: Config =
        serde_json::from_str(include_str!("../sauvegarde.json")).map_err(|e| format!("sauvegarde.json : {e}"))?;
    Ok(c.lien)
}

/// Jour envoyé, `None` si rien à envoyer ou pas de réseau.
#[tauri::command]
pub async fn sauvegarde_envoyer(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let racine = fichiers::racine(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let Some(p) = fichiers::paquet_a_envoyer(&racine)? else { return Ok(None) };
        // Build de dev (`npm run tauri dev` sur le PC, APK debug) : nom à part, pour ne jamais
        // écraser la copie du jour envoyée par le téléphone.
        let suffixe = if cfg!(debug_assertions) { "-dev" } else { "" };
        let url = format!("{}/exzifit-{}{suffixe}.json", dav(&lien()?)?, p.jour);
        let envoi = ureq::AgentBuilder::new()
            .timeout_connect(Duration::from_secs(20))
            .timeout_read(Duration::from_secs(60))
            .build()
            .put(&url)
            .set("Content-Type", "application/json")
            .send_string(&p.texte);
        match envoi {
            Ok(_) => {}
            // Hors réseau (mode avion, sous-sol, coupure en route) : cas normal, nouvel essai au
            // prochain lancement. Toute autre erreur (refus du serveur, TLS) remonte.
            Err(ureq::Error::Transport(t))
                if matches!(t.kind(), ureq::ErrorKind::Dns | ureq::ErrorKind::ConnectionFailed | ureq::ErrorKind::Io) =>
            {
                return Ok(None)
            }
            Err(e) => return Err(format!("Envoi de la sauvegarde {} : {e}", p.jour)),
        }
        fichiers::marquer_envoye(&racine, &p)?;
        Ok(Some(p.jour))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adresse_webdav() {
        assert_eq!(dav("https://h.org/s/AbC12/").unwrap(), "https://h.org/public.php/dav/files/AbC12");
        for ko in ["", "http://h.org/s/AbC", "https://h.org/s/", "https://h.org/s/a/../b", "https://h.org/index.php/x"] {
            assert!(dav(ko).is_err(), "{ko}");
        }
    }
}
