import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Paper, Box, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const FloatingAds = ({ onVisibilityChange }) => {
    const [ads, setAds] = useState([]);
    const [index, setIndex] = useState(0);
    const [dismissed, setDismissed] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const load = async () => {
            try {
                const { data } = await axios.get('/api/ad/getactive');
                setAds(data);
            } catch {
                setAds([]);
            }
        };
        load();
    }, []);

    useEffect(() => {
        if (ads.length < 2) return;
        const timer = setInterval(() => {
            setIndex((i) => (i + 1) % ads.length);
        }, 8000);
        return () => clearInterval(timer);
    }, [ads]);

    // Layout reserves screen space for us only while we're actually showing something —
    // otherwise the page would sit off-center reserving a gap for an ad that isn't there.
    useEffect(() => {
        onVisibilityChange?.(!dismissed && ads.length > 0);
        return () => onVisibilityChange?.(false);
    }, [dismissed, ads]);

    if (dismissed || ads.length === 0) return null;
    const ad = ads[index];

    return (
        <>
            {/* Desktop: a card floating over the page's right margin. */}
            <Paper
                elevation={6}
                onClick={() => navigate(`/ad/${ad.id}`)}
                sx={{
                    display: { xs: 'none', md: 'block' },
                    position: 'fixed',
                    top: 84,
                    right: 20,
                    width: { md: 200, lg: 260, xl: 320 },
                    overflow: 'hidden',
                    cursor: 'pointer',
                    zIndex: 1300,
                    border: '1px solid',
                    borderColor: 'secondary.light'
                }}
            >
                <Box sx={{ position: 'relative' }}>
                    <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
                        sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'rgba(255,255,255,0.85)', '&:hover': { bgcolor: 'white' } }}
                    >
                        <CloseIcon fontSize="small" />
                    </IconButton>
                    {ad.imageUrl && (
                        <Box component="img" src={ad.imageUrl} alt={ad.title} sx={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block' }} />
                    )}
                    <Box sx={{ p: { md: 1.25, xl: 1.75 } }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: { xl: '1.05rem' } }}>{ad.title}</Typography>
                        {ad.description && (
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                    display: '-webkit-box',
                                    WebkitLineClamp: { md: 2, xl: 3 },
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    fontSize: { xl: '0.95rem' }
                                }}
                            >
                                {ad.description}
                            </Typography>
                        )}
                    </Box>
                </Box>
            </Paper>

            {/* Mobile/tablet: no room to float a card without covering content, so it
                becomes a slim, dismissable bar docked right under the AppBar instead. */}
            <Paper
                elevation={3}
                onClick={() => navigate(`/ad/${ad.id}`)}
                square
                sx={{
                    display: { xs: 'flex', md: 'none' },
                    alignItems: 'center',
                    gap: 1.25,
                    position: 'fixed',
                    top: { xs: 56, sm: 64 },
                    left: 0,
                    right: 0,
                    px: 1.5,
                    py: 1,
                    cursor: 'pointer',
                    zIndex: 1200,
                    borderBottom: '1px solid',
                    borderColor: 'secondary.light'
                }}
            >
                {ad.imageUrl && (
                    <Box component="img" src={ad.imageUrl} alt={ad.title} sx={{ width: 56, height: 56, borderRadius: 1, objectFit: 'cover', flexShrink: 0 }} />
                )}
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>{ad.title}</Typography>
                    {ad.description && (
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                            {ad.description}
                        </Typography>
                    )}
                </Box>
                <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
                    sx={{ flexShrink: 0 }}
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Paper>
        </>
    );
};

export default FloatingAds;
