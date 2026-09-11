import React, { useEffect, useRef, useState } from 'react';
import { Box, Dialog, DialogContent, IconButton, Stack } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const SCALE_STEP = 0.5;

const clampScale = (s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

const touchDistance = (touches) => {
    const [a, b] = touches;
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
};

// Full-screen image viewer with real magnification (not just a bigger picture):
// +/- buttons, mouse wheel, and pinch-to-zoom all drive a CSS scale, and once
// zoomed past 1x the image can be dragged/panned to see areas of detail
// (fabric texture, beading, etc). Used anywhere a gown/ad photo needs a closer
// look — the customer-facing detail page and every admin/owner edit view.
const ImageZoomDialog = ({ open, onClose, images, initialIndex = 0, alt = '', fullScreen = false, onIndexChange }) => {
    const [activeIndex, setActiveIndex] = useState(initialIndex);
    const [scale, setScale] = useState(MIN_SCALE);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const dragState = useRef(null);
    const pinchState = useRef(null);
    const imageRef = useRef(null);

    useEffect(() => {
        if (open) {
            setActiveIndex(initialIndex);
            setScale(MIN_SCALE);
            setPosition({ x: 0, y: 0 });
        }
    }, [open, initialIndex]);

    const resetZoom = () => {
        setScale(MIN_SCALE);
        setPosition({ x: 0, y: 0 });
    };

    const goTo = (index) => {
        setActiveIndex(index);
        resetZoom();
        onIndexChange?.(index);
    };

    const zoomBy = (delta) => {
        setScale((prev) => {
            const next = clampScale(prev + delta);
            if (next === MIN_SCALE) setPosition({ x: 0, y: 0 });
            return next;
        });
    };

    const onWheel = (e) => {
        e.preventDefault();
        zoomBy(e.deltaY < 0 ? SCALE_STEP : -SCALE_STEP);
    };

    const onDoubleClick = () => {
        setScale((prev) => {
            if (prev > MIN_SCALE) {
                setPosition({ x: 0, y: 0 });
                return MIN_SCALE;
            }
            return 2.5;
        });
    };

    const onMouseDown = (e) => {
        if (scale <= MIN_SCALE) return;
        dragState.current = { startX: e.clientX, startY: e.clientY, origin: position };
    };
    const onMouseMove = (e) => {
        if (!dragState.current) return;
        const { startX, startY, origin } = dragState.current;
        setPosition({ x: origin.x + (e.clientX - startX), y: origin.y + (e.clientY - startY) });
    };
    const endDrag = () => { dragState.current = null; };

    const onTouchStart = (e) => {
        if (e.touches.length === 2) {
            pinchState.current = { startDist: touchDistance(e.touches), startScale: scale };
        } else if (e.touches.length === 1 && scale > MIN_SCALE) {
            dragState.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, origin: position };
        }
    };
    const onTouchMove = (e) => {
        if (e.touches.length === 2 && pinchState.current) {
            e.preventDefault();
            const { startDist, startScale } = pinchState.current;
            const ratio = touchDistance(e.touches) / startDist;
            const next = clampScale(startScale * ratio);
            setScale(next);
            if (next === MIN_SCALE) setPosition({ x: 0, y: 0 });
        } else if (e.touches.length === 1 && dragState.current) {
            const { startX, startY, origin } = dragState.current;
            setPosition({ x: origin.x + (e.touches[0].clientX - startX), y: origin.y + (e.touches[0].clientY - startY) });
        }
    };
    const onTouchEnd = (e) => {
        if (e.touches.length < 2) pinchState.current = null;
        if (e.touches.length === 0) dragState.current = null;
    };

    if (!images || images.length === 0) return null;

    return (
        <Dialog
            open={open} onClose={onClose} maxWidth="lg" fullScreen={fullScreen}
            slotProps={{ paper: { sx: { bgcolor: 'rgba(0,0,0,0.92)', boxShadow: 'none' } } }}
        >
            <IconButton
                onClick={onClose}
                sx={{ position: 'absolute', top: 8, right: 8, zIndex: 2, color: '#fff', bgcolor: 'rgba(0,0,0,0.4)', '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' } }}
            >
                <CloseIcon />
            </IconButton>

            <Stack
                direction="row" spacing={1}
                sx={{ position: 'absolute', top: 8, left: 8, zIndex: 2, bgcolor: 'rgba(0,0,0,0.4)', borderRadius: 2, p: 0.5 }}
            >
                <IconButton size="small" onClick={() => zoomBy(-SCALE_STEP)} disabled={scale <= MIN_SCALE} sx={{ color: '#fff' }}>
                    <RemoveIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => zoomBy(SCALE_STEP)} disabled={scale >= MAX_SCALE} sx={{ color: '#fff' }}>
                    <AddIcon fontSize="small" />
                </IconButton>
            </Stack>

            <DialogContent
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 1, sm: 3 }, overflow: 'hidden', touchAction: 'none' }}
                onWheel={onWheel}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={endDrag}
                onMouseLeave={endDrag}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onDoubleClick={onDoubleClick}
            >
                <Box
                    ref={imageRef}
                    component="img"
                    src={images[activeIndex]}
                    alt={alt}
                    draggable={false}
                    sx={{
                        maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain',
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        transition: dragState.current || pinchState.current ? 'none' : 'transform 0.15s ease-out',
                        cursor: scale > MIN_SCALE ? 'grab' : 'zoom-in',
                        userSelect: 'none'
                    }}
                />
            </DialogContent>

            {images.length > 1 && (
                <Stack direction="row" spacing={1} sx={{ pb: 2, flexWrap: 'wrap', px: 2, justifyContent: 'center' }}>
                    {images.map((url, i) => (
                        <Box
                            key={url + i}
                            component="img"
                            src={url}
                            onClick={() => goTo(i)}
                            sx={{
                                width: 56, height: 56, objectFit: 'cover', borderRadius: 1, cursor: 'pointer',
                                border: '2px solid', borderColor: activeIndex === i ? 'primary.main' : 'transparent'
                            }}
                        />
                    ))}
                </Stack>
            )}
        </Dialog>
    );
};

export default ImageZoomDialog;
