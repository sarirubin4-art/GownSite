import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Box, Typography, Tabs, Tab, Card, CardActionArea, Chip, Stack, Button, TextField, MenuItem } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PlaceIcon from '@mui/icons-material/Place';
import PublicIcon from '@mui/icons-material/Public';
import { AD_CATEGORY_OPTIONS, adCategoryLabel } from '../constants/gownOptions';
import { useAdLane } from '../context/AdLaneContext';
import usePageTitle from '../hooks/usePageTitle';

const ALL_LOCATIONS = 'All';

const BrowseAds = () => {
    usePageTitle('Ad Directory', 'Browse trusted simcha service providers — hair, makeup, alterations, gown rental/sales, apparel, and more.');
    const navigate = useNavigate();
    const { laneSx } = useAdLane();
    const [ads, setAds] = useState([]);
    const [category, setCategory] = useState('All');
    const [location, setLocation] = useState(ALL_LOCATIONS);
    const [locationOptions, setLocationOptions] = useState([]);

    useEffect(() => {
        const load = async () => {
            const { data } = await axios.get('/api/ad/getactive');
            setAds(data);
        };
        load();
        axios.get('/api/ad/locations').then(({ data }) => setLocationOptions(data));
    }, []);

    const visibleAds = ads
        .filter(a => category === 'All' || a.category === category)
        // An ad marked "serves all locations" is relevant no matter which location is
        // selected, so it isn't filtered out the way a location mismatch normally would.
        .filter(a => location === ALL_LOCATIONS || a.servesAllLocations || a.location === location);

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
                sx={{ mr: laneSx, borderBottom: 1, borderColor: 'divider' }}
            >
                <Tab label="All" value="All" />
                {AD_CATEGORY_OPTIONS.map(c => (
                    <Tab key={c.value} label={c.label} value={c.value} />
                ))}
            </Tabs>

            <TextField
                select size="small" label="Location" value={location}
                onChange={(e) => setLocation(e.target.value)}
                sx={{ width: 220, mt: 2, mb: 4, mr: laneSx }}
            >
                <MenuItem value={ALL_LOCATIONS}>All Locations</MenuItem>
                {locationOptions.map((loc) => <MenuItem key={loc} value={loc}>{loc}</MenuItem>)}
            </TextField>

            {visibleAds.length === 0 ? (
                <Typography color="text.secondary">No advertisers in this category yet.</Typography>
            ) : (
                <Stack spacing={2.5} sx={{ mr: laneSx }}>
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
                                            width: { xs: '100%', sm: 240, lg: 300 },
                                            aspectRatio: '1 / 1',
                                            objectFit: 'cover',
                                            flexShrink: 0
                                        }}
                                    />
                                )}
                                <Box sx={{ p: 2.5, flex: 1, minWidth: 0 }}>
                                    <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                                        <Chip size="small" label={adCategoryLabel(ad.category)} color="primary" variant="outlined" />
                                        {ad.servesAllLocations ? (
                                            <Chip size="small" icon={<PublicIcon />} label="All Locations" variant="outlined" />
                                        ) : ad.location ? (
                                            <Chip size="small" icon={<PlaceIcon />} label={ad.location} variant="outlined" />
                                        ) : null}
                                    </Stack>
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
