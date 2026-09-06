"use client";

import { CheckCircle2, Clock3, Receipt, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

export default function HistoryPage() {
	const [transactions, setTransactions] = useState<Transaction[]>([]);
	const [period, setPeriod] = useState<HistoryPeriod>("day");
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		const loadHistory = async () => {
			try {
				const response = await fetch("/api/orders?mine=true", { cache: "no-store" });
				const payload = await response.json().catch(() => ({}));
				if (!response.ok) throw new Error(payload.error || "Unable to load transaction history.");
				setTransactions(Array.isArray(payload.orders) ? payload.orders : []);
			} catch (loadError) {
				setError(loadError instanceof Error ? loadError.message : "Unable to load transaction history.");
			} finally {
				setIsLoading(false);
			}
		};
		void loadHistory();
	}, []);

	const visibleTransactions = useMemo(() => {
		const start = getPeriodStart(period);
		return transactions.filter((transaction) => new Date(transaction.time) >= start);
	}, [period, transactions]);
	const total = visibleTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
	const cashierName = transactions[0]?.cashierName || "Current cashier";

	return (
		<section className="pos-catalog history-page" aria-labelledby="history-title">
			<div className="orders-dashboard-card history-header-card">
				<div className="orders-dashboard-content"><div className="orders-dashboard-heading"><div><p>Transaction history</p><span>{cashierName}</span></div></div><Receipt size={22} aria-hidden="true" /></div>
			</div>
			<div className="history-periods" role="tablist" aria-label="Transaction history period">
				{(["day", "week", "month"] as const).map((option) => <button key={option} type="button" role="tab" aria-selected={period === option} className={period === option ? "active" : undefined} onClick={() => setPeriod(option)}>{option === "day" ? "Daily" : option === "week" ? "Weekly" : "Monthly"}</button>)}
			</div>
			<div className="history-summary-grid">
				<Card className="history-summary-card"><CardContent><span>Successful transactions</span><strong>{visibleTransactions.length}</strong></CardContent></Card>
				<Card className="history-summary-card"><CardContent><span>Total collected</span><strong>₱{total.toFixed(2)}</strong></CardContent></Card>
			</div>
			<Card className="history-transactions-card">
				<CardHeader><div><CardTitle>{period === "day" ? "Today" : period === "week" ? "This week" : "This month"}</CardTitle><p className="orders-list-count">Cashier transactions marked successful</p></div></CardHeader>
				<CardContent className="history-transaction-list">
					{isLoading ? <p className="accounts-empty">Loading transactions...</p> : error ? <p className="login-error" role="alert">{error}</p> : visibleTransactions.length === 0 ? <p className="accounts-empty">No successful transactions for this period.</p> : visibleTransactions.map((transaction) => <article className="history-transaction-row" key={transaction.id}><span className="history-transaction-avatar"><UserRound size={16} aria-hidden="true" /></span><div><strong>{transaction.name}</strong><span>{transaction.id} · {transaction.items}</span><small><Clock3 size={12} aria-hidden="true" /> {new Date(transaction.time).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</small></div><div className="history-transaction-result"><span><CheckCircle2 size={14} aria-hidden="true" /> Successful</span><strong>₱{transaction.amount.toFixed(2)}</strong></div></article>)}
				</CardContent>
			</Card>
		</section>
	);
}
