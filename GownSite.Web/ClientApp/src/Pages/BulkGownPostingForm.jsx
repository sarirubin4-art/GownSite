import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Container, Typography, TextField, Button, Stack, MenuItem, Grid,
    FormControlLabel, Checkbox, FormGroup, Paper, Alert, Box, Autocomplete, createFilterOptions,
    Accordion, AccordionSummary, AccordionDetails, IconButton, LinearProgress, Chip
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { COLOR_OPTIONS, SIZE_OPTIONS, STYLE_OPTIONS, LISTING_TYPE_OPTIONS } from '../constants/gownOptions';
import { useAuth } from '../context/AuthContext';

const MAX_MORE_PICTURES = 5;
const MAX_BATCH_GOWNS = 20;

const locationFilter = createFilterOptions({ matchFrom: 'start' });

const makeEmptyGown = () => ({
    localId: crypto.randomUUID(),
    description: '',
    colors: [],
    sizes: [],
    price: '',
    brand: '',
    pricePaid: '',
    condition: '',
    length: '',
    styleTags: [],
    notes: '',
    primaryPicture: null,
    primaryPreview: null,
    morePictures: [],
    morePicturesError: ''
});

const BulkGownPostingForm = () => {
    const { owner, loading } = useAuth();
    const navigate = useNavigate();
    const [batchId] = useState(() => crypto.randomUUID());
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [progressIndex, setProgressIndex] = useState(0);
    const [submittedIds, setSubmittedIds] = useState([]);
    const [failedIndex, setFailedIndex] = useState(null);
    const [existingLocations, setExistingLocations] = useState([]);
    const [expanded, setExpanded] = useState(0);

    const [shared, setShared] = useState({
        location: '',
        listingType: 'Rent',
        displayOwnerName: false,
        promoCode: ''
    });

    const [gowns, setGowns] = useState([makeEmptyGown()]);

    useEffect(() => {
        if (!loading && !owner) {
            navigate('/login?redirect=/postagown/terms');
        }
    }, [loading, owner]);

    useEffect(() => {
        axios.get('/api/gown/locations').then(({ data }) => setExistingLocations(data)).catch(() => {});
    }, []);

    const updateGown = (localId, patch) => {
        setGowns((prev) => prev.map((g) => (g.localId === localId ? { ...g, ...patch } : g)));
    };

    const toggleStyle = (localId, value) => {
        setGowns((prev) => prev.map((g) => {
            if (g.localId !== localId) return g;
            const has = g.styleTags.includes(value);
            return { ...g, styleTags: has ? g.styleTags.filter(s => s !== value) : [...g.styleTags, value] };
        }));
    };

    const onPrimaryPictureChange = (localId) => (e) => {
        const file = e.target.files[0];
        updateGown(localId, { primaryPicture: file || null, primaryPreview: file ? URL.createObjectURL(file) : null });
    };

    const onMorePicturesChange = (localId) => (e) => {
        const files = Array.from(e.target.files);
        if (files.length > MAX_MORE_PICTURES) {
            updateGown(localId, {
                morePictures: files.slice(0, MAX_MORE_PICTURES),
                morePicturesError: `You can upload up to ${MAX_MORE_PICTURES} additional photos — only the first ${MAX_MORE_PICTURES} were kept.`
            });
        } else {
            updateGown(localId, { morePictures: files, morePicturesError: '' });
        }
    };

    const addGown = () => {
        if (gowns.length >= MAX_BATCH_GOWNS) return;
        setGowns((prev) => [...prev, makeEmptyGown()]);
        setExpanded(gowns.length);
    };

    const removeGown = (localId) => {
        setGowns((prev) => prev.filter((g) => g.localId !== localId));
    };

    const gownLabel = (g, i) => g.description ? g.description.slice(0, 40) : `Gown ${i + 1}`;

    const validate = () => {
        if (!shared.location) return 'Please enter a location for this batch.';
        for (let i = failedIndex ?? 0; i < gowns.length; i++) {
            const g = gowns[i];
            if (!g.description || g.colors.length === 0 || g.sizes.length === 0 || !g.price) {
                return `Gown ${i + 1}: please fill in description, color, size, and price.`;
            }
            if (!g.primaryPicture) {
                return `Gown ${i + 1}: please add a primary picture.`;
            }
        }
        return '';
    };

    const submitFrom = async (startIndex) => {
        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }
        setError('');
        setSubmitting(true);
        setFailedIndex(null);

        const ids = [...submittedIds];
        for (let i = startIndex; i < gowns.length; i++) {
            setProgressIndex(i);
            const g = gowns[i];
            try {
                const data = new FormData();
                data.append('Description', g.description);
                data.append('Color', g.colors.join(','));
                data.append('Size', g.sizes.join(','));
                data.append('Price', g.price);
                data.append('Location', shared.location);
                data.append('ListingType', shared.listingType);
                data.append('DisplayOwnerName', shared.displayOwnerName);
                data.append('Brand', g.brand);
                data.append('PricePaid', g.pricePaid);
                data.append('Condition', g.condition);
                data.append('Length', g.length);
                data.append('StyleTags', g.styleTags.join(','));
                data.append('Notes', g.notes);
                data.append('PromoCode', shared.promoCode);
                data.append('BatchId', batchId);
                data.append('BatchSize', gowns.length);
                data.append('PrimaryPicture', g.primaryPicture);
                g.morePictures.forEach((file) => data.append('MorePictures', file));

                const { data: result } = await axios.post('/api/gown/create', data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                ids.push(result.id);
                setSubmittedIds([...ids]);
            } catch (err) {
                setFailedIndex(i);
                setExpanded(i);
                setError(`Gown ${i + 1} (${gownLabel(g, i)}) failed: ${err?.response?.data?.message || 'Something went wrong saving this listing.'}`);
                setSubmitting(false);
                return;
            }
        }

        setSubmitting(false);
        navigate(`/postagown/bulk-payment-setup?ids=${ids.join(',')}`);
    };

    const onContinueWithSaved = () => {
        navigate(`/postagown/bulk-payment-setup?ids=${submittedIds.join(',')}`);
    };

    if (loading || !owner) return null;

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <Typography variant="h4" gutterBottom>Post Multiple Gowns</Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
                Fill in each gown below, then go through one card setup for the whole batch — no need to check out separately for every listing.
            </Typography>
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                    {submittedIds.length > 0 && (
                        <Box sx={{ mt: 1.5 }}>
                            <Button size="small" variant="outlined" color="inherit" onClick={onContinueWithSaved}>
                                Continue to payment with the {submittedIds.length} gown{submittedIds.length === 1 ? '' : 's'} already saved
                            </Button>
                        </Box>
                    )}
                </Alert>
            )}

            {submitting && (
                <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        Saving gown {progressIndex + 1} of {gowns.length}...
                    </Typography>
                    <LinearProgress variant="determinate" value={((progressIndex) / gowns.length) * 100} />
                </Box>
            )}

            <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>Shared Details</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    These apply to every gown in this batch.
                </Typography>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <Autocomplete
                            freeSolo
                            autoComplete
                            autoHighlight
                            options={existingLocations}
                            filterOptions={locationFilter}
                            value={shared.location}
                            onInputChange={(e, value) => setShared({ ...shared, location: value })}
                            renderInput={(params) => <TextField {...params} label="Location (city/area)" />}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField select label="Rent or Sale" value={shared.listingType} onChange={(e) => setShared({ ...shared, listingType: e.target.value })} fullWidth>
                            {LISTING_TYPE_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                        </TextField>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            label="Promo Code" value={shared.promoCode} onChange={(e) => setShared({ ...shared, promoCode: e.target.value })}
                            fullWidth placeholder="Have a code? Enter it here"
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex', alignItems: 'center' }}>
                        <FormControlLabel
                            control={<Checkbox checked={shared.displayOwnerName} onChange={(e) => setShared({ ...shared, displayOwnerName: e.target.checked })} />}
                            label="Show my name publicly on these listings"
                        />
                    </Grid>
                </Grid>
            </Paper>

            {gowns.map((g, i) => (
                <Accordion
                    key={g.localId}
                    expanded={expanded === i}
                    onChange={() => setExpanded(expanded === i ? -1 : i)}
                    sx={{ mb: 1.5, border: '1px solid', borderColor: failedIndex === i ? 'error.main' : 'divider' }}
                    variant="outlined"
                >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexGrow: 1, pr: 1 }}>
                            <Typography sx={{ flexGrow: 1 }}>{gownLabel(g, i)}</Typography>
                            {submittedIds.length > i && <Chip size="small" color="success" label="Saved" />}
                            {failedIndex === i && <Chip size="small" color="error" label="Failed" />}
                            {gowns.length > 1 && (
                                <IconButton
                                    size="small"
                                    onClick={(e) => { e.stopPropagation(); removeGown(g.localId); }}
                                    disabled={submitting}
                                >
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            )}
                        </Stack>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Grid container spacing={2}>
                            <Grid size={12}>
                                <TextField
                                    label="Description" value={g.description} onChange={(e) => updateGown(g.localId, { description: e.target.value })}
                                    fullWidth multiline rows={2}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <Autocomplete
                                    multiple
                                    options={COLOR_OPTIONS}
                                    value={g.colors}
                                    onChange={(e, value) => updateGown(g.localId, { colors: value })}
                                    renderInput={(params) => <TextField {...params} label="Color(s)" />}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <Autocomplete
                                    multiple
                                    options={SIZE_OPTIONS}
                                    value={g.sizes}
                                    onChange={(e, value) => updateGown(g.localId, { sizes: value })}
                                    renderInput={(params) => <TextField {...params} label="Size(s)" />}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <TextField
                                    label="Price" type="number" value={g.price} onChange={(e) => updateGown(g.localId, { price: e.target.value })}
                                    fullWidth slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <Button variant="outlined" component="label" fullWidth sx={{ py: 1.5 }}>
                                    {g.primaryPicture ? 'Change Primary Picture' : 'Upload Primary Picture'}
                                    <input type="file" accept="image/*" hidden onChange={onPrimaryPictureChange(g.localId)} />
                                </Button>
                            </Grid>
                            {g.primaryPreview && (
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <Box sx={{
                                        width: 100, height: 75, borderRadius: 2, overflow: 'hidden',
                                        bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <Box component="img" src={g.primaryPreview} alt="Primary preview" sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                    </Box>
                                </Grid>
                            )}
                            <Grid size={12}>
                                <Button variant="outlined" component="label" size="small">
                                    {g.morePictures.length > 0 ? `${g.morePictures.length} additional photo(s) selected` : `Add More Pictures (up to ${MAX_MORE_PICTURES}, optional)`}
                                    <input type="file" accept="image/*" multiple hidden onChange={onMorePicturesChange(g.localId)} />
                                </Button>
                                {g.morePicturesError && <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>{g.morePicturesError}</Typography>}
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField label="Brand" value={g.brand} onChange={(e) => updateGown(g.localId, { brand: e.target.value })} fullWidth size="small" />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField label="Original Gown Value" type="number" value={g.pricePaid} onChange={(e) => updateGown(g.localId, { pricePaid: e.target.value })} fullWidth size="small" />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField label="Condition" value={g.condition} onChange={(e) => updateGown(g.localId, { condition: e.target.value })} fullWidth size="small" placeholder="e.g. Like new, worn once" />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField label="Height/Length" value={g.length} onChange={(e) => updateGown(g.localId, { length: e.target.value })} fullWidth size="small" />
                            </Grid>
                            <Grid size={12}>
                                <Typography variant="subtitle2" sx={{ mb: 1 }}>Style Tags (select all that apply)</Typography>
                                <FormGroup row>
                                    {STYLE_OPTIONS.map(s => (
                                        <FormControlLabel
                                            key={s.value}
                                            control={<Checkbox size="small" checked={g.styleTags.includes(s.value)} onChange={() => toggleStyle(g.localId, s.value)} />}
                                            label={s.label}
                                            sx={{ width: { xs: '100%', sm: '33%' } }}
                                        />
                                    ))}
                                </FormGroup>
                            </Grid>
                            <Grid size={12}>
                                <TextField
                                    label="Notes" value={g.notes} onChange={(e) => updateGown(g.localId, { notes: e.target.value })}
                                    fullWidth multiline rows={2} size="small" placeholder="Anything else a buyer or renter should know"
                                />
                            </Grid>
                        </Grid>
                    </AccordionDetails>
                </Accordion>
            ))}

            <Button
                startIcon={<AddIcon />}
                onClick={addGown}
                disabled={gowns.length >= MAX_BATCH_GOWNS || submitting}
                sx={{ mb: 3 }}
            >
                Add Another Gown {gowns.length >= MAX_BATCH_GOWNS ? `(max ${MAX_BATCH_GOWNS})` : ''}
            </Button>

            <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
                <Button
                    variant="contained" size="large" disabled={submitting}
                    onClick={() => submitFrom(failedIndex ?? submittedIds.length)}
                >
                    {submitting
                        ? 'Saving...'
                        : failedIndex !== null
                            ? 'Retry From Failed Gown'
                            : `Confirm ${gowns.length} Gown${gowns.length === 1 ? '' : 's'} & Continue to Payment`}
                </Button>
            </Stack>
        </Container>
    );
};

export default BulkGownPostingForm;
