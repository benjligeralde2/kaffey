import { createClient } from "@/lib/supabase/client";
import {
	PRODUCT_BROADCAST_CHANNEL,
	PRODUCT_STORAGE_KEY,
	PRODUCT_SYNC_CHANNEL,
	PRODUCT_SYNC_EVENT,
	type ProductChangeNotice,
} from "@/lib/product-sync";

const catalogListeners = new Set<() => void>();
const noticeListeners = new Set<(notice: ProductChangeNotice) => void>();
const recentNoticeAt = new Map<string, number>();
let stopSharedSubscription: (() => void) | null = null;
const NOTICE_DEDUPE_MS = 4000;

function noticeDedupeKey(notice: ProductChangeNotice) {
	return `${notice.action}:${notice.productName}`;
}

function shouldEmitNotice(notice: ProductChangeNotice) {
	const key = noticeDedupeKey(notice);
	const now = Date.now();
	const last = recentNoticeAt.get(key);
	if (last && now - last < NOTICE_DEDUPE_MS) return false;
	recentNoticeAt.set(key, now);
	return true;
}

function isProductChangeNotice(value: unknown): value is ProductChangeNotice {
	if (!value || typeof value !== "object") return false;
	const notice = value as ProductChangeNotice;
	return (notice.action === "added" || notice.action === "updated" || notice.action === "deleted") && typeof notice.productName === "string" && typeof notice.timestamp === "number";
}

function notifyCatalogListeners() {
	catalogListeners.forEach((listener) => listener());
}

function notifyNoticeListeners(notice: ProductChangeNotice) {
	noticeListeners.forEach((listener) => listener(notice));
}

function handleIncomingNotice(value: unknown) {
	notifyCatalogListeners();
	if (isProductChangeNotice(value) && shouldEmitNotice(value)) notifyNoticeListeners(value);
}

function startSharedSubscription() {
	const supabase = createClient();
	const localChannel = "BroadcastChannel" in window ? new BroadcastChannel(PRODUCT_BROADCAST_CHANNEL) : null;
	const handleStorage = (event: StorageEvent) => {
		if (event.key !== PRODUCT_STORAGE_KEY || !event.newValue) return;
		try {
			handleIncomingNotice(JSON.parse(event.newValue));
		} catch {
			notifyCatalogListeners();
		}
	};
	localChannel?.addEventListener("message", (event) => handleIncomingNotice(event.data));
	window.addEventListener("storage", handleStorage);

	const broadcastChannel = supabase
		.channel(PRODUCT_SYNC_CHANNEL, {
			config: { broadcast: { ack: false, self: true }, private: false },
		})
		.on("broadcast", { event: PRODUCT_SYNC_EVENT }, (event) => {
			handleIncomingNotice(event.payload);
		})
		.on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
			notifyCatalogListeners();
		})
		.subscribe();

	return () => {
		localChannel?.close();
		window.removeEventListener("storage", handleStorage);
		void supabase.removeChannel(broadcastChannel);
	};
}

function ensureSharedSubscription() {
	if (!stopSharedSubscription) stopSharedSubscription = startSharedSubscription();
}

function releaseSharedSubscription() {
	if (catalogListeners.size > 0 || noticeListeners.size > 0 || !stopSharedSubscription) return;
	stopSharedSubscription();
	stopSharedSubscription = null;
}

export function notifyProductChangedLocally(notice: ProductChangeNotice) {
	try {
		window.localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(notice));
	} catch {
		// Ignore private-mode storage failures; remote sync still runs.
	}
	if ("BroadcastChannel" in window) {
		const channel = new BroadcastChannel(PRODUCT_BROADCAST_CHANNEL);
		channel.postMessage(notice);
		channel.close();
	}
	handleIncomingNotice(notice);
}

export function subscribeToProductUpdates(onUpdate: () => void) {
	catalogListeners.add(onUpdate);
	ensureSharedSubscription();
	return () => {
		catalogListeners.delete(onUpdate);
		releaseSharedSubscription();
	};
}

export function subscribeToProductNotices(onNotice: (notice: ProductChangeNotice) => void) {
	noticeListeners.add(onNotice);
	ensureSharedSubscription();
	return () => {
		noticeListeners.delete(onNotice);
		releaseSharedSubscription();
	};
}
