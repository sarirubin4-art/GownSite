import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Container, Typography, TextField, Button, Stack, MenuItem, Grid, Paper, Alert, Box } from '@mui/material';
import { AD_CATEGORY_OPTIONS } from '../constants/gownOptions';
import { useAuth } from '../context/AuthContext';

const AdPostingForm = () => {
    const { owner, loading } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [image, setImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

    const [form, setForm] = useState({
        title: '',
        description: '',
        category: '',
        targetUrl: '',
        promoCode: ''
    });

    useEffect(() => {
        if (!loading && !owner) {
            navigate('/login?redirect=/advertise/terms');
        }
    }, [loading, owner]);

    const onChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });

    const onImageChange = (e) => {
        const file = e.target.files[0];
        setImage(file || null);
        setImagePreview(file ? URL.createObjectURL(file) : null);
    };

    const validate = () => {
        if (!form.title || !form.description || !form.category) {
            return 'Please fill in title, description, and category.';
        }
        if (!image) {
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
            data.append('Title', form.title);
            data.append('Description', form.description);
            data.append('Category', form.category);
            data.append('TargetUrl', form.targetUrl);
            data.append('PromoCode', form.promoCode);
            data.append('Image', image);

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
            <Alert severity="info" sx={{ mb: 2 }}>
                Please include your location (city/area) in your description — our audience spans many locations,
                and it helps the right people find you.
            </Alert>

            <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
                <Grid container spacing={2}>
                    <Grid size={12}>
                        <TextField label="Business/Ad Title" value={form.title} onChange={onChange('title')} fullWidth />
                    </Grid>
                    <Grid size={12}>
                        <TextField
                            label="Description" value={form.description} onChange={onChange('description')}
                            fullWidth multiline rows={3}
                            placeholder="What you offer, and don't forget to mention your location..."
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
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField label="Promo Code (optional)" value={form.promoCode} onChange={onChange('promoCode')} fullWidth />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <Button variant="outlined" component="label" fullWidth sx={{ py: 1.5 }}>
                            {image ? 'Change Image' : 'Upload Ad Image'}
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

            <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
                <Button variant="contained" size="large" disabled={submitting} onClick={onSubmit}>
                    {submitting ? 'Saving...' : 'Confirm & Continue to Payment'}
                </Button>
            </Stack>
        </Container>
    );
};

export default AdPostingForm;
