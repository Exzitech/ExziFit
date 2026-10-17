// Mise à jour par Nextcloud, envoi des sauvegardes et synchro : canal dev seulement (build.rs).
// Google Play interdit toute mise à jour hors du Play Store, et le lien de dépôt serait public.
#[cfg(canal_dev)]
mod envoi;
mod fichiers;
#[cfg(canal_dev)]
mod maj;
mod partage;
#[cfg(target_os = "android")]
mod repos;
#[cfg(canal_dev)]
mod synchro;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_notification::init());
    #[cfg(target_os = "android")]
    let builder = builder.plugin(repos::init()).plugin(partage::android::init());
    #[cfg(all(target_os = "android", canal_dev))]
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
            #[cfg(canal_dev)]
            envoi::sauvegarde_envoyer,
            partage::exporter,
            fichiers::importer,
            fichiers::sauvegarde_synchro,
            #[cfg(canal_dev)]
            synchro::synchro_compte,
            #[cfg(canal_dev)]
            synchro::synchro_configurer,
            #[cfg(canal_dev)]
            synchro::synchro_lire,
            #[cfg(canal_dev)]
            synchro::synchro_ecrire,
            #[cfg(canal_dev)]
            maj::maj_verifier,
            #[cfg(all(target_os = "android", canal_dev))]
            maj::android::maj_installer,
            #[cfg(target_os = "android")]
            repos::repos_afficher,
            #[cfg(target_os = "android")]
            repos::repos_retirer,
            #[cfg(target_os = "android")]
            repos::alarme_exacte,
            #[cfg(target_os = "android")]
            repos::alarme_exacte_demander,
        ])
        .run(tauri::generate_context!())
        .expect("échec du lancement");
}
