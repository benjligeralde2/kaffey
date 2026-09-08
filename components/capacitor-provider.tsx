"use client";

import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";

export function CapacitorProvider() {
	useEffect(() => {
		if (!Capacitor.isNativePlatform()) return;

		const backHandle = App.addListener("backButton", ({ canGoBack }) => {
			if (canGoBack) {
				window.history.back();
				return;
			}
			void App.minimizeApp();
		});

		return () => {
			void backHandle.then((handle) => handle.remove());
		};
	}, []);

	return null;
}
