const SOUND_STORAGE_KEY = "kaffey-notification-sound";

export function readNotificationSoundEnabled() {
	try {
		return window.localStorage.getItem(SOUND_STORAGE_KEY) !== "false";
	} catch {
		return true;
	}
}

export function writeNotificationSoundEnabled(enabled: boolean) {
	try {
		window.localStorage.setItem(SOUND_STORAGE_KEY, String(enabled));
	} catch {
		return;
	}
}
