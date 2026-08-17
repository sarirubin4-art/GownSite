import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Box, Typography, Tabs, Tab, Grid, Card, CardMedia, CardContent, CardActionArea, Button, Stack,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert, MenuItem,
    Table, TableHead, TableBody, TableRow, TableCell, Switch, Chip, Divider,
    Autocomplete, FormControlLabel, Checkbox, FormGroup,
    Accordion, AccordionSummary, AccordionDetails, IconButton, LinearProgress
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useAuth } from '../context/AuthContext';
import { useAdLane } from '../context/AdLaneContext';
import useFullScreenDialog from '../hooks/useFullScreenDialog';
import { COLOR_OPTIONS, SIZE_OPTIONS, STYLE_OPTIONS, LISTING_TYPE_OPTIONS } from '../constants/gownOptions';
import LocationField from '../components/LocationField';

const MAX_POST_FOR_PATRON_GOWNS = 20;

const DISCOUNT_TYPE_OPTIONS = [
    { value: 'PercentOff', label: 'Percent off' },
    { value: 'FixedAmountOff', label: 'Fixed amount off' },
    { value: 'FixedPrice', label: 'Set price to' },
    { value: 'VolumeTiered', label: 'Volume-tiered bulk pricing' }
];

const VOLUME_TIER_DESCRIPTION = '$5/gown for 1-4, $4/gown for 5-9, $3.50/gown for 10-14, $3/gown for 15-20 — based on the total size of the batch it\'s applied to.';

const emptyPromoForm = { code: '', discountType: 'PercentOff', discountValue: '', maxUses: '', expiresAt: '', durationMonths: '' };

const emptyPostForPatronShared = { location: '', listingType: 'Rent', displayOwnerName: false, finalize: false };

const makePostForPatronGown = () => ({
    localId: crypto.randomUUID(),
    description: '', colors: [], sizes: [], price: '',
    brand: '', pricePaid: '', condition: '', length: '', styleTags: [], notes: '',
    primaryPicture: null, primaryPreview: null
});

const DetailRow = ({ label, value }) => {
    if (value === null || value === undefined || value === '') return null;
    return (
        <Stack direction="row" spacing={1} sx={{ py: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 140 }}>{label}</Typography>
            <Typography variant="body2" color="text.secondary">{value}</Typography>
        </Stack>
    );
};

const ItemDetailDialog = ({ item, type, onClose, fullScreen }) => (
    <Dialog open={!!item} onClose={onClose} maxWidth="sm" fullWidth fullScreen={fullScreen}>
        <DialogTitle>{type === 'gown' ? 'Gown Details' : 'Ad Details'}</DialogTitle>
        {item && (
            <DialogContent>
                <Box
                    component="img"
                    src={type === 'gown' ? item.primaryPictureUrl : item.imageUrl}
                    alt=""
                    sx={{ width: '100%', maxHeight: 360, objectFit: 'contain', borderRadius: 2, bgcolor: 'background.default', mb: 2 }}
                />
                {item.morePictures?.length > 0 && (
                    <Stack direction="row" spacing={1} sx={{ mb: 2, overflowX: 'auto' }}>
                        {item.morePictures.map((p) => (
                            <Box key={p.url} component="img" src={p.url} alt="" sx={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 1, flexShrink: 0 }} />
                        ))}
                    </Stack>
                )}
                <Divider sx={{ mb: 1.5 }} />
                <DetailRow label="Owner" value={item.owner ? `${item.owner.name} (${item.owner.email}${item.owner.number ? `, ${item.owner.number}` : ''})` : null} />
                {type === 'gown' ? (
                    <>
                        <DetailRow label="Description" value={item.description} />
                        <DetailRow label="Price" value={`$${item.price}`} />
                        <DetailRow label="Rent/Sale" value={item.listingType} />
                        <DetailRow label="Color(s)" value={(item.color || '').split(',').join(', ')} />
                        <DetailRow label="Size(s)" value={(item.size || '').split(',').join(', ')} />
                        <DetailRow label="Location" value={item.location} />
                        <DetailRow label="Brand" value={item.brand} />
                        <DetailRow label="Original Gown Value" value={item.pricePaid != null ? `$${item.pricePaid}` : null} />
                        <DetailRow label="Condition" value={item.condition} />
                        <DetailRow label="Height/Length" value={item.length} />
                        <DetailRow label="Style Tags" value={(item.styleTags || '').split(',').filter(Boolean).join(', ')} />
                        <DetailRow label="Notes" value={item.notes} />
                        <DetailRow label="Show Owner Name" value={item.displayOwnerName ? 'Yes' : 'No'} />
                        <DetailRow label="Batch" value={item.batchId ? 'Part of a bulk batch' : null} />
                    </>
                ) : (
                    <>
                        <DetailRow label="Title" value={item.title} />
                        <DetailRow label="Description" value={item.description} />
                        <DetailRow label="Category" value={item.category} />
                        <DetailRow label="Website/Contact" value={item.targetUrl} />
                    </>
                )}
            </DialogContent>
        )}
        <DialogActions>
            <Button onClick={onClose}>Close</Button>
        </DialogActions>
    </Dialog>
);

const PendingList = ({ items, type, onApprove, onRejectClick, error, fullScreen }) => {
    const batchCounts = items.reduce((acc, i) => {
        if (i.batchId) acc[i.batchId] = (acc[i.batchId] || 0) + 1;
        return acc;
    }, {});
    const [detailItem, setDetailItem] = React.useState(null);

    return (
    <Box sx={{ mt: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {items.length === 0 ? (
            <Typography color="text.secondary">Nothing pending review right now.</Typography>
        ) : (
            <Grid container spacing={3}>
                {items.map((item) => (
                    <Grid key={item.id} size={{ xs: 12, sm: 6, md: 4 }}>
                        <Card>
                            <CardActionArea onClick={() => setDetailItem(item)}>
                                <CardMedia
                                    component="img"
                                    height={type === 'gown' ? '180' : undefined}
                                    image={type === 'gown' ? item.primaryPictureUrl : item.imageUrl}
                                    sx={{ objectFit: 'cover', ...(type === 'ad' ? { aspectRatio: '1 / 1' } : {}) }}
                                />
                                <CardContent>
                                    <Typography variant="subtitle2" color="text.secondary">
                                        {item.owner?.name} &middot; {item.owner?.email}
                                    </Typography>
                                    <Typography variant="body1" sx={{ mt: 0.5 }}>
                                        {type === 'gown' ? item.description : item.title}
                                    </Typography>
                                    {type === 'gown' && <Typography variant="h6" sx={{ mt: 0.5 }}>${item.price}</Typography>}
                                    {item.batchId && batchCounts[item.batchId] > 1 && (
                                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                            Part of a {batchCounts[item.batchId]}-gown batch
                                        </Typography>
                                    )}
                                </CardContent>
                            </CardActionArea>
                            <Stack direction="row" spacing={1} sx={{ p: 2, pt: 0 }}>
                                <Button size="small" variant="contained" color="success" onClick={() => onApprove(item.id)}>
                                    Approve
                                </Button>
                                <Button size="small" variant="outlined" color="error" onClick={() => onRejectClick(item.id)}>
                                    Reject
                                </Button>
                            </Stack>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        )}
        <ItemDetailDialog item={detailItem} type={type} onClose={() => setDetailItem(null)} fullScreen={fullScreen} />
    </Box>
    );
};

const ActiveList = ({ items, type, onTakeDownClick, onEditClick, error }) => (
    <Box sx={{ mt: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {items.length === 0 ? (
            <Typography color="text.secondary">Nothing live right now.</Typography>
        ) : (
            <Grid container spacing={3}>
                {items.map((item) => (
                    <Grid key={item.id} size={{ xs: 12, sm: 6, md: 4 }}>
                        <Card>
                            <CardMedia
                                component="img"
                                height={type === 'gown' ? '180' : undefined}
                                image={type === 'gown' ? item.primaryPictureUrl : item.imageUrl}
                                sx={{ objectFit: 'cover', ...(type === 'ad' ? { aspectRatio: '1 / 1' } : {}) }}
                            />
                            <CardContent>
                                <Typography variant="subtitle2" color="text.secondary">
                                    {item.owner?.name} &middot; {item.owner?.email}
                                </Typography>
                                <Typography variant="body1" sx={{ mt: 0.5 }}>
                                    {type === 'gown' ? item.description : item.title}
                                </Typography>
                                {type === 'gown' && <Typography variant="h6" sx={{ mt: 0.5 }}>${item.price}</Typography>}
                                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                                    {type === 'gown' && (
                                        <Button size="small" variant="outlined" onClick={() => onEditClick(item)}>
                                            Edit
                                        </Button>
                                    )}
                                    <Button size="small" variant="outlined" color="error" onClick={() => onTakeDownClick(item.id)}>
                                        Take Down
                                    </Button>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        )}
    </Box>
);

const AdminDashboard = () => {
    const { owner, loading } = useAuth();
    const { adVisible, laneWidth } = useAdLane();
    const fullScreen = useFullScreenDialog();
    const navigate = useNavigate();
    const [tab, setTab] = useState(0);
    const [pendingGowns, setPendingGowns] = useState([]);
    const [pendingAds, setPendingAds] = useState([]);
    const [activeGowns, setActiveGowns] = useState([]);
    const [activeAds, setActiveAds] = useState([]);
    const [rejectTarget, setRejectTarget] = useState(null); // { type: 'gown'|'ad', id }
    const [rejectReason, setRejectReason] = useState('');
    const [takeDownTarget, setTakeDownTarget] = useState(null); // { type: 'gown'|'ad', id }
    const [takeDownReason, setTakeDownReason] = useState('');
    const [editGownTarget, setEditGownTarget] = useState(null);
    const [editGownNewPrimaryPicture, setEditGownNewPrimaryPicture] = useState(null);
    const [editGownNewPrimaryPreview, setEditGownNewPrimaryPreview] = useState(null);
    const [editGownError, setEditGownError] = useState('');
    const [error, setError] = useState('');
    const [promoCodes, setPromoCodes] = useState([]);
    const [promoDialogOpen, setPromoDialogOpen] = useState(false);
    const [promoForm, setPromoForm] = useState(emptyPromoForm);
    const [promoError, setPromoError] = useState('');
    const [editingPromoId, setEditingPromoId] = useState(null);
    const [owners, setOwners] = useState([]);
    const [promoEmailSubject, setPromoEmailSubject] = useState('');
    const [promoEmailMessage, setPromoEmailMessage] = useState('');
    const [promoEmailSending, setPromoEmailSending] = useState(false);
    const [promoEmailResult, setPromoEmailResult] = useState(null);
    const [promoEmailConfirmOpen, setPromoEmailConfirmOpen] = useState(false);
    const [spreadEmails, setSpreadEmails] = useState('');
    const [spreadSending, setSpreadSending] = useState(false);
    const [spreadResult, setSpreadResult] = useState(null);
    const [deleteOwnerTarget, setDeleteOwnerTarget] = useState(null);
    const [deleteOwnerError, setDeleteOwnerError] = useState('');
    const [deleteOwnerSending, setDeleteOwnerSending] = useState(false);
    const [postForPatronTarget, setPostForPatronTarget] = useState(null);
    const [postForPatronShared, setPostForPatronShared] = useState(emptyPostForPatronShared);
    const [postForPatronGowns, setPostForPatronGowns] = useState([makePostForPatronGown()]);
    const [postForPatronExpanded, setPostForPatronExpanded] = useState(0);
    const [postForPatronError, setPostForPatronError] = useState('');
    const [postForPatronSending, setPostForPatronSending] = useState(false);
    const [postForPatronProgressIndex, setPostForPatronProgressIndex] = useState(0);
    const [postForPatronSavedCount, setPostForPatronSavedCount] = useState(0);
    const [postForPatronFailedIndex, setPostForPatronFailedIndex] = useState(null);
    const [postForPatronSuccess, setPostForPatronSuccess] = useState(false);
    const [contactMessages, setContactMessages] = useState([]);
    const [contactReplyDrafts, setContactReplyDrafts] = useState({});
    const [contactReplySendingId, setContactReplySendingId] = useState(null);
    const [showResolvedMessages, setShowResolvedMessages] = useState(false);
    const [resolvedMessages, setResolvedMessages] = useState([]);
    const [resolvedTotalCount, setResolvedTotalCount] = useState(0);
    const [resolvedPage, setResolvedPage] = useState(0);
    const [resolvedLoading, setResolvedLoading] = useState(false);
    const RESOLVED_PAGE_SIZE = 20;

    const loadPending = async () => {
        const [gowns, ads] = await Promise.all([
            axios.get('/api/admin/gowns/pending'),
            axios.get('/api/admin/ads/pending')
        ]);
        setPendingGowns(gowns.data);
        setPendingAds(ads.data);
    };

    const loadActive = async () => {
        const [gowns, ads] = await Promise.all([
            axios.get('/api/admin/gowns/active'),
            axios.get('/api/admin/ads/active')
        ]);
        setActiveGowns(gowns.data);
        setActiveAds(ads.data);
    };

    const loadPromoCodes = async () => {
        const { data } = await axios.get('/api/admin/promocodes');
        setPromoCodes(data);
    };

    const loadOwners = async () => {
        const { data } = await axios.get('/api/admin/owners');
        setOwners(data);
    };

    const loadContactMessages = async () => {
        const { data } = await axios.get('/api/admin/contact-messages');
        setContactMessages(data);
    };

    const loadMoreResolvedMessages = async () => {
        setResolvedLoading(true);
        try {
            const nextPage = resolvedPage + 1;
            const { data } = await axios.get('/api/admin/contact-messages/resolved', {
                params: { page: nextPage, pageSize: RESOLVED_PAGE_SIZE }
            });
            setResolvedMessages((prev) => [...prev, ...data.items]);
            setResolvedTotalCount(data.totalCount);
            setResolvedPage(nextPage);
        } finally {
            setResolvedLoading(false);
        }
    };

    const onToggleShowResolved = (checked) => {
        setShowResolvedMessages(checked);
        if (checked && resolvedPage === 0) {
            loadMoreResolvedMessages();
        }
    };

    useEffect(() => {
        if (!loading && !owner?.isAdmin) {
            navigate('/');
            return;
        }
        if (owner?.isAdmin) {
            loadPending();
            loadActive();
            loadPromoCodes();
            loadOwners();
            loadContactMessages();
        }
    }, [loading, owner]);

    const onSendContactReply = async (id) => {
        const reply = (contactReplyDrafts[id] || '').trim();
        if (!reply) return;
        setContactReplySendingId(id);
        try {
            await axios.post(`/api/admin/contact-messages/${id}/reply`, { reply });
            await loadContactMessages();
        } finally {
            setContactReplySendingId(null);
        }
    };

    const onResolveContactMessage = async (id) => {
        await axios.post(`/api/admin/contact-messages/${id}/resolve`);
        await loadContactMessages();
    };

    const onSavePromo = async () => {
        setPromoError('');
        const isVolumeTiered = promoForm.discountType === 'VolumeTiered';
        const discountValueMissing = promoForm.discountValue === '' || promoForm.discountValue === null || promoForm.discountValue === undefined;
        if (!promoForm.code.trim() || (!isVolumeTiered && discountValueMissing)) {
            setPromoError('Code and discount value are required.');
            return;
        }
        const payload = {
            code: promoForm.code.trim(),
            discountType: promoForm.discountType,
            discountValue: isVolumeTiered ? 0 : Number(promoForm.discountValue),
            maxUses: promoForm.maxUses === '' ? null : Number(promoForm.maxUses),
            expiresAt: promoForm.expiresAt === '' ? null : promoForm.expiresAt,
            durationMonths: promoForm.durationMonths === '' ? null : Number(promoForm.durationMonths)
        };
        try {
            if (editingPromoId) {
                await axios.post(`/api/admin/promocodes/${editingPromoId}/edit`, payload);
            } else {
                await axios.post('/api/admin/promocodes/create', payload);
            }
            setPromoDialogOpen(false);
            setPromoForm(emptyPromoForm);
            setEditingPromoId(null);
            await loadPromoCodes();
        } catch (err) {
            setPromoError(err?.response?.data?.message || 'Could not save promo code.');
        }
    };

    const onEditPromoClick = (p) => {
        setPromoForm({
            code: p.code,
            discountType: p.discountType,
            discountValue: p.discountValue ?? '',
            maxUses: p.maxUses ?? '',
            expiresAt: p.expiresAt ? p.expiresAt.slice(0, 10) : '',
            durationMonths: p.durationMonths ?? ''
        });
        setEditingPromoId(p.id);
        setPromoError('');
        setPromoDialogOpen(true);
    };

    const onTogglePromo = async (id, isActive) => {
        await axios.post(`/api/admin/promocodes/${id}/toggle`, { isActive });
        await loadPromoCodes();
    };

    const onSendPromoEmail = async () => {
        setPromoEmailConfirmOpen(false);
        setPromoEmailSending(true);
        setPromoEmailResult(null);
        try {
            const { data } = await axios.post('/api/admin/email/promo', {
                subject: promoEmailSubject.trim(),
                message: promoEmailMessage.trim()
            });
            setPromoEmailResult({ type: 'success', text: `Sent to ${data.sent} of ${data.total} patrons.` });
            setPromoEmailSubject('');
            setPromoEmailMessage('');
        } catch (err) {
            setPromoEmailResult({ type: 'error', text: err?.response?.data?.message || 'Could not send the email.' });
        } finally {
            setPromoEmailSending(false);
        }
    };

    const onSendSpreadTheWord = async () => {
        setSpreadSending(true);
        setSpreadResult(null);
        const emails = spreadEmails.split(/[\n,]/).map(e => e.trim()).filter(Boolean);
        try {
            const { data } = await axios.post('/api/admin/email/spread-the-word', { emails });
            setSpreadResult({ type: 'success', text: `Sent to ${data.sent} of ${data.total} addresses.` });
            setSpreadEmails('');
        } catch (err) {
            setSpreadResult({ type: 'error', text: err?.response?.data?.message || 'Could not send the email.' });
        } finally {
            setSpreadSending(false);
        }
    };

    const onApprove = async (type, id) => {
        setError('');
        try {
            await axios.post(`/api/admin/${type === 'gown' ? 'gowns' : 'ads'}/${id}/approve`);
            await loadPending();
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not approve — the charge may have failed.');
        }
    };

    const onRejectConfirm = async () => {
        if (!rejectTarget) return;
        setError('');
        try {
            await axios.post(`/api/admin/${rejectTarget.type === 'gown' ? 'gowns' : 'ads'}/${rejectTarget.id}/reject`, { reason: rejectReason });
            setRejectTarget(null);
            setRejectReason('');
            await loadPending();
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not reject.');
        }
    };

    const onTakeDownConfirm = async () => {
        if (!takeDownTarget) return;
        setError('');
        try {
            await axios.post(`/api/admin/${takeDownTarget.type === 'gown' ? 'gowns' : 'ads'}/${takeDownTarget.id}/takedown`, { reason: takeDownReason });
            setTakeDownTarget(null);
            setTakeDownReason('');
            await loadActive();
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not take this down.');
        }
    };

    const onEditGownClick = (g) => setEditGownTarget({
        id: g.id, description: g.description, colors: (g.color || '').split(',').filter(Boolean), sizes: (g.size || '').split(',').filter(Boolean),
        price: g.price, location: g.location, listingType: g.listingType,
        displayOwnerName: g.displayOwnerName, brand: g.brand || '', pricePaid: g.pricePaid || '',
        condition: g.condition || '', length: g.length || '',
        styleTags: (g.styleTags || '').split(',').filter(Boolean), notes: g.notes || '',
        primaryPictureUrl: g.primaryPictureUrl
    });

    const onCloseEditGownDialog = () => {
        setEditGownTarget(null);
        setEditGownNewPrimaryPicture(null);
        setEditGownNewPrimaryPreview(null);
        setEditGownError('');
    };

    const onEditGownPictureChange = (e) => {
        const file = e.target.files[0];
        setEditGownNewPrimaryPicture(file || null);
        setEditGownNewPrimaryPreview(file ? URL.createObjectURL(file) : null);
    };

    const toggleEditGownStyle = (value) => {
        setEditGownTarget((prev) => {
            const has = prev.styleTags.includes(value);
            return { ...prev, styleTags: has ? prev.styleTags.filter(s => s !== value) : [...prev.styleTags, value] };
        });
    };

    const onSaveEditGown = async () => {
        setEditGownError('');
        const data = new FormData();
        data.append('Id', editGownTarget.id);
        data.append('Description', editGownTarget.description);
        data.append('Color', editGownTarget.colors.join(','));
        data.append('Size', editGownTarget.sizes.join(','));
        data.append('Price', Number(editGownTarget.price));
        data.append('Location', editGownTarget.location);
        data.append('ListingType', editGownTarget.listingType);
        data.append('DisplayOwnerName', editGownTarget.displayOwnerName);
        data.append('Brand', editGownTarget.brand);
        if (editGownTarget.pricePaid !== '') data.append('PricePaid', Number(editGownTarget.pricePaid));
        data.append('Condition', editGownTarget.condition);
        data.append('Length', editGownTarget.length);
        data.append('StyleTags', editGownTarget.styleTags.join(','));
        data.append('Notes', editGownTarget.notes);
        if (editGownNewPrimaryPicture) data.append('PrimaryPicture', editGownNewPrimaryPicture);

        try {
            await axios.post('/api/admin/gowns/edit', data, { headers: { 'Content-Type': 'multipart/form-data' } });
            onCloseEditGownDialog();
            await loadActive();
        } catch (err) {
            setEditGownError(err?.response?.data?.message || 'Could not save changes.');
        }
    };

    const onDeleteOwnerConfirm = async () => {
        if (!deleteOwnerTarget) return;
        setDeleteOwnerError('');
        setDeleteOwnerSending(true);
        try {
            await axios.post(`/api/admin/owners/${deleteOwnerTarget.id}/delete`);
            setDeleteOwnerTarget(null);
            await loadOwners();
        } catch (err) {
            setDeleteOwnerError(err?.response?.data?.message || 'Could not delete this patron.');
        } finally {
            setDeleteOwnerSending(false);
        }
    };

    const onOpenPostForPatron = (patron) => {
        setPostForPatronTarget(patron);
        setPostForPatronShared(emptyPostForPatronShared);
        setPostForPatronGowns([makePostForPatronGown()]);
        setPostForPatronExpanded(0);
        setPostForPatronError('');
        setPostForPatronSavedCount(0);
        setPostForPatronFailedIndex(null);
        setPostForPatronSuccess(false);
    };

    const onClosePostForPatron = () => {
        setPostForPatronTarget(null);
    };

    const updatePostForPatronGown = (localId, patch) => {
        setPostForPatronGowns((prev) => prev.map((g) => (g.localId === localId ? { ...g, ...patch } : g)));
    };

    const togglePostForPatronStyle = (localId, value) => {
        setPostForPatronGowns((prev) => prev.map((g) => {
            if (g.localId !== localId) return g;
            const has = g.styleTags.includes(value);
            return { ...g, styleTags: has ? g.styleTags.filter(s => s !== value) : [...g.styleTags, value] };
        }));
    };

    const onPostForPatronPictureChange = (localId) => (e) => {
        const file = e.target.files[0];
        updatePostForPatronGown(localId, { primaryPicture: file || null, primaryPreview: file ? URL.createObjectURL(file) : null });
    };

    const addPostForPatronGown = () => {
        if (postForPatronGowns.length >= MAX_POST_FOR_PATRON_GOWNS) return;
        setPostForPatronGowns((prev) => [...prev, makePostForPatronGown()]);
        setPostForPatronExpanded(postForPatronGowns.length);
    };

    const removePostForPatronGown = (localId) => {
        setPostForPatronGowns((prev) => prev.filter((g) => g.localId !== localId));
    };

    const postForPatronGownLabel = (g, i) => g.description ? g.description.slice(0, 40) : `Gown ${i + 1}`;

    const onSubmitPostForPatron = async () => {
        for (let i = 0; i < postForPatronGowns.length; i++) {
            const g = postForPatronGowns[i];
            if (!g.description.trim()) {
                setPostForPatronError(`Gown ${i + 1}: please add at least a description.`);
                return;
            }
            if (postForPatronShared.finalize) {
                if (g.colors.length === 0 || g.sizes.length === 0 || !g.price || !postForPatronShared.location.trim()) {
                    setPostForPatronError(`Gown ${i + 1}: color, size, price, and location are required to publish immediately.`);
                    return;
                }
                if (!g.primaryPicture) {
                    setPostForPatronError(`Gown ${i + 1}: a primary picture is required to publish immediately.`);
                    return;
                }
            }
        }
        setPostForPatronError('');
        setPostForPatronSending(true);
        setPostForPatronFailedIndex(null);

        const startIndex = postForPatronFailedIndex ?? postForPatronSavedCount;
        let saved = postForPatronSavedCount;
        for (let i = startIndex; i < postForPatronGowns.length; i++) {
            setPostForPatronProgressIndex(i);
            const g = postForPatronGowns[i];
            try {
                const data = new FormData();
                data.append('OwnerId', postForPatronTarget.id);
                data.append('Description', g.description);
                data.append('Color', g.colors.join(','));
                data.append('Size', g.sizes.join(','));
                if (g.price !== '') data.append('Price', g.price);
                data.append('Location', postForPatronShared.location);
                data.append('ListingType', postForPatronShared.listingType);
                data.append('DisplayOwnerName', postForPatronShared.displayOwnerName);
                data.append('Brand', g.brand);
                if (g.pricePaid !== '') data.append('PricePaid', g.pricePaid);
                data.append('Condition', g.condition);
                data.append('Length', g.length);
                data.append('StyleTags', g.styleTags.join(','));
                data.append('Notes', g.notes);
                if (g.primaryPicture) data.append('PrimaryPicture', g.primaryPicture);
                data.append('Finalize', postForPatronShared.finalize);

                await axios.post('/api/admin/gowns/post-for-patron', data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                saved = i + 1;
                setPostForPatronSavedCount(saved);
            } catch (err) {
                setPostForPatronFailedIndex(i);
                setPostForPatronExpanded(i);
                setPostForPatronError(`Gown ${i + 1} (${postForPatronGownLabel(g, i)}) failed: ${err?.response?.data?.message || `Something went wrong ${postForPatronShared.finalize ? 'publishing' : 'saving'} this gown.`}`);
                setPostForPatronSending(false);
                return;
            }
        }

        setPostForPatronSending(false);
        setPostForPatronSuccess(true);
    };

    if (loading || !owner?.isAdmin) return null;

    const openContactCount = contactMessages.length;
    const visibleContactMessages = showResolvedMessages ? [...contactMessages, ...resolvedMessages] : contactMessages;

    return (
        <Box>
            <Typography variant="h4" gutterBottom>Admin</Typography>
            <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile sx={{ mb: 1 }}>
                <Tab label={`Pending Gowns${pendingGowns.length ? ` (${pendingGowns.length})` : ''}`} />
                <Tab label={`Pending Ads${pendingAds.length ? ` (${pendingAds.length})` : ''}`} />
                <Tab label={`Live Gowns${activeGowns.length ? ` (${activeGowns.length})` : ''}`} />
                <Tab label={`Live Ads${activeAds.length ? ` (${activeAds.length})` : ''}`} />
                <Tab label="Promo Codes" />
                <Tab label={`Patrons${owners.length ? ` (${owners.length})` : ''}`} />
                <Tab label="Send Emails" />
                <Tab label={`Inbox${openContactCount ? ` (${openContactCount})` : ''}`} />
            </Tabs>

            {tab === 0 && (
                <PendingList
                    items={pendingGowns}
                    type="gown"
                    error={error}
                    onApprove={(id) => onApprove('gown', id)}
                    onRejectClick={(id) => setRejectTarget({ type: 'gown', id })}
                    fullScreen={fullScreen}
                />
            )}
            {tab === 1 && (
                <PendingList
                    items={pendingAds}
                    type="ad"
                    error={error}
                    onApprove={(id) => onApprove('ad', id)}
                    onRejectClick={(id) => setRejectTarget({ type: 'ad', id })}
                    fullScreen={fullScreen}
                />
            )}
            {tab === 2 && (
                <ActiveList
                    items={activeGowns}
                    type="gown"
                    error={error}
                    onTakeDownClick={(id) => setTakeDownTarget({ type: 'gown', id })}
                    onEditClick={onEditGownClick}
                />
            )}
            {tab === 3 && (
                <ActiveList
                    items={activeAds}
                    type="ad"
                    error={error}
                    onTakeDownClick={(id) => setTakeDownTarget({ type: 'ad', id })}
                />
            )}
            {tab === 4 && (
                <Box sx={{ mt: 3 }}>
                    <Stack direction="row" sx={{ justifyContent: 'flex-end', mb: 2, mr: { xs: 0, md: adVisible ? `${laneWidth}px` : 0 } }}>
                        <Button variant="contained" onClick={() => { setPromoForm(emptyPromoForm); setEditingPromoId(null); setPromoError(''); setPromoDialogOpen(true); }}>
                            Create Promo Code
                        </Button>
                    </Stack>
                    {promoCodes.length === 0 ? (
                        <Typography color="text.secondary">No promo codes yet.</Typography>
                    ) : (
                        <Box sx={{ overflowX: 'auto' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Code</TableCell>
                                    <TableCell>Discount</TableCell>
                                    <TableCell>Uses</TableCell>
                                    <TableCell>Expires</TableCell>
                                    <TableCell>Active</TableCell>
                                    <TableCell></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {promoCodes.map((p) => (
                                    <TableRow key={p.id}>
                                        <TableCell>{p.code}</TableCell>
                                        <TableCell>
                                            {p.discountType === 'PercentOff' && `${p.discountValue}% off`}
                                            {p.discountType === 'FixedAmountOff' && `$${p.discountValue} off`}
                                            {p.discountType === 'FixedPrice' && `$${p.discountValue} flat`}
                                            {p.discountType === 'VolumeTiered' && 'Volume-tiered bulk pricing'}
                                            {p.durationMonths ? ` for ${p.durationMonths} mo${p.durationMonths === 1 ? '' : 's'}, then full price` : ''}
                                        </TableCell>
                                        <TableCell>{p.timesUsed}{p.maxUses != null ? ` / ${p.maxUses}` : ''}</TableCell>
                                        <TableCell>{p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : '—'}</TableCell>
                                        <TableCell>
                                            <Switch checked={p.isActive} onChange={(e) => onTogglePromo(p.id, e.target.checked)} size="small" />
                                        </TableCell>
                                        <TableCell>
                                            <Button size="small" onClick={() => onEditPromoClick(p)}>Edit</Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        </Box>
                    )}
                </Box>
            )}
            {tab === 5 && (
                <Box sx={{ mt: 3 }}>
                    {owners.length === 0 ? (
                        <Typography color="text.secondary">No patrons yet.</Typography>
                    ) : (
                        <Box sx={{ overflowX: 'auto' }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Name</TableCell>
                                        <TableCell>Email</TableCell>
                                        <TableCell>Phone</TableCell>
                                        <TableCell>Role</TableCell>
                                        <TableCell />
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {owners.map((o) => (
                                        <TableRow key={o.id}>
                                            <TableCell>{o.name}</TableCell>
                                            <TableCell>{o.email}</TableCell>
                                            <TableCell>{o.number || '—'}</TableCell>
                                            <TableCell>
                                                {o.isAdmin ? <Chip size="small" label="Admin" color="primary" /> : 'Patron'}
                                            </TableCell>
                                            <TableCell align="right">
                                                <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                                                    <Button
                                                        size="small" variant="outlined"
                                                        onClick={() => onOpenPostForPatron(o)}
                                                    >
                                                        Post a Gown
                                                    </Button>
                                                    <Button
                                                        size="small" color="error" variant="outlined"
                                                        onClick={() => { setDeleteOwnerError(''); setDeleteOwnerTarget(o); }}
                                                    >
                                                        Delete
                                                    </Button>
                                                </Stack>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Box>
                    )}
                </Box>
            )}
            {tab === 6 && (
                <Stack spacing={4} sx={{ mt: 3, maxWidth: 640 }}>
                    <Box sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="h6" gutterBottom>Promotional Email</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Sends a styled email to every registered patron ({owners.length}). Good for sale announcements or site news.
                        </Typography>
                        {promoEmailResult && (
                            <Alert severity={promoEmailResult.type === 'success' ? 'success' : 'error'} sx={{ mb: 2 }}>
                                {promoEmailResult.text}
                            </Alert>
                        )}
                        <Stack spacing={2}>
                            <TextField
                                label="Subject" fullWidth value={promoEmailSubject}
                                onChange={(e) => setPromoEmailSubject(e.target.value)}
                            />
                            <TextField
                                label="Message" fullWidth multiline rows={5} value={promoEmailMessage}
                                onChange={(e) => setPromoEmailMessage(e.target.value)}
                                helperText="Each line becomes its own paragraph. A 'Shop Now' button is added automatically."
                            />
                            <Box>
                                <Button
                                    variant="contained"
                                    disabled={promoEmailSending || !promoEmailSubject.trim() || !promoEmailMessage.trim()}
                                    onClick={() => setPromoEmailConfirmOpen(true)}
                                >
                                    {promoEmailSending ? 'Sending...' : `Send to All Patrons (${owners.length})`}
                                </Button>
                            </Box>
                        </Stack>
                    </Box>

                    <Box sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="h6" gutterBottom>Spread the Word</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Sends a ready-made showcase email (featuring the site's own ad creatives, with a link to Regowned) to any addresses you paste below — great for inviting people who aren't on the site yet.
                        </Typography>
                        {spreadResult && (
                            <Alert severity={spreadResult.type === 'success' ? 'success' : 'error'} sx={{ mb: 2 }}>
                                {spreadResult.text}
                            </Alert>
                        )}
                        <Stack spacing={2}>
                            <TextField
                                label="Recipient emails" fullWidth multiline rows={4} value={spreadEmails}
                                onChange={(e) => setSpreadEmails(e.target.value)}
                                helperText="One per line, or comma-separated."
                                placeholder={'friend1@example.com\nfriend2@example.com'}
                            />
                            <Box>
                                <Button
                                    variant="contained"
                                    disabled={spreadSending || !spreadEmails.trim()}
                                    onClick={onSendSpreadTheWord}
                                >
                                    {spreadSending ? 'Sending...' : 'Send Invite Email'}
                                </Button>
                            </Box>
                        </Stack>
                    </Box>
                </Stack>
            )}
            {tab === 7 && (
                <Box sx={{ mt: 3, mr: { xs: 0, md: adVisible ? `${laneWidth}px` : 0 } }}>
                    <Stack direction="row" sx={{ justifyContent: 'flex-end', mb: 2 }}>
                        <FormControlLabel
                            control={<Switch checked={showResolvedMessages} onChange={(e) => onToggleShowResolved(e.target.checked)} />}
                            label="Show resolved"
                        />
                    </Stack>
                    {visibleContactMessages.length === 0 ? (
                        <Typography color="text.secondary">Nothing to show.</Typography>
                    ) : (
                        <Grid container spacing={2}>
                            {visibleContactMessages.map((m) => (
                                <Grid key={m.id} size={{ xs: 12, md: 6 }}>
                                <Box sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', opacity: m.isResolved ? 0.6 : 1, height: '100%' }}>
                                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                        <Box>
                                            <Typography variant="subtitle2">
                                                {m.owner?.name} &middot; {m.owner?.email}{m.owner?.number ? ` · ${m.owner.number}` : ''}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {m.topic} &middot; {new Date(m.createdDate).toLocaleString()}
                                            </Typography>
                                        </Box>
                                        {m.isResolved && <Chip size="small" label="Resolved" />}
                                    </Stack>
                                    <Typography variant="body2" sx={{ mb: 2 }}>{m.message}</Typography>

                                    {m.replyMessage ? (
                                        <Box sx={{ p: 2, borderRadius: 1, bgcolor: 'background.default', mb: 2 }}>
                                            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                                                Your reply &middot; {new Date(m.repliedDate).toLocaleString()}
                                            </Typography>
                                            <Typography variant="body2">{m.replyMessage}</Typography>
                                        </Box>
                                    ) : (
                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
                                            <TextField
                                                size="small" fullWidth label="Reply" multiline maxRows={4}
                                                value={contactReplyDrafts[m.id] || ''}
                                                onChange={(e) => setContactReplyDrafts({ ...contactReplyDrafts, [m.id]: e.target.value })}
                                            />
                                            <Button
                                                variant="outlined"
                                                disabled={contactReplySendingId === m.id || !(contactReplyDrafts[m.id] || '').trim()}
                                                onClick={() => onSendContactReply(m.id)}
                                            >
                                                {contactReplySendingId === m.id ? 'Sending...' : 'Send Reply'}
                                            </Button>
                                        </Stack>
                                    )}

                                    {!m.isResolved && (
                                        <Button size="small" onClick={() => onResolveContactMessage(m.id)}>
                                            Mark Resolved
                                        </Button>
                                    )}
                                </Box>
                                </Grid>
                            ))}
                        </Grid>
                    )}
                    {showResolvedMessages && resolvedMessages.length < resolvedTotalCount && (
                        <Stack alignItems="center" sx={{ mt: 3 }}>
                            <Button variant="outlined" disabled={resolvedLoading} onClick={loadMoreResolvedMessages}>
                                {resolvedLoading ? 'Loading...' : `Load More (${resolvedTotalCount - resolvedMessages.length} remaining)`}
                            </Button>
                        </Stack>
                    )}
                </Box>
            )}

            <Dialog open={promoEmailConfirmOpen} onClose={() => setPromoEmailConfirmOpen(false)} maxWidth="xs" fullWidth fullScreen={fullScreen}>
                <DialogTitle>Send to All Patrons?</DialogTitle>
                <DialogContent>
                    <Typography>
                        This will email all {owners.length} registered patrons with the subject "{promoEmailSubject}". This can't be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPromoEmailConfirmOpen(false)}>Cancel</Button>
                    <Button variant="contained" color="primary" onClick={onSendPromoEmail}>Send</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={!!rejectTarget} onClose={() => setRejectTarget(null)} maxWidth="sm" fullWidth fullScreen={fullScreen}>
                <DialogTitle>Reject Submission</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        label="Reason (sent to the owner by email)"
                        multiline
                        rows={3}
                        fullWidth
                        sx={{ mt: 1 }}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRejectTarget(null)}>Cancel</Button>
                    <Button variant="contained" color="error" disabled={!rejectReason.trim()} onClick={onRejectConfirm}>
                        Reject
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={!!takeDownTarget} onClose={() => setTakeDownTarget(null)} maxWidth="sm" fullWidth fullScreen={fullScreen}>
                <DialogTitle>Take Down Listing</DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mt: 1, mb: 2 }}>
                        This cancels the owner's subscription immediately and removes the listing from the site.
                    </Alert>
                    <TextField
                        autoFocus
                        label="Reason (sent to the owner by email)"
                        multiline
                        rows={3}
                        fullWidth
                        value={takeDownReason}
                        onChange={(e) => setTakeDownReason(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setTakeDownTarget(null)}>Cancel</Button>
                    <Button variant="contained" color="error" disabled={!takeDownReason.trim()} onClick={onTakeDownConfirm}>
                        Take Down
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={!!editGownTarget} onClose={onCloseEditGownDialog} maxWidth="sm" fullWidth fullScreen={fullScreen}>
                <DialogTitle>Edit Listing</DialogTitle>
                {editGownTarget && (
                    <DialogContent>
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            {editGownError && <Alert severity="error">{editGownError}</Alert>}
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Box
                                    component="img"
                                    src={editGownNewPrimaryPreview || editGownTarget.primaryPictureUrl}
                                    alt="Primary"
                                    sx={{
                                        width: 100, height: 100, borderRadius: 2, objectFit: 'cover',
                                        border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper'
                                    }}
                                />
                                <Button variant="outlined" component="label" size="small">
                                    Change Photo
                                    <input type="file" accept="image/*" hidden onChange={onEditGownPictureChange} />
                                </Button>
                            </Stack>
                            <TextField label="Description" multiline rows={2} value={editGownTarget.description}
                                onChange={(e) => setEditGownTarget({ ...editGownTarget, description: e.target.value })} />
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <Autocomplete
                                    multiple
                                    fullWidth
                                    options={COLOR_OPTIONS}
                                    value={editGownTarget.colors}
                                    onChange={(e, value) => setEditGownTarget({ ...editGownTarget, colors: value })}
                                    renderInput={(params) => <TextField {...params} label="Color(s)" />}
                                />
                                <Autocomplete
                                    multiple
                                    fullWidth
                                    options={SIZE_OPTIONS}
                                    value={editGownTarget.sizes}
                                    onChange={(e, value) => setEditGownTarget({ ...editGownTarget, sizes: value })}
                                    renderInput={(params) => <TextField {...params} label="Size(s)" />}
                                />
                            </Stack>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField label="Price" type="number" fullWidth value={editGownTarget.price}
                                    onChange={(e) => setEditGownTarget({ ...editGownTarget, price: e.target.value })} />
                                <TextField select label="Rent/Sale" fullWidth value={editGownTarget.listingType}
                                    onChange={(e) => setEditGownTarget({ ...editGownTarget, listingType: e.target.value })}>
                                    {LISTING_TYPE_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                                </TextField>
                            </Stack>
                            <LocationField
                                label="Location"
                                value={editGownTarget.location}
                                onChange={(value) => setEditGownTarget({ ...editGownTarget, location: value })}
                            />
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField label="Brand" fullWidth value={editGownTarget.brand}
                                    onChange={(e) => setEditGownTarget({ ...editGownTarget, brand: e.target.value })} />
                                <TextField label="Original Gown Value" type="number" fullWidth value={editGownTarget.pricePaid}
                                    onChange={(e) => setEditGownTarget({ ...editGownTarget, pricePaid: e.target.value })} />
                            </Stack>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField label="Condition" fullWidth value={editGownTarget.condition}
                                    placeholder="e.g. Like new, worn once"
                                    onChange={(e) => setEditGownTarget({ ...editGownTarget, condition: e.target.value })} />
                                <TextField label="Height/Length" fullWidth value={editGownTarget.length}
                                    onChange={(e) => setEditGownTarget({ ...editGownTarget, length: e.target.value })} />
                            </Stack>
                            <Box>
                                <Typography variant="subtitle2" sx={{ mb: 1 }}>Style Tags (select all that apply)</Typography>
                                <FormGroup row>
                                    {STYLE_OPTIONS.map(s => (
                                        <FormControlLabel
                                            key={s.value}
                                            control={<Checkbox checked={editGownTarget.styleTags.includes(s.value)} onChange={() => toggleEditGownStyle(s.value)} />}
                                            label={s.label}
                                            sx={{ width: { xs: '100%', sm: '50%' } }}
                                        />
                                    ))}
                                </FormGroup>
                            </Box>
                            <TextField label="Notes" multiline rows={2} value={editGownTarget.notes}
                                onChange={(e) => setEditGownTarget({ ...editGownTarget, notes: e.target.value })} />
                        </Stack>
                    </DialogContent>
                )}
                <DialogActions>
                    <Button onClick={onCloseEditGownDialog}>Cancel</Button>
                    <Button variant="contained" onClick={onSaveEditGown}>Save Changes</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={!!deleteOwnerTarget} onClose={() => setDeleteOwnerTarget(null)} maxWidth="sm" fullWidth fullScreen={fullScreen}>
                <DialogTitle>Delete Patron?</DialogTitle>
                <DialogContent>
                    {deleteOwnerError && <Alert severity="error" sx={{ mt: 1, mb: 2 }}>{deleteOwnerError}</Alert>}
                    <Typography variant="body2">
                        This permanently deletes <strong>{deleteOwnerTarget?.name}</strong> ({deleteOwnerTarget?.email}). This can't be undone.
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Patrons with any gowns or ads on record — active or not — can't be deleted; remove those listings first.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteOwnerTarget(null)}>Cancel</Button>
                    <Button variant="contained" color="error" disabled={deleteOwnerSending} onClick={onDeleteOwnerConfirm}>
                        {deleteOwnerSending ? 'Deleting...' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={!!postForPatronTarget} onClose={onClosePostForPatron} maxWidth="md" fullWidth fullScreen={fullScreen}>
                <DialogTitle>Post {postForPatronGowns.length > 1 ? `${postForPatronGowns.length} Gowns` : 'a Gown'} for {postForPatronTarget?.name}</DialogTitle>
                <DialogContent>
                    {postForPatronSuccess ? (
                        <Alert severity="success" sx={{ mt: 1 }}>
                            {postForPatronShared.finalize
                                ? `Published! ${postForPatronGowns.length > 1 ? 'They\'re' : 'It\'s'} live on the site now, comped — no card was charged.`
                                : `Saved! ${postForPatronGowns.length > 1 ? 'They\'re' : 'It\'s'} in ${postForPatronTarget?.name}'s My Listings as "Setup Incomplete" — they just need to add a card and submit.`}
                        </Alert>
                    ) : (
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            {postForPatronError && (
                                <Alert severity="error">
                                    {postForPatronError}
                                    {postForPatronSavedCount > 0 && (
                                        <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                                            {postForPatronSavedCount} gown{postForPatronSavedCount === 1 ? '' : 's'} already saved — fix the one above and retry, or close and pick up the rest later.
                                        </Typography>
                                    )}
                                </Alert>
                            )}
                            <Typography variant="body2" color="text.secondary">
                                {postForPatronShared.finalize
                                    ? 'Publishing goes live immediately under their account — comped, no card and no subscription at all.'
                                    : "Each gown saves as a draft under their account — no card needed from you. They'll finish it themselves from My Listings."}
                            </Typography>

                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={postForPatronShared.finalize}
                                        onChange={(e) => setPostForPatronShared({ ...postForPatronShared, finalize: e.target.checked })}
                                    />
                                }
                                label="Finalize now — publish immediately, no card required (comped)"
                            />

                            {postForPatronSending && (
                                <Box>
                                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                                        {postForPatronShared.finalize ? 'Publishing' : 'Saving'} gown {postForPatronProgressIndex + 1} of {postForPatronGowns.length}...
                                    </Typography>
                                    <LinearProgress variant="determinate" value={(postForPatronProgressIndex / postForPatronGowns.length) * 100} />
                                </Box>
                            )}

                            <Grid container spacing={2}>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <LocationField
                                        value={postForPatronShared.location}
                                        onChange={(value) => setPostForPatronShared({ ...postForPatronShared, location: value })}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <TextField select label="Rent or Sale" fullWidth value={postForPatronShared.listingType}
                                        onChange={(e) => setPostForPatronShared({ ...postForPatronShared, listingType: e.target.value })}>
                                        {LISTING_TYPE_OPTIONS.map(o2 => <MenuItem key={o2.value} value={o2.value}>{o2.label}</MenuItem>)}
                                    </TextField>
                                </Grid>
                            </Grid>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={postForPatronShared.displayOwnerName}
                                        onChange={(e) => setPostForPatronShared({ ...postForPatronShared, displayOwnerName: e.target.checked })}
                                    />
                                }
                                label="Show their name publicly on these listings"
                            />

                            {postForPatronGowns.map((g, i) => (
                                <Accordion
                                    key={g.localId}
                                    expanded={postForPatronExpanded === i}
                                    onChange={() => setPostForPatronExpanded(postForPatronExpanded === i ? -1 : i)}
                                    variant="outlined"
                                    sx={{ border: '1px solid', borderColor: postForPatronFailedIndex === i ? 'error.main' : 'divider' }}
                                >
                                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexGrow: 1, pr: 1 }}>
                                            <Typography sx={{ flexGrow: 1 }}>{postForPatronGownLabel(g, i)}</Typography>
                                            {postForPatronSavedCount > i && <Chip size="small" color="success" label="Saved" />}
                                            {postForPatronFailedIndex === i && <Chip size="small" color="error" label="Failed" />}
                                            {postForPatronGowns.length > 1 && (
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => { e.stopPropagation(); removePostForPatronGown(g.localId); }}
                                                    disabled={postForPatronSending}
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
                                                    label="Description" value={g.description}
                                                    onChange={(e) => updatePostForPatronGown(g.localId, { description: e.target.value })}
                                                    fullWidth multiline rows={2}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 4 }}>
                                                <Autocomplete
                                                    multiple
                                                    options={COLOR_OPTIONS}
                                                    value={g.colors}
                                                    onChange={(e, value) => updatePostForPatronGown(g.localId, { colors: value })}
                                                    renderInput={(params) => <TextField {...params} label="Color(s)" />}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 4 }}>
                                                <Autocomplete
                                                    multiple
                                                    options={SIZE_OPTIONS}
                                                    value={g.sizes}
                                                    onChange={(e, value) => updatePostForPatronGown(g.localId, { sizes: value })}
                                                    renderInput={(params) => <TextField {...params} label="Size(s)" />}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 4 }}>
                                                <TextField
                                                    label="Price" type="number" fullWidth value={g.price}
                                                    onChange={(e) => updatePostForPatronGown(g.localId, { price: e.target.value })}
                                                    slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 6 }}>
                                                <Button variant="outlined" component="label" fullWidth sx={{ py: 1.5 }}>
                                                    {g.primaryPicture ? 'Change Primary Picture' : `Upload Primary Picture${postForPatronShared.finalize ? '' : ' (optional)'}`}
                                                    <input type="file" accept="image/*" hidden onChange={onPostForPatronPictureChange(g.localId)} />
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
                                            <Grid size={{ xs: 12, sm: 6 }}>
                                                <TextField label="Brand" fullWidth size="small" value={g.brand}
                                                    onChange={(e) => updatePostForPatronGown(g.localId, { brand: e.target.value })} />
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 6 }}>
                                                <TextField label="Original Gown Value" type="number" fullWidth size="small" value={g.pricePaid}
                                                    onChange={(e) => updatePostForPatronGown(g.localId, { pricePaid: e.target.value })} />
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 6 }}>
                                                <TextField label="Condition" fullWidth size="small" value={g.condition}
                                                    placeholder="e.g. Like new, worn once"
                                                    onChange={(e) => updatePostForPatronGown(g.localId, { condition: e.target.value })} />
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 6 }}>
                                                <TextField label="Height/Length" fullWidth size="small" value={g.length}
                                                    onChange={(e) => updatePostForPatronGown(g.localId, { length: e.target.value })} />
                                            </Grid>
                                            <Grid size={12}>
                                                <Typography variant="subtitle2" sx={{ mb: 1 }}>Style Tags</Typography>
                                                <FormGroup row>
                                                    {STYLE_OPTIONS.map(s => (
                                                        <FormControlLabel
                                                            key={s.value}
                                                            control={
                                                                <Checkbox
                                                                    size="small"
                                                                    checked={g.styleTags.includes(s.value)}
                                                                    onChange={() => togglePostForPatronStyle(g.localId, s.value)}
                                                                />
                                                            }
                                                            label={s.label}
                                                            sx={{ width: { xs: '100%', sm: '33%' } }}
                                                        />
                                                    ))}
                                                </FormGroup>
                                            </Grid>
                                            <Grid size={12}>
                                                <TextField label="Notes" fullWidth multiline rows={2} size="small" value={g.notes}
                                                    onChange={(e) => updatePostForPatronGown(g.localId, { notes: e.target.value })} />
                                            </Grid>
                                        </Grid>
                                    </AccordionDetails>
                                </Accordion>
                            ))}

                            <Box>
                                <Button
                                    startIcon={<AddIcon />}
                                    onClick={addPostForPatronGown}
                                    disabled={postForPatronGowns.length >= MAX_POST_FOR_PATRON_GOWNS || postForPatronSending}
                                >
                                    Add Another Gown {postForPatronGowns.length >= MAX_POST_FOR_PATRON_GOWNS ? `(max ${MAX_POST_FOR_PATRON_GOWNS})` : ''}
                                </Button>
                            </Box>
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions>
                    {postForPatronSuccess ? (
                        <Button onClick={onClosePostForPatron}>Close</Button>
                    ) : (
                        <>
                            <Button onClick={onClosePostForPatron}>Cancel</Button>
                            <Button variant="contained" disabled={postForPatronSending} onClick={onSubmitPostForPatron}>
                                {postForPatronSending
                                    ? (postForPatronShared.finalize ? 'Publishing...' : 'Saving...')
                                    : postForPatronFailedIndex !== null
                                        ? 'Retry From Failed Gown'
                                        : postForPatronShared.finalize
                                            ? `Publish ${postForPatronGowns.length} Gown${postForPatronGowns.length === 1 ? '' : 's'} Now`
                                            : `Save ${postForPatronGowns.length} Draft${postForPatronGowns.length === 1 ? '' : 's'}`}
                            </Button>
                        </>
                    )}
                </DialogActions>
            </Dialog>

            <Dialog open={promoDialogOpen} onClose={() => { setPromoDialogOpen(false); setEditingPromoId(null); }} maxWidth="sm" fullWidth fullScreen={fullScreen}>
                <DialogTitle>{editingPromoId ? 'Edit Promo Code' : 'Create Promo Code'}</DialogTitle>
                <DialogContent>
                    {promoError && <Alert severity="warning" sx={{ mb: 2 }}>{promoError}</Alert>}
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            label="Code" fullWidth
                            value={promoForm.code}
                            onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })}
                        />
                        <TextField
                            select label="Discount Type" fullWidth
                            value={promoForm.discountType}
                            onChange={(e) => setPromoForm({ ...promoForm, discountType: e.target.value })}
                        >
                            {DISCOUNT_TYPE_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                        </TextField>
                        {promoForm.discountType === 'VolumeTiered' ? (
                            <Alert severity="info">{VOLUME_TIER_DESCRIPTION}</Alert>
                        ) : (
                            <TextField
                                label={promoForm.discountType === 'PercentOff' ? 'Percent (e.g. 20)' : 'Dollar amount'}
                                type="number" fullWidth
                                value={promoForm.discountValue}
                                onChange={(e) => setPromoForm({ ...promoForm, discountValue: e.target.value })}
                            />
                        )}
                        <TextField
                            label="Duration in months (optional — leave blank for the life of the subscription)"
                            type="number" fullWidth
                            value={promoForm.durationMonths}
                            onChange={(e) => setPromoForm({ ...promoForm, durationMonths: e.target.value })}
                            helperText="If set, billing automatically reverts to the full price after this many months."
                        />
                        <TextField
                            label="Max Uses (optional)" type="number" fullWidth
                            value={promoForm.maxUses}
                            onChange={(e) => setPromoForm({ ...promoForm, maxUses: e.target.value })}
                        />
                        <TextField
                            label="Expires (optional)" type="date" fullWidth
                            InputLabelProps={{ shrink: true }}
                            value={promoForm.expiresAt}
                            onChange={(e) => setPromoForm({ ...promoForm, expiresAt: e.target.value })}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setPromoDialogOpen(false); setEditingPromoId(null); }}>Cancel</Button>
                    <Button variant="contained" onClick={onSavePromo}>{editingPromoId ? 'Save Changes' : 'Create'}</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default AdminDashboard;
