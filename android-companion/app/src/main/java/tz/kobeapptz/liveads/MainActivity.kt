package tz.kobeapptz.liveads

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

/**
 * Pairing + Go-Live. The creator pastes the server URL and their overlay token
 * (copied from the Kobe web app → Creator → Live Ads), grants "draw over other
 * apps", then taps Go Live when they start streaming.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var baseUrl: EditText
    private lateinit var token: EditText
    private lateinit var liveBase: EditText

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val prefs = getSharedPreferences("kobe_live", Context.MODE_PRIVATE)

        fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(28), dp(20), dp(20))
        }
        root.addView(TextView(this).apply { text = "Kobe Live Ads"; textSize = 24f; setTypeface(typeface, android.graphics.Typeface.BOLD) })
        root.addView(TextView(this).apply { text = "Paste your server and overlay token from the Kobe web app (Creator → Live Ads)."; textSize = 13f; setPadding(0, dp(4), 0, dp(16)) })

        baseUrl = EditText(this).apply { hint = "https://api.kobeapptz.com"; setText(prefs.getString("baseUrl", "https://api.kobeapptz.com")) }
        token = EditText(this).apply { hint = "Overlay token"; setText(prefs.getString("token", "")) }
        liveBase = EditText(this).apply { hint = "https://kobe.live"; setText(prefs.getString("liveBase", "https://kobe.live")) }
        root.addView(label("Server URL")); root.addView(baseUrl)
        root.addView(label("Overlay token")); root.addView(token)
        root.addView(label("QR link base (kobe.live)")); root.addView(liveBase)

        root.addView(Button(this).apply {
            text = "Grant \"draw over other apps\""
            setOnClickListener { requestOverlayPermission() }
        })

        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER; setPadding(0, dp(12), 0, 0) }
        row.addView(Button(this).apply {
            text = "Go LIVE"
            setOnClickListener { goLive() }
        }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        row.addView(Button(this).apply {
            text = "Stop"
            setOnClickListener { stopService(Intent(this@MainActivity, OverlayService::class.java)); toast("Stopped") }
        }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        root.addView(row)

        root.addView(TextView(this).apply { text = "Overlays are always badged “Sponsored”. Never a spoof of a real app."; textSize = 11f; setPadding(0, dp(16), 0, 0) })
        setContentView(root)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 7)
        }
    }

    private fun label(t: String) = TextView(this).apply { text = t; textSize = 11f; setPadding(0, (8 * resources.displayMetrics.density).toInt(), 0, 0) }

    private fun requestOverlayPermission() {
        if (!Settings.canDrawOverlays(this)) {
            startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
        } else toast("Overlay permission already granted")
    }

    private fun goLive() {
        val b = baseUrl.text.toString().trim()
        val t = token.text.toString().trim()
        if (b.isEmpty() || t.isEmpty()) { toast("Enter server URL and overlay token"); return }
        if (!Settings.canDrawOverlays(this)) { requestOverlayPermission(); return }
        getSharedPreferences("kobe_live", Context.MODE_PRIVATE).edit()
            .putString("baseUrl", b).putString("token", t).putString("liveBase", liveBase.text.toString().trim().ifEmpty { "https://kobe.live" })
            .apply()
        val svc = Intent(this, OverlayService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(svc) else startService(svc)
        toast("You are LIVE — sponsored overlays will appear over your stream")
    }

    private fun toast(m: String) = Toast.makeText(this, m, Toast.LENGTH_SHORT).show()
}
