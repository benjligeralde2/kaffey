export const ORDER_STATUSES = ["Pending", "On process", "Finished"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function normalizeStatus(status?: string | null): OrderStatus {
	if (status === "Approved") return "Finished";
	return ORDER_STATUSES.includes(status as OrderStatus) ? (status as OrderStatus) : "Pending";
}

export function nextOrderStatus(status: OrderStatus): OrderStatus | null {
	if (status === "Pending") return "On process";
	if (status === "On process") return "Finished";
	return null;
}

export function statusPillClass(status: OrderStatus) {
	if (status === "On process") return "on-process";
	if (status === "Finished") return "finished";
	return "pending";
}
