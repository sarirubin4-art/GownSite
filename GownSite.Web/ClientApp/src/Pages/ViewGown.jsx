import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Box, Grid, Typography, Chip, Button, Divider, Stack, Dialog, DialogTitle,
    DialogContent, DialogActions, CircularProgress, IconButton
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import { styleLabel, formatPriceRange, sortSizes } from '../constants/gownOptions';
import useFullScreenDialog from '../hooks/useFullScreenDialog';
import usePageTitle from '../hooks/usePageTitle';
import { useAdLane } from '../context/AdLaneContext';

const ViewGown = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const fullScreen = useFullScreenDialog();
    const { laneSx } = useAdLane();
    const [gown, setGown] = useState(null);
    const [activeImage, setActiveImage] = useState(null);
    const [contactInfo, setContactInfo] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [zoomOpen, setZoomOpen] = useState(false);

    usePageTitle(
        gown ? `${[gown.color, gown.size ? `Size ${sortSizes(gown.size).join(', ')}` : null].filter(Boolean).join(', ')} Gown ${gown.listingType === 'Sale' ? 'for Sale' : 'for Rent'}${gown.location ? ` in ${gown.location}` : ''}` : 'Gown Listing',
        gown ? gown.description : undefined
    );

    useEffect(() => {
        window.scrollTo(0, 0);
        const load = async () => {
            const { data } = await axios.get(`/api/gown/get?id=${id}`);
            setGown(data);
            setActiveImage(data.primaryPictureUrl);
        };
        load();
    }, [id]);

    const onInterestedClick = async () => {
        setLoading(true);
        try {
            const { data } = await axios.post('/api/gown/inquire', { id: Number(id) });
            setContactInfo(data);
            setDialogOpen(true);
        } finally {
            setLoading(false);
        }
    };

    if (!gown) return null;

    const thumbnails = [gown.primaryPictureUrl, ...(gown.morePictures || []).map(p => p.url)];
    const styleTags = (gown.styleTags || '').split(',').filter(Boolean);

    return (
        <Box>
            <Button
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate(-1)}
                sx={{ mb: 2 }}
            >
                Back
            </Button>
            <Grid container spacing={4} sx={{ mr: laneSx }}>
                <Grid size={{ xs: 12, md: 7 }}>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Stack spacing={1} sx={{ width: 72 }}>
                            {thumbnails.map((url) => (
                                <Box
                                    key={url}
                                    component="img"
                                    src={url}
                                    onClick={() => setActiveImage(url)}
                                    sx={{
                                        width: 72, height: 72, objectFit: 'cover', borderRadius: 2, cursor: 'pointer',
                                        border: '2px solid', borderColor: activeImage === url ? 'primary.main' : 'transparent'
                                    }}
                                />
                            ))}
                        </Stack>
                        <Box
                            onClick={() => setZoomOpen(true)}
                            sx={{
                                position: 'relative',
                                flex: 1,
                                aspectRatio: '4 / 5',
                                maxHeight: 560,
                                borderRadius: 3,
                                overflow: 'hidden',
                                bgcolor: 'background.paper',
                                border: '1px solid',
                                borderColor: 'divider',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'zoom-in'
                            }}
                        >
                            <Box
                                component="img"
                                src={activeImage}
                                alt={gown.description}
                                sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', opacity: gown.isSold ? 0.55 : 1 }}
                            />
                            <IconButton
                                size="small"
                                sx={{
                                    position: 'absolute', bottom: 12, right: 12, zIndex: 1,
                                    bgcolor: 'rgba(0,0,0,0.45)', color: '#fff',
                                    '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' }
                                }}
                            >
                                <ZoomInIcon fontSize="small" />
                            </IconButton>
                            {gown.isSold && (
                                <Box sx={{
                                    position: 'absolute', inset: 0, zIndex: 1,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none'
                                }}>
                                    <Typography sx={{
                                        fontFamily: `'Playfair Display', serif`, fontWeight: 700,
                                        fontSize: { xs: '2.9rem', sm: '3.75rem' }, letterSpacing: 8, textTransform: 'uppercase',
                                        color: 'rgba(156, 78, 88, 0.88)',
                                        transform: 'rotate(-18deg)',
                                        textShadow: '0 2px 8px rgba(255,255,255,0.55)'
                                    }}>
                                        Sold
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    </Box>
                </Grid>

                <Grid size={{ xs: 12, md: 5 }}>
                    <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                        <Chip label={gown.listingType === 'Rent' ? 'For Rent' : 'For Sale'} color="primary" />
                        {gown.isSold && <Chip label="SOLD" color="secondary" sx={{ fontWeight: 700, letterSpacing: 1 }} />}
                    </Stack>
                    <Typography variant="h4" gutterBottom>{formatPriceRange(gown.price, gown.priceMax)}</Typography>
                    <Typography variant="body1" sx={{ mb: 2 }}>{gown.description}</Typography>

                    <Stack spacing={0.75} sx={{ mb: 2 }}>
                        <Typography><strong>Color{(gown.color || '').includes(',') ? 's' : ''}:</strong> {(gown.color || '').split(',').join(', ')}</Typography>
                        <Typography><strong>Size{(gown.size || '').includes(',') ? 's' : ''}:</strong> {sortSizes(gown.size).join('-')}</Typography>
                        <Typography><strong>Location:</strong> {gown.location}</Typography>
                        {gown.brand && <Typography><strong>Brand:</strong> {gown.brand}</Typography>}
                        {gown.condition && <Typography><strong>Condition:</strong> {gown.condition}</Typography>}
                        {gown.length && <Typography><strong>Height/Length:</strong> {gown.length}</Typography>}
                        {gown.pricePaid && <Typography><strong>Original Gown Value:</strong> ${gown.pricePaid}</Typography>}
                    </Stack>

                    {styleTags.length > 0 && (
                        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
                            {styleTags.map(t => <Chip key={t} label={styleLabel(t)} size="small" variant="outlined" />)}
                        </Stack>
                    )}

                    {gown.notes && (
                        <>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="subtitle2" gutterBottom>Notes from the seller</Typography>
                            <Typography variant="body2" color="text.secondary">{gown.notes}</Typography>
                        </>
                    )}

                    <Button
                        variant="contained" size="large" fullWidth sx={{ mt: 3 }}
                        onClick={onInterestedClick} disabled={loading}
                    >
                        {loading ? <CircularProgress size={22} color="inherit" /> : "I'm Interested"}
                    </Button>
                </Grid>
            </Grid>

            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth fullScreen={fullScreen}>
                <DialogTitle>Contact Info</DialogTitle>
                <DialogContent>
                    {contactInfo?.ownerName && <Typography><strong>Name:</strong> {contactInfo.ownerName}</Typography>}
                    <Typography><strong>Phone:</strong> {contactInfo?.ownerNumber}</Typography>
                    <Typography><strong>Email:</strong> {contactInfo?.ownerEmail}</Typography>
                    <Typography><strong>Location:</strong> {contactInfo?.location}</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={zoomOpen} onClose={() => setZoomOpen(false)} maxWidth="lg" fullScreen={fullScreen}
                slotProps={{ paper: { sx: { bgcolor: 'rgba(0,0,0,0.92)', boxShadow: 'none' } } }}
            >
                <IconButton
                    onClick={() => setZoomOpen(false)}
                    sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, color: '#fff', bgcolor: 'rgba(0,0,0,0.4)', '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' } }}
                >
                    <CloseIcon />
                </IconButton>
                <DialogContent
                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 1, sm: 3 } }}
                >
                    <Box
                        component="img"
                        src={activeImage}
                        alt={gown.description}
                        sx={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain' }}
                    />
                </DialogContent>
                {thumbnails.length > 1 && (
                    <Stack direction="row" spacing={1} justifyContent="center" sx={{ pb: 2, flexWrap: 'wrap', px: 2 }}>
                        {thumbnails.map((url) => (
                            <Box
                                key={url}
                                component="img"
                                src={url}
                                onClick={() => setActiveImage(url)}
                                sx={{
                                    width: 56, height: 56, objectFit: 'cover', borderRadius: 1, cursor: 'pointer',
                                    border: '2px solid', borderColor: activeImage === url ? 'primary.main' : 'transparent'
                                }}
                            />
                        ))}
                    </Stack>
                )}
            </Dialog>
        </Box>
    );
};

export default ViewGown;
