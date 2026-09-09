import { randomUUID } from "node:crypto";

import { alertFromOrder, broadcastOrderRecorded, findOrderByPaymentIntent, insertPaidOrder, mapOrder, sanitizeLineItems, serviceHeaders, type OrderLineItem } from "@/lib/orders-store";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type GcashCheckoutRow = {
	id: string;
	cashier_id: string;
	cashier_name: string;
	customer_name: string;
	amount: number;
	line_items: OrderLineItem[];
	checkout_url: string | null;
	status: "pending" | "paid" | "failed";
	order_id: string | null;
};

export function gcashMerchant() {
	return {
		name: process.env.GCASH_MERCHANT_NAME?.trim() || "Kaffey",
		number: process.env.GCASH_MERCHANT_NUMBER?.trim() || "",
	};
}

export function isGcashCheckoutId(id: string) {
	return id.startsWith("gcash_") || id.startsWith("pi_local_");
}

async function rest<T>(path: string, init?: RequestInit) {
	if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("Supabase configuration is missing.");
	const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
		...init,
		headers: { ...serviceHeaders(), ...init?.headers },
	});
	const text = await response.text();
	const result = text ? JSON.parse(text) as unknown : {};
	if (!response.ok) {
		throw new Error((result as { message?: string })?.message || "Unable to save GCash checkout. Run the latest supabase/orders.sql on your database.");
	}
	return result as T;
}

export async function createGcashCheckout(input: {
	customerName: string;
	amount: number;
	lineItems: OrderLineItem[];
	cashierId: string;
	cashierName: string;
	origin: string;
}) {
	if (Math.round(input.amount * 100) < 100) throw new Error("GCash payments must be at least ₱1.00.");
	const paymentIntentId = `gcash_${randomUUID()}`;
	const checkoutUrl = `${input.origin.replace(/\/$/, "")}/pay/gcash/pay?id=${encodeURIComponent(paymentIntentId)}`;
	await rest("gcash_checkouts", {
		method: "POST",
		headers: { Prefer: "return=minimal" },
		body: JSON.stringify({
			id: paymentIntentId,
			cashier_id: input.cashierId,
			cashier_name: input.cashierName,
			customer_name: input.customerName,
			amount: input.amount,
			line_items: input.lineItems,
			checkout_url: checkoutUrl,
			status: "pending",
		}),
	});
	return { paymentIntentId, checkoutUrl, ...gcashMerchant() };
}

export async function loadGcashCheckout(paymentIntentId: string) {
	const result = await rest<GcashCheckoutRow[]>(`gcash_checkouts?id=eq.${encodeURIComponent(paymentIntentId)}&select=*&limit=1`, {
		cache: "no-store",
	});
	return Array.isArray(result) ? result[0] || null : null;
}

async function recordPaidCheckout(paymentIntentId: string, checkout: GcashCheckoutRow) {
	const lineItems = sanitizeLineItems(checkout.line_items);
	if (!lineItems.length) throw new Error("GCash checkout is missing items.");
	const order = await insertPaidOrder({
		customer_name: checkout.customer_name,
		amount: Number(checkout.amount),
		payment_method: "GCash",
		line_items: lineItems,
		cashier_id: checkout.cashier_id,
		cashier_name: checkout.cashier_name,
		payment_intent_id: paymentIntentId,
	});
	await rest(`gcash_checkouts?id=eq.${encodeURIComponent(paymentIntentId)}`, {
		method: "PATCH",
		headers: { Prefer: "return=minimal" },
		body: JSON.stringify({ status: "paid", order_id: order.id }),
	}).catch(() => undefined);
	await broadcastOrderRecorded(alertFromOrder(order, "new-order"));
	return { status: "paid" as const, order: mapOrder(order) };
}

export async function fulfillGcashPayment(paymentIntentId: string) {
	const existingOrder = await findOrderByPaymentIntent(paymentIntentId);
	if (existingOrder) {
		await rest(`gcash_checkouts?id=eq.${encodeURIComponent(paymentIntentId)}`, {
			method: "PATCH",
			headers: { Prefer: "return=minimal" },
			body: JSON.stringify({ status: "paid", order_id: existingOrder.id }),
		}).catch(() => undefined);
		return { status: "paid" as const, order: mapOrder(existingOrder) };
	}

	const checkout = await loadGcashCheckout(paymentIntentId);
	if (!checkout) throw new Error("GCash checkout was not found.");
	if (checkout.status === "failed") return { status: "failed" as const };
	if (checkout.status !== "paid") return { status: "pending" as const };
	return recordPaidCheckout(paymentIntentId, checkout);
}

export async function markGcashResult(paymentIntentId: string, status: "paid" | "failed") {
	if (!isGcashCheckoutId(paymentIntentId)) throw new Error("This GCash checkout cannot be confirmed.");
	const checkout = await loadGcashCheckout(paymentIntentId);
	if (!checkout) throw new Error("GCash checkout was not found.");
	if (checkout.status === "failed") return { status: "failed" as const };
	if (checkout.status === "paid" || checkout.order_id) return fulfillGcashPayment(paymentIntentId);
	await rest(`gcash_checkouts?id=eq.${encodeURIComponent(paymentIntentId)}`, {
		method: "PATCH",
		headers: { Prefer: "return=minimal" },
		body: JSON.stringify({ status }),
	});
	if (status === "failed") return { status: "failed" as const };
	return fulfillGcashPayment(paymentIntentId);
}
