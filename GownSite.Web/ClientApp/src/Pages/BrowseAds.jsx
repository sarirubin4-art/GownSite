import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Box, Typography, Tabs, Tab, Card, CardActionArea, Chip, Stack, Button } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { AD_CATEGORY_OPTIONS, adCategoryLabel } from '../constants/gownOptions';
import { useAdLane } from '../context/AdLaneContext';
import usePageTitle from '../hooks/usePageTitle';

const BrowseAds = () => {
    usePageTitle('Ad Directory', 'Browse trusted simcha service providers — hair, makeup, alterations, gown rental/sales, apparel, and more.');
    const navigate = useNavigate();
    const { adVisible, laneWidth } = useAdLane();
    const [ads, setAds] = useState([]);
    const [category, setCategory] = useState('All');

    useEffect(() => {
        const load = async () => {
            const { data } = await axios.get('/api/ad/getactive');
            setAds(data);
        };
        load();
    }, []);

    const visibleAds = category === 'All' ? ads : ads.filter(a => a.category === category);

    return (
        <Box>
            <Typography variant="h4" gutterBottom>Our Advertisers</Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
                Trusted simcha businesses — hair, makeup, alterations, gowns, and more.
            </Typography>

            <Tabs
                value={category}
                onChange={(e, value) => setCategory(value)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ mb: 4, mr: { xs: 0, md: adVisible ? `${laneWidth}px` : 0 }, borderBottom: 1, borderColor: 'divider' }}
            >
                <Tab label="All" value="All" />
                {AD_CATEGORY_OPTIONS.map(c => (
                    <Tab key={c.value} label={c.label} value={c.value} />
                ))}
            </Tabs>

            {visibleAds.length === 0 ? (
                <Typography color="text.secondary">No advertisers in this category yet.</Typography>
            ) : (
                <Stack spacing={2.5}>
                    {visibleAds.map((ad) => (
                        <Card key={ad.id}>
                            <CardActionArea
                                onClick={() => navigate(`/ad/${ad.id}`)}
                                sx={{ display: 'flex', alignItems: 'stretch', flexDirection: { xs: 'column', sm: 'row' } }}
                            >
                                {ad.imageUrl && (
                                    <Box
                                        component="img"
                                        src={ad.imageUrl}
                                        alt={ad.title}
                                        sx={{
                                            width: { xs: '100%', sm: 240 },
                                            aspectRatio: '1 / 1',
                                            objectFit: 'cover',
                                            flexShrink: 0
                                        }}
                                    />
                                )}
                                <Box sx={{ p: 2.5, flex: 1, minWidth: 0 }}>
                                    <Chip size="small" label={adCategoryLabel(ad.category)} color="primary" variant="outlined" sx={{ mb: 1 }} />
                                    <Typography variant="h6" gutterBottom>{ad.title}</Typography>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        {ad.description}
                                    </Typography>
                                    <Stack direction="row" spacing={0.5} sx={{ mt: 1.5, alignItems: 'center', color: 'primary.main' }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>View details</Typography>
                                        <ArrowForwardIcon fontSize="small" />
                                    </Stack>
                                </Box>
                            </CardActionArea>
                        </Card>
                    ))}
                </Stack>
            )}

            <Box sx={{ mt: 6, p: 3, textAlign: 'center', borderRadius: 3, bgcolor: 'secondary.light' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                    Own a simcha-related business?
                </Typography>
                <Button component={Link} to="/advertise" variant="contained">
                    Advertise With Us
                </Button>
            </Box>
        </Box>
    );
};

export default BrowseAds;
