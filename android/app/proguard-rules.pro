# The JavaScript bridge is called by name from founders.js.
-keepclassmembers class com.kohulabs.android.KohuBridge {
    @android.webkit.JavascriptInterface <methods>;
}
