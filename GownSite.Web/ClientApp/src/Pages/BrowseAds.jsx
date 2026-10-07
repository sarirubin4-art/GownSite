import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Box, Typography, Tabs, Tab, Card, CardActionArea, Chip, Stack, Button, TextField, MenuItem } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PlaceIcon from '@mui/icons-material/Place';
import PublicIcon from '@mui/icons-material/Public';
import { AD_CATEGORY_OPTIONS, adCategoryLabels } from '../constants/gownOptions';
import { useAdLane } from '../context/AdLaneContext';
import usePageTitle from '../hooks/usePageTitle';
import useDragSelectGuard from '../hooks/useDragSelectGuard';
import { orderAdsForDisplay } from '../utils/shuffle';
import { focalObjectPosition } from '../utils/imageFocal';
import LoadingSpinner from '../components/LoadingSpinner';

const ALL_LOCATIONS = 'All';

// Always at the end of the tab strip, in this order, whether or not they have ads.
const PINNED_LAST_CATEGORIES = ['Gemachs', 'Other'];

// Dropdown: plain A-Z so a specific category is easy to find, with "Other" pinned last.
const ALPHABETICAL_CATEGORIES = [...AD_CATEGORY_OPTIONS].sort((a, b) =>
    a.value === 'Other' ? 1 : b.value === 'Other' ? -1 : a.label.localeCompare(b.label));

const BrowseAds = () => {
    usePageTitle('Ad Directory', 'Browse trusted event service providers — hair, makeup, alterations, gown rental/sales, apparel, and more.');
    const navigate = useNavigate();
    const { laneSx } = useAdLane();
    const [ads, setAds] = useState([]);
    const [adsLoaded, setAdsLoaded] = useState(false);
    const [category, setCategory] = useState('All');
    const [location, setLocation] = useState(ALL_LOCATIONS);
    const [locationOptions, setLocationOptions] = useState([]);
    const dragSelectGuard = useDragSelectGuard();

    useEffect(() => {
        const load = async () => {
            try {
                const { data } = await axios.get('/api/ad/getactive');
                setAds(data);
            } finally {
                setAdsLoaded(true);
            }
        };
        load();
        axios.get('/api/ad/locations').then(({ data }) => setLocationOptions(data));
    }, []);

    // "All" stays in the backend's plain most-recently-posted order; a specific category
    // tab is a smaller pool, so it gets the recent-first/shuffle-the-rest treatment to
    // keep any one advertiser from permanently owning top placement in that category.
    // Memoized so it doesn't reshuffle on every render — only when the ad list itself changes.
    const shuffledAds = useMemo(() => orderAdsForDisplay(ads), [ads]);

    // Tabs follow AD_CATEGORY_OPTIONS' hand-picked order, except that categories with no
    // live ads move behind the ones that have some (keeping their relative order), so
    // visitors don't land on empty tabs first. Gemachs and Other always stay at the end.
    const tabCategories = useMemo(() => {
        const withAds = new Set(ads.flatMap((a) => (a.categories || '').split(',').filter(Boolean)));
        const regular = AD_CATEGORY_OPTIONS.filter((c) => !PINNED_LAST_CATEGORIES.includes(c.value));
        return [
            ...regular.filter((c) => withAds.has(c.value)),
            ...regular.filter((c) => !withAds.has(c.value)),
            ...PINNED_LAST_CATEGORIES.map((value) => AD_CATEGORY_OPTIONS.find((c) => c.value === value))
        ];
    }, [ads]);

    const visibleAds = (category === 'All' ? ads : shuffledAds)
        .filter(a => category === 'All' || (a.categories || '').split(',').includes(category))
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
                {tabCategories.map(c => (
                    <Tab key={c.value} label={c.label} value={c.value} />
                ))}
            </Tabs>

            <Stack
                direction="row" spacing={2} sx={{ mt: 2, mb: 4, mr: laneSx, flexWrap: 'wrap', rowGap: 2 }}
                {...dragSelectGuard}
            >
                {/* Mirrors the tab strip above (same category state) — the tabs alone can look
                    like a fixed, short list, so this dropdown makes the full category set
                    discoverable without needing to scroll the tabs to find it. */}
                <TextField
                    select size="small" label="Category" value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    sx={{ width: 220 }}
                >
                    <MenuItem value="All">All Categories</MenuItem>
                    {ALPHABETICAL_CATEGORIES.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
                </TextField>
                <TextField
                    select size="small" label="Location" value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    sx={{ width: 220 }}
                >
                    <MenuItem value={ALL_LOCATIONS}>All Locations</MenuItem>
                    {locationOptions.map((loc) => <MenuItem key={loc} value={loc}>{loc}</MenuItem>)}
                </TextField>
            </Stack>

            {!adsLoaded ? (
                <LoadingSpinner />
            ) : visibleAds.length === 0 ? (
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
                                            objectPosition: focalObjectPosition(ad.imageFocalX, ad.imageFocalY),
                                            flexShrink: 0
                                        }}
                                    />
                                )}
                                <Box sx={{ p: 2.5, flex: 1, minWidth: 0 }}>
                                    <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', rowGap: 1 }}>
                                        {adCategoryLabels(ad.categories).map((label) => (
                                            <Chip key={label} size="small" label={label} color="primary" variant="outlined" />
                                        ))}
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
                    Own an event-related business?
                </Typography>
                <Button component={Link} to="/advertise" variant="contained">
                    Advertise With Us
                </Button>
            </Box>
        </Box>
    );
};

export default BrowseAds;
