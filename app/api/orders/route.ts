import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type OrderRow = {
	id: string;
	order_number: number;
	customer_name: string;
	amount: number;
	payment_method: "Cash";
	order_type: "Dine-in";
	table_number: string;
	line_items: { name: string; detail: string; quantity: number; price: number; image?: string }[];
	cashier_id?: string | null;
	cashier_name?: string | null;
	created_at: string;
};

function serviceHeaders() {
	return {
		apikey: SERVICE_ROLE_KEY!,
		Authorization: `Bearer ${SERVICE_ROLE_KEY!}`,
		"Content-Type": "application/json",
	};
}

async function requireStaff() {
	const supabase = await createClient();
	const { data, error } = await supabase.auth.getUser();
	if (error || !data.user || !["admin", "cashier"].includes(data.user.app_metadata?.role)) throw new Error("Staff access is required.");
	return data.user;
}

function mapOrder(order: OrderRow) {
	return {
		id: `#${String(order.order_number).padStart(5, "0")}`,
		name: order.customer_name,
		items: order.line_items.map((item) => item.name).join(", "),
		amount: Number(order.amount),
		time: order.created_at,
		channel: "Dine-in order",
		orderType: order.order_type,
		paymentMethod: order.payment_method,
		tableNumber: order.table_number,
		lineItems: order.line_items,
		cashierName: order.cashier_name || "Unknown cashier",
	};
}

export async function GET(request: NextRequest) {
	if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return NextResponse.json({ error: "Supabase configuration is missing." }, { status: 500 });
	try {
		const user = await requireStaff();
		const mine = request.nextUrl.searchParams.get("mine") === "true";
		const cashierFilter = mine ? `&cashier_id=eq.${encodeURIComponent(user.id)}` : "";
		const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=*&order=created_at.desc${cashierFilter}`, { headers: serviceHeaders(), cache: "no-store" });
		const result = await response.json().catch(() => ({}));
		if (!response.ok) return NextResponse.json({ error: result?.message || "Unable to load orders." }, { status: response.status || 500 });
		return NextResponse.json({ orders: (Array.isArray(result) ? result : []).map(mapOrder) });
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error loading orders." }, { status: 500 });
	}
}

export async function POST(request: NextRequest) {
	if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return NextResponse.json({ error: "Supabase configuration is missing." }, { status: 500 });
	try {
		const user = await requireStaff();
		const body = await request.json();
		const customerName = typeof body?.customerName === "string" ? body.customerName.trim() : "";
		const amount = typeof body?.amount === "number" ? body.amount : Number(body?.amount);
		const lineItems = Array.isArray(body?.lineItems) ? body.lineItems : [];
		if (!customerName || !Number.isFinite(amount) || amount < 0 || !lineItems.length || body?.paymentMethod !== "Cash") return NextResponse.json({ error: "A customer name, items, amount, and cash payment are required." }, { status: 400 });

		const response = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
			method: "POST",
			headers: { ...serviceHeaders(), Prefer: "return=representation" },
			body: JSON.stringify({ customer_name: customerName, amount, payment_method: "Cash", order_type: "Dine-in", table_number: "Counter", line_items: lineItems, cashier_id: user.id, cashier_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Cashier" }),
		});
		const result = await response.json().catch(() => ({}));
		if (!response.ok) return NextResponse.json({ error: result?.message || "Unable to record order." }, { status: response.status || 500 });
		const order = Array.isArray(result) ? result[0] : result;
		return NextResponse.json({ order: mapOrder(order) }, { status: 201 });
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error recording order." }, { status: 500 });
	}
}