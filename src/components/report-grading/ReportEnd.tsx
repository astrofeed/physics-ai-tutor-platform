"use client";

import { useEffect, useRef } from "react";

export function ReportEnd({ onRead }: { onRead: () => void }) {
  const marker = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const check = () => {
      if (marker.current && marker.current.getBoundingClientRect().bottom <= window.innerHeight) {
        onRead();
      }
    };
    const observer = new IntersectionObserver(check);
    if (marker.current) observer.observe(marker.current);
    window.addEventListener("scroll", check, { passive: true, capture: true });
    check();
    return () => { observer.disconnect(); window.removeEventListener("scroll", check, true); };
  }, [onRead]);
  return <p ref={marker} className="py-2 text-center text-xs text-muted-foreground">End of report</p>;
}
