import { NextResponse, type NextRequest } from "next/server";

import { ORDER_STATUSES, normalizeStatus } from "@/lib/order-status";
import { alertFromOrder, broadcastOrderRecorded, insertPaidOrder, mapOrder, sanitizeLineItems, serviceHeaders, type OrderRow } from "@/lib/orders-store";
import { requireStaff } from "@/lib/pos-staff";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: NextRequest) {
	if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return NextResponse.json({ error: "Supabase configuration is missing." }, { status: 500 });
	try {
		const staff = await requireStaff();
		if (staff instanceof NextResponse) return staff;
		const kitchen = request.nextUrl.searchParams.get("kitchen") === "true";
		const mine = !kitchen && (request.nextUrl.searchParams.get("mine") === "true" || staff.role === "cashier");
		const cashierFilter = mine ? `&cashier_id=eq.${encodeURIComponent(staff.user.id)}` : "";
		const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=*&order=created_at.desc${cashierFilter}`, { headers: serviceHeaders(), cache: "no-store" });
		const result = await response.json().catch(() => ({}));
		if (!response.ok) return NextResponse.json({ error: result?.message || "Unable to load orders." }, { status: response.status || 500 });
		return NextResponse.json({ orders: (Array.isArray(result) ? result : []).map((order) => mapOrder(order as OrderRow)) });
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error loading orders." }, { status: 500 });
	}
}

export async function POST(request: NextRequest) {
	if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return NextResponse.json({ error: "Supabase configuration is missing." }, { status: 500 });
	try {
		const staff = await requireStaff();
		if (staff instanceof NextResponse) return staff;
		if (staff.role === "kitchen") return NextResponse.json({ error: "Kitchen accounts cannot create orders." }, { status: 403 });
		const user = staff.user;
		const body = await request.json();
		const customerName = typeof body?.customerName === "string" ? body.customerName.trim() : "";
		const amount = typeof body?.amount === "number" ? body.amount : Number(body?.amount);
		const lineItems = sanitizeLineItems(body?.lineItems);
		if (!customerName || !Number.isFinite(amount) || amount < 0 || !lineItems.length || body?.paymentMethod !== "Cash") {
			return NextResponse.json({ error: "A customer name, items, amount, and cash payment are required." }, { status: 400 });
		}
		const order = await insertPaidOrder({
			customer_name: customerName,
			amount,
			payment_method: "Cash",
			line_items: lineItems,
			cashier_id: user.id,
			cashier_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Cashier",
		});
		await broadcastOrderRecorded(alertFromOrder(order, "new-order"));
		return NextResponse.json({ order: mapOrder(order) }, { status: 201 });
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error recording order." }, { status: 500 });
	}
}

export async function PATCH(request: NextRequest) {
	if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return NextResponse.json({ error: "Supabase configuration is missing." }, { status: 500 });
	try {
		const staff = await requireStaff();
		if (staff instanceof NextResponse) return staff;
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
		await broadcastOrderRecorded(status === "Finished" ? alertFromOrder(order as OrderRow, "order-finished") : undefined);
		return NextResponse.json({ order: mapOrder(order as OrderRow) });
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error updating order status." }, { status: 500 });
	}
}
