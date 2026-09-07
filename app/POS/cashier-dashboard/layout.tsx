"use client";

import {
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

import { StaffNotificationBell } from "@/components/pos/staff-notification-bell";
import { createClient } from "@/lib/supabase/client";
import { subscribeToOrderAlerts, subscribeToOrderUpdates } from "@/lib/order-sync-client";
import { PROFILE_UPDATED_EVENT, loadPosProfile } from "@/lib/pos-profile";
import { SIDEBAR_PREFERENCE_EVENT, readSidebarCollapsed, writeSidebarCollapsed } from "@/lib/pos-sidebar";
import { useStaffNotices } from "@/lib/use-staff-notices";

export default function CashierDashboardLayout({ children }: { children: React.ReactNode }) {
	const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
	const [isSidebarOpen, setIsSidebarOpen] = useState(false);
	const { toast, notices, isOpen: isNotificationsOpen, setIsOpen: setIsNotificationsOpen, anchorRef: notificationAnchorRef, pushNotice } = useStaffNotices();
	const [orderCount, setOrderCount] = useState(0);
	const [profileName, setProfileName] = useState("Cashier");
	const pathname = usePathname();
	const isCurrentPage = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
	const handleSidebarToggle = () => {
		if (window.matchMedia("(max-width: 1100px)").matches) {
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
		window.addEventListener(SIDEBAR_PREFERENCE_EVENT, syncSidebar);
		return () => window.removeEventListener(SIDEBAR_PREFERENCE_EVENT, syncSidebar);
	}, []);

	useEffect(() => {
		const loadProfile = async () => {
			const nextProfile = await loadPosProfile();
			if (nextProfile) setProfileName(nextProfile.name);
		};
		void loadProfile();
		window.addEventListener(PROFILE_UPDATED_EVENT, loadProfile);
		return () => window.removeEventListener(PROFILE_UPDATED_EVENT, loadProfile);
	}, []);

	useEffect(() => {
		const loadOrderCount = async () => {
			const response = await fetch("/api/orders?mine=true", { cache: "no-store" });
			const payload = await response.json().catch(() => ({}));
			if (response.ok && Array.isArray(payload.orders)) setOrderCount(payload.orders.length);
		};
		const unsubscribe = subscribeToOrderUpdates(() => {
			void loadOrderCount();
		});
		void loadOrderCount();
		return unsubscribe;
	}, []);

	useEffect(() => {
		type ProductNotification = {
			source?: "admin-product-save";
			action: "added" | "updated" | "deleted";
			productName: string;
			details: string;
			timestamp: number;
		};
		const showProductNotification = (notification: ProductNotification) => {
			pushNotice({
				id: `product-${notification.productName}-${notification.action}-${notification.timestamp}`,
				title: `${notification.productName} ${notification.action}`,
				details: notification.details,
				timestamp: notification.timestamp,
			});
		};
		const handleProductNotification = (event: StorageEvent) => {
			if (event.key !== "kaffey-product-notification" || !event.newValue) return;
			try {
				const notification = JSON.parse(event.newValue) as ProductNotification;
				if (notification.source === "admin-product-save" && notification.action && notification.productName) showProductNotification(notification);
			} catch {
				return;
			}
		};
		const productBroadcast = "BroadcastChannel" in window ? new BroadcastChannel("kaffey-product-notifications") : null;
		const handleBroadcastNotification = (event: MessageEvent<ProductNotification>) => {
			const notification = event.data;
			if (notification?.source === "admin-product-save" && notification.action && notification.productName) showProductNotification(notification);
		};
		productBroadcast?.addEventListener("message", handleBroadcastNotification);

		const supabase = createClient();
		const productChannel = supabase
			.channel("cashier-product-notifications")
			.on("broadcast", { event: "product-updated" }, (event) => {
				const notification = event.payload as ProductNotification;
				if (notification?.action && notification.productName) showProductNotification(notification);
			})
			.on("postgres_changes", { event: "INSERT", schema: "public", table: "products" }, (payload) => {
				const product = payload.new as { name?: string; category?: string; price?: number };
				if (product.name) showProductNotification({ action: "added", productName: product.name, details: `${product.category || "Product"} · ₱${Number(product.price || 0).toFixed(2)}`, timestamp: Date.now() });
			})
			.on("postgres_changes", { event: "UPDATE", schema: "public", table: "products" }, (payload) => {
				const product = payload.new as { name?: string; category?: string; price?: number };
				if (product.name) showProductNotification({ action: "updated", productName: product.name, details: `${product.category || "Product"} · ₱${Number(product.price || 0).toFixed(2)}`, timestamp: Date.now() });
			})
			.on("postgres_changes", { event: "DELETE", schema: "public", table: "products" }, (payload) => {
				const product = payload.old as { name?: string; category?: string; price?: number };
				if (product.name) showProductNotification({ action: "deleted", productName: product.name, details: `${product.category || "Product"} · ₱${Number(product.price || 0).toFixed(2)}`, timestamp: Date.now() });
			})
			.subscribe((status, error) => {
				if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") console.error("Product notification channel failed", error);
			});

		window.addEventListener("storage", handleProductNotification);
		return () => {
			window.removeEventListener("storage", handleProductNotification);
			productBroadcast?.removeEventListener("message", handleBroadcastNotification);
			productBroadcast?.close();
			void supabase.removeChannel(productChannel);
		};
	}, [pushNotice]);

	useEffect(() => {
		return subscribeToOrderAlerts((alert) => {
			if (alert.type !== "order-finished") return;
			pushNotice({
				id: `${alert.type}-${alert.orderId}-${alert.timestamp}`,
				title: `${alert.customerName}, order is ready`,
				details: alert.items || "Order finished in kitchen",
				timestamp: alert.timestamp,
			});
		});
	}, [pushNotice]);

	return (
		<main className={`pos-page${isSidebarCollapsed ? " sidebar-collapsed" : ""}${isSidebarOpen ? " sidebar-open" : ""}`}>
			<header className="pos-header">
				<div className="pos-brand"><button className="sidebar-toggle header-sidebar-toggle" type="button" onClick={handleSidebarToggle} aria-label={isSidebarOpen ? "Close navigation" : isSidebarCollapsed ? "Expand sidebar" : "Minimize sidebar"} aria-expanded={isSidebarOpen || !isSidebarCollapsed}><Menu size={18} /></button><span className="wordmark-mark">K</span><span>kaffey<span className="wordmark-dot">.</span></span><span className="pos-badge">Counter</span></div>
				<div className="pos-header-actions">
					<StaffNotificationBell notices={notices} toast={toast} isOpen={isNotificationsOpen} setIsOpen={setIsNotificationsOpen} anchorRef={notificationAnchorRef} />
					<button className="pos-icon-button" type="button" aria-label="Messages"><MessageCircle size={18} strokeWidth={1.8} /></button>
				</div>
			</header>

			<div className="pos-layout">
				<aside className="pos-sidebar cashier-sidebar" aria-label="Cashier navigation">
					<div className="sidebar-section">
						<p className="sidebar-label">Workspace</p>
						<nav className="sidebar-nav">
							<Link className={isCurrentPage("/POS/cashier-dashboard/menus") ? "active" : undefined} href="/POS/cashier-dashboard/menus" title="Menus"><LayoutDashboard size={17} /> Menus</Link>
							<Link className={isCurrentPage("/POS/cashier-dashboard/orders") ? "active" : undefined} href="/POS/cashier-dashboard/orders" title="Orders"><ShoppingBag size={17} /> Orders <span className="sidebar-count">{orderCount}</span></Link>
							<Link className={isCurrentPage("/POS/cashier-dashboard/history") ? "active" : undefined} href="/POS/cashier-dashboard/history" title="Transactions"><ClipboardList size={17} /> Transactions</Link>
						</nav>
					</div>
					<div className="sidebar-section">
						<p className="sidebar-label">Manage</p>
						<nav className="sidebar-nav">
							<Link className={isCurrentPage("/POS/cashier-dashboard/settings") ? "active" : undefined} href="/POS/cashier-dashboard/settings" title="Settings"><Settings size={17} /> Settings</Link>
							<a href="#" title="Help center"><HelpCircle size={17} /> Help center</a>
						</nav>
					</div>
					<p className="sidebar-cashier-name">{profileName}</p>
				</aside>
				<button className="sidebar-panel-backdrop" type="button" aria-label="Close navigation" onClick={() => setIsSidebarOpen(false)} />

				<section className="pos-content" aria-label="Cashier workspace">
					{children}
				</section>
			</div>
			<nav className="mobile-bottom-nav" aria-label="Mobile cashier navigation">
				<Link className={isCurrentPage("/POS/cashier-dashboard/menus") ? "active" : undefined} href="/POS/cashier-dashboard/menus"><LayoutDashboard size={18} /><span>Menus</span></Link>
				<Link className={isCurrentPage("/POS/cashier-dashboard/orders") ? "active" : undefined} href="/POS/cashier-dashboard/orders"><ShoppingBag size={18} /><span>Orders</span><b>{orderCount}</b></Link>
				<Link className={isCurrentPage("/POS/cashier-dashboard/history") ? "active" : undefined} href="/POS/cashier-dashboard/history"><ClipboardList size={18} /><span>Transactions</span></Link>
				<Link className={isCurrentPage("/POS/cashier-dashboard/settings") ? "active" : undefined} href="/POS/cashier-dashboard/settings"><Settings size={18} /><span>Settings</span></Link>
			</nav>
		</main>
	);
}
