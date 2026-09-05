"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function CashierDashboardPage() {
	const [progress, setProgress] = useState(0);
	const router = useRouter();

	useEffect(() => {
		const timer = window.setInterval(() => {
			setProgress((current) => {
				const next = Math.min(current + 4, 100);
				if (next === 100) {
					window.clearInterval(timer);
					window.setTimeout(() => router.replace("/POS/cashier-dashboard/menus"), 220);
				}
				return next;
			});
		}, 90);

		return () => window.clearInterval(timer);
	}, [router]);

	return (
		<section className="cashier-launch-screen" aria-labelledby="cashier-launch-title" aria-live="polite">
			<div className="cashier-launch-mark" aria-hidden="true">K</div>
			<p className="pos-kicker">Cashier workspace</p>
			<h1 id="cashier-launch-title">Opening Menus</h1>
			<p className="cashier-launch-message">Preparing your counter for the next order.</p>
			<div className="cashier-launch-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
				<span style={{ width: `${progress}%` }} />
			</div>
			<div className="cashier-launch-meta"><span>Loading workspace</span><strong>{progress}%</strong></div>
		</section>
	);
}