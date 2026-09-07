export const ORDER_SYNC_CHANNEL = "kaffey-order-updates";
export const ORDER_SYNC_EVENT = "order-recorded";
export const ORDER_ALERT_CHANNEL = "kaffey-order-alerts";
export const ORDER_ALERT_EVENT = "order-alert";
export const ORDER_STORAGE_KEY = "kaffey-order-notification";
export const ORDER_BROADCAST_CHANNEL = "kaffey-orders";
export const ORDER_ALERT_BROADCAST_CHANNEL = "kaffey-order-alert-tabs";
export const ORDER_ALERT_STORAGE_KEY = "kaffey-order-alert";

export type OrderAlertType = "new-order" | "order-finished";

export type OrderAlert = {
	type: OrderAlertType;
	orderId: string;
	customerName: string;
	items: string;
	timestamp: number;
};
