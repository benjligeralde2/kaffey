"use client";

import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CoffeeCluster } from "@/components/coffee-cluster";
import { beginBrewingNavigation } from "@/components/brewing-loader";
import { toastError, toastSuccess } from "@/components/ui/sonner";
import { posHomePath, resolvePostLoginPath } from "@/lib/pos-role";
import { createClient } from "@/lib/supabase/client";

function authErrorMessage(message: string) {
	if (/invalid login credentials|invalid_credentials/i.test(message)) return "The credentials are incorrect.";
	return message;
}

export default function LoginPage() {
	const [showPassword, setShowPassword] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isCheckingSession, setIsCheckingSession] = useState(true);
	const [activeSessionRole, setActiveSessionRole] = useState<"admin" | "cashier" | "kitchen" | null>(null);
	const [isSigningOut, setIsSigningOut] = useState(false);
	const formRef = useRef<HTMLFormElement>(null);
	const router = useRouter();

	useEffect(() => {
		const checkSession = async () => {
			const { data } = await createClient().auth.getUser();
			if (data.user) {
				const role = data.user.app_metadata?.role;
				setActiveSessionRole(role === "admin" || role === "kitchen" ? role : "cashier");
			}
			setIsCheckingSession(false);
		};

		void checkSession();

		const clearLoginFields = () => formRef.current?.reset();
		clearLoginFields();
		window.addEventListener("pageshow", clearLoginFields);

		return () => window.removeEventListener("pageshow", clearLoginFields);
	}, []);

	const activeSessionPath = posHomePath(activeSessionRole);

	async function handleSignOutAndContinue() {
		setIsSigningOut(true);
		const { error } = await createClient().auth.signOut();
		if (error) {
			setIsSigningOut(false);
			toastError(authErrorMessage(error.message));
			return;
		}
		setActiveSessionRole(null);
		setIsSigningOut(false);
		toastSuccess("You have been signed out.");
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setIsSubmitting(true);

		const formData = new FormData(event.currentTarget);
		try {
			const supabase = createClient();
			const { data, error } = await supabase.auth.signInWithPassword({
				email: String(formData.get("email")),
				password: String(formData.get("password")),
			});

			if (error) {
				toastError(authErrorMessage(error.message));
				formRef.current?.reset();
				setIsSubmitting(false);
				return;
			}

			const requestedPath = new URLSearchParams(window.location.search).get("next");
			const destination = resolvePostLoginPath(data.user.app_metadata.role, requestedPath);
			formRef.current?.reset();
			beginBrewingNavigation(destination);
			router.push(destination);
		} catch (error) {
			toastError(error instanceof Error ? error.message : "Unable to sign in right now.");
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

			{(isCheckingSession || isSubmitting) && (
				<div className="login-loading" role="status" aria-live="polite">
					<span className="login-loading-ring" aria-hidden="true" />
					<p>{isCheckingSession ? "Checking session" : "Signing you in"}</p>
				</div>
			)}

			{!isCheckingSession && !activeSessionRole && <section className="login-hero" aria-labelledby="login-title">
				<div className="login-content content-width">
					<div className="login-art">
						<CoffeeCluster />
					</div>

					<div className="login-panel">
						<p className="eyebrow"><span className="eyebrow-line" /> Welcome back</p>
						<h1 id="login-title">Good to<br /><em>see you.</em></h1>
						<form ref={formRef} className="login-form" onSubmit={handleSubmit} autoComplete="new-password" aria-busy={isSubmitting}>
							<div className="login-field">
								<label htmlFor="email">Email address</label>
								<input id="email" name="email" type="email" autoComplete="new-password" placeholder="you@kaffey.coffee" required disabled={isSubmitting} />
							</div>
							<div className="login-field">
								<label htmlFor="password">Password</label>
								<div className="password-input-wrap">
									<input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Enter your password" required disabled={isSubmitting} />
									<button className="password-visibility" type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)} disabled={isSubmitting}>
										{showPassword ? <EyeOff aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />}
									</button>
								</div>
							</div>
							<button className="primary-button login-submit" type="submit" disabled={isSubmitting}>
								{isSubmitting ? <><Loader2 className="login-submit-spinner" aria-hidden="true" size={16} /> Signing in</> : "Sign in"}
							</button>
						</form>
						<p className="login-footer">Forgot password? <a href="mailto:hello@kaffey.coffee?subject=Kaffey%20password%20help">Contact admin</a></p>
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
							<button type="button" className="account-modal-secondary" onClick={() => { beginBrewingNavigation(activeSessionPath); router.replace(activeSessionPath); }}>Stay signed in</button>
							<button type="button" className="account-modal-primary" onClick={() => void handleSignOutAndContinue()} disabled={isSigningOut}>{isSigningOut ? "Logging out..." : "Proceed"}</button>
						</div>
					</div>
				</div>
			)}
		</main>
	);
}
