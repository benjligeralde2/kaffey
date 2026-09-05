"use client";

import {
	Bell,
	ChevronDown,
	Coffee,
	HelpCircle,
	LayoutDashboard,
	Menu,
	MessageCircle,
	Settings,
	Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
	const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
	const [isSidebarOpen, setIsSidebarOpen] = useState(false);
	const pathname = usePathname();
	const isCurrentPage = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

	const handleSidebarToggle = () => {
		if (window.matchMedia("(max-width: 1100px)").matches) {
			setIsSidebarOpen((open) => !open);
			return;
		}
		setIsSidebarCollapsed((collapsed) => {
			const nextCollapsedState = !collapsed;
			window.sessionStorage.setItem("kaffey-sidebar-collapsed", String(nextCollapsedState));
			return nextCollapsedState;
		});
	};

	useEffect(() => {
		const storedState = window.sessionStorage.getItem("kaffey-sidebar-collapsed");
		setIsSidebarCollapsed(storedState === "true");
	}, []);

	return (
		<main className={`pos-page${isSidebarCollapsed ? " sidebar-collapsed" : ""}${isSidebarOpen ? " sidebar-open" : ""}`}>
			<header className="pos-header">
				<div className="pos-brand"><button className="sidebar-toggle header-sidebar-toggle" type="button" onClick={handleSidebarToggle} aria-label={isSidebarOpen ? "Close navigation" : isSidebarCollapsed ? "Expand sidebar" : "Minimize sidebar"} aria-expanded={isSidebarOpen || !isSidebarCollapsed}><Menu size={18} /></button><span className="wordmark-mark">K</span><span>kaffey<span className="wordmark-dot">.</span></span><span className="pos-badge">Admin</span></div>
				<div className="pos-header-actions">
					<button className="pos-icon-button" type="button" aria-label="Notifications"><Bell size={18} strokeWidth={1.8} /><span className="notification-dot" /></button>
					<button className="pos-icon-button" type="button" aria-label="Messages"><MessageCircle size={18} strokeWidth={1.8} /></button>
				</div>
			</header>

			<div className="pos-layout">
				<aside className="pos-sidebar" aria-label="Admin navigation">
					<div className="sidebar-profile"><div className="cashier-profile"><span className="cashier-avatar">AD</span><span><strong>Admin</strong><small>Administrator · On duty</small></span><ChevronDown size={16} /></div></div>
					<div className="sidebar-section">
						<p className="sidebar-label">Workspace</p>
						<nav className="sidebar-nav">
							<Link className={pathname === "/POS/admin-dashboard" ? "active" : undefined} href="/POS/admin-dashboard" title="Dashboard"><LayoutDashboard size={17} /> Dashboard</Link>
							<Link className={isCurrentPage("/POS/admin-dashboard/accounts") ? "active" : undefined} href="/POS/admin-dashboard/accounts" title="Accounts"><Users size={17} /> Accounts</Link>
							<Link className={isCurrentPage("/POS/admin-dashboard/products") ? "active" : undefined} href="/POS/admin-dashboard/products" title="Products"><Coffee size={17} /> Products</Link>
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
			<nav className="mobile-bottom-nav" aria-label="Mobile admin navigation">
				<Link className={pathname === "/POS/admin-dashboard" ? "active" : undefined} href="/POS/admin-dashboard"><LayoutDashboard size={18} /><span>Dashboard</span></Link>
				<Link className={isCurrentPage("/POS/admin-dashboard/accounts") ? "active" : undefined} href="/POS/admin-dashboard/accounts"><Users size={18} /><span>Accounts</span></Link>
				<Link className={isCurrentPage("/POS/admin-dashboard/products") ? "active" : undefined} href="/POS/admin-dashboard/products"><Coffee size={18} /><span>Products</span></Link>
				<Link className={isCurrentPage("/POS/admin-dashboard/settings") ? "active" : undefined} href="/POS/admin-dashboard/settings"><Settings size={18} /><span>Settings</span></Link>
			</nav>
		</main>
	);
}
