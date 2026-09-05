"use client";

import { ArrowUpRight, Coffee, ShoppingBag, Users } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

type SalesPeriod = "daily" | "weekly" | "monthly";

const salesDataByPeriod: Record<SalesPeriod, { label: string; sales: number }[]> = {
	daily: [
		{ label: "Mon", sales: 1820 },
		{ label: "Tue", sales: 2140 },
		{ label: "Wed", sales: 1980 },
		{ label: "Thu", sales: 2470 },
		{ label: "Fri", sales: 2890 },
		{ label: "Sat", sales: 3420 },
		{ label: "Sun", sales: 3180 },
	],
	weekly: [
		{ label: "Week 1", sales: 12480 },
		{ label: "Week 2", sales: 13820 },
		{ label: "Week 3", sales: 15160 },
		{ label: "Week 4", sales: 16420 },
	],
	monthly: [
		{ label: "Apr", sales: 48200 },
		{ label: "May", sales: 51600 },
		{ label: "Jun", sales: 54800 },
		{ label: "Jul", sales: 58900 },
		{ label: "Aug", sales: 62300 },
		{ label: "Sep", sales: 67100 },
	],
};

const choiceData = [
	{ day: "Mon", hour: "8:00 AM", orders: 86 },
	{ day: "Tue", hour: "10:00 AM", orders: 104 },
	{ day: "Wed", hour: "12:00 PM", orders: 96 },
	{ day: "Thu", hour: "9:00 AM", orders: 121 },
	{ day: "Fri", hour: "11:00 AM", orders: 143 },
	{ day: "Sat", hour: "10:00 AM", orders: 168 },
	{ day: "Sun", hour: "9:00 AM", orders: 154 },
];

const productData = [
	{ name: "Cappuccino", value: 42, fill: "#263234" },
	{ name: "Iced latte", value: 31, fill: "#b86a4b" },
	{ name: "Matcha latte", value: 19, fill: "#d9a58d" },
];

const salesConfig = { sales: { label: "Sales", color: "#b86a4b" } } satisfies ChartConfig;
const orderConfig = { orders: { label: "Orders", color: "#263234" } } satisfies ChartConfig;
const productConfig = {
	Cappuccino: { label: "Cappuccino", color: "#263234" },
	"Iced latte": { label: "Iced latte", color: "#b86a4b" },
	"Matcha latte": { label: "Matcha latte", color: "#d9a58d" },
} satisfies ChartConfig;

const recentActivity = [
	{ initials: "JM", name: "Jamie Miller", action: "completed a shift", time: "12 min ago" },
	{ initials: "AD", name: "Kaffey Admin", action: "updated menu pricing", time: "38 min ago" },
	{ initials: "JM", name: "Jamie Miller", action: "processed order #1048", time: "1 hr ago" },
];

export default function AdminDashboardPage() {
	const [salesPeriod, setSalesPeriod] = useState<SalesPeriod>("weekly");
	const [accountSummary, setAccountSummary] = useState({ totalAccounts: 0, admins: 0, cashiers: 0 });
	const salesData = salesDataByPeriod[salesPeriod];

	useEffect(() => {
		const loadAccountSummary = async () => {
			try {
				const response = await fetch("/api/accounts");
				const payload = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw new Error(payload.error || "Unable to load account summary.");
				}
				setAccountSummary(payload.summary || { totalAccounts: 0, admins: 0, cashiers: 0 });
			} catch {
				setAccountSummary({ totalAccounts: 0, admins: 0, cashiers: 0 });
			}
		};

		loadAccountSummary();
	}, []);

	return (
		<section className="pos-catalog admin-dashboard" aria-labelledby="admin-dashboard-title">
			<div className="admin-kpi-grid">
				<Card className="admin-kpi-card"><CardContent><div className="admin-kpi-label"><span>Total sales</span><span className="currency-symbol">₱</span></div><strong>₱4,286</strong><small><ArrowUpRight size={13} /> 12.8% from last Tuesday</small></CardContent></Card>
				<Card className="admin-kpi-card"><CardContent><div className="admin-kpi-label"><span>Orders today</span><ShoppingBag size={16} /></div><strong>184</strong><small><ArrowUpRight size={13} /> 8.4% from last Tuesday</small></CardContent></Card>
				<Card className="admin-kpi-card"><CardContent><div className="admin-kpi-label"><span>Average order</span><Coffee size={16} /></div><strong>₱23.29</strong><small><ArrowUpRight size={13} /> 3.1% from last Tuesday</small></CardContent></Card>
				<Card className="admin-kpi-card"><CardContent><div className="admin-kpi-label"><span>Active accounts</span><Users size={16} /></div><strong>{accountSummary.totalAccounts}</strong><small>{accountSummary.admins} administrators · {accountSummary.cashiers} cashiers</small></CardContent></Card>
			</div>

			<div className="admin-chart-grid">
				<Card className="admin-chart-card admin-revenue-card">
					<CardHeader className="sales-report-header"><div><CardTitle>Daily sales report</CardTitle><CardDescription>{salesPeriod === "daily" ? "Sales by day" : salesPeriod === "weekly" ? "Sales by week" : "Sales by month"}</CardDescription></div><div className="sales-periods" aria-label="Sales period"><button className={salesPeriod === "daily" ? "active" : undefined} type="button" onClick={() => setSalesPeriod("daily")}>Daily</button><button className={salesPeriod === "weekly" ? "active" : undefined} type="button" onClick={() => setSalesPeriod("weekly")}>Weekly</button><button className={salesPeriod === "monthly" ? "active" : undefined} type="button" onClick={() => setSalesPeriod("monthly")}>Monthly</button></div></CardHeader>
					<CardContent><ChartContainer config={salesConfig} className="admin-chart"><AreaChart accessibilityLayer data={salesData} margin={{ left: 4, right: 10, top: 10 }}><defs><linearGradient id="salesFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--color-sales)" stopOpacity={.3} /><stop offset="100%" stopColor="var(--color-sales)" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#dfe1d9" strokeDasharray="3 3" /><XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} /><YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `₱${value / 1000}k`} /><ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(value) => [`₱${Number(value).toLocaleString()}`, "Sales"]} />} /><Area dataKey="sales" type="monotone" fill="url(#salesFill)" stroke="var(--color-sales)" strokeWidth={2.5} /></AreaChart></ChartContainer></CardContent>
				</Card>
				<Card className="admin-chart-card admin-orders-card">
					<CardHeader><CardTitle>Peak hour</CardTitle><CardDescription>Busiest hour each day</CardDescription></CardHeader>
					<CardContent><ChartContainer config={orderConfig} className="admin-chart"><BarChart accessibilityLayer data={choiceData} margin={{ left: -12, right: 18, top: 10 }} barCategoryGap="18%"><CartesianGrid vertical={false} stroke="#dfe1d9" strokeDasharray="3 3" /><XAxis dataKey="day" padding={{ left: 8, right: 8 }} tickLine={false} axisLine={false} tickMargin={10} /><YAxis tickLine={false} axisLine={false} tickMargin={8} /><ChartTooltip cursor={{ fill: "rgba(38,50,52,.05)" }} content={<ChartTooltipContent hideLabel formatter={(value, _name, item) => [`${item.payload.hour} · ${value} orders`, "Peak hour"]} />} /><Bar dataKey="orders" fill="var(--color-orders)" maxBarSize={42} radius={[4, 4, 0, 0]} /></BarChart></ChartContainer></CardContent>
				</Card>
			</div>

			<div className="admin-bottom-grid">
				<Card className="admin-chart-card product-mix-card">
					<CardHeader><CardTitle>Top 3 best sellers</CardTitle><CardDescription>Best-selling products from the past 7 days</CardDescription></CardHeader>
					<CardContent className="product-mix-content"><ChartContainer config={productConfig} className="product-mix-chart"><PieChart><ChartTooltip content={<ChartTooltipContent hideLabel />} /><Pie data={productData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={78} strokeWidth={3} stroke="#f7f3eb">{productData.map((item) => <Cell key={item.name} fill={item.fill} />)}</Pie></PieChart></ChartContainer><ChartLegend content={<ChartLegendContent nameKey="name" />} /></CardContent>
				</Card>
				<Card className="admin-chart-card activity-card">
					<CardHeader><CardTitle>Recent activity</CardTitle><CardDescription>Latest team updates</CardDescription></CardHeader>
					<CardContent><div className="activity-list">{recentActivity.map((activity) => <div className="activity-row" key={`${activity.name}-${activity.time}`}><span className="activity-avatar">{activity.initials}</span><span><strong>{activity.name}</strong><small>{activity.action}</small></span><time>{activity.time}</time></div>)}</div></CardContent>
				</Card>
			</div>
		</section>
	);
}
