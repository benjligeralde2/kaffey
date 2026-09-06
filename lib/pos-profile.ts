import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";

export const PROFILE_UPDATED_EVENT = "kaffey-profile-updated";

export type PosProfile = {
	name: string;
	email: string;
	role: "admin" | "cashier";
	initials: string;
};

export function profileFromUser(user: User): PosProfile {
	const name = String(user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Staff");
	const role = user.app_metadata?.role === "admin" ? "admin" : "cashier";
	const initials = name
		.split(" ")
		.filter(Boolean)
		.slice(0, 2)
		.map((part: string) => part[0]?.toUpperCase() ?? "")
		.join("") || "ST";
	return { name, email: user.email || "", role, initials };
}

export async function loadPosProfile() {
	const { data } = await createClient().auth.getUser();
	return data.user ? profileFromUser(data.user) : null;
}

export function notifyProfileUpdated() {
	window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
}
