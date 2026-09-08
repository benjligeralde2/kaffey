"use client";

import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { phoneMedia, tabletOrPhoneMedia } from "@/lib/breakpoints";
import { subscribeToOrderUpdates } from "@/lib/order-sync-client";

type Transaction = {
	id: string;
	name: string;
	items: string;
	amount: number;
	time: string;
	paymentMethod: "Cash";
	lineItems: { name: string; quantity: number; price: number }[];
	cashierName: string;
};

function startOfMonth(value: Date) {
	const start = new Date(value);
	start.setDate(1);
	start.setHours(0, 0, 0, 0);
	return start;
}

function peso(amount: number) {
	return `₱${amount.toFixed(2)}`;
}

function formatStamp(time: string) {
	const placedAt = new Date(time);
	if (Number.isNaN(placedAt.getTime())) return { date: time, clock: "", when: time };
	return {
		date: placedAt.toLocaleDateString([], { month: "2-digit", day: "2-digit", year: "numeric" }),
		clock: placedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
		when: placedAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }),
	};
}

function localDateKey(value: Date | string) {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function weekdayLabel(date: Date) {
	return date.toLocaleDateString([], { weekday: "short" });
}

function dateFromKey(key: string) {
	const [year, month, date] = key.split("-").map(Number);
	return new Date(year, month, date);
}

function calendarDays(now: Date) {
	const first = startOfMonth(now);
	const weekday = first.getDay();
	const mondayOffset = weekday === 0 ? 6 : weekday - 1;
	const start = new Date(first);
	start.setDate(first.getDate() - mondayOffset);
	return Array.from({ length: 42 }, (_, index) => {
		const day = new Date(start);
		day.setDate(start.getDate() + index);
		return day;
	});
}

function TransactionCalendar({
	viewMonth,
	today,
	transactions,
	selectedId,
	focusedDayKey,
	openDayKey,
	onSelect,
	onOpenDay,
	onFocusDay,
	compactDays,
}: {
	viewMonth: Date;
	today: Date;
	transactions: Transaction[];
	selectedId: string | null;
	focusedDayKey: string | null;
	openDayKey: string | null;
	onSelect: (id: string) => void;
	onOpenDay: (key: string) => void;
	onFocusDay: (key: string) => void;
	compactDays?: boolean;
}) {
	const days = calendarDays(viewMonth);
	const todayKey = localDateKey(today);
	const currentMonth = viewMonth.getMonth();
	const byDay = useMemo(() => {
		const groups = new Map<string, Transaction[]>();
		for (const transaction of transactions) {
			const key = localDateKey(transaction.time);
			if (!key) continue;
			const list = groups.get(key) ?? [];
			list.push(transaction);
			groups.set(key, list);
		}
		return groups;
	}, [transactions]);

	const daySales = openDayKey ? byDay.get(openDayKey) ?? [] : [];
	const viewTransition = { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const };

	return (
		<div className="history-calendar-stage">
			<AnimatePresence mode="wait" initial={false}>
				{openDayKey ? (
					<motion.div
						key={`day-${openDayKey}`}
						className="history-day-view"
						aria-label={`Transactions on ${dateFromKey(openDayKey).toLocaleDateString()}`}
						initial={{ opacity: 0, x: 28 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: 28 }}
						transition={viewTransition}
					>
						{daySales.length ? (
							<div className="orders-feed history-day-feed" role="list">
								<div className="orders-feed-body">
									{daySales.map((sale) => {
										const stamp = formatStamp(sale.time);
										return (
											<button
												key={sale.id}
												type="button"
												role="listitem"
												className={`order-row${selectedId === sale.id ? " selected" : ""}`}
												aria-pressed={selectedId === sale.id}
												onClick={() => onSelect(sale.id)}
											>
												<span className="order-row-copy">
													<strong>{sale.name}</strong>
													<small>{sale.items}</small>
												</span>
												<strong className="order-row-amount">{peso(sale.amount)}</strong>
												<time className="order-row-time">{stamp.clock}</time>
											</button>
										);
									})}
								</div>
							</div>
						) : (
							<p className="accounts-empty">No transactions on this day.</p>
						)}
					</motion.div>
				) : (
					<motion.div
						key="calendar"
						className="history-calendar"
						role="grid"
						aria-label="Transaction calendar"
						initial={{ opacity: 0, x: -28 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: -28 }}
						transition={viewTransition}
					>
			<div className="history-calendar-weekdays" role="row">
				{days.slice(0, 7).map((day) => (
					<div className="history-calendar-weekday" role="columnheader" key={weekdayLabel(day)}>{weekdayLabel(day)}</div>
				))}
			</div>
			<div className="history-calendar-days">
				{days.map((day) => {
					const key = localDateKey(day);
					const sales = byDay.get(key) ?? [];
					const extra = Math.max(0, sales.length - 3);
					const opensDay = compactDays ? sales.length > 0 : sales.length >= 4;
					const isOutsideMonth = day.getMonth() !== currentMonth;
					const hasSelected = focusedDayKey === key || sales.some((sale) => sale.id === selectedId);
					const openOrSelect = () => {
						if (opensDay) {
							onOpenDay(key);
							return;
						}
						onFocusDay(key);
					};
					return (
						<div
							className={`history-calendar-cell${key === todayKey ? " is-today" : ""}${hasSelected ? " is-selected" : ""}${isOutsideMonth ? " is-outside" : ""}${sales.length ? " has-sales" : ""}${opensDay ? " is-expandable" : " is-selectable"}`}
							key={key}
							role="gridcell"
							onClick={opensDay ? () => onOpenDay(key) : () => onFocusDay(key)}
						>
							<button className="history-calendar-date" type="button" onClick={(event) => { event.stopPropagation(); openOrSelect(); }}>
								<strong>{day.getDate()}</strong>
							</button>
							<ul>
								{sales.slice(0, 3).map((sale) => (
									<li key={sale.id}>
										<button
											type="button"
											className={selectedId === sale.id && !opensDay ? "selected" : undefined}
											onClick={(event) => {
												event.stopPropagation();
												if (opensDay) onOpenDay(key);
												else onSelect(sale.id);
											}}
										>
											<span>{sale.name}</span>
											<em>{peso(sale.amount)}</em>
										</button>
									</li>
								))}
							</ul>
							{extra > 0 ? (
								<button className="history-calendar-more" type="button" onClick={() => onOpenDay(key)}>+{extra} more</button>
							) : null}
						</div>
					);
				})}
			</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

function ReceiptPreview({ transaction }: { transaction: Transaction }) {
	const frameRef = useRef<HTMLDivElement>(null);
	const ticketRef = useRef<HTMLDivElement>(null);
	const [fit, setFit] = useState({ width: 280, height: 360, scale: 1 });

	useLayoutEffect(() => {
		const frame = frameRef.current;
		const ticket = ticketRef.current;
		if (!frame || !ticket) return;
		const update = () => {
			const previous = ticket.style.transform;
			ticket.style.transform = "none";
			const width = ticket.offsetWidth;
			const height = ticket.offsetHeight;
			ticket.style.transform = previous;
			const scale = Math.min(1, frame.clientWidth / Math.max(width, 1), frame.clientHeight / Math.max(height, 1));
			setFit({ width, height, scale: Number.isFinite(scale) && scale > 0 ? Math.max(0.48, scale) : 1 });
		};
		const observer = new ResizeObserver(update);
		observer.observe(frame);
		update();
		return () => observer.disconnect();
	}, [transaction.amount, transaction.id, transaction.lineItems.length]);

	return (
		<div className="history-receipt-preview">
			<div className="history-receipt-fit" ref={frameRef}>
				<div className="history-receipt-scaled" style={{ width: fit.width * fit.scale, height: fit.height * fit.scale }}>
					<div className="order-receipt-print" ref={ticketRef} style={{ transform: `scale(${fit.scale})` }}>
						<ReceiptTicket transaction={transaction} />
					</div>
				</div>
			</div>
			<button className="order-action" type="button" onClick={() => window.print()}>
				<Printer size={15} aria-hidden="true" /> Print receipt
			</button>
		</div>
	);
}

function ReceiptTicket({ transaction }: { transaction: Transaction }) {
	const stamp = formatStamp(transaction.time);
	const itemCount = transaction.lineItems.reduce((sum, item) => sum + item.quantity, 0);
	return (
		<div className="receipt-ticket">
			<div className="receipt-stars">****************************</div>
			<p className="receipt-shop">KAFFEY</p>
			<p className="receipt-tagline">Coffee for the curious</p>
			<div className="receipt-stars">****************************</div>
			<p className="receipt-center">SALES RECEIPT</p>
			<div className="receipt-pairs">
				<p><span>Date</span><span>{stamp.date}</span></p>
				<p><span>Time</span><span>{stamp.clock}</span></p>
				<p><span>Order</span><span>{transaction.id}</span></p>
				<p><span>Cashier</span><span>{transaction.cashierName}</span></p>
				<p><span>Customer</span><span>{transaction.name}</span></p>
			</div>
			<hr className="receipt-dash" />
			<div className="receipt-cols receipt-cols-head"><span>Qty</span><span>Item</span><span>Amount</span></div>
			{transaction.lineItems.map((item, index) => (
				<div className="receipt-line" key={`${item.name}-${index}`}>
					<div className="receipt-cols">
						<span>{item.quantity}</span>
						<span>{item.name}</span>
						<span>{peso(item.price * item.quantity)}</span>
					</div>
					<p className="receipt-unit">{item.quantity} @ {peso(item.price)}</p>
				</div>
			))}
			<hr className="receipt-dash" />
			<div className="receipt-pairs">
				<p><span>Item count</span><span>{itemCount}</span></p>
				<p className="receipt-grand"><span>TOTAL</span><span>{peso(transaction.amount)}</span></p>
			</div>
			<hr className="receipt-dash" />
			<div className="receipt-pairs">
				<p><span>Payment</span><span>{transaction.paymentMethod.toUpperCase()}</span></p>
				<p><span>Amount paid</span><span>{peso(transaction.amount)}</span></p>
			</div>
			<hr className="receipt-dash" />
			<p className="receipt-center">Thank you for visiting</p>
			<p className="receipt-barcode">||| {transaction.id.replace("#", "")} |||</p>
			<div className="receipt-stars">****************************</div>
		</div>
	);
}

export default function HistoryPage() {
	const [transactions, setTransactions] = useState<Transaction[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [openDayKey, setOpenDayKey] = useState<string | null>(null);
	const [focusedDayKey, setFocusedDayKey] = useState<string | null>(null);
	const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
	const [isCompactLayout, setIsCompactLayout] = useState(false);
	const [isPhoneLayout, setIsPhoneLayout] = useState(false);
	const [currentTime, setCurrentTime] = useState<Date | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		setCurrentTime(new Date());
		const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
		const layout = window.matchMedia(tabletOrPhoneMedia);
		const phone = window.matchMedia(phoneMedia);
		const syncLayout = () => {
			setIsCompactLayout(layout.matches);
			setIsPhoneLayout(phone.matches);
		};
		syncLayout();
		layout.addEventListener("change", syncLayout);
		phone.addEventListener("change", syncLayout);
		return () => {
			window.clearInterval(timer);
			layout.removeEventListener("change", syncLayout);
			phone.removeEventListener("change", syncLayout);
		};
	}, []);

	useEffect(() => {
		const loadHistory = async () => {
			try {
				const response = await fetch("/api/orders?mine=true", { cache: "no-store" });
				const payload = await response.json().catch(() => ({}));
				if (!response.ok) throw new Error(payload.error || "Unable to load transactions.");
				setTransactions(Array.isArray(payload.orders) ? payload.orders : []);
				setError("");
			} catch (loadError) {
				setError(loadError instanceof Error ? loadError.message : "Unable to load transactions.");
			} finally {
				setIsLoading(false);
			}
		};
		const unsubscribe = subscribeToOrderUpdates(() => {
			void loadHistory();
		});
		void loadHistory();
		return unsubscribe;
	}, []);

	const visibleTransactions = useMemo(() => {
		const start = startOfMonth(viewMonth);
		const end = new Date(start);
		end.setMonth(end.getMonth() + 1);
		return transactions.filter((transaction) => {
			const placedAt = new Date(transaction.time);
			return placedAt >= start && placedAt < end;
		});
	}, [transactions, viewMonth]);
	const shiftMonth = (offset: number) => {
		setViewMonth((current) => {
			const next = startOfMonth(current);
			next.setMonth(next.getMonth() + offset);
			return next;
		});
		setOpenDayKey(null);
		setFocusedDayKey(null);
	};

	useEffect(() => {
		if (openDayKey && !visibleTransactions.some((transaction) => localDateKey(transaction.time) === openDayKey)) {
			setOpenDayKey(null);
		}
	}, [openDayKey, visibleTransactions]);
	useEffect(() => {
		if (isCompactLayout) {
			if (selectedId && !visibleTransactions.some((transaction) => transaction.id === selectedId)) setSelectedId(null);
			return;
		}
		if (focusedDayKey) {
			const daySales = visibleTransactions.filter((transaction) => localDateKey(transaction.time) === focusedDayKey);
			if (daySales.length === 0) {
				setSelectedId(null);
				return;
			}
			if (selectedId && daySales.some((sale) => sale.id === selectedId)) return;
			setSelectedId(daySales[0].id);
			return;
		}
		if (selectedId && visibleTransactions.some((transaction) => transaction.id === selectedId)) return;
		setSelectedId(visibleTransactions[0]?.id ?? null);
	}, [focusedDayKey, isCompactLayout, selectedId, visibleTransactions]);
	const openDay = (key: string) => {
		setOpenDayKey(key);
		setFocusedDayKey(key);
	};
	const focusDay = (key: string) => {
		const first = visibleTransactions.find((transaction) => localDateKey(transaction.time) === key);
		setFocusedDayKey(key);
		if (isCompactLayout && !first) return;
		setSelectedId(first?.id ?? null);
	};

	const selectedTransaction = visibleTransactions.find((transaction) => transaction.id === selectedId);

	return (
		<section className="pos-catalog history-page" aria-label="Transaction">
			<div className="orders-dashboard-card menu-header-card">
				<div className="orders-dashboard-content">
					<div className="orders-dashboard-heading">
						<div>
							<p>Transaction</p>
							<span>{currentTime?.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}</span>
						</div>
					</div>
					<div className="history-header-summary">
						<div className="history-month-nav">
							<button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)}><ChevronLeft size={16} /></button>
							<p>{viewMonth.toLocaleDateString([], { month: "long", year: "numeric" })}</p>
							<button type="button" aria-label="Next month" onClick={() => shiftMonth(1)}><ChevronRight size={16} /></button>
						</div>
						<span>{visibleTransactions.length} successful sales</span>
					</div>
					<time className="orders-digital-clock" dateTime={currentTime?.toISOString()}>{currentTime?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
				</div>
			</div>

			<div className="history-layout">
					<div className="history-ledger">
						{openDayKey ? (
							<div className="history-ledger-head">
								<div>
									<button className="history-calendar-back" type="button" onClick={() => setOpenDayKey(null)}>
										<ChevronLeft size={16} aria-hidden="true" /> Back
									</button>
									<p>{dateFromKey(openDayKey).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</p>
									<span>{visibleTransactions.filter((transaction) => localDateKey(transaction.time) === openDayKey).length} successful sales</span>
								</div>
							</div>
						) : null}
						<div className="history-table-wrap">
							{isLoading ? (
								<p className="accounts-empty">Loading transactions...</p>
							) : error ? (
								<p className="login-error" role="alert">{error}</p>
							) : (
								<TransactionCalendar
									viewMonth={viewMonth}
									today={currentTime ?? new Date()}
									transactions={visibleTransactions}
									selectedId={selectedId}
									focusedDayKey={focusedDayKey}
									openDayKey={openDayKey}
									compactDays={isPhoneLayout}
									onSelect={(id) => {
										setSelectedId(id);
										const sale = visibleTransactions.find((transaction) => transaction.id === id);
										if (sale) setFocusedDayKey(localDateKey(sale.time));
									}}
									onOpenDay={openDay}
									onFocusDay={focusDay}
								/>
							)}
						</div>
					</div>

					<aside className={`history-receipt-panel${selectedTransaction ? "" : " order-detail-empty"}`} aria-label="Transaction receipt">
						{selectedTransaction ? (
							<ReceiptPreview transaction={selectedTransaction} />
						) : (
							<div className="receipt-placeholder-frame">
								<p className="receipt-placeholder">
									<strong>RECEIPT</strong>
									<span>displays here</span>
								</p>
								<p className="receipt-placeholder-hint">{focusedDayKey && !selectedTransaction ? "No transactions on this day." : "Select a sale from the calendar to preview and print it."}</p>
							</div>
						)}
					</aside>
					<Sheet open={isCompactLayout && Boolean(selectedTransaction)} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
						<SheetContent side="right" className="history-receipt-sheet" aria-label="Transaction receipt">
							<SheetTitle className="sr-only">Receipt</SheetTitle>
							{selectedTransaction ? <ReceiptPreview transaction={selectedTransaction} /> : null}
						</SheetContent>
					</Sheet>
				</div>
		</section>
	);
}
