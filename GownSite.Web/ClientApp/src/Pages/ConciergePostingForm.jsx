import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Container, Typography, TextField, Button, Stack, MenuItem, Grid,
    FormControlLabel, Checkbox, FormGroup, Paper, Alert, Box, Autocomplete, Divider,
    Accordion, AccordionSummary, AccordionDetails, IconButton, LinearProgress, Chip
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { COLOR_OPTIONS, SIZE_OPTIONS, STYLE_OPTIONS, LISTING_TYPE_OPTIONS } from '../constants/gownOptions';
import { useAuth } from '../context/AuthContext';
import LocationField from '../components/LocationField';

const MAX_BATCH_GOWNS = 20;
const DRAFT_KEY = 'regowned_concierge_posting_draft';

// Photos (File objects) can't survive localStorage — only text fields are saved,
// so a restored gown always needs its photo re-attached before it can submit.
const stripPhotos = (g) => {
    const { primaryPicture, primaryPreview, ...rest } = g;
    return rest;
};

const hasDraftContent = (gowns) =>
    gowns.some((g) => g.description || g.colors.length || g.sizes.length || g.price || g.location || g.listingType);

const makeEmptyGown = () => ({
    localId: crypto.randomUUID(),
    sizes: [],
    price: '',
    location: '',
    description: '',
    colors: [],
    listingType: '',
    brand: '',
    pricePaid: '',
    condition: '',
    length: '',
    styleTags: [],
    notes: '',
    primaryPicture: null,
    primaryPreview: null
});

const ConciergePostingForm = () => {
    const { owner, loading } = useAuth();
    const navigate = useNavigate();
    const [batchId] = useState(() => crypto.randomUUID());
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [progressIndex, setProgressIndex] = useState(0);
    const [submittedIds, setSubmittedIds] = useState([]);
    const [failedIndex, setFailedIndex] = useState(null);
    const [expanded, setExpanded] = useState(0);
    const [done, setDone] = useState(false);

    const [gowns, setGowns] = useState([makeEmptyGown()]);
    const [restoredDraft, setRestoredDraft] = useState(false);

    useEffect(() => {
        if (!loading && !owner) {
            navigate('/login?redirect=/concierge/terms');
        }
    }, [loading, owner]);

    // Restore an in-progress draft (text fields only — photos can't be persisted)
    // left over from a crash or accidental navigation away.
    useEffect(() => {
        const saved = localStorage.getItem(DRAFT_KEY);
        if (!saved) return;
        try {
            const parsed = JSON.parse(saved);
            if (!hasDraftContent(parsed)) return;
            setGowns(parsed.map((g) => ({ ...g, primaryPicture: null, primaryPreview: null })));
            setRestoredDraft(true);
        } catch {
            localStorage.removeItem(DRAFT_KEY);
        }
    }, []);

    // Debounce-save the text fields of every gown so a crash or accidental tab close
    // doesn't lose a half-filled batch. Photos are intentionally excluded (see stripPhotos).
    useEffect(() => {
        const timer = setTimeout(() => {
            if (hasDraftContent(gowns)) {
                localStorage.setItem(DRAFT_KEY, JSON.stringify(gowns.map(stripPhotos)));
            } else {
                localStorage.removeItem(DRAFT_KEY);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [gowns]);

    const discardDraft = () => {
        localStorage.removeItem(DRAFT_KEY);
        setGowns([makeEmptyGown()]);
        setRestoredDraft(false);
    };

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
        for (let i = failedIndex ?? 0; i < gowns.length; i++) {
            const g = gowns[i];
            if (!g.primaryPicture) return `Gown ${i + 1}: please add a photo.`;
            if (g.sizes.length === 0) return `Gown ${i + 1}: please select a size.`;
            if (!g.price) return `Gown ${i + 1}: please enter a price.`;
            if (!g.location) return `Gown ${i + 1}: please enter a location.`;
            if (!g.listingType) return `Gown ${i + 1}: please choose rent or sale.`;
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
                data.append('Location', g.location);
                data.append('ListingType', g.listingType);
                data.append('Brand', g.brand);
                data.append('PricePaid', g.pricePaid);
                data.append('Condition', g.condition);
                data.append('Length', g.length);
                data.append('StyleTags', g.styleTags.join(','));
                data.append('Notes', g.notes);
                data.append('BatchId', batchId);
                data.append('PrimaryPicture', g.primaryPicture);

                const { data: result } = await axios.post('/api/gown/concierge-intake', data, {
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

        await axios.post('/api/gown/concierge-intake/notify', { batchId });
        localStorage.removeItem(DRAFT_KEY);
        setSubmitting(false);
        setDone(true);
    };

    if (loading || !owner) return null;

    if (done) {
        return (
            <Container maxWidth="sm" sx={{ py: 6 }}>
                <Alert severity="success" sx={{ mb: 3 }}>
                    We've received your {gowns.length > 1 ? `${gowns.length} gowns` : 'gown'}. Our team will finish setting
                    {gowns.length > 1 ? ' them' : ' it'} up and email you when it's ready to review.
                </Alert>
                <Button variant="contained" onClick={() => navigate('/mylistings')}>Go to My Listings</Button>
            </Container>
        );
    }

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <Typography variant="h4" gutterBottom>Let Us Post It For You</Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
                Just the essentials for each gown — a photo, size, price, location, and rent or sale. Everything else is optional;
                we'll fill in the rest.
            </Typography>
            {restoredDraft && (
                <Alert severity="info" sx={{ mb: 2 }} onClose={() => setRestoredDraft(false)}>
                    We restored your unsaved draft from earlier. Photos couldn't be saved, so please re-attach one for each gown.
                    {' '}<Button size="small" onClick={discardDraft}>Discard draft &amp; start fresh</Button>
                </Alert>
            )}
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
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
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <Button variant="outlined" component="label" fullWidth sx={{ py: 1.5 }}>
                                    {g.primaryPicture ? 'Change Photo' : 'Upload Photo'}
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
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <LocationField
                                    value={g.location}
                                    onChange={(value) => updateGown(g.localId, { location: value })}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <TextField select label="Rent or Sale" fullWidth value={g.listingType} onChange={(e) => updateGown(g.localId, { listingType: e.target.value })}>
                                    {LISTING_TYPE_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                                </TextField>
                            </Grid>

                            <Grid size={12}><Divider textAlign="left"><Typography variant="caption" color="text.secondary">Optional — anything else you'd like to add</Typography></Divider></Grid>

                            <Grid size={12}>
                                <TextField
                                    label="Description" value={g.description} onChange={(e) => updateGown(g.localId, { description: e.target.value })}
                                    fullWidth multiline rows={2} size="small"
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <Autocomplete
                                    multiple
                                    options={COLOR_OPTIONS}
                                    value={g.colors}
                                    onChange={(e, value) => updateGown(g.localId, { colors: value })}
                                    renderInput={(params) => <TextField {...params} label="Color(s)" size="small" helperText="Choose all that apply." />}
                                />
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
                                    fullWidth multiline rows={2} size="small" placeholder="Anything else our team should know"
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
                            : `Submit ${gowns.length} Gown${gowns.length === 1 ? '' : 's'}`}
                </Button>
            </Stack>
        </Container>
    );
};

export default ConciergePostingForm;
