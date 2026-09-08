import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fullSvg = readFileSync(join(root, "public/kaffey-icon.svg"), "utf8");
const foregroundSvg = fullSvg.replace(
	'<rect width="1024" height="1024" fill="#f5efe7"/>',
	'<rect width="1024" height="1024" fill="none"/>',
);

const launcherSizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const foregroundSizes = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

for (const [density, size] of Object.entries(launcherSizes)) {
	const dir = join(root, `android/app/src/main/res/mipmap-${density}`);
	mkdirSync(dir, { recursive: true });
	const bytes = new Resvg(fullSvg, { fitTo: { mode: "width", value: size } }).render().asPng();
	writeFileSync(join(dir, "ic_launcher.png"), bytes);
	writeFileSync(join(dir, "ic_launcher_round.png"), bytes);
}

for (const [density, size] of Object.entries(foregroundSizes)) {
	const dir = join(root, `android/app/src/main/res/mipmap-${density}`);
	mkdirSync(dir, { recursive: true });
	const bytes = new Resvg(foregroundSvg, { fitTo: { mode: "width", value: size } }).render().asPng();
	writeFileSync(join(dir, "ic_launcher_foreground.png"), bytes);
}

console.log("Wrote Kaffey launcher mipmaps");
