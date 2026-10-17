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

/// Alarme exacte permise ? Sans elle, la vibration de fin peut arriver des minutes en retard.
/// Accordée d'office jusqu'à Android 13 ; à demander depuis Android 14 (SCHEDULE_EXACT_ALARM).
#[tauri::command]
pub fn alarme_exacte(app: AppHandle) -> Result<bool, String> {
    #[derive(serde::Deserialize)]
    struct Reponse {
        permise: bool,
    }
    app.state::<Repos>()
        .0
        .run_mobile_plugin::<Reponse>("alarmeExacte", ())
        .map(|r| r.permise)
        .map_err(|e| format!("Alarme exacte : {e}"))
}

/// Ouvre l'écran d'Android qui permet les alarmes exactes pour ExziFit.
#[tauri::command]
pub fn alarme_exacte_demander(app: AppHandle) -> Result<(), String> {
    app.state::<Repos>()
        .0
        .run_mobile_plugin::<()>("alarmeExacteDemander", ())
        .map_err(|e| format!("Alarme exacte : {e}"))
}
