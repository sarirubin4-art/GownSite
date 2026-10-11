import React, { useState } from 'react';
import { Typography, Card, CardActionArea, CardMedia, CardContent, Box, Chip, Stack } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { formatPriceRange, sortSizes } from '../constants/gownOptions';

// Browse-card with prev/next arrows to page through a gown's other photos (only shown
// when it has more than one). The arrows/dots are siblings of CardActionArea — NOT
// nested inside it — for two reasons: (1) CardActionArea renders a <button>, and a real
// <button> nested inside another <button> is invalid HTML that breaks click handling;
// (2) MUI's CardActionArea paints its own hover/press overlay based on the actual DOM
// hierarchy (a CSS :hover/:active effect on the ancestor button), which a descendant's
// stopPropagation() can't suppress — clicking an arrow nested inside it visibly flashed
// a dark overlay across the whole image. Keeping the arrows as external siblings avoids
// both problems entirely.
const GownCard = ({ gown, navigate }) => {
    const images = [gown.primaryPictureUrl, ...(gown.morePictures || []).map((p) => p.url)];
    const [index, setIndex] = useState(0);
    const [hovered, setHovered] = useState(false);
    const hasMultiple = images.length > 1;

    const step = (delta) => (e) => {
        e.stopPropagation();
        e.preventDefault();
        setIndex((prev) => (prev + delta + images.length) % images.length);
    };

    const arrowSx = {
        position: 'absolute', top: 110, transform: 'translateY(-50%)', zIndex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', color: '#fff',
        bgcolor: 'rgba(0,0,0,0.4)',
        transition: 'background-color 0.1s ease, transform 0.1s ease',
        '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' },
        '&:active': { bgcolor: 'rgba(0,0,0,0.7)', transform: 'translateY(-50%) scale(0.88)' }
    };

    return (
        // Hover state is tracked in React (not a CSS :hover on CardActionArea) so the
        // "show the full uncropped photo" effect stays on while the mouse is over the
        // arrows too — the arrows are siblings of CardActionArea (see note below), so a
        // CSS-only `&:hover` scoped to the button wouldn't fire while hovering them, and
        // switching photos would keep resetting back to the cropped view.
        <Card
            sx={{ position: 'relative' }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <CardActionArea onClick={() => navigate(`/gown/${gown.id}`)}>
                {gown.isSold && (
                    <Box sx={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: 220, zIndex: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none'
                    }}>
                        <Typography sx={{
                            fontFamily: `'Playfair Display', serif`, fontWeight: 700,
                            fontSize: '2.3rem', letterSpacing: 6, textTransform: 'uppercase',
                            color: 'rgba(156, 78, 88, 0.88)',
                            transform: 'rotate(-16deg)',
                            textShadow: '0 2px 6px rgba(255,255,255,0.55)'
                        }}>
                            Sold
                        </Typography>
                    </Box>
                )}
                <CardMedia
                    component="img"
                    height="220"
                    image={images[index]}
                    alt={gown.description}
                    sx={{
                        objectFit: hovered ? 'contain' : 'cover',
                        bgcolor: 'background.default',
                        opacity: gown.isSold ? 0.55 : 1
                    }}
                />
                <CardContent>
                    {gown.brand && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                            {gown.brand}
                        </Typography>
                    )}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                        <Typography variant="h6">{formatPriceRange(gown.price, gown.priceMax)}</Typography>
                        <Chip size="small" label={gown.listingType === 'Rent' ? 'For Rent' : 'For Sale'} color="primary" variant="outlined" />
                    </Box>
                    <Typography
                        variant="body2" color="text.secondary"
                        sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                        {gown.description && `${gown.description} · `}Size {sortSizes(gown.size).join(', ')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">{gown.location}</Typography>
                </CardContent>
            </CardActionArea>
            {hasMultiple && (
                <>
                    <Box onClick={step(-1)} sx={{ ...arrowSx, left: 8 }}>
                        <ChevronLeftIcon fontSize="small" />
                    </Box>
                    <Box onClick={step(1)} sx={{ ...arrowSx, right: 8 }}>
                        <ChevronRightIcon fontSize="small" />
                    </Box>
                    <Stack direction="row" spacing={0.5} sx={{ position: 'absolute', top: 196, left: 0, right: 0, justifyContent: 'center', pointerEvents: 'none' }}>
                        {images.map((_, i) => (
                            <Box key={i} sx={{
                                width: 6, height: 6, borderRadius: '50%',
                                bgcolor: i === index ? '#fff' : 'rgba(255,255,255,0.5)'
                            }} />
                        ))}
                    </Stack>
                </>
            )}
        </Card>
    );
};

export default GownCard;
