import { ORDER_ALERT_CHANNEL, ORDER_ALERT_EVENT, ORDER_SYNC_CHANNEL, ORDER_SYNC_EVENT, type OrderAlert } from "@/lib/order-sync";
import { normalizeStatus } from "@/lib/order-status";

export const PAYMENT_METHODS = ["Cash", "GCash"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type OrderLineItem = {
	name: string;
	detail: string;
	quantity: number;
	price: number;
	image?: string;
};

export type OrderRow = {
	id: string;
	order_number: number;
	customer_name: string;
	amount: number;
	payment_method: PaymentMethod;
	order_type: "Dine-in";
	table_number: string;
	line_items: OrderLineItem[];
	cashier_id?: string | null;
	cashier_name?: string | null;
	status?: string | null;
	payment_intent_id?: string | null;
	created_at: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function serviceHeaders() {
	return {
		apikey: SERVICE_ROLE_KEY!,
		Authorization: `Bearer ${SERVICE_ROLE_KEY!}`,
		"Content-Type": "application/json",
	};
}

export function sanitizeLineItems(raw: unknown): OrderLineItem[] {
	if (!Array.isArray(raw)) return [];
	return raw.flatMap((item) => {
		if (!item || typeof item !== "object") return [];
		const record = item as Record<string, unknown>;
		const name = typeof record.name === "string" ? record.name.trim() : "";
		const detail = typeof record.detail === "string" ? record.detail.trim() : "";
		const quantity = Number(record.quantity);
		const price = Number(record.price);
		if (!name || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0) return [];
		const image = typeof record.image === "string" ? record.image : undefined;
		return [{ name, detail, quantity, price, ...(image ? { image } : {}) }];
	});
}

export function mapOrder(order: OrderRow) {
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

export function alertFromOrder(order: OrderRow, type: OrderAlert["type"]): OrderAlert {
	const mapped = mapOrder(order);
	return {
		type,
		orderId: mapped.recordId || mapped.id,
		customerName: mapped.name,
		items: mapped.items,
		timestamp: Date.now(),
	};
}

export async function broadcastOrderRecorded(alert?: OrderAlert) {
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

export async function insertPaidOrder(record: {
	customer_name: string;
	amount: number;
	payment_method: PaymentMethod;
	line_items: OrderLineItem[];
	cashier_id: string;
	cashier_name: string;
	payment_intent_id?: string;
}) {
	if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("Supabase configuration is missing.");
	const payload = {
		customer_name: record.customer_name,
		amount: record.amount,
		payment_method: record.payment_method,
		order_type: "Dine-in",
		table_number: "Counter",
		line_items: record.line_items,
		status: "Pending",
		cashier_id: record.cashier_id,
		cashier_name: record.cashier_name,
		...(record.payment_intent_id ? { payment_intent_id: record.payment_intent_id } : {}),
	};

	const post = async (body: object) => {
		const response = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
			method: "POST",
			headers: { ...serviceHeaders(), Prefer: "return=representation" },
			body: JSON.stringify(body),
		});
		const result = await response.json().catch(() => ({}));
		return { response, result };
	};

	let currentPayload: Record<string, unknown> = payload;
	let { response, result } = await post(currentPayload);
	const errorMessage = () => String((result as { message?: string; details?: string })?.message || (result as { details?: string })?.details || "").toLowerCase();
	const errorCode = () => String((result as { code?: string })?.code || "");
	const isDuplicate = () => response.status === 409 || errorCode() === "23505" || errorMessage().includes("duplicate") || errorMessage().includes("unique");
	const missingColumn = (name: string) => {
		const message = errorMessage();
		return message.includes(name) && (message.includes("does not exist") || message.includes("schema cache") || message.includes("could not find"));
	};

	if (!response.ok && missingColumn("status")) {
		const { status: _status, ...withoutStatus } = currentPayload;
		currentPayload = withoutStatus;
		({ response, result } = await post(currentPayload));
	}
	if (!response.ok && missingColumn("payment_intent")) {
		const { payment_intent_id: _paymentIntentId, ...withoutIntent } = currentPayload;
		currentPayload = withoutIntent;
		({ response, result } = await post(currentPayload));
	}
	if (!response.ok) {
		if (isDuplicate() && record.payment_intent_id) {
			const existing = await findOrderByPaymentIntent(record.payment_intent_id);
			if (existing) return existing;
		}
		throw new Error((result as { message?: string })?.message || "Unable to record order.");
	}
	const order = Array.isArray(result) ? result[0] : result;
	return order as OrderRow;
}

export async function findOrderByPaymentIntent(paymentIntentId: string) {
	if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
	const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?payment_intent_id=eq.${encodeURIComponent(paymentIntentId)}&select=*&limit=1`, {
		headers: serviceHeaders(),
		cache: "no-store",
	});
	const rows = await response.json().catch(() => []);
	return Array.isArray(rows) && rows[0] ? (rows[0] as OrderRow) : null;
}
