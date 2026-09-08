"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

let startNavigation: (() => void) | null = null;

export function startNavigationProgress() {
  startNavigation?.();
}

function isInternalPathChange(anchor: HTMLAnchorElement) {
  if (anchor.hasAttribute("download")) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return false;

  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  return url.pathname !== window.location.pathname || url.search !== window.location.search;
}

function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const [phase, setPhase] = useState<"idle" | "loading" | "finishing">("idle");
  const routeKeyRef = useRef(routeKey);
  const finishTimer = useRef<number>(0);

  const start = () => {
    window.clearTimeout(finishTimer.current);
    setPhase("loading");
  };

  useEffect(() => {
    startNavigation = start;
    return () => {
      if (startNavigation === start) startNavigation = null;
    };
  });

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor || !isInternalPathChange(anchor)) return;
      start();
    };

    const onPopState = () => start();

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    if (routeKeyRef.current === routeKey) return;
    routeKeyRef.current = routeKey;
    setPhase((current) => (current === "idle" ? current : "finishing"));
    window.clearTimeout(finishTimer.current);
    finishTimer.current = window.setTimeout(() => setPhase("idle"), 280);
  }, [routeKey]);

  useEffect(() => {
    if (phase !== "loading") return;
    const stuck = window.setTimeout(() => {
      setPhase("finishing");
      finishTimer.current = window.setTimeout(() => setPhase("idle"), 280);
    }, 10000);
    return () => window.clearTimeout(stuck);
  }, [phase]);

  return (
    <div
      className={`nav-progress${phase === "loading" ? " is-loading" : ""}${phase === "finishing" ? " is-finishing" : ""}`}
      aria-hidden="true"
    >
      <span className="nav-progress-bar" />
    </div>
  );
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressBar />
    </Suspense>
  );
}
