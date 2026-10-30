# The JavaScript bridge is called by name from founders.js.
-keepclassmembers class com.kohulabs.founders.KohuBridge {
    @android.webkit.JavascriptInterface <methods>;
}
