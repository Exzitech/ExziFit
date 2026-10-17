fn main() {
    // Canal de compilation (README, « Dev et prod ») : `prod` = version Google Play, sans mise à
    // jour par Nextcloud, sans envoi des sauvegardes ni synchro. `potes` = même app que la prod,
    // mise à jour par Nextcloud (version.json), sans envoi ni synchro. Tout le reste (absent compris) = dev.
    println!("cargo::rerun-if-env-changed=EXZIFIT_CANAL");
    println!("cargo::rustc-check-cfg=cfg(canal_dev)");
    println!("cargo::rustc-check-cfg=cfg(canal_potes)");
    println!("cargo::rustc-check-cfg=cfg(maj_nextcloud)");
    match std::env::var("EXZIFIT_CANAL").as_deref() {
        Ok("prod") => {}
        Ok("potes") => {
            println!("cargo::rustc-cfg=canal_potes");
            println!("cargo::rustc-cfg=maj_nextcloud");
        }
        Ok("dev") | Err(_) => {
            println!("cargo::rustc-cfg=canal_dev");
            println!("cargo::rustc-cfg=maj_nextcloud");
        }
        Ok(autre) => panic!("EXZIFIT_CANAL={autre} : attendu dev, potes ou prod"),
    }
    tauri_build::build()
}
