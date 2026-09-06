import { createClient } from "@/lib/supabase/client";
import {
	ORDER_BROADCAST_CHANNEL,
	ORDER_STORAGE_KEY,
	ORDER_SYNC_CHANNEL,
	ORDER_SYNC_EVENT,
} from "@/lib/order-sync";

const listeners = new Set<() => void>();
let stopSharedSubscription: (() => void) | null = null;

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
		config: { broadcast: { ack: true, self: true }, private: false },
	});
	await channel.send({ type: "broadcast", event: ORDER_SYNC_EVENT, payload: { timestamp: Date.now() } });
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
