import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Box, Typography, Button, Chip, Stack } from '@mui/material';
import PlaceIcon from '@mui/icons-material/Place';
import PublicIcon from '@mui/icons-material/Public';
import { adCategoryLabel } from '../constants/gownOptions';
import usePageTitle from '../hooks/usePageTitle';

const AdDetail = () => {
    const { id } = useParams();
    const [ad, setAd] = useState(null);

    usePageTitle(ad ? ad.title : 'Simcha Service', ad ? ad.description : undefined);

    useEffect(() => {
        const load = async () => {
            const { data } = await axios.get(`/api/ad/get?id=${id}`);
            setAd(data);
        };
        load();
    }, [id]);

    if (!ad) return null;

    return (
        <Box sx={{ maxWidth: { xs: 720, lg: 880 }, mx: 'auto', textAlign: 'center' }}>
            <Stack direction="row" spacing={1} sx={{ justifyContent: 'center', mb: 2 }}>
                <Chip label={adCategoryLabel(ad.category)} color="primary" />
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
            {ad.targetUrl && (
                <Button variant="contained" size="large" href={ad.targetUrl} target="_blank" rel="noopener noreferrer">
                    Learn More
                </Button>
            )}
            <Box sx={{ mt: 4 }}>
                <Button component={Link} to="/search">Back to Browsing</Button>
            </Box>
        </Box>
    );
};

export default AdDetail;
