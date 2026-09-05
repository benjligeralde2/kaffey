import { NextResponse, type NextRequest } from "next/server";

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

export async function GET() {
	try {
		const users = await getAdminUsers();
		const adminCount = users.filter((user) => user.app_metadata?.role === "admin").length;
		const cashierCount = users.filter((user) => user.app_metadata?.role === "cashier").length;
		const accounts = users
			.filter((user) => user.app_metadata?.role !== "admin")
			.map((user) => {
				const fullName = user.user_metadata?.full_name || user.user_metadata?.name || "Unknown cashier";
				const email = user.email || "";
				return {
					id: user.id,
					name: fullName,
					email,
					role: user.app_metadata?.role === "cashier" ? "Cashier" : "Cashier",
					status: user.email_confirmed_at ? "Active" : "Pending",
					initials: fullName
						.split(" ")
						.filter(Boolean)
						.slice(0, 2)
						.map((part) => part[0]?.toUpperCase() ?? "")
						.join("") || "CA",
				};
			});

		return NextResponse.json({
			accounts,
			summary: {
				totalAccounts: cashierCount,
				admins: adminCount,
				cashiers: cashierCount,
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
		const role = body?.role === "admin" ? "admin" : "cashier";

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

		const usersResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, { headers });
		const usersResult = await usersResponse.json().catch(() => ({ users: [] }));
		const targetUser = usersResult.users?.find((user: { id?: string; email?: string }) => user.id === id);

		if (!targetUser) {
			return NextResponse.json(
				{ error: "Account to update was not found." },
				{ status: 404 },
			);
		}

		const updatePayload = {
			email,
			...(password ? { password } : {}),
			user_metadata: {
				...(targetUser.user_metadata ?? {}),
				full_name: fullName,
				name: fullName,
			},
			app_metadata: targetUser.app_metadata ?? {},
		};

		const updateResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
			method: "PUT",
			headers,
			body: JSON.stringify(updatePayload),
		});

		const updateResult = await updateResponse.json().catch(() => ({}));
		if (!updateResponse.ok) {
			return NextResponse.json(
				{ error: updateResult?.msg || updateResult?.message || "Unable to update account." },
				{ status: updateResponse.status || 500 },
			);
		}

		return NextResponse.json({
			success: true,
			id,
			email: updateResult.email || email,
			fullName,
		});
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Unexpected error updating account." },
			{ status: 500 },
		);
	}
}
