import { kaffeyIconImage } from "@/lib/kaffey-icon";

const sizes = new Set([192, 512]);

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
	const { size } = await params;
	const pixels = Number(size);

	if (!sizes.has(pixels)) {
		return new Response("Not found", { status: 404 });
	}

	return kaffeyIconImage(pixels, pixels === 512 ? "maskable" : "any");
}
