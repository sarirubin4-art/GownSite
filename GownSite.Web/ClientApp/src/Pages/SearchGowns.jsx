import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
    Typography, Paper, Grid, Autocomplete, TextField, Card, CardActionArea,
    CardMedia, CardContent, Box, Chip, Snackbar, Alert, Button, Stack,
    Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, Pagination
} from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { COLOR_OPTIONS, SIZE_OPTIONS, STYLE_OPTIONS, LISTING_TYPE_OPTIONS, styleLabel, formatPriceRange, sortSizes } from '../constants/gownOptions';
import { useAdLane } from '../context/AdLaneContext';
import useFullScreenDialog from '../hooks/useFullScreenDialog';
import usePageTitle from '../hooks/usePageTitle';

const emptyFilters = { colors: [], sizes: [], locations: [], styles: [], listingTypes: [], minPrice: '', maxPrice: '' };
const PAGE_SIZE = 24;

// Filters (and the current page) live in the URL rather than plain component state, so
// the browser's own back/forward history — not just this component's lifetime — is what
// remembers them. Array fields use repeated params (?colors=Navy&colors=Black) rather
// than a joined string, since location values already contain commas ("Brooklyn, NY").
const filtersFromParams = (params) => ({
    colors: params.getAll('colors'),
    sizes: params.getAll('sizes'),
    locations: params.getAll('locations'),
    styles: params.getAll('styles'),
    listingTypes: params.getAll('listingTypes'),
    minPrice: params.get('minPrice') || '',
    maxPrice: params.get('maxPrice') || ''
});

// Multi-select filter field: stays open after each pick (instead of closing and
// forcing you to reopen it for the next selection), and shows "All" as a placeholder
// once the label shrinks out of the way, so it's clear the field is optional.
const FilterAutocomplete = ({ label, options, value, onChange, getOptionLabel, size = 'small' }) => (
    <Autocomplete
        multiple size={size} disableCloseOnSelect
        options={options} value={value} onChange={onChange}
        getOptionLabel={getOptionLabel}
        renderInput={(params) => (
            <TextField
                {...params}
                label={label}
                placeholder={value.length === 0 ? 'All' : undefined}
                slotProps={{ ...params.slotProps, inputLabel: { ...params.slotProps?.inputLabel, shrink: true } }}
            />
        )}
    />
);

const SearchGowns = () => {
    usePageTitle('Browse Gowns for Rent & Sale', 'Search gowns for rent or sale by color, size, style, and location — find the perfect dress for your simcha.');
    const navigate = useNavigate();
    const routerLocation = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const { laneSx, adVisible, adStackTop } = useAdLane();
    const fullScreen = useFullScreenDialog();
    const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const [results, setResults] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [searching, setSearching] = useState(true);
    const [locationOptions, setLocationOptions] = useState([]);
    const [showPostedNotice, setShowPostedNotice] = useState(!!routerLocation.state?.posted);
    const [notifyOpen, setNotifyOpen] = useState(false);
    const [notifyFilters, setNotifyFilters] = useState(emptyFilters);
    const [notifyEmail, setNotifyEmail] = useState('');
    const [notifyError, setNotifyError] = useState('');
    const [notifySubmitting, setNotifySubmitting] = useState(false);
    const [showNotifySuccess, setShowNotifySuccess] = useState(false);

    const searchSeq = useRef(0);
    const scrollRestoreRef = useRef(null);

    // Captured once on mount (not on every filter/page change, which re-renders this same
    // component in place) so that arriving here via the browser's back button — after
    // clicking into a gown — restores exactly where the user had scrolled to.
    useEffect(() => {
        const key = `searchScroll:${routerLocation.pathname}${routerLocation.search}`;
        const saved = sessionStorage.getItem(key);
        if (saved) scrollRestoreRef.current = Number(saved);
    }, []);

    useEffect(() => {
        const key = `searchScroll:${routerLocation.pathname}${routerLocation.search}`;
        let timeout;
        const onScroll = () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => sessionStorage.setItem(key, String(window.scrollY)), 150);
        };
        window.addEventListener('scroll', onScroll);
        return () => {
            window.removeEventListener('scroll', onScroll);
            clearTimeout(timeout);
        };
    }, [routerLocation.pathname, routerLocation.search]);

    const runSearch = async (f, p) => {
        const seq = ++searchSeq.current;
        setSearching(true);
        const body = {
            colors: f.colors,
            sizes: f.sizes,
            locations: f.locations,
            styles: f.styles,
            listingTypes: f.listingTypes,
            minPrice: f.minPrice === '' ? null : Number(f.minPrice),
            maxPrice: f.maxPrice === '' ? null : Number(f.maxPrice),
            page: p,
            pageSize: PAGE_SIZE
        };
        try {
            const { data } = await axios.post('/api/gown/search', body);
            if (seq !== searchSeq.current) return; // a newer search already started; ignore this stale response
            setResults(data.items);
            setTotalCount(data.totalCount);
            if (scrollRestoreRef.current != null) {
                window.scrollTo(0, scrollRestoreRef.current);
                scrollRestoreRef.current = null;
            }
        } finally {
            if (seq === searchSeq.current) setSearching(false);
        }
    };

    useEffect(() => {
        runSearch(filters, page);
    }, [searchParams]);

    // The Location filter's option list needs every location in the marketplace, not just
    // the ones on the current page of results — fetched once, independent of pagination.
    useEffect(() => {
        axios.get('/api/gown/locations').then(({ data }) => setLocationOptions(data));
    }, []);

    useEffect(() => {
        if (routerLocation.state?.posted) {
            navigate(routerLocation.pathname + routerLocation.search, { replace: true, state: {} });
        }
    }, []);

    // Every filter/page change replaces the current history entry (not a new one) so the
    // URL's query string is always the single source of truth for "where the user is" —
    // clicking into a gown then hitting Back lands on exactly the last filters/page shown.
    const updateParams = (mutate, { resetPage = true } = {}) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            mutate(next);
            if (resetPage) next.delete('page');
            return next;
        }, { replace: true });
    };

    const setField = (field) => (event, value) => updateParams((next) => {
        next.delete(field);
        value.forEach((v) => next.append(field, v));
    });

    const setPriceField = (field) => (event) => updateParams((next) => {
        if (event.target.value === '') next.delete(field);
        else next.set(field, event.target.value);
    });

    const onPageChange = (event, value) => {
        updateParams((next) => {
            if (value > 1) next.set('page', String(value));
            else next.delete('page');
        }, { resetPage: false });
        window.scrollTo(0, 0);
    };

    const setNotifyField = (field) => (event, value) => setNotifyFilters((prev) => ({ ...prev, [field]: value }));

    const onOpenNotify = () => {
        setNotifyFilters({ ...filters, minPrice: '', maxPrice: '' });
        setNotifyError('');
        setNotifyOpen(true);
    };

    const onNotifySubmit = async () => {
        setNotifyError('');
        const hasCriteria = notifyFilters.colors.length > 0 || notifyFilters.sizes.length > 0
            || notifyFilters.locations.length > 0 || notifyFilters.styles.length > 0 || notifyFilters.listingTypes.length > 0;
        if (!notifyEmail.trim()) {
            setNotifyError('Enter an email address.');
            return;
        }
        if (!hasCriteria) {
            setNotifyError('Choose at least one thing to be notified about.');
            return;
        }
        setNotifySubmitting(true);
        try {
            await axios.post('/api/alert/create', {
                email: notifyEmail,
                colors: notifyFilters.colors,
                sizes: notifyFilters.sizes,
                locations: notifyFilters.locations,
                styles: notifyFilters.styles,
                listingTypes: notifyFilters.listingTypes
            });
            setNotifyOpen(false);
            setNotifyEmail('');
            setShowNotifySuccess(true);
        } catch (err) {
            setNotifyError(err?.response?.data?.message || 'Could not save your alert.');
        } finally {
            setNotifySubmitting(false);
        }
    };

    const showFixedNotify = adVisible && adStackTop != null;

    return (
        <Box>
            <Stack
                direction="row"
                useFlexGap
                spacing={1.5}
                sx={{ flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', mb: 1, mr: laneSx }}
            >
                <Typography variant="h4">Browse Gowns</Typography>
                <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    startIcon={<NotificationsActiveIcon />}
                    onClick={onOpenNotify}
                    sx={{
                        boxShadow: '0 4px 16px rgba(198, 113, 122, 0.4)',
                        '&:hover': { boxShadow: '0 6px 20px rgba(198, 113, 122, 0.55)' }
                    }}
                >
                    <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>Notify Me</Box>
                    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Notify Me About New Gowns</Box>
                </Button>
            </Stack>

            {/* On desktop, once the ad card is visible and measured, a second Notify Me
                floats below it as a scroll-persistent reminder — the one above (which stays
                put) is still the primary, guaranteed-visible call to action. */}
            {showFixedNotify && (
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<NotificationsActiveIcon />}
                    onClick={onOpenNotify}
                    sx={{
                        display: { xs: 'none', md: 'inline-flex' },
                        justifyContent: 'center',
                        position: 'fixed',
                        top: adStackTop,
                        right: 20,
                        zIndex: 1300,
                        width: { md: 200, lg: 240, xl: 280 },
                        boxShadow: '0 4px 16px rgba(198, 113, 122, 0.4)',
                        '&:hover': { boxShadow: '0 6px 20px rgba(198, 113, 122, 0.55)' }
                    }}
                >
                    Notify Me
                </Button>
            )}

            <Paper variant="outlined" sx={{ p: 2.5, mb: 4, mr: laneSx }}>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                        <FilterAutocomplete
                            label="Color" options={COLOR_OPTIONS} value={filters.colors}
                            onChange={setField('colors')}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                        <FilterAutocomplete
                            label="Size" options={SIZE_OPTIONS} value={filters.sizes}
                            onChange={setField('sizes')}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                        <FilterAutocomplete
                            label="Location" options={locationOptions} value={filters.locations}
                            onChange={setField('locations')}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                        <FilterAutocomplete
                            label="Style" options={STYLE_OPTIONS.map(s => s.value)}
                            getOptionLabel={styleLabel} value={filters.styles}
                            onChange={setField('styles')}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                        <FilterAutocomplete
                            label="Rent / Sale" options={LISTING_TYPE_OPTIONS.map(o => o.value)}
                            getOptionLabel={(v) => LISTING_TYPE_OPTIONS.find(o => o.value === v)?.label || v}
                            value={filters.listingTypes}
                            onChange={setField('listingTypes')}
                        />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3, md: 2 }}>
                        <TextField
                            size="small" label="Min Price" type="number" fullWidth
                            value={filters.minPrice}
                            onChange={setPriceField('minPrice')}
                        />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3, md: 2 }}>
                        <TextField
                            size="small" label="Max Price" type="number" fullWidth
                            value={filters.maxPrice}
                            onChange={setPriceField('maxPrice')}
                        />
                    </Grid>
                </Grid>
            </Paper>

            {searching && results.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress />
                </Box>
            ) : results.length === 0 ? (
                <Typography color="text.secondary">No gowns match your search yet. Try adjusting the filters.</Typography>
            ) : (
                <Grid container spacing={3} sx={{ opacity: searching ? 0.6 : 1, transition: 'opacity 0.2s', mr: laneSx }}>
                    {results.map((gown) => (
                        <Grid key={gown.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                            <Card sx={{ position: 'relative' }}>
                                <CardActionArea
                                    onClick={() => navigate(`/gown/${gown.id}`)}
                                    sx={{ '&:hover .gown-card-image': { objectFit: 'contain' } }}
                                >
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
                                        image={gown.primaryPictureUrl}
                                        alt={gown.description}
                                        className="gown-card-image"
                                        sx={{
                                            objectFit: 'cover',
                                            bgcolor: 'background.default',
                                            opacity: gown.isSold ? 0.55 : 1
                                        }}
                                    />
                                    <CardContent>
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
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            {totalCount > PAGE_SIZE && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <Pagination
                        count={Math.ceil(totalCount / PAGE_SIZE)}
                        page={page}
                        onChange={onPageChange}
                        color="primary"
                        size={fullScreen ? 'small' : 'medium'}
                    />
                </Box>
            )}

            <Snackbar
                open={showPostedNotice}
                autoHideDuration={6000}
                onClose={() => setShowPostedNotice(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setShowPostedNotice(false)} severity="success" variant="filled">
                    Posted successfully! Your gown is now live.
                </Alert>
            </Snackbar>

            <Dialog open={notifyOpen} onClose={() => setNotifyOpen(false)} maxWidth="sm" fullWidth fullScreen={fullScreen}>
                <DialogTitle>Notify Me</DialogTitle>
                <DialogContent>
                    <Typography color="text.secondary" sx={{ mb: 2 }}>
                        Get an email as soon as a gown matching your criteria goes live. Leave a field blank to match anything.
                    </Typography>
                    {notifyError && <Alert severity="warning" sx={{ mb: 2 }}>{notifyError}</Alert>}
                    <Stack spacing={2}>
                        <TextField
                            label="Email" type="email" fullWidth
                            value={notifyEmail}
                            onChange={(e) => setNotifyEmail(e.target.value)}
                        />
                        <FilterAutocomplete
                            size="medium" label="Color" options={COLOR_OPTIONS} value={notifyFilters.colors}
                            onChange={setNotifyField('colors')}
                        />
                        <FilterAutocomplete
                            size="medium" label="Size" options={SIZE_OPTIONS} value={notifyFilters.sizes}
                            onChange={setNotifyField('sizes')}
                        />
                        <FilterAutocomplete
                            size="medium" label="Location" options={locationOptions} value={notifyFilters.locations}
                            onChange={setNotifyField('locations')}
                        />
                        <FilterAutocomplete
                            size="medium" label="Style" options={STYLE_OPTIONS.map(s => s.value)}
                            getOptionLabel={styleLabel} value={notifyFilters.styles}
                            onChange={setNotifyField('styles')}
                        />
                        <FilterAutocomplete
                            size="medium" label="Rent / Sale" options={LISTING_TYPE_OPTIONS.map(o => o.value)}
                            getOptionLabel={(v) => LISTING_TYPE_OPTIONS.find(o => o.value === v)?.label || v}
                            value={notifyFilters.listingTypes}
                            onChange={setNotifyField('listingTypes')}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setNotifyOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={onNotifySubmit} disabled={notifySubmitting}>
                        Save Alert
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={showNotifySuccess}
                autoHideDuration={6000}
                onClose={() => setShowNotifySuccess(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setShowNotifySuccess(false)} severity="success" variant="filled">
                    You're all set! We'll email you when a matching gown goes live.
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default SearchGowns;
