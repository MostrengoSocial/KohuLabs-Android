package com.kohulabs.android

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.widget.FrameLayout
import android.widget.Toast
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.net.toUri
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import org.json.JSONObject
import java.util.concurrent.Executors

/**
 * Kohu Founders: Kō runs the day, you do the chunks.
 *
 * The screens are the app's web code (web/founders/, copied into the APK's assets at build time), served
 * from the APK over https://appassets.androidplatform.net so they work offline. The phone side is here:
 * system bars and the keyboard, the back button, [KohuBridge] for what only the phone can do, and the cloud
 * ([Cloud]): Google sign-in in a browser tab, and syncing when the app opens and goes to the background.
 */
class MainActivity : ComponentActivity() {

    private lateinit var web: WebView
    private val cloud by lazy { Cloud.get(this) }
    private val background = Executors.newSingleThreadExecutor()

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(SystemBarStyle.dark(Color.TRANSPARENT), SystemBarStyle.dark(Color.TRANSPARENT))
        super.onCreate(savedInstanceState)
        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true)

        val assets = WebViewAssetLoader.Builder()
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        web = WebView(this).apply {
            setBackgroundColor(getColor(R.color.kohu_bg))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true // the language and the sign-in flag
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            webViewClient = object : WebViewClientCompat() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    assets.shouldInterceptRequest(request.url)

                // Only the bundled app opens in here; any other link goes to the browser.
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    if (request.url.host == HOST) return false
                    runCatching { startActivity(Intent(Intent.ACTION_VIEW, request.url)) }
                    return true
                }
            }
            addJavascriptInterface(KohuBridge(this@MainActivity), "KohuAndroid")
        }

        // Edge to edge: keep the app clear of the status bar, the navigation bar, cutouts and the keyboard.
        val root = FrameLayout(this).apply { setBackgroundColor(getColor(R.color.kohu_bg)); addView(web) }
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime()
            )
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }
        setContentView(root)

        // Back steps back through the app's screens (founders.js decides); on Kō's home it leaves the app.
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                web.evaluateJavascript("window.kohuFounders && window.kohuFounders.back ? window.kohuFounders.back() : false") { handled ->
                    if (handled != "true") {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                        isEnabled = true
                    }
                }
            }
        })

        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) web.loadUrl(START)
        handleSignIn(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleSignIn(intent)
    }

    // Open: bring down what changed in the cloud (and show it). Background: send up what changed here.
    override fun onStart() {
        super.onStart()
        cloud.syncNow { r -> if (r != null && r.pulled > 0) runOnUiThread { web.reload() } }
    }

    override fun onStop() {
        cloud.syncNow()
        super.onStop()
    }

    /**
     * Google sign-in, for the cloud copy: a browser tab on the Worker's /auth/google (the app's PKCE challenge
     * goes with it), which ends at com.kohulabs.android:/signed-in?code=… ([handleSignIn]). When the cloud is not
     * set up yet, or unreachable, the app carries on, on this phone only.
     */
    fun startSignIn() = background.execute {
        // Is Google sign-in set up on the Worker yet?
        val configured = runCatching { cloud.api.get("/api/status").optBoolean("configured") }.getOrDefault(false)
        if (!configured) return@execute signedIn(null, R.string.cloud_unavailable)
        val (verifier, challenge) = Cloud.pkce()
        cloud.account.pendingVerifier = verifier
        val url = (BuildConfig.API_BASE + "/auth/google").toUri().buildUpon().appendQueryParameter("challenge", challenge).build()
        runOnUiThread { runCatching { CustomTabsIntent.Builder().build().launchUrl(this, url) }.onFailure { startActivity(Intent(Intent.ACTION_VIEW, url)) } }
    }

    private fun handleSignIn(intent: Intent?) {
        val data = intent?.data ?: return
        if (data.scheme != "com.kohulabs.android") return
        setIntent(Intent(intent).setData(null))
        val code = data.getQueryParameter("code")
        val verifier = cloud.account.pendingVerifier
        if (code == null || verifier == null) {
            val notInvited = data.getQueryParameter("error") == "not_invited"
            return signedIn(null, if (notInvited) R.string.cloud_not_invited else R.string.cloud_sign_in_failed, stay = true)
        }
        background.execute {
            try {
                val r = cloud.api.post("/api/token", JSONObject().put("code", code).put("verifier", verifier))
                cloud.account.save(r.getString("token"), r.getString("email"), r.optString("name", r.getString("email")), r.getLong("expiresAt"))
                cloud.account.pendingVerifier = null
                signedIn(JSONObject().put("email", r.getString("email")).put("name", r.optString("name")), null)
                cloud.syncNow { res -> if (res != null && res.pulled > 0) runOnUiThread { web.reload() } }
            } catch (e: Exception) {
                signedIn(null, if (e is Api.HttpError && e.code == 403) R.string.cloud_not_invited else R.string.cloud_sign_in_failed, stay = true)
            }
        }
    }

    /** Tells the screens how sign-in went: an account, or null to carry on without the cloud (or [stay] on sign-in). */
    private fun signedIn(account: JSONObject?, message: Int?, stay: Boolean = false) = runOnUiThread {
        message?.let { Toast.makeText(this, it, Toast.LENGTH_LONG).show() }
        if (!stay) web.evaluateJavascript("window.kohuFounders && window.kohuFounders.cloudSignedIn && window.kohuFounders.cloudSignedIn(${account ?: "null"})", null)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onDestroy() {
        web.destroy()
        super.onDestroy()
    }

    companion object {
        const val HOST = "appassets.androidplatform.net"
        const val START = "https://$HOST/web/founders/index.html"
    }
}
