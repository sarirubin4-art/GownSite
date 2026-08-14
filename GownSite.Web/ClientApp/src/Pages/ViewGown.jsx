import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
    Box, Grid, Typography, Chip, Button, Divider, Stack, Dialog, DialogTitle,
    DialogContent, DialogActions, CircularProgress
} from '@mui/material';
import { styleLabel } from '../constants/gownOptions';
import useFullScreenDialog from '../hooks/useFullScreenDialog';
import usePageTitle from '../hooks/usePageTitle';
import { useAdLane } from '../context/AdLaneContext';

const ViewGown = () => {
    const { id } = useParams();
    const fullScreen = useFullScreenDialog();
    const { adVisible, laneWidth } = useAdLane();
    const [gown, setGown] = useState(null);
    const [activeImage, setActiveImage] = useState(null);
    const [contactInfo, setContactInfo] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    usePageTitle(
        gown ? `${[gown.color, gown.size ? `Size ${gown.size}` : null].filter(Boolean).join(', ')} Gown ${gown.listingType === 'Sale' ? 'for Sale' : 'for Rent'}${gown.location ? ` in ${gown.location}` : ''}` : 'Gown Listing',
        gown ? gown.description : undefined
    );

    useEffect(() => {
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
            <Grid container spacing={4} sx={{ mr: { xs: 0, md: adVisible ? `${laneWidth}px` : 0 } }}>
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
                                justifyContent: 'center'
                            }}
                        >
                            <Box
                                component="img"
                                src={activeImage}
                                alt={gown.description}
                                sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                            />
                            {gown.isSold && (
                                <Box sx={{
                                    position: 'absolute', inset: 0, zIndex: 1,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none'
                                }}>
                                    <Typography sx={{
                                        fontFamily: `'Playfair Display', serif`, fontWeight: 700,
                                        fontSize: { xs: '2.25rem', sm: '3rem' }, letterSpacing: 6, textTransform: 'uppercase',
                                        color: 'rgba(255,255,255,0.92)', bgcolor: 'rgba(156, 78, 88, 0.6)',
                                        border: '3px solid rgba(255,255,255,0.85)', borderRadius: 1,
                                        px: 4, py: 1, transform: 'rotate(-18deg)',
                                        boxShadow: '0 6px 20px rgba(0,0,0,0.25)'
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
                    <Typography variant="h4" gutterBottom>${gown.price}</Typography>
                    <Typography variant="body1" sx={{ mb: 2 }}>{gown.description}</Typography>

                    <Stack spacing={0.75} sx={{ mb: 2 }}>
                        <Typography><strong>Color{(gown.color || '').includes(',') ? 's' : ''}:</strong> {(gown.color || '').split(',').join(', ')}</Typography>
                        <Typography><strong>Size{(gown.size || '').includes(',') ? 's' : ''}:</strong> {(gown.size || '').split(',').join('-')}</Typography>
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
        </Box>
    );
};

export default ViewGown;
