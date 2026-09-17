import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import {
    Box, Typography, Button, Chip, Stack, Dialog, DialogTitle, DialogContent,
    DialogActions, CircularProgress
} from '@mui/material';
import PlaceIcon from '@mui/icons-material/Place';
import PublicIcon from '@mui/icons-material/Public';
import { adCategoryLabels } from '../constants/gownOptions';
import usePageTitle from '../hooks/usePageTitle';
import { getCachedInterest, setCachedInterest } from '../utils/interestCache';

const AdDetail = () => {
    const { id } = useParams();
    const [ad, setAd] = useState(null);
    const [contactInfo, setContactInfo] = useState(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    usePageTitle(ad ? ad.title : 'Simcha Service', ad ? ad.description : undefined);

    useEffect(() => {
        window.scrollTo(0, 0);
        const load = async () => {
            const { data } = await axios.get(`/api/ad/get?id=${id}`);
            setAd(data);
        };
        load();
    }, [id]);

    const onContactClick = async () => {
        const cached = getCachedInterest('ad', id);
        if (cached) {
            setContactInfo(cached);
            setDialogOpen(true);
            return;
        }

        setLoading(true);
        try {
            const { data } = await axios.post('/api/ad/inquire', { id: Number(id) });
            setContactInfo(data);
            setDialogOpen(true);
            setCachedInterest('ad', id, data);
        } finally {
            setLoading(false);
        }
    };

    if (!ad) return null;

    const hasContactInfo = ad.showName || ad.showPhone || ad.showEmail;

    return (
        <Box sx={{ maxWidth: { xs: 720, lg: 880 }, mx: 'auto', textAlign: 'center' }}>
            <Stack direction="row" spacing={1} sx={{ justifyContent: 'center', mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
                {adCategoryLabels(ad.categories).map((label) => (
                    <Chip key={label} label={label} color="primary" />
                ))}
                {ad.servesAllLocations ? (
                    <Chip icon={<PublicIcon />} label="Serves All Locations" variant="outlined" />
                ) : ad.location ? (
                    <Chip icon={<PlaceIcon />} label={ad.location} variant="outlined" />
                ) : null}
            </Stack>
            <Typography variant="h3" gutterBottom>{ad.title}</Typography>
            {ad.imageUrl && (
                <Box sx={{ width: '100%', maxWidth: { xs: 420, lg: 520 }, aspectRatio: '1 / 1', mx: 'auto', borderRadius: 3, mb: 3, bgcolor: 'background.paper', overflow: 'hidden' }}>
                    <Box component="img" src={ad.imageUrl} alt={ad.title} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </Box>
            )}
            <Typography variant="body1" sx={{ mb: 4, whiteSpace: 'pre-line' }}>{ad.description}</Typography>
            <Stack direction="row" spacing={2} sx={{ justifyContent: 'center', flexWrap: 'wrap', rowGap: 2 }}>
                {ad.targetUrl && (
                    <Button variant="contained" size="large" href={ad.targetUrl} target="_blank" rel="noopener noreferrer">
                        Learn More
                    </Button>
                )}
                {hasContactInfo && (
                    <Button variant="outlined" size="large" onClick={onContactClick} disabled={loading}>
                        {loading ? <CircularProgress size={24} /> : 'Contact'}
                    </Button>
                )}
            </Stack>
            <Box sx={{ mt: 4 }}>
                <Button component={Link} to="/search">Back to Browsing</Button>
            </Box>

            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Contact Info</DialogTitle>
                <DialogContent>
                    {contactInfo?.ownerName && <Typography><strong>Name:</strong> {contactInfo.ownerName}</Typography>}
                    {contactInfo?.ownerNumber && <Typography><strong>Phone:</strong> {contactInfo.ownerNumber}</Typography>}
                    {contactInfo?.ownerEmail && <Typography><strong>Email:</strong> {contactInfo.ownerEmail}</Typography>}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default AdDetail;
