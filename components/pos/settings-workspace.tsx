"use client";

import { Bell, Eye, EyeOff, LogOut, Monitor, Shield, Store, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { toastError, toastSuccess } from "@/components/ui/sonner";
import { readNotificationSoundEnabled, writeNotificationSoundEnabled } from "@/lib/pos-preferences";
import { loadPosProfile, notifyProfileUpdated, type PosProfile } from "@/lib/pos-profile";
import { SIDEBAR_PREFERENCE_EVENT, readSidebarCollapsed, writeSidebarCollapsed } from "@/lib/pos-sidebar";
import { createClient } from "@/lib/supabase/client";

type SettingsWorkspaceProps = {
	variant: "admin" | "cashier";
};

export function SettingsWorkspace({ variant }: SettingsWorkspaceProps) {
	const router = useRouter();
	const [profile, setProfile] = useState<PosProfile | null>(null);
	const [displayName, setDisplayName] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [isSavingProfile, setIsSavingProfile] = useState(false);
	const [isSavingPassword, setIsSavingPassword] = useState(false);
	const [isSigningOut, setIsSigningOut] = useState(false);
	const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
	const [compactSidebar, setCompactSidebar] = useState(false);
	const [soundEnabled, setSoundEnabled] = useState(true);
	const titleId = variant === "admin" ? "admin-settings-title" : "settings-title";

	useEffect(() => {
		const syncSidebar = () => setCompactSidebar(readSidebarCollapsed());
		syncSidebar();
		setSoundEnabled(readNotificationSoundEnabled());
		void loadPosProfile().then((nextProfile) => {
			if (!nextProfile) return;
			setProfile(nextProfile);
			setDisplayName(nextProfile.name);
		});
		window.addEventListener(SIDEBAR_PREFERENCE_EVENT, syncSidebar);
		return () => window.removeEventListener(SIDEBAR_PREFERENCE_EVENT, syncSidebar);
	}, []);

	const handleSaveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const name = displayName.trim();
		if (!name) {
			toastError("Enter a display name to continue.");
			return;
		}
		setIsSavingProfile(true);
		const { data, error } = await createClient().auth.updateUser({ data: { full_name: name, name } });
		setIsSavingProfile(false);
		if (error || !data.user) {
			toastError(error?.message || "Unable to update profile.");
			return;
		}
		const nextProfile = await loadPosProfile();
		if (nextProfile) {
			setProfile(nextProfile);
			setDisplayName(nextProfile.name);
		}
		notifyProfileUpdated();
		toastSuccess("Profile updated.");
	};

	const handleSavePassword = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (password.length < 6) {
			toastError("Use a password with at least 6 characters.");
			return;
		}
		if (password !== confirmPassword) {
			toastError("The new passwords do not match.");
			return;
		}
		setIsSavingPassword(true);
		const { error } = await createClient().auth.updateUser({ password });
		setIsSavingPassword(false);
		if (error) {
			toastError(error.message);
			return;
		}
		setPassword("");
		setConfirmPassword("");
		toastSuccess("Password updated.");
	};

	const handleSignOut = async () => {
		setIsSigningOut(true);
		const { error } = await createClient().auth.signOut();
		if (error) {
			setIsSigningOut(false);
			toastError(error.message);
			return;
		}
		toastSuccess("You have been signed out.");
		router.replace("/POS/login");
	};

	return (
		<section className="pos-catalog settings-page" aria-labelledby={titleId}>
			<div className="sales-reports-heading">
				<div>
					<p className="pos-kicker">{variant === "admin" ? "Admin workspace" : "Cashier workspace"}</p>
					<h1 id={titleId}>Settings</h1>
					<p className="sales-reports-intro">{variant === "admin" ? "Manage your administrator profile, password, and workspace preferences." : "Manage your cashier profile, password, and counter preferences."}</p>
				</div>
			</div>

			<div className="settings-grid">
				<article className="settings-card">
					<div className="settings-card-heading">
						<span className="settings-card-icon"><UserRound size={16} aria-hidden="true" /></span>
						<div>
							<p className="pos-kicker">Signed in</p>
							<h2>Profile</h2>
						</div>
					</div>
					<div className="settings-profile-summary">
						<span className="settings-avatar">{profile?.initials || "…"}</span>
						<div>
							<strong>{profile?.name || "Loading account…"}</strong>
							<small>{profile?.email || " "}</small>
							<small>{variant === "admin" ? "Administrator" : "Cashier"}</small>
						</div>
					</div>
					<form className="account-modal-form" onSubmit={handleSaveProfile}>
						<label>
							<span>Display name</span>
							<input type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name at the counter" required />
						</label>
						<div className="account-modal-footer">
							<button type="submit" className="account-modal-primary" disabled={isSavingProfile}>{isSavingProfile ? "Saving..." : "Save profile"}</button>
						</div>
					</form>
				</article>

				<article className="settings-card">
					<div className="settings-card-heading">
						<span className="settings-card-icon"><Shield size={16} aria-hidden="true" /></span>
						<div>
							<p className="pos-kicker">Security</p>
							<h2>Password</h2>
						</div>
					</div>
					<form className="account-modal-form" onSubmit={handleSavePassword}>
						<label>
							<span>New password</span>
							<div className="settings-password-wrap">
								<input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" autoComplete="new-password" required />
								<button type="button" className="settings-password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((visible) => !visible)}>
									{showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
								</button>
							</div>
						</label>
						<label>
							<span>Confirm password</span>
							<input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat new password" autoComplete="new-password" required />
						</label>
						<div className="account-modal-footer">
							<button type="submit" className="account-modal-primary" disabled={isSavingPassword}>{isSavingPassword ? "Updating..." : "Update password"}</button>
						</div>
					</form>
				</article>

				<article className="settings-card">
					<div className="settings-card-heading">
						<span className="settings-card-icon"><Monitor size={16} aria-hidden="true" /></span>
						<div>
							<p className="pos-kicker">Workspace</p>
							<h2>Preferences</h2>
						</div>
					</div>
					<div className="settings-switch-list">
						<div className="settings-switch-row">
							<div>
								<strong>Compact sidebar</strong>
								<small>Keep the navigation minimized on this device.</small>
							</div>
							<button type="button" className="settings-switch" role="switch" aria-checked={compactSidebar} aria-label="Compact sidebar" onClick={() => {
								const nextValue = !compactSidebar;
								setCompactSidebar(nextValue);
								writeSidebarCollapsed(nextValue);
							}}>
								<span />
							</button>
						</div>
						{variant === "cashier" && (
							<div className="settings-switch-row">
								<div>
									<strong>Notification sound</strong>
									<small>Play a chime when the menu is updated.</small>
								</div>
								<button type="button" className="settings-switch" role="switch" aria-checked={soundEnabled} aria-label="Notification sound" onClick={() => {
									const nextValue = !soundEnabled;
									setSoundEnabled(nextValue);
									writeNotificationSoundEnabled(nextValue);
								}}>
									<span />
								</button>
							</div>
						)}
					</div>
				</article>

				<article className="settings-card">
					<div className="settings-card-heading">
						<span className="settings-card-icon"><Store size={16} aria-hidden="true" /></span>
						<div>
							<p className="pos-kicker">Kaffey counter</p>
							<h2>{variant === "admin" ? "Shop details" : "Station details"}</h2>
						</div>
					</div>
					<dl className="settings-details">
						<div><dt>Store</dt><dd>Kaffey</dd></div>
						<div><dt>{variant === "admin" ? "Role" : "Station"}</dt><dd>{variant === "admin" ? "Administrator" : "Counter 01"}</dd></div>
						<div><dt>Payments</dt><dd>Cash</dd></div>
						<div><dt>Support</dt><dd><a href="mailto:hello@kaffey.coffee">hello@kaffey.coffee</a></dd></div>
					</dl>
				</article>

				<article className="settings-card settings-card-wide">
					<div className="settings-card-heading">
						<span className="settings-card-icon"><Bell size={16} aria-hidden="true" /></span>
						<div>
							<p className="pos-kicker">Session</p>
							<h2>Sign out</h2>
						</div>
					</div>
					<p className="settings-copy">End this {variant} session and return to the login page. Unsaved work on this device will be left as-is.</p>
					<button className="settings-signout" type="button" onClick={() => setIsConfirmModalOpen(true)} disabled={isSigningOut}>
						<LogOut size={16} aria-hidden="true" />
						{isSigningOut ? "Signing out..." : "Sign out"}
					</button>
				</article>
			</div>

			{isConfirmModalOpen && (
				<div className="charge-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSigningOut) setIsConfirmModalOpen(false); }}>
					<div className="charge-modal login-session-modal" role="dialog" aria-modal="true" aria-labelledby="settings-signout-title">
						<p className="pos-kicker">{variant === "admin" ? "End admin session" : "End cashier session"}</p>
						<h2 id="settings-signout-title">Log out of the POS?</h2>
						<p className="login-session-message">You will be returned to the login page and your current {variant} session will end. Proceed?</p>
						<div className="account-modal-footer">
							<button type="button" className="account-modal-secondary" onClick={() => setIsConfirmModalOpen(false)} disabled={isSigningOut}>Stay signed in</button>
							<button type="button" className="account-modal-primary" onClick={() => void handleSignOut()} disabled={isSigningOut}>{isSigningOut ? "Logging out..." : "Proceed"}</button>
						</div>
					</div>
				</div>
			)}
		</section>
	);
}
