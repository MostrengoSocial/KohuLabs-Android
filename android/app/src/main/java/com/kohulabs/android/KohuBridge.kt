package com.kohulabs.android

import android.content.Intent
import android.provider.AlarmClock
import android.webkit.JavascriptInterface
import com.kohulabs.android.data.FoundersDatabase
import com.kohulabs.android.data.FoundersStore
import org.json.JSONArray
import org.json.JSONObject

/**
 * What the web code can ask of the phone, as `window.KohuAndroid` in founders.js. Only the bundled app
 * is ever loaded in the WebView (MainActivity sends every other link to the browser).
 * These run on the WebView's own background thread, so the database calls can be synchronous.
 */
class KohuBridge(private val activity: MainActivity) {

    private val store by lazy { FoundersStore(FoundersDatabase.get(activity)) }
    private val cloud get() = Cloud.get(activity)

    /** Lets founders.js know it is running in the Android app. */
    @JavascriptInterface
    fun platform(): String = "android"

    /** The day from the phone's database, as JSON (see FoundersStore.today). */
    @JavascriptInterface
    fun today(date: String, lang: String): String = store.today(date, lang).toString()

    /** This week's chunks done and focus minutes per day, as JSON (see FoundersStore.week). */
    @JavascriptInterface
    fun week(date: String): String = store.week(date).toString()

    /** Saves a JSON list of changes (see FoundersStore.apply); returns the ids the store gave new rows. */
    @JavascriptInterface
    fun apply(ops: String): String = store.apply(JSONArray(ops)).toString().also { cloud.syncSoon() }

    /** Who is signed in to the cloud ({email, name}), or null. */
    @JavascriptInterface
    fun account(): String = cloud.account.email()?.let { JSONObject().put("email", it).put("name", cloud.account.name()).toString() } ?: "null"

    /** Starts Google sign-in in a browser tab; the app hears back in MainActivity (kohuFounders.cloudSignedIn). */
    @JavascriptInterface
    fun signIn() = activity.startSignIn()

    @JavascriptInterface
    fun signOut() = cloud.signOut()

    /** Pull to refresh: Calendar and Gmail now, then a sync; the page hears back in kohuFounders.refreshed(result). */
    @JavascriptInterface
    fun refresh() = cloud.refresh { res -> activity.toPage("refreshed", res.toString()) }

    /** The Gmail accounts added to the import; the page hears back in kohuFounders.links({links}). */
    @JavascriptInterface
    fun loadLinks() = cloud.links { activity.toPage("links", it.toString()) }

    /** Adds another Gmail (personal) in a browser tab; the page hears back in kohuFounders.linked({email} | {error}). */
    @JavascriptInterface
    fun linkGmail() = activity.startLink()

    @JavascriptInterface
    fun unlink(email: String) = cloud.unlink(email) { activity.toPage("links", it.toString()) }

    /** Whether the phone can turn speech into text (Google's speech recognition, or another app that offers it). */
    @JavascriptInterface
    fun canListen(): Boolean = activity.canListen()

    /** Listens once in [lang] (en | pt); the page hears back in kohuFounders.heard(text), "" when nothing was said. */
    @JavascriptInterface
    fun listen(lang: String) = activity.listen(lang)

    /** Sets an alarm in the phone's clock app, without opening it. False when there is no clock app. */
    @JavascriptInterface
    fun setAlarm(hour: Int, minutes: Int, label: String): Boolean {
        val intent = Intent(AlarmClock.ACTION_SET_ALARM)
            .putExtra(AlarmClock.EXTRA_HOUR, hour)
            .putExtra(AlarmClock.EXTRA_MINUTES, minutes)
            .putExtra(AlarmClock.EXTRA_MESSAGE, label)
            .putExtra(AlarmClock.EXTRA_SKIP_UI, true)
        if (intent.resolveActivity(activity.packageManager) == null) return false
        activity.runOnUiThread { runCatching { activity.startActivity(intent) } }
        return true
    }
}
