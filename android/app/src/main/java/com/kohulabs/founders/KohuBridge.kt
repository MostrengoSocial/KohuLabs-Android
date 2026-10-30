package com.kohulabs.founders

import android.content.Intent
import android.provider.AlarmClock
import android.webkit.JavascriptInterface
import com.kohulabs.founders.data.FoundersDatabase
import com.kohulabs.founders.data.FoundersStore
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
