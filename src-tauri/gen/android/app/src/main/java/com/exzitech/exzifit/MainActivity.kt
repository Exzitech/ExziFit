package com.exzitech.exzifit

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.os.Bundle
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    creerCanalRepos()
  }

  /**
   * Canal de fin de repos (minuteur.ts) : le plugin de notification ne sait qu'activer la vibration
   * par défaut, trop courte pour une poche à la salle. Le motif d'un canal est figé à sa création :
   * pour le changer, changer aussi l'identifiant (ici et dans minuteur.ts).
   */
  private fun creerCanalRepos() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val canal = NotificationChannel("repos-long", getString(R.string.canal_fin_repos), NotificationManager.IMPORTANCE_HIGH)
    canal.enableVibration(true)
    // Trois impulsions d'une seconde (≈ 3,8 s en tout).
    canal.vibrationPattern = longArrayOf(0, 1000, 400, 1000, 400, 1000)
    val gestion = getSystemService(NotificationManager::class.java)
    gestion.createNotificationChannel(canal)
    gestion.deleteNotificationChannel("repos") // canal à vibration courte, jusqu'à la 0.1.20
  }
}
