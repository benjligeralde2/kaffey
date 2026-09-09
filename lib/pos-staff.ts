import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export function staffRoleOf(role: unknown) {
	const normalized = String(role ?? "").trim().toLowerCase();
	if (normalized === "admin" || normalized === "cashier" || normalized === "kitchen") return normalized;
	return "";
}

export async function requireStaff() {
	const supabase = await createClient();
	const { data, error } = await supabase.auth.getUser();
	const role = staffRoleOf(data.user?.app_metadata?.role) || staffRoleOf(data.user?.user_metadata?.role);
	if (error || !data.user || !role) {
		return NextResponse.json({ error: "Staff access is required." }, { status: 401 });
	}
	return { user: data.user, role };
}
