"use client";

import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Minus, Plus, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";

import { Button } from "@/components/ui/button";
import { useBrewingReady } from "@/components/brewing-loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { isPhoneWidth, isTabletWidth } from "@/lib/breakpoints";
import { notifyOrderRecordedLocally, notifyOrderRecordedRemotely } from "@/lib/order-sync-client";
import { subscribeToProductUpdates } from "@/lib/product-sync-client";

type MenuItem = {
	id: string;
	name: string;
	category: "Coffee" | "Tea" | "Refreshers";
	description: string;
	price: number;
	image: string;
	tag?: string;
};

const categories = ["All", "Coffee", "Tea", "Refreshers"] as const;
const subscribeToResize = (onStoreChange: () => void) => {
	window.addEventListener("resize", onStoreChange);
	return () => window.removeEventListener("resize", onStoreChange);
};
const getMobileSnapshot = () => isPhoneWidth(window.innerWidth);
const getTabletSnapshot = () => isTabletWidth(window.innerWidth);
const getNarrowTabletSnapshot = () => window.innerWidth >= 768 && window.innerWidth <= 900;
const getServerSnapshot = () => false;

export default function MenusPage() {
	const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>("All");
	const [search, setSearch] = useState("");
	const [currentPage, setCurrentPage] = useState(1);
	const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
	const [isLoadingProducts, setIsLoadingProducts] = useState(true);
	const [order, setOrder] = useState<Record<string, number>>({});
	const [customerName, setCustomerName] = useState("");
	const [isOrderOpen, setIsOrderOpen] = useState(false);
	const [isChargeModalOpen, setIsChargeModalOpen] = useState(false);
	const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
	const [isClearOrderModalOpen, setIsClearOrderModalOpen] = useState(false);
	const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
	const [paymentMethod, setPaymentMethod] = useState("Cash");
	const [isRecordingPayment, setIsRecordingPayment] = useState(false);
	const [paymentError, setPaymentError] = useState("");
	const [dragStartY, setDragStartY] = useState<number | null>(null);
	const [dragOffset, setDragOffset] = useState(0);
	const [currentTime, setCurrentTime] = useState<Date | null>(null);
	const [canScrollOrderDown, setCanScrollOrderDown] = useState(false);
	const orderListRef = useRef<HTMLDivElement>(null);
	const isMobile = useSyncExternalStore(subscribeToResize, getMobileSnapshot, getServerSnapshot);
	const isTablet = useSyncExternalStore(subscribeToResize, getTabletSnapshot, getServerSnapshot);
	const isNarrowTablet = useSyncExternalStore(subscribeToResize, getNarrowTabletSnapshot, getServerSnapshot);
	const productsPerPage = isMobile || isNarrowTablet ? 6 : isTablet ? 8 : 10;
	useBrewingReady(!isLoadingProducts);
	useEffect(() => { setCurrentTime(new Date()); const timer = window.setInterval(() => setCurrentTime(new Date()), 1000); return () => window.clearInterval(timer); }, []);
	useEffect(() => {
		let cancelled = false;
		let timeoutId = 0;
		const loadProducts = async () => {
			const startedAt = Date.now();
			try {
				const response = await fetch(`/api/products?t=${Date.now()}`, { cache: "no-store" });
				const payload = await response.json().catch(() => ({}));
				if (!cancelled && response.ok && Array.isArray(payload.products)) setMenuItems(payload.products);
			} catch { }
			finally {
				if (cancelled) return;
				const remaining = Math.max(0, 1400 - (Date.now() - startedAt));
				timeoutId = window.setTimeout(() => {
					if (!cancelled) setIsLoadingProducts(false);
				}, remaining);
			}
		};
		void loadProducts();
		return () => {
			cancelled = true;
			window.clearTimeout(timeoutId);
		};
	}, []);

	useEffect(() => {
		const refreshProducts = async () => {
			try {
				const response = await fetch(`/api/products?t=${Date.now()}`, { cache: "no-store" });
				const payload = await response.json().catch(() => ({}));
				if (!response.ok || !Array.isArray(payload.products)) return;
				const nextItems = payload.products as MenuItem[];
				setMenuItems(nextItems);
				setSelectedMenuItem((current) => {
					if (!current) return current;
					return nextItems.find((item) => item.id === current.id) ?? null;
				});
				setOrder((current) => {
					const nextOrder = { ...current };
					Object.keys(nextOrder).forEach((id) => {
						if (!nextItems.some((item) => item.id === id)) delete nextOrder[id];
					});
					return nextOrder;
				});
			} catch {
				return;
			}
		};
		return subscribeToProductUpdates(() => {
			void refreshProducts();
		});
	}, []);

	const visibleItems = useMemo(() => {
		const categoryItems = activeCategory === "All" ? menuItems : menuItems.filter((item) => item.category === activeCategory);
		return categoryItems.filter((item) => `${item.name} ${item.description}`.toLowerCase().includes(search.toLowerCase()));
	}, [activeCategory, menuItems, search]);
	useEffect(() => {
		setCurrentPage(1);
	}, [productsPerPage]);
	const totalPages = Math.max(1, Math.ceil(visibleItems.length / productsPerPage));
	const safePage = Math.min(currentPage, totalPages);
	const paginatedItems = visibleItems.slice((safePage - 1) * productsPerPage, safePage * productsPerPage);
	const searchSuggestions = search.trim() ? menuItems.filter((item) => `${item.name} ${item.description}`.toLowerCase().includes(search.toLowerCase().trim())).slice(0, 5) : [];

	const orderItems = menuItems.filter((item) => order[item.id]);
	const subtotal = orderItems.reduce((total, item) => total + item.price * order[item.id], 0);
	const total = subtotal;

	const updateOrderScrollHint = useCallback(() => {
		const list = orderListRef.current;
		if (!list) {
			setCanScrollOrderDown(false);
			return;
		}
		setCanScrollOrderDown(list.scrollHeight - list.clientHeight - list.scrollTop > 8);
	}, []);

	useEffect(() => {
		const list = orderListRef.current;
		if (!list) return;
		updateOrderScrollHint();
		const observer = new ResizeObserver(() => updateOrderScrollHint());
		observer.observe(list);
		if (list.parentElement) observer.observe(list.parentElement);
		window.addEventListener("resize", updateOrderScrollHint);
		return () => {
			observer.disconnect();
			window.removeEventListener("resize", updateOrderScrollHint);
		};
	}, [isOrderOpen, orderItems.length, updateOrderScrollHint]);

	const recordCashPayment = async () => {
		if (paymentMethod !== "Cash" || !customerName.trim() || !orderItems.length) return;
		setIsRecordingPayment(true);
		setPaymentError("");
		try {
			const response = await fetch("/api/orders", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					customerName,
					amount: total,
					paymentMethod: "Cash",
					lineItems: orderItems.map((item) => ({ name: item.name, detail: item.category, quantity: order[item.id], price: item.price, image: item.image })),
				}),
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(payload.error || "Unable to record payment.");
			setOrder({});
			setCustomerName("");
			setIsPaymentMethodModalOpen(false);
			setPaymentMethod("Cash");
			notifyOrderRecordedLocally();
			void notifyOrderRecordedRemotely();
		} catch (error) {
			setPaymentError(error instanceof Error ? error.message : "Unable to record payment.");
		} finally {
			setIsRecordingPayment(false);
		}
	};

	const updateQuantity = (id: string, change: number) => {
		setOrder((currentOrder) => {
			const nextQuantity = (currentOrder[id] || 0) + change;
			const nextOrder = { ...currentOrder };
			if (nextQuantity > 0) nextOrder[id] = nextQuantity;
			else delete nextOrder[id];
			return nextOrder;
		});
	};

	const handleOrderDragStart = (event: PointerEvent<HTMLDivElement>) => {
		event.currentTarget.setPointerCapture(event.pointerId);
		setDragStartY(event.clientY);
	};
	const handleOrderDragMove = (event: PointerEvent<HTMLDivElement>) => {
		if (dragStartY === null) return;
		setDragOffset(Math.max(0, event.clientY - dragStartY));
	};
	const handleOrderDragEnd = () => {
		if (dragOffset > 80) setIsOrderOpen(false);
		setDragStartY(null);
		setDragOffset(0);
	};

	return (
		<section className="pos-catalog menus-page" aria-label="Coffee menu">
			<div className="orders-dashboard-card menu-header-card">
				<div className="orders-dashboard-content">
					<div className="orders-dashboard-heading">
						<div>
							<p>Menu</p>
							<span>{currentTime?.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}</span>
						</div>
					</div>
					<nav className="order-status-filters" aria-label="Menu categories">
						{categories.map((category) => (
							<button aria-pressed={activeCategory === category} className={activeCategory === category ? "active" : undefined} key={category} type="button" onClick={() => { setActiveCategory(category); if (category === "All") setSearch(""); setCurrentPage(1); }}>{category}</button>
						))}
					</nav>
					<div className="menu-header-tools">
						<div className="menu-search-wrap">
							<label className="pos-search orders-search" htmlFor="menu-search">
								<Search size={16} />
								<input id="menu-search" type="search" value={search} onChange={(event) => { setSearch(event.target.value); setCurrentPage(1); }} placeholder="Search the menu" />
							</label>
							{searchSuggestions.length > 0 && (
								<div className="menu-search-suggestions" role="listbox" aria-label="Menu suggestions">
									{searchSuggestions.map((item) => (
										<button key={item.id} type="button" role="option" onClick={() => { setSearch(item.name); setCurrentPage(1); }}>
											<span>{item.name}</span>
											<small>{item.category}</small>
										</button>
									))}
								</div>
							)}
						</div>
						<label className="menu-filter-dropdown" htmlFor="menu-category-filter">
							<select id="menu-category-filter" value={activeCategory} aria-label="Menu categories" onChange={(event) => { const category = event.target.value as (typeof categories)[number]; setActiveCategory(category); if (category === "All") setSearch(""); setCurrentPage(1); }}>
								{categories.map((category) => (
									<option key={category} value={category}>{category}</option>
								))}
							</select>
							<ChevronDown size={14} aria-hidden />
						</label>
					</div>
					<time className="orders-digital-clock" dateTime={currentTime?.toISOString()}>{currentTime?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
				</div>
			</div>
			<div className="pos-catalog-layout">
				<div className="pos-menu-column">
					<div className="pos-menu-grid" aria-busy={isLoadingProducts} aria-live="polite">
						{isLoadingProducts ? Array.from({ length: productsPerPage }, (_, index) => (
							<Card className="pos-menu-card pos-menu-card-skeleton" key={`menu-skeleton-${index}`} aria-hidden="true">
								<div className="pos-menu-card-desktop">
									<div className="pos-menu-art"><Skeleton className="menu-skeleton-image" /></div>
									<Skeleton className="pos-menu-price menu-skeleton-price" />
									<CardContent className="pos-menu-card-copy">
										<div className="pos-menu-card-bottom">
											<Skeleton className="menu-skeleton-title" />
											<Skeleton className="menu-skeleton-button" />
										</div>
									</CardContent>
								</div>
								<div className="pos-menu-art pos-menu-card-mobile"><Skeleton className="menu-skeleton-image" /></div>
							</Card>
						)) : paginatedItems.map((item) => <Card className="pos-menu-card" key={item.id}>
							{item.tag ? <b className="pos-menu-tag"><span>{item.tag}</span></b> : null}
							<div className="pos-menu-card-desktop"><div className="pos-menu-art"><img src={item.image} alt={item.name} /></div><strong className="pos-menu-price">₱{item.price.toFixed(2)}</strong><CardContent className="pos-menu-card-copy"><div className="pos-menu-card-bottom"><CardHeader className="p-0"><CardTitle><h2>{item.name}</h2></CardTitle></CardHeader><Button aria-label={order[item.id] ? `Add another ${item.name} to cart` : `Add ${item.name} to cart`} aria-pressed={Boolean(order[item.id])} className={order[item.id] ? "product-added" : undefined} size="icon" type="button" onClick={() => updateQuantity(item.id, 1)}>{order[item.id] ? <CheckCircle2 size={14} /> : <Plus size={14} />}</Button></div></CardContent></div>
							<button className="pos-menu-art pos-menu-card-mobile" type="button" aria-label={`View details for ${item.name}`} onClick={() => setSelectedMenuItem(item)}><img src={item.image} alt={item.name} /><span className="pos-menu-name-badge">{item.name}</span></button>
						</Card>)}
					</div>
					{!isLoadingProducts && totalPages > 1 && <nav className="pos-pagination" aria-label="Product pages"><button aria-label="Previous product page" disabled={safePage === 1} type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}><ChevronLeft size={16} /></button><span aria-live="polite">Page {safePage} of {totalPages}</span><button aria-label="Next product page" disabled={safePage === totalPages} type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}><ChevronRight size={16} /></button></nav>}
					{!isLoadingProducts && visibleItems.length === 0 && <div className="products-empty-state menu-products-empty-state"><div className="products-empty-art"><img src="/coffees/teacup.png" alt="" /></div><strong>No coffee found</strong><p>Try another search or choose a different category.</p></div>}
				</div>

				<Card className={`pos-order-panel${isOrderOpen ? " is-open" : ""}${dragStartY !== null ? " is-dragging" : ""}`} style={isOrderOpen ? { transform: `translateY(${dragOffset}px)` } : undefined}>
					<div className="order-sheet-grab" onPointerDown={handleOrderDragStart} onPointerMove={handleOrderDragMove} onPointerUp={handleOrderDragEnd} aria-label="Drag down to close order summary"><span /></div>
					<CardHeader className="order-panel-heading p-0"><div><CardTitle><h2><input className="order-customer-name" type="text" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Customer name" aria-label="Customer name" required /></h2></CardTitle></div></CardHeader>
					<CardContent className="p-0">
						<div className="order-items-wrap">
							<div className="order-items" ref={orderListRef} onScroll={updateOrderScrollHint}>
								{orderItems.length === 0 ? (
									<div className="products-empty-state order-empty-state">
										<div className="products-empty-art"><img src="/coffees/teacup.png" alt="" /></div>
										<strong>No items yet</strong>
										<p>Add drinks from the menu to show the order here.</p>
									</div>
								) : orderItems.map((item) => (
									<div className="order-item" key={item.id}>
										<div className="order-item-details">
											<strong>{item.name}</strong>
										</div>
										<span className="order-item-price">₱{(item.price * order[item.id]).toFixed(2)}</span>
										<div className="quantity-control">
											<button type="button" onClick={() => updateQuantity(item.id, -1)} aria-label={`Remove one ${item.name}`}><Minus size={12} /></button>
											<span>{order[item.id]}</span>
											<button type="button" onClick={() => updateQuantity(item.id, 1)} aria-label={`Add one ${item.name}`}><Plus size={12} /></button>
										</div>
									</div>
								))}
							</div>
							{canScrollOrderDown && <div className="order-scroll-indicator" aria-hidden="true"><ChevronDown size={18} /></div>}
						</div>
						<div className="order-footer"><div className="order-totals"><div className="order-total"><span>Total</span><strong>₱{total.toFixed(2)}</strong></div></div><div className="order-footer-actions"><button className="clear-order" type="button" onClick={() => setIsClearOrderModalOpen(true)} disabled={!orderItems.length}><Trash2 size={14} /> Clear</button><Button className="pay-button" type="button" disabled={!orderItems.length || !customerName.trim()} onClick={() => setIsChargeModalOpen(true)}>Confirm Order</Button></div></div>
					</CardContent>
				</Card>
			</div>
			{isMobile && selectedMenuItem && <div className="menu-detail-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedMenuItem(null); }}><section className="menu-detail-modal" role="dialog" aria-modal="true" aria-labelledby="menu-detail-title"><button className="charge-modal-close" type="button" aria-label="Close product details" onClick={() => setSelectedMenuItem(null)}><X size={18} /></button><div className="menu-detail-image"><img src={selectedMenuItem.image} alt={selectedMenuItem.name} /></div><p className="pos-kicker">{selectedMenuItem.category}{selectedMenuItem.tag && ` · ${selectedMenuItem.tag}`}</p><h2 id="menu-detail-title">{selectedMenuItem.name}</h2><p className="menu-detail-description">{selectedMenuItem.description}</p><div className="menu-detail-footer"><strong>₱{selectedMenuItem.price.toFixed(2)}</strong><Button aria-label={`Add ${selectedMenuItem.name} to cart`} aria-pressed={Boolean(order[selectedMenuItem.id])} className={order[selectedMenuItem.id] ? "product-added" : undefined} size="icon" type="button" onClick={() => updateQuantity(selectedMenuItem.id, 1)}>{order[selectedMenuItem.id] ? <CheckCircle2 size={18} /> : <Plus size={18} />}</Button></div></section></div>}
			{isClearOrderModalOpen && <div className="charge-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsClearOrderModalOpen(false); }}><section className="charge-modal clear-order-modal" role="dialog" aria-modal="true" aria-labelledby="clear-order-title"><button className="charge-modal-close" type="button" aria-label="Close clear order confirmation" onClick={() => setIsClearOrderModalOpen(false)}><X size={18} /></button><p className="pos-kicker" id="clear-order-title">Clear order</p><p className="clear-order-message">All items will be removed from the current order.</p><div className="clear-order-actions"><button type="button" onClick={() => setIsClearOrderModalOpen(false)}>Keep order</button><Button type="button" onClick={() => { setOrder({}); setCustomerName(""); setIsClearOrderModalOpen(false); }}>Clear order</Button></div></section></div>}
			<button className="mobile-order-backdrop" type="button" aria-label="Close current order summary" onClick={() => setIsOrderOpen(false)} />
			<button className={`mobile-order-trigger${isOrderOpen ? " is-hidden" : ""}`} type="button" aria-label="Open current order summary" onClick={() => setIsOrderOpen(true)}><ShoppingCart size={23} /><span>{orderItems.length}</span></button>
			{isChargeModalOpen && <div className="charge-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsChargeModalOpen(false); }}><section className="charge-modal order-summary-modal" role="dialog" aria-modal="true" aria-labelledby="charge-modal-title"><button className="charge-modal-close" type="button" aria-label="Close order confirmation" onClick={() => setIsChargeModalOpen(false)}><X size={18} /></button><p className="pos-kicker" id="charge-modal-title">Order summary</p><p className="charge-modal-item-summary"><strong>{orderItems.length} {orderItems.length === 1 ? "item" : "items"}</strong><span>{orderItems.map((item) => `${order[item.id]} × ${item.name}`).join(" · ")}</span></p><div className="charge-modal-totals"><div className="charge-modal-total"><span>Total</span><strong>₱{total.toFixed(2)}</strong></div></div><Button className="charge-confirm-button" type="button" onClick={() => { setIsChargeModalOpen(false); setIsPaymentMethodModalOpen(true); }}>Continue to payment</Button></section></div>}
			{isPaymentMethodModalOpen && <div className="charge-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsPaymentMethodModalOpen(false); }}><section className="charge-modal payment-method-modal" role="dialog" aria-modal="true" aria-labelledby="payment-method-title"><button className="charge-modal-close" type="button" aria-label="Close payment options" onClick={() => setIsPaymentMethodModalOpen(false)}><X size={18} /></button><p className="pos-kicker" id="payment-method-title">Payment method</p><div className="payment-methods" role="radiogroup" aria-label="Payment methods">{["Cash", "Card", "GCash"].map((method) => { const isCash = method === "Cash"; return <button className={`payment-method-option${paymentMethod === method ? " selected" : ""}`} key={method} type="button" role="radio" aria-checked={paymentMethod === method} disabled={!isCash} onClick={() => setPaymentMethod(method)}><span className="payment-method-icon">{method === "Cash" ? "₱" : method === "Card" ? "▣" : "G"}</span><span><strong>{method}</strong><small>{isCash ? "Collect cash at the table" : "Coming soon"}</small></span><i /></button>; })}</div>{paymentError && <p className="payment-error" role="alert">{paymentError}</p>}<div className="payment-method-total"><span>Amount due</span><strong>₱{total.toFixed(2)}</strong></div><Button className="charge-confirm-button" type="button" disabled={isRecordingPayment} onClick={recordCashPayment}>{isRecordingPayment ? "Recording..." : "Record Cash payment"}</Button></section></div>}
		</section>
	);
}
