import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Box, Typography, Grid, Card, CardMedia, CardContent, Chip, Button, Stack,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Autocomplete, createFilterOptions,
    Checkbox, FormControlLabel, FormGroup
} from '@mui/material';
import { COLOR_OPTIONS, SIZE_OPTIONS, LISTING_TYPE_OPTIONS, STYLE_OPTIONS } from '../constants/gownOptions';
import { useAuth } from '../context/AuthContext';
import useFullScreenDialog from '../hooks/useFullScreenDialog';

const locationFilter = createFilterOptions({ matchFrom: 'start' });

const MyListings = () => {
    const { owner, loading } = useAuth();
    const navigate = useNavigate();
    const fullScreen = useFullScreenDialog();
    const [listings, setListings] = useState([]);
    const [editTarget, setEditTarget] = useState(null);
    const [existingLocations, setExistingLocations] = useState([]);
    const [promoCodeInput, setPromoCodeInput] = useState('');
    const [promoApplying, setPromoApplying] = useState(false);
    const [promoMessage, setPromoMessage] = useState(null); // { type: 'success'|'error', text }

    const load = async () => {
        const { data } = await axios.get('/api/gown/mylistings');
        setListings(data);
    };

    const batchCounts = listings.reduce((acc, g) => {
        if (g.batchId) acc[g.batchId] = (acc[g.batchId] || 0) + 1;
        return acc;
    }, {});

    useEffect(() => {
        if (!loading && !owner) {
            navigate('/login?redirect=/mylistings');
            return;
        }
        if (owner) load();
    }, [loading, owner]);

    useEffect(() => {
        axios.get('/api/gown/locations').then(({ data }) => setExistingLocations(data)).catch(() => {});
    }, []);

    const onCancelClick = async (id) => {
        if (!window.confirm('This will cancel your subscription and take the listing down. Continue?')) return;
        await axios.post('/api/gown/cancel', { id });
        load();
    };

    const onMarkSoldClick = async (id) => {
        if (!window.confirm("This will cancel your subscription and mark the listing as Sold. It will stay visible with a Sold stamp. Continue?")) return;
        await axios.post('/api/gown/marksold', { id });
        load();
    };

    const onSaveEdit = async () => {
        await axios.post('/api/gown/edit', {
            ...editTarget,
            color: editTarget.colors.join(','),
            size: editTarget.sizes.join(','),
            price: Number(editTarget.price),
            pricePaid: editTarget.pricePaid === '' ? null : Number(editTarget.pricePaid),
            styleTags: editTarget.styleTags.join(',')
        });
        setEditTarget(null);
        load();
    };

    const toggleEditStyle = (value) => {
        setEditTarget((prev) => {
            const has = prev.styleTags.includes(value);
            return { ...prev, styleTags: has ? prev.styleTags.filter(s => s !== value) : [...prev.styleTags, value] };
        });
    };

    const onCloseEditDialog = () => {
        setEditTarget(null);
        setPromoCodeInput('');
        setPromoMessage(null);
    };

    const onApplyPromo = async () => {
        if (!promoCodeInput.trim()) return;
        setPromoApplying(true);
        setPromoMessage(null);
        try {
            await axios.post('/api/payment/apply-gown-promo', { id: editTarget.id, promoCode: promoCodeInput.trim() });
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
            <Typography variant="h4" gutterBottom>My Listings</Typography>
            {listings.length === 0 && (
                <Typography color="text.secondary">You haven't posted any gowns yet.</Typography>
            )}
            <Grid container spacing={3}>
                {listings.map((g) => (
                    <Grid key={g.id} size={{ xs: 12, sm: 6, md: 4 }}>
                        <Card>
                            <CardMedia component="img" height="180" image={g.primaryPictureUrl} sx={{ objectFit: 'cover' }} />
                            <CardContent>
                                <Stack direction="row" sx={{ mb: 1, justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Chip
                                        size="small"
                                        label={
                                            g.moderationStatus === 'Draft' ? 'Setup Incomplete' :
                                            g.moderationStatus === 'PendingReview' ? 'Pending Review' :
                                            g.moderationStatus === 'Rejected' ? 'Rejected' :
                                            g.moderationStatus === 'Removed' ? 'Removed by Admin' :
                                            g.isSold ? 'Sold' : (g.isActive ? 'Active' : 'Inactive')
                                        }
                                        color={
                                            g.moderationStatus === 'Draft' ? 'default' :
                                            g.moderationStatus === 'PendingReview' ? 'info' :
                                            g.moderationStatus === 'Rejected' ? 'error' :
                                            g.moderationStatus === 'Removed' ? 'error' :
                                            g.isSold ? 'secondary' : (g.isActive ? 'success' : 'default')
                                        }
                                    />
                                    <Typography variant="body2" color="text.secondary">
                                        {g.inquiryCount} {g.inquiryCount === 1 ? 'inquiry' : 'inquiries'}
                                    </Typography>
                                </Stack>
                                <Typography variant="h6">${g.price}</Typography>
                                <Typography variant="body2" color="text.secondary">{(g.color || '').split(',').join(', ')} &middot; Size {(g.size || '').split(',').join(', ')}</Typography>
                                {g.batchId && batchCounts[g.batchId] > 1 && (
                                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                        Part of a {batchCounts[g.batchId]}-gown batch
                                    </Typography>
                                )}
                                {(g.moderationStatus === 'Rejected' || g.moderationStatus === 'Removed') && g.rejectionReason && (
                                    <Typography variant="body2" color="error.main" sx={{ mt: 1 }}>
                                        Reason: {g.rejectionReason}
                                    </Typography>
                                )}
                                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                                    <Button size="small" variant="outlined" onClick={() => setEditTarget({
                                        id: g.id, description: g.description, colors: (g.color || '').split(',').filter(Boolean), sizes: (g.size || '').split(',').filter(Boolean),
                                        price: g.price, location: g.location, listingType: g.listingType,
                                        displayOwnerName: g.displayOwnerName, brand: g.brand || '', pricePaid: g.pricePaid || '',
                                        condition: g.condition || '', length: g.length || '',
                                        styleTags: (g.styleTags || '').split(',').filter(Boolean), notes: g.notes || '',
                                        isActive: g.isActive
                                    })}>
                                        Edit
                                    </Button>
                                    {g.moderationStatus === 'Draft' ? (
                                        <Button size="small" color="success" variant="outlined" onClick={() => navigate(`/postagown/payment-setup/${g.id}`)}>
                                            Complete Setup
                                        </Button>
                                    ) : g.moderationStatus === 'PendingReview' || g.moderationStatus === 'Rejected' || g.moderationStatus === 'Removed' ? null : g.isSold ? null : g.isActive ? (
                                        <>
                                            <Button size="small" color="secondary" variant="outlined" onClick={() => onMarkSoldClick(g.id)}>
                                                Mark as Sold
                                            </Button>
                                            <Button size="small" color="error" variant="outlined" onClick={() => onCancelClick(g.id)}>
                                                Cancel & Remove
                                            </Button>
                                        </>
                                    ) : (
                                        <Button size="small" color="success" variant="outlined" onClick={() => navigate(`/postagown/payment/${g.id}`)}>
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
                <DialogTitle>Edit Listing</DialogTitle>
                {editTarget && (
                    <DialogContent>
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            {editTarget.isActive && (
                                <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                                    <Typography variant="subtitle2" gutterBottom>Apply a Promo Code</Typography>
                                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                                        Applying a new code replaces any promo already on this listing. It takes effect on your next bill — nothing changes for the period you've already been charged for.
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
                            <TextField label="Description" multiline rows={2} value={editTarget.description}
                                onChange={(e) => setEditTarget({ ...editTarget, description: e.target.value })} />
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <Autocomplete
                                    multiple
                                    fullWidth
                                    options={COLOR_OPTIONS}
                                    value={editTarget.colors}
                                    onChange={(e, value) => setEditTarget({ ...editTarget, colors: value })}
                                    renderInput={(params) => <TextField {...params} label="Color(s)" />}
                                />
                                <Autocomplete
                                    multiple
                                    fullWidth
                                    options={SIZE_OPTIONS}
                                    value={editTarget.sizes}
                                    onChange={(e, value) => setEditTarget({ ...editTarget, sizes: value })}
                                    renderInput={(params) => <TextField {...params} label="Size(s)" />}
                                />
                            </Stack>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField label="Price" type="number" fullWidth value={editTarget.price}
                                    onChange={(e) => setEditTarget({ ...editTarget, price: e.target.value })} />
                                <TextField select label="Rent/Sale" fullWidth value={editTarget.listingType}
                                    onChange={(e) => setEditTarget({ ...editTarget, listingType: e.target.value })}>
                                    {LISTING_TYPE_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                                </TextField>
                            </Stack>
                            <Autocomplete
                                freeSolo
                                autoComplete
                                autoHighlight
                                options={existingLocations}
                                filterOptions={locationFilter}
                                value={editTarget.location}
                                onInputChange={(e, value) => setEditTarget({ ...editTarget, location: value })}
                                renderInput={(params) => <TextField {...params} label="Location" />}
                            />
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField label="Brand" fullWidth value={editTarget.brand}
                                    onChange={(e) => setEditTarget({ ...editTarget, brand: e.target.value })} />
                                <TextField label="Original Gown Value" type="number" fullWidth value={editTarget.pricePaid}
                                    onChange={(e) => setEditTarget({ ...editTarget, pricePaid: e.target.value })} />
                            </Stack>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField label="Condition" fullWidth value={editTarget.condition}
                                    placeholder="e.g. Like new, worn once"
                                    onChange={(e) => setEditTarget({ ...editTarget, condition: e.target.value })} />
                                <TextField label="Height/Length" fullWidth value={editTarget.length}
                                    onChange={(e) => setEditTarget({ ...editTarget, length: e.target.value })} />
                            </Stack>
                            <Box>
                                <Typography variant="subtitle2" sx={{ mb: 1 }}>Style Tags (select all that apply)</Typography>
                                <FormGroup row>
                                    {STYLE_OPTIONS.map(s => (
                                        <FormControlLabel
                                            key={s.value}
                                            control={<Checkbox checked={editTarget.styleTags.includes(s.value)} onChange={() => toggleEditStyle(s.value)} />}
                                            label={s.label}
                                            sx={{ width: { xs: '100%', sm: '50%' } }}
                                        />
                                    ))}
                                </FormGroup>
                            </Box>
                            <TextField label="Notes" multiline rows={2} value={editTarget.notes}
                                onChange={(e) => setEditTarget({ ...editTarget, notes: e.target.value })} />
                        </Stack>
                    </DialogContent>
                )}
                <DialogActions>
                    <Button onClick={onCloseEditDialog}>Cancel</Button>
                    <Button variant="contained" onClick={onSaveEdit}>Save Changes</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default MyListings;
