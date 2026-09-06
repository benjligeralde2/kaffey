const SIDEBAR_STORAGE_KEY = "kaffey-sidebar-collapsed";
export const SIDEBAR_PREFERENCE_EVENT = "kaffey-sidebar-preference";

export function readSidebarCollapsed() {
	try {
		return window.sessionStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
	} catch {
		return false;
	}
}

function applySidebarCollapsedClass(collapsed: boolean) {
	document.body.classList.toggle("sidebar-collapsed", collapsed);
}

export function writeSidebarCollapsed(collapsed: boolean) {
	try {
		window.sessionStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
		applySidebarCollapsedClass(collapsed);
		window.dispatchEvent(new Event(SIDEBAR_PREFERENCE_EVENT));
	} catch {
		return;
	}
}
