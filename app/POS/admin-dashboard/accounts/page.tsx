"use client";

import { ChevronLeft, ChevronRight, MoreHorizontal, Search, UserPlus, UserRound, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { toastError, toastSuccess } from "@/components/ui/sonner";

type Account = {
	id: string;
	initials: string;
	name: string;
	email: string;
	role: string;
	status: string;
};

const avatarColors = [
	{ background: "#c5ddd5", foreground: "#28544f" },
	{ background: "#f0d2bd", foreground: "#774936" },
	{ background: "#d2d8ed", foreground: "#3d4d7a" },
	{ background: "#e5d2e3", foreground: "#704b6d" },
	{ background: "#e2ddbd", foreground: "#665d2d" },
] as const;

const getAvatarColor = (account: Account) => {
	const colorIndex = [...account.id].reduce((total, character) => total + character.charCodeAt(0), 0) % avatarColors.length;
	return avatarColors[colorIndex];
};

const subscribeToResize = (onStoreChange: () => void) => {
	window.addEventListener("resize", onStoreChange);
	return () => window.removeEventListener("resize", onStoreChange);
};
const getTabletSnapshot = () => window.innerWidth >= 768 && window.innerWidth <= 1100;
const getServerSnapshot = () => false;

export default function AdminAccountsPage() {
	const [accounts, setAccounts] = useState<Account[]>([]);
	const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);
	const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
	const [confirmationAction, setConfirmationAction] = useState<"update" | "delete">("update");
	const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
	const [currentPage, setCurrentPage] = useState(1);
	const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState("");
	const [adminPassword, setAdminPassword] = useState("");
	const [currentDate, setCurrentDate] = useState<Date | null>(null);
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
	const isTablet = useSyncExternalStore(subscribeToResize, getTabletSnapshot, getServerSnapshot);
	const accountsPerPage = isTablet ? 4 : 5;
	const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / accountsPerPage));
	const safePage = Math.min(currentPage, totalPages);
	const paginatedAccounts = filteredAccounts.slice((safePage - 1) * accountsPerPage, safePage * accountsPerPage);
	const hasEditChanges = selectedAccount !== null && (
		editFormData.fullName.trim() !== selectedAccount.name ||
		editFormData.email.trim() !== selectedAccount.email ||
		editFormData.password.length > 0
	);

	useEffect(() => {
		const timer = window.setTimeout(() => setCurrentDate(new Date()), 0);
		return () => window.clearTimeout(timer);
	}, []);

	useEffect(() => {
		const loadAccounts = async () => {
			try {
				const response = await fetch("/api/accounts");
				const payload = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw new Error(payload.error || "Unable to load accounts.");
				}
				setAccounts(Array.isArray(payload.accounts) ? payload.accounts : []);
			} catch (error) {
				setAccounts([]);
				toastError(error instanceof Error ? error.message : "Unable to load accounts.");
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
			const message = "Passwords do not match.";
			setSubmitError(message);
			toastError(message);
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
			toastSuccess("Cashier account created.");
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unable to create cashier account.";
			setSubmitError(message);
			toastError(message);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleUpdateAccount = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!selectedAccount || !hasEditChanges) return;
		setSubmitError("");
		setConfirmationAction("update");
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
			toastSuccess("Account updated.");
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unable to update account.";
			setSubmitError(message);
			toastError(message);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDeleteAccount = () => {
		if (!selectedAccount) return;
		setSubmitError("");
		setConfirmationAction("delete");
		setIsConfirmModalOpen(true);
	};

	const confirmAdminPasswordAndDelete = async () => {
		if (!selectedAccount) return;
		setSubmitError("");
		setIsSubmitting(true);
		try {
			const response = await fetch("/api/accounts", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: selectedAccount.id, adminPassword }),
			});

			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(payload.error || "Unable to delete account.");
			}

			setAccounts((current) => current.filter((account) => account.id !== selectedAccount.id));
			setIsConfirmModalOpen(false);
			setAdminPassword("");
			setIsEditModalOpen(false);
			setSelectedAccount(null);
			toastSuccess("Account deleted.");
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unable to delete account.";
			setSubmitError(message);
			toastError(message);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<section className="pos-catalog accounts-page" aria-labelledby="accounts-title">
			<div className="orders-dashboard-card menu-header-card accounts-header-card">
				<div className="orders-dashboard-content">
					<div className="orders-dashboard-heading">
						<div>
							<h1 id="accounts-title" className="accounts-header-accessible-title">Account Management</h1>
							<p aria-hidden="true">Account Management</p>
							<span>{currentDate?.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}</span>
						</div>
					</div>
					<label className="pos-search orders-search accounts-search" htmlFor="accounts-search">
						<Search size={16} aria-hidden="true" />
						<input id="accounts-search" type="search" value={searchQuery} onChange={(event) => {
							setSearchQuery(event.target.value);
							setCurrentPage(1);
						}} placeholder="Search accounts" />
					</label>
					<button type="button" className="accounts-create-button accounts-header-action" onClick={() => setIsCreateModalOpen(true)}>
						<UserPlus size={15} aria-hidden="true" />
						<span>Create Account</span>
					</button>
				</div>
			</div>

			<div className="accounts-workspace">
				<div className="accounts-main-pane">
			<div className="accounts-list" role="list" aria-label="Team accounts">
				{!isLoadingAccounts && filteredAccounts.length > 0 && (
					<div className="account-table-header" aria-hidden="true">
						<span>Account</span>
						<span>Role</span>
						<span>Status</span>
						<span />
					</div>
				)}
				{isLoadingAccounts ? <p className="accounts-empty">Loading accounts...</p> : filteredAccounts.length > 0 ? paginatedAccounts.map((account) => (
					<article className={`account-row${selectedAccount?.id === account.id ? " selected" : ""}`} key={account.id || account.email} role="listitem" tabIndex={0} onClick={() => setSelectedAccount(account)} onKeyDown={(event) => {
						if (event.key === "Enter" || event.key === " ") {
							event.preventDefault();
							setSelectedAccount(account);
						}
					}}>
						<div className="account-identity">
							<span><strong>{account.name}</strong></span>
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
				)) : <div className="accounts-empty-state"><div className="accounts-empty-art"><img src="/coffees/user.png" alt="" /></div><strong>No accounts found</strong><p>Try another search to find a team account.</p></div>}
			</div>

			{!isLoadingAccounts && totalPages > 1 && (
				<nav className="accounts-pagination" aria-label="Account list pagination">
					<button type="button" aria-label="Previous accounts page" disabled={safePage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>
						<ChevronLeft size={15} aria-hidden="true" />
					</button>
					<span>Page {safePage} of {totalPages}</span>
					<button type="button" aria-label="Next accounts page" disabled={safePage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>
						<ChevronRight size={15} aria-hidden="true" />
					</button>
				</nav>
			)}
				</div>

				<aside className="account-preview" aria-label="Account details preview">
					{selectedAccount ? (
						<>
							<div className="account-preview-heading">
								<p className="pos-kicker">Selected account</p>
								<span className="account-preview-status"><i aria-hidden="true" />{selectedAccount.status}</span>
							</div>
							<div className="account-preview-identity">
								<span className="account-preview-avatar" style={getAvatarColor(selectedAccount)}>{selectedAccount.initials}</span>
								<div>
									<h2>{selectedAccount.name}</h2>
									<p>{selectedAccount.email}</p>
								</div>
							</div>
							<dl className="account-preview-details">
								<div><dt>Role</dt><dd>{selectedAccount.role}</dd></div>
								<div><dt>Access</dt><dd>Payment and Orders</dd></div>
								<div><dt>Total sold</dt><dd>₱0.00</dd></div>
							</dl>
						</>
					) : (
						<div className="account-preview-empty">
							<UserRound size={24} aria-hidden="true" />
							<strong>Preview account details</strong>
							<p>Select an account from the list to review its access and status.</p>
						</div>
					)}
				</aside>
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
								<button type="button" className="account-modal-primary" onClick={() => void handleDeleteAccount()} disabled={isSubmitting}>
									{isSubmitting ? "Deleting..." : "Delete account"}
								</button>
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
									<p className="pos-kicker">{confirmationAction === "delete" ? "Destructive action" : "Security check"}</p>
									<h2 id="admin-confirm-title">{confirmationAction === "delete" ? "Delete cashier account" : "Confirm admin access"}</h2>
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
								void (confirmationAction === "delete" ? confirmAdminPasswordAndDelete() : confirmAdminPasswordAndUpdate());
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
								<button type="submit" className="account-modal-primary" disabled={isSubmitting}>{isSubmitting ? "Verifying..." : confirmationAction === "delete" ? "Delete account" : "Confirm"}</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</section>
	);
}
