import { NextResponse, type NextRequest } from "next/server";

import { markGcashResult } from "@/lib/gcash";
import { requireStaff } from "@/lib/pos-staff";

export async function POST(request: NextRequest) {
	try {
		const staff = await requireStaff();
		if (staff instanceof NextResponse) return staff;
		if (staff.role === "kitchen") return NextResponse.json({ error: "Kitchen accounts cannot confirm payments." }, { status: 403 });
		const body = await request.json().catch(() => ({}));
		const paymentIntentId = typeof body?.id === "string" ? body.id.trim() : "";
		if (!paymentIntentId) return NextResponse.json({ error: "A payment id is required." }, { status: 400 });
		const result = await markGcashResult(paymentIntentId, "paid");
		return NextResponse.json(result);
	} catch (error) {
		return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to confirm GCash payment." }, { status: 500 });
	}
}
