"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
	const [isSigningOut, setIsSigningOut] = useState(false);
	const router = useRouter();

	async function handleSignOut() {
		setIsSigningOut(true);
		const { error } = await createClient().auth.signOut();

		if (error) {
			setIsSigningOut(false);
			return;
		}

		router.replace("/POS/login");
	}

	return (
		<section className="pos-catalog" aria-labelledby="settings-title">
			<h1 id="settings-title">Settings</h1>
			<button className="settings-signout" type="button" onClick={handleSignOut} disabled={isSigningOut}>
				<LogOut size={16} aria-hidden="true" />
				{isSigningOut ? "Signing out..." : "Sign out"}
			</button>
		</section>
	);
}
