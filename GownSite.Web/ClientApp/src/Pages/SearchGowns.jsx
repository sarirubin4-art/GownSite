import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
    Typography, Paper, Grid, Autocomplete, TextField, Card, CardActionArea,
    CardMedia, CardContent, Box, Chip, Snackbar, Alert, Button, Stack,
    Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress
} from '@mui/material';
import { COLOR_OPTIONS, SIZE_OPTIONS, STYLE_OPTIONS, LISTING_TYPE_OPTIONS, styleLabel, formatPriceRange, sortSizes } from '../constants/gownOptions';
import { useAdLane } from '../context/AdLaneContext';
import useFullScreenDialog from '../hooks/useFullScreenDialog';
import usePageTitle from '../hooks/usePageTitle';

const emptyFilters = { colors: [], sizes: [], locations: [], styles: [], listingTypes: [], minPrice: '', maxPrice: '' };

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
    const { adVisible, laneWidth } = useAdLane();
    const fullScreen = useFullScreenDialog();
    const [filters, setFilters] = useState(emptyFilters);
    const [results, setResults] = useState([]);
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

    const runSearch = async (f) => {
        const seq = ++searchSeq.current;
        setSearching(true);
        const body = {
            colors: f.colors,
            sizes: f.sizes,
            locations: f.locations,
            styles: f.styles,
            listingTypes: f.listingTypes,
            minPrice: f.minPrice === '' ? null : Number(f.minPrice),
            maxPrice: f.maxPrice === '' ? null : Number(f.maxPrice)
        };
        try {
            const { data } = await axios.post('/api/gown/search', body);
            if (seq !== searchSeq.current) return; // a newer search already started; ignore this stale response
            setResults(data);
            setLocationOptions((prev) => Array.from(new Set([...prev, ...data.map(g => g.location)])).sort());
        } finally {
            if (seq === searchSeq.current) setSearching(false);
        }
    };

    useEffect(() => {
        runSearch(filters);
    }, [filters]);

    useEffect(() => {
        if (routerLocation.state?.posted) {
            navigate(routerLocation.pathname, { replace: true, state: {} });
        }
    }, []);

    const setField = (field) => (event, value) => setFilters((prev) => ({ ...prev, [field]: value }));
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

    return (
        <Box>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1, mr: { xs: 0, md: adVisible ? `${laneWidth}px` : 0 } }}>
                <Typography variant="h4">Browse Gowns</Typography>
                <Button variant="outlined" onClick={onOpenNotify}>Notify Me</Button>
            </Stack>

            <Paper variant="outlined" sx={{ p: 2.5, mb: 4, mr: { xs: 0, md: adVisible ? `${laneWidth}px` : 0 } }}>
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
                            onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
                        />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3, md: 2 }}>
                        <TextField
                            size="small" label="Max Price" type="number" fullWidth
                            value={filters.maxPrice}
                            onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
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
                <Grid container spacing={3} sx={{ opacity: searching ? 0.6 : 1, transition: 'opacity 0.2s' }}>
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
                                                fontSize: '1.6rem', letterSpacing: 4, textTransform: 'uppercase',
                                                color: 'rgba(255,255,255,0.92)', bgcolor: 'rgba(156, 78, 88, 0.62)',
                                                border: '2px solid rgba(255,255,255,0.85)', borderRadius: 1,
                                                px: 2.5, py: 0.5, transform: 'rotate(-16deg)',
                                                boxShadow: '0 4px 14px rgba(0,0,0,0.25)'
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
                                            filter: gown.isSold ? 'grayscale(40%)' : 'none'
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
