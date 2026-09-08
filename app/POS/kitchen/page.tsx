"use client";

import { Check, ChefHat, Clock3, LogOut, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { StaffNotificationBell } from "@/components/pos/staff-notification-bell";
import { toastError, toastSuccess } from "@/components/ui/sonner";
import { subscribeToOrderAlerts, subscribeToOrderUpdates } from "@/lib/order-sync-client";
import { ORDER_STATUSES, nextOrderStatus, normalizeStatus, statusPillClass, type OrderStatus } from "@/lib/order-status";
import { createClient } from "@/lib/supabase/client";
import { useStaffNotices } from "@/lib/use-staff-notices";

type KitchenOrder = {
	id: string;
	recordId: string;
	name: string;
	items: string;
	time: string;
	status: OrderStatus;
	lineItems: { name: string; quantity: number; price: number }[];
};

const COLUMN_META: Record<OrderStatus, { label: string; hint: string; action: string; Icon: typeof Clock3 }> = {
	Pending: { label: "Pending", hint: "New tickets", action: "Start cooking", Icon: Clock3 },
	"On process": { label: "On process", hint: "At the station", action: "Mark finished", Icon: ChefHat },
	Finished: { label: "Finished", hint: "Ready to serve", action: "", Icon: Check },
};

function waitLabel(time: string, now = Date.now()) {
	const placedAt = new Date(time).getTime();
	if (Number.isNaN(placedAt)) return { text: "", urgent: false };
	const minutes = Math.max(0, Math.round((now - placedAt) / 60000));
	if (minutes < 1) return { text: "Now", urgent: false };
	return { text: `${minutes}m`, urgent: minutes >= 8 };
}

export default function KitchenPage() {
	const router = useRouter();
	const [orders, setOrders] = useState<KitchenOrder[]>([]);
	const [nowMs, setNowMs] = useState(() => Date.now());
	const [updatingId, setUpdatingId] = useState("");
	const [pendingOrder, setPendingOrder] = useState<KitchenOrder | null>(null);
	const [isSignOutOpen, setIsSignOutOpen] = useState(false);
	const [isSigningOut, setIsSigningOut] = useState(false);
	const [error, setError] = useState("");
	const { toast, notices, isOpen, setIsOpen, anchorRef, pushNotice } = useStaffNotices();

	useEffect(() => {
		const timer = window.setInterval(() => setNowMs(Date.now()), 15000);
		return () => window.clearInterval(timer);
	}, []);

	useEffect(() => {
		const loadOrders = async () => {
			const response = await fetch("/api/orders?kitchen=true", { cache: "no-store" });
			const payload = await response.json().catch(() => ({}));
			if (!response.ok || !Array.isArray(payload.orders)) {
				setError(typeof payload.error === "string" ? payload.error : "Unable to load kitchen tickets.");
				return;
			}
			setError("");
			setOrders(payload.orders.map((order: KitchenOrder) => ({
				...order,
				recordId: order.recordId || "",
				status: normalizeStatus(order.status),
				lineItems: Array.isArray(order.lineItems) ? order.lineItems : [],
			})));
		};
		const unsubscribe = subscribeToOrderUpdates(() => {
			void loadOrders();
		});
		void loadOrders();
		return unsubscribe;
	}, []);

	useEffect(() => {
		return subscribeToOrderAlerts((alert) => {
			if (alert.type !== "new-order") return;
			pushNotice({
				id: `${alert.type}-${alert.orderId}-${alert.timestamp}`,
				title: `New order · ${alert.customerName}`,
				details: alert.items || "Ticket received",
				timestamp: alert.timestamp,
			});
		});
	}, [pushNotice]);

	const columns = useMemo(() => (
		ORDER_STATUSES.map((status) => ({
			status,
			orders: orders.filter((order) => order.status === status),
		}))
	), [orders]);

	const activeCount = orders.filter((order) => order.status !== "Finished").length;

	const advanceStatus = async (order: KitchenOrder) => {
		const next = nextOrderStatus(order.status);
		if (!next || !order.recordId || updatingId) return;
		setUpdatingId(order.recordId);
		setError("");
		try {
			const response = await fetch("/api/orders", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: order.recordId, status: next }),
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(payload.error || "Unable to update order.");
			const updated = payload.order as KitchenOrder;
			setOrders((current) => current.map((item) => item.recordId === updated.recordId ? { ...item, ...updated, status: normalizeStatus(updated.status) } : item));
			setPendingOrder(null);
		} catch (updateError) {
			setError(updateError instanceof Error ? updateError.message : "Unable to update order.");
		} finally {
			setUpdatingId("");
		}
	};

	const handleSignOut = async () => {
		setIsSigningOut(true);
		const { error: signOutError } = await createClient().auth.signOut();
		if (signOutError) {
			setIsSigningOut(false);
			toastError(signOutError.message);
			return;
		}
		toastSuccess("You have been signed out.");
		router.replace("/POS/login");
	};

	const pendingMeta = pendingOrder ? COLUMN_META[pendingOrder.status] : null;
	const pendingNext = pendingOrder ? nextOrderStatus(pendingOrder.status) : null;

	return (
		<main className="pos-page kitchen-page">
			<header className="pos-header">
				<div className="pos-brand">
					<span className="wordmark-mark">K</span>
					<span>kaffey<span className="wordmark-dot">.</span></span>
					<span className="pos-badge">Kitchen</span>
				</div>
				<div className="pos-header-actions">
					<span className="kitchen-live-count">{activeCount} active</span>
					<StaffNotificationBell notices={notices} toast={toast} isOpen={isOpen} setIsOpen={setIsOpen} anchorRef={anchorRef} />
					<button className="pos-icon-button" type="button" aria-label="Sign out" onClick={() => setIsSignOutOpen(true)}>
						<LogOut size={18} strokeWidth={1.8} />
					</button>
				</div>
			</header>
			{error && !pendingOrder ? <p className="login-error kitchen-error" role="alert">{error}</p> : null}
			<section className="kitchen-board" aria-label="Kitchen orders">
				{columns.map((column) => {
					const meta = COLUMN_META[column.status];
					return (
						<div className={`kitchen-column kitchen-column-${statusPillClass(column.status)}`} key={column.status}>
							<div className="kitchen-column-head">
								<p>{meta.label}</p>
								<b>{column.orders.length}</b>
							</div>
							<div className="kitchen-ticket-cols kitchen-ticket-cols-head">
								<span>Name</span>
								<span>Item</span>
								<span>Quantity</span>
							</div>
							<div className="kitchen-tickets">
								{column.orders.length === 0 ? (
									<p className="kitchen-empty">No tickets</p>
								) : column.orders.map((order) => {
									const next = nextOrderStatus(order.status);
									const wait = waitLabel(order.time, nowMs);
									const lineItems = order.lineItems.length ? order.lineItems : [{ name: order.items, quantity: 1, price: 0 }];
									return (
										<article className={`kitchen-ticket kitchen-ticket-${statusPillClass(order.status)}${wait.urgent ? " is-urgent" : ""}`} key={order.recordId || order.id}>
											{lineItems.map((item, index) => (
												<div className="kitchen-ticket-cols" key={`${item.name}-${index}`}>
													<span>{index === 0 ? order.name : ""}</span>
													<span>{item.name}</span>
													<span>{item.quantity}</span>
												</div>
											))}
											{next ? (
												<button type="button" disabled={Boolean(updatingId)} onClick={() => { setError(""); setPendingOrder(order); }}>
													{meta.action}
												</button>
											) : null}
										</article>
									);
								})}
							</div>
						</div>
					);
				})}
			</section>
			{pendingOrder && pendingMeta && pendingNext ? (
				<div className="charge-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !updatingId) setPendingOrder(null); }}>
					<section className="charge-modal" role="dialog" aria-modal="true" aria-labelledby="kitchen-confirm-title">
						<button className="charge-modal-close" type="button" aria-label="Close confirmation" disabled={Boolean(updatingId)} onClick={() => { if (!updatingId) setPendingOrder(null); }}><X size={18} /></button>
						<p className="pos-kicker">Kitchen update</p>
						<h2 id="kitchen-confirm-title">{pendingOrder.status === "Pending" ? "Start cooking this order?" : "Mark this order finished?"}</h2>
						<p className="clear-order-message">{pendingOrder.name} will move to {pendingNext}.</p>
						{error ? <p className="login-error" role="alert">{error}</p> : null}
						<div className="clear-order-actions">
							<button type="button" disabled={Boolean(updatingId)} onClick={() => setPendingOrder(null)}>Cancel</button>
							<button type="button" disabled={Boolean(updatingId)} onClick={() => void advanceStatus(pendingOrder)}>{updatingId ? "Updating..." : pendingMeta.action}</button>
						</div>
					</section>
				</div>
			) : null}
			{isSignOutOpen ? (
				<div className="charge-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSigningOut) setIsSignOutOpen(false); }}>
					<section className="charge-modal" role="dialog" aria-modal="true" aria-labelledby="kitchen-signout-title">
						<button className="charge-modal-close" type="button" aria-label="Close sign out confirmation" disabled={isSigningOut} onClick={() => { if (!isSigningOut) setIsSignOutOpen(false); }}><X size={18} /></button>
						<p className="pos-kicker">Session</p>
						<h2 id="kitchen-signout-title">Sign out of kitchen?</h2>
						<p className="clear-order-message">You will return to the login page. Open tickets stay on the board for the next cook.</p>
						<div className="clear-order-actions">
							<button type="button" disabled={isSigningOut} onClick={() => setIsSignOutOpen(false)}>Stay signed in</button>
							<button type="button" disabled={isSigningOut} onClick={() => void handleSignOut()}>{isSigningOut ? "Signing out..." : "Sign out"}</button>
						</div>
					</section>
				</div>
			) : null}
		</main>
	);
}
