"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

function GcashPayForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const id = searchParams.get("id")?.trim() || "";
	const [amount, setAmount] = useState<number | null>(null);
	const [customerName, setCustomerName] = useState("");
	const [merchantName, setMerchantName] = useState("Kaffey");
	const [merchantNumber, setMerchantNumber] = useState("");
	const [status, setStatus] = useState("pending");
	const [error, setError] = useState("");
	const [isBusy, setIsBusy] = useState(false);

	useEffect(() => {
		if (!id) {
			setError("This GCash checkout link is missing.");
			return;
		}
		let cancelled = false;
		void fetch(`/api/payments/gcash/local?id=${encodeURIComponent(id)}`, { cache: "no-store" })
			.then(async (response) => {
				const payload = await response.json().catch(() => ({}));
				if (!response.ok) throw new Error(payload.error || "Unable to load this checkout.");
				if (cancelled) return;
				setAmount(Number(payload.amount));
				setCustomerName(typeof payload.customerName === "string" ? payload.customerName : "");
				setMerchantName(typeof payload.name === "string" && payload.name ? payload.name : "Kaffey");
				setMerchantNumber(typeof payload.number === "string" ? payload.number : "");
				setStatus(typeof payload.status === "string" ? payload.status : "pending");
			})
			.catch((loadError) => {
				if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load this checkout.");
			});
		return () => {
			cancelled = true;
		};
	}, [id]);

	const submit = async () => {
		setIsBusy(true);
		setError("");
		try {
			const response = await fetch("/api/payments/gcash/local", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id, result: "paid" }),
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(payload.error || "Unable to finish this payment.");
			router.replace("/pay/gcash/complete");
		} catch (submitError) {
			setError(submitError instanceof Error ? submitError.message : "Unable to finish this payment.");
		} finally {
			setIsBusy(false);
		}
	};

	return (
		<main className="gcash-complete-page">
			<section>
				<p className="pos-kicker">GCash</p>
				<h1>{status === "failed" ? "Payment cancelled" : `Pay ${merchantName}`}</h1>
				<p>Send the amount below with GCash, then tap that you have paid. The cashier can also confirm at the counter.</p>
				{amount != null && (
					<p className="gcash-pay-amount">
						<strong>₱{amount.toFixed(2)}</strong>
						{customerName ? <span> for {customerName}</span> : null}
					</p>
				)}
				{merchantNumber ? <p className="gcash-merchant-number">GCash: {merchantNumber}</p> : null}
				{error && <p className="payment-error" role="alert">{error}</p>}
				{status === "pending" && (
					<div className="gcash-pay-actions">
						<Button type="button" disabled={isBusy || !id} onClick={() => void submit()}>{isBusy ? "Confirming..." : "I've sent the payment"}</Button>
					</div>
				)}
			</section>
		</main>
	);
}

export default function GcashPayPage() {
	return (
		<Suspense fallback={<main className="gcash-complete-page"><section><p className="pos-kicker">GCash</p><h1>Pay Kaffey</h1></section></main>}>
			<GcashPayForm />
		</Suspense>
	);
}
