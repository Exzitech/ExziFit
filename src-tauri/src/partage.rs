//! Export manuel : toutes les données dans un fichier JSON (format du paquet envoyé sur Nextcloud),
//! posé dans le cache de l'app puis proposé au partage Android (gen/android/.../PartagePlugin.kt).
//! Sur le PC, le fichier reste dans le cache et son chemin est renvoyé.

use crate::fichiers;
use tauri::{AppHandle, Manager};

/// Écrit `exzifit-<jour>.json` dans le cache, ouvre le partage sur Android ; renvoie le chemin.
#[tauri::command]
pub async fn exporter(app: AppHandle, jour: String) -> Result<String, String> {
    let a = app.clone();
    let chemin = tauri::async_runtime::spawn_blocking(move || -> Result<String, String> {
        let texte = fichiers::paquet_courant(&fichiers::racine(&a)?, &jour)?;
        // Le cache est le dossier exposé par le FileProvider (res/xml/file_paths.xml).
        let dossier = a.path().app_cache_dir().map_err(|e| e.to_string())?;
        std::fs::create_dir_all(&dossier).map_err(|e| format!("{} : {e}", dossier.display()))?;
        let chemin = dossier.join(format!("exzifit-{jour}.json"));
        std::fs::write(&chemin, texte).map_err(|e| format!("{} : {e}", chemin.display()))?;
        Ok(chemin.to_string_lossy().into_owned())
    })
    .await
    .map_err(|e| e.to_string())??;
    #[cfg(target_os = "android")]
    android::partager(&app, &chemin)?;
    Ok(chemin)
}

#[cfg(target_os = "android")]
pub mod android {
    use serde::Serialize;
    use tauri::plugin::{Builder, PluginHandle, TauriPlugin};
    use tauri::{AppHandle, Manager, Wry};

    struct Partage(PluginHandle<Wry>);

    /// Enregistre la classe Kotlin.
    pub fn init() -> TauriPlugin<Wry> {
        Builder::new("partage")
            .setup(|app, api| {
                let handle = api.register_android_plugin("com.exzitech.exzifit", "PartagePlugin")?;
                app.manage(Partage(handle));
                Ok(())
            })
            .build()
    }

    pub(super) fn partager(app: &AppHandle, chemin: &str) -> Result<(), String> {
        #[derive(Serialize)]
        struct Args<'a> {
            chemin: &'a str,
        }
        app.state::<Partage>()
            .0
            .run_mobile_plugin::<()>("partager", Args { chemin })
            .map_err(|e| format!("Partage Android : {e}"))
    }
}
