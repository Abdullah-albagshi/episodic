import { useRef } from "react";

type PointEvent = { nativeEvent: { pageX: number; pageY: number } };

/**
 * Ignore presses that were actually a drag/swipe (e.g. across a pager page).
 */
export function useTapGuard(threshold = 12) {
  const start = useRef({ x: 0, y: 0 });
  return {
    onPressIn: (e: PointEvent) => {
      start.current = {
        x: e.nativeEvent.pageX,
        y: e.nativeEvent.pageY,
      };
    },
    wasTap: (e: PointEvent) => {
      const dx = Math.abs(e.nativeEvent.pageX - start.current.x);
      const dy = Math.abs(e.nativeEvent.pageY - start.current.y);
      return dx < threshold && dy < threshold;
    },
  };
}
