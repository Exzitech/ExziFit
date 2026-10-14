mod envoi;
mod fichiers;
mod maj;
mod synchro;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_notification::init());
    #[cfg(target_os = "android")]
    let builder = builder.plugin(maj::android::init());
    builder
        .invoke_handler(tauri::generate_handler![
            fichiers::lire,
            fichiers::ecrire,
            fichiers::lister,
            fichiers::supprimer,
            fichiers::sauvegarde_du_jour,
            fichiers::dossier_donnees,
            fichiers::sauvegarde_envoyee,
            envoi::sauvegarde_envoyer,
            fichiers::sauvegarde_synchro,
            synchro::synchro_compte,
            synchro::synchro_configurer,
            synchro::synchro_lire,
            synchro::synchro_ecrire,
            maj::maj_verifier,
            #[cfg(target_os = "android")]
            maj::android::maj_installer,
        ])
        .run(tauri::generate_context!())
        .expect("échec du lancement");
}
