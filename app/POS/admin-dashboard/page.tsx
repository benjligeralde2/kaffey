"use client";

import { ArrowDownRight, ArrowUpRight, Coffee, ShoppingBag, Users } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { subscribeToOrderUpdates } from "@/lib/order-sync-client";

type SalesPeriod = "daily" | "weekly" | "monthly";

type DashboardOrder = {
	id: string;
	amount: number;
	time: string;
	cashierName: string;
	lineItems: { name: string; quantity: number }[];
};

type Bucket = {
	label: string;
	start: Date;
	end: Date;
};

const PRODUCT_COLORS = ["#263234", "#b86a4b", "#d9a58d"] as const;
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

const inRange = (time: string, start: Date, end: Date) => {
	const timestamp = new Date(time).getTime();
	return !Number.isNaN(timestamp) && timestamp >= start.getTime() && timestamp < end.getTime();
};

const summarize = (orders: DashboardOrder[], start: Date, end: Date) => (
	orders.reduce((totals, order) => {
		if (!inRange(order.time, start, end)) return totals;
		return { orders: totals.orders + 1, sales: totals.sales + order.amount };
	}, { orders: 0, sales: 0 })
);

const buildBuckets = (period: SalesPeriod, now = new Date()): Bucket[] => {
	if (period === "daily") {
		const today = startOfDay(now);
		return Array.from({ length: 7 }, (_, index) => {
			const start = addDays(today, index - 6);
			return { label: start.toLocaleDateString(undefined, { weekday: "short" }), start, end: addDays(start, 1) };
		});
	}
	if (period === "weekly") {
		const weekStart = startOfWeek(now);
		return Array.from({ length: 4 }, (_, index) => {
			const start = addDays(weekStart, (index - 3) * 7);
			return { label: start.toLocaleDateString(undefined, { month: "short", day: "numeric" }), start, end: addDays(start, 7) };
		});
	}
	const monthStart = startOfMonth(now);
	return Array.from({ length: 6 }, (_, index) => {
		const start = addMonths(monthStart, index - 5);
		return { label: start.toLocaleDateString(undefined, { month: "short" }), start, end: addMonths(start, 1) };
	});
};

const formatChange = (current: number, previous: number, comparisonLabel: string) => {
	if (previous === 0 && current === 0) return { label: `No sales ${comparisonLabel}`, isDown: false };
	if (previous === 0) return { label: `No comparable ${comparisonLabel}`, isDown: false };
	const percent = ((current - previous) / previous) * 100;
	return {
		label: `${percent > 0 ? "+" : ""}${percent.toFixed(1)}% ${comparisonLabel}`,
		isDown: percent < 0,
	};
};

const formatRelativeTime = (time: string, now = Date.now()) => {
	const timestamp = new Date(time).getTime();
	if (Number.isNaN(timestamp)) return "";
	const minutes = Math.max(0, Math.round((now - timestamp) / 60000));
	if (minutes < 1) return "Just now";
	if (minutes < 60) return `${minutes} min ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours} hr ago`;
	const days = Math.round(hours / 24);
	return `${days} day${days === 1 ? "" : "s"} ago`;
};

const initialsFor = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "CA";

const salesConfig = { sales: { label: "Sales", color: "#b86a4b" } } satisfies ChartConfig;
const orderConfig = { orders: { label: "Orders", color: "#263234" } } satisfies ChartConfig;

export default function AdminDashboardPage() {
	const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>("weekly");
	const [orders, setOrders] = useState<DashboardOrder[]>([]);
	const [isLoadingOrders, setIsLoadingOrders] = useState(true);
	const [accountSummary, setAccountSummary] = useState({ totalAccounts: 0, admins: 0, cashiers: 0 });
	const [nowMs, setNowMs] = useState(() => Date.now());

	useEffect(() => {
		const timer = window.setInterval(() => setNowMs(Date.now()), 30000);
		return () => window.clearInterval(timer);
	}, []);

	useEffect(() => {
		let cancelled = false;
		const loadDashboard = async () => {
			try {
				const [ordersResponse, accountsResponse] = await Promise.all([
					fetch("/api/orders", { cache: "no-store" }),
					fetch("/api/accounts"),
				]);
				const ordersPayload = await ordersResponse.json().catch(() => ({}));
				const accountsPayload = await accountsResponse.json().catch(() => ({}));
				if (cancelled) return;
				if (ordersResponse.ok && Array.isArray(ordersPayload.orders)) {
					setOrders(ordersPayload.orders.map((order: DashboardOrder) => ({
						id: order.id,
						amount: Number(order.amount) || 0,
						time: order.time,
						cashierName: order.cashierName || "Unknown cashier",
						lineItems: Array.isArray(order.lineItems) ? order.lineItems : [],
					})));
				}
				if (accountsResponse.ok) {
					setAccountSummary(accountsPayload.summary || { totalAccounts: 0, admins: 0, cashiers: 0 });
				}
			} finally {
				if (!cancelled) setIsLoadingOrders(false);
			}
		};

		const unsubscribe = subscribeToOrderUpdates(() => {
			void loadDashboard();
		});
		const poll = window.setInterval(() => {
			if (document.visibilityState === "visible") void loadDashboard();
		}, 3000);
		void loadDashboard();
		return () => {
			cancelled = true;
			unsubscribe();
			window.clearInterval(poll);
		};
	}, []);

	const metrics = useMemo(() => {
		const now = new Date(nowMs);
		const todayStart = startOfDay(now);
		const todayEnd = addDays(todayStart, 1);
		const weekStart = startOfWeek(now);
		const lastWeekStart = addDays(weekStart, -7);
		const today = summarize(orders, todayStart, todayEnd);
		const thisWeek = summarize(orders, weekStart, addDays(weekStart, 7));
		const lastWeek = summarize(orders, lastWeekStart, weekStart);
		const recordedSales = orders.reduce((total, order) => total + order.amount, 0);
		const recordedOrders = orders.length;
		const recordedAverage = recordedOrders ? recordedSales / recordedOrders : 0;
		const thisWeekAverage = thisWeek.orders ? thisWeek.sales / thisWeek.orders : 0;
		const lastWeekAverage = lastWeek.orders ? lastWeek.sales / lastWeek.orders : 0;
		const trailingWeekStart = addDays(todayEnd, -7);
		const peakHour = Array.from({ length: 7 }, (_, index) => {
			const start = addDays(trailingWeekStart, index);
			const end = addDays(start, 1);
			const hourCounts = new Map<number, number>();
			orders.forEach((order) => {
				if (!inRange(order.time, start, end)) return;
				const hour = new Date(order.time).getHours();
				hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
			});
			const peak = [...hourCounts.entries()].sort((left, right) => right[1] - left[1] || left[0] - right[0])[0];
			const hourLabel = peak
				? new Date(start.getFullYear(), start.getMonth(), start.getDate(), peak[0]).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
				: "No orders";
			return {
				day: start.toLocaleDateString(undefined, { weekday: "short" }),
				hour: hourLabel,
				orders: peak?.[1] || 0,
			};
		});
		const productCounts = new Map<string, number>();
		orders.forEach((order) => {
			if (!inRange(order.time, trailingWeekStart, todayEnd)) return;
			order.lineItems.forEach((item) => {
				if (!item.name) return;
				productCounts.set(item.name, (productCounts.get(item.name) || 0) + (Number(item.quantity) || 0));
			});
		});
		const productData = [...productCounts.entries()]
			.sort((left, right) => right[1] - left[1])
			.slice(0, 3)
			.map(([name, value], index) => ({ name, value, fill: PRODUCT_COLORS[index] }));
		const productConfig = Object.fromEntries(productData.map((item) => [item.name, { label: item.name, color: item.fill }])) as ChartConfig;
		const activity = [...orders]
			.sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime())
			.slice(0, 5)
			.map((order) => ({
				id: order.id,
				initials: initialsFor(order.cashierName),
				name: order.cashierName,
				action: `processed order ${order.id}`,
				time: formatRelativeTime(order.time, nowMs),
			}));

		return {
			recordedSales,
			todayOrders: today.orders,
			recordedAverage,
			salesChange: recordedOrders
				? thisWeek.sales === 0 && lastWeek.sales === 0
					? { label: `${recordedOrders.toLocaleString()} recorded orders`, isDown: false }
					: formatChange(thisWeek.sales, lastWeek.sales, "vs last week")
				: { label: "No recorded sales yet", isDown: false },
			ordersChange: today.orders
				? formatChange(today.orders, summarize(orders, addDays(todayStart, -7), addDays(todayEnd, -7)).orders, `from last ${todayStart.toLocaleDateString(undefined, { weekday: "long" })}`)
				: { label: recordedOrders ? `${recordedOrders.toLocaleString()} recorded orders` : "No orders yet today", isDown: false },
			averageChange: recordedOrders
				? thisWeek.orders === 0 && lastWeek.orders === 0
					? { label: "Across all recorded orders", isDown: false }
					: formatChange(thisWeekAverage, lastWeekAverage, "vs last week")
				: { label: "No recorded orders yet", isDown: false },
			salesData: buildBuckets(salesPeriod, now).map((bucket) => ({ label: bucket.label, sales: summarize(orders, bucket.start, bucket.end).sales })),
			peakHour,
			productData,
			productConfig,
			activity,
		};
	}, [nowMs, orders, salesPeriod]);

	return (
		<section className="pos-catalog admin-dashboard" aria-labelledby="admin-dashboard-title">
			<h1 id="admin-dashboard-title" className="accounts-header-accessible-title">Admin dashboard</h1>
			<div className="admin-kpi-grid">
				<Card className="admin-kpi-card"><CardContent><div className="admin-kpi-label"><span>Total sales</span><span className="currency-symbol">₱</span></div><strong>{isLoadingOrders ? "…" : peso(metrics.recordedSales)}</strong><small className={metrics.salesChange.isDown ? "is-down" : undefined}>{metrics.salesChange.isDown ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />} {metrics.salesChange.label}</small></CardContent></Card>
				<Card className="admin-kpi-card"><CardContent><div className="admin-kpi-label"><span>Orders today</span><ShoppingBag size={16} /></div><strong>{isLoadingOrders ? "…" : metrics.todayOrders.toLocaleString()}</strong><small className={metrics.ordersChange.isDown ? "is-down" : undefined}>{metrics.ordersChange.isDown ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />} {metrics.ordersChange.label}</small></CardContent></Card>
				<Card className="admin-kpi-card"><CardContent><div className="admin-kpi-label"><span>Average order</span><Coffee size={16} /></div><strong>{isLoadingOrders ? "…" : peso(metrics.recordedAverage)}</strong><small className={metrics.averageChange.isDown ? "is-down" : undefined}>{metrics.averageChange.isDown ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />} {metrics.averageChange.label}</small></CardContent></Card>
				<Card className="admin-kpi-card"><CardContent><div className="admin-kpi-label"><span>Active accounts</span><Users size={16} /></div><strong>{accountSummary.totalAccounts}</strong><small>{accountSummary.admins} administrators · {accountSummary.cashiers} cashiers</small></CardContent></Card>
			</div>

			<div className="admin-chart-grid">
				<Card className="admin-chart-card admin-revenue-card">
					<CardHeader className="sales-report-header"><div><CardTitle>Daily sales report</CardTitle><CardDescription>{salesPeriod === "daily" ? "Sales by day" : salesPeriod === "weekly" ? "Sales by week" : "Sales by month"}</CardDescription></div><div className="sales-periods" aria-label="Sales period"><button className={salesPeriod === "daily" ? "active" : undefined} type="button" onClick={() => setSalesPeriod("daily")}>Daily</button><button className={salesPeriod === "weekly" ? "active" : undefined} type="button" onClick={() => setSalesPeriod("weekly")}>Weekly</button><button className={salesPeriod === "monthly" ? "active" : undefined} type="button" onClick={() => setSalesPeriod("monthly")}>Monthly</button></div></CardHeader>
					<CardContent><ChartContainer config={salesConfig} className="admin-chart"><AreaChart accessibilityLayer data={metrics.salesData} margin={{ left: 4, right: 10, top: 10 }}><defs><linearGradient id="salesFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--color-sales)" stopOpacity={.3} /><stop offset="100%" stopColor="var(--color-sales)" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#dfe1d9" strokeDasharray="3 3" /><XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} /><YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => Number(value) >= 1000 ? `₱${Number(value) / 1000}k` : `₱${Number(value)}`} /><ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(value) => [peso(Number(value)), "Sales"]} />} /><Area dataKey="sales" type="monotone" fill="url(#salesFill)" stroke="var(--color-sales)" strokeWidth={2.5} /></AreaChart></ChartContainer></CardContent>
				</Card>
				<Card className="admin-chart-card admin-orders-card">
					<CardHeader><CardTitle>Peak hour</CardTitle><CardDescription>Busiest hour each day</CardDescription></CardHeader>
					<CardContent><ChartContainer config={orderConfig} className="admin-chart"><BarChart accessibilityLayer data={metrics.peakHour} margin={{ left: -12, right: 18, top: 10 }} barCategoryGap="18%"><CartesianGrid vertical={false} stroke="#dfe1d9" strokeDasharray="3 3" /><XAxis dataKey="day" padding={{ left: 8, right: 8 }} tickLine={false} axisLine={false} tickMargin={10} /><YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} /><ChartTooltip cursor={{ fill: "rgba(38,50,52,.05)" }} content={<ChartTooltipContent hideLabel formatter={(value, _name, item) => [`${item.payload.hour} · ${value} orders`, "Peak hour"]} />} /><Bar dataKey="orders" fill="var(--color-orders)" maxBarSize={42} radius={[4, 4, 0, 0]} /></BarChart></ChartContainer></CardContent>
				</Card>
			</div>

			<div className="admin-bottom-grid">
				<Card className="admin-chart-card product-mix-card">
					<CardHeader><CardTitle>Top 3 best sellers</CardTitle><CardDescription>Best-selling products from the past 7 days</CardDescription></CardHeader>
					<CardContent className="product-mix-content">
						{metrics.productData.length ? (
							<><ChartContainer config={metrics.productConfig} className="product-mix-chart"><PieChart><ChartTooltip content={<ChartTooltipContent hideLabel />} /><Pie data={metrics.productData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={78} strokeWidth={3} stroke="#f7f3eb">{metrics.productData.map((item) => <Cell key={item.name} fill={item.fill} />)}</Pie></PieChart></ChartContainer><ChartLegend content={<ChartLegendContent nameKey="name" />} /></>
						) : (
							<p className="admin-empty-copy">No product sales recorded in the past 7 days.</p>
						)}
					</CardContent>
				</Card>
				<Card className="admin-chart-card activity-card">
					<CardHeader><CardTitle>Recent activity</CardTitle><CardDescription>Latest team updates</CardDescription></CardHeader>
					<CardContent>
						<div className="activity-list">
							{metrics.activity.length ? metrics.activity.map((activity) => (
								<div className="activity-row" key={activity.id}>
									<span className="activity-avatar">{activity.initials}</span>
									<span><strong>{activity.name}</strong><small>{activity.action}</small></span>
									<time>{activity.time}</time>
								</div>
							)) : <p className="admin-empty-copy">No recent orders yet.</p>}
						</div>
					</CardContent>
				</Card>
			</div>
		</section>
	);
}
