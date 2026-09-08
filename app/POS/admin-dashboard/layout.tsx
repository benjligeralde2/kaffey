"use client";

import {
	Bell,
	BarChart3,
	ChevronDown,
	Coffee,
	HelpCircle,
	LayoutDashboard,
	LogOut,
	Menu,
	MessageCircle,
	Monitor,
	Settings,
	Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { toastError, toastSuccess } from "@/components/ui/sonner";
import { tabletOrPhoneMedia } from "@/lib/breakpoints";
import { PROFILE_UPDATED_EVENT, loadPosProfile } from "@/lib/pos-profile";
import { SIDEBAR_PREFERENCE_EVENT, readSidebarCollapsed, writeSidebarCollapsed } from "@/lib/pos-sidebar";
import { createClient } from "@/lib/supabase/client";

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
	const router = useRouter();
	const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
	const [isSidebarOpen, setIsSidebarOpen] = useState(false);
	const [isSigningOut, setIsSigningOut] = useState(false);
	const [profile, setProfile] = useState({ name: "Admin", initials: "AD" });
	const pathname = usePathname();
	const isCurrentPage = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

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

	const handleSidebarToggle = () => {
		if (window.matchMedia(tabletOrPhoneMedia).matches) {
			setIsSidebarOpen((open) => !open);
			return;
		}
		const nextCollapsedState = !isSidebarCollapsed;
		setIsSidebarCollapsed(nextCollapsedState);
		writeSidebarCollapsed(nextCollapsedState);
	};

	useEffect(() => {
		setIsSidebarCollapsed(readSidebarCollapsed());
		const syncSidebar = () => setIsSidebarCollapsed(readSidebarCollapsed());
		const closeOverlayOnDesktop = () => {
			if (!window.matchMedia(tabletOrPhoneMedia).matches) setIsSidebarOpen(false);
		};
		window.addEventListener(SIDEBAR_PREFERENCE_EVENT, syncSidebar);
		window.addEventListener("resize", closeOverlayOnDesktop);
		return () => {
			window.removeEventListener(SIDEBAR_PREFERENCE_EVENT, syncSidebar);
			window.removeEventListener("resize", closeOverlayOnDesktop);
		};
	}, []);

	useEffect(() => {
		const loadProfile = async () => {
			const nextProfile = await loadPosProfile();
			if (nextProfile) setProfile({ name: nextProfile.name, initials: nextProfile.initials });
		};
		void loadProfile();
		window.addEventListener(PROFILE_UPDATED_EVENT, loadProfile);
		return () => window.removeEventListener(PROFILE_UPDATED_EVENT, loadProfile);
	}, []);

	return (
		<main className={`pos-page admin-page${isSidebarCollapsed ? " sidebar-collapsed" : ""}${isSidebarOpen ? " sidebar-open" : ""}`}>
			<header className="pos-header">
				<div className="pos-brand"><button className="sidebar-toggle header-sidebar-toggle" type="button" onClick={handleSidebarToggle} aria-label={isSidebarOpen ? "Close navigation" : isSidebarCollapsed ? "Expand sidebar" : "Minimize sidebar"} aria-expanded={isSidebarOpen || !isSidebarCollapsed}><Menu size={18} /></button><span className="wordmark-mark">K</span><span>kaffey<span className="wordmark-dot">.</span></span><span className="pos-badge">Admin</span></div>
				<div className="pos-header-actions">
					<button className="pos-icon-button" type="button" aria-label="Notifications"><Bell size={18} strokeWidth={1.8} /><span className="notification-dot" /></button>
					<button className="pos-icon-button" type="button" aria-label="Messages"><MessageCircle size={18} strokeWidth={1.8} /></button>
				</div>
			</header>

			<section className="admin-phone-gate" aria-labelledby="admin-phone-gate-title">
				<span className="admin-phone-gate-icon" aria-hidden="true"><Monitor size={22} /></span>
				<p className="pos-kicker">Administrator</p>
				<h1 id="admin-phone-gate-title">Tablet and desktop only</h1>
				<p>Admin tools are built for a larger screen. Open Kaffey on a tablet or computer to continue.</p>
				<button type="button" className="account-modal-secondary" onClick={() => void handleSignOut()} disabled={isSigningOut}>
					<LogOut size={14} aria-hidden="true" />
					{isSigningOut ? "Signing out..." : "Sign out"}
				</button>
			</section>

			<div className="pos-layout">
				<aside className="pos-sidebar" aria-label="Admin navigation" onClick={(event) => {
					if (!(event.target instanceof Element)) return;
					if (event.target.closest("a") && window.matchMedia(tabletOrPhoneMedia).matches) setIsSidebarOpen(false);
				}}>
					<div className="sidebar-profile"><div className="cashier-profile"><span className="cashier-avatar">{profile.initials}</span><span><strong>{profile.name}</strong><small>Administrator · On duty</small></span><ChevronDown size={16} /></div></div>
					<div className="sidebar-section">
						<p className="sidebar-label">Workspace</p>
						<nav className="sidebar-nav">
							<Link className={pathname === "/POS/admin-dashboard" ? "active" : undefined} href="/POS/admin-dashboard" title="Dashboard"><LayoutDashboard size={17} /> Dashboard</Link>
							<Link className={isCurrentPage("/POS/admin-dashboard/accounts") ? "active" : undefined} href="/POS/admin-dashboard/accounts" title="Accounts"><Users size={17} /> Accounts</Link>
							<Link className={isCurrentPage("/POS/admin-dashboard/products") ? "active" : undefined} href="/POS/admin-dashboard/products" title="Products"><Coffee size={17} /> Products</Link>
							<Link className={isCurrentPage("/POS/admin-dashboard/sales-reports") ? "active" : undefined} href="/POS/admin-dashboard/sales-reports" title="Sales Reports"><BarChart3 size={17} /> Sales Reports</Link>
							<Link className={isCurrentPage("/POS/admin-dashboard/settings") ? "active" : undefined} href="/POS/admin-dashboard/settings" title="Settings"><Settings size={17} /> Settings</Link>
						</nav>
					</div>
					<div className="sidebar-section sidebar-bottom">
						<p className="sidebar-label">Manage</p>
						<nav className="sidebar-nav">
							<a href="#" title="Help center"><HelpCircle size={17} /> Help center</a>
						</nav>
						<div className="shift-status"><span className="shift-status-icon" aria-hidden="true" /><span><strong>Admin session active</strong><small>Administrator access</small></span><i /></div>
					</div>
				</aside>
				<button className="sidebar-panel-backdrop" type="button" aria-label="Close navigation" onClick={() => setIsSidebarOpen(false)} />

				<section className="pos-content" aria-label="Admin workspace">
					{children}
				</section>
			</div>
		</main>
	);
}
