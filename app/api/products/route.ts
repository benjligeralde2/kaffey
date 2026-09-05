import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ProductRow = {
	id: string;
	name: string;
	category: "Coffee" | "Tea" | "Refreshers";
	description: string;
	price: number;
	image: string;
	tag?: string | null;
};

function getServiceHeaders() {
	return {
		apikey: SERVICE_ROLE_KEY!,
		Authorization: `Bearer ${SERVICE_ROLE_KEY!}`,
		"Content-Type": "application/json",
	};
}

async function requireStaff() {
	const supabase = await createClient();
	const { data, error } = await supabase.auth.getUser();

	if (error || !data.user || !["admin", "cashier"].includes(data.user.app_metadata?.role)) {
		throw new Error("Staff access is required.");
	}
}

async function requireAdmin() {
	const supabase = await createClient();
	const { data, error } = await supabase.auth.getUser();

	if (error || !data.user || data.user.app_metadata?.role !== "admin") {
		throw new Error("Admin access is required.");
	}
}

function mapProduct(product: ProductRow) {
	return {
		id: product.id,
		name: product.name,
		category: product.category,
		description: product.description,
		price: Number(product.price),
		image: product.image,
		tag: product.tag || undefined,
	};
}

export async function GET() {
	if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
		return NextResponse.json({ error: "Supabase configuration is missing." }, { status: 500 });
	}

	try {
		await requireStaff();
		const response = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,name,category,description,price,image,tag&order=created_at.desc`, {
			headers: getServiceHeaders(),
			cache: "no-store",
		});
		const result = await response.json().catch(() => ({}));

		if (!response.ok) {
			return NextResponse.json({ error: result?.message || "Unable to load products." }, { status: response.status || 500 });
		}

		return NextResponse.json({ products: Array.isArray(result) ? result.map(mapProduct) : [] });
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error loading products." }, { status: 500 });
	}
}

export async function POST(request: NextRequest) {
	if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
		return NextResponse.json({ error: "Supabase configuration is missing." }, { status: 500 });
	}

	try {
		await requireAdmin();
		const body = await request.json();
		const name = typeof body?.name === "string" ? body.name.trim() : "";
		const category = body?.category;
		const description = typeof body?.description === "string" ? body.description.trim() : "";
		const price = typeof body?.price === "number" ? body.price : Number(body?.price);
		const image = typeof body?.image === "string" ? body.image : "";
		const tag = typeof body?.tag === "string" ? body.tag.trim() : null;

		if (!name || !["Coffee", "Tea", "Refreshers"].includes(category) || !description || !Number.isFinite(price) || price < 0 || !image) {
			return NextResponse.json({ error: "Name, category, description, price, and image are required." }, { status: 400 });
		}

		if (image.startsWith("data:") && image.length > 5_000_000) {
			return NextResponse.json({ error: "The selected image must be smaller than 5 MB." }, { status: 400 });
		}

		const response = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
			method: "POST",
			headers: { ...getServiceHeaders(), Prefer: "return=representation" },
			body: JSON.stringify({ name, category, description, price, image, tag }),
		});
		const result = await response.json().catch(() => ({}));

		if (!response.ok) {
			return NextResponse.json({ error: result?.message || "Unable to save product." }, { status: response.status || 500 });
		}

		const product = Array.isArray(result) ? result[0] : result;
		return NextResponse.json({ product: mapProduct(product) }, { status: 201 });
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error saving product." }, { status: 500 });
	}
}

export async function PUT(request: NextRequest) {
	if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
		return NextResponse.json({ error: "Supabase configuration is missing." }, { status: 500 });
	}

	try {
		await requireAdmin();
		const body = await request.json();
		const id = typeof body?.id === "string" ? body.id.trim() : "";
		const name = typeof body?.name === "string" ? body.name.trim() : "";
		const category = body?.category;
		const description = typeof body?.description === "string" ? body.description.trim() : "";
		const price = typeof body?.price === "number" ? body.price : Number(body?.price);
		const image = typeof body?.image === "string" ? body.image : "";
		const tag = typeof body?.tag === "string" ? body.tag.trim() : null;

		if (!id || !name || !["Coffee", "Tea", "Refreshers"].includes(category) || !description || !Number.isFinite(price) || price < 0 || !image) {
			return NextResponse.json({ error: "Product ID, name, category, description, price, and image are required." }, { status: 400 });
		}

		if (image.startsWith("data:") && image.length > 5_000_000) {
			return NextResponse.json({ error: "The selected image must be smaller than 5 MB." }, { status: 400 });
		}

		const response = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
			method: "PATCH",
			headers: { ...getServiceHeaders(), Prefer: "return=representation" },
			body: JSON.stringify({ name, category, description, price, image, tag }),
		});
		const result = await response.json().catch(() => ({}));

		if (!response.ok) {
			return NextResponse.json({ error: result?.message || "Unable to update product." }, { status: response.status || 500 });
		}

		const product = Array.isArray(result) ? result[0] : result;
		if (!product) return NextResponse.json({ error: "Product was not found." }, { status: 404 });
		return NextResponse.json({ product: mapProduct(product) });
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected error updating product." }, { status: 500 });
	}
}
