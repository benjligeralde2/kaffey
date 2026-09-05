"use client";

import { MoreHorizontal, Search, UserPlus, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";

type Account = {
	id: string;
	initials: string;
	name: string;
	email: string;
	role: string;
	status: string;
};

export default function AdminAccountsPage() {
	const [accounts, setAccounts] = useState<Account[]>([]);
	const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);
	const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
	const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
	const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState("");
	const [adminPassword, setAdminPassword] = useState("");
	const [formData, setFormData] = useState({
		fullName: "",
		email: "",
		password: "",
		confirmPassword: "",
	});
	const [editFormData, setEditFormData] = useState({
		fullName: "",
		email: "",
		password: "",
	});
	const normalizedQuery = searchQuery.trim().toLowerCase();
	const filteredAccounts = accounts.filter((account) =>
		[account.name, account.email, account.role].some((value) => value.toLowerCase().includes(normalizedQuery)),
	);
	const hasEditChanges = selectedAccount !== null && (
		editFormData.fullName.trim() !== selectedAccount.name ||
		editFormData.email.trim() !== selectedAccount.email ||
		editFormData.password.length > 0
	);

	useEffect(() => {
		const loadAccounts = async () => {
			try {
				const response = await fetch("/api/accounts");
				const payload = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw new Error(payload.error || "Unable to load accounts.");
				}
				setAccounts(Array.isArray(payload.accounts) ? payload.accounts : []);
			} catch {
				setAccounts([]);
			} finally {
				setIsLoadingAccounts(false);
			}
		};

		loadAccounts();
	}, []);

	const handleInputChange = (field: keyof typeof formData, value: string) => {
		setFormData((current) => ({ ...current, [field]: value }));
	};

	const handleEditInputChange = (field: keyof typeof editFormData, value: string) => {
		setEditFormData((current) => ({ ...current, [field]: value }));
	};

	const openEditAccount = (account: Account) => {
		setSelectedAccount(account);
		setEditFormData({
			fullName: account.name,
			email: account.email,
			password: "",
		});
		setOpenActionMenuId(null);
		setIsEditModalOpen(true);
	};

	const handleCreateAccount = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setSubmitError("");

		if (formData.password !== formData.confirmPassword) {
			setSubmitError("Passwords do not match.");
			return;
		}

		setIsSubmitting(true);
		try {
			const response = await fetch("/api/accounts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					fullName: formData.fullName,
					email: formData.email,
					password: formData.password,
					role: "cashier",
				}),
			});

			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(payload.error || "Unable to create cashier account.");
			}

			const initials = formData.fullName
				.split(" ")
				.filter(Boolean)
				.slice(0, 2)
				.map((part) => part[0]?.toUpperCase() ?? "")
				.join("") || "CA";

			setAccounts((current) => [
				{ id: payload.id || crypto.randomUUID(), initials, name: formData.fullName, email: formData.email, role: "Cashier", status: "Active" },
				...current,
			]);
			setFormData({ fullName: "", email: "", password: "", confirmPassword: "" });
			setIsCreateModalOpen(false);
		} catch (error) {
			setSubmitError(error instanceof Error ? error.message : "Unable to create cashier account.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleUpdateAccount = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!selectedAccount || !hasEditChanges) return;
		setSubmitError("");
		setIsConfirmModalOpen(true);
	};

	const confirmAdminPasswordAndUpdate = async () => {
		if (!selectedAccount || !hasEditChanges) return;
		setSubmitError("");
		setIsSubmitting(true);
		try {
			const response = await fetch("/api/accounts", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id: selectedAccount.id,
					fullName: editFormData.fullName,
					email: editFormData.email,
					password: editFormData.password,
					adminPassword,
				}),
			});

			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(payload.error || "Unable to update account.");
			}

			const updatedInitials = editFormData.fullName
				.split(" ")
				.filter(Boolean)
				.slice(0, 2)
				.map((part) => part[0]?.toUpperCase() ?? "")
				.join("") || "CA";

			setAccounts((current) => current.map((account) => account.id === selectedAccount.id ? {
				...account,
				initials: updatedInitials,
				name: editFormData.fullName,
				email: editFormData.email,
			} : account));

			setIsConfirmModalOpen(false);
			setAdminPassword("");
			setIsEditModalOpen(false);
			setSelectedAccount(null);
		} catch (error) {
			setSubmitError(error instanceof Error ? error.message : "Unable to update account.");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<section className="pos-catalog accounts-page" aria-labelledby="accounts-title">
			<div className="pos-page-heading accounts-heading">
				<div>
					<h1 id="accounts-title">Account Management</h1>
				</div>
			</div>

			<div className="accounts-toolbar">
				<label className="accounts-search">
					<Search size={16} aria-hidden="true" />
					<input aria-label="Search accounts" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search accounts" />
				</label>
				<button type="button" className="accounts-create-button" onClick={() => setIsCreateModalOpen(true)}>
					<UserPlus size={15} aria-hidden="true" />
					<span>Create Account</span>
				</button>
			</div>

			<div className="accounts-list" role="list" aria-label="Team accounts">
				{isLoadingAccounts ? <p className="accounts-empty">Loading accounts...</p> : filteredAccounts.length > 0 ? filteredAccounts.map((account) => (
					<article className="account-row" key={account.id || account.email} role="listitem">
						<div className="account-identity">
							<span className="account-avatar"><UserRound size={17} aria-hidden="true" />{account.initials}</span>
							<span><strong>{account.name}</strong><small>{account.email}</small></span>
						</div>
						<span className="account-role">{account.role}</span>
						<span className="account-status"><i aria-hidden="true" />{account.status}</span>
						<div className="account-menu-wrap">
							<button type="button" className="account-menu-button" aria-label={`Open actions for ${account.name}`} onClick={() => setOpenActionMenuId((current) => current === account.id ? null : account.id)}>
								<MoreHorizontal size={16} aria-hidden="true" />
							</button>
							{openActionMenuId === account.id && (
								<div className="account-menu">
									<button type="button" onClick={() => openEditAccount(account)}>Edit details</button>
								</div>
							)}
						</div>
					</article>
				)) : <p className="accounts-empty">No accounts match your search.</p>}
			</div>

			{isCreateModalOpen && (
				<div className="charge-modal-backdrop" role="presentation" onMouseDown={(event) => {
					if (event.target === event.currentTarget) setIsCreateModalOpen(false);
				}}>
					<div className="charge-modal create-account-modal" role="dialog" aria-modal="true" aria-labelledby="create-account-title">
						<div className="account-modal-header">
							<div>
								<p className="pos-kicker">Team access</p>
								<h2 id="create-account-title">Create Cashier Account</h2>
							</div>
							<button type="button" className="charge-modal-close" aria-label="Close create account form" onClick={() => setIsCreateModalOpen(false)}>
								<X size={16} aria-hidden="true" />
							</button>
						</div>

						<form className="account-modal-form" onSubmit={handleCreateAccount} autoComplete="off">
							<label>
								<span>Full name</span>
								<input type="text" value={formData.fullName} onChange={(event) => handleInputChange("fullName", event.target.value)} placeholder="Enter full name" autoComplete="off" name="cashier-full-name" required />
							</label>
							<label>
								<span>Email address</span>
								<input type="email" value={formData.email} onChange={(event) => handleInputChange("email", event.target.value)} placeholder="cashier@kaffey.coffee" autoComplete="off" name="cashier-email" required />
							</label>
							<label>
								<span>Temporary password</span>
								<input type="password" value={formData.password} onChange={(event) => handleInputChange("password", event.target.value)} placeholder="Create password" autoComplete="new-password" name="cashier-password" required />
							</label>
							<label>
								<span>Confirm password</span>
								<input type="password" value={formData.confirmPassword} onChange={(event) => handleInputChange("confirmPassword", event.target.value)} placeholder="Confirm password" autoComplete="new-password" name="cashier-confirm-password" required />
							</label>

							{submitError ? <p className="account-modal-error" role="alert">{submitError}</p> : null}
							<div className="account-modal-footer">
								<button type="button" className="account-modal-secondary" onClick={() => setIsCreateModalOpen(false)}>Cancel</button>
								<button type="submit" className="account-modal-primary" disabled={isSubmitting}>{isSubmitting ? "Creating..." : "Create cashier"}</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{isEditModalOpen && selectedAccount && (
				<div className="charge-modal-backdrop" role="presentation" onMouseDown={(event) => {
					if (event.target === event.currentTarget) {
						setIsEditModalOpen(false);
						setSelectedAccount(null);
						setSubmitError("");
					}
				}}>
					<div className="charge-modal create-account-modal" role="dialog" aria-modal="true" aria-labelledby="edit-account-title">
						<div className="account-modal-header">
							<div>
								<p className="pos-kicker">Account details</p>
								<h2 id="edit-account-title">Edit cashier</h2>
							</div>
							<button type="button" className="charge-modal-close" aria-label="Close edit account form" onClick={() => {
								setIsEditModalOpen(false);
								setSelectedAccount(null);
								setSubmitError("");
							}}>
								<X size={16} aria-hidden="true" />
							</button>
						</div>

						<form className="account-modal-form" onSubmit={handleUpdateAccount} autoComplete="off">
							<label>
								<span>Full name</span>
								<input type="text" value={editFormData.fullName} onChange={(event) => handleEditInputChange("fullName", event.target.value)} placeholder="Enter full name" autoComplete="off" name="edit-cashier-name" required />
							</label>
							<label>
								<span>Email address</span>
								<input type="email" value={editFormData.email} onChange={(event) => handleEditInputChange("email", event.target.value)} placeholder="cashier@kaffey.coffee" autoComplete="off" name="edit-cashier-email" required />
							</label>
							<label>
								<span>New password</span>
								<input type="password" value={editFormData.password} onChange={(event) => handleEditInputChange("password", event.target.value)} placeholder="Leave blank to keep current password" autoComplete="new-password" name="edit-cashier-password" minLength={6} />
							</label>

							{submitError ? <p className="account-modal-error" role="alert">{submitError}</p> : null}
							<div className="account-modal-footer">
								<button type="button" className="account-modal-secondary" onClick={() => {
									setIsEditModalOpen(false);
									setSelectedAccount(null);
									setSubmitError("");
								}}>Cancel</button>
								<button type="submit" className="account-modal-primary" disabled={isSubmitting || !hasEditChanges}>{isSubmitting ? "Saving..." : "Save changes"}</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{isConfirmModalOpen && selectedAccount && (
				<div className="charge-modal-backdrop" role="presentation" onMouseDown={(event) => {
					if (event.target === event.currentTarget) {
						setIsConfirmModalOpen(false);
						setAdminPassword("");
					}
				}}>
					<div className="charge-modal confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="admin-confirm-title">
						<div className="account-modal-header">
							<div>
								<p className="pos-kicker">Security check</p>
								<h2 id="admin-confirm-title">Confirm admin access</h2>
							</div>
							<button type="button" className="charge-modal-close" aria-label="Close admin confirmation" onClick={() => {
								setIsConfirmModalOpen(false);
								setAdminPassword("");
							}}>
								<X size={16} aria-hidden="true" />
							</button>
						</div>

						<form className="account-modal-form" onSubmit={(event) => {
							event.preventDefault();
							void confirmAdminPasswordAndUpdate();
						}} autoComplete="off">
							<label>
								<span>Admin password</span>
								<input type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} placeholder="Enter admin password" autoComplete="new-password" required />
							</label>
							{submitError ? <p className="account-modal-error" role="alert">{submitError}</p> : null}
							<div className="account-modal-footer">
								<button type="button" className="account-modal-secondary" onClick={() => {
									setIsConfirmModalOpen(false);
									setAdminPassword("");
								}}>Cancel</button>
								<button type="submit" className="account-modal-primary" disabled={isSubmitting}>{isSubmitting ? "Verifying..." : "Confirm"}</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</section>
	);
}
