import { NextResponse, type NextRequest } from "next/server";

import { formatStaffRoleLabel } from "@/lib/pos-role";
import { createClient } from "@/lib/supabase/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type AdminUser = {
	id: string;
	email?: string;
	email_confirmed_at?: string | null;
	app_metadata?: { role?: string; [key: string]: unknown };
	user_metadata?: { full_name?: string; name?: string; [key: string]: unknown };
};

async function getAdminUsers() {
	if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
		throw new Error("Supabase configuration is missing.");
	}

	const headers = {
		apikey: SERVICE_ROLE_KEY,
		Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
		"Content-Type": "application/json",
	};

	const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, { headers });
	const result: { users?: AdminUser[]; msg?: string; message?: string } = await response.json().catch(() => ({ users: [] }));
	if (!response.ok) {
		throw new Error(result?.msg || result?.message || "Unable to fetch accounts.");
	}

	return Array.isArray(result.users) ? result.users : [];
}

async function getCurrentAdminUser() {
	const supabase = await createClient();
	const { data, error } = await supabase.auth.getUser();

	if (error || !data.user) {
		throw new Error("Admin session is required.");
	}

	if (data.user.app_metadata?.role !== "admin") {
		throw new Error("Admin access is required.");
	}

	return data.user;
}

function getServiceHeaders() {
	if (!SERVICE_ROLE_KEY) {
		throw new Error("Supabase configuration is missing.");
	}

	return {
		apikey: SERVICE_ROLE_KEY,
		Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
		"Content-Type": "application/json",
	};
}

async function getAdminUserById(id: string) {
	const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, { headers: getServiceHeaders() });
	const result = await response.json().catch(() => ({}));
	if (!response.ok) {
		throw new Error(result?.msg || result?.message || "Unable to load account.");
	}
	return result as AdminUser;
}

async function putAdminUser(id: string, payload: Record<string, unknown>) {
	const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
		method: "PUT",
		headers: getServiceHeaders(),
		body: JSON.stringify(payload),
	});
	const result = await response.json().catch(() => ({}));
	if (!response.ok) {
		throw new Error(result?.msg || result?.message || "Unable to update account.");
	}
	return result as AdminUser;
}

function metadataWithoutRole(metadata: AdminUser["app_metadata"]) {
	const nextMetadata = { ...(metadata ?? {}) };
	delete nextMetadata.role;
	return nextMetadata;
}

async function setStaffRole(id: string, currentMetadata: AdminUser["app_metadata"], role: "cashier" | "kitchen") {
	const previousRole = currentMetadata?.role;
	const baseMetadata = metadataWithoutRole(currentMetadata);
	if (String(previousRole || "").toLowerCase() === role) {
		return currentMetadata;
	}

	const applyRole = async (nextRole: string | null) => {
		const updated = await putAdminUser(id, { app_metadata: { ...baseMetadata, role: nextRole } });
		return updated.app_metadata;
	};

	let saved = await applyRole(role);
	if (String(saved?.role || "").toLowerCase() === role) return saved;

	await applyRole(null);
	saved = await applyRole(role);
	const verified = await getAdminUserById(id);
	if (String(verified.app_metadata?.role || "").toLowerCase() === role) return verified.app_metadata;

	if (previousRole) await applyRole(String(previousRole));
	throw new Error("Unable to update the account type.");
}

export async function GET() {
	try {
		const users = await getAdminUsers();
		const adminCount = users.filter((user) => String(user.app_metadata?.role || "").toLowerCase() === "admin").length;
		const cashierCount = users.filter((user) => String(user.app_metadata?.role || "").toLowerCase() === "cashier").length;
		const kitchenCount = users.filter((user) => String(user.app_metadata?.role || "").toLowerCase() === "kitchen").length;
		const accounts = users
			.filter((user) => String(user.app_metadata?.role || "").toLowerCase() !== "admin")
			.map((user) => {
				const role = formatStaffRoleLabel(user.app_metadata?.role);
				const fullName = String(user.user_metadata?.full_name || user.user_metadata?.name || `Unknown ${role.toLowerCase()}`);
				const email = user.email || "";
				return {
					id: user.id,
					name: fullName,
					email,
					role,
					status: user.email_confirmed_at ? "Active" : "Pending",
					initials: fullName
						.split(" ")
						.filter(Boolean)
						.slice(0, 2)
						.map((part) => part[0]?.toUpperCase() ?? "")
						.join("") || (role === "Kitchen" ? "KI" : "CA"),
				};
			});

		return NextResponse.json({
			accounts,
			summary: {
				totalAccounts: cashierCount + kitchenCount,
				admins: adminCount,
				cashiers: cashierCount,
				kitchen: kitchenCount,
			},
		});
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Unexpected error loading accounts." },
			{ status: 500 },
		);
	}
}

export async function POST(request: NextRequest) {
	if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
		return NextResponse.json(
			{ error: "Supabase configuration is missing." },
			{ status: 500 },
		);
	}

	try {
		const body = await request.json();
		const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
		const email = typeof body?.email === "string" ? body.email.trim() : "";
		const password = typeof body?.password === "string" ? body.password : "";
		const requestedRole = typeof body?.role === "string" ? body.role.trim().toLowerCase() : "";
		if (requestedRole !== "cashier" && requestedRole !== "kitchen") {
			return NextResponse.json(
				{ error: "Choose whether this account is for cashier or kitchen." },
				{ status: 400 },
			);
		}
		const role = requestedRole;

		if (!fullName || !email || !password) {
			return NextResponse.json(
				{ error: "Full name, email, and password are required." },
				{ status: 400 },
			);
		}

		const headers = {
			apikey: SERVICE_ROLE_KEY,
			Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
			"Content-Type": "application/json",
		};

		const usersResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, { headers });
		const usersResult = await usersResponse.json().catch(() => ({ users: [] }));
		const existingUser = usersResult.users?.find(
			(user: { email?: string }) => user.email?.toLowerCase() === email.toLowerCase(),
		);

		const payload = {
			email,
			password,
			email_confirm: true,
			user_metadata: {
				full_name: fullName,
				name: fullName,
			},
			app_metadata: {
				...(existingUser?.app_metadata ?? {}),
				role,
			},
		};

		const adminUserUrl = existingUser
			? `${SUPABASE_URL}/auth/v1/admin/users/${existingUser.id}`
			: `${SUPABASE_URL}/auth/v1/admin/users`;

		const response = await fetch(adminUserUrl, {
			method: existingUser ? "PUT" : "POST",
			headers,
			body: JSON.stringify(payload),
		});

		const result = await response.json().catch(() => ({}));
		if (!response.ok) {
			return NextResponse.json(
				{ error: result?.msg || result?.message || "Unable to create account." },
				{ status: response.status || 500 },
			);
		}

		if (existingUser?.id) {
			await setStaffRole(existingUser.id, existingUser.app_metadata, role);
		} else if (result.id) {
			await setStaffRole(result.id, result.app_metadata, role);
		}

		return NextResponse.json(
			{
				id: result.id,
				email: result.email,
				role,
				fullName,
			},
			{ status: 201 },
		);
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Unexpected error creating account." },
			{ status: 500 },
		);
	}
}

export async function PUT(request: NextRequest) {
	if (!SUPABASE_URL || !PUBLISHABLE_KEY || !SERVICE_ROLE_KEY) {
		return NextResponse.json(
			{ error: "Supabase configuration is missing." },
			{ status: 500 },
		);
	}

	try {
		const body = await request.json();
		const id = typeof body?.id === "string" ? body.id.trim() : "";
		const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
		const email = typeof body?.email === "string" ? body.email.trim() : "";
		const password = typeof body?.password === "string" ? body.password : "";
		const adminPassword = typeof body?.adminPassword === "string" ? body.adminPassword : "";
		const requestedRole = typeof body?.role === "string" ? body.role.trim().toLowerCase() : "";
		if (requestedRole !== "cashier" && requestedRole !== "kitchen") {
			return NextResponse.json(
				{ error: "Choose whether this account is for cashier or kitchen." },
				{ status: 400 },
			);
		}
		const role = requestedRole;

		if (!id || !fullName || !email || !adminPassword) {
			return NextResponse.json(
				{ error: "Account ID, full name, email, and admin password are required." },
				{ status: 400 },
			);
		}

		if (password && password.length < 6) {
			return NextResponse.json(
				{ error: "The new password must be at least 6 characters." },
				{ status: 400 },
			);
		}

		const adminUser = await getCurrentAdminUser();

		const reauthResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
			method: "POST",
			headers: {
				apikey: PUBLISHABLE_KEY,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ email: adminUser.email, password: adminPassword }),
		});
		const reauthResult = await reauthResponse.json().catch(() => ({}));
		if (!reauthResponse.ok) {
			return NextResponse.json(
				{ error: reauthResult?.error_description || reauthResult?.msg || reauthResult?.message || "Invalid admin password." },
				{ status: 401 },
			);
		}

		let targetUser: AdminUser;
		try {
			targetUser = await getAdminUserById(id);
		} catch {
			return NextResponse.json(
				{ error: "Account to update was not found." },
				{ status: 404 },
			);
		}

		await putAdminUser(id, {
			email,
			...(password ? { password } : {}),
			user_metadata: {
				...(targetUser.user_metadata ?? {}),
				full_name: fullName,
				name: fullName,
			},
		});
		await setStaffRole(id, targetUser.app_metadata, role);

		return NextResponse.json({
			success: true,
			id,
			email,
			fullName,
			role,
		});
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Unexpected error updating account." },
			{ status: 500 },
		);
	}
}

export async function DELETE(request: NextRequest) {
	if (!SUPABASE_URL || !PUBLISHABLE_KEY || !SERVICE_ROLE_KEY) {
		return NextResponse.json(
			{ error: "Supabase configuration is missing." },
			{ status: 500 },
		);
	}

	try {
		const body = await request.json();
		const id = typeof body?.id === "string" ? body.id.trim() : "";
		const adminPassword = typeof body?.adminPassword === "string" ? body.adminPassword : "";
		if (!id || !adminPassword) {
			return NextResponse.json({ error: "Account ID and admin password are required." }, { status: 400 });
		}

		const adminUser = await getCurrentAdminUser();
		const headers = getServiceHeaders();
		const reauthResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
			method: "POST",
			headers: {
				apikey: PUBLISHABLE_KEY,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ email: adminUser.email, password: adminPassword }),
		});
		const reauthResult = await reauthResponse.json().catch(() => ({}));
		if (!reauthResponse.ok) {
			return NextResponse.json(
				{ error: reauthResult?.error_description || reauthResult?.msg || reauthResult?.message || "Invalid admin password." },
				{ status: 401 },
			);
		}

		if (adminUser.id === id) {
			return NextResponse.json({ error: "The active admin account cannot be deleted." }, { status: 400 });
		}

		const targetUser = (await getAdminUsers()).find((user) => user.id === id);
		if (!targetUser) {
			return NextResponse.json({ error: "Account to delete was not found." }, { status: 404 });
		}
		if (targetUser.app_metadata?.role === "admin") {
			return NextResponse.json({ error: "Admin accounts cannot be deleted here." }, { status: 403 });
		}

		const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
			method: "DELETE",
			headers,
		});
		const result = await response.json().catch(() => ({}));

		if (!response.ok) {
			return NextResponse.json(
				{ error: result?.msg || result?.message || "Unable to delete account." },
				{ status: response.status || 500 },
			);
		}

		return NextResponse.json({ success: true, id });
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Unexpected error deleting account." },
			{ status: 500 },
		);
	}
}
