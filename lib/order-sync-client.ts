import { createClient } from "@/lib/supabase/client";
import {
	ORDER_ALERT_BROADCAST_CHANNEL,
	ORDER_ALERT_CHANNEL,
	ORDER_ALERT_EVENT,
	ORDER_ALERT_STORAGE_KEY,
	ORDER_BROADCAST_CHANNEL,
	ORDER_STORAGE_KEY,
	ORDER_SYNC_CHANNEL,
	ORDER_SYNC_EVENT,
	type OrderAlert,
} from "@/lib/order-sync";

const listeners = new Set<() => void>();
const alertListeners = new Set<(alert: OrderAlert) => void>();
let stopSharedSubscription: (() => void) | null = null;
let stopAlertSubscription: (() => void) | null = null;

function isOrderAlert(value: unknown): value is OrderAlert {
	if (!value || typeof value !== "object") return false;
	const alert = value as OrderAlert;
	return (alert.type === "new-order" || alert.type === "order-finished") && typeof alert.customerName === "string" && typeof alert.timestamp === "number";
}

function notifyListeners() {
	listeners.forEach((listener) => listener());
}

function startSharedSubscription() {
	const supabase = createClient();
	const localChannel = "BroadcastChannel" in window ? new BroadcastChannel(ORDER_BROADCAST_CHANNEL) : null;
	const handleStorage = (event: StorageEvent) => {
		if (event.key === ORDER_STORAGE_KEY) notifyListeners();
	};
	localChannel?.addEventListener("message", notifyListeners);
	window.addEventListener("storage", handleStorage);
	const broadcastChannel = supabase
		.channel(ORDER_SYNC_CHANNEL, {
			config: { broadcast: { ack: false, self: true }, private: false },
		})
		.on("broadcast", { event: ORDER_SYNC_EVENT }, notifyListeners)
		.subscribe();
	const databaseChannel = supabase
		.channel("kaffey-order-rows")
		.on("postgres_changes", { event: "*", schema: "public", table: "orders" }, notifyListeners)
		.subscribe();

	return () => {
		localChannel?.removeEventListener("message", notifyListeners);
		localChannel?.close();
		window.removeEventListener("storage", handleStorage);
		void supabase.removeChannel(broadcastChannel);
		void supabase.removeChannel(databaseChannel);
	};
}

export function notifyOrderRecordedLocally() {
	try {
		window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify({ timestamp: Date.now() }));
	} catch {
		// Ignore private-mode storage failures; remote sync still runs.
	}
	if (!("BroadcastChannel" in window)) return;
	const channel = new BroadcastChannel(ORDER_BROADCAST_CHANNEL);
	channel.postMessage({ type: ORDER_SYNC_EVENT });
	channel.close();
	notifyListeners();
}

export async function notifyOrderRecordedRemotely() {
	notifyListeners();
	const supabase = createClient();
	const channel = supabase.channel(ORDER_SYNC_CHANNEL, {
		config: { broadcast: { ack: false, self: true }, private: false },
	});
	try {
		await channel.httpSend(ORDER_SYNC_EVENT, { timestamp: Date.now() });
	} finally {
		void supabase.removeChannel(channel);
	}
}

export function subscribeToOrderUpdates(onUpdate: () => void) {
	listeners.add(onUpdate);
	if (!stopSharedSubscription) stopSharedSubscription = startSharedSubscription();
	return () => {
		listeners.delete(onUpdate);
		if (listeners.size > 0 || !stopSharedSubscription) return;
		stopSharedSubscription();
		stopSharedSubscription = null;
	};
}

function notifyAlertListeners(alert: OrderAlert) {
	alertListeners.forEach((listener) => listener(alert));
}

function startAlertSubscription() {
	const supabase = createClient();
	const localChannel = "BroadcastChannel" in window ? new BroadcastChannel(ORDER_ALERT_BROADCAST_CHANNEL) : null;
	const handleStorage = (event: StorageEvent) => {
		if (event.key !== ORDER_ALERT_STORAGE_KEY || !event.newValue) return;
		try {
			const alert = JSON.parse(event.newValue) as OrderAlert;
			if (isOrderAlert(alert)) notifyAlertListeners(alert);
		} catch {
			return;
		}
	};
	const handleLocalAlert = (event: MessageEvent<OrderAlert>) => {
		if (isOrderAlert(event.data)) notifyAlertListeners(event.data);
	};
	localChannel?.addEventListener("message", handleLocalAlert);
	window.addEventListener("storage", handleStorage);
	const alertChannel = supabase
		.channel(ORDER_ALERT_CHANNEL, {
			config: { broadcast: { ack: false, self: true }, private: false },
		})
		.on("broadcast", { event: ORDER_ALERT_EVENT }, (event) => {
			if (isOrderAlert(event.payload)) notifyAlertListeners(event.payload);
		})
		.subscribe();

	return () => {
		localChannel?.removeEventListener("message", handleLocalAlert);
		localChannel?.close();
		window.removeEventListener("storage", handleStorage);
		void supabase.removeChannel(alertChannel);
	};
}

export function subscribeToOrderAlerts(onAlert: (alert: OrderAlert) => void) {
	alertListeners.add(onAlert);
	if (!stopAlertSubscription) stopAlertSubscription = startAlertSubscription();
	return () => {
		alertListeners.delete(onAlert);
		if (alertListeners.size > 0 || !stopAlertSubscription) return;
		stopAlertSubscription();
		stopAlertSubscription = null;
	};
}
