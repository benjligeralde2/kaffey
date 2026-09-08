"use client";

import { Capacitor } from "@capacitor/core";
import Link from "next/link";
import { useEffect, useState } from "react";

import { CoffeeCluster } from "@/components/coffee-cluster";
import { posHomePath } from "@/lib/pos-role";
import { createClient } from "@/lib/supabase/client";

const ANDROID_APK_HREF = "/kaffey.apk";

function AndroidIcon() {
  return (
    <svg className="android-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24a11.43 11.43 0 0 0-8.94 0L5.65 5.67c-.19-.28-.54-.36-.83-.22-.3.16-.42.54-.26.85l1.84 3.18C4.16 11.23 2.67 14.05 2.5 17.25h19c-.17-3.2-1.66-6.02-3.9-7.77zM7.5 14.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm9 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z" />
    </svg>
  );
}

export default function Home() {
  const [posDestination, setPosDestination] = useState({ href: "/POS/login", label: "Open POS" });
  const [showAppDownload, setShowAppDownload] = useState(true);

  useEffect(() => {
    setShowAppDownload(!Capacitor.isNativePlatform());
  }, []);

  useEffect(() => {
    const loadSessionDestination = async () => {
      const { data } = await createClient().auth.getUser();
      if (!data.user) return;

      const role = data.user.app_metadata?.role;
      const href = posHomePath(role);
      setPosDestination({
        href,
        label: role === "admin" ? "Open Dashboard" : role === "kitchen" ? "Open Kitchen" : "Open Menus",
      });
    };

    void loadSessionDestination();
  }, []);

  return (
    <main className="home-page">
      <header className="site-header">
        <nav className="site-nav content-width" aria-label="Primary navigation">
          <a className="wordmark" href="#home" aria-label="Kaffey home"><span className="wordmark-mark">K</span> kaffey<span className="wordmark-dot">.</span></a>
          <div className="nav-links">
            {showAppDownload ? (
              <a className="download-app-link" href={ANDROID_APK_HREF} download="kaffey.apk">
                Download <AndroidIcon />
              </a>
            ) : null}
            <Link href={posDestination.href}>
              {posDestination.label}
            </Link>
          </div>
        </nav>
      </header>
      <div className="hero-transition">
      <section className="hero-section" id="home">
        <div className="hero-content content-width">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-line" /> Kaffey point of sale</p>
            <h1>Keep your<br /><em>counter</em> flowing.</h1>
            <p className="hero-intro">Manage orders, keep the menu moving, and make every handoff feel effortless.</p>
            <div className="hero-actions">
              <Link className="primary-button hero-pos-button" href={posDestination.href}>
                {posDestination.label}
              </Link>
              {showAppDownload ? (
                <a className="secondary-button hero-pos-button download-app-link" href={ANDROID_APK_HREF} download="kaffey.apk">
                  Download <AndroidIcon />
                </a>
              ) : null}
            </div>
          </div>
          <CoffeeCluster />
        </div>
      </section>
      </div>
    </main>
  );
}
