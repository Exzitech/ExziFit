package com.exzitech.exzifit

import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin

@InvokeArg
class AfficherArgs {
    /** Instant de fin du repos, en ms depuis l'époque. */
    var fin: Long = 0
}

/**
 * Décompte du repos visible hors de l'app (volet et écran verrouillé). Le chronomètre est tenu par
 * le système : rien ne tourne côté app. Muet : la vibration de fin reste la notification programmée
 * de minuteur.ts (alarme exacte) ; celle-ci disparaît d'elle-même à la fin du repos.
 */
@TauriPlugin
class ReposPlugin(private val activity: Activity) : Plugin(activity) {
    private val canal = "repos-en-cours"
    private val id = 2 // 1 = notification de fin (minuteur.ts)

    @Command
    fun afficher(invoke: Invoke) {
        try {
            val fin = invoke.parseArgs(AfficherArgs::class.java).fin
            val duree = fin - System.currentTimeMillis()
            if (duree <= 0) return invoke.resolve()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val c = NotificationChannel(canal, activity.getString(R.string.canal_repos_en_cours), NotificationManager.IMPORTANCE_DEFAULT)
                c.setSound(null, null)
                c.enableVibration(false)
                activity.getSystemService(NotificationManager::class.java).createNotificationChannel(c)
            }
            val ouvrir = activity.packageManager.getLaunchIntentForPackage(activity.packageName)
            val notif = NotificationCompat.Builder(activity, canal)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle(activity.getString(R.string.repos))
                .setWhen(fin)
                .setShowWhen(true)
                .setUsesChronometer(true)
                .setChronometerCountDown(true)
                .setTimeoutAfter(duree)
                .setOngoing(true)
                .setSilent(true)
                .setOnlyAlertOnce(true)
                .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setContentIntent(PendingIntent.getActivity(activity, 0, ouvrir, PendingIntent.FLAG_IMMUTABLE))
                .build()
            // Permission de notification demandée par minuteur.ts avant d'arriver ici.
            NotificationManagerCompat.from(activity).notify(id, notif)
            invoke.resolve()
        } catch (ex: SecurityException) {
            invoke.reject("Notification de repos refusée : ${ex.message}")
        } catch (ex: Exception) {
            invoke.reject(ex.message)
        }
    }

    @Command
    fun retirer(invoke: Invoke) {
        NotificationManagerCompat.from(activity).cancel(id)
        invoke.resolve()
    }
}
