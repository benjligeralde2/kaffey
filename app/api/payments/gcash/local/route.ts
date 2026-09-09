import { NextResponse, type NextRequest } from "next/server";

import { gcashMerchant, isGcashCheckoutId, loadGcashCheckout, markGcashResult } from "@/lib/gcash";

export async function GET(request: NextRequest) {
	try {
		const paymentIntentId = request.nextUrl.searchParams.get("id")?.trim() || "";
		if (!isGcashCheckoutId(paymentIntentId)) return NextResponse.json({ error: "A GCash checkout id is required." }, { status: 400 });
		const checkout = await loadGcashCheckout(paymentIntentId);
		if (!checkout) return NextResponse.json({ error: "GCash checkout was not found." }, { status: 404 });
		return NextResponse.json({
			id: checkout.id,
			amount: Number(checkout.amount),
			customerName: checkout.customer_name,
			status: checkout.status,
			...gcashMerchant(),
		});
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load GCash checkout." }, { status: 500 });
	}
}
export async function POST(request: NextRequest) {
	try {
		const body = await request.json().catch(() => ({}));
		const paymentIntentId = typeof body?.id === "string" ? body.id.trim() : "";
		const result = body?.result === "failed" ? "failed" : body?.result === "paid" ? "paid" : "";
		if (!isGcashCheckoutId(paymentIntentId) || !result) {
			return NextResponse.json({ error: "A checkout id and result are required." }, { status: 400 });
		}
		const outcome = await markGcashResult(paymentIntentId, result);
		return NextResponse.json(outcome);
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update GCash checkout." }, { status: 500 });
	}
}

