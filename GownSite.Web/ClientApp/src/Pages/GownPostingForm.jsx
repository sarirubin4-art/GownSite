import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
    Container, Typography, TextField, Button, Stack, MenuItem, Grid,
    FormControlLabel, Checkbox, FormGroup, Paper, Alert, Box, Chip, Divider,
    Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { COLOR_OPTIONS, SIZE_OPTIONS, STYLE_OPTIONS, LISTING_TYPE_OPTIONS, sortSizes, formatPriceRange, styleLabel } from '../constants/gownOptions';
import { useAuth } from '../context/AuthContext';
import LocationField from '../components/LocationField';
import PriceField from '../components/PriceField';
import ContactAdminDialog from '../components/ContactAdminDialog';
import MorePicturesInput from '../components/MorePicturesInput';
import FilterAutocomplete from '../components/FilterAutocomplete';
import ContactVisibilityCheckboxes from '../components/ContactVisibilityCheckboxes';

// Renders the in-progress listing two ways — the card it'll show up as in Browse Gowns
// search results, and the full gown details page — from local form state only, so
// posters can see how it'll actually look before paying and submitting. No backend call.
// Mirrors AdPreviewDialog in AdPostingForm.jsx.
const GownPreviewDialog = ({ open, onClose, form, primaryPreview, morePicturePreviews }) => {
    const images = [primaryPreview, ...morePicturePreviews].filter(Boolean);
    const [activeImage, setActiveImage] = useState(primaryPreview);
    const shownImage = images.includes(activeImage) ? activeImage : primaryPreview;
    const styleTags = form.styleTags;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle>Preview Your Listing</DialogTitle>
            <DialogContent dividers>
                <Typography variant="overline" color="text.secondary">Browse Gowns Card</Typography>
                <Box sx={{ maxWidth: 280, mb: 4, mt: 1 }}>
                    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                        <Box sx={{ width: '100%', height: 220, bgcolor: 'background.default', overflow: 'hidden' }}>
                            {primaryPreview ? (
                                <Box component="img" src={primaryPreview} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            ) : (
                                <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Typography variant="caption" color="text.secondary">No photo yet</Typography>
                                </Box>
                            )}
                        </Box>
                        <Box sx={{ p: 2 }}>
                            {form.brand && (
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                                    {form.brand}
                                </Typography>
                            )}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                                <Typography variant="h6">{form.price ? formatPriceRange(form.price, form.priceMax) : 'Price'}</Typography>
                                <Chip size="small" label={form.listingType === 'Rent' ? 'For Rent' : 'For Sale'} color="primary" variant="outlined" />
                            </Box>
                            <Typography
                                variant="body2" color="text.secondary"
                                sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
                                {form.description && `${form.description} · `}Size {form.sizes.length ? sortSizes(form.sizes).join(', ') : '—'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">{form.location || 'Location'}</Typography>
                        </Box>
                    </Paper>
                </Box>

                <Typography variant="overline" color="text.secondary">Gown Details Page</Typography>
                <Grid container spacing={4} sx={{ mt: 0.5 }}>
                    <Grid size={{ xs: 12, md: 7 }}>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            {images.length > 1 && (
                                <Stack spacing={1} sx={{ width: 72 }}>
                                    {images.map((url) => (
                                        <Box
                                            key={url}
                                            component="img"
                                            src={url}
                                            onClick={() => setActiveImage(url)}
                                            sx={{
                                                width: 72, height: 72, objectFit: 'cover', borderRadius: 2, cursor: 'pointer',
                                                border: '2px solid', borderColor: shownImage === url ? 'primary.main' : 'transparent'
                                            }}
                                        />
                                    ))}
                                </Stack>
                            )}
                            <Box sx={{
                                flex: 1, aspectRatio: '4 / 5', maxHeight: 560, borderRadius: 3, overflow: 'hidden',
                                bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                {shownImage ? (
                                    <Box component="img" src={shownImage} alt="" sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                ) : (
                                    <Typography variant="caption" color="text.secondary">No photo yet</Typography>
                                )}
                            </Box>
                        </Box>
                    </Grid>
                    <Grid size={{ xs: 12, md: 5 }}>
                        <Chip label={form.listingType === 'Rent' ? 'For Rent' : 'For Sale'} color="primary" sx={{ mb: 1 }} />
                        {form.brand && (
                            <Typography variant="subtitle1" color="text.secondary" sx={{ fontWeight: 600 }}>
                                {form.brand}
                            </Typography>
                        )}
                        <Typography variant="h4" gutterBottom>{form.price ? formatPriceRange(form.price, form.priceMax) : 'Price'}</Typography>
                        <Typography variant="body1" sx={{ mb: 2 }}>{form.description || 'Your description will appear here.'}</Typography>

                        <Stack spacing={0.75} sx={{ mb: 2 }}>
                            <Typography><strong>Color{form.colors.length > 1 ? 's' : ''}:</strong> {form.colors.join(', ') || '—'}</Typography>
                            <Typography><strong>Size{form.sizes.length > 1 ? 's' : ''}:</strong> {form.sizes.length ? sortSizes(form.sizes).join('-') : '—'}</Typography>
                            <Typography><strong>Location:</strong> {form.location || '—'}</Typography>
                            {form.condition && <Typography><strong>Condition:</strong> {form.condition}</Typography>}
                            {form.length && <Typography><strong>Height/Length:</strong> {form.length}</Typography>}
                            {form.pricePaid && <Typography><strong>Original Gown Value:</strong> ${form.pricePaid}</Typography>}
                        </Stack>

                        {styleTags.length > 0 && (
                            <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
                                {styleTags.map(t => <Chip key={t} label={styleLabel(t)} size="small" variant="outlined" />)}
                            </Stack>
                        )}

                        {form.notes && (
                            <>
                                <Divider sx={{ my: 2 }} />
                                <Typography variant="subtitle2" gutterBottom>Notes from the seller</Typography>
                                <Typography variant="body2" color="text.secondary">{form.notes}</Typography>
                            </>
                        )}

                        <Button variant="contained" size="large" fullWidth sx={{ mt: 3 }} disabled>
                            I'm Interested
                        </Button>
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close Preview</Button>
            </DialogActions>
        </Dialog>
    );
};

const GownPostingForm = () => {
    const { owner, loading } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const resumeId = searchParams.get('resume');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [primaryPicture, setPrimaryPicture] = useState(null);
    const [primaryPreview, setPrimaryPreview] = useState(null);
    const [hasExistingPhoto, setHasExistingPhoto] = useState(false);
    const [morePictures, setMorePictures] = useState([]);
    const [inquiryOpen, setInquiryOpen] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);

    // Object URLs for the "additional photos" the owner has staged locally, so the
    // preview dialog's thumbnail strip can show them alongside the primary picture
    // without uploading anything — revoked whenever the staged file list changes.
    const morePicturePreviews = useMemo(() => morePictures.map((f) => URL.createObjectURL(f)), [morePictures]);
    useEffect(() => () => morePicturePreviews.forEach((url) => URL.revokeObjectURL(url)), [morePicturePreviews]);

    const [draftId, setDraftId] = useState(resumeId ? Number(resumeId) : null);
    const [saveState, setSaveState] = useState('idle'); // idle | saving | saved
    const dirtyRef = useRef(false);
    const autosaveTimer = useRef(null);

    const [form, setForm] = useState({
        description: '',
        colors: [],
        sizes: [],
        price: '',
        priceMax: '',
        location: '',
        listingType: 'Rent',
        displayOwnerName: false,
        displayOwnerNumber: true,
        displayOwnerEmail: true,
        brand: '',
        pricePaid: '',
        condition: '',
        length: '',
        styleTags: [],
        notes: ''
    });

    useEffect(() => {
        if (!loading && !owner) {
            navigate('/login?redirect=/postagown/terms');
        }
    }, [loading, owner]);

    // Resuming an in-progress draft (from "Complete Setup" in My Listings, or a
    // reloaded tab) — load whatever was already saved before the user touches anything,
    // so the autosave effect below doesn't immediately re-save an unchanged form.
    useEffect(() => {
        if (!resumeId) return;
        axios.get(`/api/gown/get?id=${resumeId}`).then(({ data }) => {
            setForm({
                description: data.description || '',
                colors: (data.color || '').split(',').filter(Boolean),
                sizes: sortSizes(data.size),
                price: data.price || '',
                priceMax: data.priceMax || '',
                location: data.location || '',
                listingType: data.listingType || 'Rent',
                displayOwnerName: data.displayOwnerName || false,
                displayOwnerNumber: data.displayOwnerNumber ?? true,
                displayOwnerEmail: data.displayOwnerEmail ?? true,
                brand: data.brand || '',
                pricePaid: data.pricePaid ?? '',
                condition: data.condition || '',
                length: data.length || '',
                styleTags: (data.styleTags || '').split(',').filter(Boolean),
                notes: data.notes || ''
            });
            if (data.primaryPictureUrl) {
                setHasExistingPhoto(true);
                setPrimaryPreview(data.primaryPictureUrl);
            }
        }).catch(() => {
            setError('Could not load your saved draft. Starting fresh instead.');
        });
    }, [resumeId]);

    const markDirty = () => { dirtyRef.current = true; };

    const onChange = (field) => (e) => { markDirty(); setForm({ ...form, [field]: e.target.value }); };

    const toggleStyle = (value) => {
        markDirty();
        setForm((prev) => {
            const has = prev.styleTags.includes(value);
            return { ...prev, styleTags: has ? prev.styleTags.filter(s => s !== value) : [...prev.styleTags, value] };
        });
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
                data.append('Description', form.description);
                data.append('Color', form.colors.join(','));
                data.append('Size', form.sizes.join(','));
                if (form.price !== '') data.append('Price', form.price);
                if (form.priceMax !== '') data.append('PriceMax', form.priceMax);
                data.append('Location', form.location);
                data.append('ListingType', form.listingType);
                data.append('DisplayOwnerName', form.displayOwnerName);
                data.append('DisplayOwnerNumber', form.displayOwnerNumber);
                data.append('DisplayOwnerEmail', form.displayOwnerEmail);
                data.append('Brand', form.brand);
                if (form.pricePaid !== '') data.append('PricePaid', form.pricePaid);
                data.append('Condition', form.condition);
                data.append('Length', form.length);
                data.append('StyleTags', form.styleTags.join(','));
                data.append('Notes', form.notes);
                if (primaryPicture) data.append('PrimaryPicture', primaryPicture);

                const { data: result } = await axios.post('/api/gown/draft', data, {
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
    }, [form, primaryPicture]);

    const onPrimaryPictureChange = (e) => {
        markDirty();
        const file = e.target.files[0];
        setPrimaryPicture(file || null);
        setPrimaryPreview(file ? URL.createObjectURL(file) : null);
    };

    const validate = () => {
        if (!form.description || form.colors.length === 0 || form.sizes.length === 0 || !form.price || !form.location) {
            return 'Please fill in description, color, size, price, and location.';
        }
        if (form.priceMax !== '' && Number(form.priceMax) <= Number(form.price)) {
            return 'The high end of your price range must be more than the low end.';
        }
        if (!primaryPicture && !hasExistingPhoto) {
            return 'Please add a primary picture of the gown.';
        }
        if (!form.displayOwnerName && !form.displayOwnerNumber && !form.displayOwnerEmail) {
            return 'Please allow at least one way for interested buyers to contact you.';
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
            data.append('Description', form.description);
            data.append('Color', form.colors.join(','));
            data.append('Size', form.sizes.join(','));
            data.append('Price', form.price);
            if (form.priceMax !== '') data.append('PriceMax', form.priceMax);
            data.append('Location', form.location);
            data.append('ListingType', form.listingType);
            data.append('DisplayOwnerName', form.displayOwnerName);
            data.append('DisplayOwnerNumber', form.displayOwnerNumber);
            data.append('DisplayOwnerEmail', form.displayOwnerEmail);
            data.append('Brand', form.brand);
            data.append('PricePaid', form.pricePaid);
            data.append('Condition', form.condition);
            data.append('Length', form.length);
            data.append('StyleTags', form.styleTags.join(','));
            data.append('Notes', form.notes);
            if (primaryPicture) data.append('PrimaryPicture', primaryPicture);
            morePictures.forEach((file) => data.append('MorePictures', file));

            const { data: result } = await axios.post('/api/gown/create', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (owner.isBusinessAccount) {
                if (!owner.businessBillingComplete) {
                    navigate('/business/billing-setup');
                    return;
                }
                await axios.post('/api/gown/submit-business', { id: result.id });
                navigate('/mylistings');
                return;
            }

            navigate(`/postagown/payment-setup/${result.id}`);
        } catch (err) {
            setError(err?.response?.data?.message || 'Something went wrong saving your listing.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading || !owner) return null;

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <Typography variant="h4" gutterBottom>Post a Gown</Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>Required Details</Typography>
                <Grid container spacing={2}>
                    <Grid size={12}>
                        <TextField
                            label="Description" value={form.description} onChange={onChange('description')}
                            fullWidth multiline rows={3}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <FilterAutocomplete
                            label="Color(s)" helperText="Choose all that apply."
                            options={COLOR_OPTIONS}
                            value={form.colors}
                            onChange={(e, value) => { markDirty(); setForm({ ...form, colors: value }); }}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <FilterAutocomplete
                            label="Size(s)" helperText="Fits a range? Select each size it fits."
                            options={SIZE_OPTIONS}
                            value={form.sizes}
                            onChange={(e, value) => { markDirty(); setForm({ ...form, sizes: value }); }}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField select label="Rent or Sale" value={form.listingType} onChange={onChange('listingType')} fullWidth>
                            {LISTING_TYPE_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                        </TextField>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <PriceField
                            price={form.price} priceMax={form.priceMax}
                            onPriceChange={(v) => { markDirty(); setForm({ ...form, price: v }); }}
                            onPriceMaxChange={(v) => { markDirty(); setForm({ ...form, priceMax: v }); }}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <LocationField
                            value={form.location}
                            onChange={(value) => { markDirty(); setForm({ ...form, location: value }); }}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <Button variant="outlined" component="label" fullWidth sx={{ py: 1.5 }}>
                            {primaryPicture ? 'Change Primary Picture' : 'Upload Primary Picture'}
                            <input type="file" accept="image/*" hidden onChange={onPrimaryPictureChange} />
                        </Button>
                    </Grid>
                    {primaryPreview && (
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <Box sx={{
                                width: 120, height: 90, borderRadius: 2, overflow: 'hidden',
                                bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Box component="img" src={primaryPreview} alt="Primary preview" sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                            </Box>
                        </Grid>
                    )}
                    <Grid size={12}>
                        <MorePicturesInput files={morePictures} onFilesChange={setMorePictures} />
                    </Grid>
                </Grid>
            </Paper>

            <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>Optional Details</Typography>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField label="Brand" value={form.brand} onChange={onChange('brand')} fullWidth />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField label="Original Gown Value" type="number" value={form.pricePaid} onChange={onChange('pricePaid')} fullWidth />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField label="Condition" value={form.condition} onChange={onChange('condition')} fullWidth placeholder="e.g. Like new, worn once" />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField label="Height/Length" value={form.length} onChange={onChange('length')} fullWidth />
                    </Grid>
                    <Grid size={12}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>Style Tags (select all that apply)</Typography>
                        <FormGroup row>
                            {STYLE_OPTIONS.map(s => (
                                <FormControlLabel
                                    key={s.value}
                                    control={<Checkbox checked={form.styleTags.includes(s.value)} onChange={() => toggleStyle(s.value)} />}
                                    label={s.label}
                                    sx={{ width: { xs: '100%', sm: '33%' } }}
                                />
                            ))}
                        </FormGroup>
                    </Grid>
                    <Grid size={12}>
                        <TextField
                            label="Notes" value={form.notes} onChange={onChange('notes')}
                            fullWidth multiline rows={3} placeholder="Anything else a buyer or renter should know"
                        />
                    </Grid>
                </Grid>
            </Paper>

            <ContactVisibilityCheckboxes
                showName={form.displayOwnerName}
                showPhone={form.displayOwnerNumber}
                showEmail={form.displayOwnerEmail}
                onChange={(next) => {
                    markDirty();
                    setForm({
                        ...form,
                        displayOwnerName: next.showName,
                        displayOwnerNumber: next.showPhone,
                        displayOwnerEmail: next.showEmail
                    });
                }}
                subjectLabel="my"
            />

            <Stack direction="row" sx={{ mt: 2, justifyContent: 'flex-end', alignItems: 'center' }} spacing={2}>
                {saveState === 'saving' && <Typography variant="caption" color="text.secondary">Saving draft...</Typography>}
                {saveState === 'saved' && <Typography variant="caption" color="text.secondary">Draft saved</Typography>}
                <Button variant="outlined" size="large" onClick={() => setPreviewOpen(true)}>
                    Preview Listing
                </Button>
                <Button variant="contained" size="large" disabled={submitting} onClick={onSubmit}>
                    {submitting ? 'Saving...' : 'Confirm & Continue to Payment'}
                </Button>
            </Stack>

            <GownPreviewDialog
                open={previewOpen} onClose={() => setPreviewOpen(false)}
                form={form} primaryPreview={primaryPreview} morePicturePreviews={morePicturePreviews}
            />

            <Box sx={{ mt: 6, textAlign: 'center' }}>
                <Button variant="text" onClick={() => setInquiryOpen(true)}>
                    Are you a business? Contact me for our bulk discount!
                </Button>
            </Box>

            <ContactAdminDialog
                open={inquiryOpen}
                onClose={() => setInquiryOpen(false)}
                topic="Bulk discount inquiry"
                title="Bulk Discount Inquiry"
                promptText="Tell us a bit about your business and how many gowns you're looking to list — we'll follow up by email."
            />
        </Container>
    );
};

export default GownPostingForm;
