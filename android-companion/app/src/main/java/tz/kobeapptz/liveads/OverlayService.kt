package tz.kobeapptz.liveads

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.MediaController
import android.widget.TextView
import android.widget.VideoView
import java.util.concurrent.Executors

/**
 * Draws the Sponsored overlay over whatever the creator is playing, so TikTok's
 * screen-share captures it. Non-interactive (touches pass through to the game);
 * viewers act via the QR or the creator's bio link, never on this screen.
 */
class OverlayService : Service() {

    private val ui = Handler(Looper.getMainLooper())
    private val net = Executors.newSingleThreadExecutor()
    private lateinit var wm: WindowManager
    private lateinit var client: LiveAdsClient
    private lateinit var liveBase: String

    private var root: FrameLayout? = null
    private var takeover: LinearLayout? = null
    private var video: VideoView? = null
    private var card: LinearLayout? = null
    private var sponsorTv: TextView? = null
    private var offerTv: TextView? = null
    private var couponTv: TextView? = null
    private var qrIv: ImageView? = null
    private var takeoverSponsor: TextView? = null

    private var lastImpressed: String? = null
    private var lastHeartbeat = 0L
    private var running = true

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val prefs = getSharedPreferences("kobe_live", Context.MODE_PRIVATE)
        liveBase = prefs.getString("liveBase", "https://kobe.live") ?: "https://kobe.live"
        wm = getSystemService(WINDOW_SERVICE) as WindowManager
        startForeground(1, buildNotification())
        buildOverlay()

        if (intent?.getBooleanExtra("test", false) == true) {
            // Preview a sample sponsored overlay, then stop.
            val sample = Slot("test", "AD000000", "Coca-Cola", "Special LIVE offer", "MARIAM20", "FULLSCREEN", null,
                System.currentTimeMillis() + 6000, System.currentTimeMillis() + 8000)
            render(OverlayState("preview", true, sample))
            ui.postDelayed({ stopSelf() }, 8000)
            return START_NOT_STICKY
        }

        val base = prefs.getString("baseUrl", "") ?: ""
        val token = prefs.getString("token", "") ?: ""
        if (base.isEmpty() || token.isEmpty()) { stopSelf(); return START_NOT_STICKY }
        client = LiveAdsClient(base, token)
        loop()
        return START_STICKY
    }

    // ── Overlay views (built in code so we can restyle per format) ─────────────

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    private fun rounded(color: Int): GradientDrawable =
        GradientDrawable().apply { setColor(color); cornerRadius = dp(18).toFloat() }

    private fun buildOverlay() {
        val ctx = this
        root = FrameLayout(ctx)

        // Full-screen takeover (shown briefly during the playback window).
        takeover = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#D9000000"))
            visibility = View.GONE
            addView(TextView(ctx).apply { text = "⚡ SPONSORED"; setTextColor(Color.parseColor("#FFD166")); textSize = 14f; letterSpacing = 0.3f })
            takeoverSponsor = TextView(ctx).apply { setTextColor(Color.WHITE); textSize = 40f; setTypeface(typeface, android.graphics.Typeface.BOLD) }
            addView(takeoverSponsor)
        }
        root!!.addView(takeover, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

        // Video creative (VIDEO format).
        video = VideoView(ctx).apply { visibility = View.GONE }
        root!!.addView(video, FrameLayout.LayoutParams(dp(280), dp(160), Gravity.CENTER))

        // Persistent bottom card (QR + sponsor + coupon), through the CTA window.
        card = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            background = rounded(Color.parseColor("#E6000000"))
            setPadding(dp(12), dp(10), dp(12), dp(10))
            visibility = View.GONE
        }
        qrIv = ImageView(ctx)
        card!!.addView(qrIv, LinearLayout.LayoutParams(dp(72), dp(72)).apply { rightMargin = dp(12) })
        val col = LinearLayout(ctx).apply { orientation = LinearLayout.VERTICAL }
        col.addView(TextView(ctx).apply { text = "⚡ SPONSORED"; setTextColor(Color.parseColor("#FFD166")); textSize = 10f })
        sponsorTv = TextView(ctx).apply { setTextColor(Color.WHITE); textSize = 18f; setTypeface(typeface, android.graphics.Typeface.BOLD) }
        offerTv = TextView(ctx).apply { setTextColor(Color.parseColor("#CCFFFFFF")); textSize = 12f }
        couponTv = TextView(ctx).apply { setTextColor(Color.parseColor("#FFD166")); textSize = 12f; setTypeface(typeface, android.graphics.Typeface.BOLD) }
        col.addView(sponsorTv); col.addView(offerTv); col.addView(couponTv)
        col.addView(TextView(ctx).apply { text = "Scan QR  ·  or tap the link in my bio ↑"; setTextColor(Color.parseColor("#99FFFFFF")); textSize = 11f })
        card!!.addView(col)
        root!!.addView(card, FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL).apply { bottomMargin = dp(48) })

        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY else @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE
        val lp = WindowManager.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT, type,
            // Non-interactive: don't steal focus or touches from the game underneath.
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT,
        )
        wm.addView(root, lp)
    }

    // ── Poll / render loop ─────────────────────────────────────────────────────

    private fun loop() {
        if (!running) return
        net.execute {
            val nowT = System.currentTimeMillis()
            if (nowT - lastHeartbeat > 30_000) { client.heartbeat(); lastHeartbeat = nowT }
            val state = client.state()
            ui.post { render(state) }
        }
        ui.postDelayed({ loop() }, 4000)
    }

    private fun render(state: OverlayState?) {
        val slot = state?.slot
        if (slot == null) { card?.visibility = View.GONE; takeover?.visibility = View.GONE; stopVideo(); return }
        val now = System.currentTimeMillis()
        val playing = slot.playbackEndMs > now

        // Proof-of-play: once per slot, while its creative is on screen (skipped
        // in preview mode where there is no client).
        if (playing && lastImpressed != slot.slotId && this::client.isInitialized) {
            lastImpressed = slot.slotId
            net.execute { client.impression(slot.slotId) }
        }

        // Persistent bottom card (whole CTA window).
        sponsorTv?.text = slot.sponsor
        offerTv?.text = slot.offerText
        offerTv?.visibility = if (slot.offerText.isEmpty()) View.GONE else View.VISIBLE
        couponTv?.text = slot.couponCode?.let { "Code $it" } ?: ""
        couponTv?.visibility = if (slot.couponCode == null) View.GONE else View.VISIBLE
        runCatching { qrIv?.setImageBitmap(Qr.bitmap("$liveBase/a/${slot.code}")) }
        card?.visibility = View.VISIBLE

        // Playback-window creative by format.
        val fmt = slot.creativeFormat
        if (playing && fmt == "VIDEO" && slot.creativeVideoUrl != null) {
            takeover?.visibility = View.GONE
            playVideo(slot.creativeVideoUrl)
        } else if (playing && (fmt == "FULLSCREEN" || fmt == "BANNER" || fmt == "CARD")) {
            stopVideo()
            takeoverSponsor?.text = slot.sponsor
            takeover?.visibility = View.VISIBLE
        } else {
            takeover?.visibility = View.GONE
            stopVideo()
        }
    }

    private fun playVideo(url: String) {
        val v = video ?: return
        if (v.visibility != View.VISIBLE) {
            v.visibility = View.VISIBLE
            v.setVideoURI(android.net.Uri.parse(url))
            v.setOnPreparedListener { mp -> mp.setVolume(0f, 0f); mp.isLooping = false; v.start() }
            v.setMediaController(null as MediaController?)
        }
    }
    private fun stopVideo() { video?.let { if (it.visibility == View.VISIBLE) { it.stopPlayback(); it.visibility = View.GONE } } }

    // ── Foreground notification ────────────────────────────────────────────────

    private fun buildNotification(): Notification {
        val chId = "kobe_live_ads"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(NotificationChannel(chId, "Kobe Live Ads", NotificationManager.IMPORTANCE_LOW))
        }
        val b = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, chId) else @Suppress("DEPRECATION") Notification.Builder(this)
        return b.setContentTitle("Kobe Live Ads is running")
            .setContentText("Delivering sponsored overlays to your live stream")
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setOngoing(true)
            .build()
    }

    override fun onDestroy() {
        running = false
        if (this::client.isInitialized) net.execute { runCatching { client.end() } }
        runCatching { root?.let { wm.removeView(it) } }
        super.onDestroy()
    }
}
