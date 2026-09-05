"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
	const [isSigningOut, setIsSigningOut] = useState(false);
	const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
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
			<button className="settings-signout" type="button" onClick={() => setIsConfirmModalOpen(true)} disabled={isSigningOut}>
				<LogOut size={16} aria-hidden="true" />
				Sign out
			</button>

			{isConfirmModalOpen && (
				<div className="charge-modal-backdrop" role="presentation">
					<div className="charge-modal login-session-modal" role="dialog" aria-modal="true" aria-labelledby="cashier-signout-title">
						<p className="pos-kicker">End cashier session</p>
						<h2 id="cashier-signout-title">Log out of the POS?</h2>
						<p className="login-session-message">You will be returned to the login page and your current cashier session will end. Proceed?</p>
						<div className="account-modal-footer">
							<button type="button" className="account-modal-secondary" onClick={() => setIsConfirmModalOpen(false)}>Stay signed in</button>
							<button type="button" className="account-modal-primary" onClick={() => void handleSignOut()} disabled={isSigningOut}>{isSigningOut ? "Logging out..." : "Proceed"}</button>
						</div>
					</div>
				</div>
			)}
		</section>
	);
}
