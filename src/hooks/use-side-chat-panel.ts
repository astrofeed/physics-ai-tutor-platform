"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const OPEN_KEY = "side-chat-open";
const WIDTH_KEY = "side-chat-width";

export const SIDE_CHAT_MIN_WIDTH = 320;
export const SIDE_CHAT_MAX_WIDTH = 640;
const SIDE_CHAT_DEFAULT_WIDTH = 400;

const clampWidth = (width: number) =>
  Math.min(SIDE_CHAT_MAX_WIDTH, Math.max(SIDE_CHAT_MIN_WIDTH, width));

/**
 * Open state and drag-to-resize width for a docked chat panel. On mobile the
 * panel covers the page instead of splitting it, so the width is ignored.
 */
export function useSideChatPanel() {
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(SIDE_CHAT_DEFAULT_WIDTH);
  const [isMobile, setIsMobile] = useState(false);
  const [resizing, setResizing] = useState(false);
  const widthRef = useRef(width);

  useEffect(() => {
    setOpen(localStorage.getItem(OPEN_KEY) === "true");
    const savedWidth = Number(localStorage.getItem(WIDTH_KEY));
    if (Number.isFinite(savedWidth) && savedWidth > 0) {
      const clamped = clampWidth(savedWidth);
      widthRef.current = clamped;
      setWidth(clamped);
    }
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      localStorage.setItem(OPEN_KEY, String(!prev));
      return !prev;
    });
  }, []);

  const close = useCallback(() => {
    localStorage.setItem(OPEN_KEY, "false");
    setOpen(false);
  }, []);

  const startResize = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
    setResizing(true);

    const onMove = (moveEvent: PointerEvent) => {
      const next = clampWidth(window.innerWidth - moveEvent.clientX);
      widthRef.current = next;
      setWidth(next);
    };
    const onUp = () => {
      setResizing(false);
      localStorage.setItem(WIDTH_KEY, String(widthRef.current));
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  return {
    open,
    toggle,
    close,
    width: isMobile ? undefined : width,
    isMobile,
    resizing,
    startResize,
  };
}
