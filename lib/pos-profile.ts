import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";

export const PROFILE_UPDATED_EVENT = "kaffey-profile-updated";

export type PosProfile = {
	name: string;
	firstName: string;
	lastName: string;
	email: string;
	phone: string;
	birthday: string;
	gender: string;
	address: string;
	station: string;
	avatarUrl: string;
	role: "admin" | "cashier";
	initials: string;
};

function splitName(name: string) {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length <= 1) return { firstName: parts[0] || "", lastName: "" };
	return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function profileFromUser(user: User): PosProfile {
	const metadata = user.user_metadata ?? {};
	const name = String(metadata.full_name || metadata.name || user.email || "Staff");
	const names = splitName(name);
	const firstName = String(metadata.first_name || names.firstName);
	const lastName = String(metadata.last_name || names.lastName);
	const role = user.app_metadata?.role === "admin" ? "admin" : "cashier";
	const initials = `${firstName[0] || ""}${lastName[0] || name[0] || ""}`.toUpperCase() || "ST";
	return {
		name,
		firstName,
		lastName,
		email: user.email || "",
		phone: String(metadata.phone || user.phone || ""),
		birthday: String(metadata.birthday || ""),
		gender: String(metadata.gender || ""),
		address: String(metadata.address || ""),
		station: String(metadata.station || ""),
		avatarUrl: String(metadata.avatar_url || metadata.picture || metadata.avatar || ""),
		role,
		initials,
	};
}

export async function loadPosProfile() {
	const { data } = await createClient().auth.getUser();
	return data.user ? profileFromUser(data.user) : null;
}

export function notifyProfileUpdated() {
	window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
}
