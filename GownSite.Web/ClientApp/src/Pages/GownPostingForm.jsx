import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Container, Typography, TextField, Button, Stack, MenuItem, Grid,
    FormControlLabel, Checkbox, FormGroup, Paper, Alert, Box, Autocomplete, createFilterOptions,
    Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { COLOR_OPTIONS, SIZE_OPTIONS, STYLE_OPTIONS, LISTING_TYPE_OPTIONS } from '../constants/gownOptions';
import { useAuth } from '../context/AuthContext';
import useFullScreenDialog from '../hooks/useFullScreenDialog';

const MAX_MORE_PICTURES = 5;

const locationFilter = createFilterOptions({ matchFrom: 'start' });

const GownPostingForm = () => {
    const { owner, loading } = useAuth();
    const fullScreen = useFullScreenDialog();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [primaryPicture, setPrimaryPicture] = useState(null);
    const [primaryPreview, setPrimaryPreview] = useState(null);
    const [morePictures, setMorePictures] = useState([]);
    const [morePicturesError, setMorePicturesError] = useState('');
    const [existingLocations, setExistingLocations] = useState([]);
    const [inquiryOpen, setInquiryOpen] = useState(false);
    const [inquiryMessage, setInquiryMessage] = useState('');
    const [inquirySending, setInquirySending] = useState(false);
    const [inquirySent, setInquirySent] = useState(false);
    const [inquiryError, setInquiryError] = useState('');

    const [form, setForm] = useState({
        description: '',
        colors: [],
        sizes: [],
        price: '',
        location: '',
        listingType: 'Rent',
        displayOwnerName: false,
        brand: '',
        pricePaid: '',
        condition: '',
        length: '',
        styleTags: [],
        notes: '',
        promoCode: ''
    });

    useEffect(() => {
        if (!loading && !owner) {
            navigate('/login?redirect=/postagown/terms');
        }
    }, [loading, owner]);

    useEffect(() => {
        axios.get('/api/gown/locations').then(({ data }) => setExistingLocations(data)).catch(() => {});
    }, []);

    const onChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });

    const toggleStyle = (value) => {
        setForm((prev) => {
            const has = prev.styleTags.includes(value);
            return { ...prev, styleTags: has ? prev.styleTags.filter(s => s !== value) : [...prev.styleTags, value] };
        });
    };

    const onPrimaryPictureChange = (e) => {
        const file = e.target.files[0];
        setPrimaryPicture(file || null);
        setPrimaryPreview(file ? URL.createObjectURL(file) : null);
    };

    const onMorePicturesChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > MAX_MORE_PICTURES) {
            setMorePicturesError(`You can upload up to ${MAX_MORE_PICTURES} additional photos — only the first ${MAX_MORE_PICTURES} were kept.`);
            setMorePictures(files.slice(0, MAX_MORE_PICTURES));
        } else {
            setMorePicturesError('');
            setMorePictures(files);
        }
    };

    const validate = () => {
        if (!form.description || form.colors.length === 0 || form.sizes.length === 0 || !form.price || !form.location) {
            return 'Please fill in description, color, size, price, and location.';
        }
        if (!primaryPicture) {
            return 'Please add a primary picture of the gown.';
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
            data.append('Description', form.description);
            data.append('Color', form.colors.join(','));
            data.append('Size', form.sizes.join(','));
            data.append('Price', form.price);
            data.append('Location', form.location);
            data.append('ListingType', form.listingType);
            data.append('DisplayOwnerName', form.displayOwnerName);
            data.append('Brand', form.brand);
            data.append('PricePaid', form.pricePaid);
            data.append('Condition', form.condition);
            data.append('Length', form.length);
            data.append('StyleTags', form.styleTags.join(','));
            data.append('Notes', form.notes);
            data.append('PromoCode', form.promoCode);
            data.append('PrimaryPicture', primaryPicture);
            morePictures.forEach((file) => data.append('MorePictures', file));

            const { data: result } = await axios.post('/api/gown/create', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            navigate(`/postagown/payment-setup/${result.id}`);
        } catch (err) {
            setError(err?.response?.data?.message || 'Something went wrong saving your listing.');
        } finally {
            setSubmitting(false);
        }
    };

    const onOpenInquiry = () => {
        setInquiryMessage('');
        setInquiryError('');
        setInquirySent(false);
        setInquiryOpen(true);
    };

    const onSendInquiry = async () => {
        if (!inquiryMessage.trim()) {
            setInquiryError('Please enter a message.');
            return;
        }
        setInquiryError('');
        setInquirySending(true);
        try {
            await axios.post('/api/contact/business-inquiry', { message: inquiryMessage });
            setInquirySent(true);
        } catch (err) {
            setInquiryError(err?.response?.data?.message || 'Could not send your message.');
        } finally {
            setInquirySending(false);
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
                        <Autocomplete
                            multiple
                            options={COLOR_OPTIONS}
                            value={form.colors}
                            onChange={(e, value) => setForm({ ...form, colors: value })}
                            renderInput={(params) => <TextField {...params} label="Color(s)" />}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <Autocomplete
                            multiple
                            options={SIZE_OPTIONS}
                            value={form.sizes}
                            onChange={(e, value) => setForm({ ...form, sizes: value })}
                            renderInput={(params) => <TextField {...params} label="Size(s)" helperText="Fits a range? Select each size it fits." />}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField select label="Rent or Sale" value={form.listingType} onChange={onChange('listingType')} fullWidth>
                            {LISTING_TYPE_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                        </TextField>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            label="Price" type="number" value={form.price} onChange={onChange('price')}
                            fullWidth slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <Autocomplete
                            freeSolo
                            autoComplete
                            autoHighlight
                            options={existingLocations}
                            filterOptions={locationFilter}
                            value={form.location}
                            onInputChange={(e, value) => setForm({ ...form, location: value })}
                            renderInput={(params) => <TextField {...params} label="Location (city/area)" />}
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
                        <Button variant="outlined" component="label">
                            {morePictures.length > 0 ? `${morePictures.length} additional photo(s) selected` : `Add More Pictures (up to ${MAX_MORE_PICTURES}, optional)`}
                            <input type="file" accept="image/*" multiple hidden onChange={onMorePicturesChange} />
                        </Button>
                        {morePicturesError && <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>{morePicturesError}</Typography>}
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
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            label="Promo Code" value={form.promoCode} onChange={onChange('promoCode')}
                            fullWidth placeholder="Have a code? Enter it here"
                        />
                    </Grid>
                </Grid>
            </Paper>

            <FormControlLabel
                control={<Checkbox checked={form.displayOwnerName} onChange={(e) => setForm({ ...form, displayOwnerName: e.target.checked })} />}
                label="Show my name publicly on this listing"
            />

            <Stack direction="row" sx={{ mt: 2, justifyContent: 'flex-end' }}>
                <Button variant="contained" size="large" disabled={submitting} onClick={onSubmit}>
                    {submitting ? 'Saving...' : 'Confirm & Continue to Payment'}
                </Button>
            </Stack>

            <Box sx={{ mt: 6, textAlign: 'center' }}>
                <Button variant="text" onClick={onOpenInquiry}>
                    Are you a business? Contact me for our bulk discount!
                </Button>
            </Box>

            <Dialog open={inquiryOpen} onClose={() => setInquiryOpen(false)} maxWidth="sm" fullWidth fullScreen={fullScreen}>
                <DialogTitle>Bulk Discount Inquiry</DialogTitle>
                <DialogContent>
                    {inquirySent ? (
                        <Alert severity="success" sx={{ mt: 1 }}>Thanks! We'll be in touch soon.</Alert>
                    ) : (
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                                Tell us a bit about your business and how many gowns you're looking to list — we'll follow up by email.
                            </Typography>
                            {inquiryError && <Alert severity="error">{inquiryError}</Alert>}
                            <TextField
                                label="Message" value={inquiryMessage} onChange={(e) => setInquiryMessage(e.target.value)}
                                fullWidth multiline rows={4} autoFocus
                            />
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions>
                    {inquirySent ? (
                        <Button onClick={() => setInquiryOpen(false)}>Close</Button>
                    ) : (
                        <>
                            <Button onClick={() => setInquiryOpen(false)}>Cancel</Button>
                            <Button variant="contained" onClick={onSendInquiry} disabled={inquirySending}>
                                {inquirySending ? 'Sending...' : 'Send'}
                            </Button>
                        </>
                    )}
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default GownPostingForm;
