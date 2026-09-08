import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const androidDir = join(root, "android");
const gradle = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
const outputApk = join(root, "android/app/build/outputs/apk/debug/app-debug.apk");

const jdkCandidates = [
	join(homedir(), ".jdks/jbr-21.0.11"),
	process.env.JAVA_HOME,
	"C:\\Program Files\\Android\\Android Studio\\jbr",
].filter((value) => Boolean(value));

const javaHome = jdkCandidates.find((dir) => existsSync(join(dir, "bin", process.platform === "win32" ? "java.exe" : "java")));
if (javaHome) process.env.JAVA_HOME = javaHome;

const gradleResult = spawnSync(gradle, ["assembleDebug"], {
	cwd: androidDir,
	env: process.env,
	stdio: "inherit",
	shell: true,
});

if (gradleResult.status !== 0) {
	throw new Error("assembleDebug failed. Install JDK 21 (Android Studio Gradle JDK) and retry.");
}

if (!existsSync(outputApk)) {
	throw new Error(`Signed APK missing at ${outputApk}`);
}

const destDir = join(root, "public");
mkdirSync(destDir, { recursive: true });
const dest = join(destDir, "kaffey.apk");
copyFileSync(outputApk, dest);
console.log(`Copied signed APK -> ${dest}`);
