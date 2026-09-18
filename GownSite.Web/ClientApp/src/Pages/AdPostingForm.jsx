import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Container, Typography, TextField, Button, Stack, Grid, Paper, Alert, Box, FormControlLabel, Checkbox, Dialog, DialogTitle, DialogContent, DialogActions, Chip } from '@mui/material';
import PlaceIcon from '@mui/icons-material/Place';
import PublicIcon from '@mui/icons-material/Public';
import { AD_CATEGORY_OPTIONS, adCategoryLabels } from '../constants/gownOptions';
import { useAuth } from '../context/AuthContext';
import LocationField from '../components/LocationField';
import FilterAutocomplete from '../components/FilterAutocomplete';
import ContactVisibilityCheckboxes from '../components/ContactVisibilityCheckboxes';
import ImagePositionEditor from '../components/ImagePositionEditor';
import { focalObjectPosition } from '../utils/imageFocal';

// Renders the in-progress ad two ways — the full details page and the floating
// ad card — from local form state only, so posters can see how it'll actually
// look before paying and submitting for review. No backend call. Also where the
// drag-to-reposition crop editor lives, since this is the one place the owner sees
// the image at full square size before it goes live.
const AdPreviewDialog = ({ open, onClose, form, imagePreview, imageFocal, onImageFocalChange }) => {
    const objectPosition = focalObjectPosition(imageFocal.x, imageFocal.y);
    return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>Preview Your Ad</DialogTitle>
        <DialogContent dividers>
            {imagePreview && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                    <ImagePositionEditor src={imagePreview} focal={imageFocal} onChange={onImageFocalChange} />
                </Box>
            )}
            <Typography variant="overline" color="text.secondary">Full Details Page</Typography>
            <Box sx={{ maxWidth: 420, mx: 'auto', textAlign: 'center', mb: 4, mt: 1 }}>
                <Stack direction="row" spacing={1} sx={{ justifyContent: 'center', mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
                    {adCategoryLabels(form.categories).map((label) => (
                        <Chip key={label} label={label} color="primary" size="small" />
                    ))}
                    {form.servesAllLocations ? (
                        <Chip icon={<PublicIcon />} label="Serves All Locations" variant="outlined" size="small" />
                    ) : form.location ? (
                        <Chip icon={<PlaceIcon />} label={form.location} variant="outlined" size="small" />
                    ) : null}
                </Stack>
                <Typography variant="h5" gutterBottom>{form.title || 'Your Ad Title'}</Typography>
                <Box sx={{
                    width: '100%', aspectRatio: '1 / 1', borderRadius: 3, mb: 2, overflow: 'hidden',
                    bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider'
                }}>
                    {imagePreview ? (
                        <Box component="img" src={imagePreview} alt={form.title} sx={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition, display: 'block' }} />
                    ) : (
                        <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography variant="caption" color="text.secondary">No image yet</Typography>
                        </Box>
                    )}
                </Box>
                <Typography variant="body1" sx={{ mb: 3, whiteSpace: 'pre-line' }}>
                    {form.description || 'Your description will appear here.'}
                </Typography>
                {form.targetUrl && <Button variant="contained" size="large" disabled>Learn More</Button>}
            </Box>

            <Typography variant="overline" color="text.secondary">Floating Ad Card (as it appears site-wide)</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                <Paper elevation={6} sx={{ width: 240, overflow: 'hidden', border: '1px solid', borderColor: 'secondary.light' }}>
                    <Box sx={{ width: '100%', aspectRatio: '1 / 1', bgcolor: 'background.paper' }}>
                        {imagePreview && (
                            <Box component="img" src={imagePreview} alt={form.title} sx={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition, display: 'block' }} />
                        )}
                    </Box>
                    <Box sx={{ p: 1.25 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{form.title || 'Your Ad Title'}</Typography>
                        {form.description && (
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                            >
                                {form.description}
                            </Typography>
                        )}
                    </Box>
                </Paper>
            </Box>
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose}>Close Preview</Button>
        </DialogActions>
    </Dialog>
    );
};

const AdPostingForm = () => {
    const { owner, loading } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const resumeId = searchParams.get('resume');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [image, setImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [imageFocal, setImageFocal] = useState({ x: 0.5, y: 0.5 });
    const [hasExistingImage, setHasExistingImage] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);

    const [draftId, setDraftId] = useState(resumeId ? Number(resumeId) : null);
    const [saveState, setSaveState] = useState('idle'); // idle | saving | saved
    const dirtyRef = useRef(false);
    const autosaveTimer = useRef(null);

    const [form, setForm] = useState({
        title: '',
        description: '',
        categories: [],
        targetUrl: '',
        location: '',
        servesAllLocations: false,
        showName: false,
        showPhone: false,
        showEmail: false
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
                categories: (data.categories || '').split(',').filter(Boolean),
                targetUrl: data.targetUrl || '',
                location: data.location || '',
                servesAllLocations: !!data.servesAllLocations,
                showName: !!data.showName,
                showPhone: !!data.showPhone,
                showEmail: !!data.showEmail
            });
            if (data.imageUrl) {
                setHasExistingImage(true);
                setImagePreview(data.imageUrl);
                setImageFocal({ x: data.imageFocalX ?? 0.5, y: data.imageFocalY ?? 0.5 });
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
                data.append('Category', form.categories.join(','));
                data.append('Location', form.location);
                data.append('ServesAllLocations', form.servesAllLocations);
                data.append('ShowName', form.showName);
                data.append('ShowPhone', form.showPhone);
                data.append('ShowEmail', form.showEmail);
                if (image) data.append('Image', image);
                data.append('ImageFocalX', imageFocal.x);
                data.append('ImageFocalY', imageFocal.y);

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
    }, [form, image, imageFocal]);

    const onImageChange = (e) => {
        markDirty();
        const file = e.target.files[0];
        setImage(file || null);
        setImagePreview(file ? URL.createObjectURL(file) : null);
        setImageFocal({ x: 0.5, y: 0.5 });
    };

    const validate = () => {
        if (!form.title || !form.description || form.categories.length === 0) {
            return 'Please fill in title, description, and at least one category.';
        }
        if (!form.servesAllLocations && !form.location) {
            return 'Please choose a location, or mark this ad as not tied to one location.';
        }
        if (!image && !hasExistingImage) {
            return 'Please add an image for your ad.';
        }
        if (!form.showPhone && !form.showEmail) {
            return 'Please allow a phone number or email so interested customers can actually contact you.';
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
            data.append('Category', form.categories.join(','));
            data.append('TargetUrl', form.targetUrl);
            data.append('Location', form.location);
            data.append('ServesAllLocations', form.servesAllLocations);
            data.append('ShowName', form.showName);
            data.append('ShowPhone', form.showPhone);
            data.append('ShowEmail', form.showEmail);
            if (image) data.append('Image', image);
            data.append('ImageFocalX', imageFocal.x);
            data.append('ImageFocalY', imageFocal.y);

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
                        <FilterAutocomplete
                            label="Category" helperText="Choose all that apply — your ad shows up in every category you pick."
                            options={AD_CATEGORY_OPTIONS.map(c => c.value)}
                            getOptionLabel={(value) => AD_CATEGORY_OPTIONS.find(c => c.value === value)?.label || value}
                            value={form.categories}
                            onChange={(e, value) => { markDirty(); setForm({ ...form, categories: value }); }}
                        />
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
                    <Grid size={12}>
                        <ContactVisibilityCheckboxes
                            showName={form.showName}
                            showPhone={form.showPhone}
                            showEmail={form.showEmail}
                            onChange={(next) => { markDirty(); setForm({ ...form, ...next }); }}
                            subjectLabel="my"
                            requireReachableChannel
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <Button variant="outlined" component="label" fullWidth sx={{ py: 1.5 }}>
                            {image || hasExistingImage ? 'Change Image' : 'Upload Ad Image'}
                            <input type="file" accept="image/*" hidden onChange={onImageChange} />
                        </Button>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                            For best results, use a square image (1:1) — ads display in a square across the site.
                            Must be an actual image file (JPEG, PNG, WEBP, or GIF) — PDFs and other documents
                            can't be shown as an ad image.
                        </Typography>
                    </Grid>
                    {imagePreview && (
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <Box sx={{
                                width: 120, height: 120, borderRadius: 2, overflow: 'hidden',
                                bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider'
                            }}>
                                <Box component="img" src={imagePreview} alt="Ad preview" sx={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: focalObjectPosition(imageFocal.x, imageFocal.y), display: 'block' }} />
                            </Box>
                        </Grid>
                    )}
                </Grid>
            </Paper>

            <Stack direction="row" sx={{ justifyContent: 'flex-end', alignItems: 'center' }} spacing={2}>
                {saveState === 'saving' && <Typography variant="caption" color="text.secondary">Saving draft...</Typography>}
                {saveState === 'saved' && <Typography variant="caption" color="text.secondary">Draft saved</Typography>}
                <Button variant="outlined" size="large" onClick={() => setPreviewOpen(true)}>
                    Preview Ad
                </Button>
                <Button variant="contained" size="large" disabled={submitting} onClick={onSubmit}>
                    {submitting ? 'Saving...' : 'Confirm & Continue to Payment'}
                </Button>
            </Stack>

            <AdPreviewDialog
                open={previewOpen} onClose={() => setPreviewOpen(false)}
                form={form} imagePreview={imagePreview}
                imageFocal={imageFocal} onImageFocalChange={(f) => { markDirty(); setImageFocal(f); }}
            />
        </Container>
    );
};

export default AdPostingForm;
