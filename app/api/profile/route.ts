import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AVATAR_BUCKET = "profile-avatars";
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

function serviceHeaders() {
	return {
		apikey: SERVICE_ROLE_KEY!,
		Authorization: `Bearer ${SERVICE_ROLE_KEY!}`,
		"Content-Type": "application/json",
	};
}

async function ensureAvatarBucket() {
	const response = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
		method: "POST",
		headers: serviceHeaders(),
		body: JSON.stringify({
			id: AVATAR_BUCKET,
			name: AVATAR_BUCKET,
			public: true,
			file_size_limit: AVATAR_MAX_BYTES,
			allowed_mime_types: ["image/png", "image/jpeg", "image/jpg", "image/webp"],
		}),
	});
	if (response.ok) return;
	const result = await response.json().catch(() => ({}));
	const message = String(result?.message || result?.error || "");
	if (response.status !== 409 && !message.toLowerCase().includes("already exists")) {
		throw new Error(message || "Unable to prepare profile photo storage.");
	}
}

async function uploadAvatar(image: string, userId: string) {
	const match = image.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i);
	if (!match) throw new Error("Choose a PNG, JPG, or WEBP photo.");
	const mimeType = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase();
	const imageBytes = Buffer.from(match[2], "base64");
	if (imageBytes.byteLength > AVATAR_MAX_BYTES) {
		throw new Error("The profile photo must be smaller than 2 MB.");
	}
	await ensureAvatarBucket();
	const extension = mimeType.split("/")[1];
	const objectPath = `${userId}-${Date.now()}.${extension}`;
	const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${AVATAR_BUCKET}/${objectPath}`, {
		method: "POST",
		headers: {
			...serviceHeaders(),
			"Content-Type": mimeType,
			"x-upsert": "true",
		},
		body: new Uint8Array(imageBytes),
	});
	const result = await response.json().catch(() => ({}));
	if (!response.ok) throw new Error(result?.message || "Unable to upload profile photo.");
	return `${SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${objectPath}`;
}

export async function PUT(request: NextRequest) {
	if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
		return NextResponse.json({ error: "Supabase configuration is missing." }, { status: 500 });
	}

	try {
		const supabase = await createClient();
		const { data, error } = await supabase.auth.getUser();
		if (error || !data.user || !["admin", "cashier"].includes(data.user.app_metadata?.role)) {
			return NextResponse.json({ error: "Staff access is required." }, { status: 401 });
		}

		const body = await request.json();
		const firstName = typeof body?.firstName === "string" ? body.firstName.trim() : "";
		const lastName = typeof body?.lastName === "string" ? body.lastName.trim() : "";
		const email = typeof body?.email === "string" ? body.email.trim() : "";
		const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
		const birthday = typeof body?.birthday === "string" ? body.birthday.trim() : "";
		const gender = typeof body?.gender === "string" ? body.gender.trim() : "";
		const address = typeof body?.address === "string" ? body.address.trim() : "";
		const station = typeof body?.station === "string" ? body.station.trim() : "";
		const image = typeof body?.image === "string" ? body.image : undefined;
		const fullName = [firstName, lastName].filter(Boolean).join(" ");

		if (!firstName || !lastName) {
			return NextResponse.json({ error: "First name and last name are required." }, { status: 400 });
		}
		if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
		}
		if (phone && !/^[0-9+\-\s()]{7,20}$/.test(phone)) {
			return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
		}

		const currentAvatar = String(data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture || "");
		let avatarUrl = currentAvatar;
		if (image === "") avatarUrl = "";
		else if (image?.startsWith("data:")) avatarUrl = await uploadAvatar(image, data.user.id);

		const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${data.user.id}`, {
			method: "PUT",
			headers: serviceHeaders(),
			body: JSON.stringify({
				email,
				user_metadata: {
					...(data.user.user_metadata ?? {}),
					full_name: fullName,
					name: fullName,
					first_name: firstName,
					last_name: lastName,
					phone,
					birthday,
					gender,
					address,
					station,
					avatar_url: avatarUrl,
				},
			}),
		});
		const result = await response.json().catch(() => ({}));
		if (!response.ok) {
			return NextResponse.json({ error: result?.msg || result?.message || "Unable to update profile." }, { status: response.status || 500 });
		}

		return NextResponse.json({
			success: true,
			emailChanged: email.toLowerCase() !== (data.user.email || "").toLowerCase(),
		});
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Unable to update profile." },
			{ status: 500 },
		);
	}
}
