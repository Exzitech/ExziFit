//! Décompte du repos dans le volet Android (gen/android/.../ReposPlugin.kt). Android seulement :
//! sur le PC, le repos n'est qu'un compte à rebours à l'écran (minuteur.ts).

use serde::Serialize;
use tauri::plugin::{Builder, PluginHandle, TauriPlugin};
use tauri::{AppHandle, Manager, Wry};

struct Repos(PluginHandle<Wry>);

/// Enregistre la classe Kotlin.
pub fn init() -> TauriPlugin<Wry> {
    Builder::new("repos")
        .setup(|app, api| {
            let handle = api.register_android_plugin("com.exzitech.exzifit", "ReposPlugin")?;
            app.manage(Repos(handle));
            Ok(())
        })
        .build()
}

/// Affiche (ou remplace) le décompte jusqu'à `fin` (ms depuis l'époque).
#[tauri::command]
pub fn repos_afficher(app: AppHandle, fin: i64) -> Result<(), String> {
    #[derive(Serialize)]
    struct Args {
        fin: i64,
    }
    app.state::<Repos>()
        .0
        .run_mobile_plugin::<()>("afficher", Args { fin })
        .map_err(|e| format!("Décompte du repos : {e}"))
}

/// Retire le décompte (fin de séance).
#[tauri::command]
pub fn repos_retirer(app: AppHandle) -> Result<(), String> {
    app.state::<Repos>()
        .0
        .run_mobile_plugin::<()>("retirer", ())
        .map_err(|e| format!("Décompte du repos : {e}"))
}
