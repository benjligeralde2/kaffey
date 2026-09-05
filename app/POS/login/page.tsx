"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
	const [showPassword, setShowPassword] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");
	const [isCheckingSession, setIsCheckingSession] = useState(true);
	const [activeSessionRole, setActiveSessionRole] = useState<"admin" | "cashier" | null>(null);
	const [isSigningOut, setIsSigningOut] = useState(false);
	const formRef = useRef<HTMLFormElement>(null);
	const router = useRouter();

	useEffect(() => {
		const checkSession = async () => {
			const { data } = await createClient().auth.getUser();
			if (data.user) setActiveSessionRole(data.user.app_metadata?.role === "admin" ? "admin" : "cashier");
			setIsCheckingSession(false);
		};

		void checkSession();

		const clearLoginFields = () => formRef.current?.reset();
		clearLoginFields();
		window.addEventListener("pageshow", clearLoginFields);

		return () => window.removeEventListener("pageshow", clearLoginFields);
	}, []);

	const activeSessionPath = activeSessionRole === "admin" ? "/POS/admin-dashboard" : "/POS/cashier-dashboard/menus";

	async function handleSignOutAndContinue() {
		setIsSigningOut(true);
		const { error } = await createClient().auth.signOut();
		if (error) {
			setIsSigningOut(false);
			setErrorMessage(error.message);
			return;
		}
		setActiveSessionRole(null);
		setIsSigningOut(false);
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setIsSubmitting(true);
		setErrorMessage("");

		const formData = new FormData(event.currentTarget);
		try {
			const supabase = createClient();
			const { data, error } = await supabase.auth.signInWithPassword({
				email: String(formData.get("email")),
				password: String(formData.get("password")),
			});

			if (error) {
				setErrorMessage(error.message);
				return;
			}

			const requestedPath = new URLSearchParams(window.location.search).get("next");
			const defaultPath = data.user.app_metadata.role === "admin" ? "/POS/admin-dashboard" : "/POS/cashier-dashboard";
			const redirectPath = requestedPath?.startsWith("/POS/") ? requestedPath : defaultPath;
			router.push(redirectPath);
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : "Unable to sign in right now.");
		} finally {
			formRef.current?.reset();
			setIsSubmitting(false);
		}
	}

	return (
		<main className="login-page">
			<header className="site-header login-header">
				<nav className="site-nav content-width" aria-label="Login navigation">
					  <Link className="wordmark" href="/" aria-label="Kaffey home"><span className="wordmark-mark">K</span> kaffey<span className="wordmark-dot">.</span></Link>
					  <Link className="login-back-link" href="/">Back to kaffey <span>↗</span></Link>
				</nav>
			</header>

			{!isCheckingSession && !activeSessionRole && <section className="login-hero" aria-labelledby="login-title">
				<div className="login-content content-width">
					<div className="login-art">
						<p className="eyebrow"><span className="eyebrow-line" /> The daily pour</p>
						<img src="/coffees/Iced_Coffee_With_Milk_Splash_And_Ice_Cubes_PNG___TopPNG-removebg-preview.png" alt="Iced coffee with milk" />
						<p className="login-art-caption">Your counter, in one place <span>✦</span></p>
					</div>

					<div className="login-panel">
						<p className="eyebrow"><span className="eyebrow-line" /> Welcome back</p>
						<h1 id="login-title">Good to<br /><em>see you.</em></h1>
						<form ref={formRef} className="login-form" onSubmit={handleSubmit} autoComplete="new-password">
							<label htmlFor="email">Email address</label>
							<input id="email" name="email" type="email" autoComplete="new-password" placeholder="you@kaffey.coffee" required />
							<div className="login-label-row">
								<label htmlFor="password">Password</label>
								<a href="mailto:hello@kaffey.coffee?subject=Kaffey%20password%20help">Forgot password?</a>
							</div>
							<div className="password-input-wrap">
								<input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Enter your password" required />
								<button className="password-visibility" type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>
									{showPassword ? <EyeOff aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />}
								</button>
							</div>
							{errorMessage ? <p className="login-error" role="alert">{errorMessage}</p> : null}
							<button className="primary-button login-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? "Signing in..." : "Sign in"} <span>↗</span></button>
						</form>
						<p className="login-footer">New to the counter? <a href="mailto:hello@kaffey.coffee">Ask for access <span>↗</span></a></p>
					</div>
				</div>
			</section>}

			{activeSessionRole && (
				<div className="charge-modal-backdrop" role="presentation">
					<div className="charge-modal login-session-modal" role="dialog" aria-modal="true" aria-labelledby="active-session-title">
						<p className="pos-kicker">Active session</p>
						<h2 id="active-session-title">You are already signed in</h2>
						<p className="login-session-message">Logging out will end your current {activeSessionRole} session. Proceed?</p>
						<div className="account-modal-footer">
							<button type="button" className="account-modal-secondary" onClick={() => router.replace(activeSessionPath)}>Stay signed in</button>
							<button type="button" className="account-modal-primary" onClick={() => void handleSignOutAndContinue()} disabled={isSigningOut}>{isSigningOut ? "Logging out..." : "Proceed"}</button>
						</div>
					</div>
				</div>
			)}
		</main>
	);
}
