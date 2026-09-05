
"use client";

import { ArrowUpRight, BarChart3, Download, Printer } from "lucide-react";
import { jsPDF } from "jspdf";
import { useEffect, useState } from "react";

type ReportPeriod = "daily" | "weekly" | "monthly";
type ReportScope = "overall" | "individual";

const reportData: Record<ReportPeriod, { label: string; orders: number; sales: number }[]> = {
	daily: [
		{ label: "Mon", orders: 86, sales: 1820 },
		{ label: "Tue", orders: 104, sales: 2140 },
		{ label: "Wed", orders: 96, sales: 1980 },
		{ label: "Thu", orders: 121, sales: 2470 },
		{ label: "Fri", orders: 143, sales: 2890 },
	],
	weekly: [
		{ label: "Week 1", orders: 482, sales: 12480 },
		{ label: "Week 2", orders: 526, sales: 13820 },
		{ label: "Week 3", orders: 584, sales: 15160 },
		{ label: "Week 4", orders: 642, sales: 16420 },
	],
	monthly: [
		{ label: "Apr", orders: 1820, sales: 48200 },
		{ label: "May", orders: 1964, sales: 51600 },
		{ label: "Jun", orders: 2108, sales: 54800 },
		{ label: "Jul", orders: 2264, sales: 58900 },
		{ label: "Aug", orders: 2418, sales: 62300 },
	],
};

const individualReportData: Record<string, Record<ReportPeriod, { label: string; orders: number; sales: number }[]>> = {
	"Cashier Rona": {
		daily: [{ label: "Mon", orders: 24, sales: 520 }, { label: "Tue", orders: 31, sales: 680 }, { label: "Wed", orders: 28, sales: 590 }, { label: "Thu", orders: 35, sales: 740 }, { label: "Fri", orders: 42, sales: 860 }],
		weekly: [{ label: "Week 1", orders: 118, sales: 3120 }, { label: "Week 2", orders: 134, sales: 3580 }, { label: "Week 3", orders: 142, sales: 3740 }, { label: "Week 4", orders: 156, sales: 4120 }],
		monthly: [{ label: "Apr", orders: 462, sales: 12100 }, { label: "May", orders: 498, sales: 13080 }, { label: "Jun", orders: 526, sales: 13840 }, { label: "Jul", orders: 568, sales: 14920 }, { label: "Aug", orders: 604, sales: 15860 }],
	},
	"Cashier Betty": {
		daily: [{ label: "Mon", orders: 19, sales: 410 }, { label: "Tue", orders: 26, sales: 540 }, { label: "Wed", orders: 23, sales: 480 }, { label: "Thu", orders: 30, sales: 620 }, { label: "Fri", orders: 36, sales: 760 }],
		weekly: [{ label: "Week 1", orders: 96, sales: 2480 }, { label: "Week 2", orders: 112, sales: 2920 }, { label: "Week 3", orders: 126, sales: 3260 }, { label: "Week 4", orders: 138, sales: 3580 }],
		monthly: [{ label: "Apr", orders: 384, sales: 9860 }, { label: "May", orders: 426, sales: 11080 }, { label: "Jun", orders: 464, sales: 12140 }, { label: "Jul", orders: 508, sales: 13280 }, { label: "Aug", orders: 542, sales: 14180 }],
	},
};

const getIndividualReportRows = (name: string, period: ReportPeriod) => {
	const savedRows = individualReportData[name]?.[period];
	if (savedRows) return savedRows;

	const nameFactor = [...name].reduce((total, character) => total + character.charCodeAt(0), 0) % 7;
	return reportData[period].map((row) => ({
		...row,
		orders: Math.round(row.orders * (0.18 + nameFactor / 100)),
		sales: Math.round(row.sales * (0.18 + nameFactor / 100)),
	}));
};

export default function SalesReportsPage() {
	const [period, setPeriod] = useState<ReportPeriod>("weekly");
	const [scope, setScope] = useState<ReportScope>("overall");
	const [individualName, setIndividualName] = useState("Cashier Rona");
	const [cashierNames, setCashierNames] = useState(Object.keys(individualReportData));
	const rows = scope === "overall" ? reportData[period] : getIndividualReportRows(individualName, period);
	const totalSales = rows.reduce((total, row) => total + row.sales, 0);
	const totalOrders = rows.reduce((total, row) => total + row.orders, 0);
	const averageOrder = totalOrders ? totalSales / totalOrders : 0;
	const handlePrint = () => window.print();
	const reportSubject = scope === "overall" ? "All accounts" : individualName;

	useEffect(() => {
		const loadCashierNames = async () => {
			try {
				const response = await fetch("/api/accounts");
				const payload = await response.json().catch(() => ({}));
				if (!response.ok || !Array.isArray(payload.accounts)) return;
				const names = payload.accounts
					.filter((account: { role?: string; name?: string }) => account.role?.toLowerCase() === "cashier" && account.name)
					.map((account: { name: string }) => account.name);
				if (names.length > 0) {
					setCashierNames(names);
					setIndividualName((currentName) => names.includes(currentName) ? currentName : names[0]);
				}
			} catch {
				// Keep the local report names when the accounts service is unavailable.
			}
		};

		void loadCashierNames();
	}, []);
	const handleDownload = () => {
		const pdf = new jsPDF();
		const formatCurrency = (value: number) => `PHP ${value.toLocaleString()}`;
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
		pdf.text(`Total sales: ${formatCurrency(totalSales)}`, 20, 60);
		pdf.text(`Total orders: ${totalOrders.toLocaleString()}`, 20, 68);
		pdf.text(`Average order: ${formatCurrency(averageOrder)}`, 20, 76);
		pdf.setDrawColor(223, 225, 217);
		pdf.line(20, 84, 190, 84);
		pdf.setFontSize(10);
		pdf.setTextColor(137, 145, 138);
		pdf.text("PERIOD", 20, 94);
		pdf.text("ORDERS", 115, 94, { align: "right" });
		pdf.text("TOTAL SALES", 190, 94, { align: "right" });
		rows.forEach((row, index) => {
			const y = 106 + index * 14;
			pdf.setDrawColor(236, 236, 229);
			pdf.line(20, y + 5, 190, y + 5);
			pdf.setTextColor(38, 50, 52);
			pdf.text(row.label, 20, y);
			pdf.text(row.orders.toLocaleString(), 115, y, { align: "right" });
			pdf.text(formatCurrency(row.sales), 190, y, { align: "right" });
		});
		pdf.save(`kaffey-${scope}-${period}-sales-report.pdf`);
	};

	return (
		<section className="pos-catalog sales-reports-page" aria-labelledby="sales-reports-title">
			<div className="sales-reports-heading">
				<div>
					<p className="pos-kicker">Performance overview</p>
					<h1 id="sales-reports-title">Sales Reports</h1>
					<p className="sales-reports-intro">Track revenue and order activity {scope === "overall" ? "across the Kaffey counter" : `for ${individualName}`}.</p>
				</div>
				<div className="sales-report-controls">
					<div className="sales-report-scope" aria-label="Report scope">
						<button type="button" className={scope === "overall" ? "active" : undefined} onClick={() => setScope("overall")}>Overall</button>
						<button type="button" className={scope === "individual" ? "active" : undefined} onClick={() => setScope("individual")}>By individual</button>
					</div>
					{scope === "individual" && <select className="sales-report-individual-select" aria-label="Select individual" value={individualName} onChange={(event) => setIndividualName(event.target.value)}>{cashierNames.map((name) => <option key={name} value={name}>{name}</option>)}</select>}
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
						<div className="sales-report-kpi"><span>Total sales</span><strong>₱{totalSales.toLocaleString()}</strong><small><ArrowUpRight size={13} /> 12.8% from previous period</small></div>
						<div className="sales-report-kpi"><span>Total orders</span><strong>{totalOrders.toLocaleString()}</strong><small><BarChart3 size={13} /> Orders completed</small></div>
						<div className="sales-report-kpi"><span>Average order</span><strong>₱{averageOrder.toFixed(2)}</strong><small><ArrowUpRight size={13} /> Consistent order value</small></div>
					</div>

					<div className="sales-report-table-wrap">
						<div className="sales-report-table-heading"><span>Period</span><span>Orders</span><span>Total sales</span></div>
						{rows.map((row) => <div className="sales-report-table-row" key={row.label}><strong>{row.label}</strong><span>{row.orders.toLocaleString()}</span><strong>₱{row.sales.toLocaleString()}</strong></div>)}
					</div>
				</div>

				<aside className="sales-print-preview" aria-label="Printable sales report preview">
					<div className="sales-print-toolbar"><span>Print preview</span><div className="sales-print-actions"><button type="button" className="sales-download-button" aria-label="Download PDF report" title="Download PDF report" onClick={handleDownload}><Download size={15} aria-hidden="true" /></button><button type="button" onClick={handlePrint}><Printer size={14} aria-hidden="true" /> Print report</button></div></div>
					<div className="sales-print-paper">
						<p className="pos-kicker">Kaffey Admin</p>
						<h2>Sales Report</h2>
						<p className="sales-print-period">{reportSubject} · {period.charAt(0).toUpperCase() + period.slice(1)} summary</p>
						<div className="sales-print-summary"><div><span>Total sales</span><strong>₱{totalSales.toLocaleString()}</strong></div><div><span>Total orders</span><strong>{totalOrders.toLocaleString()}</strong></div></div>
						<div className="sales-print-rows">{rows.map((row) => <div key={row.label}><span>{row.label}</span><span>{row.orders.toLocaleString()} orders</span><strong>₱{row.sales.toLocaleString()}</strong></div>)}</div>
						<div className="sales-print-total"><span>Average order</span><strong>₱{averageOrder.toFixed(2)}</strong></div>
					</div>
				</aside>
			</div>
		</section>
	);
}
