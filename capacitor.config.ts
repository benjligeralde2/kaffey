import os from "node:os";
import type { CapacitorConfig } from "@capacitor/cli";

const PRODUCTION_URL = "https://kaffey.vercel.app";

function lanIPv4() {
	for (const addresses of Object.values(os.networkInterfaces())) {
		for (const net of addresses ?? []) {
			const ipv4 = net.family === "IPv4";
			if (ipv4 && !net.internal) return net.address;
		}
	}
	return "127.0.0.1";
}

function navigationHosts(serverUrl: string) {
	const hosts = new Set<string>(["kaffey.vercel.app", "*.supabase.co"]);
	try {
		hosts.add(new URL(serverUrl).hostname);
	} catch {
		/* ignore invalid CAPACITOR_SERVER_URL */
	}
	for (const host of (process.env.CAPACITOR_ALLOW_NAVIGATION ?? "").split(",")) {
		const trimmed = host.trim();
		if (trimmed) hosts.add(trimmed);
	}
	return [...hosts];
}

const port = process.env.PORT ?? "3000";
const serverUrl =
	process.env.CAPACITOR_SERVER_URL ??
	(process.env.CAPACITOR_USE_LAN === "1" ? `http://${lanIPv4()}:${port}` : PRODUCTION_URL);
const usingCleartext = serverUrl.startsWith("http://");

const config: CapacitorConfig = {
	appId: "com.kaffey.pos",
	appName: "Kaffey",
	webDir: "capacitor/www",
	backgroundColor: "#f5efe7",
	android: {
		allowMixedContent: usingCleartext,
	},
	server: {
		url: serverUrl,
		cleartext: usingCleartext,
		androidScheme: "https",
		allowNavigation: navigationHosts(serverUrl),
		appStartPath: "/",
		errorPath: "offline.html",
	},
	plugins: {
		App: {
			disableBackButtonHandler: true,
		},
		Keyboard: {
			resizeOnFullScreen: true,
		},
	},
};

export default config;
