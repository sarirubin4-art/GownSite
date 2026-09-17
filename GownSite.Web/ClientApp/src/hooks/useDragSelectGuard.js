import { useRef } from 'react';

// MUI's Select opens its menu on mousedown (not click) and, like a native <select>, treats
// wherever the mouse is released as the chosen option — including a spot the user only
// dragged over on the way to releasing, not one they deliberately clicked. That reads as
// "I just hovered and it picked something" when the mousedown that opened the menu and the
// mouseup that lands on an option are really one continuous press-drag-release gesture.
//
// Spread the returned props onto a Box wrapping the affected TextField(s)/Select(s). It
// tracks the position of the most recent mousedown and, if the following click lands more
// than a few pixels away, cancels it in the capture phase before it reaches the option —
// a genuine click (press and release close to the same spot) is unaffected.
const DRAG_THRESHOLD_PX = 8;

export default function useDragSelectGuard() {
    const pointerDownPos = useRef(null);

    return {
        onMouseDownCapture: (e) => {
            pointerDownPos.current = { x: e.clientX, y: e.clientY };
        },
        onClickCapture: (e) => {
            const start = pointerDownPos.current;
            if (!start) return;
            const dx = e.clientX - start.x;
            const dy = e.clientY - start.y;
            if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD_PX) {
                e.stopPropagation();
            }
        }
    };
}
