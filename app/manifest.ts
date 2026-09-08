import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
	return {
		id: "/POS",
		name: "Kaffey POS",
		short_name: "Kaffey",
		description: "Counter, kitchen, and cafe tools for Kaffey — built for tablets.",
		start_url: "/POS/login",
		scope: "/",
		display: "standalone",
		display_override: ["standalone", "minimal-ui"],
		orientation: "landscape",
		background_color: "#f5efe7",
		theme_color: "#263234",
		lang: "en",
		categories: ["food", "business", "productivity"],
		prefer_related_applications: false,
		icons: [
			{ src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
			{ src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
			{ src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
		],
		shortcuts: [
			{ name: "Open POS", short_name: "POS", url: "/POS/login" },
			{ name: "Kitchen", short_name: "Kitchen", url: "/POS/kitchen" },
		],
	};
}
