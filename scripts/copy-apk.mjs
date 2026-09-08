import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const candidates = [
	join(root, "android/app/build/outputs/apk/debug/app-debug.apk"),
	join(root, "android/app/build/intermediates/apk/debug/app-debug.apk"),
];
const source = candidates.find((file) => existsSync(file));

if (!source) {
	throw new Error("No debug APK found. Run `npx cap run android` first, then `npm run cap:apk`.");
}

const destDir = join(root, "public");
mkdirSync(destDir, { recursive: true });
const dest = join(destDir, "kaffey.apk");
copyFileSync(source, dest);
console.log(`Copied ${source} -> ${dest}`);
