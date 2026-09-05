"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

const coffeeSlides = [
  { src: "/coffees/Iced_Coffee_With_Milk_Splash_And_Ice_Cubes_PNG___TopPNG-removebg-preview.png", label: "Iced coffee with milk" },
  { src: "/coffees/CASTLE101__️_ICE_CREAM_-removebg-preview.png", label: "Chocolate coffee cream" },
];

export default function Home() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [activeSlide, setActiveSlide] = useState(0);
  const [posDestination, setPosDestination] = useState({ href: "/POS/login", label: "Open the POS" });

  useEffect(() => {
    const loadSessionDestination = async () => {
      const { data } = await createClient().auth.getUser();
      if (!data.user) return;

      const isAdmin = data.user.app_metadata?.role === "admin";
      setPosDestination({
        href: isAdmin ? "/POS/admin-dashboard" : "/POS/cashier-dashboard/menus",
        label: isAdmin ? "Open Dashboard" : "Open Menus",
      });
    };

    void loadSessionDestination();
  }, []);

  useEffect(() => {
    const slideshow = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % coffeeSlides.length);
    }, 4500);

    return () => window.clearInterval(slideshow);
  }, []);

  const goToSlide = (index: number) => {
    setActiveSlide((index + coffeeSlides.length) % coffeeSlides.length);
  };

  const handleHeroMove = (event: React.MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  };

  return (
    <main>
      <header className="site-header">
        <nav className="site-nav content-width" aria-label="Primary navigation">
          <a className="wordmark" href="#home" aria-label="Kaffey home"><span className="wordmark-mark">K</span> kaffey<span className="wordmark-dot">.</span></a>
          <div className="nav-links"><a href="mailto:hello@kaffey.coffee">Ask help</a><Link href={posDestination.href}>{posDestination.label} <span>↗</span></Link></div>
        </nav>
      </header>
      <div className="hero-transition">
      <motion.section className="hero-section" id="home" onMouseMove={handleHeroMove} onMouseLeave={() => setMousePosition({ x: 0, y: 0 })}>
        <div className="smoke-layer" aria-hidden="true">
          <div className="smoke-orb smoke-orb-primary" style={{ ["--x" as string]: `${mousePosition.x - 180}px`, ["--y" as string]: `${mousePosition.y - 190}px`, ["--size" as string]: "360px", ["--delay" as string]: "0s" }} />
          <div className="smoke-orb smoke-orb-secondary" style={{ ["--x" as string]: `${mousePosition.x - 120}px`, ["--y" as string]: `${mousePosition.y - 100}px`, ["--size" as string]: "280px", ["--delay" as string]: "1.8s" }} />
          <div className="smoke-orb smoke-orb-tertiary" style={{ ["--x" as string]: `${mousePosition.x - 150}px`, ["--y" as string]: `${mousePosition.y - 220}px`, ["--size" as string]: "300px", ["--delay" as string]: "3.2s" }} />
          <div className="smoke-orb smoke-orb-quaternary" style={{ ["--x" as string]: `${mousePosition.x - 210}px`, ["--y" as string]: `${mousePosition.y - 140}px`, ["--size" as string]: "240px", ["--delay" as string]: "4.7s" }} />
          <div className="smoke-orb smoke-orb-quinary" style={{ ["--x" as string]: `${mousePosition.x - 90}px`, ["--y" as string]: `${mousePosition.y - 260}px`, ["--size" as string]: "220px", ["--delay" as string]: "6.2s" }} />
        </div>
        <div className="hero-wave" aria-hidden="true" />
        <div className="hero-content content-width">
          <div className="hero-product" aria-label="Featured drinks slideshow">
            <button className="hero-slide-arrow hero-slide-prev" type="button" aria-label="Previous drink" onClick={() => goToSlide(activeSlide - 1)}><span className="hero-chevron hero-chevron-left" aria-hidden="true" /></button>
            <div className="hero-product-frame"><img key={activeSlide} className="hero-product-image" src={coffeeSlides[activeSlide].src} alt={coffeeSlides[activeSlide].label} /></div>
            <button className="hero-slide-arrow hero-slide-next" type="button" aria-label="Next drink" onClick={() => goToSlide(activeSlide + 1)}><span className="hero-chevron hero-chevron-right" aria-hidden="true" /></button>
            <div className="hero-slide-dots" aria-label="Choose a featured drink">
              {coffeeSlides.map((slide, index) => <button className={activeSlide === index ? "active" : ""} key={slide.src} type="button" aria-label={`Show ${slide.label}`} aria-current={activeSlide === index ? "true" : undefined} onClick={() => goToSlide(index)} />)}
            </div>
          </div>
          <div className="hero-copy"><p className="eyebrow"><span className="eyebrow-line" /> Kaffey point of sale</p><h1>Keep your<br /><em>counter</em> flowing.</h1><p className="hero-intro">Manage orders, keep the menu moving, and make every handoff feel effortless.</p><Link className="primary-button hero-pos-button" href={posDestination.href}>{posDestination.label} <span className="hero-chevron hero-chevron-right" aria-hidden="true" /></Link></div>
        </div>
      </motion.section>
      </div>
    </main>
  );
}
