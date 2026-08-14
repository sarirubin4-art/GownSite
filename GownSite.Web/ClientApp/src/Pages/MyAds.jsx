import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
    Box, Typography, Grid, Card, CardMedia, CardContent, Chip, Button, Stack,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Snackbar, Alert
} from '@mui/material';
import { AD_CATEGORY_OPTIONS, adCategoryLabel } from '../constants/gownOptions';
import { useAuth } from '../context/AuthContext';
import useFullScreenDialog from '../hooks/useFullScreenDialog';

const MyAds = () => {
    const { owner, loading } = useAuth();
    const fullScreen = useFullScreenDialog();
    const navigate = useNavigate();
    const routerLocation = useLocation();
    const [ads, setAds] = useState([]);
    const [editTarget, setEditTarget] = useState(null);
    const [showPostedNotice, setShowPostedNotice] = useState(!!routerLocation.state?.posted);
    const [promoCodeInput, setPromoCodeInput] = useState('');
    const [promoApplying, setPromoApplying] = useState(false);
    const [promoMessage, setPromoMessage] = useState(null); // { type: 'success'|'error', text }
    const [newImage, setNewImage] = useState(null);
    const [newImagePreview, setNewImagePreview] = useState(null);

    const load = async () => {
        const { data } = await axios.get('/api/ad/myads');
        setAds(data);
    };

    useEffect(() => {
        if (!loading && !owner) {
            navigate('/login?redirect=/myads');
            return;
        }
        if (owner) load();
    }, [loading, owner]);

    useEffect(() => {
        if (routerLocation.state?.posted) {
            navigate(routerLocation.pathname, { replace: true, state: {} });
        }
    }, []);

    const onCancelClick = async (id) => {
        if (!window.confirm('This will cancel your subscription and take the ad down. Continue?')) return;
        await axios.post('/api/ad/cancel', { id });
        load();
    };

    const onSaveEdit = async () => {
        const data = new FormData();
        data.append('Id', editTarget.id);
        data.append('Title', editTarget.title);
        data.append('Description', editTarget.description);
        data.append('TargetUrl', editTarget.targetUrl);
        data.append('Category', editTarget.category);
        if (newImage) data.append('Image', newImage);

        await axios.post('/api/ad/edit', data, { headers: { 'Content-Type': 'multipart/form-data' } });
        setEditTarget(null);
        setNewImage(null);
        setNewImagePreview(null);
        load();
    };

    const onEditImageChange = (e) => {
        const file = e.target.files[0];
        setNewImage(file || null);
        setNewImagePreview(file ? URL.createObjectURL(file) : null);
    };

    const onCloseEditDialog = () => {
        setEditTarget(null);
        setPromoCodeInput('');
        setPromoMessage(null);
        setNewImage(null);
        setNewImagePreview(null);
    };

    const onApplyPromo = async () => {
        if (!promoCodeInput.trim()) return;
        setPromoApplying(true);
        setPromoMessage(null);
        try {
            await axios.post('/api/payment/apply-ad-promo', { id: editTarget.id, promoCode: promoCodeInput.trim() });
            setPromoMessage({ type: 'success', text: 'Promo applied! Your next bill will reflect the new price.' });
            setPromoCodeInput('');
            load();
        } catch (err) {
            setPromoMessage({ type: 'error', text: err?.response?.data?.message || 'Could not apply promo code.' });
        } finally {
            setPromoApplying(false);
        }
    };

    if (loading || !owner) return null;

    return (
        <Box>
            <Typography variant="h4" gutterBottom>My Ads</Typography>
            {ads.length === 0 && (
                <Typography color="text.secondary">You haven't placed any ads yet.</Typography>
            )}
            <Grid container spacing={3}>
                {ads.map((a) => (
                    <Grid key={a.id} size={{ xs: 12, sm: 6, md: 4 }}>
                        <Card>
                            <CardMedia component="img" image={a.imageUrl} sx={{ aspectRatio: '1 / 1', objectFit: 'cover' }} />
                            <CardContent>
                                <Stack direction="row" sx={{ mb: 1, justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Chip
                                        size="small"
                                        label={
                                            a.moderationStatus === 'Draft' ? 'Setup Incomplete' :
                                            a.moderationStatus === 'PendingReview' ? 'Pending Review' :
                                            a.moderationStatus === 'Rejected' ? 'Rejected' :
                                            a.moderationStatus === 'Removed' ? 'Removed by Admin' :
                                            a.isActive ? 'Active' : 'Inactive'
                                        }
                                        color={
                                            a.moderationStatus === 'Draft' ? 'default' :
                                            a.moderationStatus === 'PendingReview' ? 'info' :
                                            a.moderationStatus === 'Rejected' ? 'error' :
                                            a.moderationStatus === 'Removed' ? 'error' :
                                            a.isActive ? 'success' : 'default'
                                        }
                                    />
                                    <Typography variant="body2" color="text.secondary">{adCategoryLabel(a.category)}</Typography>
                                </Stack>
                                <Typography variant="h6">{a.title}</Typography>
                                <Typography variant="body2" color="text.secondary">{a.description}</Typography>
                                {(a.moderationStatus === 'Rejected' || a.moderationStatus === 'Removed') && a.rejectionReason && (
                                    <Typography variant="body2" color="error.main" sx={{ mt: 1 }}>
                                        Reason: {a.rejectionReason}
                                    </Typography>
                                )}
                                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                                    <Button size="small" variant="outlined" onClick={() => setEditTarget({
                                        id: a.id, title: a.title, description: a.description,
                                        targetUrl: a.targetUrl || '', category: a.category,
                                        isActive: a.isActive, imageUrl: a.imageUrl
                                    })}>
                                        Edit
                                    </Button>
                                    {a.moderationStatus === 'Draft' ? (
                                        <Button size="small" color="success" variant="outlined" onClick={() => navigate(`/advertise/form?resume=${a.id}`)}>
                                            Complete Setup
                                        </Button>
                                    ) : a.moderationStatus === 'PendingReview' || a.moderationStatus === 'Rejected' || a.moderationStatus === 'Removed' ? null : a.isActive ? (
                                        <Button size="small" color="error" variant="outlined" onClick={() => onCancelClick(a.id)}>
                                            Cancel & Remove
                                        </Button>
                                    ) : (
                                        <Button size="small" color="success" variant="outlined" onClick={() => navigate(`/advertise/payment/${a.id}`)}>
                                            Reactivate
                                        </Button>
                                    )}
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Dialog open={!!editTarget} onClose={onCloseEditDialog} maxWidth="sm" fullWidth fullScreen={fullScreen}>
                <DialogTitle>Edit Ad</DialogTitle>
                {editTarget && (
                    <DialogContent>
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            {editTarget.isActive && (
                                <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                                    <Typography variant="subtitle2" gutterBottom>Apply a Promo Code</Typography>
                                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                                        Applying a new code replaces any promo already on this ad. It takes effect on your next bill — nothing changes for the period you've already been charged for.
                                    </Typography>
                                    {promoMessage && (
                                        <Typography variant="body2" color={promoMessage.type === 'success' ? 'success.main' : 'error.main'} sx={{ mb: 1 }}>
                                            {promoMessage.text}
                                        </Typography>
                                    )}
                                    <Stack direction="row" spacing={1}>
                                        <TextField
                                            size="small" fullWidth label="Promo Code" value={promoCodeInput}
                                            onChange={(e) => setPromoCodeInput(e.target.value)}
                                        />
                                        <Button variant="outlined" disabled={promoApplying || !promoCodeInput.trim()} onClick={onApplyPromo}>
                                            {promoApplying ? 'Applying...' : 'Apply'}
                                        </Button>
                                    </Stack>
                                </Box>
                            )}
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Box
                                    component="img"
                                    src={newImagePreview || editTarget.imageUrl}
                                    alt="Ad"
                                    sx={{
                                        width: 100, height: 100, borderRadius: 2, objectFit: 'cover',
                                        border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper'
                                    }}
                                />
                                <Button variant="outlined" component="label" size="small">
                                    Change Photo
                                    <input type="file" accept="image/*" hidden onChange={onEditImageChange} />
                                </Button>
                            </Stack>
                            <TextField label="Title" value={editTarget.title}
                                onChange={(e) => setEditTarget({ ...editTarget, title: e.target.value })} />
                            <TextField label="Description" multiline rows={2} value={editTarget.description}
                                onChange={(e) => setEditTarget({ ...editTarget, description: e.target.value })} />
                            <TextField select label="Category" fullWidth value={editTarget.category}
                                onChange={(e) => setEditTarget({ ...editTarget, category: e.target.value })}>
                                {AD_CATEGORY_OPTIONS.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
                            </TextField>
                            <TextField label="Website/Contact Link" value={editTarget.targetUrl}
                                onChange={(e) => setEditTarget({ ...editTarget, targetUrl: e.target.value })} />
                        </Stack>
                    </DialogContent>
                )}
                <DialogActions>
                    <Button onClick={onCloseEditDialog}>Cancel</Button>
                    <Button variant="contained" onClick={onSaveEdit}>Save Changes</Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={showPostedNotice}
                autoHideDuration={6000}
                onClose={() => setShowPostedNotice(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setShowPostedNotice(false)} severity="success" variant="filled">
                    Posted successfully! Your ad is now live.
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default MyAds;
