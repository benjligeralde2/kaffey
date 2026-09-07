import { NextResponse, type NextRequest } from "next/server";

import { ORDER_ALERT_CHANNEL, ORDER_ALERT_EVENT, ORDER_SYNC_CHANNEL, ORDER_SYNC_EVENT, type OrderAlert } from "@/lib/order-sync";
import { ORDER_STATUSES, normalizeStatus } from "@/lib/order-status";
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
	status?: string | null;
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

async function broadcastOrderRecorded(alert?: OrderAlert) {
	if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return;
	const syncPayload = { timestamp: Date.now() };
	const messages = [
		{ topic: `realtime:${ORDER_SYNC_CHANNEL}`, event: ORDER_SYNC_EVENT, payload: syncPayload },
		{ topic: ORDER_SYNC_CHANNEL, event: ORDER_SYNC_EVENT, payload: syncPayload },
	];
	if (alert) {
		messages.push(
			{ topic: `realtime:${ORDER_ALERT_CHANNEL}`, event: ORDER_ALERT_EVENT, payload: alert },
			{ topic: ORDER_ALERT_CHANNEL, event: ORDER_ALERT_EVENT, payload: alert },
		);
	}
	await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
		method: "POST",
		headers: serviceHeaders(),
		body: JSON.stringify({ messages }),
	}).catch(() => undefined);
}

function alertFromOrder(order: OrderRow, type: OrderAlert["type"]): OrderAlert {
	const mapped = mapOrder(order);
	return {
		type,
		orderId: mapped.recordId || mapped.id,
		customerName: mapped.name,
		items: mapped.items,
		timestamp: Date.now(),
	};
}

function mapOrder(order: OrderRow) {
	const lineItems = Array.isArray(order.line_items) ? order.line_items : [];
	return {
		id: `#${String(order.order_number).padStart(5, "0")}`,
		recordId: order.id,
		name: order.customer_name,
		items: lineItems.map((item) => item.name).join(", "),
		amount: Number(order.amount),
		time: order.created_at,
		channel: "Dine-in order",
		orderType: order.order_type,
		paymentMethod: order.payment_method,
		tableNumber: order.table_number,
		lineItems,
		status: normalizeStatus(order.status),
		cashierId: order.cashier_id || undefined,
		cashierName: order.cashier_name || "Unknown cashier",
	};
}

export async function GET(request: NextRequest) {
	if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return NextResponse.json({ error: "Supabase configuration is missing." }, { status: 500 });
	try {
		const user = await requireStaff();
		const kitchen = request.nextUrl.searchParams.get("kitchen") === "true";
		const mine = !kitchen && (request.nextUrl.searchParams.get("mine") === "true" || user.app_metadata?.role === "cashier");
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

		const record = { customer_name: customerName, amount, payment_method: "Cash", order_type: "Dine-in", table_number: "Counter", line_items: lineItems, status: "Pending", cashier_id: user.id, cashier_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Cashier" };
		let response = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
			method: "POST",
			headers: { ...serviceHeaders(), Prefer: "return=representation" },
			body: JSON.stringify(record),
		});
		let result = await response.json().catch(() => ({}));
		if (!response.ok && String(result?.message || "").toLowerCase().includes("status")) {
			const { customer_name, amount, payment_method, order_type, table_number, line_items, cashier_id, cashier_name } = record;
			response = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
				method: "POST",
				headers: { ...serviceHeaders(), Prefer: "return=representation" },
				body: JSON.stringify({ customer_name, amount, payment_method, order_type, table_number, line_items, cashier_id, cashier_name }),
			});
			result = await response.json().catch(() => ({}));
		}
		if (!response.ok) return NextResponse.json({ error: result?.message || "Unable to record order." }, { status: response.status || 500 });
		const order = Array.isArray(result) ? result[0] : result;
		await broadcastOrderRecorded(alertFromOrder(order, "new-order"));
		return NextResponse.json({ order: mapOrder(order) }, { status: 201 });
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error recording order." }, { status: 500 });
	}
}

export async function PATCH(request: NextRequest) {
	if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return NextResponse.json({ error: "Supabase configuration is missing." }, { status: 500 });
	try {
		await requireStaff();
		const body = await request.json();
		const recordId = typeof body?.id === "string" ? body.id.trim() : "";
		const status = normalizeStatus(body?.status);
		if (!recordId || !ORDER_STATUSES.includes(body?.status)) return NextResponse.json({ error: "A valid order and status are required." }, { status: 400 });

		const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(recordId)}`, {
			method: "PATCH",
			headers: { ...serviceHeaders(), Prefer: "return=representation" },
			body: JSON.stringify({ status }),
		});
		const result = await response.json().catch(() => ({}));
		if (!response.ok) return NextResponse.json({ error: result?.message || "Unable to update order status. Add a status column to the orders table." }, { status: response.status || 500 });
		const order = Array.isArray(result) ? result[0] : result;
		if (!order) return NextResponse.json({ error: "Order was not found." }, { status: 404 });
		await broadcastOrderRecorded(status === "Finished" ? alertFromOrder(order, "order-finished") : undefined);
		return NextResponse.json({ order: mapOrder(order) });
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error updating order status." }, { status: 500 });
	}
}
