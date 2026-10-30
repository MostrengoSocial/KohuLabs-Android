import javax.inject.Inject

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.devtools.ksp")
}

android {
    namespace = "com.kohulabs.founders"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.kohulabs.founders"
        minSdk = 26
        targetSdk = 36
        versionCode = 2
        versionName = "0.2.0"
        // The Kohu Founders Worker, for sign-in and syncing (api/, wrangler.jsonc).
        buildConfigField("String", "API_BASE", "\"https://founders.kohulabs.com\"")
    }

    // Release builds are signed when the keystore is given in the environment (CI secrets); otherwise
    // assembleRelease gives an unsigned APK and assembleDebug a debug-signed one you can install.
    val keystore = System.getenv("KOHU_KEYSTORE")?.let(::file)?.takeIf { it.exists() }
    signingConfigs {
        if (keystore != null) create("release") {
            storeFile = keystore
            storePassword = System.getenv("KOHU_KEYSTORE_PASSWORD")
            keyAlias = System.getenv("KOHU_KEY_ALIAS")
            keyPassword = System.getenv("KOHU_KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (keystore != null) signingConfig = signingConfigs.getByName("release")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures { buildConfig = true }
    testOptions { unitTests.isIncludeAndroidResources = true }
}

// Room writes the database's structure here on every build (checked in; db/check-schema.mjs compares it with
// db/migrations/).
ksp { arg("room.schemaLocation", "$projectDir/schemas") }

kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }

dependencies {
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.activity:activity-ktx:1.11.0")
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.browser:browser:1.8.0")
    implementation("androidx.room:room-runtime:2.8.4")
    ksp("androidx.room:room-compiler:2.8.4")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.robolectric:robolectric:4.16.1")
    testImplementation("androidx.test:core:1.7.0")
}

// The app's screens (web/founders/), bundled so it works offline.
// This copies it, and the shared files it uses, into the APK's assets on every build.
abstract class CopySite @Inject constructor(private val fs: FileSystemOperations) : DefaultTask() {
    @get:InputFiles @get:PathSensitive(PathSensitivity.RELATIVE) abstract val files: ConfigurableFileCollection
    @get:Internal abstract val site: DirectoryProperty
    @get:OutputDirectory abstract val outputDir: DirectoryProperty

    @TaskAction
    fun copy() {
        fs.sync {
            from(site) { include(INCLUDE) }
            into(outputDir.dir("web"))
        }
    }

    companion object {
        val INCLUDE = listOf("founders/**", "js/signal.js", "assets/fonts/*.woff2", "assets/favicon/*.png", "favicon.ico")
    }
}

val siteDir = rootProject.layout.projectDirectory.dir("../web")
val copySite = tasks.register<CopySite>("copySite") {
    site.set(siteDir)
    files.from(siteDir.asFileTree.matching { include(CopySite.INCLUDE) })
}
androidComponents {
    onVariants { variant -> variant.sources.assets?.addGeneratedSourceDirectory(copySite, CopySite::outputDir) }
}
