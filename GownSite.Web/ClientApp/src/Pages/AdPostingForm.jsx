import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Container, Typography, TextField, Button, Stack, MenuItem, Grid, Paper, Alert, Box, FormControlLabel, Checkbox } from '@mui/material';
import { AD_CATEGORY_OPTIONS } from '../constants/gownOptions';
import { useAuth } from '../context/AuthContext';
import LocationField from '../components/LocationField';

const AdPostingForm = () => {
    const { owner, loading } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const resumeId = searchParams.get('resume');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [image, setImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [hasExistingImage, setHasExistingImage] = useState(false);

    const [draftId, setDraftId] = useState(resumeId ? Number(resumeId) : null);
    const [saveState, setSaveState] = useState('idle'); // idle | saving | saved
    const dirtyRef = useRef(false);
    const autosaveTimer = useRef(null);

    const [form, setForm] = useState({
        title: '',
        description: '',
        category: '',
        targetUrl: '',
        location: '',
        servesAllLocations: false,
        promoCode: ''
    });

    useEffect(() => {
        if (!loading && !owner) {
            navigate('/login?redirect=/advertise/terms');
        }
    }, [loading, owner]);

    // Resuming an in-progress draft (from "Complete Setup" in My Ads, or a
    // reloaded tab) — load whatever was already saved before the user touches anything,
    // so the autosave effect below doesn't immediately re-save an unchanged form.
    useEffect(() => {
        if (!resumeId) return;
        axios.get(`/api/ad/get?id=${resumeId}`).then(({ data }) => {
            setForm({
                title: data.title || '',
                description: data.description || '',
                category: data.category || '',
                targetUrl: data.targetUrl || '',
                location: data.location || '',
                servesAllLocations: !!data.servesAllLocations,
                promoCode: ''
            });
            if (data.imageUrl) {
                setHasExistingImage(true);
                setImagePreview(data.imageUrl);
            }
        }).catch(() => {
            setError('Could not load your saved draft. Starting fresh instead.');
        });
    }, [resumeId]);

    const markDirty = () => { dirtyRef.current = true; };

    const onChange = (field) => (e) => { markDirty(); setForm({ ...form, [field]: e.target.value }); };
    const onLocationChange = (value) => { markDirty(); setForm({ ...form, location: value }); };
    const onServesAllLocationsChange = (e) => {
        markDirty();
        setForm({ ...form, servesAllLocations: e.target.checked, location: e.target.checked ? '' : form.location });
    };

    // Silently saves whatever's been filled in so far as a Draft — so closing the tab
    // or a crash doesn't lose progress. Only runs once there's at least a description,
    // and only after the user has actually changed something (not on the initial load
    // when resuming an existing draft).
    useEffect(() => {
        if (!dirtyRef.current) return;
        if (!form.description.trim()) return;

        if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
        autosaveTimer.current = setTimeout(async () => {
            setSaveState('saving');
            try {
                const data = new FormData();
                if (draftId) data.append('Id', draftId);
                data.append('Title', form.title);
                data.append('Description', form.description);
                data.append('TargetUrl', form.targetUrl);
                data.append('Category', form.category);
                data.append('Location', form.location);
                data.append('ServesAllLocations', form.servesAllLocations);
                if (image) data.append('Image', image);

                const { data: result } = await axios.post('/api/ad/draft', data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                if (!draftId) setDraftId(result.id);
                setSaveState('saved');
            } catch {
                setSaveState('idle');
            }
        }, 2000);

        return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form, image]);

    const onImageChange = (e) => {
        markDirty();
        const file = e.target.files[0];
        setImage(file || null);
        setImagePreview(file ? URL.createObjectURL(file) : null);
    };

    const validate = () => {
        if (!form.title || !form.description || !form.category) {
            return 'Please fill in title, description, and category.';
        }
        if (!form.servesAllLocations && !form.location) {
            return 'Please choose a location, or mark this ad as not tied to one location.';
        }
        if (!image && !hasExistingImage) {
            return 'Please add an image for your ad.';
        }
        return '';
    };

    const onSubmit = async () => {
        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }
        setError('');
        setSubmitting(true);
        try {
            const data = new FormData();
            if (draftId) data.append('Id', draftId);
            data.append('Title', form.title);
            data.append('Description', form.description);
            data.append('Category', form.category);
            data.append('TargetUrl', form.targetUrl);
            data.append('Location', form.location);
            data.append('ServesAllLocations', form.servesAllLocations);
            data.append('PromoCode', form.promoCode);
            if (image) data.append('Image', image);

            const { data: result } = await axios.post('/api/ad/create', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            navigate(`/advertise/payment-setup/${result.id}`);
        } catch (err) {
            setError(err?.response?.data?.message || 'Something went wrong saving your ad.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading || !owner) return null;

    return (
        <Container maxWidth="sm" sx={{ py: 4 }}>
            <Typography variant="h4" gutterBottom>Advertise With Us</Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
                <Grid container spacing={2}>
                    <Grid size={12}>
                        <TextField label="Business/Ad Title" value={form.title} onChange={onChange('title')} fullWidth />
                    </Grid>
                    <Grid size={12}>
                        <TextField
                            label="Description" value={form.description} onChange={onChange('description')}
                            fullWidth multiline rows={3}
                            placeholder="What you offer..."
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField select label="Category" value={form.category} onChange={onChange('category')} fullWidth>
                            {AD_CATEGORY_OPTIONS.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
                        </TextField>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField label="Website/Contact Link (optional)" value={form.targetUrl} onChange={onChange('targetUrl')} fullWidth />
                    </Grid>
                    {!form.servesAllLocations && (
                        <Grid size={12}>
                            <LocationField value={form.location} onChange={onLocationChange} />
                        </Grid>
                    )}
                    <Grid size={12}>
                        <FormControlLabel
                            control={<Checkbox checked={form.servesAllLocations} onChange={onServesAllLocationsChange} />}
                            label="This business isn't tied to one location (e.g. online-only)"
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            label="Promo Code (optional)" value={form.promoCode} onChange={onChange('promoCode')} fullWidth
                            helperText="Add it here before checking out — it can't easily be applied after."
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <Button variant="outlined" component="label" fullWidth sx={{ py: 1.5 }}>
                            {image || hasExistingImage ? 'Change Image' : 'Upload Ad Image'}
                            <input type="file" accept="image/*" hidden onChange={onImageChange} />
                        </Button>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                            For best results, use a square image (1:1) — ads display in a square across the site.
                        </Typography>
                    </Grid>
                    {imagePreview && (
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <Box sx={{
                                width: 120, height: 120, borderRadius: 2, overflow: 'hidden',
                                bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider'
                            }}>
                                <Box component="img" src={imagePreview} alt="Ad preview" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            </Box>
                        </Grid>
                    )}
                </Grid>
            </Paper>

            <Stack direction="row" sx={{ justifyContent: 'flex-end', alignItems: 'center' }} spacing={2}>
                {saveState === 'saving' && <Typography variant="caption" color="text.secondary">Saving draft...</Typography>}
                {saveState === 'saved' && <Typography variant="caption" color="text.secondary">Draft saved</Typography>}
                <Button variant="contained" size="large" disabled={submitting} onClick={onSubmit}>
                    {submitting ? 'Saving...' : 'Confirm & Continue to Payment'}
                </Button>
            </Stack>
        </Container>
    );
};

export default AdPostingForm;
