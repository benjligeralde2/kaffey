"use client";

import { Printer, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { subscribeToOrderUpdates } from "@/lib/order-sync-client";

type HistoryPeriod = "day" | "week" | "month";
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

function getPeriodStart(period: HistoryPeriod) {
	const start = new Date();
	start.setHours(0, 0, 0, 0);
	if (period === "day") return start;
	if (period === "month") {
		start.setDate(1);
		return start;
	}
	const day = start.getDay();
	start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
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

function periodLabel(period: HistoryPeriod) {
	if (period === "day") return "Today";
	if (period === "week") return "This week";
	return "This month";
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
	const [period, setPeriod] = useState<HistoryPeriod>("day");
	const [search, setSearch] = useState("");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [currentTime, setCurrentTime] = useState<Date | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		setCurrentTime(new Date());
		const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
		return () => window.clearInterval(timer);
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
		const start = getPeriodStart(period);
		const query = search.toLowerCase().trim();
		return transactions.filter((transaction) => {
			if (new Date(transaction.time) < start) return false;
			if (!query) return true;
			return `${transaction.id} ${transaction.name} ${transaction.items}`.toLowerCase().includes(query);
		});
	}, [period, search, transactions]);

	useEffect(() => {
		if (selectedId && visibleTransactions.some((transaction) => transaction.id === selectedId)) return;
		setSelectedId(visibleTransactions[0]?.id ?? null);
	}, [selectedId, visibleTransactions]);

	const total = visibleTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
	const selectedTransaction = visibleTransactions.find((transaction) => transaction.id === selectedId);

	return (
		<section className="pos-catalog" aria-label="Transaction">
			<div className="orders-dashboard-card menu-header-card">
				<div className="orders-dashboard-content">
					<div className="orders-dashboard-heading">
						<div>
							<p>Transaction</p>
							<span>{currentTime?.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}</span>
						</div>
					</div>
					<div className="menu-search-wrap">
						<label className="pos-search orders-search" htmlFor="transaction-search">
							<Search size={16} />
							<input id="transaction-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search transactions" />
						</label>
					</div>
					<time className="orders-digital-clock" dateTime={currentTime?.toISOString()}>{currentTime?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
				</div>
			</div>

			<div className="history-page">
				<div className="history-toolbar">
					<div className="history-periods" role="tablist" aria-label="Transaction period">
						{(["day", "week", "month"] as const).map((option) => (
							<button key={option} type="button" role="tab" aria-selected={period === option} className={period === option ? "active" : undefined} onClick={() => setPeriod(option)}>
								{option === "day" ? "Daily" : option === "week" ? "Weekly" : "Monthly"}
							</button>
						))}
					</div>
					<div className="history-metrics">
						<p><small>Sales</small><strong>{visibleTransactions.length}</strong></p>
						<p><small>Collected</small><strong>{peso(total)}</strong></p>
					</div>
				</div>

				<div className="history-layout">
					<div className="history-ledger">
						<div className="history-ledger-head">
							<div>
								<p>{periodLabel(period)}</p>
								<span>{visibleTransactions.length} successful sales</span>
							</div>
						</div>
						<div className="history-table-wrap">
							{isLoading ? (
								<p className="accounts-empty">Loading transactions...</p>
							) : error ? (
								<p className="login-error" role="alert">{error}</p>
							) : visibleTransactions.length === 0 ? (
								<p className="accounts-empty">No successful transactions for this period.</p>
							) : (
								<table className="history-table">
									<thead>
										<tr>
											<th>Time</th>
											<th>Order</th>
											<th>Customer</th>
											<th>Items</th>
											<th>Pay</th>
											<th>Total</th>
										</tr>
									</thead>
									<tbody>
										{visibleTransactions.map((transaction) => {
											const stamp = formatStamp(transaction.time);
											return (
												<tr
													key={transaction.id}
													className={selectedId === transaction.id ? "selected" : undefined}
													tabIndex={0}
													aria-selected={selectedId === transaction.id}
													onClick={() => setSelectedId(transaction.id)}
													onKeyDown={(event) => {
														if (event.key === "Enter" || event.key === " ") {
															event.preventDefault();
															setSelectedId(transaction.id);
														}
													}}
												>
													<td>{stamp.clock}</td>
													<td>{transaction.id}</td>
													<td>{transaction.name}</td>
													<td>{transaction.items}</td>
													<td>{transaction.paymentMethod}</td>
													<td>{peso(transaction.amount)}</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							)}
						</div>
					</div>

					<aside className={`order-detail-panel${selectedTransaction ? "" : " order-detail-empty"}`} aria-label="Transaction receipt">
						{selectedTransaction ? (
							<>
								<div className="order-receipt-print">
									<ReceiptTicket transaction={selectedTransaction} />
								</div>
								<button className="order-action" type="button" onClick={() => window.print()}>
									<Printer size={15} aria-hidden="true" /> Print receipt
								</button>
							</>
						) : (
							<div className="receipt-placeholder-frame">
								<p className="receipt-placeholder">
									<strong>RECEIPT</strong>
									<span>displays here</span>
								</p>
								<p className="receipt-placeholder-hint">Select a sale from the ledger to preview and print it.</p>
							</div>
						)}
					</aside>
				</div>
			</div>
		</section>
	);
}
