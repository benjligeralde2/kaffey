import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function hasSupabaseConfig() {
	return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export async function proxy(request: NextRequest) {
	if (!hasSupabaseConfig()) {
		return NextResponse.next({ request });
	}

	let response = NextResponse.next({ request });
	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
		{
			cookies: {
				getAll() {
					return request.cookies.getAll();
				},
				setAll(cookiesToSet) {
					cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
					response = NextResponse.next({ request });
					cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
				},
			},
		},
	);

	const { data: { user } } = await supabase.auth.getUser();
	if (!user) {
		const loginUrl = request.nextUrl.clone();
		loginUrl.pathname = "/POS/login";
		loginUrl.searchParams.set("next", request.nextUrl.pathname);
		return NextResponse.redirect(loginUrl);
	}

	const isAdmin = user.app_metadata.role === "admin";
	const isAdminRoute = request.nextUrl.pathname.startsWith("/POS/admin-dashboard");
	const isCashierRoute = request.nextUrl.pathname.startsWith("/POS/cashier-dashboard");
	if (isAdminRoute && !isAdmin) {
		return NextResponse.redirect(new URL("/POS/cashier-dashboard", request.url));
	}
	if (isCashierRoute && isAdmin) {
		return NextResponse.redirect(new URL("/POS/admin-dashboard", request.url));
	}

	return response;
}

export const config = {
	matcher: ["/POS/cashier-dashboard/:path*", "/POS/admin-dashboard/:path*"],
};
