mod envoi;
mod fichiers;
mod maj;
mod partage;
#[cfg(target_os = "android")]
mod repos;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_notification::init());
    #[cfg(target_os = "android")]
    let builder = builder.plugin(maj::android::init()).plugin(repos::init()).plugin(partage::android::init());
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
            partage::exporter,
            fichiers::importer,
            maj::maj_verifier,
            #[cfg(target_os = "android")]
            maj::android::maj_installer,
            #[cfg(target_os = "android")]
            repos::repos_afficher,
            #[cfg(target_os = "android")]
            repos::repos_retirer,
        ])
        .run(tauri::generate_context!())
        .expect("échec du lancement");
}
