const SIDEBAR_STORAGE_KEY = "kaffey-sidebar-collapsed";

export function readSidebarCollapsed() {
	try {
		return window.sessionStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
	} catch {
		return false;
	}
}

export function writeSidebarCollapsed(collapsed: boolean) {
	try {
		window.sessionStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
		document.body.classList.toggle("sidebar-collapsed", collapsed);
	} catch {
		return;
	}
}
