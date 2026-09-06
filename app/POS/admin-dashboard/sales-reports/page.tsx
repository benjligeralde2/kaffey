"use client";

import { ArrowDownRight, ArrowUpRight, BarChart3, Download, Printer } from "lucide-react";
import { jsPDF } from "jspdf";
import { useEffect, useMemo, useState } from "react";

import { toastError, toastSuccess } from "@/components/ui/sonner";
import { subscribeToOrderUpdates } from "@/lib/order-sync-client";

type ReportPeriod = "daily" | "weekly" | "monthly";
type ReportScope = "overall" | "individual";

type SalesOrder = {
	amount: number;
	time: string;
	cashierId?: string;
	cashierName: string;
};

type CashierOption = {
	id: string;
	name: string;
};

type ReportRow = {
	label: string;
	orders: number;
	sales: number;
};

type Bucket = {
	label: string;
	start: Date;
	end: Date;
};

const peso = (value: number) => `₱${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const startOfDay = (date: Date) => {
	const next = new Date(date);
	next.setHours(0, 0, 0, 0);
	return next;
};

const addDays = (date: Date, amount: number) => {
	const next = new Date(date);
	next.setDate(next.getDate() + amount);
	return next;
};

const startOfWeek = (date: Date) => {
	const next = startOfDay(date);
	const weekday = next.getDay();
	next.setDate(next.getDate() + (weekday === 0 ? -6 : 1 - weekday));
	return next;
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const addMonths = (date: Date, amount: number) => new Date(date.getFullYear(), date.getMonth() + amount, 1);

const buildBuckets = (period: ReportPeriod, now = new Date()): Bucket[] => {
	if (period === "daily") {
		const today = startOfDay(now);
		return Array.from({ length: 7 }, (_, index) => {
			const start = addDays(today, index - 6);
			return {
				label: start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
				start,
				end: addDays(start, 1),
			};
		});
	}

	if (period === "weekly") {
		const weekStart = startOfWeek(now);
		return Array.from({ length: 4 }, (_, index) => {
			const start = addDays(weekStart, (index - 3) * 7);
			const end = addDays(start, 7);
			return {
				label: `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${addDays(end, -1).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
				start,
				end,
			};
		});
	}

	const monthStart = startOfMonth(now);
	return Array.from({ length: 6 }, (_, index) => {
		const start = addMonths(monthStart, index - 5);
		return {
			label: start.toLocaleDateString(undefined, { month: "short", year: "numeric" }),
			start,
			end: addMonths(start, 1),
		};
	});
};

const summarizeOrders = (orders: SalesOrder[], start: Date, end: Date) => (
	orders.reduce((totals, order) => {
		const timestamp = new Date(order.time).getTime();
		if (Number.isNaN(timestamp) || timestamp < start.getTime() || timestamp >= end.getTime()) return totals;
		return { orders: totals.orders + 1, sales: totals.sales + order.amount };
	}, { orders: 0, sales: 0 })
);

const formatChange = (current: number, previous: number) => {
	if (previous === 0 && current === 0) return { label: "No previous period to compare", isDown: false };
	if (previous === 0) return { label: "No comparable prior period", isDown: false };
	const percent = ((current - previous) / previous) * 100;
	return {
		label: `${percent > 0 ? "+" : ""}${percent.toFixed(1)}% vs previous period`,
		isDown: percent < 0,
	};
};

export default function SalesReportsPage() {
	const [period, setPeriod] = useState<ReportPeriod>("weekly");
	const [scope, setScope] = useState<ReportScope>("overall");
	const [cashiers, setCashiers] = useState<CashierOption[]>([]);
	const [selectedCashierId, setSelectedCashierId] = useState("");
	const [orders, setOrders] = useState<SalesOrder[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState("");
	const selectedCashier = cashiers.find((cashier) => cashier.id === selectedCashierId);
	const reportSubject = scope === "overall" ? "All accounts" : selectedCashier?.name || "Selected cashier";

	const scopedOrders = useMemo(() => {
		if (scope !== "individual") return orders;
		return orders.filter((order) => {
			if (selectedCashier?.id.startsWith("name:")) return order.cashierName === selectedCashier.name;
			return order.cashierId === selectedCashierId || (!order.cashierId && order.cashierName === selectedCashier?.name);
		});
	}, [orders, scope, selectedCashier, selectedCashierId]);

	const report = useMemo(() => {
		const buckets = buildBuckets(period);
		const rows: ReportRow[] = buckets.map((bucket) => {
			const totals = summarizeOrders(scopedOrders, bucket.start, bucket.end);
			return { label: bucket.label, orders: totals.orders, sales: totals.sales };
		});
		const totalSales = rows.reduce((total, row) => total + row.sales, 0);
		const totalOrders = rows.reduce((total, row) => total + row.orders, 0);
		const averageOrder = totalOrders ? totalSales / totalOrders : 0;
		const windowStart = buckets[0]?.start;
		const windowEnd = buckets[buckets.length - 1]?.end;
		const previous = windowStart && windowEnd
			? summarizeOrders(scopedOrders, new Date(windowStart.getTime() - (windowEnd.getTime() - windowStart.getTime())), windowStart)
			: { orders: 0, sales: 0 };
		const previousAverage = previous.orders ? previous.sales / previous.orders : 0;
		return {
			rows,
			totalSales,
			totalOrders,
			averageOrder,
			salesChange: formatChange(totalSales, previous.sales),
			ordersChange: formatChange(totalOrders, previous.orders),
			averageChange: formatChange(averageOrder, previousAverage),
		};
	}, [period, scopedOrders]);

	useEffect(() => {
		const loadReportData = async () => {
			try {
				const [ordersResponse, accountsResponse] = await Promise.all([fetch("/api/orders"), fetch("/api/accounts")]);
				const ordersPayload = await ordersResponse.json().catch(() => ({}));
				const accountsPayload = await accountsResponse.json().catch(() => ({}));
				if (!ordersResponse.ok) throw new Error(ordersPayload.error || "Unable to load sales orders.");

				const loadedOrders: SalesOrder[] = (Array.isArray(ordersPayload.orders) ? ordersPayload.orders : []).map((order: SalesOrder) => ({
					amount: Number(order.amount) || 0,
					time: order.time,
					cashierId: order.cashierId,
					cashierName: order.cashierName || "Unknown cashier",
				}));
				setOrders(loadedOrders);

				const accountCashiers: CashierOption[] = Array.isArray(accountsPayload.accounts)
					? accountsPayload.accounts
						.filter((account: { role?: string; id?: string; name?: string }) => account.role?.toLowerCase() === "cashier" && account.id && account.name)
						.map((account: { id: string; name: string }) => ({ id: account.id, name: account.name }))
					: [];
				const cashiersById = new Map(accountCashiers.map((cashier) => [cashier.id, cashier]));
				loadedOrders.forEach((order) => {
					if (order.cashierId && !cashiersById.has(order.cashierId)) {
						cashiersById.set(order.cashierId, { id: order.cashierId, name: order.cashierName });
					}
					if (!order.cashierId && order.cashierName && ![...cashiersById.values()].some((cashier) => cashier.name === order.cashierName)) {
						cashiersById.set(`name:${order.cashierName}`, { id: `name:${order.cashierName}`, name: order.cashierName });
					}
				});
				const nextCashiers = [...cashiersById.values()];
				setCashiers(nextCashiers);
				setSelectedCashierId((currentId) => nextCashiers.some((cashier) => cashier.id === currentId) ? currentId : nextCashiers[0]?.id || "");
				setLoadError("");
			} catch (error) {
				const message = error instanceof Error ? error.message : "Unable to load sales reports.";
				setLoadError(message);
				toastError(message);
			} finally {
				setIsLoading(false);
			}
		};

		void loadReportData();
		const unsubscribe = subscribeToOrderUpdates(() => {
			void loadReportData();
		});
		return () => unsubscribe();
	}, []);

	const handlePrint = () => window.print();
	const handleDownload = () => {
		if (isLoading) return;
		const pdf = new jsPDF();
		pdf.setTextColor(38, 50, 52);
		pdf.setFontSize(10);
		pdf.text("KAFFEY ADMIN", 20, 22);
		pdf.setFontSize(24);
		pdf.text("Sales Report", 20, 36);
		pdf.setFontSize(11);
		pdf.setTextColor(111, 121, 113);
		pdf.text(`${reportSubject} - ${period.charAt(0).toUpperCase() + period.slice(1)} summary`, 20, 45);
		pdf.setTextColor(38, 50, 52);
		pdf.setFontSize(11);
		pdf.text(`Total sales: PHP ${report.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 20, 60);
		pdf.text(`Total orders: ${report.totalOrders.toLocaleString()}`, 20, 68);
		pdf.text(`Average order: PHP ${report.averageOrder.toFixed(2)}`, 20, 76);
		pdf.setDrawColor(223, 225, 217);
		pdf.line(20, 84, 190, 84);
		pdf.setFontSize(10);
		pdf.setTextColor(137, 145, 138);
		pdf.text("PERIOD", 20, 94);
		pdf.text("ORDERS", 115, 94, { align: "right" });
		pdf.text("TOTAL SALES", 190, 94, { align: "right" });
		report.rows.forEach((row, index) => {
			const y = 106 + index * 14;
			pdf.setDrawColor(236, 236, 229);
			pdf.line(20, y + 5, 190, y + 5);
			pdf.setTextColor(38, 50, 52);
			pdf.text(row.label, 20, y);
			pdf.text(row.orders.toLocaleString(), 115, y, { align: "right" });
			pdf.text(`PHP ${row.sales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 190, y, { align: "right" });
		});
		try {
			pdf.save(`kaffey-${scope}-${period}-sales-report.pdf`);
			toastSuccess("Sales report downloaded.");
		} catch (error) {
			toastError(error instanceof Error ? error.message : "Unable to download the sales report.");
		}
	};

	return (
		<section className="pos-catalog sales-reports-page" aria-labelledby="sales-reports-title">
			<div className="sales-reports-heading">
				<div>
					<p className="pos-kicker">Performance overview</p>
					<h1 id="sales-reports-title">Sales Reports</h1>
					<p className="sales-reports-intro">Track revenue and order activity {scope === "overall" ? "across the Kaffey counter" : `for ${selectedCashier?.name || "the selected cashier"}`}.</p>
				</div>
				<div className="sales-report-controls">
					<div className="sales-report-scope" aria-label="Report scope">
						<button type="button" className={scope === "overall" ? "active" : undefined} onClick={() => setScope("overall")}>Overall</button>
						<button type="button" className={scope === "individual" ? "active" : undefined} onClick={() => setScope("individual")} disabled={!cashiers.length}>By individual</button>
					</div>
					{scope === "individual" && <select className="sales-report-individual-select" aria-label="Select individual" value={selectedCashierId} onChange={(event) => setSelectedCashierId(event.target.value)}>{cashiers.map((cashier) => <option key={cashier.id} value={cashier.id}>{cashier.name}</option>)}</select>}
					<div className="sales-report-periods" aria-label="Report period">
						{(["daily", "weekly", "monthly"] as const).map((option) => (
							<button key={option} type="button" className={period === option ? "active" : undefined} onClick={() => setPeriod(option)}>{option}</button>
						))}
					</div>
				</div>
			</div>

			<div className="sales-reports-workspace">
				<div className="sales-reports-main">
					<div className="sales-report-kpis">
						<div className="sales-report-kpi"><span>Total sales</span><strong>{isLoading ? "…" : peso(report.totalSales)}</strong><small className={report.salesChange.isDown ? "is-down" : undefined}>{report.salesChange.isDown ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />} {report.salesChange.label}</small></div>
						<div className="sales-report-kpi"><span>Total orders</span><strong>{isLoading ? "…" : report.totalOrders.toLocaleString()}</strong><small className={report.ordersChange.isDown ? "is-down" : undefined}><BarChart3 size={13} /> {isLoading ? "Loading recorded orders" : report.ordersChange.label}</small></div>
						<div className="sales-report-kpi"><span>Average order</span><strong>{isLoading ? "…" : peso(report.averageOrder)}</strong><small className={report.averageChange.isDown ? "is-down" : undefined}>{report.averageChange.isDown ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />} {report.averageChange.label}</small></div>
					</div>

					<div className="sales-report-table-wrap">
						<div className="sales-report-table-heading"><span>Period</span><span>Orders</span><span>Total sales</span></div>
						{isLoading ? <div className="sales-report-table-row"><strong>Loading recorded sales...</strong><span>—</span><strong>—</strong></div> : loadError ? <div className="sales-report-table-row"><strong>{loadError}</strong><span>—</span><strong>—</strong></div> : report.rows.map((row) => <div className="sales-report-table-row" key={row.label}><strong>{row.label}</strong><span>{row.orders.toLocaleString()}</span><strong>{peso(row.sales)}</strong></div>)}
					</div>
				</div>

				<aside className="sales-print-preview" aria-label="Printable sales report preview">
					<div className="sales-print-toolbar"><span>Print preview</span><div className="sales-print-actions"><button type="button" className="sales-download-button" aria-label="Download PDF report" title="Download PDF report" onClick={handleDownload} disabled={isLoading}><Download size={15} aria-hidden="true" /></button><button type="button" onClick={handlePrint} disabled={isLoading}><Printer size={14} aria-hidden="true" /> Print report</button></div></div>
					<div className="sales-print-paper">
						<p className="pos-kicker">Kaffey Admin</p>
						<h2>Sales Report</h2>
						<p className="sales-print-period">{reportSubject} · {period.charAt(0).toUpperCase() + period.slice(1)} summary</p>
						<div className="sales-print-summary"><div><span>Total sales</span><strong>{peso(report.totalSales)}</strong></div><div><span>Total orders</span><strong>{report.totalOrders.toLocaleString()}</strong></div></div>
						<div className="sales-print-rows">{report.rows.map((row) => <div key={row.label}><span>{row.label}</span><span>{row.orders.toLocaleString()} orders</span><strong>{peso(row.sales)}</strong></div>)}</div>
						<div className="sales-print-total"><span>Average order</span><strong>{peso(report.averageOrder)}</strong></div>
					</div>
				</aside>
			</div>
		</section>
	);
}
