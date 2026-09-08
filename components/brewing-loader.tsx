"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

type BrewingSnapshot = {
	active: boolean;
	href: string;
	routeReached: boolean;
	destinationReady: boolean;
	waiters: number;
};

const WAIT_CAP = 90;
const listeners = new Set<() => void>();

let snapshot: BrewingSnapshot = {
	active: false,
	href: "",
	routeReached: false,
	destinationReady: false,
	waiters: 0,
};

function emit() {
	for (const listener of listeners) listener();
}

function setSnapshot(next: Partial<BrewingSnapshot>) {
	snapshot = { ...snapshot, ...next };
	emit();
}

export function beginBrewingNavigation(href: string) {
	setSnapshot({
		active: true,
		href,
		routeReached: false,
		destinationReady: false,
	});
}

export function markBrewingDestinationReady() {
	if (!snapshot.active || snapshot.destinationReady) return;
	setSnapshot({ destinationReady: true });
}

export function useBrewingReady(isReady: boolean) {
	useEffect(() => {
		if (!snapshot.active) return;
		setSnapshot({ waiters: snapshot.waiters + 1 });
		return () => setSnapshot({ waiters: Math.max(0, snapshot.waiters - 1) });
	}, []);

	useEffect(() => {
		if (!isReady) return;
		let cancelled = false;
		const frame = window.requestAnimationFrame(() => {
			window.requestAnimationFrame(() => {
				if (!cancelled) markBrewingDestinationReady();
			});
		});
		return () => {
			cancelled = true;
			window.cancelAnimationFrame(frame);
		};
	}, [isReady]);
}

function CoffeeBean() {
	return (
		<svg className="brew-bean" viewBox="0 0 32 20" aria-hidden="true">
			<ellipse cx="16" cy="10" rx="13" ry="8" fill="#c4a07a" />
			<path d="M16 3c2.4 3.2 2.6 10.6 0 14" fill="none" stroke="#8d6244" strokeWidth="1.4" strokeLinecap="round" />
		</svg>
	);
}

const INNER_HEIGHT = 148;

function BrewingMug({ clipId }: { clipId: string }) {
	return (
		<div className="brew-mug">
			<svg className="brew-mug-svg" viewBox="0 0 220 240" aria-hidden="true">
				<defs>
					<clipPath id={clipId}>
						<path d="M58 42h88c8 0 14 6 14 14v112c0 24-20 44-44 44H88c-24 0-44-20-44-44V56c0-8 6-14 14-14z" />
					</clipPath>
					<linearGradient id={`${clipId}-glass`} x1="0" y1="0" x2="1" y2="1">
						<stop offset="0%" stopColor="rgba(255,255,255,.28)" />
						<stop offset="50%" stopColor="rgba(255,255,255,.08)" />
						<stop offset="100%" stopColor="rgba(255,255,255,.16)" />
					</linearGradient>
					<linearGradient id={`${clipId}-coffee`} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor="#5c2e1c" />
						<stop offset="55%" stopColor="#3a1c12" />
						<stop offset="100%" stopColor="#24110b" />
					</linearGradient>
				</defs>
				<g clipPath={`url(#${clipId})`}>
					<g className="brew-coffee-rise" transform="translate(0 136)">
						<rect x="40" y="42" width="130" height="164" fill={`url(#${clipId}-coffee)`} />
						<ellipse className="brew-foam" cx="102" cy="50" rx="46" ry="8" fill="#7a4a32" opacity=".92" />
						<ellipse cx="102" cy="48" rx="28" ry="4" fill="#c4a07a" opacity=".32" />
					</g>
				</g>
				<path d="M58 42h88c8 0 14 6 14 14v112c0 24-20 44-44 44H88c-24 0-44-20-44-44V56c0-8 6-14 14-14z" fill={`url(#${clipId}-glass)`} stroke="rgba(255,255,255,.72)" strokeWidth="3" />
				<path d="M160 78c28 4 42 28 32 58-8 22-30 32-48 28" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="8" strokeLinecap="round" />
				<path d="M72 52c18-2 48-2 68 6" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="2" strokeLinecap="round" />
			</svg>
			<span className="brew-percent">8%</span>
		</div>
	);
}

export function BrewingLoader() {
	const pathname = usePathname();
	const clipId = useId().replace(/:/g, "");
	const [view, setView] = useState(snapshot);
	const [leaving, setLeaving] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);
	const startedAt = useRef(0);
	const finishStarted = useRef(false);
	const visualProgress = useRef(8);
	const lastStamp = useRef(0);
	const leaveTimer = useRef(0);

	useEffect(() => {
		const sync = () => setView({ ...snapshot });
		listeners.add(sync);
		return () => {
			listeners.delete(sync);
		};
	}, []);

	useEffect(() => {
		if (!view.active || !view.href) return;
		if (pathname === view.href) setSnapshot({ routeReached: true });
	}, [pathname, view.active, view.href]);

	useEffect(() => {
		if (!view.active) return;
		startedAt.current = performance.now();
		finishStarted.current = false;
		visualProgress.current = 8;
		lastStamp.current = 0;
		setLeaving(false);
	}, [view.active]);

	useEffect(() => {
		if (!view.active || !view.routeReached || view.waiters > 0) return;
		const timer = window.setTimeout(() => markBrewingDestinationReady(), 1600);
		return () => window.clearTimeout(timer);
	}, [view.active, view.routeReached, view.waiters]);

	useEffect(() => {
		if (!view.active) return;
		const failSafe = window.setTimeout(() => markBrewingDestinationReady(), 12000);
		return () => window.clearTimeout(failSafe);
	}, [view.active]);

	useEffect(() => {
		if (!view.active) return;
		let frame = 0;

		const applyVisual = (value: number) => {
			const fill = Math.min(100, Math.max(6, value));
			const offset = INNER_HEIGHT * (1 - fill / 100);
			const root = rootRef.current;
			if (!root) return;
			const coffee = root.querySelector<SVGGElement>(".brew-coffee-rise");
			const percent = root.querySelector<HTMLSpanElement>(".brew-percent");
			const pour = root.querySelector<HTMLElement>(".brew-pour");
			if (coffee) coffee.setAttribute("transform", `translate(0 ${offset})`);
			if (percent) percent.textContent = `${Math.round(fill)}%`;
			if (pour) pour.classList.toggle("is-done", fill >= 97);
			root.setAttribute("aria-valuenow", String(Math.round(fill)));
		};

		const tick = (now: number) => {
			const current = snapshot;
			if (!current.active) return;

			const dt = lastStamp.current ? Math.min(0.05, (now - lastStamp.current) / 1000) : 0.016;
			lastStamp.current = now;

			const canFinish = current.routeReached && current.destinationReady && now - startedAt.current >= 900;
			if (canFinish) finishStarted.current = true;

			const target = finishStarted.current ? 100 : WAIT_CAP;
			const smoothing = finishStarted.current ? 5.2 : 1.15;
			const visual = visualProgress.current;
			visualProgress.current = visual + (target - visual) * (1 - Math.exp(-dt * smoothing));

			applyVisual(visualProgress.current);

			if (finishStarted.current && visualProgress.current >= 99.6) {
				applyVisual(100);
				setLeaving(true);
				window.clearTimeout(leaveTimer.current);
				leaveTimer.current = window.setTimeout(() => {
					setSnapshot({
						active: false,
						href: "",
						routeReached: false,
						destinationReady: false,
						waiters: 0,
					});
					setLeaving(false);
				}, 480);
				return;
			}

			frame = window.requestAnimationFrame(tick);
		};

		applyVisual(visualProgress.current);
		frame = window.requestAnimationFrame(tick);
		return () => {
			window.cancelAnimationFrame(frame);
			window.clearTimeout(leaveTimer.current);
		};
	}, [view.active]);

	if (!view.active && !leaving) return null;

	return (
		<div
			ref={rootRef}
			className={`brew-loader${leaving ? " is-leaving" : ""}`}
			role="status"
			aria-live="polite"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={8}
		>
			<span className="brew-pour" />
			<BrewingMug clipId={`brew-mug-${clipId}`} />
			<h2>Brewing something great...</h2>
			<p>Just a moment, we&apos;re getting things ready for you.</p>
			<div className="brew-rule">
				<span />
				<CoffeeBean />
				<span />
			</div>
		</div>
	);
}
