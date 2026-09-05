const requiredVariables = [
	"NEXT_PUBLIC_SUPABASE_URL",
	"SUPABASE_SERVICE_ROLE_KEY",
	"ADMIN_EMAIL",
	"ADMIN_PASSWORD",
];

const missingVariables = requiredVariables.filter((name) => !process.env[name]);
if (missingVariables.length > 0) {
	console.error(`Missing environment variables: ${missingVariables.join(", ")}`);
	process.exit(1);
}

const headers = {
	apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
	Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
	"Content-Type": "application/json",
};

const usersResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, { headers });
const usersResult = await usersResponse.json();
const existingUser = usersResult.users?.find((user) => user.email?.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase());

const response = existingUser
	? await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${existingUser.id}`, {
			method: "PUT",
			headers,
			body: JSON.stringify({
				password: process.env.ADMIN_PASSWORD,
				email_confirm: true,
				app_metadata: { ...existingUser.app_metadata, role: "admin" },
			}),
		})
	: await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`, {
			method: "POST",
			headers,
			body: JSON.stringify({
				email: process.env.ADMIN_EMAIL,
				password: process.env.ADMIN_PASSWORD,
				email_confirm: true,
				app_metadata: { role: "admin" },
			}),
		});

const result = await response.json();
if (!response.ok) {
	console.error(`Could not create admin account: ${result.msg || result.message || "Unknown Supabase error"}`);
	process.exit(1);
}

console.log(`${existingUser ? "Admin account updated" : "Admin account created"}: ${result.email} (${result.id})`);