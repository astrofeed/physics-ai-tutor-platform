"use client";

import { useCallback, useRef, useState } from "react";

function containsFiles(event: React.DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes("Files");
}

/**
 * Makes a container a drop target for file uploads. `isDragging` is true while
 * files are dragged over it (dragenter/dragleave fire on every child, so a
 * counter tracks the real enter/leave pair). Dropped files go to `onFiles`,
 * which applies the same validation as the file picker.
 */
export function useFileDrop(onFiles: (files: File[]) => void) {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);

  const onDragEnter = useCallback((event: React.DragEvent) => {
    if (!containsFiles(event)) return;
    event.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    if (!containsFiles(event)) return;
    event.preventDefault();
  }, []);

  const onDragLeave = useCallback((event: React.DragEvent) => {
    if (!containsFiles(event)) return;
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      if (!containsFiles(event)) return;
      event.preventDefault();
      dragDepth.current = 0;
      setIsDragging(false);
      const files = Array.from(event.dataTransfer.files);
      if (files.length) onFiles(files);
    },
    [onFiles]
  );

  return {
    isDragging,
    dropHandlers: { onDragEnter, onDragOver, onDragLeave, onDrop },
  };
}
