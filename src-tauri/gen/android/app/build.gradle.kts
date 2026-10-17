import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("rust")
}

val tauriProperties = Properties().apply {
    val propFile = file("tauri.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

// Clé de signature de l'APK release : gen/android/keystore.properties (local, jamais copié
// ailleurs), avec keyAlias, password et storeFile. Sans ce fichier, l'APK release sort non signé.
// Une autre clé ne peut pas mettre à jour l'app installée : garder la clé et le fichier à l'abri.
val keystoreProperties = Properties().apply {
    val propFile = rootProject.file("keystore.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

// Canal (README, « Dev et prod »), le même que lit src-tauri/build.rs. dev (par défaut) :
// « ExziFit Dev », identifiant .dev, installée à côté de la prod avec ses propres données, mise à
// jour par Nextcloud. potes : l'app des amis, identifiant de la prod, mise à jour par Nextcloud.
// prod : la version Google Play, sans mise à jour hors du Play Store.
val canal = System.getenv("EXZIFIT_CANAL") ?: "dev"
require(canal == "dev" || canal == "potes" || canal == "prod") { "EXZIFIT_CANAL=$canal : attendu dev, potes ou prod" }

android {
    compileSdk = 36
    if (!keystoreProperties.isEmpty) {
        signingConfigs {
            create("release") {
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("password")
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("password")
            }
        }
    }
    namespace = "com.exzitech.exzifit"
    defaultConfig {
        manifestPlaceholders["usesCleartextTraffic"] = "false"
        applicationId = "com.exzitech.exzifit"
        if (canal == "dev") applicationIdSuffix = ".dev"
        manifestPlaceholders["nomApp"] = if (canal == "dev") "ExziFit Dev" else "ExziFit"
        minSdk = 24
        targetSdk = 36
        versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()
        versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")
    }
    buildTypes {
        getByName("debug") {
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            isDebuggable = true
            isJniDebuggable = true
            isMinifyEnabled = false
            packaging {                jniLibs.keepDebugSymbols.add("*/arm64-v8a/*.so")
                jniLibs.keepDebugSymbols.add("*/armeabi-v7a/*.so")
                jniLibs.keepDebugSymbols.add("*/x86/*.so")
                jniLibs.keepDebugSymbols.add("*/x86_64/*.so")
            }
        }
        getByName("release") {
            if (!keystoreProperties.isEmpty) {
                signingConfig = signingConfigs.getByName("release")
            }
            isMinifyEnabled = true
            // Code natif compressé dans l'APK : mise à jour plus légère à télécharger depuis
            // Nextcloud (envoi lent de la maison) ; Android le décompresse à l'installation.
            packaging { jniLibs.useLegacyPackaging = true }
            proguardFiles(
                *fileTree(".") { include("**/*.pro") }
                    .plus(getDefaultProguardFile("proguard-android-optimize.txt"))
                    .toList().toTypedArray()
            )
        }
    }
    // Mise à jour par Nextcloud (installeur et permission) : dev et potes.
    if (canal != "prod") {
        sourceSets {
            getByName("main").java.srcDir("src/canal-dev/java")
            // Un seul manifeste par jeu de sources : celui du canal passe par les types de build.
            getByName("debug").manifest.srcFile("src/canal-dev/AndroidManifest.xml")
            getByName("release").manifest.srcFile("src/canal-dev/AndroidManifest.xml")
        }
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
    buildFeatures {
        buildConfig = true
    }
}

rust {
    rootDirRel = "../../../"
}

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.lifecycle:lifecycle-process:2.10.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.4")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.0")
}

apply(from = "tauri.build.gradle.kts")