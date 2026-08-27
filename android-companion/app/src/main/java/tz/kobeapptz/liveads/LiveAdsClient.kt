package tz.kobeapptz.liveads

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** Current sponsor slot the overlay should render (mirrors the backend state). */
data class Slot(
    val slotId: String,
    val code: String,
    val sponsor: String,
    val offerText: String,
    val couponCode: String?,
    val creativeFormat: String,     // CARD | BANNER | FULLSCREEN | VIDEO
    val creativeVideoUrl: String?,
    val playbackEndMs: Long,
    val ctaEndMs: Long,
)

data class OverlayState(val handle: String, val live: Boolean, val slot: Slot?)

/**
 * Thin client for the public, token-scoped Kobe Live Ads overlay endpoints.
 * The overlay token is the only credential; no login, no secrets compiled in.
 * All calls are blocking — run them off the main thread.
 */
class LiveAdsClient(private val baseUrl: String, private val token: String) {

    private fun url(path: String) = "${baseUrl.trimEnd('/')}/api/live/overlay/$token$path"

    private fun open(method: String, path: String, body: String? = null): HttpURLConnection {
        val c = URL(url(path)).openConnection() as HttpURLConnection
        c.requestMethod = method
        c.connectTimeout = 8000
        c.readTimeout = 8000
        if (body != null) {
            c.doOutput = true
            c.setRequestProperty("Content-Type", "application/json")
            c.outputStream.use { it.write(body.toByteArray()) }
        }
        return c
    }

    fun heartbeat(): Boolean = post("/heartbeat")
    fun end(): Boolean = post("/end")
    fun impression(slotId: String): Boolean =
        post("/impression", JSONObject().put("slotId", slotId).toString())

    private fun post(path: String, body: String = "{}"): Boolean = try {
        val c = open("POST", path, body); val ok = c.responseCode in 200..299; c.disconnect(); ok
    } catch (_: Exception) { false }

    fun state(): OverlayState? = try {
        val c = open("GET", "/state")
        if (c.responseCode !in 200..299) { c.disconnect(); null }
        else {
            val json = JSONObject(c.inputStream.bufferedReader().readText()); c.disconnect()
            val s = json.optJSONObject("slot")
            val slot = if (s == null || s === JSONObject.NULL) null else Slot(
                slotId = s.getString("slotId"),
                code = s.getString("code"),
                sponsor = s.getString("sponsor"),
                offerText = s.optString("offerText", ""),
                couponCode = s.optString("couponCode", "").ifEmpty { null },
                creativeFormat = s.optString("creativeFormat", "CARD"),
                creativeVideoUrl = s.optString("creativeVideoUrl", "").ifEmpty { null },
                playbackEndMs = parseIso(s.optString("playbackEnd")),
                ctaEndMs = parseIso(s.optString("ctaEnd")),
            )
            OverlayState(json.optString("handle", ""), json.optBoolean("live", false), slot)
        }
    } catch (_: Exception) { null }

    private fun parseIso(v: String?): Long = try {
        if (v.isNullOrEmpty()) 0L else java.time.Instant.parse(v).toEpochMilli()
    } catch (_: Exception) { 0L }
}
