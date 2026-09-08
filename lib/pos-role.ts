export type PosRole = "admin" | "cashier" | "kitchen";

export function isPosStaffRole(role: unknown): role is PosRole {
	const normalized = String(role ?? "").trim().toLowerCase();
	return normalized === "admin" || normalized === "kitchen" || normalized === "cashier";
}

export function normalizePosRole(role: unknown): PosRole {
	return isPosStaffRole(role) ? (String(role).trim().toLowerCase() as PosRole) : "cashier";
}

export function parseStaffWorkspaceRole(role: unknown): "cashier" | "kitchen" {
	return normalizePosRole(role) === "kitchen" ? "kitchen" : "cashier";
}

export function posHomePath(role: unknown) {
	const normalized = normalizePosRole(role);
	if (normalized === "admin") return "/POS/admin-dashboard";
	if (normalized === "kitchen") return "/POS/kitchen";
	return "/POS/cashier-dashboard/menus";
}

export function resolvePostLoginPath(role: unknown, requestedPath: string | null) {
	const home = posHomePath(role);
	if (!requestedPath?.startsWith("/POS/")) return home;

	const normalized = normalizePosRole(role);
	if (normalized === "admin" && (requestedPath.startsWith("/POS/admin-dashboard") || requestedPath.startsWith("/POS/kitchen"))) {
		return requestedPath;
	}
	if (normalized === "kitchen" && requestedPath.startsWith("/POS/kitchen")) {
		return requestedPath;
	}
	if (normalized === "cashier" && requestedPath.startsWith("/POS/cashier-dashboard")) {
		return requestedPath === "/POS/cashier-dashboard" ? home : requestedPath;
	}

	return home;
}

export function formatStaffRoleLabel(role: unknown) {
	const normalized = String(role || "").toLowerCase();
	if (normalized === "admin") return "Admin";
	if (normalized === "kitchen") return "Kitchen";
	return "Cashier";
}
