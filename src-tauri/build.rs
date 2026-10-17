fn main() {
    // Canal de compilation (README, « Dev et prod ») : `prod` = version Google Play, sans mise à
    // jour par Nextcloud, sans envoi des sauvegardes ni synchro. Tout le reste (absent compris) = dev.
    println!("cargo::rerun-if-env-changed=EXZIFIT_CANAL");
    println!("cargo::rustc-check-cfg=cfg(canal_dev)");
    match std::env::var("EXZIFIT_CANAL").as_deref() {
        Ok("prod") => {}
        Ok("dev") | Err(_) => println!("cargo::rustc-cfg=canal_dev"),
        Ok(autre) => panic!("EXZIFIT_CANAL={autre} : attendu dev ou prod"),
    }
    tauri_build::build()
}
