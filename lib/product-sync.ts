export const PRODUCT_SYNC_CHANNEL = "cashier-product-notifications";
export const PRODUCT_SYNC_EVENT = "product-updated";
export const PRODUCT_BROADCAST_CHANNEL = "kaffey-product-notifications";
export const PRODUCT_STORAGE_KEY = "kaffey-product-notification";

export type ProductChangeAction = "added" | "updated" | "deleted";

export type ProductChangeNotice = {
	source?: "admin-product-save";
	action: ProductChangeAction;
	productName: string;
	details: string;
	timestamp: number;
};
