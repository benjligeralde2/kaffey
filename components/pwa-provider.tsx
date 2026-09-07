"use client";

import { Download, Share, X } from "lucide-react";
import { useEffect, useState } from "react";

const DISMISS_KEY = "kaffey-pwa-dismissed";

type BeforeInstallPromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandaloneDisplay() {
	return window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

function isAppleTouchDevice() {
	return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function PwaProvider() {
	const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
	const [showAppleHint, setShowAppleHint] = useState(false);

	useEffect(() => {
		if ("serviceWorker" in navigator) {
			void navigator.serviceWorker.register("/sw.js", { scope: "/" });
		}

		if (isStandaloneDisplay() || window.localStorage.getItem(DISMISS_KEY) === "1") return;

		const isTouchDevice = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 1;

		const onPrompt = (event: Event) => {
			event.preventDefault();
			if (!isTouchDevice) return;
			setInstallEvent(event as BeforeInstallPromptEvent);
			setShowAppleHint(false);
		};

		window.addEventListener("beforeinstallprompt", onPrompt);
		if (isTouchDevice && isAppleTouchDevice()) setShowAppleHint(true);

		return () => window.removeEventListener("beforeinstallprompt", onPrompt);
	}, []);

	const dismiss = () => {
		window.localStorage.setItem(DISMISS_KEY, "1");
		setInstallEvent(null);
		setShowAppleHint(false);
	};

	const install = async () => {
		if (!installEvent) return;
		await installEvent.prompt();
		const choice = await installEvent.userChoice;
		if (choice.outcome === "accepted") window.localStorage.setItem(DISMISS_KEY, "1");
		setInstallEvent(null);
	};

	if (!installEvent && !showAppleHint) return null;

	return (
		<div className="pwa-install-banner" role="dialog" aria-labelledby="pwa-install-title">
			<div className="pwa-install-copy">
				<p className="pos-kicker">Tablet app</p>
				<h2 id="pwa-install-title">{installEvent ? "Install Kaffey on this tablet" : "Add Kaffey to the Home Screen"}</h2>
				<p>
					{installEvent
						? "Open it like a native app — full screen, from the home screen."
						: <>Tap <Share size={14} aria-label="Share" /> Share, then <strong>Add to Home Screen</strong>.</>}
				</p>
			</div>
			<div className="pwa-install-actions">
				{installEvent ? (
					<button type="button" className="pwa-install-button" onClick={() => void install()}>
						<Download size={16} aria-hidden="true" /> Install
					</button>
				) : null}
				<button type="button" className="pwa-install-dismiss" onClick={dismiss} aria-label="Dismiss install hint">
					<X size={16} />
				</button>
			</div>
		</div>
	);
}
