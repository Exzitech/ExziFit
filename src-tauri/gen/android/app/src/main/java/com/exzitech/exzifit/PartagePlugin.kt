package com.exzitech.exzifit

import android.app.Activity
import android.content.Intent
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import java.io.File

@InvokeArg
class PartagerArgs {
    lateinit var chemin: String
}

/** Ouvre le partage d'Android (mail, Drive, messagerie…) sur un export du cache de l'app (partage.rs). */
@TauriPlugin
class PartagePlugin(private val activity: Activity) : Plugin(activity) {
    @Command
    fun partager(invoke: Invoke) {
        try {
            val fichier = File(invoke.parseArgs(PartagerArgs::class.java).chemin)
            val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", fichier)
            val envoi = Intent(Intent.ACTION_SEND)
                .setType("application/json")
                .putExtra(Intent.EXTRA_STREAM, uri)
                .putExtra(Intent.EXTRA_SUBJECT, fichier.name)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            activity.startActivity(Intent.createChooser(envoi, activity.getString(R.string.exporter)))
            invoke.resolve()
        } catch (ex: Exception) {
            invoke.reject(ex.message)
        }
    }
}
