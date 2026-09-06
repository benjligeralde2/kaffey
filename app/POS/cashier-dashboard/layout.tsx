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
import { useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { readSidebarCollapsed, writeSidebarCollapsed } from "@/lib/pos-sidebar";

type ProductNotification = {
	source?: "admin-product-save";
	action: "added" | "updated";
	productName: string;
	details: string;
	timestamp: number;
};

export default function CashierDashboardLayout({ children }: { children: React.ReactNode }) {
	const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
	const [isSidebarOpen, setIsSidebarOpen] = useState(false);
	const [productNotification, setProductNotification] = useState<ProductNotification | null>(null);
	const [notifications, setNotifications] = useState<ProductNotification[]>([]);
	const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
	const [orderCount, setOrderCount] = useState(0);
	const notificationAnchorRef = useRef<HTMLDivElement>(null);
	const pathname = usePathname();
	const isCurrentPage = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
	const handleSidebarToggle = () => {
		if (window.matchMedia("(max-width: 1100px)").matches) {
			setIsSidebarOpen((open) => !open);
			return;
		}
		setIsSidebarCollapsed((collapsed) => {
			const nextCollapsedState = !collapsed;
			writeSidebarCollapsed(nextCollapsedState);
			return nextCollapsedState;
		});
	};

	useEffect(() => {
		const collapsed = readSidebarCollapsed();
		setIsSidebarCollapsed(collapsed);
		writeSidebarCollapsed(collapsed);
	}, []);

	useEffect(() => {
		const loadOrderCount = async () => {
			const response = await fetch("/api/orders?mine=true", { cache: "no-store" });
			const payload = await response.json().catch(() => ({}));
			if (response.ok && Array.isArray(payload.orders)) setOrderCount(payload.orders.length);
		};
		const orderBroadcast = "BroadcastChannel" in window ? new BroadcastChannel("kaffey-orders") : null;
		const handleOrderRecorded = () => void loadOrderCount();
		orderBroadcast?.addEventListener("message", handleOrderRecorded);
		void loadOrderCount();
		return () => {
			orderBroadcast?.removeEventListener("message", handleOrderRecorded);
			orderBroadcast?.close();
		};
	}, []);

	useEffect(() => {
		const notificationSound = new Audio("/sounds/notification_sounds.mp3");
		notificationSound.preload = "auto";
		const showProductNotification = (notification: ProductNotification) => {
			setProductNotification(notification);
			setNotifications((current) => [notification, ...current.filter((item) => item.timestamp !== notification.timestamp)].slice(0, 10));
			notificationSound.currentTime = 0;
			void notificationSound.play().catch(() => undefined);
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
	}, []);

	useEffect(() => {
		if (!productNotification) return;
		const timer = window.setTimeout(() => setProductNotification(null), 5000);
		return () => window.clearTimeout(timer);
	}, [productNotification]);

	useEffect(() => {
		const handleOutsideNotificationClick = (event: MouseEvent) => {
			if (notificationAnchorRef.current && !notificationAnchorRef.current.contains(event.target as Node)) {
				setIsNotificationsOpen(false);
				setProductNotification(null);
			}
		};

		document.addEventListener("mousedown", handleOutsideNotificationClick);
		return () => document.removeEventListener("mousedown", handleOutsideNotificationClick);
	}, []);

	return (
		<main className={`pos-page${isSidebarCollapsed ? " sidebar-collapsed" : ""}${isSidebarOpen ? " sidebar-open" : ""}`}>
			<header className="pos-header">
				<div className="pos-brand"><button className="sidebar-toggle header-sidebar-toggle" type="button" onClick={handleSidebarToggle} aria-label={isSidebarOpen ? "Close navigation" : isSidebarCollapsed ? "Expand sidebar" : "Minimize sidebar"} aria-expanded={isSidebarOpen || !isSidebarCollapsed}><Menu size={18} /></button><span className="wordmark-mark">K</span><span>kaffey<span className="wordmark-dot">.</span></span><span className="pos-badge">Counter 01</span></div>
				<div className="pos-header-actions">
					<div className="cashier-notification-anchor" ref={notificationAnchorRef}>
						<button className="pos-icon-button" type="button" aria-label="Notifications" aria-expanded={isNotificationsOpen} onClick={() => setIsNotificationsOpen((open) => !open)}><Bell size={18} strokeWidth={1.8} /><span className="notification-dot" /></button>
						{productNotification && !isNotificationsOpen && <div className="cashier-product-notification" role="status"><strong>{productNotification.productName} {productNotification.action}</strong><span>{productNotification.details}</span></div>}
						{isNotificationsOpen && <div className="cashier-notification-panel" role="region" aria-label="Notifications">
							<div className="cashier-notification-panel-header"><strong>Notifications</strong><span>{notifications.length}</span></div>
							{notifications.length > 0 ? <div className="cashier-notification-list">{notifications.map((notification) => <div className="cashier-notification-item" key={`${notification.timestamp}-${notification.productName}`}><span className="cashier-notification-icon"><Bell size={13} aria-hidden="true" /></span><span><strong>{notification.productName} {notification.action}</strong><small>{notification.details}</small></span></div>)}</div> : <p className="cashier-notification-empty">No recent notifications</p>}
						</div>}
					</div>
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
							<Link className={isCurrentPage("/POS/cashier-dashboard/orders") ? "active" : undefined} href="/POS/cashier-dashboard/orders" title="Orders"><ShoppingBag size={17} /> Orders <span className="sidebar-count">{orderCount}</span></Link>
							<Link className={isCurrentPage("/POS/cashier-dashboard/history") ? "active" : undefined} href="/POS/cashier-dashboard/history" title="Transactions"><ClipboardList size={17} /> Transactions</Link>
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
				<Link className={isCurrentPage("/POS/cashier-dashboard/orders") ? "active" : undefined} href="/POS/cashier-dashboard/orders"><ShoppingBag size={18} /><span>Orders</span><b>{orderCount}</b></Link>
				<Link className={isCurrentPage("/POS/cashier-dashboard/history") ? "active" : undefined} href="/POS/cashier-dashboard/history"><ClipboardList size={18} /><span>Transactions</span></Link>
				<Link className={isCurrentPage("/POS/cashier-dashboard/settings") ? "active" : undefined} href="/POS/cashier-dashboard/settings"><Settings size={18} /><span>Settings</span></Link>
			</nav>
		</main>
	);
}
