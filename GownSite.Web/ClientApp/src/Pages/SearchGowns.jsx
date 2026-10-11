import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import {
    Typography, Paper, Grid, TextField, Box, Snackbar, Alert, Button, Stack,
    Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, Pagination
} from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { COLOR_OPTIONS, SIZE_OPTIONS, STYLE_OPTIONS, LISTING_TYPE_OPTIONS, styleLabel } from '../constants/gownOptions';
import { useAdLane } from '../context/AdLaneContext';
import useFullScreenDialog from '../hooks/useFullScreenDialog';
import usePageTitle from '../hooks/usePageTitle';
import FilterAutocomplete from '../components/FilterAutocomplete';
import GownCard from '../components/GownCard';
import SmartSearchBar from '../components/SmartSearchBar';
import { parsedToSearchParams } from '../utils/parseSearchQuery';
import { loadLocations } from '../utils/locations';
import { trackNoResultsSearch } from '../utils/analytics';

const emptyFilters = { colors: [], sizes: [], locations: [], styles: [], listingTypes: [], minPrice: '', maxPrice: '', keywords: '' };
const PAGE_SIZE = 24;

// The server orders results exact matches first, then close, then the rest, and reports
// how many are in each of the first two groups — so a result's group follows from its
// overall position. Headings only appear when there are near-matches at all; a plain
// all-exact result list looks exactly as it always did.
const TIER_HEADINGS = [
    { title: 'Exact matches', note: null },
    { title: 'Close matches', note: 'Neighboring sizes, similar colors and styles' },
    { title: 'You might also like', note: 'Matches most of what you’re looking for' },
];

const tierOf = (index, exactCount, closeCount) =>
    index < exactCount ? 0 : index < exactCount + closeCount ? 1 : 2;

// Splits one page of results into consecutive runs by group. Headings are skipped entirely
// when every result is an exact match (plain filter browsing looks as it always has), and
// the "Exact matches" heading is skipped when there are none — the notice above covers that.
const groupResults = (items, offset, exactCount, closeCount, totalCount) => {
    const hasSimilar = totalCount > exactCount;
    const groups = [];
    items.forEach((gown, i) => {
        const tier = tierOf(offset + i, exactCount, closeCount);
        const last = groups[groups.length - 1];
        if (last && last.tier === tier) last.items.push(gown);
        else groups.push({ tier, items: [gown], showHeading: hasSimilar });
    });
    return groups;
};

const TierHeading = ({ tier, count, first }) => (
    <Box sx={{ mt: first ? 0 : 6, mb: 2.5, pb: 1.25, borderBottom: '1px solid rgba(156, 78, 88, 0.18)' }}>
        <Typography component="h2" sx={{ fontFamily: `'Playfair Display', serif`, fontSize: '1.4rem', fontWeight: 600 }}>
            {TIER_HEADINGS[tier].title}
            {count != null && (
                <Box component="span" sx={{ ml: 1.5, fontFamily: `'Poppins', sans-serif`, fontSize: '0.85rem', fontWeight: 400, color: 'text.secondary' }}>
                    {count}
                </Box>
            )}
        </Typography>
        {TIER_HEADINGS[tier].note && (
            <Typography variant="body2" color="text.secondary">{TIER_HEADINGS[tier].note}</Typography>
        )}
    </Box>
);

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
    maxPrice: params.get('maxPrice') || '',
    keywords: params.get('keywords') || ''
});

const SearchGowns = () => {
    usePageTitle('Browse Gowns for Rent & Sale', 'Search gowns for rent or sale by color, size, style, and location — find the perfect dress for your event.');
    const navigate = useNavigate();
    const routerLocation = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const { laneSx, adVisible, adStackTop } = useAdLane();
    const fullScreen = useFullScreenDialog();
    const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const [results, setResults] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [exactCount, setExactCount] = useState(0);
    const [closeCount, setCloseCount] = useState(0);
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

    // "Searches with no results" on the admin Traffic tab should reflect what people actually
    // wanted, not every in-between filter combo on the way there — so an empty result is only
    // reported once it's been sitting on screen for a few seconds without another change.
    // (The server re-checks it's really empty and counts each search once per visit, which
    // covers pressing Back onto the same empty search.)
    const noResultsTimer = useRef(null);
    useEffect(() => () => clearTimeout(noResultsTimer.current), []);

    const runSearch = async (f, p) => {
        const seq = ++searchSeq.current;
        clearTimeout(noResultsTimer.current);
        setSearching(true);
        const body = {
            colors: f.colors,
            sizes: f.sizes,
            locations: f.locations,
            styles: f.styles,
            listingTypes: f.listingTypes,
            minPrice: f.minPrice === '' ? null : Number(f.minPrice),
            maxPrice: f.maxPrice === '' ? null : Number(f.maxPrice),
            keywords: f.keywords || null,
            includeSimilar: true,
            page: p,
            pageSize: PAGE_SIZE
        };
        try {
            const { data } = await axios.post('/api/gown/search', body);
            if (seq !== searchSeq.current) return; // a newer search already started; ignore this stale response
            setResults(data.items);
            setTotalCount(data.totalCount);
            setExactCount(data.exactCount);
            setCloseCount(data.closeCount);
            // Near-matches don't count as having found what they wanted — the server
            // re-checks this strictly too (see AnalyticsRecorder.RecordNoResultsSearch).
            if (data.exactCount === 0 && p <= 1) {
                noResultsTimer.current = setTimeout(() => trackNoResultsSearch(body), 4000);
            }
        } finally {
            if (seq === searchSeq.current) setSearching(false);
        }
    };

    // `text` (what was typed in the search bar) and `notify` (auto-open the alert dialog)
    // don't change the results, so dropping them from the URL shouldn't search again.
    const lastSearchKey = useRef(null);
    useEffect(() => {
        const params = new URLSearchParams(searchParams);
        params.delete('text');
        params.delete('notify');
        const key = params.toString();
        if (key === lastSearchKey.current) return;
        lastSearchKey.current = key;
        runSearch(filters, page);
    }, [searchParams]);

    // Runs after the new cards have actually been committed to the DOM (unlike calling
    // scrollTo right after setResults, which fires before React repaints — the page is
    // still its old, shorter height at that point and the scroll gets clamped short).
    useLayoutEffect(() => {
        if (results.length > 0 && scrollRestoreRef.current != null) {
            window.scrollTo(0, scrollRestoreRef.current);
            scrollRestoreRef.current = null;
        }
    }, [results]);

    // The Location filter's option list needs every location in the marketplace, not just
    // the ones on the current page of results — fetched once, independent of pagination.
    useEffect(() => {
        loadLocations().then(setLocationOptions);
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
            // A filter edit (as opposed to a page change) also drops `text`: it only seeds
            // the search bar with what was typed, and once the filters are edited by hand
            // it no longer describes them.
            if (resetPage) {
                next.delete('page');
                next.delete('text');
            }
            return next;
        }, { replace: true });
    };

    const onSmartSearch = (parsed, text) => {
        setSearchParams(parsedToSearchParams(parsed, text), { replace: true });
        window.scrollTo(0, 0);
    };

    const setKeywords = (event) => updateParams((next) => {
        if (event.target.value.trim() === '') next.delete('keywords');
        else next.set('keywords', event.target.value);
    });

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

    // The home page's "Notify Me" links here with ?notify=1 to open the dialog directly.
    useEffect(() => {
        if (searchParams.get('notify') === '1') {
            onOpenNotify();
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete('notify');
                return next;
            }, { replace: true });
        }
    }, []);

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
                <Stack
                    spacing={1}
                    sx={{
                        display: { xs: 'none', md: 'flex' },
                        position: 'fixed',
                        top: adStackTop,
                        right: 20,
                        zIndex: 1300,
                        width: { md: 200, lg: 240, xl: 280 }
                    }}
                >
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<NotificationsActiveIcon />}
                        onClick={onOpenNotify}
                        sx={{
                            justifyContent: 'center',
                            boxShadow: '0 4px 16px rgba(198, 113, 122, 0.4)',
                            '&:hover': { boxShadow: '0 6px 20px rgba(198, 113, 122, 0.55)' }
                        }}
                    >
                        Notify Me
                    </Button>
                    <Button
                        component={Link}
                        to="/ads"
                        size="small"
                        sx={{ justifyContent: 'center', color: 'text.secondary', fontSize: '0.8rem' }}
                    >
                        Explore our Ad Directory &rarr;
                    </Button>
                </Stack>
            )}

            <Box sx={{ mt: 2, mb: 1, mr: laneSx, maxWidth: 760 }}>
                <SmartSearchBar
                    initialText={searchParams.get('text') || ''}
                    onSearch={onSmartSearch}
                    placeholder='Try “navy mother of the bride, size 12”'
                />
            </Box>

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
                    <Grid size={{ xs: 12, sm: 6, md: 8 }}>
                        <TextField
                            size="small" label="Keywords" fullWidth
                            placeholder="e.g. lace, long sleeve, brand"
                            value={filters.keywords}
                            onChange={setKeywords}
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
                <Box sx={{ opacity: searching ? 0.6 : 1, transition: 'opacity 0.2s', mr: laneSx }}>
                    {exactCount === 0 && page === 1 && (
                        <Paper variant="outlined" sx={{
                            p: { xs: 2.5, sm: 3 }, mb: 4, display: 'flex', gap: 2, alignItems: 'center',
                            flexWrap: 'wrap', justifyContent: 'space-between', borderColor: 'rgba(156, 78, 88, 0.25)'
                        }}>
                            <Box>
                                <Typography sx={{ fontFamily: `'Playfair Display', serif`, fontSize: '1.25rem', fontWeight: 600 }}>
                                    Nothing matches every detail just yet
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Here are the closest gowns we have. We can also email you the moment an exact match is posted.
                                </Typography>
                            </Box>
                            <Button variant="outlined" startIcon={<NotificationsActiveIcon />} onClick={onOpenNotify}>
                                Notify Me
                            </Button>
                        </Paper>
                    )}
                    {groupResults(results, (page - 1) * PAGE_SIZE, exactCount, closeCount, totalCount).map((group, gi) => (
                        <Box key={group.tier}>
                            {group.showHeading && !(group.tier === 0 && exactCount === 0) && <TierHeading tier={group.tier} first={gi === 0} count={group.tier === 0 ? exactCount : null} />}
                            <Grid container spacing={3}>
                                {group.items.map((gown) => (
                                    <Grid key={gown.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                                        <GownCard gown={gown} navigate={navigate} />
                                    </Grid>
                                ))}
                            </Grid>
                        </Box>
                    ))}
                </Box>
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
                autoHideDuration={12000}
                onClose={(e, reason) => { if (reason !== 'clickaway') setShowPostedNotice(false); }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setShowPostedNotice(false)} severity="success" variant="filled"
                    action={
                        <Button color="inherit" size="small" component={Link} to="/mylistings" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                            View My Listings
                        </Button>
                    }
                >
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
