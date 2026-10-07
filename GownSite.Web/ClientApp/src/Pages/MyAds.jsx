import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
    Box, Typography, Grid, Card, CardMedia, CardContent, Chip, Button, Stack,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, Snackbar, Alert,
    FormControlLabel, Checkbox
} from '@mui/material';
import { AD_CATEGORY_OPTIONS, adCategoryLabels } from '../constants/gownOptions';
import { useAuth } from '../context/AuthContext';
import useFullScreenDialog from '../hooks/useFullScreenDialog';
import LocationField from '../components/LocationField';
import FilterAutocomplete from '../components/FilterAutocomplete';
import PromoApplyBox from '../components/PromoApplyBox';
import ContactVisibilityCheckboxes from '../components/ContactVisibilityCheckboxes';
import ImagePositionEditor from '../components/ImagePositionEditor';
import { focalObjectPosition } from '../utils/imageFocal';
import useFormError from '../hooks/useFormError';

// The Ads section of My Listings (it was its own My Ads page). Renders nothing for someone
// with no ads, and reports its count up so My Listings can decide what headings to show.
const MyAds = ({ onLoaded, scrollIntoViewOnLoad }) => {
    const { owner, loading } = useAuth();
    const fullScreen = useFullScreenDialog();
    const navigate = useNavigate();
    const routerLocation = useLocation();
    const [ads, setAds] = useState([]);
    const [adsLoaded, setAdsLoaded] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [showPostedNotice, setShowPostedNotice] = useState(!!routerLocation.state?.posted);
    const [promoApplying, setPromoApplying] = useState(false);
    const [promoMessage, setPromoMessage] = useState(null); // { type: 'success'|'error', text }
    const [newImage, setNewImage] = useState(null);
    const [newImagePreview, setNewImagePreview] = useState(null);
    const [editError, setEditError, editErrorRef] = useFormError();

    const [adStats, setAdStats] = useState({}); // { [adId]: { impressions, cardClicks, views, viewsLast30Days, websiteClicks } }

    const load = async () => {
        try {
            const { data } = await axios.get('/api/ad/myads');
            setAds(data);
            // Secondary info — the ads themselves shouldn't wait on (or fail with) this.
            axios.get('/api/ad/myads/stats').then(({ data: stats }) => setAdStats(stats)).catch(() => {});
        } finally {
            setAdsLoaded(true);
        }
    };

    // Rendered as the Ads tab of My Listings, which already handles the logged-out redirect.
    useEffect(() => {
        if (owner) load();
    }, [owner]);

    useEffect(() => {
        if (!adsLoaded) return;
        onLoaded?.(ads.length);
    }, [adsLoaded, ads.length]);

    // Arriving from an old My Ads link or right after posting an ad: go straight to the ads.
    const scrolledRef = React.useRef(false);
    useEffect(() => {
        if (!adsLoaded || !scrollIntoViewOnLoad || scrolledRef.current || ads.length === 0) return;
        scrolledRef.current = true;
        setTimeout(() => document.getElementById('my-ads')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }, [adsLoaded, scrollIntoViewOnLoad, ads.length]);

    useEffect(() => {
        if (routerLocation.state?.posted) {
            // Keep the query string — it's what selects the Ads tab.
            navigate(routerLocation.pathname + routerLocation.search, { replace: true, state: {} });
        }
    }, []);

    const onCancelClick = async (id) => {
        if (!window.confirm('This will cancel your subscription and take the ad down. Continue?')) return;
        await axios.post('/api/ad/cancel', { id });
        load();
    };

    const onDeleteDraftClick = async (id, isPendingReview) => {
        const message = isPendingReview
            ? "This ad has already been submitted and is awaiting review — deleting it now will withdraw it entirely, not just save it as a draft. This can't be undone. Continue?"
            : 'This will permanently delete this draft. Continue?';
        if (!window.confirm(message)) return;
        await axios.post('/api/ad/delete-draft', { id });
        load();
    };

    const onSaveEdit = async () => {
        setEditError('');
        const data = new FormData();
        data.append('Id', editTarget.id);
        data.append('Title', editTarget.title);
        data.append('Description', editTarget.description);
        data.append('TargetUrl', editTarget.targetUrl);
        data.append('Category', editTarget.categories.join(','));
        data.append('Location', editTarget.location);
        data.append('ServesAllLocations', editTarget.servesAllLocations);
        data.append('ShowName', editTarget.showName);
        data.append('ShowPhone', editTarget.showPhone);
        data.append('ShowEmail', editTarget.showEmail);
        if (newImage) data.append('Image', newImage);
        data.append('ImageFocalX', editTarget.imageFocalX);
        data.append('ImageFocalY', editTarget.imageFocalY);

        try {
            await axios.post('/api/ad/edit', data, { headers: { 'Content-Type': 'multipart/form-data' } });
            setEditTarget(null);
            setNewImage(null);
            setNewImagePreview(null);
            load();
        } catch (err) {
            setEditError(err?.response?.data?.message || 'Could not save changes.');
        }
    };

    const onEditImageChange = (e) => {
        const file = e.target.files[0];
        setNewImage(file || null);
        setNewImagePreview(file ? URL.createObjectURL(file) : null);
        setEditTarget((prev) => ({ ...prev, imageFocalX: 0.5, imageFocalY: 0.5 }));
    };

    const onCloseEditDialog = () => {
        setEditTarget(null);
        setPromoMessage(null);
        setNewImage(null);
        setNewImagePreview(null);
        setEditError('');
    };

    const onApplyPromo = async (promoCode) => {
        setPromoApplying(true);
        setPromoMessage(null);
        try {
            await axios.post('/api/payment/apply-ad-promo', { id: editTarget.id, promoCode });
            setPromoMessage({ type: 'success', text: 'Promo applied! Your next bill will reflect the new price.' });
            load();
        } catch (err) {
            setPromoMessage({ type: 'error', text: err?.response?.data?.message || 'Could not apply promo code.' });
        } finally {
            setPromoApplying(false);
        }
    };

    if (loading || !owner || !adsLoaded) return null;
    // The posted-ad notice still has to show even before the list refreshes — so only bail
    // out entirely when there's truly nothing to render.
    if (ads.length === 0 && !showPostedNotice) return null;

    const activeCount = ads.filter((a) => a.isActive).length;

    return (
        <Box id="my-ads" sx={{ mt: 5, scrollMarginTop: { xs: 140, md: 80 } }}>
            <Typography variant="h5" sx={{ mb: 0.5 }}>Your Ads</Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
                {activeCount} ad{activeCount === 1 ? '' : 's'} live
            </Typography>
            <Grid container spacing={3}>
                {ads.map((a) => (
                    <Grid key={a.id} size={{ xs: 12, sm: 6, md: 4 }}>
                        <Card>
                            <CardMedia component="img" image={a.imageUrl} sx={{ aspectRatio: '1 / 1', objectFit: 'cover', objectPosition: focalObjectPosition(a.imageFocalX, a.imageFocalY) }} />
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
                                    <Typography variant="body2" color="text.secondary">{adCategoryLabels(a.categories).join(', ')}</Typography>
                                </Stack>
                                <Typography variant="h6">{a.title}</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>{a.description}</Typography>
                                {adStats[a.id] && a.moderationStatus === 'Approved' && (
                                    <Box sx={{ mt: 1.5, p: 1.25, borderRadius: 1, bgcolor: 'background.default' }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600, mb: 0.5 }}>
                                            Your ad's reach
                                        </Typography>
                                        {[
                                            ['Shown to visitors', adStats[a.id].impressions],
                                            ['Ad clicks', adStats[a.id].cardClicks],
                                            ['Page views', adStats[a.id].views],
                                            ['Website clicks', adStats[a.id].websiteClicks],
                                            ['Contact info requests', a.inquiryCount]
                                        ].map(([label, value]) => (
                                            <Stack key={label} direction="row" sx={{ justifyContent: 'space-between' }}>
                                                <Typography variant="body2">{label}</Typography>
                                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{(value ?? 0).toLocaleString()}</Typography>
                                            </Stack>
                                        ))}
                                    </Box>
                                )}
                                {(a.moderationStatus === 'Rejected' || a.moderationStatus === 'Removed') && a.rejectionReason && (
                                    <Typography variant="body2" color="error.main" sx={{ mt: 1 }}>
                                        Reason: {a.rejectionReason}
                                    </Typography>
                                )}
                                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                                    <Button size="small" variant="outlined" onClick={() => setEditTarget({
                                        id: a.id, title: a.title, description: a.description,
                                        targetUrl: a.targetUrl || '', categories: (a.categories || '').split(',').filter(Boolean),
                                        location: a.location || '', servesAllLocations: !!a.servesAllLocations,
                                        isActive: a.isActive, imageUrl: a.imageUrl, promoCode: a.promoCode,
                                        imageFocalX: a.imageFocalX ?? 0.5, imageFocalY: a.imageFocalY ?? 0.5,
                                        showName: a.showName, showPhone: a.showPhone, showEmail: a.showEmail
                                    })}>
                                        Edit
                                    </Button>
                                    {a.moderationStatus === 'Draft' ? (
                                        <>
                                            <Button size="small" color="success" variant="outlined" onClick={() => navigate(`/advertise/form?resume=${a.id}`)}>
                                                Complete Setup
                                            </Button>
                                            <Button size="small" color="error" variant="outlined" onClick={() => onDeleteDraftClick(a.id)}>
                                                Delete
                                            </Button>
                                        </>
                                    ) : a.moderationStatus === 'PendingReview' ? (
                                        <Button size="small" color="error" variant="outlined" onClick={() => onDeleteDraftClick(a.id, true)}>
                                            Delete
                                        </Button>
                                    ) : a.moderationStatus === 'Rejected' || a.moderationStatus === 'Removed' ? null : a.isActive ? (
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
                            {editError && <Alert ref={editErrorRef} severity="error">{editError}</Alert>}
                            {editTarget.isActive && (
                                <PromoApplyBox
                                    currentPromoCode={editTarget.promoCode?.code}
                                    onApply={onApplyPromo}
                                    applying={promoApplying}
                                    message={promoMessage}
                                />
                            )}
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Box
                                    component="img"
                                    src={newImagePreview || editTarget.imageUrl}
                                    alt="Ad"
                                    sx={{
                                        width: 100, height: 100, borderRadius: 2, objectFit: 'cover',
                                        objectPosition: focalObjectPosition(editTarget.imageFocalX, editTarget.imageFocalY),
                                        border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper'
                                    }}
                                />
                                <Button variant="outlined" component="label" size="small">
                                    Change Photo
                                    <input type="file" accept="image/*" hidden onChange={onEditImageChange} />
                                </Button>
                            </Stack>
                            <ImagePositionEditor
                                src={newImagePreview || editTarget.imageUrl}
                                focal={{ x: editTarget.imageFocalX, y: editTarget.imageFocalY }}
                                onChange={(f) => setEditTarget({ ...editTarget, imageFocalX: f.x, imageFocalY: f.y })}
                                size={200}
                            />
                            <TextField label="Title" value={editTarget.title}
                                onChange={(e) => setEditTarget({ ...editTarget, title: e.target.value })} />
                            <TextField label="Description" multiline rows={2} value={editTarget.description}
                                onChange={(e) => setEditTarget({ ...editTarget, description: e.target.value })} />
                            <FilterAutocomplete
                                label="Category" helperText="Choose all that apply."
                                options={AD_CATEGORY_OPTIONS.map(c => c.value)}
                                getOptionLabel={(value) => AD_CATEGORY_OPTIONS.find(c => c.value === value)?.label || value}
                                value={editTarget.categories}
                                onChange={(e, value) => setEditTarget({ ...editTarget, categories: value })}
                            />
                            <TextField label="Website/Contact Link" value={editTarget.targetUrl}
                                onChange={(e) => setEditTarget({ ...editTarget, targetUrl: e.target.value })} />
                            {!editTarget.servesAllLocations && (
                                <LocationField value={editTarget.location}
                                    onChange={(value) => setEditTarget({ ...editTarget, location: value })} />
                            )}
                            <FormControlLabel
                                control={
                                    <Checkbox checked={editTarget.servesAllLocations} onChange={(e) => setEditTarget({
                                        ...editTarget, servesAllLocations: e.target.checked,
                                        location: e.target.checked ? '' : editTarget.location
                                    })} />
                                }
                                label="This business isn't tied to one location (e.g. online-only)"
                            />
                            <ContactVisibilityCheckboxes
                                showName={editTarget.showName}
                                showPhone={editTarget.showPhone}
                                showEmail={editTarget.showEmail}
                                onChange={(next) => setEditTarget({ ...editTarget, ...next })}
                                subjectLabel="my"
                                requireReachableChannel
                            />
                        </Stack>
                    </DialogContent>
                )}
                <DialogActions>
                    <Button onClick={onCloseEditDialog}>Cancel</Button>
                    <Button
                        variant="contained" onClick={onSaveEdit}
                        disabled={editTarget && !editTarget.showPhone && !editTarget.showEmail}
                    >
                        Save Changes
                    </Button>
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
