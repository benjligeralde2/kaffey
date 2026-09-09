"use client";

import { toPng } from "html-to-image";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useRef, type ReactNode } from "react";

type ShatterContextValue = {
  shatterTo: (href: string) => Promise<void>;
};

const ShatterContext = createContext<ShatterContextValue | null>(null);

const TARGET_TILES = 360;
const ANIMATION_MS = 920;
const NAVIGATE_AFTER_MS = 90;

function shouldReduceMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function gridFor(width: number, height: number) {
  const aspect = width / Math.max(height, 1);
  const cols = Math.max(12, Math.round(Math.sqrt(TARGET_TILES * aspect)));
  const rows = Math.max(12, Math.round(TARGET_TILES / cols));
  return { cols, rows };
}

function captureRoot() {
  return document.body;
}

export function ShatterToLogin({ children }: { children: ReactNode }) {
  const router = useRouter();
  const running = useRef(false);

  const shatterTo = useCallback(
    async (href: string) => {
      if (running.current) return;
      if (href !== "/POS/login" || shouldReduceMotion()) {
        router.push(href);
        return;
      }

      running.current = true;
      const source = captureRoot();
      const width = window.innerWidth;
      const height = window.innerHeight;
      const { cols, rows } = gridFor(width, height);
      const tileW = width / cols;
      const tileH = height / rows;
      const centerX = width / 2;
      const centerY = height / 2;
      const maxDist = Math.hypot(centerX, centerY);

      try {
        const screenshot = await toPng(source, {
          pixelRatio: 1,
          cacheBust: false,
          filter: (node) => {
            if (!(node instanceof HTMLElement)) return true;
            return !node.classList.contains("shatter-overlay");
          },
        });

        const overlay = document.createElement("div");
        overlay.className = "shatter-overlay";
        overlay.setAttribute("aria-hidden", "true");
        overlay.style.setProperty("--shatter-image", `url("${screenshot}")`);
        overlay.style.setProperty("--shatter-width", `${width}px`);
        overlay.style.setProperty("--shatter-height", `${height}px`);

        const tiles: HTMLSpanElement[] = [];
        for (let row = 0; row < rows; row += 1) {
          for (let col = 0; col < cols; col += 1) {
            const left = col * tileW;
            const top = row * tileH;
            const tile = document.createElement("span");
            tile.className = "shatter-tile";
            tile.style.width = `${tileW + 1}px`;
            tile.style.height = `${tileH + 1}px`;
            tile.style.left = `${left}px`;
            tile.style.top = `${top}px`;
            tile.style.backgroundPosition = `-${left}px -${top}px`;
            overlay.append(tile);
            tiles.push(tile);
          }
        }

        document.body.append(overlay);
        void overlay.offsetWidth;

        const animations = tiles.map((tile) => {
          const left = Number.parseFloat(tile.style.left);
          const top = Number.parseFloat(tile.style.top);
          const tileCenterX = left + tileW / 2;
          const tileCenterY = top + tileH / 2;
          const dx = centerX - tileCenterX;
          const dy = centerY - tileCenterY;
          const dist = Math.hypot(dx, dy);
          const delay = (dist / maxDist) * 280;
          const spin = ((tileCenterX + tileCenterY) % 17) - 8;

          return tile.animate(
            [
              { transform: "translate3d(0, 0, 0) scale(1) rotate(0deg)", opacity: 1 },
              {
                transform: `translate3d(${dx}px, ${dy}px, -920px) scale(0.08) rotate(${spin * 8}deg)`,
                opacity: 0,
              },
            ],
            {
              duration: ANIMATION_MS,
              delay,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
              fill: "forwards",
            },
          );
        });

        window.setTimeout(() => {
          router.push(href);
        }, NAVIGATE_AFTER_MS);

        await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
        overlay.remove();
      } catch {
        router.push(href);
      } finally {
        running.current = false;
      }
    },
    [router],
  );

  return <ShatterContext.Provider value={{ shatterTo }}>{children}</ShatterContext.Provider>;
}

export function useShatterToLogin() {
  const value = useContext(ShatterContext);
  if (!value) {
    throw new Error("useShatterToLogin must be used within ShatterToLogin");
  }
  return value;
}
