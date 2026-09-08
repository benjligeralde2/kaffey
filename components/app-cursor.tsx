"use client";

import { useEffect, useState } from "react";

const CLICKABLE = "a, button, [role='button'], [role='link'], label, summary, select, input[type='submit'], input[type='button'], input[type='checkbox'], input[type='radio']";
const TEXT = "input, textarea, [contenteditable='true']";

export function AppCursor() {
  const [enabled, setEnabled] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isPointer, setIsPointer] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [isText, setIsText] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setEnabled(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!enabled) {
      document.documentElement.classList.remove("has-app-cursor");
      return;
    }

    document.documentElement.classList.add("has-app-cursor");

    const onMove = (event: MouseEvent) => {
      setPosition({ x: event.clientX, y: event.clientY });
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const textField = Boolean(target.closest(TEXT));
      setIsText(textField);
      setIsPointer(!textField && Boolean(target.closest(CLICKABLE)));
    };

    const onDown = () => setIsPressed(true);
    const onUp = () => setIsPressed(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    return () => {
      document.documentElement.classList.remove("has-app-cursor");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      className={`app-cursor${isPointer ? " is-pointer" : ""}${isPressed ? " is-pressed" : ""}${isText ? " is-text" : ""}`}
      style={{ ["--cursor-x" as string]: `${position.x}px`, ["--cursor-y" as string]: `${position.y}px` }}
      aria-hidden="true"
    />
  );
}
