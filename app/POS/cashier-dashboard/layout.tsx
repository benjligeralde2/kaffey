"use client";

import {
	Bell,
	ChevronDown,
	ClipboardList,
	HelpCircle,
	LayoutDashboard,
	Menu,
	MessageCircle,
	Settings,
	ShoppingBag,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function CashierDashboardLayout({ children }: { children: React.ReactNode }) {
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
				<div className="pos-brand"><button className="sidebar-toggle header-sidebar-toggle" type="button" onClick={handleSidebarToggle} aria-label={isSidebarOpen ? "Close navigation" : isSidebarCollapsed ? "Expand sidebar" : "Minimize sidebar"} aria-expanded={isSidebarOpen || !isSidebarCollapsed}><Menu size={18} /></button><span className="wordmark-mark">K</span><span>kaffey<span className="wordmark-dot">.</span></span><span className="pos-badge">Counter 01</span></div>
				<div className="pos-header-actions">
					<button className="pos-icon-button" type="button" aria-label="Notifications"><Bell size={18} strokeWidth={1.8} /><span className="notification-dot" /></button>
					<button className="pos-icon-button" type="button" aria-label="Messages"><MessageCircle size={18} strokeWidth={1.8} /></button>
				</div>
			</header>

			<div className="pos-layout">
				<aside className="pos-sidebar" aria-label="Cashier navigation">
					<div className="sidebar-profile"><div className="cashier-profile"><span className="cashier-avatar">JM</span><span><strong>Jamie Miller</strong><small>Cashier · On shift</small></span><ChevronDown size={16} /></div></div>
					<div className="sidebar-section">
						<p className="sidebar-label">Workspace</p>
						<nav className="sidebar-nav">
							<Link className={isCurrentPage("/POS/cashier-dashboard/menus") ? "active" : undefined} href="/POS/cashier-dashboard/menus" title="Menus"><LayoutDashboard size={17} /> Menus</Link>
							<Link className={isCurrentPage("/POS/cashier-dashboard/orders") ? "active" : undefined} href="/POS/cashier-dashboard/orders" title="Orders"><ShoppingBag size={17} /> Orders <span className="sidebar-count">1</span></Link>
							<Link className={isCurrentPage("/POS/cashier-dashboard/history") ? "active" : undefined} href="/POS/cashier-dashboard/history" title="History"><ClipboardList size={17} /> History</Link>
						</nav>
					</div>
					<div className="sidebar-section sidebar-bottom">
						<p className="sidebar-label">Manage</p>
						<nav className="sidebar-nav">
							<Link className={isCurrentPage("/POS/cashier-dashboard/settings") ? "active" : undefined} href="/POS/cashier-dashboard/settings" title="Settings"><Settings size={17} /> Settings</Link>
							<a href="#" title="Help center"><HelpCircle size={17} /> Help center</a>
						</nav>
						<div className="shift-status"><span className="shift-status-icon" aria-hidden="true" /><span><strong>Shift in progress</strong><small>Started at 07:42 AM</small></span><i /></div>
					</div>
				</aside>
				<button className="sidebar-panel-backdrop" type="button" aria-label="Close navigation" onClick={() => setIsSidebarOpen(false)} />

				<section className="pos-content" aria-label="Cashier workspace">
					{children}
				</section>
			</div>
			<nav className="mobile-bottom-nav" aria-label="Mobile cashier navigation">
				<Link className={isCurrentPage("/POS/cashier-dashboard/menus") ? "active" : undefined} href="/POS/cashier-dashboard/menus"><LayoutDashboard size={18} /><span>Menus</span></Link>
				<Link className={isCurrentPage("/POS/cashier-dashboard/orders") ? "active" : undefined} href="/POS/cashier-dashboard/orders"><ShoppingBag size={18} /><span>Orders</span><b>1</b></Link>
				<Link className={isCurrentPage("/POS/cashier-dashboard/history") ? "active" : undefined} href="/POS/cashier-dashboard/history"><ClipboardList size={18} /><span>History</span></Link>
				<Link className={isCurrentPage("/POS/cashier-dashboard/settings") ? "active" : undefined} href="/POS/cashier-dashboard/settings"><Settings size={18} /><span>Settings</span></Link>
			</nav>
		</main>
	);
}
