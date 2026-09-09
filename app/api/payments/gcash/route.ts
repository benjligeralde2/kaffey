import { NextResponse, type NextRequest } from "next/server";

import { createGcashCheckout, fulfillGcashPayment } from "@/lib/gcash";
import { sanitizeLineItems } from "@/lib/orders-store";
import { requireStaff } from "@/lib/pos-staff";

function appOrigin(request: NextRequest) {
	return (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/$/, "");
}

export async function POST(request: NextRequest) {
	try {
		const staff = await requireStaff();
		if (staff instanceof NextResponse) return staff;
		if (staff.role === "kitchen") return NextResponse.json({ error: "Kitchen accounts cannot create payments." }, { status: 403 });

		const body = await request.json();
		const customerName = typeof body?.customerName === "string" ? body.customerName.trim() : "";
		const amount = typeof body?.amount === "number" ? body.amount : Number(body?.amount);
		const lineItems = sanitizeLineItems(body?.lineItems);
		if (!customerName || !Number.isFinite(amount) || amount <= 0 || !lineItems.length) {
			return NextResponse.json({ error: "A customer name, items, and amount are required." }, { status: 400 });
		}
		const computed = lineItems.reduce((total, item) => total + item.price * item.quantity, 0);
		if (Math.abs(computed - amount) > 0.05) {
			return NextResponse.json({ error: "The GCash amount does not match the order items." }, { status: 400 });
		}

		const checkout = await createGcashCheckout({
			customerName,
			amount,
			lineItems,
			cashierId: staff.user.id,
			cashierName: staff.user.user_metadata?.full_name || staff.user.user_metadata?.name || staff.user.email || "Cashier",
			origin: appOrigin(request),
		});
		return NextResponse.json(checkout);
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to start GCash payment." }, { status: 500 });
	}
}

export async function GET(request: NextRequest) {
	try {
		const staff = await requireStaff();
		if (staff instanceof NextResponse) return staff;
		const paymentIntentId = request.nextUrl.searchParams.get("id")?.trim() || "";
		if (!paymentIntentId) return NextResponse.json({ error: "A payment id is required." }, { status: 400 });
		const result = await fulfillGcashPayment(paymentIntentId);
		return NextResponse.json(result);
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to check GCash payment." }, { status: 500 });
	}
}
