"use client";

import { Camera, ChevronLeft, Eye, EyeOff, KeyRound, LogOut, Monitor, Store, UserRound } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { toastError, toastSuccess } from "@/components/ui/sonner";
import { useFileUpload } from "@/hooks/use-file-upload";
import { phoneMedia } from "@/lib/breakpoints";
import { readNotificationSoundEnabled, writeNotificationSoundEnabled } from "@/lib/pos-preferences";
import { loadPosProfile, notifyProfileUpdated, type PosProfile } from "@/lib/pos-profile";
import { SIDEBAR_PREFERENCE_EVENT, readSidebarCollapsed, writeSidebarCollapsed } from "@/lib/pos-sidebar";
import { createClient } from "@/lib/supabase/client";

function readFileAsDataUrl(file: File) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Unable to read photo."));
		reader.onerror = () => reject(new Error("Unable to read photo."));
		reader.readAsDataURL(file);
	});
}

function ProfileAvatar({ name, initials, src, className }: { name: string; initials: string; src?: string; className?: string }) {
	return (
		<span className={className}>
			{src ? <img src={src} alt="" /> : initials || name.slice(0, 1).toUpperCase() || "…"}
		</span>
	);
}

function PasswordField({
	value,
	onChange,
	placeholder,
	autoComplete,
	label,
}: {
	value: string;
	onChange: (value: string) => void;
	placeholder: string;
	autoComplete: string;
	label: string;
}) {
	const [visible, setVisible] = useState(false);
	return (
		<label>
			<span>{label}</span>
			<div className="settings-password-wrap">
				<input type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete={autoComplete} required />
				<button type="button" className="settings-password-toggle" aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} onClick={() => setVisible((open) => !open)}>
					{visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
				</button>
			</div>
		</label>
	);
}

type SettingsWorkspaceProps = {
	variant: "admin" | "cashier";
};

export function SettingsWorkspace({ variant }: SettingsWorkspaceProps) {
	const router = useRouter();
	const [profile, setProfile] = useState<PosProfile | null>(null);
	const [displayName, setDisplayName] = useState("");
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [profileEmail, setProfileEmail] = useState("");
	const [phone, setPhone] = useState("");
	const [birthday, setBirthday] = useState("");
	const [gender, setGender] = useState("");
	const [address, setAddress] = useState("");
	const [station, setStation] = useState("");
	const [avatarUrl, setAvatarUrl] = useState("");
	const [currentPassword, setCurrentPassword] = useState("");
	const [password, setPassword] = useState("");
	const [{ files, errors: photoErrors }, { openFileDialog, removeFile, getInputProps }] = useFileUpload({
		accept: "image/png,image/jpeg,image/jpg,image/webp",
		maxSize: 2 * 1024 * 1024,
	});
	const [confirmPassword, setConfirmPassword] = useState("");
	const [isSavingProfile, setIsSavingProfile] = useState(false);
	const [isSavingPassword, setIsSavingPassword] = useState(false);
	const [isSigningOut, setIsSigningOut] = useState(false);
	const [cashierPanel, setCashierPanel] = useState<"profile" | "password" | "preferences" | "shop" | "signout">("profile");
	const [isPhoneLayout, setIsPhoneLayout] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [compactSidebar, setCompactSidebar] = useState(false);
	const [soundEnabled, setSoundEnabled] = useState(true);
	const titleId = variant === "admin" ? "admin-settings-title" : "settings-title";

	const applyProfile = (nextProfile: PosProfile) => {
		setProfile(nextProfile);
		setDisplayName(nextProfile.name);
		setFirstName(nextProfile.firstName);
		setLastName(nextProfile.lastName);
		setProfileEmail(nextProfile.email);
		setPhone(nextProfile.phone);
		setBirthday(nextProfile.birthday);
		setGender(nextProfile.gender);
		setAddress(nextProfile.address);
		setStation(nextProfile.station);
		setAvatarUrl(nextProfile.avatarUrl);
	};

	const photoPreview = files[0]?.preview || avatarUrl;
	const clearPhotoSelection = () => {
		if (files[0]) removeFile(files[0].id);
	};

	useEffect(() => {
		const syncSidebar = () => setCompactSidebar(readSidebarCollapsed());
		syncSidebar();
		setSoundEnabled(readNotificationSoundEnabled());
		void loadPosProfile().then((nextProfile) => {
			if (nextProfile) applyProfile(nextProfile);
		});
		window.addEventListener(SIDEBAR_PREFERENCE_EVENT, syncSidebar);
		const phone = window.matchMedia(phoneMedia);
		const syncPhone = () => {
			const isPhone = phone.matches;
			setIsPhoneLayout(isPhone);
			if (!isPhone) setSettingsOpen(false);
		};
		syncPhone();
		phone.addEventListener("change", syncPhone);
		return () => {
			window.removeEventListener(SIDEBAR_PREFERENCE_EVENT, syncSidebar);
			phone.removeEventListener("change", syncPhone);
		};
	}, []);

	const handleSaveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (variant !== "cashier") {
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
			if (nextProfile) applyProfile(nextProfile);
			notifyProfileUpdated();
			toastSuccess("Profile updated.");
			return;
		}

		const nextFirstName = firstName.trim();
		const nextLastName = lastName.trim();
		const nextEmail = profileEmail.trim();
		const nextPhone = phone.trim();
		if (!nextFirstName || !nextLastName) {
			toastError("Enter your first and last name.");
			return;
		}
		if (!nextEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
			toastError("Enter a valid email address.");
			return;
		}
		if (nextPhone && !/^[0-9+\-\s()]{7,20}$/.test(nextPhone)) {
			toastError("Enter a valid phone number.");
			return;
		}

		setIsSavingProfile(true);
		try {
			const image = files[0] ? await readFileAsDataUrl(files[0].file) : avatarUrl;
			const response = await fetch("/api/profile", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					firstName: nextFirstName,
					lastName: nextLastName,
					email: nextEmail,
					phone: nextPhone,
					birthday: birthday.trim(),
					gender,
					address: address.trim(),
					station: station.trim(),
					image,
				}),
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(payload.error || "Unable to update profile.");
			await createClient().auth.refreshSession();
			const nextProfile = await loadPosProfile();
			if (nextProfile) applyProfile(nextProfile);
			clearPhotoSelection();
			notifyProfileUpdated();
			toastSuccess(payload.emailChanged ? "Profile updated. Confirm the new email if prompted." : "Profile updated.");
		} catch (error) {
			toastError(error instanceof Error ? error.message : "Unable to update profile.");
		} finally {
			setIsSavingProfile(false);
		}
	};

	const handleSavePassword = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!currentPassword) {
			toastError("Enter your current password.");
			return;
		}
		if (password.length < 6) {
			toastError("Use a password with at least 6 characters.");
			return;
		}
		if (password === currentPassword) {
			toastError("The new password must be different from the current password.");
			return;
		}
		if (password !== confirmPassword) {
			toastError("The new passwords do not match.");
			return;
		}
		const email = profile?.email;
		if (!email) {
			toastError("No email is attached to this account.");
			return;
		}
		setIsSavingPassword(true);
		const supabase = createClient();
		const { error: authError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
		if (authError) {
			setIsSavingPassword(false);
			toastError("Current password is incorrect.");
			return;
		}
		const { error } = await supabase.auth.updateUser({ password });
		setIsSavingPassword(false);
		if (error) {
			toastError(error.message);
			return;
		}
		setCurrentPassword("");
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

	const selectCashierPanel = (panel: "profile" | "password" | "preferences" | "shop" | "signout") => {
		if (panel !== "profile") clearPhotoSelection();
		setCashierPanel(panel);
		if (isPhoneLayout) setSettingsOpen(true);
	};
	const passwordsMatch = !confirmPassword || password === confirmPassword;
	const isAdmin = variant === "admin";
	const showSettingsDetail = !isPhoneLayout || settingsOpen;
	const settingsBack = isPhoneLayout ? (
		<button className="history-calendar-back" type="button" onClick={() => setSettingsOpen(false)}>
			<ChevronLeft size={16} aria-hidden="true" /> Back
		</button>
	) : null;

	return (
		<section className={`pos-catalog settings-page settings-cashier${showSettingsDetail && isPhoneLayout ? " is-detail" : ""}`} aria-labelledby={titleId}>
			<div className="orders-dashboard-card menu-header-card">
				<div className="orders-dashboard-content">
					<div className="orders-dashboard-heading">
						<div>
							<h1 id={titleId} className="accounts-header-accessible-title">Settings</h1>
							<p aria-hidden="true">Settings</p>
							<span>{isAdmin ? "Account and workspace" : "Account and session"}</span>
						</div>
					</div>
				</div>
			</div>
			<div className="settings-cashier-layout">
				<nav className="settings-menu" aria-label="Account settings">
					<p className="settings-menu-label">Account</p>
					<button type="button" className={!isPhoneLayout && cashierPanel === "profile" ? "is-active" : undefined} aria-current={!isPhoneLayout && cashierPanel === "profile" ? "page" : undefined} onClick={() => selectCashierPanel("profile")}>
						<span className="settings-menu-icon" aria-hidden="true"><UserRound size={16} /></span>
						<span className="settings-menu-copy">
							<strong>Edit Profile</strong>
							<small>{isAdmin ? "Name and signed-in account" : "Photo and personal details"}</small>
						</span>
					</button>
					<button type="button" className={!isPhoneLayout && cashierPanel === "password" ? "is-active" : undefined} aria-current={!isPhoneLayout && cashierPanel === "password" ? "page" : undefined} onClick={() => selectCashierPanel("password")}>
						<span className="settings-menu-icon" aria-hidden="true"><KeyRound size={16} /></span>
						<span className="settings-menu-copy">
							<strong>Change Password</strong>
							<small>Update your sign-in password</small>
						</span>
					</button>
					{isAdmin ? (
						<>
							<p className="settings-menu-label">Workspace</p>
							<button type="button" className={!isPhoneLayout && cashierPanel === "preferences" ? "is-active" : undefined} aria-current={!isPhoneLayout && cashierPanel === "preferences" ? "page" : undefined} onClick={() => selectCashierPanel("preferences")}>
								<span className="settings-menu-icon" aria-hidden="true"><Monitor size={16} /></span>
								<span className="settings-menu-copy">
									<strong>Preferences</strong>
									<small>Sidebar and device layout</small>
								</span>
							</button>
							<button type="button" className={!isPhoneLayout && cashierPanel === "shop" ? "is-active" : undefined} aria-current={!isPhoneLayout && cashierPanel === "shop" ? "page" : undefined} onClick={() => selectCashierPanel("shop")}>
								<span className="settings-menu-icon" aria-hidden="true"><Store size={16} /></span>
								<span className="settings-menu-copy">
									<strong>Shop details</strong>
									<small>Store role and support</small>
								</span>
							</button>
						</>
					) : null}
					<p className="settings-menu-label">Session</p>
					<button type="button" className={`is-signout${!isPhoneLayout && cashierPanel === "signout" ? " is-active" : ""}`} aria-current={!isPhoneLayout && cashierPanel === "signout" ? "page" : undefined} onClick={() => selectCashierPanel("signout")}>
						<span className="settings-menu-icon" aria-hidden="true"><LogOut size={16} /></span>
						<span className="settings-menu-copy">
							<strong>Sign Out</strong>
							<small>End this {isAdmin ? "admin" : "cashier"} session</small>
						</span>
					</button>
				</nav>

					<div className="settings-cashier-panel">
						<AnimatePresence mode="wait">
							<motion.div key={cashierPanel} className="settings-cashier-panel-motion" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.18 }}>
						{cashierPanel === "profile" && (
							<form className="settings-cashier-form" onSubmit={handleSaveProfile}>
								<div className="settings-cashier-panel-head">
									{settingsBack}
									<p className="pos-kicker">Account</p>
									<h2 id="cashier-edit-profile-title">Edit Profile</h2>
									<p className="settings-profile-note">{isAdmin ? "This name appears on admin activity and shop records." : "These details appear on receipts and help the shop reach you."}</p>
								</div>
								{isAdmin ? (
									<>
										<div className="settings-cashier-panel-body">
											<div className="settings-profile-summary">
												<ProfileAvatar className="settings-avatar" name={profile?.name || ""} initials={profile?.initials || "…"} src={photoPreview} />
												<div>
													<strong>{profile?.name || "Loading account…"}</strong>
													<small>{profile?.email || " "}</small>
													<small>Administrator</small>
												</div>
											</div>
											<div className="account-modal-form">
												<label>
													<span>Display name</span>
													<input type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" required />
												</label>
											</div>
										</div>
										<div className="settings-cashier-panel-foot">
											<button type="submit" className="account-modal-primary" disabled={isSavingProfile}>{isSavingProfile ? "Saving..." : "Save profile"}</button>
										</div>
									</>
								) : (
								<>
								<div className="settings-cashier-panel-body">
									<div className="settings-avatar-picker">
										<button type="button" className="settings-avatar-button" onClick={openFileDialog} aria-label="Change profile photo">
											<ProfileAvatar className="settings-avatar settings-avatar-lg" name={`${firstName} ${lastName}`.trim() || profile?.name || ""} initials={profile?.initials || "…"} src={photoPreview} />
											<span className="settings-avatar-camera" aria-hidden="true"><Camera size={14} /></span>
										</button>
										<div>
											<p className="pos-kicker">Profile photo</p>
											<strong>{photoPreview ? "Photo selected" : "Add a clear face photo"}</strong>
											<div className="settings-avatar-actions">
												<button type="button" className="account-modal-secondary" onClick={openFileDialog}>{photoPreview ? "Replace photo" : "Upload photo"}</button>
												{photoPreview ? <button type="button" className="account-modal-secondary" onClick={() => { clearPhotoSelection(); setAvatarUrl(""); }}>Remove</button> : null}
											</div>
											<input {...getInputProps()} className="sr-only" aria-label="Upload profile photo" />
											{photoErrors[0] ? <p className="account-modal-error" role="alert">{photoErrors[0]}</p> : null}
										</div>
									</div>
									<p className="settings-profile-section">Name</p>
									<div className="account-modal-form settings-profile-fields">
										<label>
											<span>First name</span>
											<input type="text" value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="First name" autoComplete="given-name" required />
										</label>
										<label>
											<span>Last name</span>
											<input type="text" value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Last name" autoComplete="family-name" required />
										</label>
									</div>
									<p className="settings-profile-section">Contact</p>
									<div className="account-modal-form settings-profile-fields">
										<label>
											<span>Email</span>
											<input type="email" value={profileEmail} onChange={(event) => setProfileEmail(event.target.value)} placeholder="cashier@kaffey.coffee" autoComplete="email" required />
										</label>
										<label>
											<span>Phone</span>
											<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="09XX XXX XXXX" autoComplete="tel" />
										</label>
									</div>
									<p className="settings-profile-section">More details</p>
									<div className="account-modal-form settings-profile-fields">
										<label>
											<span>Birthday</span>
											<input type="date" value={birthday} onChange={(event) => setBirthday(event.target.value)} />
										</label>
										<label>
											<span>Gender</span>
											<select value={gender} onChange={(event) => setGender(event.target.value)}>
												<option value="">Prefer not to say</option>
												<option value="female">Female</option>
												<option value="male">Male</option>
												<option value="other">Other</option>
											</select>
										</label>
										<label>
											<span>Address</span>
											<input type="text" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street, city" autoComplete="street-address" />
										</label>
										<label>
											<span>Station</span>
											<input type="text" value={station} onChange={(event) => setStation(event.target.value)} placeholder="Counter 01" autoComplete="off" />
										</label>
									</div>
									<p className="settings-profile-section">Preferences</p>
									<div className="settings-switch-list">
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
									</div>
								</div>
								<div className="settings-cashier-panel-foot">
									<button type="submit" className="account-modal-primary" disabled={isSavingProfile}>{isSavingProfile ? "Saving..." : "Save profile"}</button>
								</div>
								</>
								)}
							</form>
						)}

						{cashierPanel === "password" && (
							<form className="settings-cashier-form settings-cashier-form-narrow" onSubmit={handleSavePassword}>
								<div className="settings-cashier-panel-head">
									{settingsBack}
									<p className="pos-kicker">Security</p>
									<h2 id="cashier-change-password-title">Change Password</h2>
									<p className="settings-profile-note">Enter your current password, then choose a new one with at least 6 characters.</p>
								</div>
								<div className="settings-cashier-panel-body">
									<div className="account-modal-form">
										<PasswordField label="Current password" value={currentPassword} onChange={setCurrentPassword} placeholder="Enter current password" autoComplete="current-password" />
										<PasswordField label="New password" value={password} onChange={setPassword} placeholder="At least 6 characters" autoComplete="new-password" />
										<div>
											<PasswordField label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Repeat new password" autoComplete="new-password" />
											{confirmPassword ? <small className={passwordsMatch ? "settings-field-ok" : "account-modal-error"}>{passwordsMatch ? "Passwords match" : "Passwords do not match"}</small> : null}
										</div>
									</div>
								</div>
								<div className="settings-cashier-panel-foot">
									<button type="submit" className="account-modal-primary" disabled={isSavingPassword || !passwordsMatch}>{isSavingPassword ? "Updating..." : "Update password"}</button>
								</div>
							</form>
						)}

						{cashierPanel === "preferences" && (
							<div className="settings-cashier-form settings-cashier-form-narrow">
								<div className="settings-cashier-panel-head">
									{settingsBack}
									<p className="pos-kicker">Workspace</p>
									<h2>Preferences</h2>
									<p className="settings-profile-note">These options apply to this device only.</p>
								</div>
								<div className="settings-cashier-panel-body">
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
									</div>
								</div>
							</div>
						)}

						{cashierPanel === "shop" && (
							<div className="settings-cashier-form settings-cashier-form-narrow">
								<div className="settings-cashier-panel-head">
									{settingsBack}
									<p className="pos-kicker">Kaffey counter</p>
									<h2>Shop details</h2>
									<p className="settings-profile-note">Store identity used across the admin workspace.</p>
								</div>
								<div className="settings-cashier-panel-body">
									<dl className="settings-details">
										<div><dt>Store</dt><dd>Kaffey</dd></div>
										<div><dt>Role</dt><dd>Administrator</dd></div>
										<div><dt>Payments</dt><dd>Cash</dd></div>
										<div><dt>Support</dt><dd><a href="mailto:hello@kaffey.coffee">hello@kaffey.coffee</a></dd></div>
									</dl>
								</div>
							</div>
						)}

						{cashierPanel === "signout" && (
							<div className="settings-cashier-form settings-cashier-form-narrow">
								<div className="settings-cashier-panel-head">
									{settingsBack}
									<p className="pos-kicker">Session</p>
									<h2 id="settings-signout-title">Sign out</h2>
									<p className="settings-profile-note">You will return to the login page. Unsaved work on this device will be left as-is.</p>
								</div>
								<div className="settings-cashier-panel-body">
									<div className="settings-action-card is-signout">
										<span className="settings-menu-icon" aria-hidden="true"><LogOut size={16} /></span>
										<div>
											<strong>End this {isAdmin ? "admin" : "cashier"} session?</strong>
											<small>You can sign back in anytime with your email and password.</small>
										</div>
									</div>
								</div>
								<div className="settings-cashier-panel-foot">
									<button type="button" className="account-modal-secondary" onClick={() => { if (isPhoneLayout) setSettingsOpen(false); else selectCashierPanel("profile"); }} disabled={isSigningOut}>Stay signed in</button>
									<button type="button" className="account-modal-primary" onClick={() => void handleSignOut()} disabled={isSigningOut}>{isSigningOut ? "Logging out..." : "Sign out"}</button>
								</div>
							</div>
						)}
							</motion.div>
						</AnimatePresence>
					</div>
				</div>
			</section>
		);
}
