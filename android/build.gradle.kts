plugins {
    id("com.android.application") version "8.11.1" apply false
    id("org.jetbrains.kotlin.android") version "2.2.0" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.2.0" apply false
}

if (System.getProperty("os.name").startsWith("Windows")) {
    val lumeBuildRoot = file(System.getProperty("java.io.tmpdir")).resolve("lume-native-build")
    layout.buildDirectory.set(lumeBuildRoot.resolve("root"))
    subprojects {
        layout.buildDirectory.set(lumeBuildRoot.resolve(name))
    }
}
