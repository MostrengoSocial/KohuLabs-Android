package com.kohulabs.android

import android.annotation.SuppressLint
import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.util.Log
import androidx.core.content.edit
import com.kohulabs.android.data.FoundersDatabase
import com.kohulabs.android.data.Sync
import com.kohulabs.android.data.SyncApi
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.KeyStore
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * The app's link to the cloud (the kohulabs-android Worker at [BuildConfig.API_BASE], api/): who is signed in, and
 * when to sync. Syncs run one at a time on a background thread: when the app opens or goes to the background,
 * and a few seconds after each change.
 */
class Cloud private constructor(context: Context) {
    private val app = context.applicationContext
    val account = Account(app)
    val api = Api(BuildConfig.API_BASE) { account.token() }
    private val prefs = app.getSharedPreferences("cloud", Context.MODE_PRIVATE)
    private val sync by lazy { Sync(FoundersDatabase.get(app), { api.post("/api/sync", it) }, prefs) }
    private val worker = Executors.newSingleThreadScheduledExecutor()
    private var soon: ScheduledFuture<*>? = null

    /** Syncs now, if signed in. [done] gets the result (null when it did not run or failed), on the sync thread. */
    fun syncNow(done: (Sync.Result?) -> Unit = {}) {
        if (account.token() == null) return done(null)
        worker.execute {
            val result = try {
                sync.run()
            } catch (e: Api.HttpError) {
                if (e.code == 401) account.clear() // signed out or removed from the list: stop until signed in again
                Log.w(TAG, "sync refused: ${e.code} ${e.message}"); null
            } catch (e: Exception) {
                Log.w(TAG, "sync failed, will retry", e); null
            }
            done(result)
        }
    }

    /** Syncs a few seconds from now; more changes meanwhile push it back, so a burst of taps is one sync. */
    @Synchronized fun syncSoon() {
        soon?.cancel(false)
        soon = worker.schedule({ syncNow() }, 8, TimeUnit.SECONDS)
    }

    /**
     * Pull to refresh: the cloud imports Calendar and Gmail now (POST /api/refresh), then a sync brings it down.
     * [done] gets {ok, pulled, meetings?, emails?, error?} on the sync thread.
     */
    fun refresh(done: (JSONObject) -> Unit) {
        if (account.token() == null) return done(JSONObject().put("ok", false).put("error", "signed_out").put("pulled", 0))
        worker.execute {
            val out = try { api.post("/api/refresh", JSONObject()) } catch (e: Exception) { JSONObject().put("ok", false).put("error", (e as? Api.HttpError)?.message ?: "offline") }
            val pulled = try { sync.run().pulled } catch (e: Exception) { out.put("ok", false).put("error", out.optString("error").ifEmpty { "offline" }); 0 }
            done(out.put("pulled", pulled))
        }
    }

    /** Syncs once, [seconds] from now (after sign-in: by then the cloud has imported Calendar and Gmail). */
    fun syncAfter(seconds: Long, done: (Sync.Result?) -> Unit) {
        worker.schedule({ syncNow(done) }, seconds, TimeUnit.SECONDS)
    }

    fun signOut() {
        account.clear()
        worker.execute { sync.reset() }
    }

    companion object {
        private const val TAG = "KohuCloud"
        // Holds the application context only, which lives as long as the app.
        @SuppressLint("StaticFieldLeak") @Volatile private var instance: Cloud? = null
        fun get(context: Context): Cloud = instance ?: synchronized(this) { instance ?: Cloud(context).also { instance = it } }

        /** PKCE (RFC 7636): a random verifier, and its SHA-256 as the challenge, both base64url without padding. */
        fun pkce(): Pair<String, String> {
            val verifier = b64(ByteArray(32).also { SecureRandom().nextBytes(it) })
            return verifier to b64(MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray()))
        }

        private fun b64(bytes: ByteArray) = Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    }
}

/** JSON over HTTPS to the Worker. */
class Api(private val base: String, private val token: () -> String?) {
    class HttpError(val code: Int, val body: JSONObject) : IOException(body.optString("error", "http_$code"))

    fun get(path: String): JSONObject = call("GET", path, null)
    fun post(path: String, body: JSONObject): JSONObject = call("POST", path, body)

    private fun call(method: String, path: String, body: JSONObject?): JSONObject {
        val c = URL(base + path).openConnection() as HttpURLConnection
        try {
            c.requestMethod = method
            c.connectTimeout = 15_000
            c.readTimeout = 30_000
            c.setRequestProperty("Accept", "application/json")
            token()?.let { c.setRequestProperty("Authorization", "Bearer $it") }
            if (body != null) {
                c.doOutput = true
                c.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                c.outputStream.use { it.write(body.toString().toByteArray()) }
            }
            val code = c.responseCode
            val text = (if (code < 400) c.inputStream else c.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
            val json = runCatching { JSONObject(text) }.getOrElse { JSONObject() }
            if (code !in 200..299) throw HttpError(code, json)
            return json
        } finally {
            c.disconnect()
        }
    }
}

/**
 * Who is signed in: the app token from the Worker (POST /api/token), with the email and name. The token is
 * encrypted with a key that never leaves the Android Keystore; the rest is kept as is.
 */
class Account(context: Context) {
    private val prefs = context.getSharedPreferences("account", Context.MODE_PRIVATE)

    fun token(): String? {
        val sealed = prefs.getString(TOKEN, null) ?: return null
        if (prefs.getLong(EXPIRES, 0) * 1000 < System.currentTimeMillis()) return null
        return runCatching { open(sealed) }.getOrNull()
    }
    fun email(): String? = prefs.getString(EMAIL, null)?.takeIf { token() != null }
    fun name(): String? = prefs.getString(NAME, null)?.takeIf { token() != null }

    fun save(token: String, email: String, name: String, expiresAt: Long) {
        prefs.edit { putString(TOKEN, seal(token)).putString(EMAIL, email).putString(NAME, name).putLong(EXPIRES, expiresAt) }
    }
    fun clear() = prefs.edit { clear() }

    /** The PKCE verifier of a sign-in in progress (while the browser tab is open). */
    var pendingVerifier: String?
        get() = prefs.getString(VERIFIER, null)
        set(v) { prefs.edit { putString(VERIFIER, v) } }

    private fun key(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getEntry(ALIAS, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    private fun seal(plain: String): String {
        val c = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
        return Base64.encodeToString(c.iv, Base64.NO_WRAP) + ":" + Base64.encodeToString(c.doFinal(plain.toByteArray()), Base64.NO_WRAP)
    }
    private fun open(sealed: String): String {
        val (iv, data) = sealed.split(":").map { Base64.decode(it, Base64.NO_WRAP) }
        val c = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv)) }
        return String(c.doFinal(data))
    }

    private companion object {
        const val ALIAS = "kohulabs-android-token"
        const val TOKEN = "token"; const val EMAIL = "email"; const val NAME = "name"; const val EXPIRES = "expiresAt"; const val VERIFIER = "verifier"
    }
}
