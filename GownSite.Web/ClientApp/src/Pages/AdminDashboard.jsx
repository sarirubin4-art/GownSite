import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Box, Typography, Tabs, Tab, Grid, Card, CardMedia, CardContent, Button, Stack,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert, MenuItem,
    Table, TableHead, TableBody, TableRow, TableCell, Switch, Chip
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useAdLane } from '../context/AdLaneContext';
import useFullScreenDialog from '../hooks/useFullScreenDialog';

const DISCOUNT_TYPE_OPTIONS = [
    { value: 'PercentOff', label: 'Percent off' },
    { value: 'FixedAmountOff', label: 'Fixed amount off' },
    { value: 'FixedPrice', label: 'Set price to' },
    { value: 'VolumeTiered', label: 'Volume-tiered bulk pricing' }
];

const VOLUME_TIER_DESCRIPTION = '$5/gown for 1-4, $4/gown for 5-9, $3.50/gown for 10-14, $3/gown for 15-20 — based on the total size of the batch it\'s applied to.';

const emptyPromoForm = { code: '', discountType: 'PercentOff', discountValue: '', maxUses: '', expiresAt: '', durationMonths: '' };

const PendingList = ({ items, type, onApprove, onRejectClick, error }) => {
    const batchCounts = items.reduce((acc, i) => {
        if (i.batchId) acc[i.batchId] = (acc[i.batchId] || 0) + 1;
        return acc;
    }, {});

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
                                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                                    <Button size="small" variant="contained" color="success" onClick={() => onApprove(item.id)}>
                                        Approve
                                    </Button>
                                    <Button size="small" variant="outlined" color="error" onClick={() => onRejectClick(item.id)}>
                                        Reject
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
};

const ActiveList = ({ items, type, onTakeDownClick, error }) => (
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
        }
    }, [loading, owner]);

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

    if (loading || !owner?.isAdmin) return null;

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
            </Tabs>

            {tab === 0 && (
                <PendingList
                    items={pendingGowns}
                    type="gown"
                    error={error}
                    onApprove={(id) => onApprove('gown', id)}
                    onRejectClick={(id) => setRejectTarget({ type: 'gown', id })}
                />
            )}
            {tab === 1 && (
                <PendingList
                    items={pendingAds}
                    type="ad"
                    error={error}
                    onApprove={(id) => onApprove('ad', id)}
                    onRejectClick={(id) => setRejectTarget({ type: 'ad', id })}
                />
            )}
            {tab === 2 && (
                <ActiveList
                    items={activeGowns}
                    type="gown"
                    error={error}
                    onTakeDownClick={(id) => setTakeDownTarget({ type: 'gown', id })}
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
