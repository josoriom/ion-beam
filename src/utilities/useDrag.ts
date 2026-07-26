import { useCallback, useEffect, useRef, useState } from "react";

export interface Offset {
  x: number;
  y: number;
}

interface Bounds {
  baseLeft: number;
  baseTop: number;
  width: number;
  height: number;
}

const start: Offset = { x: 0, y: 0 };
const emptyBounds: Bounds = { baseLeft: 0, baseTop: 0, width: 0, height: 0 };

function clampOffset(offset: Offset, bounds: Bounds): Offset {
  const minX = -bounds.baseLeft;
  const maxX = window.innerWidth - bounds.width - bounds.baseLeft;
  const minY = -bounds.baseTop;
  const maxY = window.innerHeight - bounds.height - bounds.baseTop;

  return {
    x: Math.min(Math.max(offset.x, Math.min(minX, maxX)), Math.max(minX, maxX)),
    y: Math.min(Math.max(offset.y, Math.min(minY, maxY)), Math.max(minY, maxY)),
  };
}

export function useDrag() {
  const [offset, setOffset] = useState<Offset>(start);
  const panelRef = useRef<HTMLDivElement>(null);
  const origin = useRef<Offset>(start);
  const pointer = useRef<Offset>(start);
  const bounds = useRef<Bounds>(emptyBounds);

  const onGrab = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const panel = panelRef.current;
    if (!panel) return;
    event.preventDefault();

    const rect = panel.getBoundingClientRect();
    bounds.current = {
      baseLeft: rect.left - offset.x,
      baseTop: rect.top - offset.y,
      width: rect.width,
      height: rect.height,
    };
    origin.current = offset;
    pointer.current = { x: event.clientX, y: event.clientY };

    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    document.body.classList.add("dragging");

    function move(moveEvent: PointerEvent) {
      const next = {
        x: origin.current.x + moveEvent.clientX - pointer.current.x,
        y: origin.current.y + moveEvent.clientY - pointer.current.y,
      };
      setOffset(clampOffset(next, bounds.current));
    }

    function drop() {
      document.body.classList.remove("dragging");
      target.releasePointerCapture(event.pointerId);
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", drop);
      target.removeEventListener("pointercancel", drop);
    }

    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", drop);
    target.addEventListener("pointercancel", drop);
  }, [offset]);

  useEffect(() => {
    function handleResize() {
      const panel = panelRef.current;
      if (!panel) return;
      setOffset((current) => {
        const rect = panel.getBoundingClientRect();
        return clampOffset(current, {
          baseLeft: rect.left - current.x,
          baseTop: rect.top - current.y,
          width: rect.width,
          height: rect.height,
        });
      });
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return { offset, onGrab, panelRef };
}
