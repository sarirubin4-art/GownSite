import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// Lets the owner drag a non-square photo around inside a square frame to choose what
// ends up in the crop, instead of always getting an automatic center-crop. `focal` is a
// {x, y} pair in the 0-1 range with the exact same meaning as CSS object-position
// ("50%/50%" == {x:0.5, y:0.5} == centered) — so whatever's chosen here can be applied
// verbatim as objectPosition wherever the image is displayed in a square across the site.
// Renders nothing for an already-square image, since there's no crop choice to make.
const ImagePositionEditor = ({ src, focal, onChange, size = 260, label }) => {
    const [natural, setNatural] = useState(null);
    const [dragging, setDragging] = useState(false);
    // Anchored at the pointer position AND the image offset both as of drag-start, not
    // updated frame-to-frame — every move computes the absolute new offset from this fixed
    // origin plus the cursor's total travel since then. A frame-to-frame version (each move
    // rebasing off the `focal` prop) breaks when the browser dispatches more than one
    // mousemove before React re-renders with the previous move's onChange applied: the second
    // move would then compute its delta against the same stale, pre-drag position as the
    // first, silently discarding whichever move loses that race.
    const dragOrigin = useRef(null);

    useEffect(() => {
        setNatural(null);
        if (!src) return;
        let cancelled = false;
        const img = new Image();
        img.onload = () => {
            if (!cancelled) setNatural({ w: img.naturalWidth, h: img.naturalHeight });
        };
        img.src = src;
        return () => { cancelled = true; };
    }, [src]);

    const isSquare = !!natural && Math.abs(natural.w - natural.h) < 1;

    const scale = natural ? Math.max(size / natural.w, size / natural.h) : 0;
    const dispW = natural ? natural.w * scale : 0;
    const dispH = natural ? natural.h * scale : 0;
    const overX = dispW - size;
    const overY = dispH - size;

    const fx = focal?.x ?? 0.5;
    const fy = focal?.y ?? 0.5;
    const translateX = -fx * overX;
    const translateY = -fy * overY;

    const applyAbsolute = (tx, ty) => {
        const nextTX = clamp(tx, -overX, 0);
        const nextTY = clamp(ty, -overY, 0);
        onChange({
            x: overX > 0 ? -nextTX / overX : 0.5,
            y: overY > 0 ? -nextTY / overY : 0.5
        });
    };

    // Listening on `window` (rather than just the small drag box) means the drag keeps
    // tracking correctly even once the cursor/finger strays outside the box's bounds —
    // a box only 200-260px square is easy to overshoot with an ordinary drag gesture, and
    // a box-scoped onMouseLeave would otherwise end the drag right there.
    useEffect(() => {
        if (!dragging) return;

        const onMove = (clientX, clientY) => {
            if (!dragOrigin.current) return;
            const { startX, startY, originTX, originTY } = dragOrigin.current;
            applyAbsolute(originTX + (clientX - startX), originTY + (clientY - startY));
        };
        const onMouseMove = (e) => onMove(e.clientX, e.clientY);
        const onTouchMove = (e) => {
            if (e.touches.length !== 1) return;
            onMove(e.touches[0].clientX, e.touches[0].clientY);
        };
        const endDrag = () => {
            dragOrigin.current = null;
            setDragging(false);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', endDrag);
        window.addEventListener('touchmove', onTouchMove, { passive: true });
        window.addEventListener('touchend', endDrag);
        window.addEventListener('touchcancel', endDrag);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', endDrag);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', endDrag);
            window.removeEventListener('touchcancel', endDrag);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dragging, overX, overY]);

    if (!src || !natural || isSquare) return null;

    const beginDrag = (clientX, clientY) => {
        dragOrigin.current = { startX: clientX, startY: clientY, originTX: translateX, originTY: translateY };
        setDragging(true);
    };
    const onMouseDown = (e) => beginDrag(e.clientX, e.clientY);
    const onTouchStart = (e) => {
        const t = e.touches[0];
        beginDrag(t.clientX, t.clientY);
    };

    return (
        <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                {label || "This photo isn't square — drag it to choose what shows in the square crop."}
            </Typography>
            <Box
                sx={{
                    width: size, height: size, borderRadius: 2, overflow: 'hidden', position: 'relative',
                    bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
                    cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none'
                }}
                onMouseDown={onMouseDown}
                onTouchStart={onTouchStart}
            >
                <Box
                    component="img"
                    src={src}
                    draggable={false}
                    alt=""
                    sx={{
                        position: 'absolute', left: 0, top: 0, maxWidth: 'none',
                        width: dispW, height: dispH,
                        transform: `translate(${translateX}px, ${translateY}px)`,
                        transition: dragging ? 'none' : 'transform 0.1s ease-out',
                        userSelect: 'none'
                    }}
                />
            </Box>
        </Box>
    );
};

export default ImagePositionEditor;
