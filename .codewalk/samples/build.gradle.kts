// 驗證 CodeWalk 語法高亮用的示範檔案——不參與建置。
// 這個檔名同時有 .gradle 與 .kts,取最後一段副檔名才會落到 kotlin 而不是 groovy。

plugins {
    kotlin("jvm") version "2.0.0"
}

group = "com.example.codewalk"
version = "0.1.0"

repositories {
    mavenCentral()
}

dependencies {
    implementation(kotlin("stdlib"))
    testImplementation(kotlin("test"))
}

val buildStamp: String by lazy {
    "${project.name}-$version"
}

tasks.register("printStamp") {
    doLast {
        println(
            """
            build : $buildStamp
            group : ${project.group}
            """.trimIndent(),
        )
    }
}
