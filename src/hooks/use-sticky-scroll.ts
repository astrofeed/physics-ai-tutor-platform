"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PINNED_THRESHOLD_PX = 80;

/**
 * Keeps a scroll container pinned to the bottom while the reader is already there,
 * and reports when they have scrolled away so a "jump to latest" affordance can be shown.
 */
export function useStickyScroll(
  containerRef: React.RefObject<HTMLElement>,
  contentKey: unknown
) {
  const [isPinned, setIsPinned] = useState(true);
  const pinnedRef = useRef(true);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const container = containerRef.current;
      if (!container) return;
      container.scrollTo({ top: container.scrollHeight, behavior });
      pinnedRef.current = true;
      setIsPinned(true);
    },
    [containerRef]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const syncPinned = () => {
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      const pinned = distanceFromBottom <= PINNED_THRESHOLD_PX;
      pinnedRef.current = pinned;
      setIsPinned(pinned);
    };

    // Deliberately not measured on mount: the reader is considered pinned until
    // they actually scroll away, so the first render always lands on the newest message.
    container.addEventListener("scroll", syncPinned, { passive: true });
    return () => container.removeEventListener("scroll", syncPinned);
  }, [containerRef]);

  useEffect(() => {
    if (pinnedRef.current) scrollToBottom("auto");
  }, [contentKey, scrollToBottom]);

  // Markdown, KaTeX and images finish laying out after the messages render, which
  // would otherwise leave a pinned reader stranded above the newest message.
  useEffect(() => {
    const container = containerRef.current;
    const content = container?.firstElementChild;
    if (!container || !content) return;

    const observer = new ResizeObserver(() => {
      if (pinnedRef.current) scrollToBottom("auto");
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [containerRef, scrollToBottom]);

  return { isPinned, scrollToBottom };
}
